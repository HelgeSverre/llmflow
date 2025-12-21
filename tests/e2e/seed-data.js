/**
 * E2E Test Seed Data
 * 
 * Creates deterministic test data for all tabs and filters.
 * Data is designed to exercise all filter combinations and analytics.
 */

const { v4: uuidv4 } = require('uuid');

// Timestamps relative to now for consistent date filtering
const NOW = Date.now();
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// Known IDs for assertions
const TRACE_IDS = {
    SEARCH_HIT: 'trace-e2e-search-hit',
    OLD_TRACE: 'trace-e2e-old-trace',
    MODEL_A_1: 'trace-e2e-model-a-1',
    MODEL_A_2: 'trace-e2e-model-a-2',
    MODEL_B_1: 'trace-e2e-model-b-1',
    ERROR_TRACE: 'trace-e2e-error',
    TIMELINE_HIT: 'trace-e2e-timeline-hit',
    PROXY_TOOL: 'trace-e2e-proxy-tool',
    AIDER_TOOL: 'trace-e2e-aider-tool',
};

const LOG_IDS = {
    MATCH_1: 'log-e2e-match-1',
    MATCH_2: 'log-e2e-match-2',
    ERROR_LOG: 'log-e2e-error',
    WARN_LOG: 'log-e2e-warn',
    DEBUG_LOG: 'log-e2e-debug',
    SVC_A: 'log-e2e-svc-a',
    SVC_B: 'log-e2e-svc-b',
    EVENT_FOO: 'log-e2e-event-foo',
    EVENT_BAR: 'log-e2e-event-bar',
};

const METRIC_IDS = {
    REQUESTS_TOTAL: 'metric-e2e-requests-total',
    LATENCY_MS: 'metric-e2e-latency-ms',
    TOKEN_USAGE: 'metric-e2e-token-usage',
    SVC_B_GAUGE: 'metric-e2e-svc-b-gauge',
    HISTOGRAM: 'metric-e2e-histogram',
};

/**
 * Seed the database with test data
 */
function seedDatabase(db) {
    // ==================== TRACES ====================
    
    // Trace for search filter test
    db.insertTrace({
        id: TRACE_IDS.SEARCH_HIT,
        timestamp: NOW - 30 * 60 * 1000, // 30 min ago
        duration_ms: 1234,
        provider: 'openai',
        model: 'gpt-e2e-search-hit',
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150,
        estimated_cost: 0.0015,
        status: 200,
        error: null,
        request_method: 'POST',
        request_path: '/v1/chat/completions',
        request_headers: JSON.stringify({ 'content-type': 'application/json' }),
        request_body: JSON.stringify({ model: 'gpt-e2e-search-hit', messages: [{ role: 'user', content: 'Hello' }] }),
        response_status: 200,
        response_headers: JSON.stringify({}),
        response_body: JSON.stringify({ choices: [{ message: { content: 'Hi!' } }] }),
        tags: JSON.stringify(['e2e-test']),
        trace_id: TRACE_IDS.SEARCH_HIT,
        parent_id: null,
        span_type: 'llm',
        span_name: 'E2E Search Target',
        input: 'Hello',
        output: 'Hi!',
        attributes: JSON.stringify({}),
        service_name: 'e2e-test-service',
    });

    // Old trace (> 7 days) for date filter test
    db.insertTrace({
        id: TRACE_IDS.OLD_TRACE,
        timestamp: NOW - 10 * DAY, // 10 days ago
        duration_ms: 500,
        provider: 'anthropic',
        model: 'claude-e2e-old',
        prompt_tokens: 200,
        completion_tokens: 100,
        total_tokens: 300,
        estimated_cost: 0.003,
        status: 200,
        error: null,
        request_method: 'POST',
        request_path: '/v1/chat/completions',
        request_headers: JSON.stringify({}),
        request_body: JSON.stringify({}),
        response_status: 200,
        response_headers: JSON.stringify({}),
        response_body: JSON.stringify({}),
        tags: JSON.stringify([]),
        trace_id: TRACE_IDS.OLD_TRACE,
        parent_id: null,
        span_type: 'llm',
        span_name: 'old-trace',
        input: null,
        output: null,
        attributes: JSON.stringify({}),
        service_name: 'old-service',
    });

    // Model A traces (for model filter)
    db.insertTrace({
        id: TRACE_IDS.MODEL_A_1,
        timestamp: NOW - 2 * HOUR,
        duration_ms: 800,
        provider: 'openai',
        model: 'gpt-e2e-model-a',
        prompt_tokens: 500,
        completion_tokens: 200,
        total_tokens: 700,
        estimated_cost: 0.007,
        status: 200,
        error: null,
        request_method: 'POST',
        request_path: '/v1/chat/completions',
        request_headers: JSON.stringify({}),
        request_body: JSON.stringify({ model: 'gpt-e2e-model-a' }),
        response_status: 200,
        response_headers: JSON.stringify({}),
        response_body: JSON.stringify({}),
        tags: JSON.stringify([]),
        trace_id: TRACE_IDS.MODEL_A_1,
        parent_id: null,
        span_type: 'llm',
        span_name: 'Model A Request 1',
        input: null,
        output: null,
        attributes: JSON.stringify({}),
        service_name: 'svc-e2e-a',
    });

    db.insertTrace({
        id: TRACE_IDS.MODEL_A_2,
        timestamp: NOW - 3 * HOUR,
        duration_ms: 600,
        provider: 'openai',
        model: 'gpt-e2e-model-a',
        prompt_tokens: 300,
        completion_tokens: 150,
        total_tokens: 450,
        estimated_cost: 0.0045,
        status: 200,
        error: null,
        request_method: 'POST',
        request_path: '/v1/chat/completions',
        request_headers: JSON.stringify({}),
        request_body: JSON.stringify({ model: 'gpt-e2e-model-a' }),
        response_status: 200,
        response_headers: JSON.stringify({}),
        response_body: JSON.stringify({}),
        tags: JSON.stringify([]),
        trace_id: TRACE_IDS.MODEL_A_2,
        parent_id: null,
        span_type: 'llm',
        span_name: 'Model A Request 2',
        input: null,
        output: null,
        attributes: JSON.stringify({}),
        service_name: 'svc-e2e-a',
    });

    // Model B trace
    db.insertTrace({
        id: TRACE_IDS.MODEL_B_1,
        timestamp: NOW - 1 * HOUR,
        duration_ms: 1500,
        provider: 'anthropic',
        model: 'gpt-e2e-model-b',
        prompt_tokens: 1000,
        completion_tokens: 500,
        total_tokens: 1500,
        estimated_cost: 0.015,
        status: 200,
        error: null,
        request_method: 'POST',
        request_path: '/v1/chat/completions',
        request_headers: JSON.stringify({}),
        request_body: JSON.stringify({ model: 'gpt-e2e-model-b' }),
        response_status: 200,
        response_headers: JSON.stringify({}),
        response_body: JSON.stringify({}),
        tags: JSON.stringify([]),
        trace_id: TRACE_IDS.MODEL_B_1,
        parent_id: null,
        span_type: 'llm',
        span_name: 'Model B Request',
        input: null,
        output: null,
        attributes: JSON.stringify({}),
        service_name: 'svc-e2e-b',
    });

    // Error trace
    db.insertTrace({
        id: TRACE_IDS.ERROR_TRACE,
        timestamp: NOW - 4 * HOUR,
        duration_ms: 200,
        provider: 'openai',
        model: 'gpt-e2e-model-a',
        prompt_tokens: 50,
        completion_tokens: 0,
        total_tokens: 50,
        estimated_cost: 0.0005,
        status: 500,
        error: 'Rate limit exceeded',
        request_method: 'POST',
        request_path: '/v1/chat/completions',
        request_headers: JSON.stringify({}),
        request_body: JSON.stringify({}),
        response_status: 500,
        response_headers: JSON.stringify({}),
        response_body: JSON.stringify({ error: { message: 'Rate limit exceeded' } }),
        tags: JSON.stringify([]),
        trace_id: TRACE_IDS.ERROR_TRACE,
        parent_id: null,
        span_type: 'llm',
        span_name: 'Failed Request',
        input: null,
        output: null,
        attributes: JSON.stringify({}),
        service_name: 'svc-e2e-a',
    });

    // Timeline search hit
    db.insertTrace({
        id: TRACE_IDS.TIMELINE_HIT,
        timestamp: NOW - 15 * 60 * 1000, // 15 min ago
        duration_ms: 900,
        provider: 'openai',
        model: 'gpt-4',
        prompt_tokens: 250,
        completion_tokens: 125,
        total_tokens: 375,
        estimated_cost: 0.00375,
        status: 200,
        error: null,
        request_method: 'POST',
        request_path: '/v1/chat/completions',
        request_headers: JSON.stringify({}),
        request_body: JSON.stringify({}),
        response_status: 200,
        response_headers: JSON.stringify({}),
        response_body: JSON.stringify({}),
        tags: JSON.stringify([]),
        trace_id: TRACE_IDS.TIMELINE_HIT,
        parent_id: null,
        span_type: 'llm',
        span_name: 'Timeline E2E Hit',
        input: null,
        output: null,
        attributes: JSON.stringify({}),
        service_name: 'timeline-test',
    });

    // Proxy tool trace
    db.insertTrace({
        id: TRACE_IDS.PROXY_TOOL,
        timestamp: NOW - 45 * 60 * 1000,
        duration_ms: 700,
        provider: 'proxy',
        model: 'gpt-4',
        prompt_tokens: 150,
        completion_tokens: 75,
        total_tokens: 225,
        estimated_cost: 0.00225,
        status: 200,
        error: null,
        request_method: 'POST',
        request_path: '/v1/chat/completions',
        request_headers: JSON.stringify({}),
        request_body: JSON.stringify({}),
        response_status: 200,
        response_headers: JSON.stringify({}),
        response_body: JSON.stringify({}),
        tags: JSON.stringify([]),
        trace_id: TRACE_IDS.PROXY_TOOL,
        parent_id: null,
        span_type: 'llm',
        span_name: 'Proxy Request',
        input: null,
        output: null,
        attributes: JSON.stringify({}),
        service_name: 'proxy',
    });

    // Aider tool trace
    db.insertTrace({
        id: TRACE_IDS.AIDER_TOOL,
        timestamp: NOW - 50 * 60 * 1000,
        duration_ms: 2000,
        provider: 'openai',
        model: 'gpt-4',
        prompt_tokens: 800,
        completion_tokens: 400,
        total_tokens: 1200,
        estimated_cost: 0.012,
        status: 200,
        error: null,
        request_method: 'POST',
        request_path: '/v1/chat/completions',
        request_headers: JSON.stringify({ 'user-agent': 'aider/0.1.0' }),
        request_body: JSON.stringify({}),
        response_status: 200,
        response_headers: JSON.stringify({}),
        response_body: JSON.stringify({}),
        tags: JSON.stringify([]),
        trace_id: TRACE_IDS.AIDER_TOOL,
        parent_id: null,
        span_type: 'llm',
        span_name: 'Aider Request',
        input: null,
        output: null,
        attributes: JSON.stringify({}),
        service_name: 'aider',
    });

    // Add some traces from different days for analytics
    for (let i = 1; i <= 5; i++) {
        db.insertTrace({
            id: `trace-e2e-day-${i}`,
            timestamp: NOW - i * DAY - HOUR,
            duration_ms: 500 + i * 100,
            provider: i % 2 === 0 ? 'openai' : 'anthropic',
            model: i % 2 === 0 ? 'gpt-e2e-model-a' : 'gpt-e2e-model-b',
            prompt_tokens: 100 * i,
            completion_tokens: 50 * i,
            total_tokens: 150 * i,
            estimated_cost: 0.001 * i,
            status: 200,
            error: null,
            request_method: 'POST',
            request_path: '/v1/chat/completions',
            request_headers: JSON.stringify({}),
            request_body: JSON.stringify({}),
            response_status: 200,
            response_headers: JSON.stringify({}),
            response_body: JSON.stringify({}),
            tags: JSON.stringify([]),
            trace_id: `trace-e2e-day-${i}`,
            parent_id: null,
            span_type: 'llm',
            span_name: `Day ${i} trace`,
            input: null,
            output: null,
            attributes: JSON.stringify({}),
            service_name: i % 2 === 0 ? 'svc-e2e-a' : 'svc-e2e-b',
        });
    }

    // ==================== LOGS ====================
    
    // Searchable logs
    db.insertLog({
        id: LOG_IDS.MATCH_1,
        timestamp: NOW - 20 * 60 * 1000,
        observed_timestamp: NOW - 20 * 60 * 1000,
        severity_number: 9,
        severity_text: 'INFO',
        body: 'E2E_LOG_MATCH_1 - This is a test log entry',
        trace_id: TRACE_IDS.SEARCH_HIT,
        span_id: 'span-1',
        event_name: 'e2e-event-foo',
        service_name: 'svc-e2e-a',
        scope_name: 'test-scope',
        attributes: JSON.stringify({ key: 'value1' }),
        resource_attributes: JSON.stringify({ host: 'test-host' }),
    });

    db.insertLog({
        id: LOG_IDS.MATCH_2,
        timestamp: NOW - 25 * 60 * 1000,
        observed_timestamp: NOW - 25 * 60 * 1000,
        severity_number: 9,
        severity_text: 'INFO',
        body: 'E2E_LOG_MATCH_2 - Another searchable entry',
        trace_id: TRACE_IDS.MODEL_A_1,
        span_id: 'span-2',
        event_name: 'e2e-event-bar',
        service_name: 'svc-e2e-b',
        scope_name: 'test-scope',
        attributes: JSON.stringify({ key: 'value2' }),
        resource_attributes: JSON.stringify({ host: 'test-host-2' }),
    });

    // Error log
    db.insertLog({
        id: LOG_IDS.ERROR_LOG,
        timestamp: NOW - 10 * 60 * 1000,
        observed_timestamp: NOW - 10 * 60 * 1000,
        severity_number: 17,
        severity_text: 'ERROR',
        body: 'E2E Error log - Something went wrong',
        trace_id: TRACE_IDS.ERROR_TRACE,
        span_id: 'span-err',
        event_name: 'e2e-event-foo',
        service_name: 'svc-e2e-a',
        scope_name: 'error-scope',
        attributes: JSON.stringify({ error_code: 500 }),
        resource_attributes: JSON.stringify({}),
    });

    // Warning log
    db.insertLog({
        id: LOG_IDS.WARN_LOG,
        timestamp: NOW - 15 * 60 * 1000,
        observed_timestamp: NOW - 15 * 60 * 1000,
        severity_number: 13,
        severity_text: 'WARN',
        body: 'E2E Warning log - Potential issue',
        trace_id: null,
        span_id: null,
        event_name: 'e2e-event-bar',
        service_name: 'svc-e2e-a',
        scope_name: 'warn-scope',
        attributes: JSON.stringify({}),
        resource_attributes: JSON.stringify({}),
    });

    // Debug log
    db.insertLog({
        id: LOG_IDS.DEBUG_LOG,
        timestamp: NOW - 5 * 60 * 1000,
        observed_timestamp: NOW - 5 * 60 * 1000,
        severity_number: 5,
        severity_text: 'DEBUG',
        body: 'E2E Debug log - Detailed info',
        trace_id: null,
        span_id: null,
        event_name: 'e2e-event-foo',
        service_name: 'svc-e2e-b',
        scope_name: 'debug-scope',
        attributes: JSON.stringify({ debug: true }),
        resource_attributes: JSON.stringify({}),
    });

    // ==================== METRICS ====================
    
    // Counter metric
    db.insertMetric({
        id: METRIC_IDS.REQUESTS_TOTAL,
        timestamp: NOW - 5 * 60 * 1000,
        name: 'e2e_requests_total',
        description: 'Total number of requests',
        unit: '1',
        metric_type: 'sum',
        value_int: 1234,
        value_double: null,
        histogram_data: null,
        service_name: 'svc-e2e-a',
        scope_name: 'metrics-scope',
        attributes: JSON.stringify({ endpoint: '/api/test' }),
        resource_attributes: JSON.stringify({ host: 'test-host' }),
    });

    // Gauge metric
    db.insertMetric({
        id: METRIC_IDS.LATENCY_MS,
        timestamp: NOW - 10 * 60 * 1000,
        name: 'e2e_latency_ms',
        description: 'Request latency in milliseconds',
        unit: 'ms',
        metric_type: 'gauge',
        value_int: null,
        value_double: 45.67,
        histogram_data: null,
        service_name: 'svc-e2e-a',
        scope_name: 'metrics-scope',
        attributes: JSON.stringify({}),
        resource_attributes: JSON.stringify({}),
    });

    // Token usage metric
    db.insertMetric({
        id: METRIC_IDS.TOKEN_USAGE,
        timestamp: NOW - 15 * 60 * 1000,
        name: 'e2e_token_usage',
        description: 'Token usage count',
        unit: 'tokens',
        metric_type: 'sum',
        value_int: 5000,
        value_double: null,
        histogram_data: null,
        service_name: 'svc-e2e-a',
        scope_name: 'metrics-scope',
        attributes: JSON.stringify({ model: 'gpt-4', type: 'prompt' }),
        resource_attributes: JSON.stringify({}),
    });

    // Service B gauge
    db.insertMetric({
        id: METRIC_IDS.SVC_B_GAUGE,
        timestamp: NOW - 20 * 60 * 1000,
        name: 'e2e_memory_usage',
        description: 'Memory usage in MB',
        unit: 'MB',
        metric_type: 'gauge',
        value_int: null,
        value_double: 256.5,
        histogram_data: null,
        service_name: 'svc-e2e-b',
        scope_name: 'metrics-scope',
        attributes: JSON.stringify({}),
        resource_attributes: JSON.stringify({}),
    });

    // Histogram metric
    db.insertMetric({
        id: METRIC_IDS.HISTOGRAM,
        timestamp: NOW - 25 * 60 * 1000,
        name: 'e2e_response_time',
        description: 'Response time distribution',
        unit: 'ms',
        metric_type: 'histogram',
        value_int: null,
        value_double: null,
        histogram_data: JSON.stringify({
            buckets: [10, 25, 50, 100, 250, 500],
            counts: [5, 10, 20, 15, 8, 2],
            sum: 4500,
            count: 60,
        }),
        service_name: 'svc-e2e-a',
        scope_name: 'metrics-scope',
        attributes: JSON.stringify({}),
        resource_attributes: JSON.stringify({}),
    });

    // Add more metrics for filter testing
    for (let i = 1; i <= 3; i++) {
        db.insertMetric({
            id: `metric-e2e-extra-${i}`,
            timestamp: NOW - i * HOUR,
            name: 'e2e_requests_total',
            description: 'Total requests',
            unit: '1',
            metric_type: 'sum',
            value_int: 100 * i,
            value_double: null,
            histogram_data: null,
            service_name: i % 2 === 0 ? 'svc-e2e-a' : 'svc-e2e-b',
            scope_name: 'metrics-scope',
            attributes: JSON.stringify({}),
            resource_attributes: JSON.stringify({}),
        });
    }

    console.log('✓ Seeded database with E2E test data');
}

module.exports = {
    seedDatabase,
    TRACE_IDS,
    LOG_IDS,
    METRIC_IDS,
    NOW,
    HOUR,
    DAY,
};
