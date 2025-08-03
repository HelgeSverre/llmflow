const express = require('express');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const https = require('https');

const PROXY_PORT = process.env.PROXY_PORT || 8080;
const DASHBOARD_PORT = process.env.DASHBOARD_PORT || 3000;
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'llmflow-data.json');

// Initialize or load data
let data = { traces: [] };
console.log(`📁 Data file location: ${DATA_FILE}`);
if (fs.existsSync(DATA_FILE)) {
    try {
        const fileContent = fs.readFileSync(DATA_FILE, 'utf8');
        data = JSON.parse(fileContent);
        console.log(`✅ Loaded ${data.traces.length} existing traces from data file`);
    } catch (err) {
        console.error('❌ Failed to load data file, starting fresh:', err.message);
    }
} else {
    console.log('📝 No existing data file found, will create on first save');
}

// Save data to file
function saveData() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
        console.log(`💾 Saved ${data.traces.length} traces to ${DATA_FILE}`);
    } catch (err) {
        console.error('❌ Failed to save data:', err);
        console.error('   File path:', DATA_FILE);
        console.error('   Error details:', err.message);
    }
}

// Logging middleware factory
function createLoggingMiddleware(appName) {
    return (req, res, next) => {
        const startTime = Date.now();
        const traceId = req.headers['x-trace-id'] || uuidv4();
        req.traceId = traceId;
        
        console.log(`\n📍 [${appName}] ${new Date().toISOString()} [${traceId}]`);
        console.log(`   ${req.method} ${req.path}`);
        console.log(`   From: ${req.ip || req.connection.remoteAddress}`);
        
        // Log response when finished
        const originalSend = res.send;
        res.send = function(data) {
            res.send = originalSend;
            const duration = Date.now() - startTime;
            console.log(`   Response: ${res.statusCode} in ${duration}ms`);
            return res.send(data);
        };
        
        next();
    };
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
    } catch (err) {
        console.error('Failed to log interaction:', err);
    }
}

// Proxy Server
const proxyApp = express();
proxyApp.use(express.json());
proxyApp.use(createLoggingMiddleware('PROXY'));

// Health check endpoint
proxyApp.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        service: 'proxy',
        port: PROXY_PORT,
        traces: data.traces.length,
        uptime: process.uptime()
    });
});

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
    const startTime = Date.now();
    const traceId = req.traceId; // Use traceId from middleware

    console.log(`\n🔵 OpenAI API Call Details:`);
    console.log(`   Model: ${req.body?.model || 'N/A'}`);
    console.log(`   Messages: ${req.body?.messages?.length || 0}`);

    try {

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

                // Log response details
                console.log(`\n✅ [${new Date().toISOString()}] Response received [${traceId}]`);
                console.log(`   Status: ${proxyRes.statusCode}`);
                console.log(`   Duration: ${duration}ms`);
                console.log(`   Model: ${responseData.model || req.body?.model || 'N/A'}`);
                console.log(`   Tokens: ${responseData.usage?.total_tokens || 0} (prompt: ${responseData.usage?.prompt_tokens || 0}, completion: ${responseData.usage?.completion_tokens || 0})`);
                console.log(`   Cost: $${calculateCost(req.body?.model || 'unknown', responseData.usage?.prompt_tokens || 0, responseData.usage?.completion_tokens || 0).toFixed(6)}`);

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
        
        console.log(`\n❌ [${new Date().toISOString()}] Request failed [${traceId}]`);
        console.log(`   Error: ${error.message}`);
        console.log(`   Duration: ${duration}ms`);
        console.log(`   Path: ${req.path}`);
        
        // Log error
        logInteraction(traceId, req, null, duration, error.message);
        
        res.status(500).json({ error: 'Proxy request failed', message: error.message });
    }
});

// Dashboard Server
const dashboardApp = express();
dashboardApp.use(express.json());
dashboardApp.use(createLoggingMiddleware('DASHBOARD'));

// Health check endpoint
dashboardApp.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        service: 'dashboard',
        port: DASHBOARD_PORT,
        traces: data.traces.length,
        uptime: process.uptime()
    });
});

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
    console.log(`\n🚀 LLMFlow Started Successfully!`);
    console.log(`🔄 Proxy running on http://localhost:${PROXY_PORT}`);
    console.log(`   Change your OpenAI base_url to: http://localhost:${PROXY_PORT}/v1`);
    console.log(`   Health check: http://localhost:${PROXY_PORT}/health`);
});

dashboardApp.listen(DASHBOARD_PORT, () => {
    console.log(`📊 Dashboard running on http://localhost:${DASHBOARD_PORT}`);
    console.log(`   View your LLM interactions at: http://localhost:${DASHBOARD_PORT}`);
    console.log(`   API health check: http://localhost:${DASHBOARD_PORT}/api/health`);
    console.log(`\n📁 Data file: ${DATA_FILE}`);
    console.log(`📝 Currently tracking ${data.traces.length} traces\n`);
});

process.on('SIGINT', () => {
    saveData();
    process.exit(0);
});