# RFC: OTLP Metrics and Logs Support

**Status**: Draft  
**Created**: 2025-12-20  
**Author**: LLMFlow Team

## Summary

This RFC proposes adding OTLP/HTTP endpoints for metrics (`/v1/metrics`) and logs (`/v1/logs`) to complement the existing trace ingestion (`/v1/traces`). This enables LLMFlow to receive telemetry from AI CLI tools like Claude Code, Codex CLI, and Gemini CLI that export metrics and logs rather than traces.

## Motivation

LLMFlow currently only supports OTLP trace ingestion. However, major AI CLI tools export different signal types:

| Tool        | Traces | Metrics | Logs |
| ----------- | ------ | ------- | ---- |
| Claude Code | ❌     | ✅      | ✅   |
| Codex CLI   | ❌     | ❌      | ✅   |
| Gemini CLI  | ✅     | ✅      | ✅   |
| OpenLLMetry | ✅     | ❌      | ❌   |

To achieve universal AI observability, LLMFlow needs to support all three OTLP signal types.

## OTLP Protocol Overview

### Endpoints

Per the [OTLP specification](https://opentelemetry.io/docs/specs/otlp/):

| Signal  | Default Path  | Port (HTTP) | Port (gRPC) |
| ------- | ------------- | ----------- | ----------- |
| Traces  | `/v1/traces`  | 4318        | 4317        |
| Metrics | `/v1/metrics` | 4318        | 4317        |
| Logs    | `/v1/logs`    | 4318        | 4317        |

### Content Types

- `application/json` - JSON Protobuf encoding
- `application/x-protobuf` - Binary Protobuf encoding

LLMFlow will initially support JSON encoding only (matching current `/v1/traces` implementation).

## Logs Implementation

### Request Format

```json
{
  "resourceLogs": [
    {
      "resource": {
        "attributes": [
          { "key": "service.name", "value": { "stringValue": "claude-code" } }
        ]
      },
      "scopeLogs": [
        {
          "scope": {
            "name": "claude_code",
            "version": "1.0.0"
          },
          "logRecords": [
            {
              "timeUnixNano": "1703073600000000000",
              "observedTimeUnixNano": "1703073600000000000",
              "severityNumber": 9,
              "severityText": "INFO",
              "body": { "stringValue": "User prompt submitted" },
              "attributes": [
                {
                  "key": "event.name",
                  "value": { "stringValue": "claude_code.user_prompt" }
                },
                { "key": "session_id", "value": { "stringValue": "abc123" } }
              ],
              "traceId": "5b8efff798038103d269b633813fc60c",
              "spanId": "eee19b7ec3c1b174"
            }
          ]
        }
      ]
    }
  ]
}
```

### Database Schema

Add new `logs` table:

```sql
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
    attributes TEXT,  -- JSON
    resource_attributes TEXT,  -- JSON

    -- Indexes
    FOREIGN KEY (trace_id) REFERENCES traces(trace_id)
);

CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_logs_trace_id ON logs(trace_id);
CREATE INDEX IF NOT EXISTS idx_logs_event_name ON logs(event_name);
CREATE INDEX IF NOT EXISTS idx_logs_service_name ON logs(service_name);
```

### Log Processor

```javascript
// otlp-logs.js

function extractLogEventName(attrs) {
  // Common patterns for AI CLI tools
  return (
    attrs["event.name"] || attrs["log.event.name"] || attrs["name"] || null
  );
}

function processOtlpLogs(body) {
  const results = { accepted: 0, rejected: 0, errors: [] };

  if (!body || !body.resourceLogs) {
    return results;
  }

  for (const resourceLog of body.resourceLogs) {
    const resourceAttrs = extractAttributes(resourceLog.resource?.attributes);

    for (const scopeLog of resourceLog.scopeLogs || []) {
      const scopeInfo = scopeLog.scope || {};

      for (const logRecord of scopeLog.logRecords || []) {
        try {
          const attrs = extractAttributes(logRecord.attributes);

          db.insertLog({
            id: generateId(),
            timestamp: nanoToMs(logRecord.timeUnixNano),
            observed_timestamp: nanoToMs(logRecord.observedTimeUnixNano),
            severity_number: logRecord.severityNumber,
            severity_text: logRecord.severityText,
            body: extractBody(logRecord.body),
            trace_id: normalizeId(logRecord.traceId),
            span_id: normalizeId(logRecord.spanId),
            event_name: extractLogEventName(attrs),
            service_name: resourceAttrs["service.name"] || "unknown",
            scope_name: scopeInfo.name,
            attributes: attrs,
            resource_attributes: resourceAttrs,
          });
          results.accepted++;
        } catch (err) {
          results.rejected++;
          results.errors.push(err.message);
        }
      }
    }
  }

  return results;
}

function createLogsHandler() {
  return (req, res) => {
    const contentType = req.headers["content-type"] || "";

    if (!contentType.includes("application/json")) {
      return res.status(415).json({
        error: "Unsupported Media Type",
        message: "Only application/json is supported",
      });
    }

    try {
      const results = processOtlpLogs(req.body);

      res.status(200).json({
        partialSuccess:
          results.rejected > 0
            ? {
                rejectedLogRecords: results.rejected,
                errorMessage: results.errors.slice(0, 5).join("; "),
              }
            : undefined,
      });
    } catch (err) {
      res.status(500).json({
        error: "Internal Server Error",
        message: err.message,
      });
    }
  };
}
```

### AI CLI Tool Event Mapping

| Tool        | Event Name Pattern | Key Attributes                      |
| ----------- | ------------------ | ----------------------------------- |
| Claude Code | `claude_code.*`    | `session_id`, `tool_name`, `model`  |
| Codex CLI   | `codex.*`          | `call_id`, `tool_name`, `decision`  |
| Gemini CLI  | `gemini_cli.*`     | `model`, `tool_name`, `status_code` |

### Dashboard Logs API

```javascript
// GET /api/logs
app.get("/api/logs", (req, res) => {
  const {
    limit = 50,
    offset = 0,
    service,
    event_name,
    trace_id,
    severity_min,
    date_from,
    date_to,
  } = req.query;

  const logs = db.getLogs({
    limit: parseInt(limit),
    offset: parseInt(offset),
    filters: {
      service,
      event_name,
      trace_id,
      severity_min,
      date_from,
      date_to,
    },
  });

  res.json({ logs, total: db.getLogCount(filters) });
});

// GET /api/logs/:id
app.get("/api/logs/:id", (req, res) => {
  const log = db.getLogById(req.params.id);
  if (!log) return res.status(404).json({ error: "Log not found" });
  res.json(log);
});
```

## Metrics Implementation

### Request Format

```json
{
  "resourceMetrics": [
    {
      "resource": {
        "attributes": [
          { "key": "service.name", "value": { "stringValue": "claude-code" } }
        ]
      },
      "scopeMetrics": [
        {
          "scope": {
            "name": "claude_code.metrics",
            "version": "1.0.0"
          },
          "metrics": [
            {
              "name": "claude_code.token.usage",
              "description": "Token usage",
              "unit": "tokens",
              "sum": {
                "dataPoints": [
                  {
                    "timeUnixNano": "1703073600000000000",
                    "asInt": "1500",
                    "attributes": [
                      { "key": "type", "value": { "stringValue": "input" } },
                      {
                        "key": "model",
                        "value": { "stringValue": "claude-sonnet-4-20250514" }
                      }
                    ]
                  }
                ],
                "aggregationTemporality": 2,
                "isMonotonic": true
              }
            }
          ]
        }
      ]
    }
  ]
}
```

### Metric Types

OTLP supports several metric types:

1. **Sum** (Counter): Monotonically increasing values (e.g., token counts)
2. **Gauge**: Point-in-time values (e.g., active sessions)
3. **Histogram**: Distribution of values (e.g., latency)
4. **Summary**: Pre-calculated quantiles

### Database Schema

Add `metrics` table for time-series data:

```sql
CREATE TABLE IF NOT EXISTS metrics (
    id TEXT PRIMARY KEY,
    timestamp INTEGER NOT NULL,

    -- Metric identification
    name TEXT NOT NULL,
    description TEXT,
    unit TEXT,
    metric_type TEXT,  -- 'sum', 'gauge', 'histogram', 'summary'

    -- Value (for simple metrics)
    value_int INTEGER,
    value_double REAL,

    -- Histogram buckets (JSON for complex data)
    histogram_data TEXT,

    -- Context
    service_name TEXT,
    scope_name TEXT,

    -- Dimensions
    attributes TEXT,  -- JSON
    resource_attributes TEXT  -- JSON
);

CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metrics(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_name ON metrics(name);
CREATE INDEX IF NOT EXISTS idx_metrics_service_name ON metrics(service_name);
```

### Metrics Aggregation

For dashboard display, aggregate metrics into useful views:

```javascript
// Aggregated metrics view
function getMetricsSummary(filters = {}) {
  return db
    .prepare(
      `
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
        WHERE timestamp >= @from AND timestamp <= @to
        GROUP BY name, service_name
        ORDER BY data_points DESC
    `,
    )
    .all(filters);
}

// Token usage aggregation (common for AI tools)
function getTokenUsage(filters = {}) {
  return db
    .prepare(
      `
        SELECT 
            service_name,
            json_extract(attributes, '$.model') as model,
            json_extract(attributes, '$.type') as token_type,
            SUM(value_int) as total_tokens
        FROM metrics
        WHERE name LIKE '%token%' OR name LIKE '%usage%'
        GROUP BY service_name, model, token_type
    `,
    )
    .all();
}
```

### Dashboard Metrics API

```javascript
// GET /api/metrics
app.get("/api/metrics", (req, res) => {
  const { name, service, from, to, aggregation } = req.query;

  if (aggregation === "summary") {
    return res.json(db.getMetricsSummary({ from, to }));
  }

  const metrics = db.getMetrics({
    name,
    service,
    from: parseInt(from),
    to: parseInt(to),
  });

  res.json({ metrics });
});

// GET /api/metrics/tokens - Token usage summary
app.get("/api/metrics/tokens", (req, res) => {
  const usage = db.getTokenUsage(req.query);
  res.json({ usage });
});
```

## Unified Telemetry View

### Correlating Signals

When logs and spans share `trace_id`, display them together:

```javascript
// GET /api/traces/:id/telemetry
app.get("/api/traces/:id/telemetry", (req, res) => {
  const traceId = req.params.id;

  const spans = db.getSpansByTraceId(traceId);
  const logs = db.getLogsByTraceId(traceId);

  // Merge and sort by timestamp
  const timeline = [...spans, ...logs]
    .map((item) => ({
      ...item,
      type: item.span_type ? "span" : "log",
    }))
    .sort((a, b) => a.timestamp - b.timestamp);

  res.json({
    trace_id: traceId,
    timeline,
    stats: {
      span_count: spans.length,
      log_count: logs.length,
    },
  });
});
```

## Real-time Updates

Extend WebSocket broadcasts for new signals:

```javascript
// Hook for log insertions
db.setInsertLogHook((logSummary) => {
  broadcast({ type: "new_log", payload: logSummary });

  // If log has trace_id, notify trace subscribers
  if (logSummary.trace_id) {
    broadcast({
      type: "trace_log_added",
      payload: { trace_id: logSummary.trace_id, log: logSummary },
    });
  }
});

// Hook for metric insertions
db.setInsertMetricHook((metricSummary) => {
  broadcast({ type: "new_metric", payload: metricSummary });
});
```

## Configuration

### Environment Variables

```bash
# Enable/disable signal ingestion
LLMFLOW_ENABLE_TRACES=true
LLMFLOW_ENABLE_LOGS=true
LLMFLOW_ENABLE_METRICS=true

# Retention settings
LLMFLOW_MAX_LOGS=100000
LLMFLOW_MAX_METRICS=1000000
LLMFLOW_METRICS_RETENTION_DAYS=30
```

## Migration Path

### Phase 1: Logs Support

1. Add `logs` table to database schema
2. Implement `/v1/logs` endpoint
3. Add logs API endpoints for dashboard
4. Test with Codex CLI

### Phase 2: Metrics Support

1. Add `metrics` table to database schema
2. Implement `/v1/metrics` endpoint
3. Add metrics aggregation queries
4. Add metrics API endpoints
5. Test with Claude Code and Gemini CLI

### Phase 3: Dashboard Integration

1. Add logs viewer component
2. Add metrics charts
3. Implement unified timeline view
4. Add filtering by signal type

## Testing

### Test with Codex CLI

```bash
# Start LLMFlow
npm start

# Configure Codex CLI
cat >> ~/.codex/config.toml << EOF
[otel]
exporter = "otlp-http"
log_user_prompt = true

[otel.exporter."otlp-http"]
endpoint = "http://localhost:3000/v1/logs"
protocol = "json"
EOF

# Run Codex
codex "hello world"

# Verify logs received
curl http://localhost:3000/api/logs
```

### Test with Claude Code

```bash
# Start LLMFlow
npm start

# Configure Claude Code
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_LOGS_EXPORTER=otlp
export OTEL_METRICS_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_PROTOCOL=http/json
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:3000

# Run Claude Code
claude

# Verify logs and metrics received
curl http://localhost:3000/api/logs
curl http://localhost:3000/api/metrics
```

## Future Enhancements

1. **gRPC Support**: Add OTLP/gRPC endpoints for tools that prefer it
2. **Protobuf Support**: Handle binary protobuf encoding
3. **Metrics Downsampling**: Aggregate old metrics to reduce storage
4. **Log Parsing**: Extract structured data from log bodies
5. **GenAI Semantic Conventions**: Full support for OpenTelemetry GenAI conventions

## References

- [OTLP Specification](https://opentelemetry.io/docs/specs/otlp/)
- [OTLP Logs Data Model](https://opentelemetry.io/docs/specs/otel/logs/data-model/)
- [OTLP Metrics Data Model](https://opentelemetry.io/docs/specs/otel/metrics/data-model/)
- [GenAI Semantic Conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/)
- [OTLP JSON Examples](https://github.com/open-telemetry/opentelemetry-proto/tree/main/examples)
