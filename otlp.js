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

const db = require('./db');
const { calculateCost } = require('./pricing');

/**
 * Map gen_ai.system values to span types
 */
const PROVIDER_TO_SPAN_TYPE = {
    'openai': 'llm',
    'anthropic': 'llm',
    'cohere': 'llm',
    'bedrock': 'llm',
    'azure': 'llm',
    'google': 'llm',
    'ollama': 'llm',
    'groq': 'llm',
    'together': 'llm',
    'mistral': 'llm',
    'replicate': 'llm',
};

/**
 * Map traceloop.span.kind to LLMFlow span types
 */
const TRACELOOP_KIND_TO_SPAN_TYPE = {
    'workflow': 'trace',
    'task': 'chain',
    'agent': 'agent',
    'tool': 'tool',
};

/**
 * Convert hex string to standard UUID format if needed
 */
function normalizeId(hexId) {
    if (!hexId) return null;
    // Remove any existing dashes and lowercase
    const clean = hexId.replace(/-/g, '').toLowerCase();
    // If it's already short enough, return as-is
    if (clean.length <= 32) return clean;
    return clean;
}

/**
 * Extract attributes from OTLP KeyValue array format
 * OTLP attributes are: [{ key: "foo", value: { stringValue: "bar" } }, ...]
 */
function extractAttributes(attrs) {
    if (!attrs || !Array.isArray(attrs)) return {};
    
    const result = {};
    for (const attr of attrs) {
        const key = attr.key;
        const val = attr.value;
        if (!val) continue;
        
        // OTLP value types: stringValue, intValue, doubleValue, boolValue, arrayValue, kvlistValue
        if (val.stringValue !== undefined) result[key] = val.stringValue;
        else if (val.intValue !== undefined) result[key] = parseInt(val.intValue, 10);
        else if (val.doubleValue !== undefined) result[key] = val.doubleValue;
        else if (val.boolValue !== undefined) result[key] = val.boolValue;
        else if (val.arrayValue?.values) {
            result[key] = val.arrayValue.values.map(v => 
                v.stringValue ?? v.intValue ?? v.doubleValue ?? v.boolValue ?? null
            );
        }
    }
    return result;
}

/**
 * Determine span type from OTEL attributes
 */
function determineSpanType(attrs) {
    // Check for traceloop span kind first (LangChain, etc.)
    const traceloopKind = attrs['traceloop.span.kind'];
    if (traceloopKind && TRACELOOP_KIND_TO_SPAN_TYPE[traceloopKind]) {
        return TRACELOOP_KIND_TO_SPAN_TYPE[traceloopKind];
    }
    
    // Check for gen_ai.system (OpenLLMetry)
    const genAiSystem = attrs['gen_ai.system'];
    if (genAiSystem) {
        return PROVIDER_TO_SPAN_TYPE[genAiSystem.toLowerCase()] || 'llm';
    }
    
    // Check for llm.request.type
    const llmRequestType = attrs['llm.request.type'];
    if (llmRequestType) {
        return 'llm';
    }
    
    // Check for db.system (vector DBs)
    const dbSystem = attrs['db.system'];
    if (dbSystem) {
        const vectorDbs = ['pinecone', 'chroma', 'weaviate', 'qdrant', 'milvus', 'pgvector'];
        if (vectorDbs.some(v => dbSystem.toLowerCase().includes(v))) {
            return 'retrieval';
        }
    }
    
    // Check span name patterns
    const spanName = attrs._spanName || '';
    if (spanName.includes('embed')) return 'embedding';
    if (spanName.includes('retriev') || spanName.includes('search')) return 'retrieval';
    if (spanName.includes('agent')) return 'agent';
    if (spanName.includes('tool') || spanName.includes('function')) return 'tool';
    if (spanName.includes('chain')) return 'chain';
    
    return 'custom';
}

/**
 * Extract model name from attributes
 */
function extractModel(attrs) {
    return attrs['gen_ai.request.model'] 
        || attrs['gen_ai.response.model']
        || attrs['llm.model']
        || attrs['model']
        || null;
}

/**
 * Extract token usage from attributes
 */
function extractTokens(attrs) {
    return {
        prompt: attrs['gen_ai.usage.prompt_tokens'] 
            || attrs['llm.usage.prompt_tokens']
            || attrs['llm.token_count.prompt']
            || 0,
        completion: attrs['gen_ai.usage.completion_tokens'] 
            || attrs['llm.usage.completion_tokens']
            || attrs['llm.token_count.completion']
            || 0,
        total: attrs['gen_ai.usage.total_tokens']
            || attrs['llm.usage.total_tokens']
            || attrs['llm.token_count.total']
            || 0
    };
}

/**
 * Extract input/output from attributes or events
 */
function extractIO(attrs, events) {
    let input = null;
    let output = null;
    
    // Try gen_ai.prompt / gen_ai.completion (OpenLLMetry)
    if (attrs['gen_ai.prompt']) {
        try {
            input = typeof attrs['gen_ai.prompt'] === 'string' 
                ? JSON.parse(attrs['gen_ai.prompt']) 
                : attrs['gen_ai.prompt'];
        } catch {
            input = { prompt: attrs['gen_ai.prompt'] };
        }
    }
    
    if (attrs['gen_ai.completion']) {
        try {
            output = typeof attrs['gen_ai.completion'] === 'string' 
                ? JSON.parse(attrs['gen_ai.completion']) 
                : attrs['gen_ai.completion'];
        } catch {
            output = { completion: attrs['gen_ai.completion'] };
        }
    }
    
    // Check events for prompt/completion data
    if (events && events.length > 0) {
        for (const event of events) {
            const eventAttrs = extractAttributes(event.attributes);
            if (event.name === 'gen_ai.content.prompt' || event.name?.includes('prompt')) {
                input = eventAttrs;
            }
            if (event.name === 'gen_ai.content.completion' || event.name?.includes('completion')) {
                output = eventAttrs;
            }
        }
    }
    
    return { input, output };
}

/**
 * Convert nanoseconds timestamp to milliseconds
 */
function nanoToMs(nanoStr) {
    if (!nanoStr) return Date.now();
    const nano = BigInt(nanoStr);
    return Number(nano / BigInt(1000000));
}

/**
 * Transform a single OTLP span to LLMFlow format
 */
function transformSpan(span, resourceAttrs, scopeAttrs) {
    const attrs = {
        ...extractAttributes(span.attributes),
        _spanName: span.name,
    };
    
    const traceId = normalizeId(span.traceId);
    const spanId = normalizeId(span.spanId);
    const parentId = span.parentSpanId ? normalizeId(span.parentSpanId) : null;
    
    const startTimeMs = nanoToMs(span.startTimeUnixNano);
    const endTimeMs = nanoToMs(span.endTimeUnixNano);
    const durationMs = endTimeMs - startTimeMs;
    
    const spanType = determineSpanType(attrs);
    const model = extractModel(attrs);
    const tokens = extractTokens(attrs);
    const { input, output } = extractIO(attrs, span.events);
    
    // Calculate cost if we have model and tokens
    const estimatedCost = model && (tokens.prompt || tokens.completion)
        ? calculateCost(model, tokens.prompt, tokens.completion)
        : 0;
    
    // Determine status
    let status = 200;
    if (span.status) {
        // OTEL status: 0=UNSET, 1=OK, 2=ERROR
        if (span.status.code === 2) {
            status = 500;
        }
    }
    
    // Extract provider
    const provider = attrs['gen_ai.system'] 
        || attrs['gen_ai.provider.name']
        || attrs['llm.vendor']
        || resourceAttrs['service.name']
        || null;
    
    // Extract service name
    const serviceName = resourceAttrs['service.name'] 
        || scopeAttrs?.name
        || 'otel';
    
    return {
        id: spanId,
        timestamp: startTimeMs,
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
        span_type: spanType,
        span_name: span.name || attrs['traceloop.entity.name'] || spanType,
        input,
        output,
        attributes: {
            ...attrs,
            ...resourceAttrs,
            otel_span_kind: span.kind,
        },
        service_name: serviceName
    };
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
        errors: []
    };
    
    if (!body || !body.resourceSpans) {
        return results;
    }
    
    for (const resourceSpan of body.resourceSpans) {
        const resourceAttrs = extractAttributes(resourceSpan.resource?.attributes);
        
        for (const scopeSpan of (resourceSpan.scopeSpans || [])) {
            const scopeAttrs = scopeSpan.scope || {};
            
            for (const span of (scopeSpan.spans || [])) {
                try {
                    const llmflowSpan = transformSpan(span, resourceAttrs, scopeAttrs);
                    db.insertTrace(llmflowSpan);
                    results.accepted++;
                } catch (err) {
                    results.rejected++;
                    results.errors.push(err.message);
                }
            }
        }
    }
    
    return results;
}

/**
 * Express middleware for OTLP endpoint
 */
function createOtlpHandler() {
    return (req, res) => {
        const contentType = req.headers['content-type'] || '';
        
        // Only support JSON for now
        if (!contentType.includes('application/json')) {
            return res.status(415).json({
                error: 'Unsupported Media Type',
                message: 'Only application/json is supported. Use OTLP/HTTP JSON format.'
            });
        }
        
        try {
            const results = processOtlpTraces(req.body);
            
            // OTLP response format
            res.status(200).json({
                partialSuccess: results.rejected > 0 ? {
                    rejectedSpans: results.rejected,
                    errorMessage: results.errors.slice(0, 5).join('; ')
                } : undefined
            });
        } catch (err) {
            res.status(500).json({
                error: 'Internal Server Error',
                message: err.message
            });
        }
    };
}

module.exports = {
    processOtlpTraces,
    createOtlpHandler,
    transformSpan,
    extractAttributes,
    determineSpanType,
    extractModel,
    extractTokens
};
