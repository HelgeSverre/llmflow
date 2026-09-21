import type { Database } from 'bun:sqlite'
const { sanitizeHeaders, sanitizePath } = require('@llmflow/shared/redaction')

export function migrate(db: Database) {
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
