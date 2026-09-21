import {
    BaseProvider,
    type NormalizedResponse,
    type ProviderRequest,
    type ProviderTarget,
    type TokenUsage,
} from './base'

export interface GeminiProviderConfig {
    hostname?: string
    apiVersion?: string
}

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
    hostname: string
    apiVersion: string

    constructor(config: GeminiProviderConfig = {}) {
        super()
        this.name = 'gemini'
        this.displayName = 'Google Gemini'
        this.hostname = config.hostname || 'generativelanguage.googleapis.com'
        this.apiVersion = config.apiVersion || 'v1beta'
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

    extractApiKey(headers: Record<string, string | undefined> | undefined): string | null {
        if (!headers) return null

        let apiKey = headers['x-goog-api-key']

        if (!apiKey && headers.authorization) {
            const auth = headers.authorization
            if (auth.startsWith('Bearer ')) {
                apiKey = auth.slice(7)
            }
        }

        return apiKey || null
    }

    override transformRequestHeaders(
        headers: Record<string, string | undefined>,
        _req: ProviderRequest,
    ): Record<string, string | undefined> {
        const result: Record<string, string | undefined> = {
            'Content-Type': 'application/json',
        }

        // If using OAuth, include Authorization header
        if (headers.authorization && !this.extractApiKey(headers)) {
            result['Authorization'] = headers.authorization
        }

        return result
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

export default GeminiProvider
