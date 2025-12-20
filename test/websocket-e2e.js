#!/usr/bin/env node

/**
 * End-to-End Test for WebSocket Real-time Updates
 * 
 * Tests:
 * 1. WebSocket connection to /ws
 * 2. Receiving hello message on connect
 * 3. Receiving new_span when span is inserted
 * 4. Receiving new_trace for root spans
 * 5. Receiving stats_update after insertion
 * 
 * Run: node test/websocket-e2e.js
 * Requires: LLMFlow server running on localhost:3000
 */

const WebSocket = require('ws');
const http = require('http');

const LLMFLOW_URL = process.env.LLMFLOW_URL || 'http://localhost:3000';
const WS_URL = LLMFLOW_URL.replace('http', 'ws') + '/ws';

const c = {
    reset: '\x1b[0m',
    dim: '\x1b[2m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
};

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`  ${c.green}✓${c.reset} ${message}`);
        passed++;
    } else {
        console.log(`  ${c.red}✗${c.reset} ${message}`);
        failed++;
    }
}

function generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

function httpRequest(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(LLMFLOW_URL);
        const options = {
            hostname: url.hostname,
            port: url.port || 3000,
            path,
            method,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({
                        status: res.statusCode,
                        data: JSON.parse(data)
                    });
                } catch {
                    resolve({ status: res.statusCode, data });
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

function waitForMessages(ws, count, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const messages = [];
        const timer = setTimeout(() => {
            resolve(messages);
        }, timeout);

        const handler = (data) => {
            try {
                const msg = JSON.parse(data.toString());
                messages.push(msg);
                if (messages.length >= count) {
                    clearTimeout(timer);
                    ws.off('message', handler);
                    resolve(messages);
                }
            } catch (e) {
                // Ignore parse errors
            }
        };

        ws.on('message', handler);
    });
}

async function testWebSocketConnection() {
    console.log(`\n${c.cyan}Test 1: WebSocket Connection${c.reset}`);
    
    return new Promise((resolve) => {
        const ws = new WebSocket(WS_URL);
        let connected = false;
        let helloReceived = false;

        ws.on('open', () => {
            connected = true;
        });

        ws.on('message', (data) => {
            try {
                const msg = JSON.parse(data.toString());
                if (msg.type === 'hello') {
                    helloReceived = true;
                    assert(typeof msg.time === 'number', 'Hello message has timestamp');
                }
            } catch (e) {
                // Ignore
            }
        });

        ws.on('error', (err) => {
            assert(false, `WebSocket connection failed: ${err.message}`);
            resolve(null);
        });

        setTimeout(() => {
            assert(connected, 'WebSocket connects successfully');
            assert(helloReceived, 'Received hello message');
            resolve(ws);
        }, 500);
    });
}

async function testNewSpanBroadcast(ws) {
    console.log(`\n${c.cyan}Test 2: New Span Broadcast${c.reset}`);

    const spanId = generateId();
    const traceId = generateId();

    // Start listening for messages (new_span, new_trace, and possibly stats_update)
    // stats_update is throttled to 1s, so we may or may not receive it
    const messagesPromise = waitForMessages(ws, 2, 2000);

    // Insert a span via API
    const span = {
        id: spanId,
        trace_id: traceId,
        parent_id: null,
        span_type: 'llm',
        span_name: 'ws-test-span',
        start_time: Date.now(),
        duration_ms: 100,
        status: 200,
        model: 'gpt-4o-mini',
        total_tokens: 500,
        estimated_cost: 0.001,
        service_name: 'ws-test'
    };

    await httpRequest('POST', '/api/spans', span);

    // Wait for messages
    const messages = await messagesPromise;

    const newSpanMsg = messages.find(m => m.type === 'new_span' && m.payload?.id === spanId);
    const newTraceMsg = messages.find(m => m.type === 'new_trace' && m.payload?.id === spanId);
    const statsMsg = messages.find(m => m.type === 'stats_update');

    assert(newSpanMsg !== undefined, 'Received new_span message');
    assert(newSpanMsg?.payload?.span_name === 'ws-test-span', 'new_span has correct span_name');
    assert(newSpanMsg?.payload?.model === 'gpt-4o-mini', 'new_span has correct model');
    assert(newTraceMsg !== undefined, 'Received new_trace for root span');
    
    // stats_update is throttled (1s), so it may not always be received in quick succession
    if (statsMsg) {
        assert(typeof statsMsg?.payload?.total_requests === 'number', 'stats_update has total_requests');
    } else {
        console.log(`  ${c.dim}○ stats_update throttled (expected)${c.reset}`);
    }

    return { spanId, traceId };
}

async function testChildSpanBroadcast(ws, parentTraceId) {
    console.log(`\n${c.cyan}Test 3: Child Span (no new_trace)${c.reset}`);

    const spanId = generateId();

    // Start listening
    const messagesPromise = waitForMessages(ws, 2, 3000);

    // Insert a child span
    const span = {
        id: spanId,
        trace_id: parentTraceId,
        parent_id: generateId(), // Has a parent
        span_type: 'tool',
        span_name: 'ws-child-span',
        start_time: Date.now(),
        duration_ms: 50,
        status: 200,
        service_name: 'ws-test'
    };

    await httpRequest('POST', '/api/spans', span);

    const messages = await messagesPromise;

    const newSpanMsg = messages.find(m => m.type === 'new_span' && m.payload?.id === spanId);
    const newTraceMsg = messages.find(m => m.type === 'new_trace' && m.payload?.id === spanId);

    assert(newSpanMsg !== undefined, 'Received new_span for child');
    assert(newSpanMsg?.payload?.span_type === 'tool', 'Child span has correct type');
    assert(newTraceMsg === undefined, 'No new_trace for child span (has parent)');
}

async function testMultipleClients() {
    console.log(`\n${c.cyan}Test 4: Multiple WebSocket Clients${c.reset}`);

    const ws1 = new WebSocket(WS_URL);
    const ws2 = new WebSocket(WS_URL);

    await new Promise(resolve => {
        let ready = 0;
        ws1.on('open', () => { ready++; if (ready === 2) resolve(); });
        ws2.on('open', () => { ready++; if (ready === 2) resolve(); });
    });

    // Clear hello messages
    await new Promise(resolve => setTimeout(resolve, 300));

    const spanId = generateId();
    
    const promise1 = waitForMessages(ws1, 1, 2000);
    const promise2 = waitForMessages(ws2, 1, 2000);

    await httpRequest('POST', '/api/spans', {
        id: spanId,
        trace_id: generateId(),
        span_type: 'llm',
        span_name: 'multi-client-test',
        start_time: Date.now(),
        duration_ms: 10,
        status: 200,
        service_name: 'ws-test'
    });

    const [msgs1, msgs2] = await Promise.all([promise1, promise2]);

    const received1 = msgs1.find(m => m.type === 'new_span' && m.payload?.id === spanId);
    const received2 = msgs2.find(m => m.type === 'new_span' && m.payload?.id === spanId);

    assert(received1 !== undefined, 'Client 1 received new_span');
    assert(received2 !== undefined, 'Client 2 received new_span');

    ws1.close();
    ws2.close();
}

async function testReconnection() {
    console.log(`\n${c.cyan}Test 5: Reconnection${c.reset}`);

    const ws = new WebSocket(WS_URL);

    await new Promise((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
    });

    ws.close();

    // Wait for close
    await new Promise(resolve => setTimeout(resolve, 100));

    // Reconnect
    const ws2 = new WebSocket(WS_URL);
    
    let reconnected = false;
    let helloReceived = false;

    await new Promise((resolve) => {
        ws2.on('open', () => { reconnected = true; });
        ws2.on('message', (data) => {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'hello') helloReceived = true;
        });
        setTimeout(resolve, 500);
    });

    assert(reconnected, 'Reconnection successful');
    assert(helloReceived, 'Received hello on reconnect');

    ws2.close();
}

async function runTests() {
    console.log(`${c.cyan}WebSocket E2E Test Suite${c.reset}`);
    console.log(`${c.dim}Server: ${LLMFLOW_URL}${c.reset}`);
    console.log(`${c.dim}WebSocket: ${WS_URL}${c.reset}`);

    try {
        const ws = await testWebSocketConnection();
        if (!ws) {
            console.log(`\n${c.red}Cannot proceed without WebSocket connection${c.reset}`);
            process.exit(1);
        }

        const { traceId } = await testNewSpanBroadcast(ws);
        await testChildSpanBroadcast(ws, traceId);
        
        ws.close();

        await testMultipleClients();
        await testReconnection();

    } catch (err) {
        console.error(`${c.red}Test error: ${err.message}${c.reset}`);
        failed++;
    }

    console.log(`\n${c.cyan}Summary${c.reset}`);
    console.log(`${c.green}Passed: ${passed}${c.reset}`);
    if (failed > 0) {
        console.log(`${c.red}Failed: ${failed}${c.reset}`);
        process.exit(1);
    }
}

runTests();
