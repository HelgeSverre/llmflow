import {
    BaseProvider,
    type NormalizedResponse,
    type ProviderRequest,
    type ProviderTarget,
    type TokenUsage,
    type UsageLike,
} from './base'

export interface OpenAIProviderConfig {
    hostname?: string
    port?: number
    basePath?: string
}

interface OpenAIResponsesUsage extends UsageLike {
    input_tokens?: number
    output_tokens?: number
}

/**
 * OpenAI provider - the reference implementation.
 * Supports both Chat Completions (/v1/chat/completions) and Responses (/v1/responses) APIs.
 */
export class OpenAIProvider extends BaseProvider {
    hostname: string
    port: number
    basePath: string

    constructor(config: OpenAIProviderConfig = {}) {
        super()
        this.name = 'openai'
        this.displayName = 'OpenAI'
        this.hostname = config.hostname || 'api.openai.com'
        this.port = config.port || 443
        this.basePath = config.basePath || ''
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
        }
    }

    /** Check if this is a Responses API request */
    isResponsesAPI(req: ProviderRequest): boolean {
        return req.path.includes('/responses')
    }

    /** Normalize response - handles both Chat Completions and Responses API formats */
    override normalizeResponse(body: unknown, req: ProviderRequest): NormalizedResponse {
        if (this.isResponsesAPI(req)) {
            return this.normalizeResponsesAPIResponse(body, req)
        }
        return super.normalizeResponse(body, req)
    }

    /** Normalize Responses API response to common format for logging */
    normalizeResponsesAPIResponse(body: unknown, req: ProviderRequest): NormalizedResponse {
        const reqBody = (req.body || {}) as Record<string, unknown>
        if (!body || (body as { error?: unknown }).error) {
            return { data: body, usage: null, model: reqBody.model as string | undefined }
        }

        const b = body as {
            output?: Array<{
                type?: string
                content?: Array<{ type?: string; text?: string }>
            }>
            output_text?: string
            usage?: OpenAIResponsesUsage
            model?: string
        }

        // Extract text content from output items
        let textContent = ''
        if (Array.isArray(b.output)) {
            for (const item of b.output) {
                if (item.type === 'message' && Array.isArray(item.content)) {
                    for (const content of item.content) {
                        if (content.type === 'output_text') {
                            textContent += content.text || ''
                        }
                    }
                }
            }
        }

        if (!textContent && b.output_text) {
            textContent = b.output_text
        }

        const usage = b.usage || {}
        const normalizedUsage: TokenUsage = {
            prompt_tokens: usage.input_tokens || 0,
            completion_tokens: usage.output_tokens || 0,
            total_tokens:
                usage.total_tokens || (usage.input_tokens || 0) + (usage.output_tokens || 0),
        }

        return {
            data: body,
            usage: normalizedUsage,
            model: b.model || (reqBody.model as string | undefined) || 'unknown',
            _extractedContent: textContent,
        }
    }

    /** Extract usage from response - handles both API formats */
    override extractUsage(response: unknown): TokenUsage {
        const r = (response || {}) as Record<string, unknown>
        const usage = (r.usage || {}) as OpenAIResponsesUsage

        // Responses API uses input_tokens/output_tokens
        if (usage.input_tokens !== undefined) {
            return {
                prompt_tokens: usage.input_tokens || 0,
                completion_tokens: usage.output_tokens || 0,
                total_tokens:
                    usage.total_tokens || (usage.input_tokens || 0) + (usage.output_tokens || 0),
            }
        }

        // Chat Completions API
        return {
            prompt_tokens: usage.prompt_tokens || 0,
            completion_tokens: usage.completion_tokens || 0,
            total_tokens:
                usage.total_tokens || (usage.prompt_tokens || 0) + (usage.completion_tokens || 0),
        }
    }
}

export default OpenAIProvider
