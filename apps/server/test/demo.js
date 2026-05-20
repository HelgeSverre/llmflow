#!/usr/bin/env node

/**
 * LLMFlow Demo Script
 * 
 * Generates traced LLM-like traffic to test the dashboard.
 * Shows hierarchical spans: trace -> agent -> retrieval + llm
 * 
 * Usage:
 *   node demo.js              # 5 traces with multiple spans
 *   node demo.js --count=20   # 20 traces
 */

const http = require('http');

// Colors
const c = {
    reset: '\x1b[0m',
    dim: '\x1b[2m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m',
    blue: '\x1b[34m',
};

const LLMFLOW_URL = process.env.LLMFLOW_URL || 'http://localhost:3000';
const args = process.argv.slice(2);
const TRACE_COUNT = parseInt(args.find(a => a.startsWith('--count='))?.split('=')[1] || '5');

function generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Simulated workflow scenarios
const SCENARIOS = [
    {
        name: 'RAG Query',
        steps: [
            { type: 'retrieval', name: 'vector_search', input: { query: 'How do I configure SSL?' } },
            { type: 'llm', name: 'generate_answer', model: 'gpt-4o-mini' },
        ]
    },
    {
        name: 'Agent Task',
        steps: [
            { type: 'tool', name: 'search_web', input: { query: 'latest news' } },
            { type: 'llm', name: 'summarize', model: 'gpt-3.5-turbo' },
            { type: 'tool', name: 'send_email', input: { to: 'user@example.com' } },
        ]
    },
    {
        name: 'Code Review',
        steps: [
            { type: 'retrieval', name: 'fetch_pr_diff', input: { pr: 1234 } },
            { type: 'llm', name: 'analyze_code', model: 'gpt-4o' },
            { type: 'llm', name: 'generate_feedback', model: 'gpt-4o' },
        ]
    },
    {
        name: 'Chatbot Response',
        steps: [
            { type: 'retrieval', name: 'get_context', input: { user_id: 'u123' } },
            { type: 'llm', name: 'chat_completion', model: 'gpt-4o-mini' },
        ]
    },
    {
        name: 'Document Processing',
        steps: [
            { type: 'embedding', name: 'embed_document', model: 'text-embedding-3-small' },
            { type: 'retrieval', name: 'find_similar', input: { top_k: 5 } },
            { type: 'llm', name: 'extract_entities', model: 'gpt-3.5-turbo' },
        ]
    },
];

const MOCK_OUTPUTS = {
    retrieval: { documents: ['doc1', 'doc2'], scores: [0.95, 0.87] },
    llm: { content: 'This is the generated response based on the context provided.' },
    tool: { success: true, result: 'Action completed successfully' },
    embedding: { dimensions: 1536, vectors: 1 },
};

async function sendSpan(span) {
    return new Promise((resolve, reject) => {
        const url = new URL(`${LLMFLOW_URL}/api/spans`);
        const postData = JSON.stringify(span);
        
        const req = http.request({
            hostname: url.hostname,
            port: url.port || 3000,
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 400) {
                    reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                } else {
                    resolve(JSON.parse(data));
                }
            });
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

async function runScenario(scenario, index) {
    const traceId = generateId();
    const traceName = scenario.name;
    
    console.log(`${c.dim}[${index}]${c.reset} ${c.cyan}${traceName}${c.reset}`);
    
    // Create root trace span
    const traceStart = Date.now();
    const traceSpanId = generateId();
    
    const childSpans = [];
    
    for (const step of scenario.steps) {
        const spanId = generateId();
        const startTime = Date.now();
        const duration = randomInt(50, 500);
        
        await sleep(duration);
        
        const span = {
            id: spanId,
            trace_id: traceId,
            parent_id: traceSpanId,
            span_type: step.type,
            span_name: step.name,
            start_time: startTime,
            duration_ms: duration,
            status: Math.random() > 0.95 ? 500 : 200,
            input: step.input || { prompt: 'Sample input' },
            output: MOCK_OUTPUTS[step.type] || { result: 'ok' },
            model: step.model || null,
            attributes: step.model ? { model: step.model, provider: 'openai' } : {},
            service_name: 'demo'
        };
        
        childSpans.push(span);
        
        const typeColor = {
            llm: c.green,
            retrieval: c.blue,
            tool: c.yellow,
            embedding: c.magenta,
        }[step.type] || c.dim;
        
        console.log(`  ${typeColor}${step.type.padEnd(10)}${c.reset} ${step.name.padEnd(20)} ${c.dim}${duration}ms${c.reset}`);
    }
    
    const traceEnd = Date.now();
    
    // Send root span first
    await sendSpan({
        id: traceSpanId,
        trace_id: traceId,
        parent_id: null,
        span_type: 'trace',
        span_name: traceName,
        start_time: traceStart,
        duration_ms: traceEnd - traceStart,
        status: 200,
        input: { scenario: traceName },
        output: { spans: scenario.steps.length },
        service_name: 'demo'
    });
    
    // Send child spans
    for (const span of childSpans) {
        await sendSpan(span);
    }
    
    return childSpans.length + 1;
}

async function runDemo() {
    console.log(`${c.cyan}LLMFlow Demo${c.reset}`);
    console.log(`${c.dim}Server: ${LLMFLOW_URL}${c.reset}`);
    console.log(`${c.dim}Traces: ${TRACE_COUNT}${c.reset}\n`);

    let totalSpans = 0;
    const startTime = Date.now();

    for (let i = 0; i < TRACE_COUNT; i++) {
        const scenario = SCENARIOS[i % SCENARIOS.length];
        try {
            const spans = await runScenario(scenario, i + 1);
            totalSpans += spans;
        } catch (error) {
            console.log(`  ${c.red}Error: ${error.message}${c.reset}`);
        }
        await sleep(randomInt(100, 300));
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log(`\n${c.cyan}Summary${c.reset}`);
    console.log(`${c.dim}Traces: ${TRACE_COUNT}${c.reset}`);
    console.log(`${c.dim}Spans: ${totalSpans}${c.reset}`);
    console.log(`${c.dim}Time: ${elapsed}s${c.reset}`);
    console.log(`\n${c.dim}Dashboard: ${LLMFLOW_URL}${c.reset}`);
}

runDemo().catch(err => {
    console.error(`${c.red}Fatal: ${err.message}${c.reset}`);
    process.exit(1);
});
