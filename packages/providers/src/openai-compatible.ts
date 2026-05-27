import {
    BaseProvider,
    type ProviderRequest,
    type ProviderTarget,
} from './base'

export interface OpenAICompatibleConfig {
    name: string
    displayName?: string
    hostname: string
    port?: number
    basePath?: string
    extraHeaders?: Record<string, string>
}

/**
 * Generic OpenAI-compatible provider.
 * Used for Groq, Mistral, Together, etc.
 */
export class OpenAICompatibleProvider extends BaseProvider {
    hostname: string
    port: number
    basePath: string
    extraHeaders: Record<string, string>

    constructor(config: OpenAICompatibleConfig) {
        super()
        this.name = config.name
        this.displayName = config.displayName || config.name
        this.hostname = config.hostname
        this.port = config.port || 443
        this.basePath = config.basePath || ''
        this.extraHeaders = config.extraHeaders || {}
    }

    override getTarget(req: ProviderRequest): ProviderTarget {
        return {
            hostname: this.hostname,
            port: this.port,
            path: this.basePath + req.path,
            protocol: 'https',
        }
    }

    override transformRequestHeaders(
        headers: Record<string, string | undefined>,
        _req: ProviderRequest,
    ): Record<string, string | undefined> {
        return {
            'Content-Type': 'application/json',
            Authorization: headers.authorization,
            ...this.extraHeaders,
        }
    }
}

// Pre-configured providers
export const GroqProvider = new OpenAICompatibleProvider({
    name: 'groq',
    displayName: 'Groq',
    hostname: 'api.groq.com',
    basePath: '/openai',
})

export const MistralProvider = new OpenAICompatibleProvider({
    name: 'mistral',
    displayName: 'Mistral AI',
    hostname: 'api.mistral.ai',
})

export const TogetherProvider = new OpenAICompatibleProvider({
    name: 'together',
    displayName: 'Together AI',
    hostname: 'api.together.xyz',
})

export const PerplexityProvider = new OpenAICompatibleProvider({
    name: 'perplexity',
    displayName: 'Perplexity',
    hostname: 'api.perplexity.ai',
    basePath: '', // No /v1 prefix for perplexity
})

export const OpenRouterProvider = new OpenAICompatibleProvider({
    name: 'openrouter',
    displayName: 'OpenRouter',
    hostname: 'openrouter.ai',
    basePath: '/api',
})

export default OpenAICompatibleProvider
