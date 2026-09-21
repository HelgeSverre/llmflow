import { StreamSession, type StreamFormat } from './stream'

export interface PassthroughTarget {
    hostname: string
    port: number
    path: string
    protocol: string
}

export interface PassthroughUsage {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
    [extra: string]: number | string | undefined
}

interface PassthroughRequest {
    method?: string
    path: string
    headers: Record<string, string | undefined>
    body?: Record<string, unknown> | unknown
}

type HeaderTransform = (
    headers: Record<string, string | undefined>,
) => Record<string, string | undefined>
type ExtractUsageFn = (body: unknown) => PassthroughUsage
type IdentifyModelFn = (reqBody: unknown, respBody: unknown) => string

export interface PassthroughOptions {
    name?: string
    displayName?: string
    targetHost?: string
    targetPort?: number
    protocol?: 'http' | 'https'
    extractUsage?: ExtractUsageFn
    identifyModel?: IdentifyModelFn
    headerTransform?: HeaderTransform
}

/**
 * Base passthrough handler for forwarding requests without body transformation.
 * Used for AI CLI tools that send native API formats (Anthropic, Gemini).
 *
 * Key differences from regular providers:
 * - Request body is NOT transformed - forwarded as-is
 * - Response body is NOT normalized - returned as-is to client
 * - Usage metrics ARE extracted for observability
 */
export class PassthroughHandler {
    streamFormat: StreamFormat = 'openai'
    identifyRequestModel(req: PassthroughRequest): string {
        return (req.body as { model?: string })?.model || 'unknown'
    }
    createStreamSession(req: PassthroughRequest, id: string) {
        return new StreamSession(this.streamFormat, this.identifyRequestModel(req), id)
    }

    name: string
    displayName: string
    targetHost: string
    targetPort: number
    protocol: 'http' | 'https'

    extractUsage: ExtractUsageFn
    identifyModel: IdentifyModelFn
    headerTransform: HeaderTransform

    constructor(options: PassthroughOptions = {}) {
        this.name = options.name || 'passthrough'
        this.displayName = options.displayName || 'Passthrough'
        this.targetHost = options.targetHost || ''
        this.targetPort = options.targetPort || 443
        this.protocol = options.protocol || 'https'

        // Customizable hooks
        this.extractUsage = options.extractUsage || ((b) => this.defaultExtractUsage(b))
        this.identifyModel =
            options.identifyModel || ((rq, rs) => this.defaultIdentifyModel(rq, rs))
        this.headerTransform = options.headerTransform || ((h) => this.defaultHeaderTransform(h))
    }

    /** Get target configuration - passthrough preserves the original path */
    getTarget(req: PassthroughRequest): PassthroughTarget {
        return {
            hostname: this.targetHost,
            port: this.targetPort,
            path: req.path,
            protocol: this.protocol,
        }
    }

    /** Transform headers for upstream - override in subclasses */
    defaultHeaderTransform(
        headers: Record<string, string | undefined>,
    ): Record<string, string | undefined> {
        return {
            'Content-Type': headers['content-type'] || 'application/json',
            Authorization: headers.authorization,
        }
    }

    /** Extract usage from response - override in subclasses */
    defaultExtractUsage(body: unknown): PassthroughUsage {
        const b = (body || {}) as { usage?: Record<string, number | undefined> }
        const usage = b.usage || {}
        const promptTokens = usage.prompt_tokens || usage.input_tokens || 0
        const completionTokens = usage.completion_tokens || usage.output_tokens || 0
        return {
            prompt_tokens: promptTokens,
            completion_tokens: completionTokens,
            total_tokens: usage.total_tokens || promptTokens + completionTokens,
        }
    }

    /** Identify model from request/response - override in subclasses */
    defaultIdentifyModel(reqBody: unknown, respBody: unknown): string {
        const rq = (reqBody || {}) as { model?: string }
        const rs = (respBody || {}) as { model?: string }
        return rq.model || rs.model || 'unknown'
    }

    /** Check if request is streaming */
    isStreamingRequest(req: PassthroughRequest): boolean {
        const body = (req.body || {}) as { stream?: boolean }
        return body.stream === true
    }
}

/**
 * Anthropic passthrough handler for native Claude API format.
 * Used by Claude Code and other tools using Anthropic's /v1/messages endpoint.
 */
export class AnthropicPassthrough extends PassthroughHandler {
    override streamFormat = 'anthropic' as const
    constructor() {
        super({
            name: 'anthropic-passthrough',
            displayName: 'Anthropic (Passthrough)',
            targetHost: 'api.anthropic.com',
            targetPort: 443,
            protocol: 'https',
        })
    }

    override defaultHeaderTransform(
        headers: Record<string, string | undefined>,
    ): Record<string, string | undefined> {
        // Extract API key from various sources
        let apiKey = headers['x-api-key']
        if (!apiKey && headers.authorization) {
            apiKey = headers.authorization.replace(/^Bearer\s+/i, '')
        }

        const result: Record<string, string | undefined> = {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': headers['anthropic-version'] || '2023-06-01',
        }

        if (headers['anthropic-beta']) {
            result['anthropic-beta'] = headers['anthropic-beta']
        }

        return result
    }

    override defaultExtractUsage(body: unknown): PassthroughUsage {
        const b = (body || {}) as {
            usage?: {
                input_tokens?: number
                output_tokens?: number
                cache_creation_input_tokens?: number
                cache_read_input_tokens?: number
            }
        }
        const usage = b.usage || {}
        return {
            prompt_tokens: usage.input_tokens || 0,
            completion_tokens: usage.output_tokens || 0,
            total_tokens: (usage.input_tokens || 0) + (usage.output_tokens || 0),
            cache_creation_input_tokens: usage.cache_creation_input_tokens || 0,
            cache_read_input_tokens: usage.cache_read_input_tokens || 0,
        }
    }

    override defaultIdentifyModel(reqBody: unknown, respBody: unknown): string {
        const rq = (reqBody || {}) as { model?: string }
        const rs = (respBody || {}) as { model?: string }
        return rs.model || rq.model || 'claude-unknown'
    }
}

/**
 * Google Gemini passthrough handler for native Gemini API format.
 */
export class GeminiPassthrough extends PassthroughHandler {
    override streamFormat = 'gemini' as const
    override isStreamingRequest(req: PassthroughRequest): boolean {
        return (
            /:streamGenerateContent$/.test(req.path.split('?')[0]) || super.isStreamingRequest(req)
        )
    }
    override identifyRequestModel(req: PassthroughRequest): string {
        return req.path.match(/\/models\/([^/:?]+)/)?.[1] || super.identifyRequestModel(req)
    }

    constructor() {
        super({
            name: 'gemini-passthrough',
            displayName: 'Google Gemini (Passthrough)',
            targetHost: 'generativelanguage.googleapis.com',
            targetPort: 443,
            protocol: 'https',
        })
    }

    override getTarget(req: PassthroughRequest): PassthroughTarget {
        let path = req.path

        const apiKey = this.extractApiKey(req.headers)
        if (apiKey) {
            const separator = path.includes('?') ? '&' : '?'
            path = `${path}${separator}key=${encodeURIComponent(apiKey)}`
        }

        return {
            hostname: this.targetHost,
            port: this.targetPort,
            path,
            protocol: this.protocol,
        }
    }

    extractApiKey(headers: Record<string, string | undefined>): string | null {
        if (headers['x-goog-api-key']) {
            return headers['x-goog-api-key'] || null
        }
        if (headers.authorization) {
            return headers.authorization.replace(/^Bearer\s+/i, '')
        }
        return null
    }

    override defaultHeaderTransform(
        _headers: Record<string, string | undefined>,
    ): Record<string, string | undefined> {
        return {
            'Content-Type': 'application/json',
            // API key is passed via query string, not header
        }
    }

    override defaultExtractUsage(body: unknown): PassthroughUsage {
        const b = (body || {}) as {
            usageMetadata?: {
                promptTokenCount?: number
                candidatesTokenCount?: number
                totalTokenCount?: number
            }
        }
        const usage = b.usageMetadata || {}
        return {
            prompt_tokens: usage.promptTokenCount || 0,
            completion_tokens: usage.candidatesTokenCount || 0,
            total_tokens:
                usage.totalTokenCount ||
                (usage.promptTokenCount || 0) + (usage.candidatesTokenCount || 0),
        }
    }

    override defaultIdentifyModel(reqBody: unknown, respBody: unknown): string {
        const rq = (reqBody || {}) as { model?: string }
        const rs = (respBody || {}) as { model?: string; modelVersion?: string }
        return rs.modelVersion || rq.model || 'gemini-unknown'
    }
}

/**
 * OpenAI passthrough handler for native OpenAI API format.
 * Used by tools that already use OpenAI format but need passthrough.
 */
export class OpenAIPassthrough extends PassthroughHandler {
    constructor() {
        super({
            name: 'openai-passthrough',
            displayName: 'OpenAI (Passthrough)',
            targetHost: 'api.openai.com',
            targetPort: 443,
            protocol: 'https',
        })
    }

    override defaultHeaderTransform(
        headers: Record<string, string | undefined>,
    ): Record<string, string | undefined> {
        return {
            'Content-Type': 'application/json',
            Authorization: headers.authorization,
        }
    }

    override defaultExtractUsage(body: unknown): PassthroughUsage {
        const b = (body || {}) as {
            usage?: {
                prompt_tokens?: number
                completion_tokens?: number
                total_tokens?: number
                input_tokens?: number
                output_tokens?: number
            }
        }
        const usage = b.usage || {}
        const promptTokens = usage.prompt_tokens || usage.input_tokens || 0
        const completionTokens = usage.completion_tokens || usage.output_tokens || 0
        return {
            prompt_tokens: promptTokens,
            completion_tokens: completionTokens,
            total_tokens: usage.total_tokens || promptTokens + completionTokens,
        }
    }
}

/**
 * Helicone passthrough handler for LLM cost tracking.
 * Routes requests through Helicone's gateway while preserving OpenAI format.
 */
export class HeliconePassthrough extends PassthroughHandler {
    constructor() {
        super({
            name: 'helicone-passthrough',
            displayName: 'Helicone (Cost Tracking)',
            targetHost: process.env.HELICONE_HOST || 'oai.helicone.ai',
            targetPort: 443,
            protocol: 'https',
        })
    }

    override getTarget(req: PassthroughRequest): PassthroughTarget {
        const host = process.env.HELICONE_HOST || 'oai.helicone.ai'
        const port = process.env.HELICONE_PORT || '443'

        return {
            hostname: host,
            port: parseInt(port, 10),
            path: req.path,
            protocol: this.protocol,
        }
    }

    override defaultHeaderTransform(
        headers: Record<string, string | undefined>,
    ): Record<string, string | undefined> {
        const heliconeHeaders: Record<string, string | undefined> = {
            'Content-Type': 'application/json',
            Authorization: headers.authorization,
        }

        const heliconeApiKey = headers['helicone-auth'] || process.env.HELICONE_API_KEY
        if (heliconeApiKey) {
            heliconeHeaders['Helicone-Auth'] = heliconeApiKey.startsWith('Bearer ')
                ? heliconeApiKey
                : `Bearer ${heliconeApiKey}`
        }

        const heliconeFeatures = [
            'helicone-property-',
            'helicone-user-id',
            'helicone-session-id',
            'helicone-session-name',
            'helicone-session-path',
            'helicone-prompt-id',
            'helicone-cache-enabled',
            'helicone-retry-enabled',
            'helicone-rate-limit-policy',
            'helicone-fallbacks',
        ]

        for (const [key, value] of Object.entries(headers)) {
            const lowerKey = key.toLowerCase()
            if (heliconeFeatures.some((prefix) => lowerKey.startsWith(prefix))) {
                heliconeHeaders[key] = value
            }
        }

        return heliconeHeaders
    }

    override defaultExtractUsage(body: unknown): PassthroughUsage {
        const b = (body || {}) as {
            usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
        }
        const usage = b.usage || {}
        return {
            prompt_tokens: usage.prompt_tokens || 0,
            completion_tokens: usage.completion_tokens || 0,
            total_tokens:
                usage.total_tokens || (usage.prompt_tokens || 0) + (usage.completion_tokens || 0),
        }
    }
}
