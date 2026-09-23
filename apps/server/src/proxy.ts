import * as db from '@llmflow/db'
import { registry, type BaseProvider } from '@llmflow/providers'
import type { ProviderRequest, TokenUsage } from '@llmflow/providers/base'
import { calculateCost } from '@llmflow/pricing'
import { readBoundedBody } from '@llmflow/shared/body'
import { config, DEFAULT_SERVICE_NAME } from '@llmflow/shared/config'
import { sanitizeHeaders, sanitizePath } from '@llmflow/shared/redaction'
import { log } from '@llmflow/shared/logger'

const BODY_LIMIT = 16 * 1024 * 1024

async function responseText(response: Response): Promise<string> {
    const body = await readBoundedBody(response.body, BODY_LIMIT)
    if (!body) throw new Error('Upstream response exceeds 16 MiB')
    return body.toString('utf8')
}

function targetUrl(
    target: { hostname: string; port: number; protocol: string; path: string },
    incoming: URL,
) {
    const url = new URL(target.path, `${target.protocol}://${target.hostname}:${target.port}`)
    const added = new URLSearchParams(url.search)
    url.search = incoming.search
    for (const key of new Set(added.keys())) url.searchParams.delete(key)
    for (const [key, value] of added) url.searchParams.append(key, value)
    return url
}

function headersFrom(values: Record<string, string | undefined>): Headers {
    const headers = new Headers()
    for (const [name, value] of Object.entries(values))
        if (value !== undefined) headers.set(name, value)
    return headers
}

function downstreamHeaders(upstream: Headers, normalized: boolean) {
    const headers = new Headers(upstream)
    // Fetch has already decoded the body, and stream transformations change its length.
    for (const name of [
        ...(headers.get('connection') || '')
            .split(',')
            .map((name) => name.trim())
            .filter(Boolean),
        'content-length',
        'content-encoding',
        'transfer-encoding',
        'connection',
        'keep-alive',
        'proxy-authenticate',
        'proxy-authorization',
        'te',
        'trailer',
        'upgrade',
    ])
        headers.delete(name)
    if (normalized) headers.set('content-type', 'text/event-stream; charset=utf-8')
    return headers
}

/**
 * Forwards one LLM API call and records it as a span. Without `passthrough` the request is
 * OpenAI format, routed by path/header and translated; with it, the provider's native request
 * is forwarded unchanged (the prefix is stripped) and the response returned as-is.
 */
export async function forwardProxyRequest(
    req: Request,
    url: URL,
    passthrough?: { provider: BaseProvider; prefix: string },
): Promise<Response> {
    const started = Date.now()
    const spanId = crypto.randomUUID().replaceAll('-', '').slice(0, 16)
    const traceId = req.headers.get('x-trace-id') || crypto.randomUUID().replaceAll('-', '')
    const context = Object.freeze({
        id: spanId,
        trace_id: traceId,
        parent_id: req.headers.get('x-parent-id') || undefined,
        request_method: req.method,
        request_path: sanitizePath(url.pathname + url.search),
        request_headers: sanitizeHeaders(req.headers),
        service_name: req.headers.get('x-llmflow-service') || DEFAULT_SERVICE_NAME,
        tags: (req.headers.get('x-llmflow-tags') || req.headers.get('x-llmflow-tag') || '')
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean),
    })
    let body: unknown = null
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        try {
            body = await req.json()
        } catch {
            return Response.json({ error: 'Request body must be valid JSON' }, { status: 400 })
        }
    }
    const request: ProviderRequest = {
        method: req.method,
        path: passthrough ? url.pathname.slice(passthrough.prefix.length) : url.pathname,
        headers: Object.fromEntries(req.headers),
        body,
    }
    let provider: BaseProvider
    if (passthrough) provider = passthrough.provider
    else {
        const resolved = registry.resolve(request)
        provider = resolved.provider
        request.path = resolved.cleanPath
    }
    const name = provider.name
    const controller = new AbortController()
    const timeoutMs = config.proxyTimeoutMs
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0)
        return Response.json({ error: 'Invalid PROXY_TIMEOUT_MS' }, { status: 500 })
    const timer = setTimeout(
        () => controller.abort(new Error('Upstream deadline exceeded')),
        timeoutMs,
    )
    const abort = () => controller.abort(new Error('Client disconnected'))
    req.signal.addEventListener('abort', abort, { once: true })
    if (req.signal.aborted) abort()
    let logged = false
    const record = (
        data: unknown,
        usage: Partial<TokenUsage>,
        model: string,
        status: number,
        headers: Headers,
        error?: string,
    ) => {
        if (logged) return
        logged = true
        clearTimeout(timer)
        req.signal.removeEventListener('abort', abort)
        try {
            const prompt = usage.prompt_tokens ?? 0,
                completion = usage.completion_tokens ?? 0
            db.insertSpan({
                ...context,
                timestamp: started,
                duration_ms: Date.now() - started,
                provider: name,
                model,
                prompt_tokens: prompt,
                completion_tokens: completion,
                total_tokens: usage.total_tokens ?? prompt + completion,
                estimated_cost: calculateCost(model, prompt, completion),
                status,
                error,
                request_body: body,
                response_status: status,
                response_headers: sanitizeHeaders(headers),
                response_body: data,
                span_type: 'llm',
                span_name: `${name} ${model}`,
                attributes: { ...usage },
            })
        } catch (error) {
            log.error(`Failed to persist proxy span: ${(error as Error).message}`)
        }
    }
    const fallbackModel = provider.identifyRequestModel(request)
    try {
        const target = targetUrl(
            passthrough ? provider.passthroughTarget(request) : provider.getTarget(request),
            url,
        )
        const transformed = passthrough ? body : provider.transformRequestBody(body, request)
        const headers = provider.transformRequestHeaders(request.headers, request)
        const upstream = await fetch(target, {
            method: req.method,
            headers: headersFrom(headers),
            body:
                req.method === 'GET' || req.method === 'HEAD'
                    ? undefined
                    : JSON.stringify(transformed),
            signal: controller.signal,
        })
        const streaming =
            provider.isStreamingRequest(request) &&
            upstream.ok &&
            (upstream.headers.get('content-type')?.includes('text/event-stream') ||
                provider.streamFormat === 'cohere' ||
                provider.streamFormat === 'gemini')
        if (!streaming) {
            const text = await responseText(upstream)
            let parsed: unknown
            try {
                parsed = JSON.parse(text)
            } catch {
                parsed = { error: 'Non-JSON upstream response', body: text }
            }
            // Usage and model come from the provider's raw response in both modes.
            const data =
                upstream.ok && !passthrough
                    ? provider.normalizeResponse(parsed, request).data
                    : parsed
            const usage = upstream.ok ? provider.extractUsage(parsed) : {}
            const model = (upstream.ok && provider.responseModel(parsed, request)) || fallbackModel
            record(
                data,
                usage,
                model,
                upstream.status,
                upstream.headers,
                upstream.ok ? undefined : `Upstream HTTP ${upstream.status}`,
            )
            const responseHeaders = downstreamHeaders(upstream.headers, false)
            if ([204, 205, 304].includes(upstream.status))
                return new Response(null, { status: upstream.status, headers: responseHeaders })
            if (passthrough)
                return new Response(text, { status: upstream.status, headers: responseHeaders })
            responseHeaders.set('content-type', 'application/json; charset=utf-8')
            for (const name of ['etag', 'content-md5', 'digest']) responseHeaders.delete(name)
            return Response.json(data, { status: upstream.status, headers: responseHeaders })
        }
        if (!upstream.body) throw new Error('Upstream returned an empty stream')
        const session = provider.createStreamSession(request, spanId)
        const reader = upstream.body.getReader()
        const encoder = new TextEncoder()
        const passthroughStream = !!passthrough || provider.streamFormat === 'openai'
        let complete = false
        let captureError: string | undefined
        const finish = (error?: string) => {
            if (complete) return
            complete = true
            record(
                session.response(),
                session.usage,
                session.model,
                error || session.error ? 502 : upstream.status,
                upstream.headers,
                error || session.error || captureError || undefined,
            )
            reader.releaseLock()
        }
        const stream = new ReadableStream<Uint8Array>({
            async pull(output) {
                try {
                    while (!complete) {
                        const chunk = await reader.read()
                        if (complete) return
                        let frames: string[] = []
                        if (!captureError) {
                            try {
                                frames = session.push(chunk.value || new Uint8Array(), chunk.done)
                            } catch (error) {
                                if (!passthroughStream) throw error
                                captureError = (error as Error).message
                            }
                        }
                        if (passthroughStream) {
                            if (chunk.value) output.enqueue(chunk.value)
                        } else for (const frame of frames) output.enqueue(encoder.encode(frame))
                        if (chunk.done) {
                            if (!passthrough && provider.streamFormat !== 'openai' && !session.done)
                                output.enqueue(encoder.encode('data: [DONE]\n\n'))
                            finish()
                            output.close()
                            return
                        }
                        if (passthroughStream || frames.length) return
                    }
                } catch (error) {
                    await reader.cancel().catch(() => {})
                    finish((error as Error).message)
                    output.error(error)
                }
            },
            async cancel() {
                controller.abort(new Error('Client disconnected'))
                await reader.cancel().catch(() => {})
                finish('Client disconnected')
            },
        })
        return new Response(stream, {
            status: upstream.status,
            headers: downstreamHeaders(upstream.headers, !passthrough),
        })
    } catch (error) {
        const message = (error as Error).message
        const status = controller.signal.aborted ? 504 : 502
        record({ error: message }, {}, fallbackModel, status, new Headers(), message)
        clearTimeout(timer)
        req.signal.removeEventListener('abort', abort)
        return Response.json({ error: 'Proxy request failed', message, provider: name }, { status })
    }
}
