/**
 * OTLP (OpenTelemetry Protocol) HTTP endpoint for LLMFlow
 *
 * Accepts OTLP/HTTP JSON traces and transforms them to LLMFlow span format.
 * This allows users with existing OpenTelemetry/OpenLLMetry instrumentation
 * to export traces directly to LLMFlow.
 *
 * Supports:
 * - OTLP/HTTP JSON format (Content-Type: application/json)
 * - gen_ai.* semantic conventions (OpenLLMetry)
 * - Standard OTEL span attributes
 */

const db = require('@llmflow/db')
const { calculateCost } = require('@llmflow/pricing')

/**
 * Map gen_ai.operation.name (OTel GenAI semconv, Development status) to span types.
 * This is the highest-priority signal — newer instrumentations (OpenAI SDK,
 * Anthropic SDK, Vercel AI SDK v5+) emit operation.name directly.
 * Spec: https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/
 */
const GENAI_OPERATION_TO_SPAN_TYPE = {
    chat: 'llm',
    text_completion: 'llm',
    generate_content: 'llm',
    embeddings: 'embedding',
    execute_tool: 'tool',
    create_agent: 'agent',
    invoke_agent: 'agent',
    invoke_workflow: 'chain',
    retrieval: 'retrieval',
}

/**
 * Map gen_ai.system / gen_ai.provider.name values to span types
 */
const PROVIDER_TO_SPAN_TYPE = {
    openai: 'llm',
    anthropic: 'llm',
    cohere: 'llm',
    bedrock: 'llm',
    'aws.bedrock': 'llm',
    azure: 'llm',
    'azure.ai.openai': 'llm',
    google: 'llm',
    'gcp.gemini': 'llm',
    'gcp.gen_ai': 'llm',
    'gcp.vertex_ai': 'llm',
    ollama: 'llm',
    groq: 'llm',
    together: 'llm',
    mistral: 'llm',
    mistral_ai: 'llm',
    replicate: 'llm',
    deepseek: 'llm',
    perplexity: 'llm',
    x_ai: 'llm',
    'ibm.watsonx.ai': 'llm',
}

/**
 * Map traceloop.span.kind to LLMFlow span types
 */
const TRACELOOP_KIND_TO_SPAN_TYPE = {
    workflow: 'trace',
    task: 'chain',
    agent: 'agent',
    tool: 'tool',
}

/**
 * Convert hex string to standard UUID format if needed
 */
function normalizeId(hexId) {
    if (!hexId) return null
    // Remove any existing dashes and lowercase
    const clean = hexId.replace(/-/g, '').toLowerCase()
    // If it's already short enough, return as-is
    if (clean.length <= 32) return clean
    return clean
}

/**
 * Extract attributes from OTLP KeyValue array format
 * OTLP attributes are: [{ key: "foo", value: { stringValue: "bar" } }, ...]
 */
function extractAttributes(attrs) {
    if (!attrs || !Array.isArray(attrs)) return {}

    const result = {}
    for (const attr of attrs) {
        const key = attr.key
        const val = attr.value
        if (!val) continue

        // OTLP value types: stringValue, intValue, doubleValue, boolValue, arrayValue, kvlistValue
        if (val.stringValue !== undefined) result[key] = val.stringValue
        else if (val.intValue !== undefined) result[key] = parseInt(val.intValue, 10)
        else if (val.doubleValue !== undefined) result[key] = val.doubleValue
        else if (val.boolValue !== undefined) result[key] = val.boolValue
        else if (val.arrayValue?.values) {
            result[key] = val.arrayValue.values.map(
                (v) => v.stringValue ?? v.intValue ?? v.doubleValue ?? v.boolValue ?? null,
            )
        }
    }
    return result
}

/**
 * Resolve a session ID from span + resource attribute bags.
 * Priority: OpenInference > LangSmith > Traceloop > Vercel AI SDK.
 * service.instance.id is a last-resort heuristic for daemons that never set
 * an explicit session.id — same physical process, same session.
 */
function extractSessionId(attrs, resourceAttrs) {
    return (
        attrs['session.id'] ||
        attrs['langsmith.trace.session_id'] ||
        attrs['traceloop.association.properties.session_id'] ||
        attrs['ai.telemetry.metadata.sessionId'] ||
        resourceAttrs['service.instance.id'] ||
        null
    )
}

/**
 * Resolve a conversation/thread ID. Conversation = one chat thread.
 * Distinct from session — a session can contain many conversations.
 * Priority: OTel official (Development) > Traceloop > Vercel AI SDK.
 * NB: LangSmith conflates conversation and session in `langsmith.trace.session_id`;
 *     we read it once into session_id and leave conversation_id null rather
 *     than duplicate.
 */
function extractConversationId(attrs) {
    return (
        attrs['gen_ai.conversation.id'] ||
        attrs['traceloop.association.properties.thread_id'] ||
        attrs['ai.telemetry.metadata.threadId'] ||
        null
    )
}

function extractAgentName(attrs) {
    return attrs['gen_ai.agent.name'] || attrs['gen_ai.agent.id'] || null
}

/**
 * Determine span type from OTEL attributes.
 * Precedence: gen_ai.operation.name (current spec) → traceloop.span.kind →
 * gen_ai.system/gen_ai.provider.name (legacy/v1.36.0) → llm.request.type →
 * db.system (vector DBs) → span-name heuristics.
 */
function determineSpanType(attrs) {
    // Highest priority: gen_ai.operation.name (current OTel spec)
    const operationName = attrs['gen_ai.operation.name']
    if (operationName && GENAI_OPERATION_TO_SPAN_TYPE[operationName]) {
        return GENAI_OPERATION_TO_SPAN_TYPE[operationName]
    }

    // Traceloop span kind (LangChain, etc.)
    const traceloopKind = attrs['traceloop.span.kind']
    if (traceloopKind && TRACELOOP_KIND_TO_SPAN_TYPE[traceloopKind]) {
        return TRACELOOP_KIND_TO_SPAN_TYPE[traceloopKind]
    }

    // gen_ai.provider.name (current spec) or gen_ai.system (deprecated)
    const provider = attrs['gen_ai.provider.name'] || attrs['gen_ai.system']
    if (provider) {
        return PROVIDER_TO_SPAN_TYPE[provider.toLowerCase()] || 'llm'
    }

    // Check for llm.request.type
    const llmRequestType = attrs['llm.request.type']
    if (llmRequestType) {
        return 'llm'
    }

    // Check for db.system (vector DBs)
    const dbSystem = attrs['db.system']
    if (dbSystem) {
        const vectorDbs = ['pinecone', 'chroma', 'weaviate', 'qdrant', 'milvus', 'pgvector']
        if (vectorDbs.some((v) => dbSystem.toLowerCase().includes(v))) {
            return 'retrieval'
        }
    }

    // Check span name patterns
    const spanName = attrs._spanName || ''
    if (spanName.includes('embed')) return 'embedding'
    if (spanName.includes('retriev') || spanName.includes('search')) return 'retrieval'
    if (spanName.includes('agent')) return 'agent'
    if (spanName.includes('tool') || spanName.includes('function')) return 'tool'
    if (spanName.includes('chain')) return 'chain'

    return 'custom'
}

/**
 * Extract model name from attributes
 */
function extractModel(attrs) {
    return (
        attrs['gen_ai.request.model'] ||
        attrs['gen_ai.response.model'] ||
        attrs['llm.model'] ||
        attrs['model'] ||
        null
    )
}

/**
 * Extract token usage from attributes.
 * Dual-reads current spec (input_tokens/output_tokens) and deprecated
 * (prompt_tokens/completion_tokens), with current names taking precedence.
 * Also surfaces newer fields — Anthropic prompt-cache tokens and o1-style
 * reasoning tokens — for callers that want to stash them in the attributes
 * blob (the DB schema only has prompt_tokens/completion_tokens columns).
 */
function extractTokens(attrs) {
    return {
        prompt:
            attrs['gen_ai.usage.input_tokens'] ??
            attrs['gen_ai.usage.prompt_tokens'] ??
            attrs['llm.usage.prompt_tokens'] ??
            attrs['llm.token_count.prompt'] ??
            0,
        completion:
            attrs['gen_ai.usage.output_tokens'] ??
            attrs['gen_ai.usage.completion_tokens'] ??
            attrs['llm.usage.completion_tokens'] ??
            attrs['llm.token_count.completion'] ??
            0,
        total:
            attrs['gen_ai.usage.total_tokens'] ??
            attrs['llm.usage.total_tokens'] ??
            attrs['llm.token_count.total'] ??
            0,
        cacheCreationInput: attrs['gen_ai.usage.cache_creation.input_tokens'] ?? null,
        cacheReadInput: attrs['gen_ai.usage.cache_read.input_tokens'] ?? null,
        reasoningOutput: attrs['gen_ai.usage.reasoning.output_tokens'] ?? null,
    }
}

/**
 * Parse an attribute value that may be a JSON-encoded string or already an
 * object/array (instrumentations vary).
 */
function parseMaybeJson(value) {
    if (value == null) return null
    if (typeof value !== 'string') return value
    try {
        return JSON.parse(value)
    } catch {
        return value
    }
}

/**
 * Extract input/output from attributes or events.
 * Precedence:
 *   1. gen_ai.input.messages / gen_ai.output.messages (current spec,
 *      structured array with role + parts)
 *   2. gen_ai.prompt / gen_ai.completion (deprecated v1.36.0 attributes)
 *   3. Span events: gen_ai.content.prompt / completion, or the newer
 *      gen_ai.client.inference.operation.details event carrying messages
 */
function extractIO(attrs, events) {
    let input = null
    let output = null

    // 1. Current spec — structured messages
    if (attrs['gen_ai.input.messages'] !== undefined) {
        input = { messages: parseMaybeJson(attrs['gen_ai.input.messages']) }
    }
    if (attrs['gen_ai.output.messages'] !== undefined) {
        output = { messages: parseMaybeJson(attrs['gen_ai.output.messages']) }
    }

    // Legacy gen_ai.prompt / gen_ai.completion (OpenLLMetry v1.36.0)
    if (input == null && attrs['gen_ai.prompt'] !== undefined) {
        const parsed = parseMaybeJson(attrs['gen_ai.prompt'])
        input = typeof parsed === 'object' && parsed !== null ? parsed : { prompt: parsed }
    }
    if (output == null && attrs['gen_ai.completion'] !== undefined) {
        const parsed = parseMaybeJson(attrs['gen_ai.completion'])
        output = typeof parsed === 'object' && parsed !== null ? parsed : { completion: parsed }
    }

    // Span events
    if (events && events.length > 0) {
        for (const event of events) {
            const eventAttrs = extractAttributes(event.attributes)
            const name = event.name || ''

            // Current spec: gen_ai.client.inference.operation.details carries
            // structured messages in its attributes
            if (name === 'gen_ai.client.inference.operation.details') {
                if (input == null && eventAttrs['gen_ai.input.messages'] !== undefined) {
                    input = { messages: parseMaybeJson(eventAttrs['gen_ai.input.messages']) }
                }
                if (output == null && eventAttrs['gen_ai.output.messages'] !== undefined) {
                    output = { messages: parseMaybeJson(eventAttrs['gen_ai.output.messages']) }
                }
                continue
            }

            // Legacy event names
            if (input == null && (name === 'gen_ai.content.prompt' || name.includes('prompt'))) {
                input = eventAttrs
            }
            if (
                output == null &&
                (name === 'gen_ai.content.completion' || name.includes('completion'))
            ) {
                output = eventAttrs
            }
        }
    }

    // Instructions supplement messages; they must not prevent message fallback.
    if (attrs['gen_ai.system_instructions'] !== undefined) {
        if (Array.isArray(input)) input = { messages: input }
        input = input || {}
        input.system_instructions = parseMaybeJson(attrs['gen_ai.system_instructions'])
    }

    return { input, output }
}

/**
 * Convert nanoseconds timestamp to milliseconds
 */
const { nanoToMs } = require('./timestamps')

/**
 * Transform a single OTLP span to LLMFlow format
 */
function transformSpan(span, resourceAttrs, scopeAttrs) {
    const attrs = {
        ...extractAttributes(span.attributes),
        _spanName: span.name,
    }

    const traceId = normalizeId(span.traceId)
    const spanId = normalizeId(span.spanId)
    const parentId = span.parentSpanId ? normalizeId(span.parentSpanId) : null

    const startTimeMs = nanoToMs(span.startTimeUnixNano)
    const endTimeMs = nanoToMs(span.endTimeUnixNano)
    const durationMs =
        startTimeMs !== null && endTimeMs !== null && endTimeMs >= startTimeMs
            ? endTimeMs - startTimeMs
            : null

    const spanType = determineSpanType(attrs)
    const model = extractModel(attrs)
    const tokens = extractTokens(attrs)
    const { input, output } = extractIO(attrs, span.events)

    // Calculate cost if we have model and tokens
    const estimatedCost =
        model && (tokens.prompt || tokens.completion)
            ? calculateCost(model, tokens.prompt, tokens.completion)
            : 0

    // Determine status
    let status = 200
    if (span.status) {
        // OTEL status: 0=UNSET, 1=OK, 2=ERROR
        if (span.status.code === 2) {
            status = 500
        }
    }

    // Extract provider. Prefer the current-spec key (gen_ai.provider.name)
    // over the deprecated gen_ai.system. Never fall back to service.name —
    // that identifies the calling application, not the LLM backend.
    const provider =
        attrs['gen_ai.provider.name'] || attrs['gen_ai.system'] || attrs['llm.vendor'] || null

    // Extract service name
    const serviceName = resourceAttrs['service.name'] || scopeAttrs?.name || 'otel'

    // New-spec fields that don't have dedicated DB columns get folded into the
    // attributes blob so they reach the dashboard's span detail view.
    // The generic attrs spread below already includes them via their canonical
    // keys; we additionally lift cache/reasoning tokens to short keys for
    // convenient display.
    const extraAttrs = {}
    if (tokens.cacheCreationInput != null) {
        extraAttrs.cache_creation_input_tokens = tokens.cacheCreationInput
    }
    if (tokens.cacheReadInput != null) {
        extraAttrs.cache_read_input_tokens = tokens.cacheReadInput
    }
    if (tokens.reasoningOutput != null) {
        extraAttrs.reasoning_output_tokens = tokens.reasoningOutput
    }

    return {
        id: spanId,
        timestamp: startTimeMs ?? endTimeMs ?? Date.now(),
        duration_ms: durationMs,
        provider,
        model,
        prompt_tokens: tokens.prompt,
        completion_tokens: tokens.completion,
        total_tokens: tokens.total || tokens.prompt + tokens.completion,
        estimated_cost: estimatedCost,
        status,
        error: span.status?.message || attrs['error.message'] || null,
        request_method: null,
        request_path: null,
        request_headers: {},
        request_body: {},
        response_status: status,
        response_headers: {},
        response_body: {},
        tags: [],
        trace_id: traceId,
        parent_id: parentId,
        session_id: extractSessionId(attrs, resourceAttrs),
        conversation_id: extractConversationId(attrs),
        agent_name: extractAgentName(attrs),
        span_type: spanType,
        span_name: span.name || attrs['traceloop.entity.name'] || spanType,
        input,
        output,
        attributes: {
            ...attrs,
            ...resourceAttrs,
            ...extraAttrs,
            otel_span_kind: span.kind,
        },
        service_name: serviceName,
    }
}

/**
 * Process OTLP/HTTP JSON traces request
 *
 * Expected format (OTLP/HTTP JSON):
 * {
 *   "resourceSpans": [
 *     {
 *       "resource": { "attributes": [...] },
 *       "scopeSpans": [
 *         {
 *           "scope": { "name": "...", "version": "..." },
 *           "spans": [
 *             {
 *               "traceId": "hex",
 *               "spanId": "hex",
 *               "parentSpanId": "hex",
 *               "name": "span name",
 *               "kind": 1,
 *               "startTimeUnixNano": "...",
 *               "endTimeUnixNano": "...",
 *               "attributes": [...],
 *               "events": [...],
 *               "status": { "code": 0 }
 *             }
 *           ]
 *         }
 *       ]
 *     }
 *   ]
 * }
 */
function processOtlpTraces(body) {
    const results = {
        accepted: 0,
        rejected: 0,
        errors: [],
    }

    if (!body || !body.resourceSpans) {
        return results
    }

    for (const resourceSpan of body.resourceSpans) {
        const resourceAttrs = extractAttributes(resourceSpan.resource?.attributes)

        for (const scopeSpan of resourceSpan.scopeSpans || []) {
            const scopeAttrs = scopeSpan.scope || {}

            for (const span of scopeSpan.spans || []) {
                try {
                    const llmflowSpan = transformSpan(span, resourceAttrs, scopeAttrs)
                    db.insertTrace(llmflowSpan)
                    results.accepted++
                } catch (err) {
                    results.rejected++
                    results.errors.push(err.message)
                }
            }
        }
    }

    return results
}

module.exports = {
    processOtlpTraces,
    transformSpan,
    extractAttributes,
    determineSpanType,
    extractModel,
    extractTokens,
}
