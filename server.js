const express = require('express');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const https = require('https');

const PROXY_PORT = process.env.PROXY_PORT || 8080;
const DASHBOARD_PORT = process.env.DASHBOARD_PORT || 3000;
const DATA_FILE = 'llmflow-data.json';

// Initialize or load data
let data = { traces: [] };
if (fs.existsSync(DATA_FILE)) {
    try {
        data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (err) {
        console.error('Failed to load data file, starting fresh');
    }
}

// Save data to file
function saveData() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Failed to save data:', err);
    }
}

// Calculate estimated cost based on token usage (OpenAI pricing)
function calculateCost(model, promptTokens, completionTokens) {
    const pricing = {
        'gpt-3.5-turbo': { input: 0.0015, output: 0.002 }, // per 1K tokens
        'gpt-4': { input: 0.03, output: 0.06 },
        'gpt-4-turbo': { input: 0.01, output: 0.03 }
    };

    const modelPricing = pricing[model] || pricing['gpt-3.5-turbo'];
    return ((promptTokens * modelPricing.input) + (completionTokens * modelPricing.output)) / 1000;
}

// Log request/response to data
function logInteraction(traceId, req, responseData, duration, error = null) {
    try {
        const timestamp = Date.now();
        const usage = responseData?.usage || {};
        const model = req.body?.model || 'unknown';
        
        const promptTokens = usage.prompt_tokens || 0;
        const completionTokens = usage.completion_tokens || 0;
        const totalTokens = usage.total_tokens || promptTokens + completionTokens;
        const estimatedCost = calculateCost(model, promptTokens, completionTokens);

        const trace = {
            id: traceId,
            timestamp,
            duration_ms: duration,
            model,
            prompt_tokens: promptTokens,
            completion_tokens: completionTokens,
            total_tokens: totalTokens,
            status: responseData?.status || (error ? 500 : 200),
            error: error,
            estimated_cost: estimatedCost,
            request: {
                method: req.method,
                path: req.path,
                headers: req.headers,
                body: req.body
            },
            response: {
                status: responseData?.status || (error ? 500 : 200),
                headers: responseData?.headers || {},
                body: responseData?.data || { error }
            }
        };

        data.traces.unshift(trace); // Add to beginning
        
        // Keep only last 1000 traces
        if (data.traces.length > 1000) {
            data.traces = data.traces.slice(0, 1000);
        }

        saveData();

        console.log(`Logged interaction ${traceId}: ${model}, ${totalTokens} tokens, $${estimatedCost.toFixed(6)}`);
    } catch (err) {
        console.error('Failed to log interaction:', err);
    }
}

// Proxy Server
const proxyApp = express();
proxyApp.use(express.json());

// CORS headers for development
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
    const traceId = uuidv4();
    const startTime = Date.now();

    try {
        console.log(`Proxying ${req.method} ${req.path} [${traceId}]`);

        // Forward request to OpenAI using https
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

                // Log interaction
                logInteraction(traceId, req, {
                    status: proxyRes.statusCode,
                    headers: proxyRes.headers,
                    data: responseData,
                    usage: responseData.usage
                }, duration);

                // Return response to client
                res.status(proxyRes.statusCode).json(responseData);
            });
        });

        proxyReq.on('error', (error) => {
            throw error;
        });

        if (postData) {
            proxyReq.write(postData);
        }
        proxyReq.end();

    } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`Proxy error [${traceId}]:`, error.message);
        
        // Log error
        logInteraction(traceId, req, null, duration, error.message);
        
        res.status(500).json({ error: 'Proxy request failed', message: error.message });
    }
});

// Dashboard Server
const dashboardApp = express();

// Serve static files
dashboardApp.use(express.static(path.join(__dirname, 'public')));

// API endpoints for dashboard
dashboardApp.get('/api/traces', (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;

        const traces = data.traces.slice(offset, offset + limit);
        res.json(traces);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

dashboardApp.get('/api/traces/:id', (req, res) => {
    try {
        const { id } = req.params;
        const trace = data.traces.find(t => t.id === id);
        
        if (!trace) {
            return res.status(404).json({ error: 'Trace not found' });
        }

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
            request: trace.request,
            response: trace.response
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

dashboardApp.get('/api/stats', (req, res) => {
    try {
        const stats = data.traces.reduce((acc, trace) => {
            acc.total_requests++;
            acc.total_tokens += trace.total_tokens || 0;
            acc.total_cost += trace.estimated_cost || 0;
            acc.total_duration += trace.duration_ms || 0;
            if (trace.status >= 400) acc.error_count++;

            // Model stats
            if (!acc.models[trace.model]) {
                acc.models[trace.model] = { count: 0, tokens: 0, cost: 0 };
            }
            acc.models[trace.model].count++;
            acc.models[trace.model].tokens += trace.total_tokens || 0;
            acc.models[trace.model].cost += trace.estimated_cost || 0;

            return acc;
        }, {
            total_requests: 0,
            total_tokens: 0,
            total_cost: 0,
            total_duration: 0,
            error_count: 0,
            models: {}
        });

        // Calculate average duration
        stats.avg_duration = stats.total_requests > 0 
            ? stats.total_duration / stats.total_requests 
            : 0;

        // Convert models object to array
        stats.models = Object.entries(stats.models).map(([model, data]) => ({
            model,
            ...data
        })).sort((a, b) => b.count - a.count);

        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Start servers
proxyApp.listen(PROXY_PORT, () => {
    console.log(`🔄 LLMFlow Proxy running on http://localhost:${PROXY_PORT}`);
    console.log(`   Change your OpenAI base_url to: http://localhost:${PROXY_PORT}/v1`);
});

dashboardApp.listen(DASHBOARD_PORT, () => {
    console.log(`📊 LLMFlow Dashboard running on http://localhost:${DASHBOARD_PORT}`);
    console.log(`   View your LLM interactions at: http://localhost:${DASHBOARD_PORT}`);
});

process.on('SIGINT', () => {
    saveData();
    process.exit(0);
});