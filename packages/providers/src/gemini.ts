import {
    apiKeyFrom,
    BaseProvider,
    type NormalizedResponse,
    type ProviderRequest,
    type ProviderTarget,
    type TokenUsage,
} from './base'

interface GeminiUsageMetadata {
    promptTokenCount?: number
    candidatesTokenCount?: number
    totalTokenCount?: number
}

/**
 * Google Gemini provider.
 * Handles the unique Gemini API format with request/response transformation.
 *
 * Key differences from OpenAI:
 * - API key in query string OR Authorization header
 * - Different endpoint structure: /v1beta/models/{model}:generateContent
 * - Different request format (contents, systemInstruction, generationConfig)
 * - Different response format (candidates, usageMetadata)
 */
export class GeminiProvider extends BaseProvider {
    override streamFormat = 'gemini' as const
    override name = 'gemini'
    override displayName = 'Google Gemini'
    override hostname = 'generativelanguage.googleapis.com'
    apiVersion = 'v1beta'

    // Native requests name the model and streaming in the path (/models/<m>:streamGenerateContent).
    override requestedModel(req: ProviderRequest): string | undefined {
        return req.path.match(/\/models\/([^/:?]+)/)?.[1] || super.requestedModel(req)
    }

    override isStreamingRequest(req: ProviderRequest): boolean {
        return (
            req.path.split('?')[0]!.endsWith(':streamGenerateContent') ||
            super.isStreamingRequest(req)
        )
    }

    override responseModel(response: unknown, req: ProviderRequest): string | undefined {
        return (
            (response as { modelVersion?: string } | null)?.modelVersion ||
            super.responseModel(response, req)
        )
    }

    // Gemini takes the key as a query parameter, in both modes.
    override passthroughTarget(req: ProviderRequest): ProviderTarget {
        const target = super.passthroughTarget(req)
        const key = this.extractApiKey(req.headers)
        if (!key) return target
        const separator = target.path.includes('?') ? '&' : '?'
        return { ...target, path: `${target.path}${separator}key=${encodeURIComponent(key)}` }
    }

    override getTarget(req: ProviderRequest): ProviderTarget {
        const reqBody = (req.body || {}) as { model?: string; stream?: boolean }
        const model = reqBody.model || 'gemini-2.0-flash'
        const isStreaming = reqBody.stream === true

        const action = isStreaming ? 'streamGenerateContent' : 'generateContent'

        let path = `/${this.apiVersion}/models/${model}:${action}`

        const apiKey = this.extractApiKey(req.headers)
        if (apiKey) {
            path += `?key=${encodeURIComponent(apiKey)}`
        }

        if (isStreaming) path += `${path.includes('?') ? '&' : '?'}alt=sse`
        return {
            hostname: this.hostname,
            port: 443,
            path,
            protocol: 'https',
        }
    }

    extractApiKey(headers: Record<string, string | undefined> | undefined): string | undefined {
        return apiKeyFrom(headers, 'x-goog-api-key')
    }

    // The key travels in the query string (see passthroughTarget), not a header.
    override transformRequestHeaders(
        _headers: Record<string, string | undefined>,
    ): Record<string, string | undefined> {
        return { 'Content-Type': 'application/json' }
    }

    override transformRequestBody(body: unknown, _req: ProviderRequest): unknown {
        const b = body as
            | {
                  contents?: unknown
                  messages?: Array<{ role: string; content: unknown }>
                  max_tokens?: number
                  temperature?: number
                  top_p?: number
                  stop?: string | string[]
              }
            | null
            | undefined
        if (!b) return body

        if (b.contents) {
            return body
        }

        const transformed: Record<string, unknown> = {}

        if (b.messages) {
            const systemMessages = b.messages.filter((m) => m.role === 'system')
            const otherMessages = b.messages.filter((m) => m.role !== 'system')

            if (systemMessages.length > 0) {
                transformed.systemInstruction = {
                    parts: [{ text: systemMessages.map((m) => m.content).join('\n') }],
                }
            }

            transformed.contents = otherMessages.map((msg) => ({
                role: msg.role === 'assistant' ? 'model' : 'user',
                parts: [
                    {
                        text:
                            typeof msg.content === 'string'
                                ? msg.content
                                : JSON.stringify(msg.content),
                    },
                ],
            }))
        }

        const generationConfig: Record<string, unknown> = {}
        if (b.max_tokens) generationConfig.maxOutputTokens = b.max_tokens
        if (b.temperature !== undefined) generationConfig.temperature = b.temperature
        if (b.top_p !== undefined) generationConfig.topP = b.top_p
        if (b.stop) {
            generationConfig.stopSequences = Array.isArray(b.stop) ? b.stop : [b.stop]
        }

        if (Object.keys(generationConfig).length > 0) {
            transformed.generationConfig = generationConfig
        }

        return transformed
    }

    override normalizeResponse(body: unknown, req: ProviderRequest): NormalizedResponse {
        const reqBody = (req.body || {}) as Record<string, unknown>
        const b = body as
            | {
                  candidates?: Array<{
                      content?: { parts?: Array<{ text?: string }> }
                      finishReason?: string
                  }>
                  usageMetadata?: GeminiUsageMetadata
                  error?: unknown
              }
            | null
            | undefined

        if (!b || b.error) {
            return { data: body, usage: null, model: reqBody.model as string | undefined }
        }

        let textContent = ''
        let finishReason = 'stop'

        if (Array.isArray(b.candidates) && b.candidates.length > 0) {
            const candidate = b.candidates[0]
            if (candidate.content?.parts) {
                textContent = candidate.content.parts
                    .filter((p) => p.text)
                    .map((p) => p.text || '')
                    .join('')
            }

            const reasonMap: Record<string, string> = {
                STOP: 'stop',
                MAX_TOKENS: 'length',
                SAFETY: 'content_filter',
                RECITATION: 'content_filter',
            }
            finishReason =
                (candidate.finishReason && reasonMap[candidate.finishReason]) ||
                candidate.finishReason?.toLowerCase() ||
                'stop'
        }

        const usage = b.usageMetadata || {}
        const normalizedUsage: TokenUsage = {
            prompt_tokens: usage.promptTokenCount || 0,
            completion_tokens: usage.candidatesTokenCount || 0,
            total_tokens: usage.totalTokenCount || 0,
        }

        const model = (reqBody.model as string | undefined) || 'gemini'
        const normalized = {
            id: `gemini-${Date.now()}`,
            object: 'chat.completion',
            model,
            choices: [
                {
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: textContent,
                    },
                    finish_reason: finishReason,
                },
            ],
            usage: normalizedUsage,
        }

        return {
            data: normalized,
            usage: normalizedUsage,
            model,
        }
    }

    override extractUsage(response: unknown): TokenUsage {
        const r = (response || {}) as {
            usage?: Partial<TokenUsage> & GeminiUsageMetadata
            usageMetadata?: GeminiUsageMetadata
        }
        if (r.usage) {
            return {
                prompt_tokens: r.usage.prompt_tokens || r.usage.promptTokenCount || 0,
                completion_tokens: r.usage.completion_tokens || r.usage.candidatesTokenCount || 0,
                total_tokens: r.usage.total_tokens || r.usage.totalTokenCount || 0,
            }
        }

        if (r.usageMetadata) {
            return {
                prompt_tokens: r.usageMetadata.promptTokenCount || 0,
                completion_tokens: r.usageMetadata.candidatesTokenCount || 0,
                total_tokens: r.usageMetadata.totalTokenCount || 0,
            }
        }

        return { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
    }
}
