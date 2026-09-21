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
