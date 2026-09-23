-- A database created by LLMFlow v0.4.1 (commit 37341a1) with sample rows; see migrations.test.ts.
PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE traces (
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
        , span_type TEXT DEFAULT 'llm', span_name TEXT, input TEXT, output TEXT, attributes TEXT, service_name TEXT, session_id TEXT, conversation_id TEXT, agent_name TEXT);
INSERT INTO traces VALUES('span-root',1750000000000,120,'openai','gpt-4o-mini',10,5,15,0.00100000000000000002,200,NULL,'POST','/v1/chat/completions','{"content-type":"application/json"}','{"model":"gpt-4o-mini"}',200,'{}','{"ok":true}','["legacy"]','trace-legacy',NULL,'llm','root','null','null','{"k":"v"}','legacy-app','session-legacy',NULL,NULL);
INSERT INTO traces VALUES('span-child',1750000000010,50,NULL,NULL,0,0,0,0.0,NULL,NULL,NULL,NULL,'{}','{}',NULL,'{}','{}','[]','trace-legacy','span-root','tool','child','null','null','{}','legacy-app',NULL,NULL,NULL);
CREATE TABLE stats_cache (
            key TEXT PRIMARY KEY,
            value TEXT,
            updated_at INTEGER
        );
CREATE TABLE logs (
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
INSERT INTO logs VALUES('log-1',1750000000020,NULL,9,'INFO','legacy log','trace-legacy',NULL,NULL,'legacy-app',NULL,'{}','{}');
CREATE TABLE metrics (
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
        , aggregation_temporality INTEGER, is_monotonic INTEGER, start_time_unix_nano TEXT, time_unix_nano TEXT, series_key TEXT);
INSERT INTO metrics VALUES('metric-1',1750000000030,'legacy.counter',NULL,NULL,'sum',7,NULL,NULL,'legacy-app',NULL,'{}','{}',NULL,NULL,NULL,NULL,NULL);
CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL);
INSERT INTO schema_migrations VALUES(1,1790189981519);
INSERT INTO schema_migrations VALUES(2,1790189981519);
INSERT INTO schema_migrations VALUES(3,1790189981520);
INSERT INTO schema_migrations VALUES(4,1790189981520);
CREATE TABLE trace_groups (trace_id TEXT PRIMARY KEY, span_count INTEGER NOT NULL, latest_timestamp INTEGER NOT NULL);
INSERT INTO trace_groups VALUES('trace-legacy',2,1750000000010);
CREATE TABLE evicted_traces (trace_id TEXT PRIMARY KEY, evicted_at INTEGER NOT NULL);
CREATE TABLE retention_counts (id INTEGER PRIMARY KEY CHECK(id=1), span_count INTEGER NOT NULL);
INSERT INTO retention_counts VALUES(1,2);
CREATE INDEX idx_traces_timestamp ON traces(timestamp DESC);
CREATE INDEX idx_traces_model ON traces(model);
CREATE INDEX idx_traces_trace_id ON traces(trace_id);
CREATE INDEX idx_traces_status ON traces(status);
CREATE INDEX idx_traces_parent_id ON traces(parent_id);
CREATE INDEX idx_traces_session_id ON traces(session_id);
CREATE INDEX idx_traces_conversation_id ON traces(conversation_id);
CREATE INDEX idx_logs_timestamp ON logs(timestamp DESC);
CREATE INDEX idx_logs_trace_id ON logs(trace_id);
CREATE INDEX idx_logs_event_name ON logs(event_name);
CREATE INDEX idx_logs_service_name ON logs(service_name);
CREATE INDEX idx_logs_severity ON logs(severity_number);
CREATE INDEX idx_metrics_timestamp ON metrics(timestamp DESC);
CREATE INDEX idx_metrics_name ON metrics(name);
CREATE INDEX idx_metrics_service_name ON metrics(service_name);
CREATE INDEX idx_metrics_type ON metrics(metric_type);
CREATE INDEX idx_trace_group ON traces(COALESCE(trace_id,id));
CREATE INDEX trace_groups_oldest ON trace_groups(latest_timestamp,trace_id);
CREATE INDEX evicted_traces_newest ON evicted_traces(evicted_at);
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
COMMIT;
