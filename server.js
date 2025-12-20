const express = require('express');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const https = require('https');
const db = require('./db');
const { calculateCost } = require('./pricing');
const log = require('./logger');

const PROXY_PORT = process.env.PROXY_PORT || 8080;
const DASHBOARD_PORT = process.env.DASHBOARD_PORT || 3000;

// Log request/response to database
function logInteraction(traceId, req, responseData, duration, error = null) {
    try {
        const timestamp = Date.now();
        const usage = responseData?.usage || {};
        const model = req.body?.model || 'unknown';
        const provider = 'openai';
        
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
        uptime: process.uptime()
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

// Proxy all OpenAI API calls
proxyApp.all('/v1/*', async (req, res) => {
    const startTime = Date.now();
    const traceId = req.headers['x-trace-id'] || uuidv4();
    const isStreamingRequest = req.body && req.body.stream === true;

    log.request(req.method, req.path, traceId);
    log.debug(`Model: ${req.body?.model || 'N/A'}, Messages: ${req.body?.messages?.length || 0}, Stream: ${isStreamingRequest}`);

    try {
        const postData = req.method !== 'GET' ? JSON.stringify(req.body) : '';
        
        const options = {
            hostname: 'api.openai.com',
            path: req.path,
            method: req.method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': req.headers.authorization,
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const proxyReq = https.request(options, (proxyRes) => {
            if (!isStreamingRequest) {
                // Non-streaming: buffer entire response
                let responseBody = '';

                proxyRes.on('data', (chunk) => {
                    responseBody += chunk;
                });

                proxyRes.on('end', () => {
                    const duration = Date.now() - startTime;
                    let responseData;
                    
                    try {
                        responseData = JSON.parse(responseBody);
                    } catch (e) {
                        responseData = { error: 'Invalid JSON response', body: responseBody };
                    }

                    const tokens = responseData.usage?.total_tokens || 0;
                    const cost = calculateCost(req.body?.model || 'unknown', responseData.usage?.prompt_tokens || 0, responseData.usage?.completion_tokens || 0);

                    log.proxy({
                        model: responseData.model || req.body?.model,
                        tokens,
                        cost,
                        duration,
                        streaming: false
                    });

                    logInteraction(traceId, req, {
                        status: proxyRes.statusCode,
                        headers: proxyRes.headers,
                        data: responseData,
                        usage: responseData.usage
                    }, duration);

                    res.status(proxyRes.statusCode).json(responseData);
                });
            } else {
                // Streaming: forward chunks while buffering for logging
                res.status(proxyRes.statusCode);
                Object.entries(proxyRes.headers).forEach(([key, value]) => {
                    res.setHeader(key, value);
                });

                let fullContent = '';
                let finalUsage = null;
                let chunkCount = 0;

                proxyRes.on('data', (chunk) => {
                    const text = chunk.toString('utf8');
                    chunkCount++;
                    
                    res.write(chunk);

                    const lines = text.split('\n');
                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed.startsWith('data:')) continue;
                        
                        const payload = trimmed.slice(5).trim();
                        if (payload === '[DONE]') continue;
                        
                        try {
                            const json = JSON.parse(payload);
                            const delta = json.choices?.[0]?.delta?.content;
                            if (delta) fullContent += delta;
                            if (json.usage) finalUsage = json.usage;
                        } catch {
                            // Ignore parse errors
                        }
                    }
                });

                proxyRes.on('end', () => {
                    const duration = Date.now() - startTime;
                    const tokens = finalUsage?.total_tokens || 0;
                    const cost = calculateCost(req.body?.model || 'unknown', finalUsage?.prompt_tokens || 0, finalUsage?.completion_tokens || 0);

                    log.proxy({
                        model: req.body?.model,
                        tokens,
                        cost,
                        duration,
                        streaming: true
                    });

                    log.debug(`Chunks: ${chunkCount}, Content: ${fullContent.length} chars`);

                    const assembledResponse = {
                        id: traceId,
                        object: 'chat.completion',
                        model: req.body?.model,
                        choices: [{
                            message: { role: 'assistant', content: fullContent },
                            finish_reason: 'stop'
                        }],
                        usage: finalUsage,
                        _streaming: true,
                        _chunks: chunkCount
                    };

                    logInteraction(traceId, req, {
                        status: proxyRes.statusCode,
                        headers: proxyRes.headers,
                        data: assembledResponse,
                        usage: finalUsage
                    }, duration);

                    res.end();
                });
            }
        });

        proxyReq.on('error', (error) => {
            const duration = Date.now() - startTime;
            log.proxy({ error: error.message, duration });
            logInteraction(traceId, req, null, duration, error.message);
            res.status(500).json({ error: 'Proxy request failed', message: error.message });
        });

        if (postData) {
            proxyReq.write(postData);
        }
        proxyReq.end();

    } catch (error) {
        const duration = Date.now() - startTime;
        log.proxy({ error: error.message, duration });
        logInteraction(traceId, req, null, duration, error.message);
        res.status(500).json({ error: 'Proxy request failed', message: error.message });
    }
});

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

dashboardApp.listen(DASHBOARD_PORT, () => {
    log.startup(`Dashboard running on http://localhost:${DASHBOARD_PORT}`);
    log.info(`Database: ${db.DB_PATH}`);
    log.info(`Traces: ${db.getTraceCount()}`);
    if (log.isVerbose()) {
        log.info('Verbose logging enabled');
    }
    console.log('');
});
