#!/usr/bin/env node

/**
 * End-to-End Test for OTLP Metrics Integration
 * 
 * Tests the full flow:
 * 1. Send OTLP/HTTP JSON metrics (simulating Claude Code, Gemini CLI)
 * 2. Verify metrics are stored correctly
 * 3. Verify dashboard API returns correct data
 * 4. Test aggregation and filtering
 * 
 * Run: node test/otlp-metrics-e2e.js
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
 * Create OTLP/HTTP JSON metrics payload
 * Simulates what Claude Code or Gemini CLI would send
 */
function createOtlpMetricsPayload(serviceName, metrics) {
    const now = Date.now();
    return {
        resourceMetrics: [
            {
                resource: {
                    attributes: [
                        { key: 'service.name', value: { stringValue: serviceName } },
                        { key: 'service.version', value: { stringValue: '1.0.0' } }
                    ]
                },
                scopeMetrics: [
                    {
                        scope: {
                            name: serviceName + '.metrics',
                            version: '1.0.0'
                        },
                        metrics: metrics
                    }
                ]
            }
        ]
    };
}

function createSumMetric(name, value, attributes = []) {
    const now = Date.now();
    return {
        name,
        description: `Test metric: ${name}`,
        unit: 'tokens',
        sum: {
            dataPoints: [
                {
                    timeUnixNano: String(now * 1000000),
                    asInt: String(value),
                    attributes
                }
            ],
            aggregationTemporality: 2,
            isMonotonic: true
        }
    };
}

function createGaugeMetric(name, value, attributes = []) {
    const now = Date.now();
    return {
        name,
        description: `Test gauge: ${name}`,
        unit: 'count',
        gauge: {
            dataPoints: [
                {
                    timeUnixNano: String(now * 1000000),
                    asDouble: value,
                    attributes
                }
            ]
        }
    };
}

function createHistogramMetric(name, count, sum, attributes = []) {
    const now = Date.now();
    return {
        name,
        description: `Test histogram: ${name}`,
        unit: 'ms',
        histogram: {
            dataPoints: [
                {
                    timeUnixNano: String(now * 1000000),
                    count: String(count),
                    sum: sum,
                    bucketCounts: ['5', '10', '15', '10', '5'],
                    explicitBounds: [10, 50, 100, 500],
                    min: 5,
                    max: 800,
                    attributes
                }
            ],
            aggregationTemporality: 2
        }
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
    console.log(`${c.cyan}OTLP Metrics E2E Test Suite${c.reset}`);
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

    // Test 2: Send Sum (Counter) metric
    console.log(`\n${c.yellow}Test 2: Sum (Counter) Metric Ingestion${c.reset}`);
    const sumPayload = createOtlpMetricsPayload('claude-code', [
        createSumMetric('claude_code.token.usage', 1500, [
            { key: 'type', value: { stringValue: 'input' } },
            { key: 'model', value: { stringValue: 'claude-sonnet-4-20250514' } }
        ])
    ]);

    const sumResult = await httpRequest('POST', '/v1/metrics', sumPayload);
    assert(sumResult.status === 200, 'OTLP metrics endpoint returns 200');
    assert(!sumResult.data.partialSuccess, 'No partial success (all metrics accepted)');

    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify metric was stored
    const metricsResult = await httpRequest('GET', '/api/metrics?limit=5');
    assert(metricsResult.status === 200, 'Metrics API returns 200');
    assert(Array.isArray(metricsResult.data.metrics), 'Metrics response contains metrics array');
    
    const foundSum = metricsResult.data.metrics.find(m => m.name === 'claude_code.token.usage');
    assert(foundSum !== undefined, 'Token usage metric found');
    assert(foundSum?.metric_type === 'sum', 'Metric type is sum');
    assert(foundSum?.value_int === 1500, 'Value is correct');
    assert(foundSum?.service_name === 'claude-code', 'Service name extracted');

    // Test 3: Send Gauge metric
    console.log(`\n${c.yellow}Test 3: Gauge Metric Ingestion${c.reset}`);
    const gaugePayload = createOtlpMetricsPayload('gemini-cli', [
        createGaugeMetric('gemini_cli.session.active', 3.5, [
            { key: 'instance', value: { stringValue: 'main' } }
        ])
    ]);

    const gaugeResult = await httpRequest('POST', '/v1/metrics', gaugePayload);
    assert(gaugeResult.status === 200, 'Gauge metric accepted');

    await new Promise(resolve => setTimeout(resolve, 100));

    const gaugeCheck = await httpRequest('GET', '/api/metrics?service_name=gemini-cli');
    const foundGauge = gaugeCheck.data.metrics?.find(m => m.name === 'gemini_cli.session.active');
    assert(foundGauge !== undefined, 'Gauge metric found');
    assert(foundGauge?.metric_type === 'gauge', 'Metric type is gauge');
    assert(foundGauge?.value_double === 3.5, 'Double value correct');

    // Test 4: Send Histogram metric
    console.log(`\n${c.yellow}Test 4: Histogram Metric Ingestion${c.reset}`);
    const histPayload = createOtlpMetricsPayload('claude-code', [
        createHistogramMetric('claude_code.api.latency', 45, 2250.5, [
            { key: 'endpoint', value: { stringValue: '/v1/messages' } }
        ])
    ]);

    const histResult = await httpRequest('POST', '/v1/metrics', histPayload);
    assert(histResult.status === 200, 'Histogram metric accepted');

    await new Promise(resolve => setTimeout(resolve, 100));

    const histCheck = await httpRequest('GET', '/api/metrics?name=claude_code.api.latency');
    const foundHist = histCheck.data.metrics?.find(m => m.name === 'claude_code.api.latency');
    assert(foundHist !== undefined, 'Histogram metric found');
    assert(foundHist?.metric_type === 'histogram', 'Metric type is histogram');
    assert(foundHist?.value_int === 45, 'Count stored as value_int');

    // Test 5: Metric by ID retrieval
    console.log(`\n${c.yellow}Test 5: Metric Retrieval by ID${c.reset}`);
    const allMetrics = await httpRequest('GET', '/api/metrics?limit=1');
    if (allMetrics.data.metrics?.length > 0) {
        const metricId = allMetrics.data.metrics[0].id;
        const singleMetric = await httpRequest('GET', `/api/metrics/${metricId}`);
        assert(singleMetric.status === 200, 'Single metric retrieval returns 200');
        assert(singleMetric.data.id === metricId, 'Correct metric returned');
        assert(typeof singleMetric.data.attributes === 'object', 'Attributes parsed as object');
    } else {
        assert(false, 'No metrics to test retrieval');
    }

    // Test 6: Metrics summary aggregation
    console.log(`\n${c.yellow}Test 6: Metrics Summary Aggregation${c.reset}`);
    const summary = await httpRequest('GET', '/api/metrics?aggregation=summary');
    assert(summary.status === 200, 'Summary returns 200');
    assert(Array.isArray(summary.data.summary), 'Summary is an array');
    
    const tokenSummary = summary.data.summary?.find(s => s.name === 'claude_code.token.usage');
    assert(tokenSummary !== undefined, 'Token usage in summary');
    assert(tokenSummary?.data_points >= 1, 'Has at least 1 data point');

    // Test 7: Filter by service
    console.log(`\n${c.yellow}Test 7: Service Filter${c.reset}`);
    const serviceFilter = await httpRequest('GET', '/api/metrics?service_name=claude-code');
    assert(serviceFilter.status === 200, 'Service filter returns 200');
    const allClaudeCode = serviceFilter.data.metrics?.every(m => m.service_name === 'claude-code');
    assert(allClaudeCode || serviceFilter.data.metrics?.length === 0, 'All metrics match service filter');

    // Test 8: Filter by type
    console.log(`\n${c.yellow}Test 8: Type Filter${c.reset}`);
    const typeFilter = await httpRequest('GET', '/api/metrics?metric_type=sum');
    assert(typeFilter.status === 200, 'Type filter returns 200');
    const allSums = typeFilter.data.metrics?.every(m => m.metric_type === 'sum');
    assert(allSums || typeFilter.data.metrics?.length === 0, 'All metrics match type filter');

    // Test 9: Get filter options
    console.log(`\n${c.yellow}Test 9: Filter Options${c.reset}`);
    const filters = await httpRequest('GET', '/api/metrics/filters');
    assert(filters.status === 200, 'Filters endpoint returns 200');
    assert(Array.isArray(filters.data.names), 'Metric names list available');
    assert(Array.isArray(filters.data.services), 'Services list available');

    // Test 10: Token usage endpoint
    console.log(`\n${c.yellow}Test 10: Token Usage Endpoint${c.reset}`);
    const tokenUsage = await httpRequest('GET', '/api/metrics/tokens');
    assert(tokenUsage.status === 200, 'Token usage returns 200');
    assert(Array.isArray(tokenUsage.data.usage), 'Usage is an array');

    // Test 11: Error handling
    console.log(`\n${c.yellow}Test 11: Error Handling${c.reset}`);
    
    const emptyPayload = {};
    const emptyResult = await httpRequest('POST', '/v1/metrics', emptyPayload);
    assert(emptyResult.status === 200, 'Empty payload returns 200 (no metrics to process)');

    const notFoundResult = await httpRequest('GET', '/api/metrics/nonexistent-id');
    assert(notFoundResult.status === 404, 'Non-existent metric returns 404');

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
