const express = require('express');
const http = require('http');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const https = require('https');
const WebSocket = require('ws');
const db = require('./db');
const { calculateCost } = require('./pricing');
const log = require('./logger');
const { createOtlpHandler } = require('./otlp');
const { createLogsHandler } = require('./otlp-logs');
const { createMetricsHandler } = require('./otlp-metrics');
const { initExportHooks, getConfig: getExportConfig, flushAll: flushExports } = require('./otlp-export');
const { registry } = require('./providers');
const { AnthropicPassthrough, GeminiPassthrough, OpenAIPassthrough, HeliconePassthrough } = require('./providers/passthrough');

// Passthrough handlers for native API formats
const passthroughHandlers = {
    anthropic: new AnthropicPassthrough(),
    gemini: new GeminiPassthrough(),
    openai: new OpenAIPassthrough(),
    helicone: new HeliconePassthrough()
};

const PROXY_PORT = process.env.PROXY_PORT || 8080;
const DASHBOARD_PORT = process.env.DASHBOARD_PORT || 3000;

// Log request/response to database
/**
 * Extract custom tags from X-LLMFlow-Tag headers
 * Supports: X-LLMFlow-Tag: value or X-LLMFlow-Tag: key:value
 * Multiple tags via comma separation or multiple headers
 */
function extractTagsFromHeaders(headers) {
    const tags = [];
    const tagHeader = headers['x-llmflow-tag'] || headers['x-llmflow-tags'];
    
    if (!tagHeader) return tags;
    
    // Handle array of headers or comma-separated string
    const headerValues = Array.isArray(tagHeader) ? tagHeader : [tagHeader];
    
    for (const value of headerValues) {
        const parts = value.split(',').map(t => t.trim()).filter(Boolean);
        tags.push(...parts);
    }
    
    return tags;
}

function logInteraction(traceId, req, responseData, duration, error = null, providerName = 'openai') {
    try {
        const timestamp = Date.now();
        const usage = responseData?.usage || {};
        const model = responseData?.model || req.body?.model || 'unknown';
        const provider = providerName;
        
        const promptTokens = usage.prompt_tokens || 0;
        const completionTokens = usage.completion_tokens || 0;
        const totalTokens = usage.total_tokens || promptTokens + completionTokens;
        const estimatedCost = calculateCost(model, promptTokens, completionTokens);
        const status = responseData?.status || (error ? 500 : 200);
        
        // Extract custom tags from headers
        const customTags = extractTagsFromHeaders(req.headers);

        db.insertTrace({
            id: traceId,
            timestamp,
            duration_ms: duration,
            provider,
            model,
            prompt_tokens: promptTokens,
            completion_tokens: completionTokens,
            total_tokens: totalTokens,
            estimated_cost: estimatedCost,
            status,
            error,
            request_method: req.method,
            request_path: req.path,
            request_headers: req.headers,
            request_body: req.body,
            response_status: status,
            response_headers: responseData?.headers || {},
            response_body: responseData?.data || { error },
            tags: customTags,
            trace_id: req.headers['x-trace-id'] || traceId,
            parent_id: req.headers['x-parent-id'] || null
        });
    } catch (err) {
        log.error(`Failed to log: ${err.message}`);
    }
}

// Proxy Server
const proxyApp = express();
proxyApp.use(express.json({ limit: '50mb' }));

// Health check endpoint
proxyApp.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        service: 'proxy',
        port: PROXY_PORT,
        traces: db.getTraceCount(),
        uptime: process.uptime(),
        providers: registry.list().map(p => p.name)
    });
});

// List available providers
proxyApp.get('/providers', (req, res) => {
    res.json({
        providers: registry.list(),
        passthrough: Object.keys(passthroughHandlers).map(name => ({
            name: passthroughHandlers[name].name,
            displayName: passthroughHandlers[name].displayName,
            prefix: `/passthrough/${name}/*`
        })),
        usage: {
            default: 'Use /v1/* for OpenAI (default provider)',
            custom: 'Use /{provider}/v1/* for other providers (e.g., /ollama/v1/chat/completions)',
            header: 'Or set X-LLMFlow-Provider header to override',
            passthrough: 'Use /passthrough/{provider}/* for native API formats (e.g., /passthrough/anthropic/v1/messages)'
        }
    });
});

// CORS headers
proxyApp.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', '*');
    res.header('Access-Control-Allow-Methods', '*');
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

// Proxy handler for all provider routes
function createProxyHandler() {
    return async (req, res) => {
        const startTime = Date.now();
        const traceId = req.headers['x-trace-id'] || uuidv4();
        
        // Resolve provider based on path or header
        const { provider, cleanPath } = registry.resolve(req);
        
        // Create a modified request with the clean path (preserving headers and body)
        const proxyReq = { ...req, path: cleanPath, headers: req.headers, body: req.body };
        
        const isStreamingRequest = provider.isStreamingRequest(req);

        log.request(req.method, req.path, traceId);
        log.debug(`Provider: ${provider.name}, Model: ${req.body?.model || 'N/A'}, Stream: ${isStreamingRequest}`);

        try {
            // Transform request body for this provider
            const transformedBody = provider.transformRequestBody(req.body, proxyReq);
            const postData = req.method !== 'GET' ? JSON.stringify(transformedBody) : '';
            
            // Get target configuration
            const target = provider.getTarget(proxyReq);
            
            // Transform headers
            const headers = provider.transformRequestHeaders(req.headers, proxyReq);
            headers['Content-Length'] = Buffer.byteLength(postData);
            
            const options = {
                hostname: target.hostname,
                port: target.port,
                path: target.path,
                method: req.method,
                headers: headers
            };

            // Select HTTP or HTTPS module
            const httpModule = provider.getHttpModule();

            const upstreamReq = httpModule.request(options, (upstreamRes) => {
                if (!isStreamingRequest) {
                    // Non-streaming: buffer entire response
                    let responseBody = '';

                    upstreamRes.on('data', (chunk) => {
                        responseBody += chunk;
                    });

                    upstreamRes.on('end', () => {
                        const duration = Date.now() - startTime;
                        let rawResponse;
                        
                        try {
                            rawResponse = JSON.parse(responseBody);
                        } catch (e) {
                            rawResponse = { error: 'Invalid JSON response', body: responseBody };
                        }

                        // Normalize response through provider
                        const normalized = provider.normalizeResponse(rawResponse, req);
                        const usage = provider.extractUsage(normalized.data);
                        const cost = calculateCost(normalized.model, usage.prompt_tokens, usage.completion_tokens);

                        log.proxy({
                            provider: provider.name,
                            model: normalized.model,
                            tokens: usage.total_tokens,
                            cost,
                            duration,
                            streaming: false
                        });

                        logInteraction(traceId, req, {
                            status: upstreamRes.statusCode,
                            headers: upstreamRes.headers,
                            data: normalized.data,
                            usage: usage,
                            model: normalized.model
                        }, duration, null, provider.name);

                        res.status(upstreamRes.statusCode).json(normalized.data);
                    });
                } else {
                    // Streaming: forward chunks while buffering for logging
                    res.status(upstreamRes.statusCode);
                    Object.entries(upstreamRes.headers).forEach(([key, value]) => {
                        res.setHeader(key, value);
                    });

                    let streamBuffer = ''; // Buffer full stream for proper parsing
                    let chunkCount = 0;

                    upstreamRes.on('data', (chunk) => {
                        chunkCount++;
                        streamBuffer += chunk.toString('utf8');
                        res.write(chunk);
                    });

                    upstreamRes.on('end', () => {
                        const duration = Date.now() - startTime;
                        
                        // Parse once over the complete SSE stream for accurate extraction
                        const parsed = provider.parseStreamChunk(streamBuffer);
                        const fullContent = parsed.content || '';
                        const finalUsage = parsed.usage;
                        
                        const usage = finalUsage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
                        const cost = calculateCost(req.body?.model || 'unknown', usage.prompt_tokens, usage.completion_tokens);

                        log.proxy({
                            provider: provider.name,
                            model: req.body?.model,
                            tokens: usage.total_tokens,
                            cost,
                            duration,
                            streaming: true
                        });

                        log.debug(`Chunks: ${chunkCount}, Content: ${fullContent.length} chars`);

                        const assembledResponse = provider.assembleStreamingResponse(
                            fullContent, finalUsage, req, traceId
                        );
                        assembledResponse._chunks = chunkCount;

                        logInteraction(traceId, req, {
                            status: upstreamRes.statusCode,
                            headers: upstreamRes.headers,
                            data: assembledResponse,
                            usage: usage,
                            model: req.body?.model
                        }, duration, null, provider.name);

                        res.end();
                    });
                }
            });

            upstreamReq.on('error', (error) => {
                const duration = Date.now() - startTime;
                log.proxy({ provider: provider.name, error: error.message, duration });
                logInteraction(traceId, req, null, duration, error.message, provider.name);
                res.status(500).json({ error: 'Proxy request failed', message: error.message, provider: provider.name });
            });

            if (postData) {
                upstreamReq.write(postData);
            }
            upstreamReq.end();

        } catch (error) {
            const duration = Date.now() - startTime;
            log.proxy({ provider: provider.name, error: error.message, duration });
            logInteraction(traceId, req, null, duration, error.message, provider.name);
            res.status(500).json({ error: 'Proxy request failed', message: error.message, provider: provider.name });
        }
    };
}

// Passthrough proxy handler - forwards requests without body transformation
function createPassthroughHandler(handler) {
    return async (req, res) => {
        const startTime = Date.now();
        const traceId = req.headers['x-trace-id'] || uuidv4();
        
        const isStreaming = handler.isStreamingRequest(req);

        log.request(req.method, req.path, traceId);
        log.debug(`Passthrough: ${handler.name}, Model: ${req.body?.model || 'N/A'}, Stream: ${isStreaming}`);

        try {
            // Get target configuration
            const target = handler.getTarget(req);
            
            // Transform only headers, NOT body
            const headers = handler.defaultHeaderTransform(req.headers);
            const postData = req.method !== 'GET' ? JSON.stringify(req.body) : '';
            headers['Content-Length'] = Buffer.byteLength(postData);
            
            const options = {
                hostname: target.hostname,
                port: target.port,
                path: target.path,
                method: req.method,
                headers: headers
            };

            const httpModule = handler.getHttpModule();

            const upstreamReq = httpModule.request(options, (upstreamRes) => {
                if (!isStreaming) {
                    // Non-streaming: buffer for logging while forwarding raw bytes
                    let responseBody = '';

                    // Set response status and headers immediately for passthrough
                    res.status(upstreamRes.statusCode);
                    Object.entries(upstreamRes.headers).forEach(([key, value]) => {
                        if (key.toLowerCase() !== 'content-length' && 
                            key.toLowerCase() !== 'transfer-encoding') {
                            res.setHeader(key, value);
                        }
                    });

                    upstreamRes.on('data', (chunk) => {
                        responseBody += chunk;
                        res.write(chunk); // Forward raw bytes immediately (passthrough)
                    });

                    upstreamRes.on('end', () => {
                        res.end(); // Complete the response first
                        
                        const duration = Date.now() - startTime;
                        let parsedResponse = null;
                        
                        try {
                            parsedResponse = JSON.parse(responseBody);
                        } catch (e) {
                            // Failed to parse - still log the raw body for debugging
                            parsedResponse = null;
                        }

                        // Extract usage from native response format (for logging only)
                        const usage = parsedResponse ? handler.defaultExtractUsage(parsedResponse) : { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
                        const model = handler.defaultIdentifyModel(req.body, parsedResponse);
                        const cost = calculateCost(model, usage.prompt_tokens, usage.completion_tokens);

                        log.proxy({
                            provider: handler.name,
                            model: model,
                            tokens: usage.total_tokens,
                            cost,
                            duration,
                            streaming: false,
                            passthrough: true
                        });

                        logInteraction(traceId, req, {
                            status: upstreamRes.statusCode,
                            headers: upstreamRes.headers,
                            data: parsedResponse || { _raw: responseBody.substring(0, 10000) },
                            usage: usage,
                            model: model
                        }, duration, null, handler.name);
                    });
                } else {
                    // Streaming: forward chunks while buffering for usage extraction
                    res.status(upstreamRes.statusCode);
                    Object.entries(upstreamRes.headers).forEach(([key, value]) => {
                        res.setHeader(key, value);
                    });

                    let streamBuffer = ''; // Buffer full stream for proper parsing
                    let chunkCount = 0;

                    upstreamRes.on('data', (chunk) => {
                        chunkCount++;
                        streamBuffer += chunk.toString('utf8');
                        res.write(chunk); // Forward immediately (passthrough)
                    });

                    upstreamRes.on('end', () => {
                        const duration = Date.now() - startTime;
                        const model = handler.defaultIdentifyModel(req.body, {});
                        
                        // Parse once over the complete SSE stream for accurate extraction
                        const parsed = handler.defaultParseStreamChunk(streamBuffer);
                        const fullContent = parsed.content || '';
                        const finalUsage = parsed.usage;
                        
                        const usage = finalUsage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
                        const cost = calculateCost(model, usage.prompt_tokens, usage.completion_tokens);

                        log.proxy({
                            provider: handler.name,
                            model: model,
                            tokens: usage.total_tokens,
                            cost,
                            duration,
                            streaming: true,
                            passthrough: true
                        });

                        log.debug(`Passthrough chunks: ${chunkCount}, Content: ${fullContent.length} chars`);

                        const assembledResponse = {
                            id: traceId,
                            model: model,
                            content: fullContent,
                            usage: usage,
                            _streaming: true,
                            _chunks: chunkCount,
                            _passthrough: true
                        };

                        logInteraction(traceId, req, {
                            status: upstreamRes.statusCode,
                            headers: upstreamRes.headers,
                            data: assembledResponse,
                            usage: usage,
                            model: model
                        }, duration, null, handler.name);

                        res.end();
                    });
                }
            });

            upstreamReq.on('error', (error) => {
                const duration = Date.now() - startTime;
                log.proxy({ provider: handler.name, error: error.message, duration, passthrough: true });
                logInteraction(traceId, req, null, duration, error.message, handler.name);
                res.status(502).json({ 
                    error: 'Passthrough failed', 
                    message: error.message,
                    provider: handler.name 
                });
            });

            if (postData) {
                upstreamReq.write(postData);
            }
            upstreamReq.end();

        } catch (error) {
            const duration = Date.now() - startTime;
            log.proxy({ provider: handler.name, error: error.message, duration, passthrough: true });
            logInteraction(traceId, req, null, duration, error.message, handler.name);
            res.status(500).json({ 
                error: 'Passthrough failed', 
                message: error.message,
                provider: handler.name 
            });
        }
    };
}

// Passthrough routes - forward native API formats without transformation
// /passthrough/anthropic/* -> api.anthropic.com (native Anthropic format)
// /passthrough/gemini/* -> generativelanguage.googleapis.com (native Gemini format)
// /passthrough/openai/* -> api.openai.com (native OpenAI format)
proxyApp.all('/passthrough/anthropic/*', (req, res, next) => {
    req.path = req.path.replace('/passthrough/anthropic', '');
    createPassthroughHandler(passthroughHandlers.anthropic)(req, res, next);
});

proxyApp.all('/passthrough/gemini/*', (req, res, next) => {
    req.path = req.path.replace('/passthrough/gemini', '');
    createPassthroughHandler(passthroughHandlers.gemini)(req, res, next);
});

proxyApp.all('/passthrough/openai/*', (req, res, next) => {
    req.path = req.path.replace('/passthrough/openai', '');
    createPassthroughHandler(passthroughHandlers.openai)(req, res, next);
});

// Proxy all API calls - supports multiple providers via path prefix
// /v1/* -> OpenAI (default)
// /ollama/v1/* -> Ollama
// /anthropic/v1/* -> Anthropic (with transformation to/from OpenAI format)
// /groq/v1/* -> Groq
// etc.
proxyApp.all('/*', createProxyHandler());

// Dashboard Server
const dashboardApp = express();
dashboardApp.use(express.json());

// Health check endpoint
dashboardApp.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        service: 'dashboard',
        port: DASHBOARD_PORT,
        traces: db.getTraceCount(),
        uptime: process.uptime()
    });
});

// Provider health check endpoint
dashboardApp.get('/api/health/providers', async (req, res) => {
    const results = {};
    const providers = registry.list();
    
    const checkProvider = async (name, checkFn) => {
        try {
            const start = Date.now();
            const result = await checkFn();
            return { 
                status: result.ok ? 'ok' : 'error', 
                latency_ms: Date.now() - start,
                message: result.message || null
            };
        } catch (err) {
            return { status: 'error', message: err.message };
        }
    };
    
    // Check OpenAI
    if (process.env.OPENAI_API_KEY) {
        results.openai = await checkProvider('openai', () => {
            return new Promise((resolve) => {
                const req = https.request({
                    hostname: 'api.openai.com',
                    path: '/v1/models',
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
                    timeout: 5000
                }, (res) => {
                    resolve({ ok: res.statusCode === 200 });
                });
                req.on('error', (e) => resolve({ ok: false, message: e.message }));
                req.on('timeout', () => { req.destroy(); resolve({ ok: false, message: 'timeout' }); });
                req.end();
            });
        });
    } else {
        results.openai = { status: 'unconfigured', message: 'OPENAI_API_KEY not set' };
    }
    
    // Check Anthropic
    if (process.env.ANTHROPIC_API_KEY) {
        results.anthropic = await checkProvider('anthropic', () => {
            return new Promise((resolve) => {
                const req = https.request({
                    hostname: 'api.anthropic.com',
                    path: '/v1/messages',
                    method: 'POST',
                    headers: { 
                        'x-api-key': process.env.ANTHROPIC_API_KEY,
                        'anthropic-version': '2023-06-01',
                        'Content-Type': 'application/json'
                    },
                    timeout: 5000
                }, (res) => {
                    // 400 means API key is valid but request body invalid (expected)
                    resolve({ ok: res.statusCode === 400 || res.statusCode === 200 });
                });
                req.on('error', (e) => resolve({ ok: false, message: e.message }));
                req.on('timeout', () => { req.destroy(); resolve({ ok: false, message: 'timeout' }); });
                req.write('{}');
                req.end();
            });
        });
    } else {
        results.anthropic = { status: 'unconfigured', message: 'ANTHROPIC_API_KEY not set' };
    }
    
    // Check Gemini
    const geminiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (geminiKey) {
        results.gemini = await checkProvider('gemini', () => {
            return new Promise((resolve) => {
                const req = https.request({
                    hostname: 'generativelanguage.googleapis.com',
                    path: `/v1beta/models?key=${geminiKey}`,
                    method: 'GET',
                    timeout: 5000
                }, (res) => {
                    resolve({ ok: res.statusCode === 200 });
                });
                req.on('error', (e) => resolve({ ok: false, message: e.message }));
                req.on('timeout', () => { req.destroy(); resolve({ ok: false, message: 'timeout' }); });
                req.end();
            });
        });
    } else {
        results.gemini = { status: 'unconfigured', message: 'GOOGLE_API_KEY/GEMINI_API_KEY not set' };
    }
    
    // Check Groq
    if (process.env.GROQ_API_KEY) {
        results.groq = await checkProvider('groq', () => {
            return new Promise((resolve) => {
                const req = https.request({
                    hostname: 'api.groq.com',
                    path: '/openai/v1/models',
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
                    timeout: 5000
                }, (res) => {
                    resolve({ ok: res.statusCode === 200 });
                });
                req.on('error', (e) => resolve({ ok: false, message: e.message }));
                req.on('timeout', () => { req.destroy(); resolve({ ok: false, message: 'timeout' }); });
                req.end();
            });
        });
    } else {
        results.groq = { status: 'unconfigured', message: 'GROQ_API_KEY not set' };
    }
    
    // Check Ollama (local, no API key needed)
    const ollamaHost = process.env.OLLAMA_HOST || 'localhost';
    const ollamaPort = process.env.OLLAMA_PORT || 11434;
    results.ollama = await checkProvider('ollama', () => {
        return new Promise((resolve) => {
            const req = http.request({
                hostname: ollamaHost,
                port: ollamaPort,
                path: '/api/tags',
                method: 'GET',
                timeout: 2000
            }, (res) => {
                resolve({ ok: res.statusCode === 200 });
            });
            req.on('error', () => resolve({ ok: false, message: `not reachable at ${ollamaHost}:${ollamaPort}` }));
            req.on('timeout', () => { req.destroy(); resolve({ ok: false, message: 'timeout' }); });
            req.end();
        });
    });
    
    const okCount = Object.values(results).filter(r => r.status === 'ok').length;
    const totalConfigured = Object.values(results).filter(r => r.status !== 'unconfigured').length;
    
    res.json({
        summary: `${okCount}/${totalConfigured} providers healthy`,
        providers: results
    });
});

// OTLP Export configuration endpoint
dashboardApp.get('/api/export', (req, res) => {
    res.json(getExportConfig());
});

// Flush pending exports
dashboardApp.post('/api/export/flush', async (req, res) => {
    try {
        await flushExports();
        res.json({ success: true, message: 'Export flush completed' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Serve static files
dashboardApp.use(express.static(path.join(__dirname, 'public')));

// API endpoints for dashboard
dashboardApp.get('/api/traces', (req, res) => {
    const start = Date.now();
    try {
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;

        const filters = {};
        if (req.query.model) filters.model = req.query.model;
        if (req.query.status) filters.status = req.query.status;
        if (req.query.q) filters.q = req.query.q;
        if (req.query.date_from) filters.date_from = parseInt(req.query.date_from, 10);
        if (req.query.date_to) filters.date_to = parseInt(req.query.date_to, 10);
        if (req.query.cost_min) filters.cost_min = parseFloat(req.query.cost_min);
        if (req.query.cost_max) filters.cost_max = parseFloat(req.query.cost_max);
        if (req.query.provider) filters.provider = req.query.provider;
        if (req.query.tag) filters.tag = req.query.tag;

        const traces = db.getTraces({ limit, offset, filters });
        log.dashboard('GET', '/api/traces', Date.now() - start);
        res.json(traces);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

dashboardApp.get('/api/traces/:id', (req, res) => {
    const start = Date.now();
    try {
        const { id } = req.params;
        const trace = db.getTraceById(id);
        
        if (!trace) {
            return res.status(404).json({ error: 'Trace not found' });
        }

        log.dashboard('GET', `/api/traces/${id.slice(0, 8)}`, Date.now() - start);
        res.json({
            trace: {
                id: trace.id,
                timestamp: trace.timestamp,
                duration_ms: trace.duration_ms,
                model: trace.model,
                prompt_tokens: trace.prompt_tokens,
                completion_tokens: trace.completion_tokens,
                total_tokens: trace.total_tokens,
                status: trace.status,
                error: trace.error,
                estimated_cost: trace.estimated_cost
            },
            request: {
                method: trace.request_method,
                path: trace.request_path,
                headers: JSON.parse(trace.request_headers || '{}'),
                body: JSON.parse(trace.request_body || '{}')
            },
            response: {
                status: trace.response_status,
                headers: JSON.parse(trace.response_headers || '{}'),
                body: JSON.parse(trace.response_body || '{}')
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

dashboardApp.get('/api/stats', (req, res) => {
    const start = Date.now();
    try {
        const stats = db.getStats();
        log.dashboard('GET', '/api/stats', Date.now() - start);
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

dashboardApp.get('/api/models', (req, res) => {
    try {
        const models = db.getDistinctModels();
        res.json(models);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== Trace Export Endpoint ====================

dashboardApp.get('/api/traces/export', (req, res) => {
    const start = Date.now();
    try {
        const format = req.query.format || 'json';
        const limit = parseInt(req.query.limit) || 1000;
        
        const filters = {};
        if (req.query.model) filters.model = req.query.model;
        if (req.query.status) filters.status = req.query.status;
        if (req.query.date_from) filters.date_from = parseInt(req.query.date_from, 10);
        if (req.query.date_to) filters.date_to = parseInt(req.query.date_to, 10);
        if (req.query.tag) filters.tag = req.query.tag;
        if (req.query.provider) filters.provider = req.query.provider;
        
        const traces = db.getTraces({ limit, offset: 0, filters });
        
        log.dashboard('GET', '/api/traces/export', Date.now() - start);
        
        if (format === 'jsonl') {
            res.setHeader('Content-Type', 'application/x-ndjson');
            res.setHeader('Content-Disposition', 'attachment; filename="traces.jsonl"');
            for (const trace of traces) {
                res.write(JSON.stringify(trace) + '\n');
            }
            res.end();
        } else {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', 'attachment; filename="traces.json"');
            res.json({
                exported_at: new Date().toISOString(),
                count: traces.length,
                filters,
                traces
            });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== Analytics API Endpoints ====================

dashboardApp.get('/api/analytics/token-trends', (req, res) => {
    const start = Date.now();
    try {
        const interval = req.query.interval || 'hour';
        const days = parseInt(req.query.days) || 7;
        
        const trends = db.getTokenTrends({ interval, days });
        log.dashboard('GET', '/api/analytics/token-trends', Date.now() - start);
        res.json({ trends, interval, days });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

dashboardApp.get('/api/analytics/cost-by-tool', (req, res) => {
    const start = Date.now();
    try {
        const days = parseInt(req.query.days) || 30;
        
        const byTool = db.getCostByTool({ days });
        log.dashboard('GET', '/api/analytics/cost-by-tool', Date.now() - start);
        res.json({ by_tool: byTool, days });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

dashboardApp.get('/api/analytics/cost-by-model', (req, res) => {
    const start = Date.now();
    try {
        const days = parseInt(req.query.days) || 30;
        
        const byModel = db.getCostByModel({ days });
        log.dashboard('GET', '/api/analytics/cost-by-model', Date.now() - start);
        res.json({ by_model: byModel, days });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

dashboardApp.get('/api/analytics/daily', (req, res) => {
    const start = Date.now();
    try {
        const days = parseInt(req.query.days) || 30;
        
        const daily = db.getDailyStats({ days });
        log.dashboard('GET', '/api/analytics/daily', Date.now() - start);
        res.json({ daily, days });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== Logs API Endpoints ====================

dashboardApp.get('/api/logs', (req, res) => {
    const start = Date.now();
    try {
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;

        const filters = {};
        if (req.query.service_name) filters.service_name = req.query.service_name;
        if (req.query.event_name) filters.event_name = req.query.event_name;
        if (req.query.trace_id) filters.trace_id = req.query.trace_id;
        if (req.query.severity_min) filters.severity_min = parseInt(req.query.severity_min, 10);
        if (req.query.date_from) filters.date_from = parseInt(req.query.date_from, 10);
        if (req.query.date_to) filters.date_to = parseInt(req.query.date_to, 10);
        if (req.query.q) filters.q = req.query.q;

        const logs = db.getLogs({ limit, offset, filters });
        const total = db.getLogCount(filters);
        log.dashboard('GET', '/api/logs', Date.now() - start);
        res.json({ logs, total });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

dashboardApp.get('/api/logs/filters', (req, res) => {
    try {
        res.json({
            services: db.getDistinctLogServices(),
            event_names: db.getDistinctEventNames()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

dashboardApp.get('/api/logs/:id', (req, res) => {
    const start = Date.now();
    try {
        const { id } = req.params;
        const logRecord = db.getLogById(id);
        
        if (!logRecord) {
            return res.status(404).json({ error: 'Log not found' });
        }

        log.dashboard('GET', `/api/logs/${id.slice(0, 8)}`, Date.now() - start);
        res.json(logRecord);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== Metrics API Endpoints ====================

dashboardApp.get('/api/metrics', (req, res) => {
    const start = Date.now();
    try {
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        const aggregation = req.query.aggregation;

        if (aggregation === 'summary') {
            const filters = {};
            if (req.query.date_from) filters.date_from = parseInt(req.query.date_from, 10);
            if (req.query.date_to) filters.date_to = parseInt(req.query.date_to, 10);
            const summary = db.getMetricsSummary(filters);
            log.dashboard('GET', '/api/metrics?aggregation=summary', Date.now() - start);
            return res.json({ summary });
        }

        const filters = {};
        if (req.query.name) filters.name = req.query.name;
        if (req.query.service_name) filters.service_name = req.query.service_name;
        if (req.query.metric_type) filters.metric_type = req.query.metric_type;
        if (req.query.date_from) filters.date_from = parseInt(req.query.date_from, 10);
        if (req.query.date_to) filters.date_to = parseInt(req.query.date_to, 10);

        const metrics = db.getMetrics({ limit, offset, filters });
        const total = db.getMetricCount(filters);
        log.dashboard('GET', '/api/metrics', Date.now() - start);
        res.json({ metrics, total });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

dashboardApp.get('/api/metrics/tokens', (req, res) => {
    try {
        const usage = db.getTokenUsage();
        res.json({ usage });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

dashboardApp.get('/api/metrics/filters', (req, res) => {
    try {
        res.json({
            names: db.getDistinctMetricNames(),
            services: db.getDistinctMetricServices()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

dashboardApp.get('/api/metrics/:id', (req, res) => {
    const start = Date.now();
    try {
        const { id } = req.params;
        const metric = db.getMetricById(id);
        
        if (!metric) {
            return res.status(404).json({ error: 'Metric not found' });
        }

        log.dashboard('GET', `/api/metrics/${id.slice(0, 8)}`, Date.now() - start);
        res.json(metric);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Span ingest endpoint for SDK
dashboardApp.post('/api/spans', (req, res) => {
    try {
        const {
            id,
            trace_id,
            parent_id,
            span_type,
            span_name,
            start_time,
            end_time,
            duration_ms,
            status,
            error,
            attributes,
            input,
            output,
            tags,
            service_name,
            model,
            provider
        } = req.body;

        const spanId = id || uuidv4();
        const startTime = start_time || Date.now();
        const duration = duration_ms || (end_time ? end_time - startTime : null);

        db.insertTrace({
            id: spanId,
            timestamp: startTime,
            duration_ms: duration,
            provider: provider || null,
            model: model || null,
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0,
            estimated_cost: 0,
            status: status || 200,
            error: error || null,
            request_method: null,
            request_path: null,
            request_headers: {},
            request_body: {},
            response_status: status || 200,
            response_headers: {},
            response_body: {},
            tags: tags || [],
            trace_id: trace_id || spanId,
            parent_id: parent_id || null,
            span_type: span_type || 'custom',
            span_name: span_name || span_type || 'span',
            input: input,
            output: output,
            attributes: attributes || {},
            service_name: service_name || 'app'
        });

        res.status(201).json({ id: spanId, trace_id: trace_id || spanId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// OTLP/HTTP trace ingestion endpoint
// Accepts OTLP/HTTP JSON format for OpenTelemetry/OpenLLMetry integration
dashboardApp.post('/v1/traces', createOtlpHandler());

// OTLP/HTTP logs ingestion endpoint
// Accepts OTLP/HTTP JSON logs from AI CLI tools (Claude Code, Codex CLI, Gemini CLI)
dashboardApp.post('/v1/logs', createLogsHandler());

// OTLP/HTTP metrics ingestion endpoint
// Accepts OTLP/HTTP JSON metrics from AI CLI tools (Claude Code, Gemini CLI)
dashboardApp.post('/v1/metrics', createMetricsHandler());

// Get trace with all spans as a tree
dashboardApp.get('/api/traces/:id/tree', (req, res) => {
    try {
        const { id } = req.params;
        
        const rootSpan = db.getTraceById(id);
        if (!rootSpan) {
            return res.status(404).json({ error: 'Span not found' });
        }

        const traceId = rootSpan.trace_id || rootSpan.id;
        const spans = db.getSpansByTraceId(traceId);

        // Parse JSON fields
        const parsedSpans = spans.map(s => ({
            ...s,
            request_headers: JSON.parse(s.request_headers || '{}'),
            request_body: JSON.parse(s.request_body || '{}'),
            response_headers: JSON.parse(s.response_headers || '{}'),
            response_body: JSON.parse(s.response_body || '{}'),
            input: JSON.parse(s.input || 'null'),
            output: JSON.parse(s.output || 'null'),
            attributes: JSON.parse(s.attributes || '{}'),
            tags: JSON.parse(s.tags || '[]'),
            children: []
        }));

        // Build tree
        const byId = new Map();
        parsedSpans.forEach(s => byId.set(s.id, s));
        const roots = [];

        for (const span of parsedSpans) {
            if (span.parent_id && byId.has(span.parent_id)) {
                byId.get(span.parent_id).children.push(span);
            } else {
                roots.push(span);
            }
        }

        // Aggregate stats
        const totalCost = spans.reduce((acc, s) => acc + (s.estimated_cost || 0), 0);
        const totalTokens = spans.reduce((acc, s) => acc + (s.total_tokens || 0), 0);
        const startTs = Math.min(...spans.map(s => s.timestamp || Infinity));
        const endTs = Math.max(...spans.map(s => (s.timestamp || 0) + (s.duration_ms || 0)));

        res.json({
            trace: {
                trace_id: traceId,
                start_time: startTs,
                end_time: endTs,
                duration_ms: endTs - startTs,
                total_cost: totalCost,
                total_tokens: totalTokens,
                span_count: spans.length
            },
            spans: roots
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Start servers - coordinate startup messages
let proxyReady = false;
let dashboardReady = false;

function printStartupIfReady() {
    if (!proxyReady || !dashboardReady) return;

    // Always show URLs (yellow colored, dashboard first)
    log.startup(`Dashboard: ${log.url(`http://localhost:${DASHBOARD_PORT}`)}`);
    log.startup(`Proxy:     ${log.url(`http://localhost:${PROXY_PORT}`)}`);

    // Verbose only
    log.debug(`Set base_url to http://localhost:${PROXY_PORT}/v1`);
    log.debug(`Database: ${db.DB_PATH}`);
    log.debug(`Traces: ${db.getTraceCount()}, Logs: ${db.getLogCount()}, Metrics: ${db.getMetricCount()}`);
    log.debug(`WebSocket: ws://localhost:${DASHBOARD_PORT}/ws`);

    const exportConfig = getExportConfig();
    if (exportConfig.enabled) {
        log.debug(`OTLP Export: ${exportConfig.endpoints.traces || 'disabled'}`);
    }

    console.log('');
}

proxyApp.listen(PROXY_PORT, () => {
    proxyReady = true;
    printStartupIfReady();
});

// Create HTTP server for dashboard (needed for WebSocket)
const dashboardServer = http.createServer(dashboardApp);

// WebSocket server for real-time updates
const wss = new WebSocket.Server({ server: dashboardServer, path: '/ws' });
const wsClients = new Set();

wss.on('connection', (ws) => {
    wsClients.add(ws);
    log.debug(`WebSocket client connected (${wsClients.size} total)`);

    ws.on('close', () => {
        wsClients.delete(ws);
        log.debug(`WebSocket client disconnected (${wsClients.size} remaining)`);
    });

    ws.on('error', () => {
        wsClients.delete(ws);
    });

    // Send hello message
    ws.send(JSON.stringify({ type: 'hello', time: Date.now() }));
});

function broadcast(messageObj) {
    const data = JSON.stringify(messageObj);
    for (const ws of wsClients) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(data);
        }
    }
}

// Throttle stats updates (max once per second)
let lastStatsUpdate = 0;
const STATS_THROTTLE_MS = 1000;

// Hook into db.insertTrace for real-time updates
db.setInsertTraceHook((spanSummary) => {
    // Broadcast new span
    broadcast({ type: 'new_span', payload: spanSummary });

    // If root span, also broadcast new_trace
    if (!spanSummary.parent_id) {
        broadcast({ type: 'new_trace', payload: spanSummary });
    }

    // Throttled stats update
    const now = Date.now();
    if (now - lastStatsUpdate > STATS_THROTTLE_MS) {
        lastStatsUpdate = now;
        const stats = db.getStats();
        broadcast({ type: 'stats_update', payload: stats });
    }
});

// Hook into db.insertLog for real-time log updates
db.setInsertLogHook((logSummary) => {
    broadcast({ type: 'new_log', payload: logSummary });

    // If log has trace_id, notify trace subscribers
    if (logSummary.trace_id) {
        broadcast({ 
            type: 'trace_log_added', 
            payload: { trace_id: logSummary.trace_id, log: logSummary }
        });
    }
});

// Hook into db.insertMetric for real-time metric updates
db.setInsertMetricHook((metricSummary) => {
    broadcast({ type: 'new_metric', payload: metricSummary });
});

// Initialize OTLP export to external backends
initExportHooks(db);

dashboardServer.listen(DASHBOARD_PORT, () => {
    dashboardReady = true;
    printStartupIfReady();
});
