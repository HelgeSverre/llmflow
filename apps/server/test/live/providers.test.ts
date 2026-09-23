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

// Real, paid provider calls through the transforming proxy. Each provider runs
// only when its key is set (and PROVIDERS, if set, names it).
const server = await startTestServer({ proxy: true, prefix: 'llmflow-live-' })
afterAll(() => server.stop())

const proxy = (path: string) => server.proxyUrl + path
const prompt = [{ role: 'user', content: 'Say "test successful" in 3 words or less' }]
const content = (data: any) => data.choices?.[0]?.message?.content

// Ollama needs no key: it runs when the server answers and has the model pulled.
async function ollamaReady() {
    if (!enabled('ollama')) return false
    const host = process.env.OLLAMA_HOST || 'localhost'
    const port = process.env.OLLAMA_PORT || 11434
    try {
        const response = await fetch(`http://${host}:${port}/api/tags`, {
            signal: AbortSignal.timeout(2000),
        })
        const { models: installed = [] } = (await response.json()) as {
            models?: Array<{ name: string }>
        }
        return installed.some((model) => model.name === models.ollama)
    } catch {
        return false
    }
}

describe('OpenAI', () => {
    test.skipIf(!enabled('openai', 'OPENAI_API_KEY'))(
        'chat completions',
        async () => {
            const data = await post(
                proxy('/v1/chat/completions'),
                { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
                { model: models.openai, messages: prompt, max_tokens: 20 },
            )
            expect(content(data)).toBeTruthy()
            await expectTraceLogged(server.url, 'openai')
        },
        LIVE_TIMEOUT,
    )
})

describe('Anthropic', () => {
    const on = enabled('anthropic', 'ANTHROPIC_API_KEY')

    test.skipIf(!on)(
        'native messages via /anthropic',
        async () => {
            const data = await post(
                proxy('/anthropic/v1/messages'),
                {
                    'x-api-key': process.env.ANTHROPIC_API_KEY!,
                    'anthropic-version': '2023-06-01',
                },
                { model: models.anthropic, max_tokens: 20, messages: prompt },
            )
            expect(data.content?.[0]?.text || content(data)).toBeTruthy()
            await expectTraceLogged(server.url, 'anthropic')
        },
        LIVE_TIMEOUT,
    )

    test.skipIf(!on)(
        'OpenAI-format input is normalized to an OpenAI response',
        async () => {
            const data = await post(
                proxy('/anthropic/v1/chat/completions'),
                { Authorization: `Bearer ${process.env.ANTHROPIC_API_KEY}` },
                {
                    model: models.anthropic,
                    messages: [
                        { role: 'system', content: 'You are brief.' },
                        { role: 'user', content: 'Say hi' },
                    ],
                    max_tokens: 20,
                },
            )
            expect(content(data)).toBeTruthy()
        },
        LIVE_TIMEOUT,
    )
})

describe('Groq', () => {
    const on = enabled('groq', 'GROQ_API_KEY')
    const body = { model: models.groq, messages: prompt, max_tokens: 1024 }

    test.skipIf(!on)(
        'chat completions via /groq',
        async () => {
            const data = await post(
                proxy('/groq/v1/chat/completions'),
                { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
                body,
            )
            expect(content(data)).toBeTruthy()
            await expectTraceLogged(server.url, 'groq')
        },
        LIVE_TIMEOUT,
    )

    test.skipIf(!on)(
        'X-LLMFlow-Provider header routes the default path to Groq',
        async () => {
            const data = await post(
                proxy('/v1/chat/completions'),
                {
                    Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
                    'X-LLMFlow-Provider': 'groq',
                },
                body,
            )
            expect(content(data)).toBeTruthy()
        },
        LIVE_TIMEOUT,
    )
})

const openAiCompatible = [
    { provider: 'mistral', key: 'MISTRAL_API_KEY' },
    { provider: 'together', key: 'TOGETHER_API_KEY' },
    { provider: 'cohere', key: 'COHERE_API_KEY' },
] as const

for (const { provider, key } of openAiCompatible) {
    test.skipIf(!enabled(provider, key))(
        `${provider} chat completions via /${provider}`,
        async () => {
            const data = await post(
                proxy(`/${provider}/v1/chat/completions`),
                { Authorization: `Bearer ${process.env[key]}` },
                { model: models[provider], messages: prompt, max_tokens: 20 },
            )
            expect(content(data)).toBeTruthy()
            await expectTraceLogged(server.url, provider)
        },
        LIVE_TIMEOUT,
    )
}

test.skipIf(!(await ollamaReady()))(
    'Ollama (local) chat completions via /ollama',
    async () => {
        const data = await post(
            proxy('/ollama/v1/chat/completions'),
            {},
            {
                model: models.ollama,
                messages: [{ role: 'user', content: 'Say hi' }],
                max_tokens: 20,
            },
        )
        expect(content(data)).toBeTruthy()
        await expectTraceLogged(server.url, 'ollama')
    },
    LIVE_TIMEOUT,
)

test.skipIf(
    !enabled('azure', 'AZURE_OPENAI_API_KEY', 'AZURE_OPENAI_RESOURCE', 'AZURE_OPENAI_DEPLOYMENT'),
)(
    'Azure OpenAI chat completions via /azure',
    async () => {
        const data = await post(
            proxy('/azure/v1/chat/completions'),
            {
                Authorization: `Bearer ${process.env.AZURE_OPENAI_API_KEY}`,
                'x-azure-resource': process.env.AZURE_OPENAI_RESOURCE!,
            },
            { model: process.env.AZURE_OPENAI_DEPLOYMENT, messages: prompt, max_tokens: 20 },
        )
        expect(content(data)).toBeTruthy()
        await expectTraceLogged(server.url, 'azure')
    },
    LIVE_TIMEOUT,
)

describe('Google Gemini', () => {
    const on = enabled('gemini') && !!geminiKey

    test.skipIf(!on)(
        'native contents input',
        async () => {
            const data = await post(
                proxy('/gemini/v1/chat/completions'),
                { Authorization: `Bearer ${geminiKey}` },
                {
                    model: models.gemini,
                    contents: [{ role: 'user', parts: [{ text: 'Say "test ok" in 3 words' }] }],
                },
            )
            expect(content(data)).toBeTruthy()
            await expectTraceLogged(server.url, 'gemini')
        },
        LIVE_TIMEOUT,
    )

    test.skipIf(!on)(
        'OpenAI-format input is normalized to an OpenAI response',
        async () => {
            const data = await post(
                proxy('/gemini/v1/chat/completions'),
                { Authorization: `Bearer ${geminiKey}` },
                {
                    model: models.gemini,
                    messages: [
                        { role: 'system', content: 'Be brief.' },
                        { role: 'user', content: 'Say hi' },
                    ],
                    max_tokens: 20,
                },
            )
            expect(content(data)).toBeTruthy()
        },
        LIVE_TIMEOUT,
    )
})
