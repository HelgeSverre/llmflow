import { readSetting } from '@llmflow/shared/config'

// The environment variables that hold each provider's API key, in precedence order.
// The proxy forwards the client's own credentials; LLMFlow reads these only when it
// makes a request itself (replay).
export const PROVIDER_KEY_VARIABLES: Record<string, string[]> = {
    openai: ['OPENAI_API_KEY'],
    anthropic: ['ANTHROPIC_API_KEY'],
    gemini: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
    cohere: ['COHERE_API_KEY'],
    azure: ['AZURE_OPENAI_API_KEY'],
    groq: ['GROQ_API_KEY'],
    mistral: ['MISTRAL_API_KEY'],
    together: ['TOGETHER_API_KEY'],
    perplexity: ['PERPLEXITY_API_KEY'],
    openrouter: ['OPENROUTER_API_KEY'],
}

/** The first configured API key for `provider`, or undefined. */
export function providerApiKey(provider: string): string | undefined {
    return PROVIDER_KEY_VARIABLES[provider]?.map(readSetting).find(Boolean)
}
