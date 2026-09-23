import { config } from '@llmflow/shared/config'
import { BaseProvider } from './base'

/** Ollama: a local LLM server with an OpenAI-compatible API over plain HTTP, no key. */
export class OllamaProvider extends BaseProvider {
    override name = 'ollama'
    override displayName = 'Ollama'
    override hostname = config.ollamaHost
    override port = config.ollamaPort
    override protocol = 'http' as const

    override transformRequestHeaders(
        _headers: Record<string, string | undefined>,
    ): Record<string, string | undefined> {
        return { 'Content-Type': 'application/json' }
    }
}
