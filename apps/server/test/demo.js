#!/usr/bin/env node

/**
 * LLMFlow OTel GenAI Stress-Test Demo
 *
 * Generates spec-compliant OTLP/HTTP JSON traffic that exercises the GenAI
 * semantic conventions ingest path (packages/otlp/src/traces.js). Posts to
 * /v1/traces, /v1/logs, and /v1/metrics — same endpoints a real OTel SDK or
 * Collector would use.
 *
 * Curated scenarios:
 *   1. chat-basic                    — single chat span, current spec
 *   2. chat-legacy-names             — same shape, deprecated v1.36.0 names
 *   3. embeddings                    — embedding model with dimension count
 *   4. rag-pipeline                  — workflow → retrieval + chat
 *   5. agent-with-tools              — agent → chat + execute_tool + chat
 *   6. anthropic-cache-and-reasoning — cache + reasoning token fields
 *   7. streaming-and-error           — streaming time-to-first-chunk + error
 *
 * Usage:
 *   bun run demo                              # all 7 scenarios, one pass
 *   bun run demo -- --count=10                # loop everything 10 times
 *   bun run demo -- --scenario=rag-pipeline   # one scenario only
 *   bun run demo -- --no-logs                 # skip log emission
 *   bun run demo -- --no-metrics              # skip metric emission
 */

const {
    traceId,
    spanId,
    SpanKind,
    buildSpan,
    buildTracesPayload,
    buildLogsPayload,
    buildMetricsPayload,
    buildHistogramMetric,
    genAiChatAttributes,
    genAiChatAttributesLegacy,
    genAiEmbeddingsAttributes,
    genAiToolAttributes,
    genAiAgentAttributes,
    genAiWorkflowAttributes,
    genAiRetrievalAttributes,
    postOtlp,
} = require('./lib/otlp-builders.js')

const LLMFLOW_URL = process.env.LLMFLOW_URL || 'http://localhost:3000'

const args = process.argv.slice(2)
const COUNT = parseInt(args.find((a) => a.startsWith('--count='))?.split('=')[1] || '1', 10)
const ONLY_SCENARIO = args.find((a) => a.startsWith('--scenario='))?.split('=')[1] || null
const SKIP_LOGS = args.includes('--no-logs')
const SKIP_METRICS = args.includes('--no-metrics')

const c = {
    reset: '\x1b[0m',
    dim: '\x1b[2m',
    bold: '\x1b[1m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m',
    blue: '\x1b[34m',
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const jitter = (base, spread = 0.4) =>
    Math.round(base * (1 - spread / 2 + Math.random() * spread))

// Run-level state: collected metrics data points emitted at the end.
const metricPoints = {
    operationDuration: [],
    tokenUsage: [],
    timeToFirstChunk: [],
}

// ────────────────────────────────────────────────────────────────────────────
// Scenario implementations
//
// Each scenario returns { spans, logs, label, operations } describing what
// was generated, so the orchestrator can roll up metrics and print a summary.
// ────────────────────────────────────────────────────────────────────────────

function scenarioChatBasic(now) {
    const tid = traceId()
    const sid = spanId()
    const duration = jitter(420)
    const inputTokens = 142
    const outputTokens = 256

    const attrs = genAiChatAttributes({
        provider: 'openai',
        model: 'gpt-4o-mini',
        responseModel: 'gpt-4o-mini-2024-07-18',
        responseId: `chatcmpl-${spanId()}`,
        inputTokens,
        outputTokens,
        finishReasons: ['stop'],
        serverAddress: 'api.openai.com',
        conversationId: `conv-${spanId().slice(0, 8)}`,
        requestParams: {
            temperature: 0.7,
            top_p: 1.0,
            max_tokens: 512,
            stream: false,
        },
        inputMessages: [
            {
                role: 'user',
                parts: [{ type: 'text', content: 'Explain OpenTelemetry in one sentence.' }],
            },
        ],
        outputMessages: [
            {
                role: 'assistant',
                parts: [
                    {
                        type: 'text',
                        content:
                            'OpenTelemetry is a vendor-neutral standard for collecting telemetry data (traces, metrics, logs) from applications.',
                    },
                ],
            },
        ],
    })

    return {
        label: 'chat-basic',
        operations: [{ op: 'chat', provider: 'openai', model: 'gpt-4o-mini-2024-07-18',
            inputTokens, outputTokens, durationMs: duration }],
        traceId: tid,
        spans: [
            buildSpan({
                traceId: tid,
                spanId: sid,
                name: 'chat gpt-4o-mini',
                kind: SpanKind.CLIENT,
                startMs: now,
                endMs: now + duration,
                attributes: attrs,
            }),
        ],
        logs: [
            {
                ms: now,
                body: 'gen_ai.client.inference.operation.details',
                traceId: tid,
                spanId: sid,
                attributes: {
                    'event.name': 'gen_ai.client.inference.operation.details',
                    'gen_ai.operation.name': 'chat',
                    'gen_ai.provider.name': 'openai',
                    'gen_ai.request.model': 'gpt-4o-mini',
                    'gen_ai.input.messages': attrs['gen_ai.input.messages'],
                    'gen_ai.output.messages': attrs['gen_ai.output.messages'],
                },
            },
        ],
    }
}

function scenarioChatLegacyNames(now) {
    const tid = traceId()
    const sid = spanId()
    const duration = jitter(340)
    const inputTokens = 78
    const outputTokens = 120

    const attrs = genAiChatAttributesLegacy({
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        inputTokens,
        outputTokens,
        prompt: [{ role: 'user', content: 'Summarize the OTel GenAI semconv migration.' }],
        completion: [
            {
                role: 'assistant',
                content:
                    'The spec renamed gen_ai.system→provider.name and prompt_tokens→input_tokens, and moved messages into structured events.',
            },
        ],
    })

    return {
        label: 'chat-legacy-names',
        operations: [{ op: 'chat', provider: 'openai', model: 'gpt-3.5-turbo',
            inputTokens, outputTokens, durationMs: duration }],
        traceId: tid,
        spans: [
            buildSpan({
                traceId: tid,
                spanId: sid,
                name: 'openai.chat',
                kind: SpanKind.CLIENT,
                startMs: now,
                endMs: now + duration,
                attributes: attrs,
                events: [
                    {
                        name: 'gen_ai.content.prompt',
                        ms: now,
                        attributes: { 'gen_ai.prompt': attrs['gen_ai.prompt'] },
                    },
                    {
                        name: 'gen_ai.content.completion',
                        ms: now + duration,
                        attributes: { 'gen_ai.completion': attrs['gen_ai.completion'] },
                    },
                ],
            }),
        ],
        logs: [],
    }
}

function scenarioEmbeddings(now) {
    const tid = traceId()
    const sid = spanId()
    const duration = jitter(80)
    const inputTokens = 512

    return {
        label: 'embeddings',
        operations: [{ op: 'embeddings', provider: 'openai', model: 'text-embedding-3-small',
            inputTokens, outputTokens: 0, durationMs: duration }],
        traceId: tid,
        spans: [
            buildSpan({
                traceId: tid,
                spanId: sid,
                name: 'embeddings text-embedding-3-small',
                kind: SpanKind.CLIENT,
                startMs: now,
                endMs: now + duration,
                attributes: genAiEmbeddingsAttributes({
                    provider: 'openai',
                    model: 'text-embedding-3-small',
                    inputTokens,
                    dimensions: 1536,
                    encodingFormats: ['float'],
                }),
            }),
        ],
        logs: [],
    }
}

function scenarioRagPipeline(now) {
    const tid = traceId()
    const workflowSpan = spanId()
    const retrievalSpan = spanId()
    const chatSpan = spanId()

    const conversationId = `conv-${spanId().slice(0, 8)}`
    const sessionId = `sess-${spanId().slice(0, 8)}`

    const retrievalDuration = jitter(85)
    const chatDuration = jitter(610)
    const totalDuration = retrievalDuration + chatDuration + 10

    const retrievedDocs = [
        { id: 'doc-1', score: 0.94, text: 'SSL/TLS can be configured by setting…' },
        { id: 'doc-2', score: 0.87, text: 'For production, use certificates from…' },
        { id: 'doc-3', score: 0.81, text: 'Common pitfalls include hostname mismatches…' },
    ]

    const chatStart = now + retrievalDuration + 5
    const inputTokens = 380
    const outputTokens = 312

    const inputMessages = [
        {
            role: 'system',
            parts: [
                {
                    type: 'text',
                    content: `Context:\n${retrievedDocs.map((d) => `- ${d.text}`).join('\n')}`,
                },
            ],
        },
        {
            role: 'user',
            parts: [{ type: 'text', content: 'How do I configure SSL for production?' }],
        },
    ]

    const outputMessages = [
        {
            role: 'assistant',
            parts: [
                {
                    type: 'text',
                    content:
                        'Use certificates from a trusted CA (Let\'s Encrypt for many cases), set TLS 1.3, and verify hostname matching.',
                },
            ],
        },
    ]

    return {
        label: 'rag-pipeline',
        operations: [
            {
                op: 'chat',
                provider: 'openai',
                model: 'gpt-4o',
                inputTokens,
                outputTokens,
                durationMs: chatDuration,
            },
        ],
        traceId: tid,
        spans: [
            buildSpan({
                traceId: tid,
                spanId: workflowSpan,
                name: 'invoke_workflow rag-pipeline',
                kind: SpanKind.INTERNAL,
                startMs: now,
                endMs: now + totalDuration,
                attributes: genAiWorkflowAttributes({
                    name: 'rag-pipeline',
                    conversationId,
                    sessionId,
                }),
            }),
            buildSpan({
                traceId: tid,
                spanId: retrievalSpan,
                parentSpanId: workflowSpan,
                name: 'retrieval pinecone-prod',
                kind: SpanKind.INTERNAL,
                startMs: now + 2,
                endMs: now + 2 + retrievalDuration,
                attributes: genAiRetrievalAttributes({
                    dataSourceId: 'pinecone-prod',
                    topK: 5,
                    queryText: 'How do I configure SSL for production?',
                    documents: retrievedDocs,
                    dbSystem: 'pinecone',
                }),
            }),
            buildSpan({
                traceId: tid,
                spanId: chatSpan,
                parentSpanId: workflowSpan,
                name: 'chat gpt-4o',
                kind: SpanKind.CLIENT,
                startMs: chatStart,
                endMs: chatStart + chatDuration,
                attributes: genAiChatAttributes({
                    provider: 'openai',
                    model: 'gpt-4o',
                    responseModel: 'gpt-4o-2024-08-06',
                    responseId: `chatcmpl-${spanId()}`,
                    inputTokens,
                    outputTokens,
                    finishReasons: ['stop'],
                    conversationId,
                    requestParams: { temperature: 0.3, max_tokens: 1024 },
                    inputMessages,
                    outputMessages,
                }),
            }),
        ],
        logs: [
            {
                ms: chatStart,
                body: 'gen_ai.client.inference.operation.details',
                traceId: tid,
                spanId: chatSpan,
                attributes: {
                    'event.name': 'gen_ai.client.inference.operation.details',
                    'gen_ai.operation.name': 'chat',
                    'gen_ai.provider.name': 'openai',
                    'gen_ai.input.messages': inputMessages,
                    'gen_ai.output.messages': outputMessages,
                    'gen_ai.conversation.id': conversationId,
                },
            },
        ],
    }
}

function scenarioAgentWithTools(now) {
    const tid = traceId()
    const agentSpan = spanId()
    const chatDecideSpan = spanId()
    const toolSpan = spanId()
    const chatFinalSpan = spanId()

    const conversationId = `conv-${spanId().slice(0, 8)}`
    const toolCallId = `call_${spanId().slice(0, 12)}`

    const decideDuration = jitter(540)
    const toolDuration = jitter(180)
    const finalDuration = jitter(620)
    const totalDuration = decideDuration + toolDuration + finalDuration + 20

    const toolDefinitions = [
        {
            type: 'function',
            name: 'web_search',
            description: 'Search the public web for recent results',
            parameters: {
                type: 'object',
                properties: { query: { type: 'string' } },
                required: ['query'],
            },
        },
    ]

    const userQuestion = 'What is the latest OpenTelemetry GenAI semconv status?'

    const decideMessages = {
        input: [{ role: 'user', parts: [{ type: 'text', content: userQuestion }] }],
        output: [
            {
                role: 'assistant',
                parts: [
                    {
                        type: 'tool_call',
                        id: toolCallId,
                        name: 'web_search',
                        arguments: { query: 'opentelemetry genai semconv status' },
                    },
                ],
            },
        ],
    }

    const toolResult = {
        results: [
            {
                title: 'GenAI Semantic Conventions | OpenTelemetry',
                snippet: 'Status: Development. Recent renames include gen_ai.system → gen_ai.provider.name…',
            },
        ],
    }

    const finalMessages = {
        input: [
            ...decideMessages.input,
            decideMessages.output[0],
            {
                role: 'tool',
                parts: [
                    {
                        type: 'tool_call_response',
                        id: toolCallId,
                        response: toolResult,
                    },
                ],
            },
        ],
        output: [
            {
                role: 'assistant',
                parts: [
                    {
                        type: 'text',
                        content:
                            'The GenAI semconv is in Development status; key renames include gen_ai.system → gen_ai.provider.name.',
                    },
                ],
            },
        ],
    }

    return {
        label: 'agent-with-tools',
        operations: [
            {
                op: 'chat',
                provider: 'anthropic',
                model: 'claude-3-5-sonnet-20241022',
                inputTokens: 220,
                outputTokens: 64,
                durationMs: decideDuration,
            },
            {
                op: 'chat',
                provider: 'anthropic',
                model: 'claude-3-5-sonnet-20241022',
                inputTokens: 380,
                outputTokens: 180,
                durationMs: finalDuration,
            },
        ],
        traceId: tid,
        spans: [
            buildSpan({
                traceId: tid,
                spanId: agentSpan,
                name: 'invoke_agent researcher',
                kind: SpanKind.INTERNAL,
                startMs: now,
                endMs: now + totalDuration,
                attributes: genAiAgentAttributes({
                    id: 'asst_researcher_v2',
                    name: 'researcher',
                    description: 'Answers questions by searching the web and synthesizing results',
                    version: '2.0.0',
                    conversationId,
                    toolDefinitions,
                }),
            }),
            buildSpan({
                traceId: tid,
                spanId: chatDecideSpan,
                parentSpanId: agentSpan,
                name: 'chat claude-3-5-sonnet',
                kind: SpanKind.CLIENT,
                startMs: now + 2,
                endMs: now + 2 + decideDuration,
                attributes: genAiChatAttributes({
                    provider: 'anthropic',
                    model: 'claude-3-5-sonnet-20241022',
                    responseId: `msg_${spanId()}`,
                    inputTokens: 220,
                    outputTokens: 64,
                    finishReasons: ['tool_use'],
                    conversationId,
                    requestParams: { temperature: 0.0, max_tokens: 1024 },
                    inputMessages: decideMessages.input,
                    outputMessages: decideMessages.output,
                }),
            }),
            buildSpan({
                traceId: tid,
                spanId: toolSpan,
                parentSpanId: agentSpan,
                name: 'execute_tool web_search',
                kind: SpanKind.INTERNAL,
                startMs: now + 2 + decideDuration + 5,
                endMs: now + 2 + decideDuration + 5 + toolDuration,
                attributes: genAiToolAttributes({
                    name: 'web_search',
                    type: 'function',
                    description: 'Search the public web for recent results',
                    callId: toolCallId,
                    callArguments: { query: 'opentelemetry genai semconv status' },
                    callResult: toolResult,
                }),
            }),
            buildSpan({
                traceId: tid,
                spanId: chatFinalSpan,
                parentSpanId: agentSpan,
                name: 'chat claude-3-5-sonnet',
                kind: SpanKind.CLIENT,
                startMs: now + 2 + decideDuration + toolDuration + 10,
                endMs: now + 2 + decideDuration + toolDuration + 10 + finalDuration,
                attributes: genAiChatAttributes({
                    provider: 'anthropic',
                    model: 'claude-3-5-sonnet-20241022',
                    responseId: `msg_${spanId()}`,
                    inputTokens: 380,
                    outputTokens: 180,
                    finishReasons: ['end_turn'],
                    conversationId,
                    requestParams: { temperature: 0.0, max_tokens: 1024 },
                    inputMessages: finalMessages.input,
                    outputMessages: finalMessages.output,
                }),
            }),
        ],
        logs: [
            {
                ms: now + 2,
                body: 'gen_ai.client.inference.operation.details',
                traceId: tid,
                spanId: chatDecideSpan,
                attributes: {
                    'event.name': 'gen_ai.client.inference.operation.details',
                    'gen_ai.operation.name': 'chat',
                    'gen_ai.provider.name': 'anthropic',
                    'gen_ai.input.messages': decideMessages.input,
                    'gen_ai.output.messages': decideMessages.output,
                    'gen_ai.tool.definitions': toolDefinitions,
                    'gen_ai.conversation.id': conversationId,
                },
            },
            {
                ms: now + 2 + decideDuration + toolDuration + 10,
                body: 'gen_ai.client.inference.operation.details',
                traceId: tid,
                spanId: chatFinalSpan,
                attributes: {
                    'event.name': 'gen_ai.client.inference.operation.details',
                    'gen_ai.operation.name': 'chat',
                    'gen_ai.provider.name': 'anthropic',
                    'gen_ai.input.messages': finalMessages.input,
                    'gen_ai.output.messages': finalMessages.output,
                    'gen_ai.conversation.id': conversationId,
                },
            },
        ],
    }
}

function scenarioAnthropicCacheAndReasoning(now) {
    const tid = traceId()
    const cacheSpan = spanId()
    const reasoningSpan = spanId()

    const cacheDuration = jitter(680)
    const reasoningDuration = jitter(4200)

    const cacheChatAttrs = genAiChatAttributes({
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        responseId: `msg_${spanId()}`,
        inputTokens: 18,
        outputTokens: 240,
        finishReasons: ['end_turn'],
        cacheCreationInputTokens: 1024,
        cacheReadInputTokens: 2048,
        requestParams: { temperature: 0.0, max_tokens: 1024 },
        inputMessages: [
            { role: 'user', parts: [{ type: 'text', content: 'Continue our previous discussion.' }] },
        ],
        outputMessages: [
            {
                role: 'assistant',
                parts: [
                    {
                        type: 'text',
                        content:
                            'Building on the cached context, the GenAI semconv migration affects ingest in three ways…',
                    },
                ],
            },
        ],
    })

    const reasoningChatAttrs = genAiChatAttributes({
        provider: 'openai',
        model: 'o1-preview',
        responseModel: 'o1-preview-2024-09-12',
        responseId: `chatcmpl-${spanId()}`,
        inputTokens: 96,
        outputTokens: 612,
        finishReasons: ['stop'],
        reasoningOutputTokens: 1840,
        requestParams: { max_tokens: 4096 },
        inputMessages: [
            {
                role: 'user',
                parts: [
                    {
                        type: 'text',
                        content:
                            'Prove that the sum of the first n odd numbers equals n squared.',
                    },
                ],
            },
        ],
        outputMessages: [
            {
                role: 'assistant',
                parts: [
                    {
                        type: 'text',
                        content:
                            'By induction: base case n=1 holds (1 = 1²). Inductive step: assume 1+3+…+(2k-1) = k². Then 1+3+…+(2k-1)+(2k+1) = k² + 2k + 1 = (k+1)². ∎',
                    },
                ],
            },
        ],
    })

    return {
        label: 'anthropic-cache-and-reasoning',
        operations: [
            {
                op: 'chat',
                provider: 'anthropic',
                model: 'claude-3-5-sonnet-20241022',
                inputTokens: 18,
                outputTokens: 240,
                durationMs: cacheDuration,
            },
            {
                op: 'chat',
                provider: 'openai',
                model: 'o1-preview-2024-09-12',
                inputTokens: 96,
                outputTokens: 612,
                durationMs: reasoningDuration,
            },
        ],
        traceId: tid,
        spans: [
            buildSpan({
                traceId: tid,
                spanId: cacheSpan,
                name: 'chat claude-3-5-sonnet',
                kind: SpanKind.CLIENT,
                startMs: now,
                endMs: now + cacheDuration,
                attributes: cacheChatAttrs,
            }),
            buildSpan({
                traceId: tid,
                spanId: reasoningSpan,
                name: 'chat o1-preview',
                kind: SpanKind.CLIENT,
                startMs: now + cacheDuration + 50,
                endMs: now + cacheDuration + 50 + reasoningDuration,
                attributes: reasoningChatAttrs,
            }),
        ],
        logs: [],
    }
}

function scenarioStreamingAndError(now) {
    const tid = traceId()
    const streamSpan = spanId()
    const errorSpan = spanId()

    const streamDuration = jitter(1850)
    const errorDuration = jitter(70)

    const streamAttrs = genAiChatAttributes({
        provider: 'openai',
        model: 'gpt-4o',
        responseModel: 'gpt-4o-2024-08-06',
        responseId: `chatcmpl-${spanId()}`,
        inputTokens: 64,
        outputTokens: 412,
        finishReasons: ['stop'],
        stream: true,
        timeToFirstChunk: 0.42,
        requestParams: { temperature: 0.8, stream: true },
        inputMessages: [
            {
                role: 'user',
                parts: [{ type: 'text', content: 'Write a haiku about distributed tracing.' }],
            },
        ],
        outputMessages: [
            {
                role: 'assistant',
                parts: [
                    {
                        type: 'text',
                        content: 'Spans branch through the dark,\nparent waits for children\'s end,\nthe trace breathes alive.',
                    },
                ],
            },
        ],
    })

    return {
        label: 'streaming-and-error',
        operations: [
            {
                op: 'chat',
                provider: 'openai',
                model: 'gpt-4o-2024-08-06',
                inputTokens: 64,
                outputTokens: 412,
                durationMs: streamDuration,
                timeToFirstChunk: 0.42,
            },
        ],
        traceId: tid,
        spans: [
            buildSpan({
                traceId: tid,
                spanId: streamSpan,
                name: 'chat gpt-4o',
                kind: SpanKind.CLIENT,
                startMs: now,
                endMs: now + streamDuration,
                attributes: streamAttrs,
            }),
            buildSpan({
                traceId: tid,
                spanId: errorSpan,
                name: 'chat gpt-4o',
                kind: SpanKind.CLIENT,
                startMs: now + streamDuration + 100,
                endMs: now + streamDuration + 100 + errorDuration,
                attributes: {
                    'gen_ai.operation.name': 'chat',
                    'gen_ai.provider.name': 'openai',
                    'gen_ai.request.model': 'gpt-4o',
                    'error.type': 'rate_limit_exceeded',
                },
                status: { code: 2, message: 'Rate limit exceeded; retry in 60s' },
                events: [
                    {
                        name: 'exception',
                        ms: now + streamDuration + 100 + errorDuration,
                        attributes: {
                            'exception.type': 'RateLimitError',
                            'exception.message': 'Rate limit exceeded; retry in 60s',
                        },
                    },
                ],
            }),
        ],
        logs: [],
    }
}

const SCENARIOS = {
    'chat-basic': scenarioChatBasic,
    'chat-legacy-names': scenarioChatLegacyNames,
    embeddings: scenarioEmbeddings,
    'rag-pipeline': scenarioRagPipeline,
    'agent-with-tools': scenarioAgentWithTools,
    'anthropic-cache-and-reasoning': scenarioAnthropicCacheAndReasoning,
    'streaming-and-error': scenarioStreamingAndError,
}

// ────────────────────────────────────────────────────────────────────────────
// Metric emission — one batch at the end of the run
// ────────────────────────────────────────────────────────────────────────────

// Spec-defined buckets for gen_ai.client.operation.duration (seconds)
const DURATION_BUCKETS = [
    0.01, 0.02, 0.04, 0.08, 0.16, 0.32, 0.64, 1.28, 2.56, 5.12, 10.24, 20.48, 40.96, 81.92,
]

// Spec-defined buckets for gen_ai.client.token.usage
const TOKEN_BUCKETS = [
    1, 4, 16, 64, 256, 1024, 4096, 16384, 65536, 262144, 1048576, 4194304, 16777216, 67108864,
]

// Spec-defined buckets for time_to_first_chunk
const TTFC_BUCKETS = DURATION_BUCKETS

/** Bucket a single observation into the explicit-bounds layout. */
function bucketize(value, bounds) {
    const counts = Array(bounds.length + 1).fill(0)
    let i = 0
    while (i < bounds.length && value > bounds[i]) i++
    counts[i] = 1
    return counts
}

function pointForObservation({ value, bounds, attributes, ms }) {
    return {
        startMs: ms,
        endMs: ms,
        attributes,
        count: 1,
        sum: value,
        bucketCounts: bucketize(value, bounds),
        bounds,
        min: value,
        max: value,
    }
}

function recordOperation(op, now) {
    const durationSeconds = op.durationMs / 1000
    metricPoints.operationDuration.push(
        pointForObservation({
            value: durationSeconds,
            bounds: DURATION_BUCKETS,
            attributes: {
                'gen_ai.operation.name': op.op,
                'gen_ai.provider.name': op.provider,
                'gen_ai.response.model': op.model,
            },
            ms: now,
        }),
    )
    if (op.inputTokens > 0) {
        metricPoints.tokenUsage.push(
            pointForObservation({
                value: op.inputTokens,
                bounds: TOKEN_BUCKETS,
                attributes: {
                    'gen_ai.operation.name': op.op,
                    'gen_ai.provider.name': op.provider,
                    'gen_ai.response.model': op.model,
                    'gen_ai.token.type': 'input',
                },
                ms: now,
            }),
        )
    }
    if (op.outputTokens > 0) {
        metricPoints.tokenUsage.push(
            pointForObservation({
                value: op.outputTokens,
                bounds: TOKEN_BUCKETS,
                attributes: {
                    'gen_ai.operation.name': op.op,
                    'gen_ai.provider.name': op.provider,
                    'gen_ai.response.model': op.model,
                    'gen_ai.token.type': 'output',
                },
                ms: now,
            }),
        )
    }
    if (op.timeToFirstChunk !== undefined) {
        metricPoints.timeToFirstChunk.push(
            pointForObservation({
                value: op.timeToFirstChunk,
                bounds: TTFC_BUCKETS,
                attributes: {
                    'gen_ai.operation.name': op.op,
                    'gen_ai.provider.name': op.provider,
                    'gen_ai.response.model': op.model,
                },
                ms: now,
            }),
        )
    }
}

async function emitMetrics() {
    const metrics = []
    if (metricPoints.operationDuration.length > 0) {
        metrics.push(
            buildHistogramMetric({
                name: 'gen_ai.client.operation.duration',
                unit: 's',
                description: 'GenAI operation duration',
                dataPoints: metricPoints.operationDuration,
            }),
        )
    }
    if (metricPoints.tokenUsage.length > 0) {
        metrics.push(
            buildHistogramMetric({
                name: 'gen_ai.client.token.usage',
                unit: '{token}',
                description: 'GenAI token usage',
                dataPoints: metricPoints.tokenUsage,
            }),
        )
    }
    if (metricPoints.timeToFirstChunk.length > 0) {
        metrics.push(
            buildHistogramMetric({
                name: 'gen_ai.client.operation.time_to_first_chunk',
                unit: 's',
                description: 'Time to first streaming chunk',
                dataPoints: metricPoints.timeToFirstChunk,
            }),
        )
    }
    if (metrics.length === 0) return
    const payload = buildMetricsPayload({ metrics })
    await postOtlp(LLMFLOW_URL, '/v1/metrics', payload)
}

// ────────────────────────────────────────────────────────────────────────────
// Orchestration
// ────────────────────────────────────────────────────────────────────────────

async function runScenario(fn) {
    const now = Date.now()
    const result = fn(now)
    const tracesPayload = buildTracesPayload({ spans: result.spans })
    await postOtlp(LLMFLOW_URL, '/v1/traces', tracesPayload)

    if (!SKIP_LOGS && result.logs && result.logs.length > 0) {
        const logsPayload = buildLogsPayload({ logRecords: result.logs })
        await postOtlp(LLMFLOW_URL, '/v1/logs', logsPayload)
    }

    for (const op of result.operations) recordOperation(op, now)

    const spanCount = result.spans.length
    const logCount = SKIP_LOGS ? 0 : result.logs.length
    console.log(
        `  ${c.green}✓${c.reset} ${c.bold}${result.label.padEnd(34)}${c.reset} ` +
            `${c.dim}${spanCount} spans, ${logCount} logs${c.reset} ` +
            `${c.dim}trace=${result.traceId.slice(0, 8)}…${c.reset}`,
    )
}

async function run() {
    console.log(
        `${c.cyan}LLMFlow OTel GenAI stress demo${c.reset} ${c.dim}→ ${LLMFLOW_URL}${c.reset}`,
    )
    console.log(
        `${c.dim}Iterations: ${COUNT}` +
            (ONLY_SCENARIO ? `, only: ${ONLY_SCENARIO}` : '') +
            (SKIP_LOGS ? ', no-logs' : '') +
            (SKIP_METRICS ? ', no-metrics' : '') +
            `${c.reset}\n`,
    )

    const scenarios = ONLY_SCENARIO
        ? { [ONLY_SCENARIO]: SCENARIOS[ONLY_SCENARIO] }
        : SCENARIOS

    if (ONLY_SCENARIO && !SCENARIOS[ONLY_SCENARIO]) {
        console.error(`${c.red}Unknown scenario: ${ONLY_SCENARIO}${c.reset}`)
        console.error(`Available: ${Object.keys(SCENARIOS).join(', ')}`)
        process.exit(1)
    }

    const t0 = Date.now()
    let totalScenarios = 0

    for (let i = 0; i < COUNT; i++) {
        if (COUNT > 1) console.log(`${c.dim}--- pass ${i + 1}/${COUNT} ---${c.reset}`)
        for (const [scenarioName, fn] of Object.entries(scenarios)) {
            try {
                await runScenario(fn)
                totalScenarios++
            } catch (err) {
                console.log(
                    `  ${c.red}✗${c.reset} ${scenarioName.padEnd(34)} ${c.red}${err.message}${c.reset}`,
                )
            }
            await sleep(jitter(120, 0.6))
        }
    }

    if (!SKIP_METRICS) {
        try {
            await emitMetrics()
            console.log(`\n${c.dim}metrics: ${metricPoints.operationDuration.length} ops, ` +
                `${metricPoints.tokenUsage.length} token points, ` +
                `${metricPoints.timeToFirstChunk.length} ttfc points${c.reset}`)
        } catch (err) {
            console.log(`${c.red}metrics emit failed: ${err.message}${c.reset}`)
        }
    }

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
    console.log(
        `\n${c.cyan}Done${c.reset} ${c.dim}${totalScenarios} scenarios in ${elapsed}s${c.reset}`,
    )
    console.log(`${c.dim}Dashboard: ${LLMFLOW_URL}${c.reset}`)
}

run().catch((err) => {
    console.error(`${c.red}Fatal: ${err.message}${c.reset}`)
    process.exit(1)
})
