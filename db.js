const path = require('path');
const fs = require('fs');
const os = require('os');
const Database = require('better-sqlite3');

const DATA_DIR = process.env.DATA_DIR || path.join(os.homedir(), '.llmflow');
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'data.db');
const MAX_TRACES = parseInt(process.env.MAX_TRACES || '10000', 10);
const MAX_LOGS = parseInt(process.env.MAX_LOGS || '100000', 10);
const MAX_METRICS = parseInt(process.env.MAX_METRICS || '1000000', 10);

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(DB_PATH);

// Helper to add columns if they don't exist (simple migration)
function ensureColumn(name, definition) {
    const info = db.prepare('PRAGMA table_info(traces)').all();
    if (!info.find(c => c.name === name)) {
        db.exec(`ALTER TABLE traces ADD COLUMN ${name} ${definition}`);
    }
}

function initSchema() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS traces (
            id TEXT PRIMARY KEY,
            timestamp INTEGER NOT NULL,
            duration_ms INTEGER,
            provider TEXT DEFAULT 'openai',
            model TEXT,
            prompt_tokens INTEGER DEFAULT 0,
            completion_tokens INTEGER DEFAULT 0,
            total_tokens INTEGER DEFAULT 0,
            estimated_cost REAL DEFAULT 0,
            status INTEGER,
            error TEXT,
            request_method TEXT,
            request_path TEXT,
            request_headers TEXT,
            request_body TEXT,
            response_status INTEGER,
            response_headers TEXT,
            response_body TEXT,
            tags TEXT,
            trace_id TEXT,
            parent_id TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_traces_timestamp ON traces(timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_traces_model ON traces(model);
        CREATE INDEX IF NOT EXISTS idx_traces_trace_id ON traces(trace_id);
        CREATE INDEX IF NOT EXISTS idx_traces_status ON traces(status);
    `);

    // Span-specific columns (v0.2+)
    ensureColumn('span_type', "TEXT DEFAULT 'llm'");
    ensureColumn('span_name', 'TEXT');
    ensureColumn('input', 'TEXT');
    ensureColumn('output', 'TEXT');
    ensureColumn('attributes', 'TEXT');
    ensureColumn('service_name', 'TEXT');

    db.exec('CREATE INDEX IF NOT EXISTS idx_traces_parent_id ON traces(parent_id)');

    db.exec(`
        CREATE TABLE IF NOT EXISTS stats_cache (
            key TEXT PRIMARY KEY,
            value TEXT,
            updated_at INTEGER
        );
    `);

    // Logs table for OTLP logs ingestion (v0.2.1+)
    db.exec(`
        CREATE TABLE IF NOT EXISTS logs (
            id TEXT PRIMARY KEY,
            timestamp INTEGER NOT NULL,
            observed_timestamp INTEGER,
            
            -- Severity
            severity_number INTEGER,
            severity_text TEXT,
            
            -- Content
            body TEXT,
            
            -- Context
            trace_id TEXT,
            span_id TEXT,
            
            -- Classification
            event_name TEXT,
            service_name TEXT,
            scope_name TEXT,
            
            -- Structured data
            attributes TEXT,
            resource_attributes TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_logs_trace_id ON logs(trace_id);
        CREATE INDEX IF NOT EXISTS idx_logs_event_name ON logs(event_name);
        CREATE INDEX IF NOT EXISTS idx_logs_service_name ON logs(service_name);
        CREATE INDEX IF NOT EXISTS idx_logs_severity ON logs(severity_number);
    `);

    // Metrics table for OTLP metrics ingestion (v0.2.2+)
    db.exec(`
        CREATE TABLE IF NOT EXISTS metrics (
            id TEXT PRIMARY KEY,
            timestamp INTEGER NOT NULL,
            
            -- Metric identification
            name TEXT NOT NULL,
            description TEXT,
            unit TEXT,
            metric_type TEXT,
            
            -- Value (for simple metrics)
            value_int INTEGER,
            value_double REAL,
            
            -- Histogram buckets (JSON for complex data)
            histogram_data TEXT,
            
            -- Context
            service_name TEXT,
            scope_name TEXT,
            
            -- Dimensions
            attributes TEXT,
            resource_attributes TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metrics(timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_metrics_name ON metrics(name);
        CREATE INDEX IF NOT EXISTS idx_metrics_service_name ON metrics(service_name);
        CREATE INDEX IF NOT EXISTS idx_metrics_type ON metrics(metric_type);
    `);
}

initSchema();

const insertTraceStmt = db.prepare(`
    INSERT INTO traces (
        id, timestamp, duration_ms,
        provider, model,
        prompt_tokens, completion_tokens, total_tokens,
        estimated_cost, status, error,
        request_method, request_path, request_headers, request_body,
        response_status, response_headers, response_body,
        tags, trace_id, parent_id,
        span_type, span_name, input, output, attributes, service_name
    ) VALUES (
        @id, @timestamp, @duration_ms,
        @provider, @model,
        @prompt_tokens, @completion_tokens, @total_tokens,
        @estimated_cost, @status, @error,
        @request_method, @request_path, @request_headers, @request_body,
        @response_status, @response_headers, @response_body,
        @tags, @trace_id, @parent_id,
        @span_type, @span_name, @input, @output, @attributes, @service_name
    )
`);

const deleteOverflowStmt = db.prepare(`
    DELETE FROM traces
    WHERE id NOT IN (
        SELECT id FROM traces ORDER BY timestamp DESC LIMIT ?
    )
`);

const insertLogStmt = db.prepare(`
    INSERT INTO logs (
        id, timestamp, observed_timestamp,
        severity_number, severity_text,
        body, trace_id, span_id,
        event_name, service_name, scope_name,
        attributes, resource_attributes
    ) VALUES (
        @id, @timestamp, @observed_timestamp,
        @severity_number, @severity_text,
        @body, @trace_id, @span_id,
        @event_name, @service_name, @scope_name,
        @attributes, @resource_attributes
    )
`);

const deleteLogOverflowStmt = db.prepare(`
    DELETE FROM logs
    WHERE id NOT IN (
        SELECT id FROM logs ORDER BY timestamp DESC LIMIT ?
    )
`);

const insertMetricStmt = db.prepare(`
    INSERT INTO metrics (
        id, timestamp,
        name, description, unit, metric_type,
        value_int, value_double, histogram_data,
        service_name, scope_name,
        attributes, resource_attributes
    ) VALUES (
        @id, @timestamp,
        @name, @description, @unit, @metric_type,
        @value_int, @value_double, @histogram_data,
        @service_name, @scope_name,
        @attributes, @resource_attributes
    )
`);

const deleteMetricOverflowStmt = db.prepare(`
    DELETE FROM metrics
    WHERE id NOT IN (
        SELECT id FROM metrics ORDER BY timestamp DESC LIMIT ?
    )
`);

// Hook for real-time updates
let onInsertTrace = null;
let onInsertLog = null;
let onInsertMetric = null;

function setInsertTraceHook(fn) {
    onInsertTrace = fn;
}

function setInsertLogHook(fn) {
    onInsertLog = fn;
}

function setInsertMetricHook(fn) {
    onInsertMetric = fn;
}

function insertTrace(trace) {
    insertTraceStmt.run({
        id: trace.id,
        timestamp: trace.timestamp,
        duration_ms: trace.duration_ms || null,
        provider: trace.provider || null,
        model: trace.model || null,
        prompt_tokens: trace.prompt_tokens || 0,
        completion_tokens: trace.completion_tokens || 0,
        total_tokens: trace.total_tokens || 0,
        estimated_cost: trace.estimated_cost || 0,
        status: trace.status || null,
        error: trace.error || null,
        request_method: trace.request_method || null,
        request_path: trace.request_path || null,
        request_headers: JSON.stringify(trace.request_headers || {}),
        request_body: JSON.stringify(trace.request_body || {}),
        response_status: trace.response_status || null,
        response_headers: JSON.stringify(trace.response_headers || {}),
        response_body: JSON.stringify(trace.response_body || {}),
        tags: JSON.stringify(trace.tags || []),
        trace_id: trace.trace_id || trace.id,
        parent_id: trace.parent_id || null,
        span_type: trace.span_type || 'llm',
        span_name: trace.span_name || null,
        input: JSON.stringify(trace.input || null),
        output: JSON.stringify(trace.output || null),
        attributes: JSON.stringify(trace.attributes || {}),
        service_name: trace.service_name || null
    });

    const count = getTraceCount();
    if (count > MAX_TRACES) {
        deleteOverflowStmt.run(MAX_TRACES);
    }

    // Trigger hook for real-time updates
    if (onInsertTrace) {
        const summary = {
            id: trace.id,
            timestamp: trace.timestamp,
            duration_ms: trace.duration_ms || null,
            model: trace.model || null,
            total_tokens: trace.total_tokens || 0,
            estimated_cost: trace.estimated_cost || 0,
            status: trace.status || null,
            trace_id: trace.trace_id || trace.id,
            parent_id: trace.parent_id || null,
            span_type: trace.span_type || 'llm',
            span_name: trace.span_name || null,
            service_name: trace.service_name || null
        };
        try {
            onInsertTrace(summary);
        } catch (err) {
            // Don't let hook errors break insertion
        }
    }
}

function getTraces({ limit = 50, offset = 0, filters = {} } = {}) {
    const where = [];
    const params = {};

    if (filters.model) {
        where.push('model = @model');
        params.model = filters.model;
    }

    if (filters.status) {
        if (filters.status === 'error') {
            where.push('status >= 400');
        } else if (filters.status === 'success') {
            where.push('status < 400');
        }
    }

    if (filters.q) {
        where.push('(request_body LIKE @q OR response_body LIKE @q OR input LIKE @q OR output LIKE @q)');
        params.q = `%${filters.q}%`;
    }

    if (filters.date_from) {
        where.push('timestamp >= @date_from');
        params.date_from = filters.date_from;
    }

    if (filters.date_to) {
        where.push('timestamp <= @date_to');
        params.date_to = filters.date_to;
    }

    if (filters.cost_min != null) {
        where.push('estimated_cost >= @cost_min');
        params.cost_min = filters.cost_min;
    }

    if (filters.cost_max != null) {
        where.push('estimated_cost <= @cost_max');
        params.cost_max = filters.cost_max;
    }

    if (filters.span_type) {
        where.push('span_type = @span_type');
        params.span_type = filters.span_type;
    }

    if (filters.provider) {
        where.push('provider = @provider');
        params.provider = filters.provider;
    }

    if (filters.tag) {
        where.push('tags LIKE @tag');
        params.tag = `%${filters.tag}%`;
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const stmt = db.prepare(`
        SELECT 
            id, timestamp, duration_ms, provider, model,
            prompt_tokens, completion_tokens, total_tokens,
            estimated_cost, status, error, trace_id, parent_id,
            span_type, span_name, service_name
        FROM traces
        ${whereSql}
        ORDER BY timestamp DESC
        LIMIT @limit OFFSET @offset
    `);

    return stmt.all({ ...params, limit, offset });
}

function getSpansByTraceId(traceId) {
    return db.prepare(`
        SELECT *
        FROM traces
        WHERE trace_id = ?
        ORDER BY timestamp ASC
    `).all(traceId);
}

function getTraceById(id) {
    return db.prepare('SELECT * FROM traces WHERE id = ?').get(id);
}

function getStats() {
    const row = db.prepare(`
        SELECT
            COUNT(*) as total_requests,
            COALESCE(SUM(total_tokens), 0) as total_tokens,
            COALESCE(SUM(estimated_cost), 0) as total_cost,
            COALESCE(SUM(duration_ms), 0) as total_duration,
            SUM(CASE WHEN status >= 400 THEN 1 ELSE 0 END) as error_count
        FROM traces
    `).get();

    const models = db.prepare(`
        SELECT
            model,
            COUNT(*) as count,
            COALESCE(SUM(total_tokens), 0) as tokens,
            COALESCE(SUM(estimated_cost), 0) as cost
        FROM traces
        GROUP BY model
        ORDER BY count DESC
    `).all();

    const avg_duration = row.total_requests > 0
        ? row.total_duration / row.total_requests
        : 0;

    return { ...row, avg_duration, models };
}

function getTraceCount() {
    return db.prepare('SELECT COUNT(*) as cnt FROM traces').get().cnt;
}

function getDistinctModels() {
    return db.prepare('SELECT DISTINCT model FROM traces WHERE model IS NOT NULL ORDER BY model').all()
        .map(r => r.model);
}

// ==================== Logs Functions ====================

function insertLog(log) {
    insertLogStmt.run({
        id: log.id,
        timestamp: log.timestamp,
        observed_timestamp: log.observed_timestamp || null,
        severity_number: log.severity_number || null,
        severity_text: log.severity_text || null,
        body: typeof log.body === 'string' ? log.body : JSON.stringify(log.body || null),
        trace_id: log.trace_id || null,
        span_id: log.span_id || null,
        event_name: log.event_name || null,
        service_name: log.service_name || null,
        scope_name: log.scope_name || null,
        attributes: JSON.stringify(log.attributes || {}),
        resource_attributes: JSON.stringify(log.resource_attributes || {})
    });

    const count = getLogCount();
    if (count > MAX_LOGS) {
        deleteLogOverflowStmt.run(MAX_LOGS);
    }

    if (onInsertLog) {
        const summary = {
            id: log.id,
            timestamp: log.timestamp,
            severity_text: log.severity_text || null,
            event_name: log.event_name || null,
            service_name: log.service_name || null,
            trace_id: log.trace_id || null,
            body: typeof log.body === 'string' ? log.body.slice(0, 200) : null
        };
        try {
            onInsertLog(summary);
        } catch (err) {
            // Don't let hook errors break insertion
        }
    }
}

function getLogs({ limit = 50, offset = 0, filters = {} } = {}) {
    const where = [];
    const params = {};

    if (filters.service_name) {
        where.push('service_name = @service_name');
        params.service_name = filters.service_name;
    }

    if (filters.event_name) {
        where.push('event_name = @event_name');
        params.event_name = filters.event_name;
    }

    if (filters.trace_id) {
        where.push('trace_id = @trace_id');
        params.trace_id = filters.trace_id;
    }

    if (filters.severity_min != null) {
        where.push('severity_number >= @severity_min');
        params.severity_min = filters.severity_min;
    }

    if (filters.date_from) {
        where.push('timestamp >= @date_from');
        params.date_from = filters.date_from;
    }

    if (filters.date_to) {
        where.push('timestamp <= @date_to');
        params.date_to = filters.date_to;
    }

    if (filters.q) {
        where.push('(body LIKE @q OR attributes LIKE @q)');
        params.q = `%${filters.q}%`;
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const stmt = db.prepare(`
        SELECT 
            id, timestamp, observed_timestamp,
            severity_number, severity_text,
            body, trace_id, span_id,
            event_name, service_name, scope_name,
            attributes, resource_attributes
        FROM logs
        ${whereSql}
        ORDER BY timestamp DESC
        LIMIT @limit OFFSET @offset
    `);

    return stmt.all({ ...params, limit, offset });
}

function getLogById(id) {
    const log = db.prepare('SELECT * FROM logs WHERE id = ?').get(id);
    if (log) {
        log.attributes = JSON.parse(log.attributes || '{}');
        log.resource_attributes = JSON.parse(log.resource_attributes || '{}');
    }
    return log;
}

function getLogsByTraceId(traceId) {
    return db.prepare(`
        SELECT *
        FROM logs
        WHERE trace_id = ?
        ORDER BY timestamp ASC
    `).all(traceId);
}

function getLogCount(filters = {}) {
    if (Object.keys(filters).length === 0) {
        return db.prepare('SELECT COUNT(*) as cnt FROM logs').get().cnt;
    }
    
    const where = [];
    const params = {};

    if (filters.service_name) {
        where.push('service_name = @service_name');
        params.service_name = filters.service_name;
    }

    if (filters.event_name) {
        where.push('event_name = @event_name');
        params.event_name = filters.event_name;
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    return db.prepare(`SELECT COUNT(*) as cnt FROM logs ${whereSql}`).get(params).cnt;
}

function getDistinctEventNames() {
    return db.prepare('SELECT DISTINCT event_name FROM logs WHERE event_name IS NOT NULL ORDER BY event_name').all()
        .map(r => r.event_name);
}

function getDistinctLogServices() {
    return db.prepare('SELECT DISTINCT service_name FROM logs WHERE service_name IS NOT NULL ORDER BY service_name').all()
        .map(r => r.service_name);
}

// ==================== Metrics Functions ====================

function insertMetric(metric) {
    insertMetricStmt.run({
        id: metric.id,
        timestamp: metric.timestamp,
        name: metric.name,
        description: metric.description || null,
        unit: metric.unit || null,
        metric_type: metric.metric_type || 'gauge',
        value_int: metric.value_int != null ? metric.value_int : null,
        value_double: metric.value_double != null ? metric.value_double : null,
        histogram_data: metric.histogram_data ? JSON.stringify(metric.histogram_data) : null,
        service_name: metric.service_name || null,
        scope_name: metric.scope_name || null,
        attributes: JSON.stringify(metric.attributes || {}),
        resource_attributes: JSON.stringify(metric.resource_attributes || {})
    });

    const count = getMetricCount();
    if (count > MAX_METRICS) {
        deleteMetricOverflowStmt.run(MAX_METRICS);
    }

    if (onInsertMetric) {
        const summary = {
            id: metric.id,
            timestamp: metric.timestamp,
            name: metric.name,
            metric_type: metric.metric_type || 'gauge',
            value_int: metric.value_int,
            value_double: metric.value_double,
            service_name: metric.service_name || null
        };
        try {
            onInsertMetric(summary);
        } catch (err) {
            // Don't let hook errors break insertion
        }
    }
}

function getMetrics({ limit = 50, offset = 0, filters = {} } = {}) {
    const where = [];
    const params = {};

    if (filters.name) {
        where.push('name = @name');
        params.name = filters.name;
    }

    if (filters.service_name) {
        where.push('service_name = @service_name');
        params.service_name = filters.service_name;
    }

    if (filters.metric_type) {
        where.push('metric_type = @metric_type');
        params.metric_type = filters.metric_type;
    }

    if (filters.date_from) {
        where.push('timestamp >= @date_from');
        params.date_from = filters.date_from;
    }

    if (filters.date_to) {
        where.push('timestamp <= @date_to');
        params.date_to = filters.date_to;
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const stmt = db.prepare(`
        SELECT 
            id, timestamp, name, description, unit, metric_type,
            value_int, value_double, histogram_data,
            service_name, scope_name, attributes, resource_attributes
        FROM metrics
        ${whereSql}
        ORDER BY timestamp DESC
        LIMIT @limit OFFSET @offset
    `);

    return stmt.all({ ...params, limit, offset });
}

function getMetricById(id) {
    const metric = db.prepare('SELECT * FROM metrics WHERE id = ?').get(id);
    if (metric) {
        metric.attributes = JSON.parse(metric.attributes || '{}');
        metric.resource_attributes = JSON.parse(metric.resource_attributes || '{}');
        if (metric.histogram_data) {
            metric.histogram_data = JSON.parse(metric.histogram_data);
        }
    }
    return metric;
}

function getMetricCount(filters = {}) {
    if (Object.keys(filters).length === 0) {
        return db.prepare('SELECT COUNT(*) as cnt FROM metrics').get().cnt;
    }
    
    const where = [];
    const params = {};

    if (filters.name) {
        where.push('name = @name');
        params.name = filters.name;
    }

    if (filters.service_name) {
        where.push('service_name = @service_name');
        params.service_name = filters.service_name;
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    return db.prepare(`SELECT COUNT(*) as cnt FROM metrics ${whereSql}`).get(params).cnt;
}

function getMetricsSummary(filters = {}) {
    const fromTs = filters.date_from || 0;
    const toTs = filters.date_to || Date.now();
    
    return db.prepare(`
        SELECT 
            name,
            service_name,
            metric_type,
            COUNT(*) as data_points,
            MIN(timestamp) as first_seen,
            MAX(timestamp) as last_seen,
            SUM(value_int) as sum_int,
            AVG(value_double) as avg_double,
            MAX(value_int) as max_int,
            MIN(value_int) as min_int
        FROM metrics
        WHERE timestamp >= ? AND timestamp <= ?
        GROUP BY name, service_name
        ORDER BY data_points DESC
    `).all(fromTs, toTs);
}

function getTokenUsage(filters = {}) {
    return db.prepare(`
        SELECT 
            service_name,
            json_extract(attributes, '$.model') as model,
            json_extract(attributes, '$.type') as token_type,
            SUM(value_int) as total_tokens
        FROM metrics
        WHERE name LIKE '%token%' OR name LIKE '%usage%'
        GROUP BY service_name, model, token_type
    `).all();
}

function getDistinctMetricNames() {
    return db.prepare('SELECT DISTINCT name FROM metrics WHERE name IS NOT NULL ORDER BY name').all()
        .map(r => r.name);
}

function getDistinctMetricServices() {
    return db.prepare('SELECT DISTINCT service_name FROM metrics WHERE service_name IS NOT NULL ORDER BY service_name').all()
        .map(r => r.service_name);
}

// ==================== Analytics Functions ====================

function formatDateLabel(timestamp, interval) {
    const date = new Date(timestamp);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    if (interval === 'day') {
        return `${year}-${month}-${day}`;
    }
    const hour = String(date.getUTCHours()).padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:00`;
}

function getTokenTrends({ interval = 'hour', days = 7 } = {}) {
    const now = Date.now();
    const fromTs = now - (days * 24 * 60 * 60 * 1000);

    let bucketSize;
    let dateFormat;

    switch (interval) {
        case 'day':
            bucketSize = 24 * 60 * 60 * 1000;
            dateFormat = '%Y-%m-%d';
            break;
        case 'hour':
        default:
            bucketSize = 60 * 60 * 1000;
            dateFormat = '%Y-%m-%d %H:00';
            break;
    }

    // Get actual data from database
    // Use CAST to ensure integer division for proper bucket alignment
    const data = db.prepare(`
        SELECT
            CAST(timestamp / @bucketSize AS INTEGER) * @bucketSize as bucket,
            strftime(@dateFormat, timestamp / 1000, 'unixepoch') as label,
            SUM(prompt_tokens) as prompt_tokens,
            SUM(completion_tokens) as completion_tokens,
            SUM(total_tokens) as total_tokens,
            SUM(estimated_cost) as total_cost,
            COUNT(*) as request_count
        FROM traces
        WHERE timestamp >= @fromTs
        GROUP BY bucket
        ORDER BY bucket ASC
    `).all({ bucketSize, dateFormat, fromTs });

    // Create a map for quick lookup
    const dataMap = new Map(data.map(d => [d.bucket, d]));

    // Generate all buckets and fill gaps with zeros
    const result = [];
    const startBucket = Math.floor(fromTs / bucketSize) * bucketSize;
    const endBucket = Math.floor(now / bucketSize) * bucketSize;

    for (let bucket = startBucket; bucket <= endBucket; bucket += bucketSize) {
        const existing = dataMap.get(bucket);
        if (existing) {
            result.push(existing);
        } else {
            result.push({
                bucket,
                label: formatDateLabel(bucket, interval),
                prompt_tokens: 0,
                completion_tokens: 0,
                total_tokens: 0,
                total_cost: 0,
                request_count: 0
            });
        }
    }

    return result;
}

function getCostByTool({ days = 30 } = {}) {
    const fromTs = Date.now() - (days * 24 * 60 * 60 * 1000);
    
    return db.prepare(`
        SELECT 
            provider,
            service_name,
            SUM(estimated_cost) as total_cost,
            SUM(total_tokens) as total_tokens,
            SUM(prompt_tokens) as prompt_tokens,
            SUM(completion_tokens) as completion_tokens,
            COUNT(*) as request_count,
            AVG(duration_ms) as avg_duration
        FROM traces
        WHERE timestamp >= @fromTs
        GROUP BY provider, service_name
        ORDER BY total_cost DESC
    `).all({ fromTs });
}

function getCostByModel({ days = 30 } = {}) {
    const fromTs = Date.now() - (days * 24 * 60 * 60 * 1000);
    
    return db.prepare(`
        SELECT 
            model,
            provider,
            SUM(estimated_cost) as total_cost,
            SUM(total_tokens) as total_tokens,
            SUM(prompt_tokens) as prompt_tokens,
            SUM(completion_tokens) as completion_tokens,
            COUNT(*) as request_count
        FROM traces
        WHERE timestamp >= @fromTs AND model IS NOT NULL
        GROUP BY model
        ORDER BY total_cost DESC
    `).all({ fromTs });
}

function getDailyStats({ days = 30 } = {}) {
    const now = Date.now();
    const fromTs = now - (days * 24 * 60 * 60 * 1000);
    const bucketSize = 24 * 60 * 60 * 1000;

    // Get actual data from database
    // Use CAST to ensure integer division for proper bucket alignment
    const data = db.prepare(`
        SELECT
            CAST(timestamp / @bucketSize AS INTEGER) * @bucketSize as bucket,
            strftime('%Y-%m-%d', timestamp / 1000, 'unixepoch') as date,
            SUM(total_tokens) as tokens,
            SUM(estimated_cost) as cost,
            COUNT(*) as requests
        FROM traces
        WHERE timestamp >= @fromTs
        GROUP BY bucket
        ORDER BY bucket ASC
    `).all({ bucketSize, fromTs });

    // Create a map for quick lookup
    const dataMap = new Map(data.map(d => [d.bucket, d]));

    // Generate all buckets and fill gaps with zeros
    const result = [];
    const startBucket = Math.floor(fromTs / bucketSize) * bucketSize;
    const endBucket = Math.floor(now / bucketSize) * bucketSize;

    for (let bucket = startBucket; bucket <= endBucket; bucket += bucketSize) {
        const existing = dataMap.get(bucket);
        if (existing) {
            result.push(existing);
        } else {
            result.push({
                bucket,
                date: formatDateLabel(bucket, 'day'),
                tokens: 0,
                cost: 0,
                requests: 0
            });
        }
    }

    return result;
}

function close() {
    db.close();
}

module.exports = {
    insertTrace,
    getTraces,
    getTraceById,
    getSpansByTraceId,
    getStats,
    getTraceCount,
    getDistinctModels,
    setInsertTraceHook,
    // Logs
    insertLog,
    getLogs,
    getLogById,
    getLogsByTraceId,
    getLogCount,
    getDistinctEventNames,
    getDistinctLogServices,
    setInsertLogHook,
    // Metrics
    insertMetric,
    getMetrics,
    getMetricById,
    getMetricCount,
    getMetricsSummary,
    getTokenUsage,
    getDistinctMetricNames,
    getDistinctMetricServices,
    setInsertMetricHook,
    // Analytics
    getTokenTrends,
    getCostByTool,
    getCostByModel,
    getDailyStats,
    // Constants
    DB_PATH,
    DATA_DIR,
    // Lifecycle
    close
};
