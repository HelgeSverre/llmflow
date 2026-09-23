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
    display_name: string
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

/**
 * The API key a client sent: the first of `headerNames` that is set, else the Authorization
 * header without its "Bearer " prefix.
 */
export function apiKeyFrom(
    headers: Record<string, string | undefined> | undefined,
    ...headerNames: string[]
): string | undefined {
    for (const name of headerNames) if (headers?.[name]) return headers[name]
    return headers?.authorization?.replace(/^Bearer\s+/i, '') || undefined
}

/**
 * One upstream LLM API. The proxy uses a provider in two modes:
 * - translated (/v1/*, /<provider>/v1/*): OpenAI-format requests are translated to the
 *   provider's API and responses back (getTarget, transformRequestBody, normalizeResponse);
 * - passthrough (/passthrough/<provider>/*): the provider's native request is forwarded
 *   unchanged to the same host (passthroughTarget) and the response returned as-is.
 * Headers, usage, model and streaming detection work the same in both modes.
 */
export class BaseProvider {
    streamFormat: StreamFormat = 'openai'
    name = 'base'
    displayName = 'Base Provider'
    hostname = ''
    port = 443
    protocol: 'http' | 'https' = 'https'

    /** Upstream for a translated request; providers with other paths override this. */
    getTarget(req: ProviderRequest): ProviderTarget {
        return this.passthroughTarget(req)
    }

    /** Upstream for a passthrough request: same host, the client's path. */
    passthroughTarget(req: ProviderRequest): ProviderTarget {
        return { hostname: this.hostname, port: this.port, path: req.path, protocol: this.protocol }
    }

    /** Headers for the upstream request, in both modes. */
    transformRequestHeaders(
        headers: Record<string, string | undefined>,
        _req?: ProviderRequest,
    ): Record<string, string | undefined> {
        return { 'Content-Type': 'application/json', Authorization: headers.authorization }
    }

    /** Translated mode: OpenAI-format request body to the provider's format. */
    transformRequestBody(body: unknown, _req: ProviderRequest): unknown {
        return body
    }

    /** Translated mode: the provider's response to OpenAI format. */
    normalizeResponse(body: unknown, req: ProviderRequest): NormalizedResponse {
        return {
            data: body,
            usage: this.extractUsage(body),
            model: this.responseModel(body, req),
        }
    }

    /** Token usage from the provider's raw (not normalized) response body, in both modes. */
    extractUsage(response: unknown): TokenUsage {
        const usage = ((response || {}) as { usage?: UsageLike }).usage || {}
        const prompt = usage.prompt_tokens || usage.input_tokens || 0
        const completion = usage.completion_tokens || usage.output_tokens || 0
        return {
            prompt_tokens: prompt,
            completion_tokens: completion,
            total_tokens: usage.total_tokens || prompt + completion,
        }
    }

    /** The model that served a raw response, falling back to the requested one. */
    responseModel(response: unknown, req: ProviderRequest): string | undefined {
        return (response as { model?: string } | null)?.model || this.requestedModel(req)
    }

    /** The model a request asks for, if it names one. */
    requestedModel(req: ProviderRequest): string | undefined {
        return (req.body as { model?: string } | undefined)?.model || undefined
    }

    identifyRequestModel(req: ProviderRequest): string {
        return this.requestedModel(req) || 'unknown'
    }

    createStreamSession(req: ProviderRequest, id: string) {
        return new StreamSession(this.streamFormat, this.identifyRequestModel(req), id)
    }

    isStreamingRequest(req: ProviderRequest): boolean {
        return (req.body as { stream?: boolean } | undefined)?.stream === true
    }
}
