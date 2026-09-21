import {
    BaseProvider,
    type NormalizedResponse,
    type ProviderRequest,
    type ProviderTarget,
    type TokenUsage,
} from './base'

export interface CohereProviderConfig {
    hostname?: string
}

interface CohereTokens {
    input_tokens?: number
    output_tokens?: number
}

/**
 * Cohere v2 Chat API provider.
 *
 * Key differences from OpenAI:
 * - Endpoint: POST /v2/chat
 * - Uses Bearer token authentication
 * - Response has nested usage structure (tokens.input_tokens, tokens.output_tokens)
 * - Assistant content is array of {type: "text", text: "..."} objects
 * - Different finish reasons: COMPLETE, STOP_SEQUENCE, MAX_TOKENS, TOOL_CALL
 * - Streaming uses granular event types (message-start, content-delta, message-end)
 */
export class CohereProvider extends BaseProvider {
    override streamFormat = 'cohere' as const
    hostname: string

    constructor(config: CohereProviderConfig = {}) {
        super()
        this.name = 'cohere'
        this.displayName = 'Cohere'
        this.hostname = config.hostname || 'api.cohere.com'
    }

    override getTarget(req: ProviderRequest): ProviderTarget {
        let path = req.path

        if (path === '/v1/chat/completions' || path === '/chat/completions') {
            path = '/v2/chat'
        }

        return {
            hostname: this.hostname,
            port: 443,
            path,
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
            'X-Client-Name': 'llmflow-proxy',
        }
    }

    override transformRequestBody(body: unknown, _req: ProviderRequest): unknown {
        const b = body as
            | {
                  model?: string
                  messages?: unknown
                  stream?: boolean
                  max_tokens?: number
                  temperature?: number
                  top_p?: number
                  frequency_penalty?: number
                  presence_penalty?: number
                  stop?: string | string[]
              }
            | null
            | undefined
        if (!b) return body

        const transformed: Record<string, unknown> = {
            model: b.model,
            messages: b.messages,
            stream: b.stream || false,
        }

        if (b.max_tokens) transformed.max_tokens = b.max_tokens
        if (b.temperature !== undefined) transformed.temperature = b.temperature
        if (b.top_p !== undefined) transformed.p = b.top_p // Cohere uses 'p' not 'top_p'
        if (b.frequency_penalty !== undefined) transformed.frequency_penalty = b.frequency_penalty
        if (b.presence_penalty !== undefined) transformed.presence_penalty = b.presence_penalty
        if (b.stop) {
            transformed.stop_sequences = Array.isArray(b.stop) ? b.stop : [b.stop]
        }

        return transformed
    }

    override normalizeResponse(body: unknown, req: ProviderRequest): NormalizedResponse {
        const reqBody = (req.body || {}) as Record<string, unknown>
        const b = body as
            | {
                  id?: string
                  message?: {
                      content?: Array<{ type?: string; text?: string }> | string
                  }
                  finish_reason?: string
                  usage?: { tokens?: CohereTokens; billed_units?: CohereTokens }
                  error?: unknown
              }
            | null
            | undefined

        if (!b || b.error) {
            return { data: body, usage: null, model: reqBody.model as string | undefined }
        }

        let textContent = ''
        if (b.message?.content) {
            if (Array.isArray(b.message.content)) {
                textContent = b.message.content
                    .filter((c) => c.type === 'text')
                    .map((c) => c.text || '')
                    .join('')
            } else if (typeof b.message.content === 'string') {
                textContent = b.message.content
            }
        }

        const finishReasonMap: Record<string, string> = {
            COMPLETE: 'stop',
            STOP_SEQUENCE: 'stop',
            MAX_TOKENS: 'length',
            TOOL_CALL: 'tool_calls',
            ERROR: 'content_filter',
            TIMEOUT: 'content_filter',
        }

        const tokens = b.usage?.tokens || {}
        const billedUnits = b.usage?.billed_units || {}
        const normalizedUsage: TokenUsage = {
            prompt_tokens: tokens.input_tokens || billedUnits.input_tokens || 0,
            completion_tokens: tokens.output_tokens || billedUnits.output_tokens || 0,
            total_tokens: (tokens.input_tokens || 0) + (tokens.output_tokens || 0),
        }

        const model = (reqBody.model as string | undefined) || 'command'
        const normalized = {
            id: b.id || `cohere-${Date.now()}`,
            object: 'chat.completion',
            model,
            choices: [
                {
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: textContent,
                    },
                    finish_reason: (b.finish_reason && finishReasonMap[b.finish_reason]) || 'stop',
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
            usage?:
                | TokenUsage
                | { tokens?: CohereTokens; billed_units?: CohereTokens }
                | Record<string, unknown>
        }
        const usage = r.usage

        if (usage && 'prompt_tokens' in usage && typeof usage.prompt_tokens === 'number') {
            return usage as TokenUsage
        }

        const rawUsage = (usage || {}) as { tokens?: CohereTokens; billed_units?: CohereTokens }
        const tokens = rawUsage.tokens || {}
        const billedUnits = rawUsage.billed_units || {}
        return {
            prompt_tokens: tokens.input_tokens || billedUnits.input_tokens || 0,
            completion_tokens: tokens.output_tokens || billedUnits.output_tokens || 0,
            total_tokens: (tokens.input_tokens || 0) + (tokens.output_tokens || 0),
        }
    }
}

export default CohereProvider
