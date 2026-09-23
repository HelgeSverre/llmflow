import { AsyncLocalStorage } from 'node:async_hooks'
import { randomUUID } from 'node:crypto'

const LLMFLOW_URL = process.env.LLMFLOW_URL || 'http://127.0.0.1:1337'

export type SpanType =
    | 'trace'
    | 'llm'
    | 'agent'
    | 'chain'
    | 'tool'
    | 'retrieval'
    | 'embedding'
    | 'custom'
    | (string & {})

export interface SpanContext {
    spanId: string
    traceId: string
    parentId: string | null
}

export interface SpanOptions {
    type: SpanType
    name: string
    /** Start the span in this trace instead of the current one (or a new one). */
    traceId?: string
    input?: unknown
    attributes?: Record<string, unknown>
    tags?: string[]
    /** Defaults to 'unknown_service', OpenTelemetry's name for an unnamed service. */
    serviceName?: string
}

export interface TraceHeaders {
    'x-trace-id'?: string
    'x-parent-id'?: string
}

const storage = new AsyncLocalStorage<SpanContext>()

/** A random UUID, the ID format LLMFlow uses for spans and traces. */
export function generateId(): string {
    return randomUUID()
}

/** The span that the calling code runs in, or null outside trace()/span(). */
export function getCurrentSpan(): SpanContext | null {
    return storage.getStore() ?? null
}

/** Headers that link an LLM call made through the LLMFlow proxy to the current span. */
export function currentTraceHeaders(): TraceHeaders {
    const context = getCurrentSpan()
    if (!context) return {}
    return { 'x-trace-id': context.traceId, 'x-parent-id': context.spanId }
}

async function sendSpan(body: Record<string, unknown>) {
    try {
        const response = await fetch(`${LLMFLOW_URL}/api/spans`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })
        if (!response.ok) console.error(`[llmflow] Failed to send span: ${response.status}`)
    } catch (error) {
        // Tracing must never break the application; only report when asked to.
        if (process.env.LLMFLOW_VERBOSE)
            console.error('[llmflow] Failed to send span:', (error as Error).message)
    }
}

/**
 * Runs `fn` inside a new span and sends the span to LLMFlow when `fn` settles.
 * The span is a child of the current span, or starts a new trace outside one.
 */
export function span<T>(options: SpanOptions, fn: () => T | Promise<T>): Promise<T>
export function span<T>(type: SpanType, name: string, fn: () => T | Promise<T>): Promise<T>
export async function span<T>(
    optionsOrType: SpanOptions | SpanType,
    nameOrFn: string | (() => T | Promise<T>),
    maybeFn?: () => T | Promise<T>,
): Promise<T> {
    const options: SpanOptions =
        typeof optionsOrType === 'string'
            ? {
                  type: optionsOrType,
                  name: typeof nameOrFn === 'string' ? nameOrFn : optionsOrType,
              }
            : optionsOrType
    const fn = (typeof nameOrFn === 'function' ? nameOrFn : maybeFn)!

    const parent = getCurrentSpan()
    const context: SpanContext = {
        spanId: generateId(),
        traceId: options.traceId || parent?.traceId || generateId(),
        parentId: parent?.spanId ?? null,
    }
    const startTime = Date.now()
    let output: unknown = null
    let error: string | null = null
    let status = 200
    try {
        const result = await storage.run(context, fn)
        output = result
        return result
    } catch (thrown) {
        error = (thrown as Error)?.message || String(thrown)
        status = 500
        throw thrown
    } finally {
        const endTime = Date.now()
        void sendSpan({
            id: context.spanId,
            trace_id: context.traceId,
            parent_id: context.parentId,
            span_type: options.type || 'custom',
            span_name: options.name || options.type || 'span',
            start_time: startTime,
            end_time: endTime,
            duration_ms: endTime - startTime,
            status,
            error,
            input: options.input,
            output: typeof output === 'object' ? output : { result: output },
            attributes: options.attributes || {},
            tags: options.tags || [],
            service_name: options.serviceName || 'unknown_service',
        })
    }
}

/** Runs `fn` as the root span of a new trace. */
export function trace<T>(
    name: string,
    fn: () => T | Promise<T>,
    options: Partial<SpanOptions> = {},
): Promise<T> {
    return span({ type: 'trace', name, traceId: generateId(), ...options }, fn)
}

type AsyncMethod = (this: any, ...args: any[]) => Promise<unknown>

export interface TracedDecorator {
    /** Standard (TC39) method decorators. */
    <M extends AsyncMethod>(method: M, context: ClassMethodDecoratorContext): M
    /** Legacy decorators (`experimentalDecorators`). */
    (
        target: object,
        propertyKey: string | symbol,
        descriptor: PropertyDescriptor,
    ): PropertyDescriptor
}

/**
 * Method decorator that runs every call of the method in a span named after the method
 * (or `name`). Works with standard decorators and with `experimentalDecorators`.
 */
export function traced(type: SpanType, name?: string): TracedDecorator {
    const wrap = (method: AsyncMethod, spanName: string) =>
        function (this: unknown, ...args: unknown[]) {
            return span({ type, name: spanName }, () => method.apply(this, args))
        }
    return ((target: unknown, contextOrKey: unknown, descriptor?: PropertyDescriptor) => {
        if (typeof contextOrKey === 'object' && contextOrKey !== null && 'kind' in contextOrKey) {
            const context = contextOrKey as ClassMethodDecoratorContext
            return wrap(target as AsyncMethod, name || String(context.name))
        }
        descriptor!.value = wrap(descriptor!.value, name || String(contextOrKey))
        return descriptor
    }) as TracedDecorator
}

type ChatCompletionsClient = {
    chat: { completions: { create: (body: any, options?: any) => any } }
}

/** Makes every `client.chat.completions.create` call send the current trace headers. */
export function wrapOpenAI<C extends ChatCompletionsClient>(client: C): C {
    const create = client.chat.completions.create.bind(client.chat.completions)
    client.chat.completions.create = (
        body: unknown,
        options: { headers?: Record<string, string> } = {},
    ) => create(body, { ...options, headers: { ...options.headers, ...currentTraceHeaders() } })
    return client
}
