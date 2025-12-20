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
const { registry } = require('./providers');

const PROXY_PORT = process.env.PROXY_PORT || 8080;
const DASHBOARD_PORT = process.env.DASHBOARD_PORT || 3000;

// Log request/response to database
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
            tags: [],
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
        usage: {
            default: 'Use /v1/* for OpenAI (default provider)',
            custom: 'Use /{provider}/v1/* for other providers (e.g., /ollama/v1/chat/completions)',
            header: 'Or set X-LLMFlow-Provider header to override'
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

                    let fullContent = '';
                    let finalUsage = null;
                    let chunkCount = 0;

                    upstreamRes.on('data', (chunk) => {
                        const text = chunk.toString('utf8');
                        chunkCount++;
                        
                        res.write(chunk);

                        // Parse chunks through provider
                        const parsed = provider.parseStreamChunk(text);
                        if (parsed.content) fullContent += parsed.content;
                        if (parsed.usage) finalUsage = parsed.usage;
                    });

                    upstreamRes.on('end', () => {
                        const duration = Date.now() - startTime;
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
                            usage: finalUsage,
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

// Proxy all API calls - supports multiple providers via path prefix
// /v1/* -> OpenAI (default)
// /ollama/v1/* -> Ollama
// /anthropic/v1/* -> Anthropic
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

// Start servers
proxyApp.listen(PROXY_PORT, () => {
    log.startup(`Proxy running on http://localhost:${PROXY_PORT}`);
    log.info(`Set base_url to http://localhost:${PROXY_PORT}/v1`);
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

dashboardServer.listen(DASHBOARD_PORT, () => {
    log.startup(`Dashboard running on http://localhost:${DASHBOARD_PORT}`);
    log.info(`Database: ${db.DB_PATH}`);
    log.info(`Traces: ${db.getTraceCount()}, Logs: ${db.getLogCount()}`);
    log.info(`WebSocket: ws://localhost:${DASHBOARD_PORT}/ws`);
    if (log.isVerbose()) {
        log.info('Verbose logging enabled');
    }
    console.log('');
});
