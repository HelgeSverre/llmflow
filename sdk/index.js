/**
 * LLMFlow SDK
 * 
 * Minimal tracing SDK for LLM applications.
 * 
 * Usage:
 *   import { trace, span, currentTraceHeaders } from 'llmflow-sdk';
 * 
 *   await trace('my-workflow', async () => {
 *     await span('retrieval', 'search_docs', async () => {
 *       // your retrieval code
 *     });
 *     
 *     const response = await openai.chat.completions.create({
 *       model: 'gpt-4o-mini',
 *       messages: [...],
 *     }, {
 *       headers: currentTraceHeaders()
 *     });
 *   });
 */

import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';

const LLMFLOW_URL = process.env.LLMFLOW_URL || 'http://localhost:3000';

// Span context storage
const storage = new AsyncLocalStorage();

function generateId() {
    return randomUUID();
}

/**
 * Get current span context
 */
function getCurrentSpan() {
    return storage.getStore() || null;
}

/**
 * Get headers to attach to LLM API calls for trace propagation
 */
function currentTraceHeaders() {
    const ctx = getCurrentSpan();
    if (!ctx) return {};
    return {
        'x-trace-id': ctx.traceId,
        'x-parent-id': ctx.spanId
    };
}

/**
 * Send span to LLMFlow server
 */
async function sendSpan(spanData) {
    try {
        const response = await fetch(`${LLMFLOW_URL}/api/spans`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(spanData)
        });
        if (!response.ok) {
            console.error(`[llmflow] Failed to send span: ${response.status}`);
        }
    } catch (err) {
        // Silent fail - don't break the application
        if (process.env.LLMFLOW_DEBUG) {
            console.error('[llmflow] Failed to send span:', err.message);
        }
    }
}

/**
 * Run a function within a span context
 * 
 * @param {Object} opts - Span options
 * @param {string} opts.type - Span type: 'agent', 'chain', 'tool', 'retrieval', 'embedding', 'custom'
 * @param {string} opts.name - Span name (e.g., 'search_documents', 'call_weather_api')
 * @param {string} [opts.traceId] - Override trace ID (auto-generated if not provided)
 * @param {Object} [opts.input] - Input data to log
 * @param {Object} [opts.attributes] - Custom attributes
 * @param {string[]} [opts.tags] - Tags for filtering
 * @param {string} [opts.serviceName] - Service name
 * @param {Function} fn - Async function to execute
 * @returns {Promise<*>} - Result of fn
 */
async function span(opts, fn) {
    // Support shorthand: span('type', 'name', fn)
    if (typeof opts === 'string') {
        const type = opts;
        const name = typeof fn === 'string' ? fn : opts;
        fn = arguments[2] || arguments[1];
        opts = { type, name: typeof arguments[1] === 'string' ? arguments[1] : type };
    }

    const parent = getCurrentSpan();
    const traceId = opts.traceId || parent?.traceId || generateId();
    const spanId = generateId();
    const parentId = parent?.spanId || null;

    const ctx = { spanId, traceId, parentId };
    const startTime = Date.now();
    
    let output = null;
    let error = null;
    let status = 200;

    try {
        const result = await storage.run(ctx, fn);
        output = result;
        return result;
    } catch (err) {
        error = err.message || String(err);
        status = 500;
        throw err;
    } finally {
        const endTime = Date.now();
        
        sendSpan({
            id: spanId,
            trace_id: traceId,
            parent_id: parentId,
            span_type: opts.type || 'custom',
            span_name: opts.name || opts.type || 'span',
            start_time: startTime,
            end_time: endTime,
            duration_ms: endTime - startTime,
            status,
            error,
            input: opts.input,
            output: typeof output === 'object' ? output : { result: output },
            attributes: opts.attributes || {},
            tags: opts.tags || [],
            service_name: opts.serviceName || opts.service_name || 'app'
        });
    }
}

/**
 * Start a new trace (convenience wrapper for root span)
 * 
 * @param {string} name - Trace name
 * @param {Function} fn - Async function to execute
 * @param {Object} [opts] - Additional span options
 */
async function trace(name, fn, opts = {}) {
    return span({
        type: 'trace',
        name,
        traceId: generateId(),
        ...opts
    }, fn);
}

/**
 * Create a span decorator for class methods
 */
function traced(type, name) {
    return function(target, propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = async function(...args) {
            return span({ type, name: name || propertyKey }, () => originalMethod.apply(this, args));
        };
        return descriptor;
    };
}

/**
 * Wrap an OpenAI client to automatically inject trace headers
 */
function wrapOpenAI(client) {
    const originalCreate = client.chat.completions.create.bind(client.chat.completions);
    
    client.chat.completions.create = async function(body, options = {}) {
        const headers = {
            ...options.headers,
            ...currentTraceHeaders()
        };
        return originalCreate(body, { ...options, headers });
    };
    
    return client;
}

export {
    span,
    trace,
    traced,
    getCurrentSpan,
    currentTraceHeaders,
    wrapOpenAI,
    generateId
};
