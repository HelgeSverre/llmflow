/**
 * Base provider class defining the interface for all LLM providers.
 * Each provider must implement these methods to handle request/response transformations.
 */

import type * as httpType from 'http'
import type * as httpsType from 'https'

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

export interface ParsedStreamChunk {
    content: string
    usage: TokenUsage | null
    done: boolean
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

export type HttpLikeModule = typeof httpType | typeof httpsType

export class BaseProvider {
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

    /** Parse a streaming chunk and extract content */
    parseStreamChunk(chunk: string): ParsedStreamChunk {
        const lines = chunk.split('\n')
        let content = ''
        let usage: TokenUsage | null = null
        let done = false

        for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed.startsWith('data:')) continue

            const payload = trimmed.slice(5).trim()
            if (payload === '[DONE]') {
                done = true
                continue
            }

            try {
                const json = JSON.parse(payload)
                const delta = json.choices?.[0]?.delta?.content
                if (delta) content += delta
                if (json.usage) usage = json.usage as TokenUsage
            } catch {
                // Ignore parse errors
            }
        }

        return { content, usage, done }
    }

    /** Assemble a complete response from streaming chunks */
    assembleStreamingResponse(
        fullContent: string,
        usage: TokenUsage | null,
        req: ProviderRequest,
        traceId: string,
    ): unknown {
        const reqBody = (req.body || {}) as Record<string, unknown>
        return {
            id: traceId,
            object: 'chat.completion',
            model: reqBody.model,
            choices: [
                {
                    message: { role: 'assistant', content: fullContent },
                    finish_reason: 'stop',
                },
            ],
            usage: usage,
            _streaming: true,
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

    /** Get the HTTP/HTTPS module to use */
    getHttpModule(): HttpLikeModule {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        return require('https')
    }
}

/**
 * Public Provider interface — every concrete provider implements this surface.
 * Use this when consuming providers (e.g., in apps/server) for type-checked
 * access rather than 'any'.
 */
export interface Provider {
    name: string
    displayName: string
    getTarget(req: ProviderRequest): ProviderTarget
    transformRequestHeaders(
        headers: Record<string, string | undefined>,
        req: ProviderRequest,
    ): Record<string, string | undefined>
    transformRequestBody(body: unknown, req: ProviderRequest): unknown
    normalizeResponse(body: unknown, req: ProviderRequest): NormalizedResponse
    parseStreamChunk(chunk: string): ParsedStreamChunk
    assembleStreamingResponse(
        fullContent: string,
        usage: TokenUsage | null,
        req: ProviderRequest,
        traceId: string,
    ): unknown
    extractUsage(response: unknown): TokenUsage
    isStreamingRequest(req: ProviderRequest): boolean
    getHttpModule(): HttpLikeModule
}

export default BaseProvider
