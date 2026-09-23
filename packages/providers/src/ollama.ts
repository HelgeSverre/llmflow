import { BaseProvider, type ProviderRequest, type ProviderTarget } from './base'

/**
 * Ollama provider - local LLM server with OpenAI-compatible API.
 * Uses HTTP instead of HTTPS.
 */
export class OllamaProvider extends BaseProvider {
    hostname: string
    port: number

    constructor() {
        super()
        this.name = 'ollama'
        this.displayName = 'Ollama'
        this.hostname = process.env.OLLAMA_HOST || 'localhost'
        this.port = parseInt(process.env.OLLAMA_PORT || '', 10) || 11434
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
