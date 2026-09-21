import { StreamSession, type StreamFormat } from './stream'
/**
 * Base provider class defining the interface for all LLM providers.
 * Each provider must implement these methods to handle request/response transformations.
 */

export interface ProviderRequest {
    method?: string
    path: string
    headers: Record<string, string | undefined>
    body?: Record<string, unknown> | unknown
}

export interface ProviderTarget {
    hostname: string
    port: number
    path: string
    protocol: string
}

/**
 * Unified token usage shape returned by extractUsage across all providers.
 * Additional provider-specific fields (e.g., Anthropic cache metrics) may be
 * present via the index signature.
 */
export interface TokenUsage {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
    model?: string
    [extra: string]: number | string | undefined
}

export interface NormalizedResponse {
    data: unknown
    usage: TokenUsage | null
    model: string | undefined
    [extra: string]: unknown
}

export interface ProviderListing {
    name: string
    displayName: string
    prefix: string
    default: boolean
}

export interface UsageLike {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
    input_tokens?: number
    output_tokens?: number
    [key: string]: unknown
}

export class BaseProvider {
    streamFormat: StreamFormat = 'openai'
    identifyRequestModel(req: ProviderRequest): string {
        return (req.body as { model?: string })?.model || 'unknown'
    }
    createStreamSession(req: ProviderRequest, id: string) {
        return new StreamSession(this.streamFormat, this.identifyRequestModel(req), id)
    }

    name: string
    displayName: string

    constructor() {
        this.name = 'base'
        this.displayName = 'Base Provider'
    }

    /** Get the target configuration for the upstream request */
    getTarget(_req: ProviderRequest): ProviderTarget {
        throw new Error('getTarget() must be implemented by provider')
    }

    /** Transform request headers for the upstream provider */
    transformRequestHeaders(
        headers: Record<string, string | undefined>,
        _req: ProviderRequest,
    ): Record<string, string | undefined> {
        const result: Record<string, string | undefined> = {
            'Content-Type': 'application/json',
        }
        if (headers.authorization) {
            result['Authorization'] = headers.authorization
        }
        return result
    }

    /** Transform request body for the upstream provider */
    transformRequestBody(body: unknown, _req: ProviderRequest): unknown {
        return body
    }

    /** Normalize response body to a common format for logging */
    normalizeResponse(body: unknown, req: ProviderRequest): NormalizedResponse {
        const b = (body || {}) as Record<string, unknown>
        const reqBody = (req.body || {}) as Record<string, unknown>
        return {
            data: body,
            usage: (b.usage as TokenUsage | undefined) || null,
            model:
                (b.model as string | undefined) ||
                (reqBody.model as string | undefined) ||
                'unknown',
        }
    }

    /** Extract usage information from response */
    extractUsage(response: unknown): TokenUsage {
        const r = (response || {}) as Record<string, unknown>
        const usage = (r.usage || {}) as UsageLike
        const promptTokens = usage.prompt_tokens || 0
        const completionTokens = usage.completion_tokens || 0
        return {
            prompt_tokens: promptTokens,
            completion_tokens: completionTokens,
            total_tokens: usage.total_tokens || promptTokens + completionTokens,
        }
    }

    /** Check if streaming is requested */
    isStreamingRequest(req: ProviderRequest): boolean {
        const body = req.body as { stream?: boolean } | undefined
        return body?.stream === true
    }
}

export type Provider = BaseProvider

export default BaseProvider
