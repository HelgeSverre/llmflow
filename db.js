const path = require('path');
const fs = require('fs');
const os = require('os');
const Database = require('better-sqlite3');

const DATA_DIR = process.env.DATA_DIR || path.join(os.homedir(), '.llmflow');
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'data.db');
const MAX_TRACES = parseInt(process.env.MAX_TRACES || '10000', 10);

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

module.exports = {
    insertTrace,
    getTraces,
    getTraceById,
    getSpansByTraceId,
    getStats,
    getTraceCount,
    getDistinctModels,
    DB_PATH,
    DATA_DIR
};
