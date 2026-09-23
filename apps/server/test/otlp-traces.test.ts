import { afterAll, describe, expect, test } from 'bun:test'
import {
    SpanKind,
    buildSpan,
    buildTracesPayload,
    genAiAgentAttributes,
    genAiChatAttributes,
    genAiChatAttributesLegacy,
    genAiEmbeddingsAttributes,
    genAiRetrievalAttributes,
    genAiToolAttributes,
    genAiWorkflowAttributes,
    postOtlp,
    spanId,
    traceId,
} from './helpers/otlp-builders'
import { startTestServer } from './helpers/test-server'

const server = await startTestServer({ prefix: 'llmflow-otlp-traces-' })
afterAll(() => server.stop())

async function api(path: string, body?: unknown) {
    const response = await fetch(server.url + path, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
    })
    const text = await response.text()
    let data: any = text
    try {
        data = JSON.parse(text)
    } catch {}
    return { status: response.status, data }
}

type RawSpan = {
    spanId: string
    parentSpanId?: string
    name: string
    startTime: number
    endTime: number
    attributes?: unknown[]
}

// Hand-written OpenLLMetry-style payload, independent of the shared builders.
function openLlmetryPayload(trace: string, spans: RawSpan[]) {
    return {
        resourceSpans: [
            {
                resource: {
                    attributes: [
                        { key: 'service.name', value: { stringValue: 'e2e-test-service' } },
                        { key: 'service.version', value: { stringValue: '1.0.0' } },
                    ],
                },
                scopeSpans: [
                    {
                        scope: { name: 'openllmetry', version: '1.0.0' },
                        spans: spans.map((span) => ({
                            traceId: trace,
                            spanId: span.spanId,
                            parentSpanId: span.parentSpanId || '',
                            name: span.name,
                            kind: 1,
                            startTimeUnixNano: String(span.startTime * 1000000),
                            endTimeUnixNano: String(span.endTime * 1000000),
                            attributes: span.attributes || [],
                            events: [],
                            status: { code: 0 },
                        })),
                    },
                ],
            },
        ],
    }
}

function llmAttributes(model: string, promptTokens: number, completionTokens: number) {
    return [
        { key: 'gen_ai.system', value: { stringValue: 'openai' } },
        { key: 'gen_ai.request.model', value: { stringValue: model } },
        { key: 'gen_ai.response.model', value: { stringValue: model } },
        { key: 'gen_ai.usage.prompt_tokens', value: { intValue: String(promptTokens) } },
        { key: 'gen_ai.usage.completion_tokens', value: { intValue: String(completionTokens) } },
        {
            key: 'gen_ai.usage.total_tokens',
            value: { intValue: String(promptTokens + completionTokens) },
        },
        { key: 'gen_ai.prompt', value: { stringValue: '[{"role":"user","content":"Hi"}]' } },
        { key: 'gen_ai.completion', value: { stringValue: '[{"role":"assistant"}]' } },
        { key: 'llm.request.type', value: { stringValue: 'chat' } },
    ]
}

const now = Date.now()
const simpleSpanId = spanId()
const llmSpanId = spanId()
const rootSpanId = spanId()
const retrievalSpanId = spanId()
const llmChildSpanId = spanId()

describe('OpenLLMetry-style ingestion', () => {
    test('health endpoint is ok', async () => {
        const health = await api('/api/health')
        expect(health.status).toBe(200)
        expect(health.data.status).toBe('ok')
    })

    test('a simple span is accepted and retrievable', async () => {
        const result = await api(
            '/v1/traces',
            openLlmetryPayload(traceId(), [
                {
                    spanId: simpleSpanId,
                    name: 'simple-test-span',
                    startTime: now,
                    endTime: now + 100,
                    attributes: [{ key: 'test.type', value: { stringValue: 'simple' } }],
                },
            ]),
        )
        expect(result.status).toBe(200)
        expect(result.data.partialSuccess).toBeFalsy()

        const stored = await api(`/api/spans/${simpleSpanId}`)
        expect(stored.status).toBe(200)
        expect(stored.data.trace?.id).toBe(simpleSpanId)
    })

    test('model and token usage are extracted from an LLM span', async () => {
        const result = await api(
            '/v1/traces',
            openLlmetryPayload(traceId(), [
                {
                    spanId: llmSpanId,
                    name: 'openai.chat',
                    startTime: now,
                    endTime: now + 500,
                    attributes: llmAttributes('gpt-4o-mini', 150, 50),
                },
            ]),
        )
        expect(result.status).toBe(200)

        const span = await api(`/api/spans/${llmSpanId}`)
        expect(span.status).toBe(200)
        expect(span.data.trace).toMatchObject({
            model: 'gpt-4o-mini',
            prompt_tokens: 150,
            completion_tokens: 50,
            total_tokens: 200,
        })
    })

    test('a RAG workflow forms a tree with detected span types', async () => {
        const result = await api(
            '/v1/traces',
            openLlmetryPayload(traceId(), [
                {
                    spanId: rootSpanId,
                    name: 'rag-query-workflow',
                    startTime: now,
                    endTime: now + 1000,
                    attributes: [
                        { key: 'traceloop.span.kind', value: { stringValue: 'workflow' } },
                        { key: 'traceloop.workflow.name', value: { stringValue: 'rag-query' } },
                        { key: 'traceloop.entity.name', value: { stringValue: 'RAGChain' } },
                    ],
                },
                {
                    spanId: retrievalSpanId,
                    parentSpanId: rootSpanId,
                    name: 'vector-search',
                    startTime: now + 50,
                    endTime: now + 200,
                    attributes: [
                        { key: 'db.system', value: { stringValue: 'pinecone' } },
                        { key: 'db.vector.query.top_k', value: { intValue: '5' } },
                        { key: 'db.operation', value: { stringValue: 'query' } },
                    ],
                },
                {
                    spanId: llmChildSpanId,
                    parentSpanId: rootSpanId,
                    name: 'generate-answer',
                    startTime: now + 200,
                    endTime: now + 900,
                    attributes: llmAttributes('gpt-4o', 500, 200),
                },
            ]),
        )
        expect(result.status).toBe(200)

        const tree = await api(`/api/spans/${rootSpanId}/tree`)
        expect(tree.status).toBe(200)
        expect(tree.data.trace?.span_count).toBe(3)
        const root = tree.data.spans?.find((span: any) => span.id === rootSpanId)
        expect(root?.children).toHaveLength(2)
        expect(root?.span_type).toBe('trace')
        const child = (id: string) => root?.children?.find((span: any) => span.id === id)
        expect(child(retrievalSpanId)?.span_type).toBe('retrieval')
        expect(child(llmChildSpanId)?.span_type).toBe('llm')
    })

    test('an empty payload is accepted', async () => {
        expect((await api('/v1/traces', {})).status).toBe(200)
    })

    test('ingested spans appear in the list and the model filter', async () => {
        const list = await api('/api/spans?limit=10')
        expect(list.status).toBe(200)
        expect(Array.isArray(list.data)).toBe(true)
        const ids = list.data.map((trace: any) => trace.id)
        expect(ids).toEqual(expect.arrayContaining([simpleSpanId, llmSpanId, rootSpanId]))

        const filtered = await api('/api/spans?model=gpt-4o-mini')
        expect(filtered.status).toBe(200)
        expect(filtered.data.map((trace: any) => trace.id)).toContain(llmSpanId)
    })
})

describe('GenAI semantic conventions', () => {
    test('current and deprecated attribute names produce equal rows', async () => {
        const current = spanId()
        const legacy = spanId()
        const start = Date.now()
        const result = await postOtlp(
            server.url,
            '/v1/traces',
            buildTracesPayload({
                spans: [
                    buildSpan({
                        traceId: traceId(),
                        spanId: current,
                        name: 'chat gpt-4o-mini',
                        kind: SpanKind.CLIENT,
                        startMs: start,
                        endMs: start + 100,
                        attributes: genAiChatAttributes({
                            provider: 'openai',
                            model: 'gpt-4o-mini',
                            inputTokens: 100,
                            outputTokens: 50,
                            finishReasons: ['stop'],
                        }),
                    }),
                    buildSpan({
                        traceId: traceId(),
                        spanId: legacy,
                        name: 'openai.chat',
                        kind: SpanKind.CLIENT,
                        startMs: start,
                        endMs: start + 100,
                        attributes: genAiChatAttributesLegacy({
                            provider: 'openai',
                            model: 'gpt-4o-mini',
                            inputTokens: 100,
                            outputTokens: 50,
                        }),
                    }),
                ],
            }),
        )
        expect(result.status).toBe(200)

        const pick = async (id: string) => {
            const { trace } = (await api(`/api/spans/${id}`)).data
            return {
                model: trace?.model,
                prompt_tokens: trace?.prompt_tokens,
                completion_tokens: trace?.completion_tokens,
                total_tokens: trace?.total_tokens,
            }
        }
        const currentRow = await pick(current)
        expect(currentRow).toEqual({
            model: 'gpt-4o-mini',
            prompt_tokens: 100,
            completion_tokens: 50,
            total_tokens: 150,
        })
        expect(await pick(legacy)).toEqual(currentRow)
    })

    test('cache and reasoning token counts reach the attributes blob', async () => {
        const id = spanId()
        const start = Date.now()
        await postOtlp(
            server.url,
            '/v1/traces',
            buildTracesPayload({
                spans: [
                    buildSpan({
                        traceId: traceId(),
                        spanId: id,
                        name: 'chat claude-3-5-sonnet',
                        kind: SpanKind.CLIENT,
                        startMs: start,
                        endMs: start + 200,
                        attributes: genAiChatAttributes({
                            provider: 'anthropic',
                            model: 'claude-3-5-sonnet',
                            inputTokens: 50,
                            outputTokens: 100,
                            cacheCreationInputTokens: 25,
                            cacheReadInputTokens: 200,
                            reasoningOutputTokens: 512,
                        }),
                    }),
                ],
            }),
        )

        const tree = await api(`/api/spans/${id}/tree`)
        const span = tree.data.spans?.find((row: any) => row.id === id)
        expect(span?.attributes).toMatchObject({
            cache_creation_input_tokens: 25,
            cache_read_input_tokens: 200,
            reasoning_output_tokens: 512,
        })
    })

    const operations = [
        {
            op: 'chat',
            expected: 'llm',
            attributes: genAiChatAttributes({
                provider: 'openai',
                model: 'gpt-4',
                inputTokens: 1,
                outputTokens: 1,
            }),
        },
        {
            op: 'embeddings',
            expected: 'embedding',
            attributes: genAiEmbeddingsAttributes({
                provider: 'openai',
                model: 'text-embedding-3-small',
                inputTokens: 1,
                dimensions: 1536,
            }),
        },
        {
            op: 'execute_tool',
            expected: 'tool',
            attributes: genAiToolAttributes({ name: 'web_search', callId: 'c1' }),
        },
        {
            op: 'invoke_agent',
            expected: 'agent',
            attributes: genAiAgentAttributes({ id: 'a1', name: 'researcher' }),
        },
        {
            op: 'invoke_workflow',
            expected: 'chain',
            attributes: genAiWorkflowAttributes({ name: 'rag-pipeline' }),
        },
        {
            op: 'retrieval',
            expected: 'retrieval',
            attributes: genAiRetrievalAttributes({ dataSourceId: 'pinecone-prod', topK: 5 }),
        },
    ].map((operation) => ({ ...operation, spanId: spanId() }))

    test('every gen_ai.operation.name maps to its span_type', async () => {
        const start = Date.now()
        await postOtlp(
            server.url,
            '/v1/traces',
            buildTracesPayload({
                spans: operations.map((operation) =>
                    buildSpan({
                        traceId: traceId(),
                        spanId: operation.spanId,
                        name: `${operation.op} test`,
                        kind: SpanKind.INTERNAL,
                        startMs: start,
                        endMs: start + 10,
                        attributes: operation.attributes,
                    }),
                ),
            }),
        )

        const actual: Record<string, string> = {}
        for (const operation of operations) {
            const tree = await api(`/api/spans/${operation.spanId}/tree`)
            const row = tree.data.spans?.find((span: any) => span.id === operation.spanId)
            actual[operation.op] = row?.span_type
        }
        expect(actual).toEqual(
            Object.fromEntries(operations.map((operation) => [operation.op, operation.expected])),
        )
    })
})
