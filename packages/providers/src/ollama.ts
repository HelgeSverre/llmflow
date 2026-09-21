import { BaseProvider, type ProviderRequest, type ProviderTarget } from './base'

export interface OllamaProviderConfig {
    hostname?: string
    port?: number
}

/**
 * Ollama provider - local LLM server with OpenAI-compatible API.
 * Uses HTTP instead of HTTPS.
 */
export class OllamaProvider extends BaseProvider {
    hostname: string
    port: number

    constructor(config: OllamaProviderConfig = {}) {
        super()
        this.name = 'ollama'
        this.displayName = 'Ollama'
        this.hostname = config.hostname || process.env.OLLAMA_HOST || 'localhost'
        this.port = config.port || parseInt(process.env.OLLAMA_PORT || '', 10) || 11434
    }

    override getTarget(req: ProviderRequest): ProviderTarget {
        return {
            hostname: this.hostname,
            port: this.port,
            path: req.path,
            protocol: 'http',
        }
    }

    override transformRequestHeaders(
        _headers: Record<string, string | undefined>,
        _req: ProviderRequest,
    ): Record<string, string | undefined> {
        return {
            'Content-Type': 'application/json',
        }
    }
}

export default OllamaProvider
