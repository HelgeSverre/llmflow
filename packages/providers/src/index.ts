import { BaseProvider } from './base'
import { OpenAIProvider } from './openai'
import { OllamaProvider } from './ollama'
import { AnthropicProvider } from './anthropic'
import { GeminiProvider } from './gemini'
import { CohereProvider } from './cohere'
import { AzureOpenAIProvider } from './azure'
import {
    OpenAICompatibleProvider,
    GroqProvider,
    MistralProvider,
    TogetherProvider,
    PerplexityProvider,
    OpenRouterProvider,
} from './openai-compatible'
import type { ProviderListing } from './base'

interface ProxyLikeRequest {
    headers: Record<string, string | undefined>
    path: string
}

export interface ResolvedProvider {
    provider: BaseProvider
    cleanPath: string
}

/**
 * Provider Registry
 * Maps path prefixes to provider instances.
 */
export class ProviderRegistry {
    providers: Map<string, BaseProvider>
    defaultProvider: BaseProvider

    constructor() {
        this.providers = new Map()
        this.defaultProvider = new OpenAIProvider()

        // Path-based providers
        this.register('ollama', new OllamaProvider())
        this.register('anthropic', new AnthropicProvider())
        this.register('gemini', new GeminiProvider())
        this.register('cohere', new CohereProvider())
        this.register('azure', new AzureOpenAIProvider())
        this.register('groq', GroqProvider)
        this.register('mistral', MistralProvider)
        this.register('together', TogetherProvider)
        this.register('perplexity', PerplexityProvider)
        this.register('openrouter', OpenRouterProvider)
    }

    /** Register a provider with a path prefix */
    register(prefix: string, provider: BaseProvider): void {
        this.providers.set(prefix.toLowerCase(), provider)
    }

    /** Get a provider based on request path or header */
    resolve(req: ProxyLikeRequest): ResolvedProvider {
        const headerProvider = req.headers['x-llmflow-provider']
        if (headerProvider && this.providers.has(headerProvider.toLowerCase())) {
            return {
                provider: this.providers.get(headerProvider.toLowerCase()) as BaseProvider,
                cleanPath: req.path,
            }
        }

        // Path prefix: /ollama/v1/... -> ollama provider
        const pathMatch = req.path.match(/^\/([^/]+)(\/.*)?$/)
        if (pathMatch) {
            const prefix = pathMatch[1].toLowerCase()
            if (this.providers.has(prefix)) {
                const cleanPath = pathMatch[2] || '/'
                return {
                    provider: this.providers.get(prefix) as BaseProvider,
                    cleanPath,
                }
            }
        }

        return {
            provider: this.defaultProvider,
            cleanPath: req.path,
        }
    }

    /** List all registered providers */
    list(): ProviderListing[] {
        const result: ProviderListing[] = [
            {
                name: this.defaultProvider.name,
                displayName: this.defaultProvider.displayName,
                prefix: '/v1/*',
                default: true,
            },
        ]

        for (const [prefix, provider] of this.providers) {
            result.push({
                name: provider.name,
                displayName: provider.displayName,
                prefix: `/${prefix}/v1/*`,
                default: false,
            })
        }

        return result
    }
}

// Singleton instance
export const registry = new ProviderRegistry()

export {
    BaseProvider,
    OpenAIProvider,
    OllamaProvider,
    AnthropicProvider,
    GeminiProvider,
    CohereProvider,
    AzureOpenAIProvider,
    OpenAICompatibleProvider,
    GroqProvider,
    MistralProvider,
    TogetherProvider,
    PerplexityProvider,
    OpenRouterProvider,
}
