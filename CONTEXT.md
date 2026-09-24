# LLMFlow

LLMFlow records what LLM-powered applications do (their LLM calls, tool calls and agent steps, plus
logs and metrics) and shows it on a local dashboard.

## Language

### Sources

**Service**:
The application that produced a span, log or metric. A record whose source names no service belongs
to the unknown service.
_Avoid_: tool, app, source, client

**Agent**:
A named AI agent running inside a service. One service can run several agents.
_Avoid_: using "agent" and "service" interchangeably

### Spans and traces

**Span**:
One recorded operation: an LLM call, a tool call, an agent step or any other unit of work.
_Avoid_: trace (for a single operation), request, call, record, entry

**Trace**:
All spans that share a trace ID; the complete record of one piece of work end to end.
_Avoid_: using "trace" for one span

**Root span**:
The span in a trace that has no parent; it names and represents the trace.

**Span type**:
What kind of operation a span records, one of a closed set named after the OpenTelemetry GenAI
operations: **llm** (a model generating text), **embedding**, **retrieval**, **tool**, **agent**,
**workflow** (a step that orchestrates other steps) and **custom** (anything that names no type).
_Avoid_: chain, task, trace (as a type)

**Partial trace**:
A trace in which some span refers to a parent span that is not stored, because it was evicted or has
not arrived yet. Until its root span is present, the trace is represented by its earliest stored span.

**Failed span**:
A span that ended with an error status or carries an error message.
_Avoid_: counting only HTTP error statuses as failures

### Logs and metrics

**Log**:
One log record a service sends, with a severity and a body.
_Avoid_: log record, event, entry

**Metric**:
A named measurement a service reports over time, such as a counter, gauge or histogram.

**Data point**:
One value of a metric at one moment.
_Avoid_: metric point, measurement, observation

**Related logs**:
The logs that belong to the same trace as a span.
_Avoid_: correlation

### Describing records

**Attributes**:
Key-value details attached to a span, log or metric.
_Avoid_: metadata

**Resource attributes**:
Attributes that describe the service that sent a record rather than the record itself.

**Tags**:
Short labels a service attaches to a span to find it later.
_Avoid_: labels

### Grouping

**Session**:
The traces a service marks as belonging together (one run of an application or CLI, one user visit),
identified by the session ID it sends. A span without a session ID belongs to no session.
_Avoid_: using "session" for anything else (stream parsing, processes)

**Conversation**:
One chat thread of messages, identified by the conversation ID the service sends. A session can contain
several conversations.
_Avoid_: thread, chat

### Measures

**Span count**:
The number of spans in an aggregate.
_Avoid_: request count, requests (a tool or agent span is not a request)

**Input tokens** / **Output tokens**:
The tokens a model read and the tokens it generated for a span.
_Avoid_: prompt tokens, completion tokens

**Cost**:
The estimated price of a span, computed from its tokens and its model's pricing.
_Avoid_: spend, price, estimated cost (all cost is estimated)

**Pricing**:
The per-model token rates used to compute cost, fetched from LiteLLM's published prices.

**Bundled pricing**:
The copy of pricing shipped with LLMFlow, used when current pricing cannot be fetched.
_Avoid_: pricing fallback

**Placeholder rate**:
The rate charged when a model has no pricing entry.
_Avoid_: default price, fallback price

### Proxying

**Proxy**:
LLMFlow's listener that applications send LLM calls through, so each call is recorded as a span.

**Translated call**:
A call sent to the proxy in the OpenAI format, which the proxy converts to the provider's format and
back.
_Avoid_: normalized call

**Passthrough call**:
A call sent to the proxy in the provider's own format, forwarded unchanged.
_Avoid_: native call, native mode

**Provider**:
The upstream LLM API a call goes to, such as OpenAI, Anthropic or Gemini.
_Avoid_: vendor, system

**Model**:
The model that served a call, as the provider's response reports it (not the model requested).

**Replay**:
Sending a recorded call to its provider again, which records a new trace. Only calls that went through
the proxy can be replayed.

### Moving telemetry in and out

**Ingest**:
Receiving spans, logs and metrics that a service sends over OpenTelemetry (OTLP).
_Avoid_: receive, import

**Export**:
Sending recorded spans, logs and metrics on to another OpenTelemetry backend.
_Avoid_: forward (the proxy forwards calls; LLMFlow exports telemetry)

### Retention

**Eviction**:
Deleting the oldest records once a retention limit is reached. Spans are evicted a whole trace at a
time.
_Avoid_: pruning, dropping

### Views

The dashboard's views, each named after what it lists.

**Timeline**:
The view that interleaves spans and logs in time order.
_Avoid_: items, records

**Traces view**:
The view that lists traces, one row per trace, represented by its root span.

**Sessions view**:
The view that lists sessions and the traces in each.

**Logs view** / **Metrics view**:
The views that list logs and metrics.

**Usage view**:
The view of span count, tokens and cost broken down by model, by service and over time.
_Avoid_: analytics, models view (both merged into Usage)
