#!/usr/bin/env node

/**
 * End-to-End Test for Session Correlation
 *
 * Tests the full flow:
 * 1. Send three separate OTLP traces tagged with the same session.id
 * 2. Verify /api/sessions lists the session with correct trace count
 * 3. Verify /api/sessions/:id returns the three traces
 *
 * Run: node test/run-tests.js sessions-e2e.js
 * Requires: LLMFlow server running on localhost:3000
 */

const assert = require('node:assert');
const http = require('http');

const BASE = process.env.LLMFLOW_URL || 'http://127.0.0.1:3000';

const c = {
    reset: '\x1b[0m',
    dim: '\x1b[2m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
};

function httpRequest(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(BASE);
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
                    resolve({
                        status: res.statusCode,
                        data: data
                    });
                }
            });
        });

        req.on('error', reject);

        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

function generateHexId(length = 32) {
    let result = '';
    const chars = '0123456789abcdef';
    for (let i = 0; i < length; i++) {
        result += chars[Math.floor(Math.random() * 16)];
    }
    return result;
}

async function postSpan(sessionId, name) {
    const span = {
        resourceSpans: [{
            resource: { attributes: [] },
            scopeSpans: [{
                spans: [{
                    traceId: generateHexId(32),
                    spanId: generateHexId(16),
                    name,
                    startTimeUnixNano: String(Date.now() * 1_000_000),
                    endTimeUnixNano: String((Date.now() + 100) * 1_000_000),
                    attributes: [{ key: 'session.id', value: { stringValue: sessionId } }],
                    status: { code: 1 }
                }]
            }]
        }]
    };
    const r = await httpRequest('POST', '/v1/traces', span);
    assert.strictEqual(r.status, 200, 'OTLP ingest returned 200');
}

async function run() {
    const sessionId = 'e2e-' + Math.random().toString(36).slice(2);

    console.log(`${c.cyan}Session Correlation E2E Test${c.reset}`);
    console.log(`${c.dim}Session ID: ${sessionId}${c.reset}\n`);

    try {
        // Ingest three spans (three separate traces) tagged with the same session
        console.log(`${c.yellow}Posting three traces with session.id...${c.reset}`);
        await postSpan(sessionId, 'turn-1');
        console.log(`${c.green}✓${c.reset} Posted turn-1`);

        await postSpan(sessionId, 'turn-2');
        console.log(`${c.green}✓${c.reset} Posted turn-2`);

        await postSpan(sessionId, 'turn-3');
        console.log(`${c.green}✓${c.reset} Posted turn-3`);

        // Sessions list should include it
        console.log(`\n${c.yellow}Verifying /api/sessions...${c.reset}`);
        const listResult = await httpRequest('GET', '/api/sessions?limit=100');
        assert.strictEqual(listResult.status, 200, 'Sessions list returned 200');

        const list = listResult.data;
        const found = list.sessions.find(s => s.session_id === sessionId);
        assert.ok(found, `session ${sessionId} not found in /api/sessions`);
        console.log(`${c.green}✓${c.reset} Session found in list`);

        assert.strictEqual(found.trace_count, 3, `expected 3 traces, got ${found.trace_count}`);
        console.log(`${c.green}✓${c.reset} Session has correct trace count (3)`);

        // Session detail should return three traces
        console.log(`\n${c.yellow}Verifying /api/sessions/:id...${c.reset}`);
        const detailResult = await httpRequest('GET', `/api/sessions/${sessionId}`);
        assert.strictEqual(detailResult.status, 200, 'Session detail returned 200');

        const detail = detailResult.data;
        assert.ok(Array.isArray(detail.traces), 'Session detail has traces array');
        assert.strictEqual(detail.traces.length, 3, `expected 3 traces, got ${detail.traces.length}`);
        console.log(`${c.green}✓${c.reset} Session detail returned all 3 traces`);

        // Verify traces have required fields
        for (const trace of detail.traces) {
            assert.ok(trace.trace_id, `Trace missing trace_id`);
            assert.ok(trace.started_at !== undefined, `Trace missing started_at`);
        }
        console.log(`${c.green}✓${c.reset} All traces have required fields`);

        console.log(`\n${c.green}✓ session correlation e2e passed${c.reset}`);
        process.exit(0);

    } catch (err) {
        console.log(`\n${c.red}✗ Test failed: ${err.message}${c.reset}`);
        process.exit(1);
    }
}

run().catch(err => {
    console.error(`${c.red}Error: ${err.message}${c.reset}`);
    process.exit(1);
});
