# General APM Trace Viewer Survey

A source-level survey of how mature general-purpose distributed tracing tools render span waterfalls and trace timelines, plus what transfers to llmflow's local-first LLM observability viewer.

Scope: Jaeger, Grafana Tempo, Honeycomb, Datadog APM, Lightstep/ServiceNow Cloud Observability, Zipkin Lens, Chrome DevTools Performance, Perfetto.

## Executive Summary

The Jaeger 2018 layout — left column with indented span tree, right column with span bars, sticky time-axis header, click-row-to-open inline detail — is still the dominant pattern in 2026. Every major OSS tracing UI either is a Jaeger fork (Grafana's Tempo trace view literally is one; the file tree at `public/app/features/explore/TraceView/components/TraceTimelineViewer/` mirrors `jaeger-ui/packages/jaeger-ui/src/components/TracePage/TraceTimelineViewer/` file-for-file) or is converging on the same DOM-divs-with-percentage-widths approach (Zipkin Lens, Honeycomb, Datadog's waterfall view). For traces in the few-hundred-to-few-thousand span range, DOM with virtualization remains the path of least resistance, and nobody who isn't profiling kernel traces has moved off it.

What has actually changed since 2018:

1. **Critical path highlighting** went from a research idea (Uber's CRISP, 2023) to a checkbox in Grafana, Honeycomb, and Lightstep within ~18 months. This is the single biggest UX win.
2. **Inline span detail panels** (Jaeger, Zipkin Lens) replaced modal popups (old Zipkin UI). Newer tools (Honeycomb, Datadog, Grafana) prefer a persistent right-side drawer over inline expansion, because it keeps the waterfall context visible while users page through spans.
3. **Keyboard navigation** is now table-stakes (Honeycomb shipped arrow-key span nav explicitly as a feature; Perfetto and Chrome DevTools have always had it; Jaeger still has none — an outlier).
4. **Span filter pills** (Grafana, Honeycomb) replaced raw text search as the primary way to slice a trace.
5. **BubbleUp-style aggregation** (Honeycomb) is the only genuinely novel pattern from the last 5 years that hasn't been universally copied — it tells you _which attributes differ_ in a selected slice, instead of forcing the user to click around looking for the anomaly.

The tools that have actually pushed the state of the art are **Perfetto** (Canvas + WebAssembly trace processor; scales to millions of slices) and **Chrome DevTools** (heavily optimised Canvas2D batched flame chart). Everyone in the distributed-tracing-vendor space — including the closed-source ones — is still doing DOM rectangles with percentage widths. They get away with it because typical APM trace sizes are bounded (Datadog hard-caps at 100MB and 4000 spans per parent in Lightstep, etc.). Honest opinion: there is no rendering-tech innovation in distributed tracing UIs. The innovation is in _what you can put next to the waterfall_ (heatmaps, attribute deltas, critical paths, log correlation).

For llmflow specifically — with the SQLite schema `(id, trace_id, parent_id, timestamp, duration_ms, span_type, span_name, model, prompt_tokens, completion_tokens, estimated_cost, tags, attributes)` and a realistic ceiling of a few thousand spans per trace — copying Jaeger's DOM-with-virtualization architecture is the right call. The interesting design surface is what to put in the left column (model + cost + tokens, not service name) and what aggregations to put adjacent to the waterfall (cost-by-model bar, token-distribution heatmap), not the renderer.

## Per-tool deep dive

### Jaeger

**Source root**: `https://github.com/jaegertracing/jaeger-ui/tree/main/packages/jaeger-ui/src/components/TracePage/TraceTimelineViewer/`

Key files:

- `index.tsx` — top-level layout. Imports `TimelineHeaderRow`, `VirtualizedTraceView`, `SpanDetailSidePanel`, `VerticalResizer`.
- `VirtualizedTraceView.tsx` — virtualization driver.
- `ListView/` — Jaeger's own virtualization implementation (not `react-window` or `react-virtualized` despite the original 2017 issue requesting it; they ended up rolling their own with `viewBuffer={300}` and `viewBufferMin={100}` for buffered offscreen rendering).
- `SpanBarRow.tsx` — one row of the timeline.
- `SpanBar.tsx` — the actual bar div.
- `SpanTreeOffset.tsx` — the indentation guides on the left.
- `Ticks.tsx` — the time-axis ticks at the top.
- `TimelineHeaderRow/` — the sticky header (column resizer, tick labels).
- `SpanDetail/` — the inline detail panel that drops below a clicked row.

**Waterfall layout**: Indented tree on left, bars on right. A `VerticalResizer` lets the user shift the split. The header row is sticky at the top with tick labels.

**Time axis**: Top of the viewport, sticky, percent-based labels formatted by `formatDurationCompact` (so ms, µs, or s depending on trace length). `MIN_LABEL_SPACING_PX = 130` — ticks are always laid out, but labels are skipped (`labelStep *= 2`) when they'd overlap.

**Span bar styling**: Pure DOM divs (`<div className="SpanBar--bar">`). Width is computed as `toPercent(viewEnd - viewStart)` — a percentage string like `"45.3%"`. There is no explicit min-width in the source; very short spans become 1-pixel slivers and rely on the indented label in the left column for identification. Service color is passed as a `color` prop and applied via inline `background`. Errors get an alert icon on the name (filled = own error, hollow = child error). RPC remote-service is shown as a colored arrow marker. Critical path segments use `var(--critical-path-color)` as an overlay.

**Density**: `DEFAULT_HEIGHTS = { bar: 28, detail: 161, detailWithLogs: 197 }`. So ~28px per row → roughly 25–30 spans on a 720p viewport before scrolling.

**Long traces**: Custom `ListView` virtualization (not react-window). Subtree collapse via the expand/collapse caret on `SpanTreeOffset`. There's also a `PrunedSpanRow` placeholder that shows when subtrees are hidden by filters. No "compress mode" — Jaeger relies on virtualization, not aggregation.

**Critical path**: Yes. Critical path spans (or sub-segments of spans) get a colored overlay inside the bar. Hovering shows a lazy-loaded tooltip explaining why.

**Span selection**: Click to expand inline detail row. No keyboard navigation. The selected span ID is in the URL hash (`#span=...`) for deep linking.

**Search**: Full-text search across operation/service/tags above the waterfall. Matches highlight rows. There's a service filter dropdown.

**Comparison/diff**: Jaeger has a separate Trace Diff page (`TraceDiff`) that shows two traces side-by-side, color-coded by which trace each span belongs to. Not integrated into the waterfall.

**Aggregation**: Mini-map above the waterfall (SVG-based) for zoom/pan. No latency histograms.

**Performance**: Documented in issues to be sluggish past ~10k spans. Render bottleneck is the DOM, not the data. Practical ceiling: ~3–5k spans before users complain.

**Rendering tech**: DOM divs throughout. Mini-map is SVG. _No Canvas, no WebGL anywhere in the timeline path._

**Accessibility**: Limited. No documented keyboard nav. ARIA on expand/collapse only.

### Grafana Tempo (Grafana's trace view)

**Source root**: `https://github.com/grafana/grafana/tree/main/public/app/features/explore/TraceView/components/TraceTimelineViewer/`

This is a **literal fork of jaeger-ui**. The file list is identical (`SpanBar.tsx`, `SpanBarRow.tsx`, `SpanTreeOffset.tsx`, `Ticks.tsx`, `TimelineRow.tsx`, `VirtualizedTraceView.tsx`, `ListView/`, etc.). The fork happened around Grafana 7.x and has diverged on Grafana-specific concerns (data links to Loki/Pyroscope, theme integration).

Notable Grafana-specific additions:

- **Critical path highlighting** (PR #76857, 2023): implements Uber's CRISP algorithm. UI: a "Critical path" pill in the span filter bar, plus a "Show critical path only" toggle that collapses non-critical spans. Highlighted with a darker stripe inside the bar.
- **Span filter pills**: Above the timeline. Quick filters: Critical path, Errors, Service. Each is a toggleable pill. A "Show all spans" master toggle dims non-matching spans rather than hiding them — this is more intuitive than Jaeger's hard filter.
- **Trace-to-logs / trace-to-metrics / trace-to-profiles**: A document-icon button per span opens a split Explore pane with the configured datasource. This is the killer feature; the waterfall is a launchpad for correlated queries, not a destination.
- **JSON export, one-click trace-ID copy** in the header (Grafana 10.1 redesign).

Everything else inherits from Jaeger: same 28px row height, same DOM-divs-with-percentage-widths, same custom `ListView` virtualization, same lack of keyboard nav.

**Rendering tech**: DOM. (Inherited from Jaeger.)

### Honeycomb

**Source**: Closed. The Honeycomb docs and changelog are the only public reference.

**Waterfall layout**: Indented tree on left, bars on right, sticky time axis at top. Spans with children show a count badge next to the name ("[3]"). Selected span row is highlighted blue with details in a _persistent right-side trace sidebar_ — not an inline expand-below-row like Jaeger.

**Span bar styling**: Colored bars per service. Errors render in red. Critical path is shown (Honeycomb added this in 2023). Span events render as circles on the bar; span links render as link icons.

**Density**: Not documented. Visually, screenshots show ~24px row height.

**Critical path**: Yes, similar pill/toggle UX to Grafana.

**Span selection**: Click to select. **Arrow keys navigate between spans**. Left/right arrow expands/collapses. Enter opens the span action menu. `?` shows keyboard hints. This is the most thorough keyboard nav of any cloud APM.

**Search**: Search by field or value. Errors can be navigated with prev/next arrows. Column display is customizable; column widths are resizable; per-span color is overridable.

**Comparison/diff**: Not a side-by-side diff. Instead Honeycomb uses **BubbleUp**: select a temporal slice (or a group in a query), and Honeycomb tells you which attributes differ statistically between that slice and the baseline. From the trace waterfall, you can BubbleUp on the heatmap minigraph at the top of the sidebar — this surfaces "the spans in this latency band differ from the others in `db.statement`, `customer.tier`, …".

**Aggregation views**: The sidebar carries a **minigraph heatmap** of the selected span relative to other spans with the same fields in the waterfall — clicking it cross-launches the Query Builder. This is the closest any APM gets to having the waterfall and a latency histogram glued together.

**Performance constraints**: Not documented publicly.

**Rendering tech**: DOM (inferred from devtools screenshots; not confirmed).

**Accessibility**: Explicit commitment in design docs to accessible design, keyboard nav, and semantic colors. Honeycomb is the only one of these tools where accessibility is a public design tenet.

### Datadog APM

**Source**: Closed.

**Waterfall layout**: Datadog actually offers **four** views of the same trace data:

1. **Flame Graph** (default) — color-coded by service, depth = call stack depth, width = duration. Pan and zoom (scroll), with a minimap.
2. **Span List** — table view grouped by service, sortable by count/duration/execution-time-percent.
3. **Waterfall** — classic indented tree + bars layout.
4. **Map** — service-to-service dependency graph for the trace.

This is the most aggressive multi-view UX of any APM. The flame graph is the default because Datadog optimises for "where did time go" rather than "what's the parent of X".

**Time axis**: Pan and zoom; the minimap lets users zoom into a span range or back out to full trace.

**Span bar styling**: Service-color encoded. Errors highlighted. Service-entry transitions visible at color changes. HTTP status codes shown inline in the waterfall row.

**Density**: Not documented. Datadog waterfall screenshots are typical ~24–28px row height.

**Critical path**: Implicit through the flame graph's "execution time percentage" metric on each service node in the Map view, but not as a first-class "highlight critical path" toggle.

**Search**: Free text + key:value (`service:web-ui`, `language:(go OR python)`, `duration:>200ms`). Search matches highlight bars; arrows navigate between matches. Span links connect causally-related spans.

**Comparison/diff**: Not in the trace view directly; available via Watchdog Insights.

**Aggregation**: The expandable bottom panel docks **8 tabs** next to the trace: Span Info, Infrastructure (CPU/Memory/IO timeline overlay), Logs, Processes, Network, Security, Profiles, Span Links. This is the _densest_ surrounding context of any APM tool.

**Performance constraints**: Traces over 100MB automatically enter "Preview mode" — only critical/error/long-running/linked spans retained. So Datadog explicitly _gives up on full rendering_ past a threshold and shows a curated subset.

**Rendering tech**: DOM for the waterfall. The flame graph is Canvas-based (typical for flame charts).

### Lightstep / ServiceNow Cloud Observability

**Source**: Closed. Docs at docs.lightstep.com.

**Waterfall layout**: Flame graph as the primary visualization. Parent-child shown as nested colored bars (i.e., "icicle" layout — depth grows downward).

**Span bar styling**: Color by service. **Critical path drawn as a black line through the flame graph** — a distinctive visual treatment, since most tools highlight the critical-path _bars_; Lightstep draws an explicit line _through_ them. Errors render red. Missing spans render as red dashed boxes (Lightstep is one of the few that visualises data loss).

**Density**: Not documented. 4000-spans-per-parent hard limit on display.

**Critical path**: First-class. The black-line treatment is explicitly motivated by the fact that "a parent span might be waiting for a child span (or even a child of the child) to complete before it can finish."

**Span selection**: Click for right-side panel with attributes, latency contribution, events, logs, workflow links.

**Search/filter**: Filter by operation/service name, attribute search, hierarchy collapse.

**Comparison**: Available via Lightstep Notebooks (an aggregate analysis surface), not directly on the waterfall.

**Aggregation**: Service diagrams in Explorer, RED metrics from spans, span sample toggles from notebooks/dashboards. The trace view is one node in a richer analytical graph.

**Performance**: 4000-span hard cap per parent on display; dropped data shown as red dashed boxes.

**Rendering tech**: DOM/Canvas hybrid for the flame graph (inferred — not confirmed).

### Zipkin Lens

**Source root**: `https://github.com/openzipkin/zipkin/tree/master/zipkin-lens/src/components/TracePage/`

Components: `Header/`, `MiniTimeline/`, `Timeline/`, `SpanDetailDrawer/`, `SpanTable/`, `TickMarkers/`, `AnnotationTable/`, `AnnotationTooltip/`.

Specifically the timeline files: `Timeline/Timeline.tsx`, `TimelineHeader.tsx`, `TimelineRow.tsx`, `TimelineRowBar.tsx`, `TimelineRowAnnotation.tsx`, `TimelineRowEdges.tsx`.

**Waterfall layout**: Indented tree on left, bars on right. Lens was a 2019 rewrite of the classic Zipkin UI, explicitly modeled on Jaeger's UX after a UX workshop documented in the Zipkin Apache wiki ("Founding the new UI", Dec 2018).

**Time axis**: Top, with a separate **mini-map / mini-timeline** above the main timeline for zoom-to-region. This was the killer Lens feature, motivated by messaging spans where time-gaps separate clusters. Mini-map is **SVG-based** (chosen because "SVG is easier to debug than Canvas" per the Zipkin wiki).

**Span bar styling**: DOM divs. Each service is assigned a random color hash (no semantic color encoding). Annotations (events) used to render as bubbles on the bar; the 2019 Lens rewrite moved them into the SpanDetailDrawer, with some user pushback requesting bubbles back for quick scanning.

**Density**: ~28px row height (Material-UI-based).

**Long traces**: Heavy use of `React.memo` for re-render avoidance (PR #2736). For "super large traces" the team explicitly considered an incremental JSON parser and an absolute span-limit threshold (10k discussed) but didn't ship more aggressive virtualization than that.

**Critical path**: Not implemented.

**Span selection**: Click for inline expand below the row (Jaeger-style, deliberately copied) — the old Zipkin pop-out modal was rejected because it blocked the user's position in the trace.

**Search**: Span table view above the waterfall; text search within trace.

**Comparison/diff**: None.

**Aggregation**: Mini-timeline only.

**Performance**: ChartJS + Vizceral + custom UI. Memo-heavy. Practical ceiling: ~3–5k spans.

**Rendering tech**: DOM divs + SVG mini-map. Vizceral (WebGL) only for the service-topology view, not the trace timeline.

**Accessibility**: Minimal.

### Chrome DevTools Performance panel

**Source root**: `https://github.com/ChromeDevTools/devtools-frontend/tree/main/front_end/ui/legacy/components/perf_ui/` and `front_end/panels/timeline/`.

Key files:

- `front_end/ui/legacy/components/perf_ui/FlameChart.ts` — core Canvas2D renderer.
- `front_end/ui/legacy/components/perf_ui/ChartViewport.ts` — viewport, zoom, pan.
- `front_end/panels/timeline/TimelineFlameChartView.ts` — top-level Performance panel integration.
- `front_end/panels/timeline/TimelineFlameChartDataProvider.ts` and `…NetworkDataProvider.ts` — data adapters.
- `front_end/panels/timeline/overlays/OverlaysImpl.ts` — the DOM overlay layer on top of the canvas.

Not a distributed tracing tool — but the gold standard for in-browser flame charts and the explicit model Perfetto inherits from.

**Layout**: Layered tracks. Each track has groups; each group has levels; each level is a horizontal lane of entries.

**Rendering tech**: **Canvas2D**, not WebGL. The entire flame chart is one canvas with the timeline drawn into it. Hit testing via `coordinatesToEntryIndex()` on click. DOM is used only for the overlays (annotations, selection markers, tooltips) layered above the canvas — because DOM is fine for ~10 floating elements but disastrous for ~100,000 rectangles.

**Performance optimisations** (the things llmflow won't need but should know):

- Visible-range culling: only entries inside the current viewport are drawn.
- Group/level visibility flags: collapsed tracks skip iteration entirely.
- **Color batching**: same-color entries at the same level are drawn in a single `fillRect()` call. This is the secret. Canvas2D is fast not because it's GPU-accelerated but because `fillRect` is amortised.
- Typed arrays (`Uint8Array`) for dimming/highlight lookup tables.

**Density**: ~17px per level, packed tight.

**Long traces**: Designed to handle traces with **hundreds of thousands of events**.

**Critical path**: Has annotations and selection overlays, but no built-in "highlight critical path through async work" feature (that's Perfetto territory).

**Keyboard navigation** (most thorough of any tool surveyed):

| Key        | Action                        |
| ---------- | ----------------------------- |
| Arrow keys | Move between adjacent entries |
| Enter      | Select focused entry          |
| Escape     | Clear selection               |
| H          | Hide focused entry            |
| C          | Collapse children             |
| R          | Hide repeating descendants    |

Navigation auto-scrolls if the newly focused entry is outside the viewport. This is the model to copy if llmflow wants serious keyboard support.

**Search**: Filter by name with `Ctrl+F`; matches dim non-matching entries.

**Accessibility**: Canvas is intrinsically inaccessible to screen readers. DevTools addresses this with parallel DOM-based "Bottom-up", "Call tree", and "Event log" tabular views that are fully keyboard-and-screen-reader navigable. **The canvas is one of multiple equivalent views — not the only view.**

### Perfetto

**Source root**: `https://github.com/google/perfetto/tree/main/ui/`.

Key directories:

- `ui/src/frontend/` — Mithril.js top-level UI shell, sidebar, topbar, status bar.
- `ui/src/components/tracks/` — track rendering (where the canvas drawing lives; `DatasetSliceTrack` is the recommended base class for new tracks).
- `ui/src/components/flamegraph.ts`, `query_flamegraph.ts` — the flame graph panels.
- `ui/src/core/` — application logic.
- `ui/src/trace_processor/` — WebAssembly bridge to the C++ trace processor.

**Architecture**:

- **Mithril** virtual DOM for chrome (sidebar, panels, dialogs, status bar).
- **Canvas2D** for the actual track timeline area.
- **WebAssembly** trace processor (the same C++ binary that runs natively, compiled to WASM) for SQL queries over the trace.
- **Optional native escape hatch**: if Perfetto detects `trace_processor --httpd` on `127.0.0.1:9001`, the UI offloads parsing/processing to a native process via WebSocket, leveraging native SSE and full RAM. This is the only tool surveyed that has a graceful native-fallback path for "too big for the browser".

**Performance ceiling**: ~2 GB browser memory (typical WASM heap). With the native trace_processor, effectively unlimited. Hits sluggishness around 10x what Catapult (the predecessor) could do — millions of events.

**Time axis**: WASD keyboard pan/zoom (W/S zoom, A/D pan). "F" centers the viewport on the current selection. "." and "," step between events. Track find via `Ctrl+P` (fuzzy). Command palette `Ctrl+Shift+P`.

**Span/slice styling**: Canvas-rendered rectangles, with `colorizer.ts` driving the per-track color scheme. Slices have hatching for partial data, checkerboards for unknown ranges (`checkerboard.ts`).

**Selection**: Click a slice → bottom details panel. **"R" converts a single selection into an area selection**, exposing temporal bounds and per-track filtering — this is novel and unusually powerful. Area selections are then aggregated in the bottom panel into per-track summaries.

**Comparison**: Not really. Perfetto's strength is _one giant trace_.

**Aggregation views**: Distribution panels (`distribution_panel.ts`), aggregation adapters (`aggregation_adapter.ts`) — when you area-select, the bottom panel aggregates slice counts/durations per track.

**Accessibility**: Same as Chrome DevTools — the canvas is paired with SQL-queryable tabular views in the bottom panel.

**Rendering tech**: Canvas2D + WASM. Not WebGL. The Perfetto team's rationale (cribbed from devtools internals): Canvas2D's `fillRect` batching is fast enough, and WebGL adds shader complexity without much win for axis-aligned rectangles.

## Conventions every mature tool agrees on

These are the patterns no serious viewer deviates from:

1. **Two-column layout**: indented span tree on the left, time-aligned bars on the right. Width split is resizable. Universally adopted across Jaeger, Grafana, Zipkin Lens, Honeycomb, Datadog (waterfall view), Lightstep.

2. **Sticky time axis at the top** with ticks. Labels skipped when they'd overlap (Jaeger's `MIN_LABEL_SPACING_PX = 130` is a reasonable starting constant).

3. **Span bar = percentage-positioned div** with `left: X%; width: Y%`. Width math is `(span.duration / trace.duration) * 100`. No tool uses fixed pixel positions for the bars — percentages survive any container resize.

4. **Color encoding by service** (not status, not latency). Errors get a _secondary_ signal (icon, red overlay) rather than overriding the service color. Reason: in a microservice trace, "what service was running" is more useful for orientation than "did it error" (errors are sparse and already visible from the bar shape).

5. **Inline detail vs. drawer**: Inline expand-below-row (Jaeger, Zipkin Lens, Grafana inherited) or persistent right-side drawer (Honeycomb, Datadog, Lightstep). Both are accepted. Modal popups are universally rejected (this was Zipkin Lens's stated reason for the rewrite).

6. **Virtualization via custom ListView, not react-window**: Both Jaeger and Grafana wrote their own. Reason: they need per-row variable height (collapsed = 28px, expanded with inline detail = 161px or 197px) and react-virtualized was deemed too heavy.

7. **Search highlights, doesn't filter** (by default). Toggle to "show only matches" is offered as a secondary mode. Reason: users want context preserved while scanning matches.

8. **Time units auto-format**: ms / µs / s depending on trace duration. Hard-coded "ms" is a tell that you copied a tutorial.

9. **Span tree expand/collapse caret** in the left column, indented by depth. Always present, always at the same x-coordinate within a row regardless of depth (the tree itself shifts; the caret aligns).

10. **Mini-map / overview strip** above the main timeline. SVG (Zipkin Lens, Jaeger), with brush-to-zoom. The team that ships first without this gets a feature request for it within 6 months.

## Where tools diverge meaningfully

These are _real_ tradeoffs, not bikeshed nits.

1. **Inline detail row vs. right drawer**: Inline (Jaeger) keeps users in the timeline flow at the cost of vertical density (one expanded span = 5–7 collapsed rows of equivalent space). Drawer (Honeycomb) preserves density but eats horizontal space and forces the user's eyes off the bar to read attributes. For long, sparse traces → drawer. For short, fat traces with rich span attrs → inline.

2. **Multiple visualizations vs. one canonical waterfall**: Datadog (4 views: flame, list, waterfall, map) vs. Jaeger (one waterfall). Multi-view costs eng work and adds a "which one do I use?" UX tax, but it pays off for performance debugging because the flame graph answers "where did time go" instantly while the waterfall answers "what called what". For an LLM viewer where most traces are linear LLM calls, **the waterfall alone is enough** — there's rarely deep nesting.

3. **Critical path: explicit highlight (Grafana) vs. black-line-through (Lightstep)**: Both work. The line is more visually distinct in dense traces. The overlay-on-bar is less intrusive in sparse traces.

4. **DOM vs. Canvas**: DOM (all the APMs) wins for accessibility, easy CSS theming, simple hit testing, and dev velocity. Canvas (Chrome DevTools, Perfetto) wins for >10k entries. The crossover is roughly 2–3k spans for unoptimised React DOM, 5–10k spans for memoised DOM with virtualization. **Below 5k, DOM is a strictly better choice.** Above 50k, Canvas is the only choice.

5. **Filter pills vs. text-only search**: Pills (Grafana, Honeycomb) lower the discoverability cost — users can see which filters exist. Pure text search (Jaeger) is more flexible but requires users to know the search grammar. Pills with a free-text fallback is the dominant pattern in 2026.

6. **Keyboard nav: serious (Honeycomb, Perfetto, Chrome) vs. nothing (Jaeger, Zipkin)**: This split correlates with whether the tool's primary users are "power users who live in the tool" or "occasional debuggers".

7. **Trace size cap policy**: Datadog (preview mode, curated subset), Lightstep (4000 spans/parent hard cap, show dropped data), Perfetto (offload to native), Jaeger/Grafana/Zipkin (just get slow). Communicating partial data well is its own design problem; Lightstep's red-dashed-box for dropped spans is the best solution I've seen.

## Rendering tech comparison

| Tool            | Renderer                                            | Why                                                                         | Practical ceiling                         |
| --------------- | --------------------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------- |
| Jaeger          | DOM divs (% widths) + SVG mini-map                  | React DOM is fast enough up to a few thousand spans; SVG is easier to debug | ~3–5k spans                               |
| Grafana Tempo   | DOM (Jaeger fork)                                   | Same as Jaeger                                                              | ~3–5k spans                               |
| Honeycomb       | DOM (inferred)                                      | Accessibility, theming                                                      | Not documented; bounded by service limits |
| Datadog APM     | DOM (waterfall) + Canvas (flame graph)              | Best tool for each job; preview mode for huge traces                        | Hard cap 100MB / preview mode             |
| Lightstep       | DOM/Canvas hybrid (inferred)                        | Critical-path line treatment needs absolute positioning                     | 4000 spans/parent                         |
| Zipkin Lens     | DOM + SVG mini-map + Vizceral WebGL (topology only) | "SVG is easier to debug than Canvas" — explicit team statement              | ~3–5k spans                               |
| Chrome DevTools | Canvas2D + DOM overlays                             | Hundreds of thousands of events; `fillRect` batching                        | ~hundreds of thousands                    |
| Perfetto        | Canvas2D + Mithril DOM + WASM trace processor       | Same as Chrome, plus native escape hatch for >2GB traces                    | ~2GB WASM, unlimited with native          |

## Lessons for llmflow specifically

**llmflow's constraints:**

- Local-first, single-user, single-tenant.
- Realistic upper bound: ~few thousand spans per trace.
- Schema: `(id, trace_id, parent_id, timestamp, duration_ms, span_type, span_name, model, prompt_tokens, completion_tokens, estimated_cost, tags, attributes)`.
- The data is _richer per span_ than a typical APM trace (cost, tokens are first-class).
- LLM traces are usually shallow and wide (root → many siblings) or linear (chain of calls), rarely the deep call stacks of microservices.

**Patterns that transfer:**

1. **Copy Jaeger's two-column layout wholesale**. Left: indented tree with span name + model badge + token count + cost. Right: bars on a percentage-positioned timeline. Sticky time-axis header. This is the proven baseline and you should not reinvent it.

2. **DOM with virtualization, not Canvas**. At a few-thousand-span ceiling, DOM is faster to ship, easier to style, and accessible by default. Use a custom virtualization layer like Jaeger's `ListView` if you need variable row heights for inline detail; use `@tanstack/react-virtual` or `react-window` if all rows are fixed-height with a drawer-style detail panel.

3. **Time-unit auto-format**. Use ms for traces > 100ms, µs below. LLM calls are typically 100ms–60s so ms or s, but evaluation runs with mocked clients can be sub-millisecond.

4. **Span color by `span_type`**, not by `model`. `span_type` is the analogue of "service" in APM terms (chat, embed, tool*call, retrieval, agent). Model gets a \_badge* in the name column. This frees up color encoding for the semantic dimension that matters most for visual orientation.

5. **Cost-aware row decoration**: put `$0.014` or token counts right-aligned in the name column. The Datadog "HTTP status inline in the row" pattern is exactly the right shape — display the most-actionable per-span numeric _in the row_, not buried in a detail panel.

6. **Critical path is overkill for LLM traces**. The "critical path" in an LLM trace is almost always trivially the longest chain — there's rarely meaningful parallelism worth highlighting. Skip this. (Revisit if/when llmflow gains parallel-agent traces.)

7. **Sticky time-axis ticks** with skip-when-overlap (lift Jaeger's `MIN_LABEL_SPACING_PX = 130` directly).

8. **Inline expand-below-row** for span detail beats a right-side drawer, because LLM spans contain _prompt + response text_ which wants to be wide and tall, not narrow and tall. An inline expansion can render 800px-wide markdown comfortably; a drawer would be ~400px and force wrapping.

9. **Keyboard nav**: copy Honeycomb's model (arrow up/down between spans, left/right collapse/expand, Enter for actions, `?` for help). Power users will love you for it.

10. **Search highlights, doesn't filter**, with a toggle to "show only matches" — the universal pattern. Pills for span_type and error-status are worth the eng cost; text search is the long tail.

**Patterns that are overkill:**

1. **Canvas/WebGL**. You will never hit the rectangle count where DOM stops being fine. Spend the eng cycles on better aggregation panels instead.

2. **Custom WebAssembly trace processor à la Perfetto**. You already have SQLite. Run aggregation SQL on demand; render results with regular DOM components.

3. **Mini-map / overview strip with brush zoom** — useful for traces with time-gaps (Zipkin Lens added it for messaging spans). LLM traces rarely have time-gaps that matter; a simple "fit to viewport" / "1x zoom" toggle is enough.

4. **Multi-view (flame + waterfall + list + map)**. LLM traces are too shallow for a flame graph to add information over a waterfall. Pick one canonical view and execute it well.

5. **Trace diff / comparison**. Useful for regression debugging but a v2 feature. Not worth blocking v1 on.

6. **BubbleUp-style attribute-delta analysis**. Brilliant for high-cardinality APM data; less useful when your tags are mostly `model`, `provider`, `temperature`. Maybe relevant when llmflow starts comparing eval runs.

**Patterns specific to LLM observability that no APM tool has:**

1. **Per-span cost + tokens displayed inline in the row**. Datadog shows HTTP status inline; you should show `$cost · in/out tokens`. This is the single biggest UX difference between APM and LLM observability — APM cares about latency; LLM cares about latency, cost, and quality simultaneously, and the trace viewer needs to make all three legible at a glance.

2. **Prompt/response in the inline detail row**. With syntax highlighting for JSON, optional markdown rendering for completion text, and a copy button. This is the LLM equivalent of "view stack trace" — the artefact users actually need to see.

3. **Cost-by-model histogram adjacent to the waterfall**. The most useful "aggregation view" for LLM traces is breaking down spend per model within a trace — Honeycomb's heatmap-by-field is the closest equivalent.

4. **Time vs. token-rate two-axis bar**. Optional toggle: visualise span width by `output_tokens / duration_ms` (effective throughput) instead of pure duration. Reveals "slow because slow" vs. "slow because long output".

## Open questions

1. **Sub-millisecond spans**: llmflow's `duration_ms` field is integer. Cached calls and local-mock spans can be 0ms. How does the viewer render a 0ms span? Min-width pixel (Jaeger doesn't have one, gets 1px slivers) or merge into the parent visually with a marker?

2. **Streaming traces / partial data**: If a span is in-progress (no end timestamp), how is it rendered? Lightstep's "red dashed box for dropped data" is a precedent — does the same UX work for in-flight spans, or do we need a different visual (e.g., a moving gradient on the bar)?

3. **Span tree shape**: Do real llmflow traces favour shallow-and-wide (LangChain agent fanning to many tools) or linear (chained completions)? This determines whether `SpanTreeOffset`-style indentation is even useful or whether a flat list ordered by start-time is sufficient. _Sample 20 real traces from the llmflow examples before settling on tree-vs-flat._

4. **Attribute schema for inline rendering**: `tags` and `attributes` are flexible JSON. Which keys deserve to be promoted to first-class row decorations (cost, tokens, model — agreed) vs. which live only in the detail panel? Worth a separate ADR.

5. **Theme: dark-first or light-first?** All APMs surveyed default to either (Honeycomb light, Grafana/Datadog dark). llmflow being a local dev tool likely wants dark-first, matching VS Code / DevTools conventions.

6. **URL state**: Should the selected span ID be in the URL hash (Jaeger does this for deep linking)? In a local-first tool with no sharing, the answer might be "no, just localStorage".

7. **Performance budget**: At what span count does the v1 viewer start feeling slow? Worth setting a target (e.g., "1500 spans should render under 100ms; selection should be under 16ms") and measuring before architecture decisions calcify.

## Sources

- [Jaeger UI source](https://github.com/jaegertracing/jaeger-ui/tree/main/packages/jaeger-ui/src/components/TracePage/TraceTimelineViewer)
- [Grafana TraceView source](https://github.com/grafana/grafana/tree/main/public/app/features/explore/TraceView/components/TraceTimelineViewer)
- [Grafana critical-path PR #76857](https://github.com/grafana/grafana/pull/76857)
- [Grafana trace visualization blog (2023)](https://grafana.com/blog/2023/08/08/whats-new-in-distributed-trace-visualization-in-grafana/)
- [Grafana Tempo span filters docs](https://grafana.com/docs/grafana/latest/datasources/tempo/span-filters/)
- [Honeycomb trace waterfall docs](https://docs.honeycomb.io/reference/honeycomb-ui/query/trace-waterfall)
- [Honeycomb keyboard shortcuts changelog](https://changelog.honeycomb.io/keyboard-shortcuts-for-navigating-spans-212346)
- [Honeycomb BubbleUp](https://www.honeycomb.io/platform/bubbleup)
- [Datadog Trace View docs](https://docs.datadoghq.com/tracing/trace_explorer/trace_view/)
- [Lightstep / ServiceNow Cloud Observability trace docs](https://docs.lightstep.com/docs/view-traces)
- [Zipkin Lens TracePage source](https://github.com/openzipkin/zipkin/tree/master/zipkin-lens/src/components/TracePage)
- [Zipkin Lens design notes (2018)](https://cwiki.apache.org/confluence/display/ZIPKIN/2018-12-03+Founding+the+new+UI)
- [Chrome DevTools flame chart deep-dive](https://deepwiki.com/ChromeDevTools/devtools-frontend/5.1.2-flame-chart-visualization)
- [Perfetto large-traces docs](https://perfetto.dev/docs/visualization/large-traces)
- [Perfetto UI docs](https://perfetto.dev/docs/visualization/perfetto-ui)
- [Perfetto UI plugin / development guide](https://perfetto.dev/docs/contributing/ui-getting-started)
