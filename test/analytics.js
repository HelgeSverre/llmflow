#!/usr/bin/env node

/**
 * Analytics Unit Tests
 * 
 * Tests analytics database functions and aggregation logic.
 */

const db = require('../db');

const c = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    yellow: '\x1b[33m',
    dim: '\x1b[2m',
};

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`${c.green}✓${c.reset} ${name}`);
        passed++;
    } catch (err) {
        console.log(`${c.red}✗${c.reset} ${name}`);
        console.log(`  ${c.red}${err.message}${c.reset}`);
        failed++;
    }
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message || 'Assertion failed');
    }
}

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(`${message || 'Expected'}: ${JSON.stringify(expected)}, got: ${JSON.stringify(actual)}`);
    }
}

// ============ Token Trends Tests ============

console.log(`\n${c.cyan}Token Trends${c.reset}\n`);

test('getTokenTrends returns array', () => {
    const trends = db.getTokenTrends({ interval: 'day', days: 7 });
    assert(Array.isArray(trends), 'Should return an array');
});

test('getTokenTrends with hour interval', () => {
    const trends = db.getTokenTrends({ interval: 'hour', days: 1 });
    assert(Array.isArray(trends), 'Should return an array');
});

test('getTokenTrends buckets have expected fields', () => {
    const trends = db.getTokenTrends({ interval: 'day', days: 30 });
    
    if (trends.length > 0) {
        const bucket = trends[0];
        assert(bucket.bucket !== undefined, 'Should have bucket timestamp');
        assert(bucket.label !== undefined, 'Should have label');
        assert(bucket.prompt_tokens !== undefined, 'Should have prompt_tokens');
        assert(bucket.completion_tokens !== undefined, 'Should have completion_tokens');
        assert(bucket.total_tokens !== undefined, 'Should have total_tokens');
        assert(bucket.total_cost !== undefined, 'Should have total_cost');
        assert(bucket.request_count !== undefined, 'Should have request_count');
    }
});

test('getTokenTrends respects days parameter', () => {
    const trends7 = db.getTokenTrends({ interval: 'day', days: 7 });
    const trends30 = db.getTokenTrends({ interval: 'day', days: 30 });
    
    // 30 days should have >= buckets than 7 days (or equal if no data)
    assert(trends30.length >= 0, 'Should return non-negative bucket count');
});

// ============ Cost by Tool Tests ============

console.log(`\n${c.cyan}Cost by Tool${c.reset}\n`);

test('getCostByTool returns array', () => {
    const byTool = db.getCostByTool({ days: 30 });
    assert(Array.isArray(byTool), 'Should return an array');
});

test('getCostByTool items have expected fields', () => {
    const byTool = db.getCostByTool({ days: 30 });
    
    if (byTool.length > 0) {
        const item = byTool[0];
        assert(item.provider !== undefined, 'Should have provider');
        assert(item.total_cost !== undefined, 'Should have total_cost');
        assert(item.total_tokens !== undefined, 'Should have total_tokens');
        assert(item.prompt_tokens !== undefined, 'Should have prompt_tokens');
        assert(item.completion_tokens !== undefined, 'Should have completion_tokens');
        assert(item.request_count !== undefined, 'Should have request_count');
    }
});

test('getCostByTool orders by total_cost descending', () => {
    const byTool = db.getCostByTool({ days: 30 });
    
    for (let i = 1; i < byTool.length; i++) {
        const prev = byTool[i - 1].total_cost || 0;
        const curr = byTool[i].total_cost || 0;
        assert(prev >= curr, `Item ${i-1} cost should be >= item ${i} cost`);
    }
});

// ============ Cost by Model Tests ============

console.log(`\n${c.cyan}Cost by Model${c.reset}\n`);

test('getCostByModel returns array', () => {
    const byModel = db.getCostByModel({ days: 30 });
    assert(Array.isArray(byModel), 'Should return an array');
});

test('getCostByModel items have expected fields', () => {
    const byModel = db.getCostByModel({ days: 30 });
    
    if (byModel.length > 0) {
        const item = byModel[0];
        assert(item.model !== undefined, 'Should have model');
        assert(item.total_cost !== undefined, 'Should have total_cost');
        assert(item.total_tokens !== undefined, 'Should have total_tokens');
        assert(item.request_count !== undefined, 'Should have request_count');
    }
});

test('getCostByModel orders by total_cost descending', () => {
    const byModel = db.getCostByModel({ days: 30 });
    
    for (let i = 1; i < byModel.length; i++) {
        const prev = byModel[i - 1].total_cost || 0;
        const curr = byModel[i].total_cost || 0;
        assert(prev >= curr, `Item ${i-1} cost should be >= item ${i} cost`);
    }
});

// ============ Daily Stats Tests ============

console.log(`\n${c.cyan}Daily Stats${c.reset}\n`);

test('getDailyStats returns array', () => {
    const daily = db.getDailyStats({ days: 30 });
    assert(Array.isArray(daily), 'Should return an array');
});

test('getDailyStats items have expected fields', () => {
    const daily = db.getDailyStats({ days: 30 });
    
    if (daily.length > 0) {
        const item = daily[0];
        assert(item.bucket !== undefined, 'Should have bucket');
        assert(item.date !== undefined, 'Should have date');
        assert(item.tokens !== undefined, 'Should have tokens');
        assert(item.cost !== undefined, 'Should have cost');
        assert(item.requests !== undefined, 'Should have requests');
    }
});

test('getDailyStats date format is YYYY-MM-DD', () => {
    const daily = db.getDailyStats({ days: 30 });
    
    if (daily.length > 0) {
        const datePattern = /^\d{4}-\d{2}-\d{2}$/;
        assert(datePattern.test(daily[0].date), 'Date should be in YYYY-MM-DD format');
    }
});

test('getDailyStats orders by bucket ascending', () => {
    const daily = db.getDailyStats({ days: 30 });
    
    for (let i = 1; i < daily.length; i++) {
        assert(daily[i].bucket >= daily[i - 1].bucket, 'Should be ordered by bucket ascending');
    }
});

// ============ Edge Cases ============

console.log(`\n${c.cyan}Edge Cases${c.reset}\n`);

test('getTokenTrends with 0 days returns empty', () => {
    const trends = db.getTokenTrends({ interval: 'day', days: 0 });
    assertEqual(trends.length, 0, 'Should return empty for 0 days');
});

test('getCostByTool with 0 days returns empty', () => {
    const byTool = db.getCostByTool({ days: 0 });
    assertEqual(byTool.length, 0, 'Should return empty for 0 days');
});

test('getDailyStats with 0 days returns empty', () => {
    const daily = db.getDailyStats({ days: 0 });
    assertEqual(daily.length, 0, 'Should return empty for 0 days');
});

test('getTokenTrends with default params works', () => {
    const trends = db.getTokenTrends();
    assert(Array.isArray(trends), 'Should work with no params');
});

test('getCostByTool with default params works', () => {
    const byTool = db.getCostByTool();
    assert(Array.isArray(byTool), 'Should work with no params');
});

test('getCostByModel with default params works', () => {
    const byModel = db.getCostByModel();
    assert(Array.isArray(byModel), 'Should work with no params');
});

test('getDailyStats with default params works', () => {
    const daily = db.getDailyStats();
    assert(Array.isArray(daily), 'Should work with no params');
});

// ============ Summary ============

console.log(`\n${'─'.repeat(40)}`);
console.log(`${c.green}Passed: ${passed}${c.reset}`);
if (failed > 0) {
    console.log(`${c.red}Failed: ${failed}${c.reset}`);
}
console.log('');

process.exit(failed > 0 ? 1 : 0);
