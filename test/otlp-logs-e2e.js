#!/usr/bin/env node

/**
 * End-to-End Test for OTLP Logs Integration
 * 
 * Tests the full flow:
 * 1. Send OTLP/HTTP JSON logs (simulating Claude Code, Codex CLI, Gemini CLI)
 * 2. Verify logs are stored correctly
 * 3. Verify dashboard API returns correct data
 * 4. Test filtering and search
 * 
 * Run: node test/otlp-logs-e2e.js
 * Requires: LLMFlow server running on localhost:3000
 */

const http = require('http');

const LLMFLOW_URL = process.env.LLMFLOW_URL || 'http://localhost:3000';

const c = {
    reset: '\x1b[0m',
    dim: '\x1b[2m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
};

function generateHexId(length = 32) {
    let result = '';
    const chars = '0123456789abcdef';
    for (let i = 0; i < length; i++) {
        result += chars[Math.floor(Math.random() * 16)];
    }
    return result;
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

/**
 * Create OTLP/HTTP JSON logs payload
 * Simulates what Claude Code, Codex CLI, or Gemini CLI would send
 */
function createOtlpLogsPayload(serviceName, logs) {
    const now = Date.now();
    return {
        resourceLogs: [
            {
                resource: {
                    attributes: [
                        { key: 'service.name', value: { stringValue: serviceName } },
                        { key: 'service.version', value: { stringValue: '1.0.0' } }
                    ]
                },
                scopeLogs: [
                    {
                        scope: {
                            name: serviceName,
                            version: '1.0.0'
                        },
                        logRecords: logs.map(log => ({
                            timeUnixNano: String((log.timestamp || now) * 1000000),
                            observedTimeUnixNano: String((log.observedTimestamp || now) * 1000000),
                            severityNumber: log.severityNumber || 9,
                            severityText: log.severityText || 'INFO',
                            body: { stringValue: log.body },
                            attributes: log.attributes || [],
                            traceId: log.traceId || '',
                            spanId: log.spanId || ''
                        }))
                    }
                ]
            }
        ]
    };
}

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

async function runTests() {
    console.log(`${c.cyan}OTLP Logs E2E Test Suite${c.reset}`);
    console.log(`${c.dim}Server: ${LLMFLOW_URL}${c.reset}\n`);

    // Test 1: Health check
    console.log(`${c.yellow}Test 1: Health Check${c.reset}`);
    try {
        const health = await httpRequest('GET', '/api/health');
        assert(health.status === 200, 'Health endpoint returns 200');
        assert(health.data.status === 'ok', 'Health status is ok');
    } catch (err) {
        assert(false, `Health check failed: ${err.message}`);
        console.log(`\n${c.red}Server not running. Start with: npm start${c.reset}\n`);
        process.exit(1);
    }

    const now = Date.now();

    // Test 2: Send simple log
    console.log(`\n${c.yellow}Test 2: Simple Log Ingestion${c.reset}`);
    const simplePayload = createOtlpLogsPayload('test-service', [
        {
            body: 'Test log message',
            severityNumber: 9,
            severityText: 'INFO',
            attributes: [
                { key: 'event.name', value: { stringValue: 'test.simple_log' } }
            ]
        }
    ]);

    const simpleResult = await httpRequest('POST', '/v1/logs', simplePayload);
    assert(simpleResult.status === 200, 'OTLP logs endpoint returns 200');
    assert(!simpleResult.data.partialSuccess, 'No partial success (all logs accepted)');

    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify log was stored
    const logsResult = await httpRequest('GET', '/api/logs?limit=5');
    assert(logsResult.status === 200, 'Logs API returns 200');
    assert(Array.isArray(logsResult.data.logs), 'Logs response contains logs array');
    
    const foundLog = logsResult.data.logs.find(l => l.body === 'Test log message');
    assert(foundLog !== undefined, 'Test log found in results');
    assert(foundLog?.event_name === 'test.simple_log', 'Event name extracted correctly');
    assert(foundLog?.service_name === 'test-service', 'Service name extracted correctly');

    // Test 3: Claude Code style log
    console.log(`\n${c.yellow}Test 3: Claude Code Style Logs${c.reset}`);
    const traceId = generateHexId(32);
    const spanId = generateHexId(16);
    
    const claudePayload = createOtlpLogsPayload('claude-code', [
        {
            body: 'User prompt: Write a function to sort an array',
            severityNumber: 9,
            severityText: 'INFO',
            traceId,
            spanId,
            attributes: [
                { key: 'event.name', value: { stringValue: 'claude_code.user_prompt' } },
                { key: 'session_id', value: { stringValue: 'session-123' } },
                { key: 'model', value: { stringValue: 'claude-sonnet-4-20250514' } }
            ]
        },
        {
            body: 'Tool result: file_edit completed successfully',
            severityNumber: 9,
            severityText: 'INFO',
            traceId,
            attributes: [
                { key: 'event.name', value: { stringValue: 'claude_code.tool_result' } },
                { key: 'tool_name', value: { stringValue: 'file_edit' } },
                { key: 'success', value: { boolValue: true } }
            ]
        }
    ]);

    const claudeResult = await httpRequest('POST', '/v1/logs', claudePayload);
    assert(claudeResult.status === 200, 'Claude Code logs accepted');

    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify claude logs
    const claudeLogs = await httpRequest('GET', '/api/logs?service_name=claude-code&limit=10');
    assert(claudeLogs.status === 200, 'Claude logs filter works');
    const promptLog = claudeLogs.data.logs.find(l => l.event_name === 'claude_code.user_prompt');
    assert(promptLog !== undefined, 'User prompt log found');
    assert(promptLog?.trace_id === traceId.toLowerCase(), 'Trace ID preserved');

    // Test 4: Codex CLI style log  
    console.log(`\n${c.yellow}Test 4: Codex CLI Style Logs${c.reset}`);
    const codexPayload = createOtlpLogsPayload('codex-cli', [
        {
            body: 'Run started',
            severityNumber: 9,
            severityText: 'INFO',
            attributes: [
                { key: 'event.name', value: { stringValue: 'codex.run_started' } },
                { key: 'call_id', value: { stringValue: 'call-456' } }
            ]
        },
        {
            body: 'Tool decision: approve_all for shell command',
            severityNumber: 13, 
            severityText: 'WARN',
            attributes: [
                { key: 'event.name', value: { stringValue: 'codex.tool_decision' } },
                { key: 'decision', value: { stringValue: 'approve_all' } },
                { key: 'tool_name', value: { stringValue: 'shell' } }
            ]
        }
    ]);

    const codexResult = await httpRequest('POST', '/v1/logs', codexPayload);
    assert(codexResult.status === 200, 'Codex CLI logs accepted');

    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify codex logs
    const codexLogs = await httpRequest('GET', '/api/logs?service_name=codex-cli&limit=10');
    assert(codexLogs.status === 200, 'Codex logs filter works');
    const decisionLog = codexLogs.data.logs.find(l => l.event_name === 'codex.tool_decision');
    assert(decisionLog !== undefined, 'Tool decision log found');
    assert(decisionLog?.severity_text === 'WARN', 'Severity preserved');

    // Test 5: Log by ID retrieval
    console.log(`\n${c.yellow}Test 5: Log Retrieval by ID${c.reset}`);
    const allLogs = await httpRequest('GET', '/api/logs?limit=1');
    if (allLogs.data.logs.length > 0) {
        const logId = allLogs.data.logs[0].id;
        const singleLog = await httpRequest('GET', `/api/logs/${logId}`);
        assert(singleLog.status === 200, 'Single log retrieval returns 200');
        assert(singleLog.data.id === logId, 'Correct log returned');
        assert(typeof singleLog.data.attributes === 'object', 'Attributes parsed as object');
    } else {
        assert(false, 'No logs to test retrieval');
    }

    // Test 6: Event name filter
    console.log(`\n${c.yellow}Test 6: Event Name Filter${c.reset}`);
    const eventFilter = await httpRequest('GET', '/api/logs?event_name=claude_code.user_prompt');
    assert(eventFilter.status === 200, 'Event name filter returns 200');
    const allMatchEvent = eventFilter.data.logs.every(l => l.event_name === 'claude_code.user_prompt');
    assert(allMatchEvent || eventFilter.data.logs.length === 0, 'All logs match event filter');

    // Test 7: Get available filters
    console.log(`\n${c.yellow}Test 7: Filter Options${c.reset}`);
    const filters = await httpRequest('GET', '/api/logs/filters');
    assert(filters.status === 200, 'Filters endpoint returns 200');
    assert(Array.isArray(filters.data.services), 'Services list available');
    assert(Array.isArray(filters.data.event_names), 'Event names list available');

    // Test 8: Error handling
    console.log(`\n${c.yellow}Test 8: Error Handling${c.reset}`);
    
    const emptyPayload = {};
    const emptyResult = await httpRequest('POST', '/v1/logs', emptyPayload);
    assert(emptyResult.status === 200, 'Empty payload returns 200 (no logs to process)');

    const notFoundResult = await httpRequest('GET', '/api/logs/nonexistent-id');
    assert(notFoundResult.status === 404, 'Non-existent log returns 404');

    // Test 9: Log count in response
    console.log(`\n${c.yellow}Test 9: Pagination${c.reset}`);
    const paginated = await httpRequest('GET', '/api/logs?limit=2&offset=0');
    assert(paginated.status === 200, 'Paginated request returns 200');
    assert(paginated.data.logs.length <= 2, 'Respects limit');
    assert(typeof paginated.data.total === 'number', 'Total count included');

    // Summary
    console.log(`\n${c.cyan}Summary${c.reset}`);
    console.log(`${c.green}Passed: ${passed}${c.reset}`);
    if (failed > 0) {
        console.log(`${c.red}Failed: ${failed}${c.reset}`);
    }
    console.log('');

    process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
    console.error(`${c.red}Test error: ${err.message}${c.reset}`);
    process.exit(1);
});
