import { test, expect } from 'bun:test'
import { StreamSession } from '../../../packages/providers/src/stream'

test('Cohere NDJSON fragments retain billed usage and length termination', () => {
    const stream = new StreamSession('cohere', 'fixture', 'fixture')
    const bytes = new TextEncoder().encode(
        [
            { type: 'content-delta', delta: { message: { content: [{ text: 'héllo' }] } } },
            {
                type: 'message-end',
                delta: {
                    finish_reason: 'MAX_TOKENS',
                    usage: { billed_units: { input_tokens: 10, output_tokens: 5 } },
                },
            },
        ]
            .map((event) => JSON.stringify(event))
            .join('\n') + '\n',
    )
    let output = ''
    for (const byte of bytes) output += stream.push(new Uint8Array([byte])).join('')
    expect(stream.content).toBe('héllo')
    expect(stream.usage).toMatchObject({
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15,
    })
    expect(output).toContain('"finish_reason":"length"')
    expect(output).toEndWith('data: [DONE]\n\n')
})
test('Gemini native pretty JSON arrays preserve capture without SSE', () => {
    const stream = new StreamSession('gemini', 'fixture', 'fixture')
    const bytes = new TextEncoder().encode(
        JSON.stringify(
            [
                { candidates: [{ content: { parts: [{ text: 'first' }] } }] },
                {
                    candidates: [
                        { content: { parts: [{ text: 'second' }] }, finishReason: 'STOP' },
                    ],
                    usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 },
                },
            ],
            null,
            2,
        ),
    )
    stream.push(bytes.slice(0, 20))
    stream.push(bytes.slice(20), true)
    expect(stream.content).toBe('firstsecond')
    expect(stream.usage.total_tokens).toBe(15)
})

test('Responses captures interleaved tool calls once, including final argument snapshots', () => {
    const stream = new StreamSession('openai', 'fixture', 'fixture')
    const first = {
        type: 'function_call',
        id: 'fc_1',
        call_id: 'call_1',
        name: 'read',
        arguments: '{"path":"héllo"}',
    }
    const second = {
        type: 'function_call',
        id: 'fc_2',
        call_id: 'call_2',
        name: 'list',
        arguments: '{}',
    }
    const events = [
        { type: 'response.output_item.added', output_index: 0, item: { ...first, arguments: '' } },
        { type: 'response.output_item.added', output_index: 1, item: { ...second, arguments: '' } },
        { type: 'response.function_call_arguments.delta', output_index: 0, delta: '{"path":' },
        { type: 'response.function_call_arguments.delta', output_index: 1, delta: '{}' },
        { type: 'response.function_call_arguments.delta', output_index: 0, delta: '"héllo"}' },
        {
            type: 'response.function_call_arguments.done',
            output_index: 0,
            arguments: first.arguments,
        },
        { type: 'response.output_item.done', output_index: 0, item: first },
        {
            type: 'response.completed',
            response: {
                model: 'actual-model',
                output: [first, second],
                usage: { input_tokens: 12, output_tokens: 8, total_tokens: 20 },
            },
        },
    ]
    const wire = events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('')
    let forwarded = ''
    for (const byte of new TextEncoder().encode(wire))
        forwarded += stream.push(new Uint8Array([byte])).join('')
    expect(forwarded).toBe(wire)
    expect(stream.response()).toMatchObject({
        model: 'actual-model',
        usage: { total_tokens: 20 },
        choices: [
            {
                finish_reason: 'tool_calls',
                message: {
                    tool_calls: [
                        { id: 'call_1', function: { name: 'read', arguments: first.arguments } },
                        { id: 'call_2', function: { name: 'list', arguments: '{}' } },
                    ],
                },
            },
        ],
    })
})

test('Responses completion-only tool capture stays bounded and terminal errors are recorded', () => {
    const stream = new StreamSession('openai', 'fixture', 'fixture')
    const send = (event: unknown) =>
        stream.push(new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`))
    send({
        type: 'response.completed',
        response: {
            output: [
                {
                    type: 'function_call',
                    call_id: 'call',
                    name: 'read',
                    arguments: 'x'.repeat(1024 * 1024 + 100),
                },
            ],
        },
    })
    expect(stream.tools.get(0)?.function.arguments.length).toBe(1024 * 1024)
    expect(stream.truncated).toBe(true)
    send({
        type: 'response.incomplete',
        response: { incomplete_details: { reason: 'max_output_tokens' } },
    })
    expect(stream.finishReason).toBe('length')
    send({ type: 'response.failed', response: { error: { message: 'Provider failed' } } })
    expect(stream.error).toBe('Provider failed')
    expect(stream.finishReason).toBeNull()
})

test('Cohere sends exactly one DONE even when its upstream also sends a terminator', () => {
    const stream = new StreamSession('cohere', 'fixture', 'fixture')
    const output = stream
        .push(
            new TextEncoder().encode(
                'data: {"type":"content-delta","delta":{"message":{"content":{"text":"ok"}}}}\n\n' +
                    'data: {"type":"message-end","delta":{"finish_reason":"COMPLETE"}}\n\n' +
                    'data: [DONE]\n\n',
            ),
            true,
        )
        .join('')
    expect(stream.content).toBe('ok')
    expect(output.match(/data: \[DONE\]/g)).toHaveLength(1)
    expect(output).toEndWith('data: [DONE]\n\n')
})
