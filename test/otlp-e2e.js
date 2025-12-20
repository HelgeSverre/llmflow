#!/usr/bin/env node

/**
 * End-to-End Test for OTLP Integration
 * 
 * Tests the full flow:
 * 1. Send OTLP/HTTP JSON traces (simulating OpenLLMetry)
 * 2. Verify spans are stored correctly
 * 3. Verify span tree is correct
 * 4. Verify dashboard API returns correct data
 * 
 * Run: node test/otlp-e2e.js
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
 * Create OTLP/HTTP JSON traces payload
 * Simulates what OpenLLMetry would send
 */
function createOtlpPayload(traceId, spans) {
    return {
        resourceSpans: [
            {
                resource: {
                    attributes: [
                        { key: 'service.name', value: { stringValue: 'e2e-test-service' } },
                        { key: 'service.version', value: { stringValue: '1.0.0' } }
                    ]
                },
                scopeSpans: [
                    {
                        scope: {
                            name: 'openllmetry',
                            version: '1.0.0'
                        },
                        spans: spans.map(span => ({
                            traceId,
                            spanId: span.spanId,
                            parentSpanId: span.parentSpanId || '',
                            name: span.name,
                            kind: span.kind || 1, // SPAN_KIND_INTERNAL
                            startTimeUnixNano: String(span.startTime * 1000000),
                            endTimeUnixNano: String(span.endTime * 1000000),
                            attributes: span.attributes || [],
                            events: span.events || [],
                            status: span.status || { code: 0 }
                        }))
                    }
                ]
            }
        ]
    };
}

/**
 * Create OpenLLMetry-style LLM span attributes
 */
function createLlmAttributes(model, promptTokens, completionTokens, prompt, completion) {
    return [
        { key: 'gen_ai.system', value: { stringValue: 'openai' } },
        { key: 'gen_ai.request.model', value: { stringValue: model } },
        { key: 'gen_ai.response.model', value: { stringValue: model } },
        { key: 'gen_ai.usage.prompt_tokens', value: { intValue: String(promptTokens) } },
        { key: 'gen_ai.usage.completion_tokens', value: { intValue: String(completionTokens) } },
        { key: 'gen_ai.usage.total_tokens', value: { intValue: String(promptTokens + completionTokens) } },
        { key: 'gen_ai.prompt', value: { stringValue: JSON.stringify(prompt) } },
        { key: 'gen_ai.completion', value: { stringValue: JSON.stringify(completion) } },
        { key: 'llm.request.type', value: { stringValue: 'chat' } },
    ];
}

/**
 * Create retrieval span attributes (vector DB)
 */
function createRetrievalAttributes(dbSystem, query, topK) {
    return [
        { key: 'db.system', value: { stringValue: dbSystem } },
        { key: 'db.vector.query.top_k', value: { intValue: String(topK) } },
        { key: 'db.operation', value: { stringValue: 'query' } },
    ];
}

/**
 * Create traceloop framework span attributes
 */
function createTraceloopAttributes(kind, workflowName, entityName) {
    return [
        { key: 'traceloop.span.kind', value: { stringValue: kind } },
        { key: 'traceloop.workflow.name', value: { stringValue: workflowName } },
        { key: 'traceloop.entity.name', value: { stringValue: entityName } },
    ];
}

// Test results
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
    console.log(`${c.cyan}OTLP E2E Test Suite${c.reset}`);
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

    // Test 2: Send simple OTLP trace
    console.log(`\n${c.yellow}Test 2: Simple OTLP Trace Ingestion${c.reset}`);
    const simpleTraceId = generateHexId(32);
    const simpleSpanId = generateHexId(16);
    const now = Date.now();
    
    const simplePayload = createOtlpPayload(simpleTraceId, [
        {
            spanId: simpleSpanId,
            name: 'simple-test-span',
            startTime: now,
            endTime: now + 100,
            attributes: [
                { key: 'test.type', value: { stringValue: 'simple' } }
            ]
        }
    ]);

    const simpleResult = await httpRequest('POST', '/v1/traces', simplePayload);
    assert(simpleResult.status === 200, 'OTLP endpoint returns 200');
    assert(!simpleResult.data.partialSuccess, 'No partial success (all spans accepted)');

    // Verify span was stored
    await new Promise(resolve => setTimeout(resolve, 100)); // Small delay for DB write
    const storedSpan = await httpRequest('GET', `/api/traces/${simpleSpanId}`);
    assert(storedSpan.status === 200, 'Span is retrievable via API');
    assert(storedSpan.data.trace?.id === simpleSpanId, 'Span ID matches');

    // Test 3: OpenLLMetry-style LLM trace
    console.log(`\n${c.yellow}Test 3: OpenLLMetry LLM Trace${c.reset}`);
    const llmTraceId = generateHexId(32);
    const llmSpanId = generateHexId(16);
    
    const llmPayload = createOtlpPayload(llmTraceId, [
        {
            spanId: llmSpanId,
            name: 'openai.chat',
            startTime: now,
            endTime: now + 500,
            attributes: createLlmAttributes(
                'gpt-4o-mini',
                150,
                50,
                [{ role: 'user', content: 'Hello, how are you?' }],
                [{ role: 'assistant', content: 'I am doing well, thank you!' }]
            )
        }
    ]);

    const llmResult = await httpRequest('POST', '/v1/traces', llmPayload);
    assert(llmResult.status === 200, 'LLM trace accepted');

    await new Promise(resolve => setTimeout(resolve, 100));
    const llmSpan = await httpRequest('GET', `/api/traces/${llmSpanId}`);
    assert(llmSpan.status === 200, 'LLM span is retrievable');
    assert(llmSpan.data.trace?.model === 'gpt-4o-mini', 'Model extracted correctly');
    assert(llmSpan.data.trace?.prompt_tokens === 150, 'Prompt tokens extracted');
    assert(llmSpan.data.trace?.completion_tokens === 50, 'Completion tokens extracted');
    assert(llmSpan.data.trace?.total_tokens === 200, 'Total tokens calculated');

    // Test 4: Hierarchical trace (RAG workflow)
    console.log(`\n${c.yellow}Test 4: Hierarchical RAG Workflow${c.reset}`);
    const ragTraceId = generateHexId(32);
    const rootSpanId = generateHexId(16);
    const retrievalSpanId = generateHexId(16);
    const llmChildSpanId = generateHexId(16);

    const ragPayload = createOtlpPayload(ragTraceId, [
        {
            spanId: rootSpanId,
            name: 'rag-query-workflow',
            startTime: now,
            endTime: now + 1000,
            attributes: createTraceloopAttributes('workflow', 'rag-query', 'RAGChain')
        },
        {
            spanId: retrievalSpanId,
            parentSpanId: rootSpanId,
            name: 'vector-search',
            startTime: now + 50,
            endTime: now + 200,
            attributes: createRetrievalAttributes('pinecone', 'test query', 5)
        },
        {
            spanId: llmChildSpanId,
            parentSpanId: rootSpanId,
            name: 'generate-answer',
            startTime: now + 200,
            endTime: now + 900,
            attributes: createLlmAttributes(
                'gpt-4o',
                500,
                200,
                [{ role: 'user', content: 'Based on context, answer the question' }],
                [{ role: 'assistant', content: 'Here is the answer...' }]
            )
        }
    ]);

    const ragResult = await httpRequest('POST', '/v1/traces', ragPayload);
    assert(ragResult.status === 200, 'RAG trace accepted');

    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify tree structure
    const treeResult = await httpRequest('GET', `/api/traces/${rootSpanId}/tree`);
    assert(treeResult.status === 200, 'Trace tree is retrievable');
    assert(treeResult.data.trace?.span_count === 3, 'Tree has 3 spans');
    
    const rootSpan = treeResult.data.spans?.find(s => s.id === rootSpanId);
    assert(rootSpan !== undefined, 'Root span found in tree');
    assert(rootSpan?.children?.length === 2, 'Root span has 2 children');

    // Test 5: Verify span types are correctly detected
    console.log(`\n${c.yellow}Test 5: Span Type Detection${c.reset}`);
    
    // Check retrieval span
    const retrievalCheck = await httpRequest('GET', `/api/traces/${retrievalSpanId}`);
    
    // Parse the response body to get span_type
    const retrievalSpanData = retrievalCheck.data.trace;
    // Since span_type isn't in the default trace response, check via tree
    const ragTree = await httpRequest('GET', `/api/traces/${rootSpanId}/tree`);
    const retrievalInTree = ragTree.data.spans?.[0]?.children?.find(s => s.id === retrievalSpanId);
    assert(retrievalInTree?.span_type === 'retrieval', 'Retrieval span type detected from db.system');

    const llmInTree = ragTree.data.spans?.[0]?.children?.find(s => s.id === llmChildSpanId);
    assert(llmInTree?.span_type === 'llm', 'LLM span type detected from gen_ai.system');

    // Test 6: Verify workflow span type from traceloop
    const rootInTree = ragTree.data.spans?.find(s => s.id === rootSpanId);
    assert(rootInTree?.span_type === 'trace', 'Workflow span type mapped to trace');

    // Test 7: Error handling for invalid payload
    console.log(`\n${c.yellow}Test 6: Error Handling${c.reset}`);
    
    const emptyPayload = {};
    const emptyResult = await httpRequest('POST', '/v1/traces', emptyPayload);
    assert(emptyResult.status === 200, 'Empty payload returns 200 (no spans to process)');

    // Test 8: Verify spans appear in trace list
    console.log(`\n${c.yellow}Test 7: Dashboard API Integration${c.reset}`);
    
    const traceList = await httpRequest('GET', '/api/traces?limit=10');
    assert(traceList.status === 200, 'Trace list returns 200');
    assert(Array.isArray(traceList.data), 'Trace list is an array');
    
    const ourSpans = traceList.data.filter(t => 
        t.id === simpleSpanId || t.id === llmSpanId || t.id === rootSpanId
    );
    assert(ourSpans.length >= 1, 'At least one of our test spans appears in list');

    // Test 9: Search/filter works with OTLP spans
    console.log(`\n${c.yellow}Test 8: Search & Filter${c.reset}`);
    
    const modelFilter = await httpRequest('GET', '/api/traces?model=gpt-4o-mini');
    assert(modelFilter.status === 200, 'Model filter returns 200');
    const hasOurLlmSpan = modelFilter.data.some(t => t.id === llmSpanId);
    assert(hasOurLlmSpan, 'LLM span found with model filter');

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
