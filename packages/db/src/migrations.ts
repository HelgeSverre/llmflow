import type { Database } from 'bun:sqlite'
import { sanitizeHeaders, sanitizePath } from '@llmflow/shared/redaction'

// The tables as they were before versioned migrations existed. New and old databases take the
// same path: create this baseline if missing, then apply every step not yet recorded.
function createBaseline(db: Database) {
    db.exec(`
        CREATE TABLE IF NOT EXISTS traces (
            id TEXT PRIMARY KEY,
            timestamp INTEGER NOT NULL,
            duration_ms INTEGER,
            provider TEXT,
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
    `)
}

function addColumns(db: Database, table: string, columns: Record<string, string>) {
    const existing = new Set(
        (db.query(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name),
    )
    for (const [name, definition] of Object.entries(columns))
        if (!existing.has(name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`)
}

/**
 * Brings the schema up to date. Steps are numbered by position and recorded in
 * schema_migrations: append new steps, never reorder or edit applied ones.
 */
export function migrate(db: Database) {
    createBaseline(db)
    db.exec(
        'CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL)',
    )
    const steps = [
        () => {
            const update = db.query(
                'UPDATE traces SET request_headers=?, response_headers=?, request_path=? WHERE id=?',
            )
            const parse = (value: unknown) => {
                try {
                    return typeof value === 'string' ? JSON.parse(value) : value || {}
                } catch {
                    return {}
                }
            }
            for (const row of db
                .query('SELECT id,request_headers,response_headers,request_path FROM traces')
                .iterate() as Iterable<Record<string, any>>) {
                update.run(
                    JSON.stringify(sanitizeHeaders(parse(row.request_headers))),
                    JSON.stringify(sanitizeHeaders(parse(row.response_headers))),
                    sanitizePath(row.request_path) ?? null,
                    row.id,
                )
            }
        },
        () =>
            db.exec(
                'UPDATE logs SET timestamp=observed_timestamp WHERE (timestamp IS NULL OR timestamp <= 0) AND observed_timestamp > 0',
            ),
        () =>
            db.exec(`
            CREATE INDEX IF NOT EXISTS idx_trace_group ON traces(COALESCE(trace_id,id));
            CREATE TABLE trace_groups (trace_id TEXT PRIMARY KEY, span_count INTEGER NOT NULL, latest_timestamp INTEGER NOT NULL);
            CREATE INDEX trace_groups_oldest ON trace_groups(latest_timestamp,trace_id);
            CREATE TABLE evicted_traces (trace_id TEXT PRIMARY KEY, evicted_at INTEGER NOT NULL);
            CREATE INDEX evicted_traces_newest ON evicted_traces(evicted_at);
            CREATE TABLE retention_counts (id INTEGER PRIMARY KEY CHECK(id=1), span_count INTEGER NOT NULL);
            INSERT INTO retention_counts SELECT 1,COUNT(*) FROM traces;
            INSERT INTO trace_groups SELECT COALESCE(trace_id,id),COUNT(*),MAX(timestamp) FROM traces GROUP BY COALESCE(trace_id,id);
            CREATE TRIGGER trace_group_insert AFTER INSERT ON traces BEGIN
                INSERT INTO trace_groups VALUES(COALESCE(NEW.trace_id,NEW.id),1,NEW.timestamp)
                ON CONFLICT(trace_id) DO UPDATE SET span_count=span_count+1,latest_timestamp=MAX(latest_timestamp,NEW.timestamp);
                UPDATE retention_counts SET span_count=span_count+1 WHERE id=1;
            END;
            CREATE TRIGGER trace_group_delete AFTER DELETE ON traces BEGIN
                UPDATE trace_groups SET span_count=span_count-1 WHERE trace_id=COALESCE(OLD.trace_id,OLD.id);
                DELETE FROM trace_groups WHERE trace_id=COALESCE(OLD.trace_id,OLD.id) AND span_count=0;
                UPDATE retention_counts SET span_count=span_count-1 WHERE id=1;
            END;
        `),
        () =>
            db.exec(`
            ALTER TABLE metrics ADD COLUMN aggregation_temporality INTEGER;
            ALTER TABLE metrics ADD COLUMN is_monotonic INTEGER;
            ALTER TABLE metrics ADD COLUMN start_time_unix_nano TEXT;
            ALTER TABLE metrics ADD COLUMN time_unix_nano TEXT;
            ALTER TABLE metrics ADD COLUMN series_key TEXT;
        `),
        () => db.exec('DROP TABLE IF EXISTS stats_cache'),
        // Span (v0.2) and session (v0.3) columns. These predate versioned migrations, so databases
        // from v0.2-v0.4 may already have some or all of them.
        () => {
            addColumns(db, 'traces', {
                span_type: "TEXT DEFAULT 'llm'",
                span_name: 'TEXT',
                input: 'TEXT',
                output: 'TEXT',
                attributes: 'TEXT',
                service_name: 'TEXT',
                session_id: 'TEXT',
                conversation_id: 'TEXT',
                agent_name: 'TEXT',
            })
            db.exec(`
                CREATE INDEX IF NOT EXISTS idx_traces_parent_id ON traces(parent_id);
                CREATE INDEX IF NOT EXISTS idx_traces_session_id ON traces(session_id);
                CREATE INDEX IF NOT EXISTS idx_traces_conversation_id ON traces(conversation_id);
            `)
        },
        // The table stores spans (TASK-105). SQLite carries its indexes and triggers along.
        () => db.exec('ALTER TABLE traces RENAME TO spans'),
    ]
    let scrubbed = false
    for (const [index, step] of steps.entries()) {
        const version = index + 1
        if (db.query('SELECT 1 FROM schema_migrations WHERE version=?').get(version)) continue
        db.transaction(() => {
            step()
            db.query('INSERT INTO schema_migrations VALUES(?,?)').run(version, Date.now())
        })()
        if (version === 1) scrubbed = true
    }
    if (scrubbed) {
        db.exec('PRAGMA wal_checkpoint(TRUNCATE)')
        db.exec('VACUUM')
        db.exec('PRAGMA wal_checkpoint(TRUNCATE)')
    }
}
