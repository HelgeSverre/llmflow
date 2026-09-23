import { afterAll, describe, expect, test } from 'bun:test'
import {
    LIVE_TIMEOUT,
    enabled,
    expectTraceLogged,
    geminiKey,
    models,
    post,
} from '../helpers/live-providers'
import { startTestServer } from '../helpers/test-server'

// Real, paid provider calls through /passthrough/*, which forwards the native
// request and returns the native response. Each provider runs only when its
// key is set (and PROVIDERS, if set, names it).
const server = await startTestServer({ proxy: true, prefix: 'llmflow-live-passthrough-' })
afterAll(() => server.stop())

const proxy = (path: string) => server.proxyUrl + path

describe('Anthropic passthrough', () => {
    const on = enabled('anthropic', 'ANTHROPIC_API_KEY')
    const headers = () => ({
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
    })

    test.skipIf(!on)(
        'returns the native messages format',
        async () => {
            const data = await post(proxy('/passthrough/anthropic/v1/messages'), headers(), {
                model: models.anthropic,
                max_tokens: 50,
                messages: [
                    {
                        role: 'user',
                        content: 'Say "passthrough test successful" in exactly 3 words',
                    },
                ],
            })
            expect(Array.isArray(data.content)).toBe(true)
            expect(data.content[0].type).toBe('text')
            expect(data.usage?.input_tokens).toBeGreaterThan(0)
            await expectTraceLogged(server.url, 'anthropic')
        },
        LIVE_TIMEOUT,
    )

    test.skipIf(!on)(
        'accepts a top-level system prompt',
        async () => {
            const data = await post(proxy('/passthrough/anthropic/v1/messages'), headers(), {
                model: models.anthropic,
                max_tokens: 50,
                system: 'You always respond with exactly 3 words.',
                messages: [{ role: 'user', content: 'Say hello' }],
            })
            expect(data.content?.[0]?.text).toBeTruthy()
        },
        LIVE_TIMEOUT,
    )

    test.skipIf(!on)(
        'accepts Bearer authorization',
        async () => {
            const data = await post(
                proxy('/passthrough/anthropic/v1/messages'),
                {
                    Authorization: `Bearer ${process.env.ANTHROPIC_API_KEY}`,
                    'anthropic-version': '2023-06-01',
                },
                {
                    model: models.anthropic,
                    max_tokens: 20,
                    messages: [{ role: 'user', content: 'Hi' }],
                },
            )
            expect(data.content).toBeDefined()
        },
        LIVE_TIMEOUT,
    )

    test.skipIf(!on)(
        'passthrough keeps the native shape where the transform path returns OpenAI format',
        async () => {
            const body = {
                model: models.anthropic,
                max_tokens: 20,
                messages: [{ role: 'user', content: 'Hi' }],
            }
            const [native, transformed] = await Promise.all([
                post(proxy('/passthrough/anthropic/v1/messages'), headers(), body),
                post(proxy('/anthropic/v1/messages'), headers(), body),
            ])
            expect(Array.isArray(native.content)).toBe(true)
            expect(Array.isArray(transformed.choices)).toBe(true)
        },
        LIVE_TIMEOUT,
    )
})

test.skipIf(!(enabled('gemini') && !!geminiKey))(
    'Gemini passthrough returns the native generateContent format',
    async () => {
        const data = await post(
            proxy(
                `/passthrough/gemini/v1beta/models/${encodeURIComponent(models.gemini)}:generateContent`,
            ),
            { 'x-goog-api-key': geminiKey },
            {
                contents: [
                    {
                        role: 'user',
                        parts: [{ text: 'Say "passthrough test ok" in exactly 3 words' }],
                    },
                ],
                generationConfig: { maxOutputTokens: 50 },
            },
        )
        expect(data.candidates?.[0]?.content?.parts).toBeDefined()
        expect(data.usageMetadata?.promptTokenCount).toBeGreaterThan(0)
        await expectTraceLogged(server.url, 'gemini')
    },
    LIVE_TIMEOUT,
)

test.skipIf(!enabled('openai', 'OPENAI_API_KEY'))(
    'OpenAI passthrough returns a chat completion',
    async () => {
        const data = await post(
            proxy('/passthrough/openai/v1/chat/completions'),
            { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
            {
                model: models.openai,
                max_tokens: 20,
                messages: [{ role: 'user', content: 'Say "passthrough ok"' }],
            },
        )
        expect(data.choices?.[0]?.message?.content).toBeTruthy()
        await expectTraceLogged(server.url, 'openai')
    },
    LIVE_TIMEOUT,
)
