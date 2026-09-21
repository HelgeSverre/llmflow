const defaults = {
    openai: 'gpt-4o-mini',
    anthropic: 'claude-haiku-4-5',
    gemini: 'gemini-2.5-flash-lite',
    groq: 'openai/gpt-oss-20b',
    mistral: 'mistral-small-latest',
    cohere: 'command-r7b-12-2024',
    together: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    ollama: 'llama3.2:1b',
}

const models = Object.fromEntries(
    Object.entries(defaults).map(([provider, model]) => [
        provider,
        process.env[`LLMFLOW_TEST_${provider.toUpperCase()}_MODEL`] || model,
    ]),
)
const selected = process.env.PROVIDERS?.split(',').map((name) => name.trim().toLowerCase())
const shouldTest = (provider) => !selected || selected.includes(provider)

module.exports = { models, shouldTest }
