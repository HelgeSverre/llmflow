import type { NormalizedResponse, ProviderRequest, TokenUsage, UsageLike } from './base'
import { OpenAICompatibleProvider } from './openai-compatible'

interface OpenAIResponsesUsage extends UsageLike {
    input_tokens?: number
    output_tokens?: number
}

/**
 * OpenAI provider - the reference implementation.
 * Supports both Chat Completions (/v1/chat/completions) and Responses (/v1/responses) APIs.
 */
export class OpenAIProvider extends OpenAICompatibleProvider {
    constructor() {
        super({ name: 'openai', displayName: 'OpenAI', hostname: 'api.openai.com' })
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
}
