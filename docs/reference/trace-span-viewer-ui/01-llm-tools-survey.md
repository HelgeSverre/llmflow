# LLM Observability Trace Viewer Survey

> Research conducted May 2026. Sources: docs + source code (where open) for Langfuse, Phoenix (Arize), LangSmith, Helicone, W&B Weave, and Comet Opik.
> Intended audience: designers/engineers building llmflow's trace viewer. Cross-references to `/Users/helge/code/llmflow/src/db.ts` throughout.

## Executive Summary

Across all six tools the dominant pattern is a **three-pane "IDE for traces" layout**: a left rail with a span tree (hierarchical, indented, virtualised), a center detail panel for the selected span (almost always tabbed: input / output / attributes / events), and an optional right sidebar for cross-cutting metadata (annotations, feedback, scores, conversation view). Langfuse, Phoenix, LangSmith, Helicone, Weave and Opik all converged on this layout independently, which is strong evidence that it is the local optimum for the task. The tree-on-the-left convention is so strong that **none of the six** ship a "graph view" as the default; graphs (Langfuse LangGraph view, Phoenix agent graph, Weave graph view) are always an _alternate_ mode you switch into.

The deepest disagreement is **timeline-as-tree vs timeline-beside-tree**. Two camps:

1. **Phoenix, LangSmith, Helicone (Tree view)** put a short fixed-width latency bar _inside the tree row_ (Phoenix uses a 150px right-aligned strip per row containing `LatencyText` + `SpanTimelineBar`). The bar is small, secondary, and primarily a visual cue for "this span is the slow one." Cost / tokens are inline next to the name. This is the _attribute-dense_ school.
2. **Langfuse (Timeline view), Helicone (Span/Gantt view)** offer a separate "waterfall" mode where rows are deliberately sparse and bars span the full width of a horizontally-scrolling pane, with a sticky time axis at the top. Langfuse uses `@tanstack/react-virtual` with `estimateSize: 42` and `overscan: 500` for the rows, scroll-syncs the header, and pre-computes `startOffset` / `itemWidth` / `firstTokenTimeOffset` for every row during a flattening pass (`timeline-flattening.ts`). This is the _temporal-fidelity_ school.

Langfuse and Weave both _also_ offer the dense tree view, so the strongest tools give the user a toggle. Helicone forces a choice via tabs. Phoenix sticks resolutely with one view and adds graph/code/flame-graph as separate visualisations.

The strongest opinions I formed:

- **Two views is the right answer**: a dense tree (attributes inline) for "what happened" + a sparse timeline (bars, sticky scale) for "where did the time go." Forcing one to do both produces clutter and lost vertical pixels.
- **Streaming first-token-time deserves a visual segment in the bar.** Langfuse splits the bar into `firstTokenWidth` + `completionWidth`. Nobody else does this, and it is the single most useful trace-viewer feature for LLM-specific debugging — TTFT vs total latency is the dominant SRE conversation in 2026.
- **Cost as a tree-row column is non-negotiable.** Langfuse, Weave, and Opik all show it inline. Phoenix shows it in the header only. Helicone doesn't show it on the row at all (a gap). For llmflow's `estimated_cost` field this should be inline, right-aligned, with a heat-map color when above a project threshold.
- **The "conversation view" is a tab, not a sidebar.** LangSmith (M/T/D shortcuts → Messages / Turns / Details), Opik (Thread view), Weave (does not have a dedicated chat view) — the strongest implementations make the chat reconstruction a _peer view_ to the span tree, not a third panel competing for pixels.
- **Comparison features are uniformly weak.** None of the six expose a side-by-side diff of two traces from the trace viewer itself. LangSmith and Langfuse both push trace comparison into a _dataset/experiment_ surface, not the trace UI. This is an opportunity.

## Per-tool deep dive

### Langfuse

Source: open. Repo `langfuse/langfuse`, web in `web/src/components/trace/`.

**Architecture (`web/src/components/trace/Trace.tsx`).** The root `Trace` component owns a responsive two-panel layout that swaps between `TraceLayoutDesktop` and `TraceLayoutMobile`. Desktop is horizontally resizable: `<TraceLayoutDesktop.NavigationPanel>` (the tree or timeline) → `<TraceLayoutDesktop.ResizeHandle>` → `<TraceLayoutDesktop.DetailPanel>`. Mobile is a vertical accordion that stacks the same panels. An optional `TraceGraphView` slot renders as _secondary content inside the navigation panel_ when LangGraph metadata is present (`shouldShowGraph = showGraph && isGraphViewAvailable`). Data flows via three React contexts: `TraceDataContext`, `SelectionContext`, `ViewPreferencesContext` — clean separation of "what the trace is" / "what's selected" / "user toggles."

**Tree view (`web/src/components/trace/components/TraceTree.tsx`, `SpanContent.tsx`).** TraceTree is a thin composition of `VirtualizedTree + VirtualizedTreeNodeWrapper + SpanContent`. The interesting code is `SpanContent.tsx` — the _row_. Every row is a `<button>` (correct: it's a primary actionable element) with class:

```
peer relative flex min-w-0 flex-1 items-start rounded-md py-0.5 pr-2 pl-1
```

Layout left-to-right inside the row: span name (`text-xs`, fallback `Unnamed {type}`), duration (`text-xs text-muted-foreground`, formatted via `formatIntervalSeconds`, optional heat-map color via `heatMapTextColor()`), cost (prefixed with `∑ ` on TRACE/parent nodes; formatted with `usdFormatter`), tokens (`formatTokenCounts` for in/out/total), a small status badge (only shown when level ≠ DEFAULT, with `LevelColors` styling: `rounded-sm p-0.5 text-xs`), optional `GroupedScoreBadges compact` and `CommentCountIcon`. All numeric metadata is `text-xs` muted — name dominates by being the only non-muted text. Heat-map text coloring is the visual hook: longest/most expensive items glow.

User toggles in `TraceSettingsDropdown.tsx` (7.3KB!) control `showDuration` / `showCostTokens` / `showScores` / `showComments`. Lesson: every metric on the row is opt-out, not opt-in.

**Timeline view (`web/src/components/trace/components/TraceTimeline/`).** This is the Gantt-style view, separate from the tree. Eight files; the brains are:

- `timeline-flattening.ts` produces `FlatTimelineItem[]`. Each item carries `{ node, depth, treeLines: boolean[], isLastSibling, metrics: { startOffset, itemWidth, firstTokenTimeOffset?, latency } }`. **Pre-computing positional pixel offsets at flatten time is the trick that makes 1000-span traces scroll smoothly.** The `treeLines` array tells the renderer which ancestor levels need a vertical sibling line — this is how you draw the L-shape connectors without re-walking the tree per row.
- `index.tsx` uses `@tanstack/react-virtual`'s `useVirtualizer` with `estimateSize: () => 42` and `overscan: 500`. The 500px overscan is aggressive (most apps use 5-10) and signals their priority is "no flash when scroll-jumping," not memory frugality. Rows are absolutely positioned with `transform: translateY(${virtualRow.start}px)`.
- Scroll sync between the sticky `TimelineScale` header and the content body is manual: `contentRef.current.scrollLeft = e.currentTarget.scrollLeft` on the scroll handler. No library — just a paired-scroll handler.
- `TimelineScale.tsx` renders tick marks via `Array.from({ length: numMarkers })` with `numMarkers = Math.ceil(scaleWidth / STEP_SIZE) + 1`, each as an absolutely positioned `border-l` div. Labels are `text-xs text-muted-foreground` with two-decimal-second precision (`{timeValue.toFixed(2)}s`), and the full-precision value is in the `title` attribute for hover.
- `TimelineBar.tsx` — width is `${itemWidth || 10}px` (with a 10px floor; below that the bar is invisible). Streaming spans get split: a `firstTokenWidth` sub-bar + a `completionWidth` sub-bar. Selected state uses `ring-primary-accent ring-3`; hover is `group-hover:ring-tertiary group-hover:ring-3`. Bar contents (inside the bar itself): `text-primary text-sm font-medium` name, `ItemBadge` for type, optional `CommentCountIcon`, duration text, USD cost, up to 3 `GroupedScoreBadges`.

**Detail panel.** When you click a span, the right panel (`ObservationDetailView/`) opens with input/output rendering via `IOPreview/` (markdown / JSON / chat-message rendering depending on detected shape). `ToolCallInvocationsView.tsx` (2.9KB) handles tool calls — a separate visualisation for that specific span type.

**Search within trace (`TraceSearchList.tsx` + `TraceSearchListItem.tsx`).** ~5KB combined. Supports finding observations by type, ID, or name (per the March 2025 changelog). Not regex from what I can see — substring.

**Performance.** GitHub issue [#3513](https://github.com/langfuse/langfuse/issues/3513) is the canonical reference: they explicitly acknowledge that ~1k-span deeply nested traces had toggle latency problems and that virtualisation is the recommended fix. The virtualizer is present today; the issue describes the path to getting there.

**Mobile.** Yes — `TraceLayoutMobile` is a real implementation, an accordion stack of the same panels. The timeline view is still rendered horizontally on mobile (with horizontal scroll); they did not adapt the bars vertically.

**Maps to llmflow:** Langfuse's `node` shape ≈ llmflow's `Trace` row. Their `metrics.startOffset` / `itemWidth` / `firstTokenTimeOffset` are pre-computed at flatten time — llmflow currently has only `timestamp` and `duration_ms`, no first-token-time field. **Recommendation: add `first_token_ms INTEGER` to `traces` table** (OTLP captures it as `gen_ai.response.time_to_first_token` event) so we can do the split-bar trick.

### Phoenix (Arize)

Source: open. Repo `Arize-ai/phoenix`. Trace pages in `app/src/pages/trace/`; the actual reusable tree component lives in `app/src/components/trace/TraceTree.tsx`.

**Architecture (`app/src/pages/trace/TraceDetails.tsx`).** Three-panel horizontal resizable layout via `<Group orientation="horizontal">` with `<Separator>` dividers. The panels are: (1) **Trace Tree** at 30% default / 5% minimum, (2) **Span Details** flexible center, (3) **Agent Chat** right sidebar. Sizes persist to localStorage via `useDefaultLayout()`. URL is the source of truth for selection: clicking a span calls `setSearchParams((searchParams) => { searchParams.set(SELECTED_SPAN_NODE_ID_PARAM, span.id) })`. **This is correct and llmflow should copy it** — URL-based selection makes traces shareable and back-button-navigable.

Above the panels: `TraceHeader` with `<SpanStatusBadge statusCode={statusCode} labelVariant="full" />`, total `latencyMs`, total `costSummary` (with a tooltip that breaks down prompt/completion cost separately), and a "View Session" link when the trace belongs to a session.

**Tree (`app/src/components/trace/TraceTree.tsx`, `SpanTreeItem`).** Each row is a clickable div containing, left to right: `SpanKindIcon` (icon set by span kind — LLM, retriever, embedding, tool, reranker, chain), span name (`font-weight: 500`, `var(--global-text-color-900)`, ellipsis on overflow), conditional `SpanStatusCodeIcon` if status === ERROR, conditional `SpanTokenCount`, a fixed-width timing strip, and a collapse toggle.

Indent is via inline style:

```css
margin-left: calc((${props.nestingLevel} * var(--trace-tree-nesting-indent)) + 16px);
```

Vertical connector lines (the "L"s that draw the tree skeleton) are absolutely positioned at `left: ${nestingLevel * NESTING_INDENT + 29}px`. Error spans use `var(--global-color-danger)` for both connector and icon — this is a nice trick: **the line itself goes red when a descendant errors**, giving you an at-a-glance failure path.

Selected state: `background-color: var(--global-color-gray-200)` + `border-left: 4px solid var(--global-color-gray-300)`. Hover: `background-color: var(--global-color-gray-75)`.

The timing strip is a flex row, `width: 150px; flex: none; gap: var(--global-dimension-static-size-100)` containing `LatencyText` + `SpanTimelineBar`. The bar color is computed from span kind via `useSpanKindColor({ spanKind })`. **The fixed 150px right rail is Phoenix's strongest opinion** — no horizontal scroll, no separate timeline view, just a tiny consistent strip that always shows you the bar.

**Detail panel (`SpanDetails.tsx`).** Four tabs:

1. **Info** — content varies by span kind: LLM spans show input/output messages + tool schemas + prompts + invocation parameters in nested tabs; retriever spans show query + retrieved documents with retrieval metrics; reranker spans show query, input docs, reranked output docs; embedding spans show embedded text; tool spans show name + description + parameters + input + output; generic spans use the simple `<SpanIO>`.
2. **Annotations** — `<SpanFeedback>` for feedback/evaluations.
3. **Attributes** — `<AttributesJSONBlock>` (read-only JSON, syntax-highlighted, copy button).
4. **Events** — `SpanEventsList` with a counter highlighting exception events.

Input/output rendering is MIME-aware: `json` → `<ReadonlyJSONBlock>`; `text` → `<ConnectedMarkdownBlock>`. Both have copy-to-clipboard. Failed spans get a status-message alert at top.

**Pagination over spans (`ConnectedTraceTree.tsx`, `PAGE_SIZE = 1000`).** They use a Relay `usePaginationFragment` and show an alert at the top: `"Viewing {totalSpansViewing} of {totalSpans} spans"` with a load-more button. **This is unusual — most tools load the entire trace at once.** Phoenix explicitly handles the >1000-span case by paginating _server-side_. Worth considering for llmflow when a trace has thousands of spans.

**Comparison / sessions.** Phoenix has the richest session model: `SessionPage.tsx`, `SessionDetails.tsx`, `SessionDetailsTraceList.tsx`, `SessionDetailsTracesView.tsx`, `SessionViewTabs.tsx`. A session is a list of traces that you can scroll through. There is also `TraceDetailsPaginator.tsx` for next/prev arrows between traces.

**Mobile.** No explicit mobile-first layout. The resizable Group at 5% min width can collapse the tree panel to nearly nothing, but I see no equivalent of Langfuse's `TraceLayoutMobile`.

**Maps to llmflow:** Phoenix's `spanKind` (LLM/RETRIEVER/RERANKER/EMBEDDING/TOOL/CHAIN/AGENT) is a richer taxonomy than llmflow's `span_type` (defaults to `'llm'`). **Recommendation: align llmflow's `span_type` enum with OpenInference SemConv** (`LLM`, `RETRIEVER`, `RERANKER`, `EMBEDDING`, `TOOL`, `CHAIN`, `AGENT`, `GUARDRAIL`) — this makes icon/color selection trivial and gives us free interop with OpenInference-instrumented apps.

### LangSmith

Source: **closed**. Docs at docs.langchain.com/langsmith.

The closed source forces conjecture, but the docs are clear about the data model and UI affordances.

**Data model: the "Run Tree."** A "run" is LangSmith's unit (= span elsewhere). Every run has parent/child relationships forming a tree, with inputs/outputs/total tokens/cost/start/end-time/errors. The `@traceable` Python decorator generates the tree automatically. Streaming token events are also recorded.

**Three views switchable by keyboard shortcut** (per docs):

- **M (Messages)** — chat-style thread showing user/assistant messages, tool calls, and subagent activity. This is the conversation view.
- **T (Turns)** — each conversational _turn_ as a summary card with inputs/outputs. (A turn ≈ a thread segment from one user message to the next.)
- **D (Details)** — the debug layer: metadata, timing, errors, child runs, thread context.

**This three-mode toggle is the most polished I saw.** It treats the trace not as a single document but as three projections of the same data, with one-key switching. Strongly recommend stealing this.

**Threads.** LangSmith has a first-class "Thread" concept above traces; threads group related runs that share a `session_id`. The Messages view operates at the thread level, not the run level.

**Pre-built dashboards.** Every project gets an auto-generated dashboard for trace counts, error rates, token usage, costs, tool performance. Custom dashboards are user-buildable.

**Anomaly detection ("Insights").** LangSmith ships a proactive alerts/Insights surface that flags anomalies. None of the open-source tools have this; it's a paid-product feature.

**Comparison.** LangSmith pushes comparison to _experiments_ (dataset-based). The docs do not describe a "diff two arbitrary traces" feature in the trace viewer itself.

**Performance, mobile.** Not publicly documented. Anecdotally smooth on traces of a few hundred spans; large-trace behaviour unknown.

**Maps to llmflow:** LangSmith's "thread" maps to llmflow not having anything quite equivalent — we have `trace_id` for grouping spans, but no notion of _a conversation across multiple traces_. **Recommendation: add a `thread_id` column** (nullable) so we can group traces into a multi-turn conversation. The Messages view becomes possible only with this.

### Helicone

Source: open. Repo `Helicone/helicone`, web in `web/components/templates/sessions/sessionId/`.

Helicone calls a multi-step LLM workflow a "Session," and the session detail page is structured into three sub-views:

```
web/components/templates/sessions/sessionId/
├── SessionContent.tsx          ← header + footer + view container
├── Span.tsx                    ← Gantt timeline view (31KB!)
├── breadCrumb.tsx
├── Chat/                       ← conversation view
├── Timeline/                   ← table-style timeline
└── Tree/                       ← hierarchical tree view (Tree.tsx, TreeView.tsx, RequestNode.tsx, PathNode.tsx)
```

**Important:** `SessionContent.tsx` does _not_ toggle between views. It only renders `<TreeView>`. The Chat/Timeline/Span views are routed separately and accessed via top-level tabs higher in the navigation. So Helicone forces you to _navigate_ between views rather than toggle in place. This is a worse UX than Langfuse's in-place toggle.

**Tree (`Tree/Tree.tsx` + `Tree/RequestNode.tsx`).** The tree is recursive: each level creates 24px-wide vertical divider columns via `new Array(level).fill(null).map(...)` — each iteration is `<div class="h-9 w-[24px] shrink-0">`. Vertical connector lines are absolutely positioned: `absolute right-[0px] top-0 z-[2] h-9 w-[1px]`. Background: `font-sans border-t border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-black`; selected: `bg-sky-100 dark:bg-slate-900`.

A `RequestNode` row contains (in order):

- Type badge (LLM / Tool / Vector DB) — `rounded-md px-2 py-1 text-xs font-medium`
- Model name or label — `max-w-[200px] truncate` with a tooltip
- Latency in parens
- `<StatusBadge>` for HTTP status

Padding: `px-4 py-[8px] pl-4`, `gap-2` between elements.

Type badge colors (hardcoded by type):

- **LLM**: `bg-sky-200 dark:bg-sky-900 text-sky-700 dark:text-sky-200`
- **Tool**: `bg-slate-200 dark:bg-slate-900 text-slate-700 dark:text-slate-200`
- **Vector DB**: `bg-orange-200 dark:bg-orange-900 text-orange-700 dark:text-orange-200`

**The gap:** RequestNode does NOT show tokens or cost. Only type, label, latency, status. For a billing-aware tool this is a curious omission.

**Timeline view (`Timeline/`, via `TreeView.tsx`).** A `<ResizablePanelGroup direction="horizontal">` with a `SessionTimelineTable` (columns: Response preview, Status, Created At with hover-for-full-date, Model, Latency) and a `RequestDrawer` that slides in on the right when you click a row. Drawer width is local-storage-persisted.

**Span view (`Span.tsx`, 31KB).** Helicone's Gantt-style timeline is built on **Recharts** (`BarChart` with `layout="vertical"`), not on a hand-rolled SVG/canvas. Each bar is a row at `BAR_SIZE = 25` pixels. Bar position computed as `start = (startMs - startTimeMs) / 1000`, duration in seconds. Labels via `<LabelList dataKey="name" position="insideLeft">`. Error bars get a `❌` emoji badge (yes, an actual emoji). Colors come from a per-path color-map store (`getColor(entry.path)`) — so each unique API path gets a stable distinct color across sessions. Hover dims to 50% opacity. A semi-transparent blue reference area (`rgba(14, 165, 233, 0.2)`) supports time-range selection for realtime sessions.

**The downside of Recharts for this** is that it does not virtualise well at 1000+ rows and bar widths are computed by Recharts' scale, not pre-computed. Helicone gets cheap implementation but pays performance for very long sessions. Not a pattern to steal.

**Mobile.** No specific mobile layout I could find.

**Maps to llmflow:** Helicone's `path` field (the API path) drives its color assignment. llmflow has `request_path` — we could use this for the same trick. **Recommendation: in the timeline view, color bars by a stable hash of `request_path` (or `span_name`) rather than by span_type alone.** This gives the user visual continuity across traces.

### W&B Weave

Source: open. Repo `wandb/weave`. Docs at weave-docs.wandb.ai. (Source fetches were rate-limited by GitHub during this research; conclusions are docs-driven.)

**Three-panel layout:**

- **Left:** sortable, paginated list of _all_ trace runs in the project (not just spans in the current trace — note this is different from everyone else, who put the cross-trace list on a separate page).
- **Center:** the trace itself.
- **Right:** detail panel for the selected op, with tabs: **Call / Code / Feedback / Scores / Summary / Use**.

The "Use" tab is unique — it shows the original SDK call site and the code that produced this op.

**Four interchangeable visualisations of the trace** (toggle in upper right):

1. **Default trace view** — stack hierarchy, cost per op, execution time, status indicators (this is the tree-view equivalent).
2. **Code view** — boxes nested by call structure; clicking a box drills into that op and filters the call path. Helpful for understanding flow.
3. **Flame graph** — timeline-based depth-vs-duration visualisation; clicking frames isolates sub-traces. This is the closest to a true waterfall.
4. **Graph view** — node-graph of op relationships.

**Scrubbers (the strongest opinion in Weave).** Below the tree there's a panel of _navigation scrubbers_ — slider controls for moving between calls along different axes:

- **Timeline** — chronological order of all events
- **Peers** — ops of the same type elsewhere in the trace
- **Siblings** — ops with the same parent
- **Stack** — traverse up/down the call stack from the selected op

Each scrubber has a slider plus `>` jump buttons. **This is brilliant and nobody else has it.** It treats span navigation as a multi-dimensional problem (time / type / hierarchy / depth) and gives you a control surface for each. Strongly recommend stealing the _concept_ of multi-axis scrubbers even if the implementation differs.

**Filter** at the top of the trace tree: "Filter by op name" — substring search across the visible tree, isolates tool/LLM calls.

**Threads.** Weave has a "Threads" concept (separate page) but the trace view does _not_ render a chat conversation natively. Threads are for grouping; the actual conversation rendering is up to the Call detail panel.

**Comparison.** Not surfaced in the trace viewer per se — comparison happens via `Calls table → select two rows → compare`, which opens a side-by-side diff. The diff is column-by-column on op inputs/outputs.

**Mobile, performance.** Not explicitly documented.

**Maps to llmflow:** Weave's `Op` ≈ llmflow's `span_name` + `span_type`. Their _Use_ tab requires source-location metadata that llmflow does not capture today. **Recommendation: when llmflow ingests OTLP, capture `code.filepath` / `code.lineno` / `code.function` attributes from the OpenTelemetry semantic conventions if present.** Cheap to store, makes a future Use-tab possible. Also, **the scrubber concept is the single highest-leverage UI idea in this survey** — adding "next sibling," "next peer (same span_name)," and "jump to error" keyboard shortcuts/scrubbers would punch far above their implementation weight.

### Comet Opik

Source: open. Repo `comet-ml/opik`. Frontend in `apps/opik-frontend/`. (Direct source fetches returned no listing — likely path differences. Docs gave the UI picture.)

**Conceptual model:** Trace > Span > Thread. A trace is one request-response cycle; spans are nested operations inside it; threads group related traces by `thread_id` (conversation). Span types: `general`, `tool`, `llm`, `guardrail`. The `guardrail` type is unique to Opik — useful for showing safety/policy spans visually distinct from LLM work.

**Unified Logs View (recent, per changelog):** Opik merged Traces / Threads / Spans into a single "Logs" tab. So instead of separate pages per concept, the user navigates one unified surface and filters by entity type. This is a strong simplification — and a pattern llmflow could adopt because we _also_ have traces + logs + metrics tables today.

**Detail panel** (per docs and the SDK reference): inputs, outputs, token usage (OpenAI-formatted: `prompt_tokens` / `completion_tokens` / `total_tokens`), cost (USD, with `total_cost` field on the span taking priority over Opik's auto-computed cost from token usage), `error_info` dict on failed spans, metadata, tags, attachments (yes — arbitrary file attachments to spans, e.g. uploaded images or transcripts).

**Span-level metrics.** Opik supports attaching evaluation scores (LLM-as-judge or code-based) to _individual spans_, not just the whole trace. The UI surfaces these inline. This is the second-strongest opinion after Weave's scrubbers — and the right level of granularity for "the retrieval step is fine; the reranker is what's broken."

**LangChain tool descriptions.** A 2026 update auto-extracts tool descriptions from LangChain and surfaces them on tool spans — so the row shows not just "tool: search_web" but the actual description text from the tool's docstring. Tiny detail, huge for understanding.

**Export.** CSV/JSON export available directly from Trace/Thread/Span Detail Views. UI is page-size-bound: max 100 traces or spans per export action.

**Comparison.** No explicit two-trace diff in the docs. The Experiments surface handles comparison via datasets.

**Mobile, performance.** Not documented in detail. Opik has had a bug ([issue #2771](https://github.com/comet-ml/opik/issues/2771)) about being unable to render visualisation for both traces and spans, which suggests their rendering layer has had stability issues with larger traces.

**Maps to llmflow:** Opik's "unified logs" pattern matches llmflow's three-table model (`traces`, `logs`, `metrics`) almost exactly. **Recommendation: build a single "Activity" or "Logs" page on top of a `UNION` view, with a top-level type filter (trace/log/metric).** Also adopt Opik's `guardrail` span type (or align with OpenInference) so we have a place to show safety/policy checks. Span-level metrics map to llmflow's `attributes` JSON column — no schema change needed, just a convention.

## Patterns we should steal

1. **Langfuse's split-bar for streaming spans.** When a span has a first-token-time and a completion-end-time, render `firstTokenWidth` + `completionWidth` as two adjacent sub-bars (different fills, same row). This makes TTFT vs total latency immediately visible. Requires capturing `first_token_ms` on the span — see schema change recommendation above.

2. **Langfuse's pre-flattened metrics on tree-flatten.** Compute `startOffset`, `itemWidth`, `treeLines: boolean[]`, `isLastSibling` once during a single recursive walk of the trace tree, store as a flat array, and feed to a virtualizer. Do not re-compute these per render. This is the technique that makes their 1k-span traces work.

3. **Phoenix's "error bubbles up via line color."** When any descendant of a tree node errors, color the connector line red. The line _itself_ is the indicator — the user doesn't need to scroll/expand to find the failure path.

4. **Phoenix's URL-as-selection-state.** `?selectedSpanId=xyz` in the URL. Makes traces shareable, back-button-navigable, and free of a separate state-management layer. Pair with `?tab=info|attributes|events`.

5. **LangSmith's M/T/D keyboard switching.** Three projections of the same trace data (Messages / Turns / Details), one keypress to switch. Don't put them in tabs — give them top-level shortcuts.

6. **Weave's scrubbers (next-peer / next-sibling / next-error).** Treat span navigation as multi-axis. Even without sliders, the _concept_ maps to keyboard shortcuts: `]` next sibling, `}` next peer (same span_name), `e` next error, `g` go to root. This is a small implementation that meaningfully accelerates expert use.

7. **Helicone's per-path color stability.** Use a stable hash of `span_name` (or `request_path`) for bar color in the timeline view, not just span_type. Users learn to recognise "the orange bar is the rerank step." Color memory matters more than category accuracy in a timeline.

8. **Opik's unified Logs surface.** llmflow has three tables (traces, logs, metrics). A single "Activity" page that interleaves them by timestamp, with type filters, beats three separate pages for the common debugging task ("what happened around this trace?").

9. **Langfuse's "show/hide column" dropdown.** A single dropdown that toggles `showDuration` / `showCostTokens` / `showScores` / `showComments` on the tree row. Don't ship a settings page; ship a popover the user uses once and forgets.

10. **TanStack virtual + 500px overscan.** Aggressive overscan, paired-scroll-handler scroll sync between sticky header and body, `transform: translateY()` rather than `top:`. This is the boilerplate every viable trace viewer ships in 2026.

11. **Phoenix's MIME-aware input/output renderer.** Don't ship one "pretty-print" function. Switch on the attribute's MIME type: JSON → syntax-highlighted block; text → markdown; image → image tag. Opik adds attachments to this list. llmflow's `input`/`output` columns are stored as JSON strings; we lose the original MIME hint. **Recommendation: store `input_mime` / `output_mime` alongside.**

12. **Phoenix's server-side span pagination at 1000.** Don't fetch 10k-span traces in one go. Page them.

## Patterns we should avoid

1. **Helicone's Recharts-based Gantt view.** A charting library is the wrong tool for a Gantt timeline that needs to render 1000+ bars, support virtualisation, and synchronise scroll with a header. Build the bar geometry by hand; reach for a virtualizer; don't import Recharts to draw a waterfall.

2. **Helicone forcing tab navigation between Tree / Timeline / Span views.** Each view is on a different route — user loses tree expansion state and selection when switching. Langfuse's in-place toggle is the correct pattern. Keep the data; swap the projection.

3. **Phoenix's lack of inline cost.** Cost appears only in the trace header — not in each tree row. For a tool whose users _care about cost_, this is a step backward. llmflow has `estimated_cost` per row — show it.

4. **Helicone's RequestNode omitting tokens and cost entirely.** They show only type + label + latency + status. For an LLM-observability tool this is too sparse. Langfuse's row (name + duration + cost + tokens + scores + comments) is closer to right, with the dropdown to hide unwanted columns.

5. **Encoding span status as `❌` emoji** (Helicone Span view). Use a proper status icon component with screen-reader labels and consistent sizing. Emojis render differently on every platform.

6. **One global "auto-zoom" on the timeline scale.** Tools that auto-zoom-to-fit hide microseconds-scale spans. Default to root duration but provide explicit zoom controls (Phoenix sidesteps this by using a fixed 150px per-row bar; Langfuse uses a horizontally scrolling pane). Don't try to do both implicitly.

7. **Three-pane layouts that lose pixels on narrow screens.** Phoenix's 30% / flex / right-sidebar collapses to 5% min but never reflows to a stacked layout. Langfuse's mobile accordion is the correct answer.

8. **Loading the entire trace synchronously.** Phoenix's 1000-page-size is a defence; Langfuse's virtualizer is a defence; Helicone's Recharts route is the failure mode. llmflow's current `getSpansByTraceId` (in `src/db.ts:534`) returns all spans for a `trace_id` — fine for small traces, will need a `LIMIT/OFFSET` pagination escape hatch for >1k cases.

9. **Comparison features hidden behind dataset/experiment surfaces.** Every tool punts trace-to-trace diff into a separate "experiment" UI. This is wrong: the common case is "yesterday's run vs today's run, why is today slower?" That should be a button on the trace detail page, not a dataset workflow.

10. **Span_type taxonomies that don't align with OpenInference.** Opik uses `general/tool/llm/guardrail`; Helicone uses `LLM/Tool/Vector DB`; Phoenix uses the full OpenInference set (LLM/RETRIEVER/RERANKER/EMBEDDING/TOOL/CHAIN/AGENT). The latter is the de facto standard via OTel SemConv. **Don't invent a new taxonomy.**

## Open questions

1. **Streaming first-token-time in OTLP.** Phoenix does not visually split bars for streaming; only Langfuse does. Is the first-token-time attribute reliably present in real-world OTLP exporters? llmflow's OTLP ingester (`otlp.js`) would need to capture it. **Prototype: instrument a real OpenAI/Anthropic streaming call via the OpenInference Python SDK, check what OTLP payload arrives at llmflow's `/v1/traces` endpoint.**

2. **Cost coloring threshold.** Langfuse uses `heatMapTextColor()` on duration and cost cells — but the threshold logic isn't visible in the snippets I read. Is it relative-to-trace, relative-to-global-p99, or user-set? **Prototype: render side-by-side with three threshold models, user-test which is most legible.**

3. **Does the conversation/messages view need to be a peer view (LangSmith) or a tab in the detail panel (Phoenix Agent Chat)?** LangSmith's M/T/D top-level switch wins for chat-heavy debugging; Phoenix's right-sidebar wins for "show me the chat while I navigate spans." llmflow needs to decide based on whether most users will be looking at single LLM calls (right sidebar wins) or multi-turn agent traces (top-level switch wins). **Prototype both, A/B with llmflow alpha users.**

4. **How much does the 500px overscan in TanStack virtual cost in memory?** Langfuse picked 500 deliberately — but for a 5000-span trace on a low-memory client (e.g. an embedded review iframe), that's potentially 500 / 42 ≈ 12 extra rows rendered on each side. Not huge, but worth measuring before adopting blindly. **Benchmark: 5000-span trace, low-end M1, FPS during scroll at overscan = 50 / 200 / 500.**

5. **The scrubber UI from Weave: keyboard shortcuts vs sliders.** Sliders take significant vertical space and are mouse-only. Keyboard shortcuts (`]` `[` `}` `{` `e` `g`) have zero pixel cost but require discoverability. Weave ships the sliders _and_ the shortcuts hidden behind `^`. What ratio of users discover each? **User-test with screen recordings.**

6. **Comparison: where does it belong?** None of the six tools answers this well. llmflow could lead by adding a "Compare to..." button on the trace detail page that opens a _paired-scroll, paired-tree_ view of two traces with matched-span highlighting. **Prototype this; nobody else has it.**

7. **Mobile.** Only Langfuse ships a true mobile layout. Is this because nobody debugs LLM traces on a phone, or because tool-builders didn't bother? Probably both. Worth a user survey before committing engineering effort to llmflow's mobile path.

8. **Search within trace.** Langfuse supports name/type/ID substring. None ship regex. Is regex worth the complexity for a tool whose primary users are engineers? Probably yes — but the implementation has to handle multi-line input/output text without freezing. **Prototype with `RegExp` on the client across 1k spans, measure.**

---

### Source code references (canonical)

**Langfuse:**

- [`web/src/components/trace/Trace.tsx`](https://github.com/langfuse/langfuse/blob/main/web/src/components/trace/Trace.tsx)
- [`web/src/components/trace/components/TraceTree.tsx`](https://github.com/langfuse/langfuse/blob/main/web/src/components/trace/components/TraceTree.tsx)
- [`web/src/components/trace/components/SpanContent.tsx`](https://github.com/langfuse/langfuse/blob/main/web/src/components/trace/components/SpanContent.tsx)
- [`web/src/components/trace/components/TraceTimeline/index.tsx`](https://github.com/langfuse/langfuse/blob/main/web/src/components/trace/components/TraceTimeline/index.tsx)
- [`web/src/components/trace/components/TraceTimeline/TimelineBar.tsx`](https://github.com/langfuse/langfuse/blob/main/web/src/components/trace/components/TraceTimeline/TimelineBar.tsx)
- [`web/src/components/trace/components/TraceTimeline/TimelineScale.tsx`](https://github.com/langfuse/langfuse/blob/main/web/src/components/trace/components/TraceTimeline/TimelineScale.tsx)
- [`web/src/components/trace/components/TraceTimeline/timeline-flattening.ts`](https://github.com/langfuse/langfuse/blob/main/web/src/components/trace/components/TraceTimeline/timeline-flattening.ts)
- [Issue #3513 — large-trace timeline latency](https://github.com/langfuse/langfuse/issues/3513)
- [New Trace View changelog (2025-03-19)](https://langfuse.com/changelog/2025-03-19-new-trace-view)

**Phoenix:**

- [`app/src/pages/trace/TraceDetails.tsx`](https://github.com/Arize-ai/phoenix/blob/main/app/src/pages/trace/TraceDetails.tsx)
- [`app/src/pages/trace/ConnectedTraceTree.tsx`](https://github.com/Arize-ai/phoenix/blob/main/app/src/pages/trace/ConnectedTraceTree.tsx)
- [`app/src/components/trace/TraceTree.tsx`](https://github.com/Arize-ai/phoenix/blob/main/app/src/components/trace/TraceTree.tsx) (the actual `SpanTreeItem`)
- [`app/src/pages/trace/SpanDetails.tsx`](https://github.com/Arize-ai/phoenix/blob/main/app/src/pages/trace/SpanDetails.tsx)

**LangSmith:** closed source. Reference docs: [docs.langchain.com/langsmith/observability](https://docs.langchain.com/langsmith/observability)

**Helicone:**

- [`web/components/templates/sessions/sessionId/SessionContent.tsx`](https://github.com/Helicone/helicone/blob/main/web/components/templates/sessions/sessionId/SessionContent.tsx)
- [`web/components/templates/sessions/sessionId/Span.tsx`](https://github.com/Helicone/helicone/blob/main/web/components/templates/sessions/sessionId/Span.tsx)
- [`web/components/templates/sessions/sessionId/Tree/Tree.tsx`](https://github.com/Helicone/helicone/blob/main/web/components/templates/sessions/sessionId/Tree/Tree.tsx)
- [`web/components/templates/sessions/sessionId/Tree/RequestNode.tsx`](https://github.com/Helicone/helicone/blob/main/web/components/templates/sessions/sessionId/Tree/RequestNode.tsx)
- [`web/components/templates/sessions/sessionId/Tree/TreeView.tsx`](https://github.com/Helicone/helicone/blob/main/web/components/templates/sessions/sessionId/Tree/TreeView.tsx)

**Weave:** docs primary. [Trace View guide](https://weave-docs.wandb.ai/guides/tracking/trace-tree/). Source repo `wandb/weave`.

**Opik:** docs primary. [Tracing concepts](https://www.comet.com/docs/opik/tracing/concepts). Source repo `comet-ml/opik`.

### Cross-references to llmflow data model (`/Users/helge/code/llmflow/src/db.ts`)

| Need from this survey                             | llmflow today                                | Recommendation                                                                                                                  |
| ------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Streaming TTFT visualisation (Langfuse split-bar) | no `first_token_ms` column                   | add `first_token_ms INTEGER` to `traces`                                                                                        |
| Pre-flattened tree metrics (Langfuse)             | `getSpansByTraceId` returns rows in DB order | compute `startOffset`/`itemWidth`/`tree_lines` in a single client-side pass; cache per trace                                    |
| OpenInference span_kind taxonomy                  | `span_type` defaults to `'llm'`, no enum     | document allowed values, align with OpenInference (`LLM`/`RETRIEVER`/`RERANKER`/`EMBEDDING`/`TOOL`/`CHAIN`/`AGENT`/`GUARDRAIL`) |
| Thread/conversation grouping (LangSmith)          | no `thread_id`                               | add `thread_id TEXT` to `traces`; index it                                                                                      |
| MIME-aware input/output (Phoenix)                 | `input`/`output` stored as stringified JSON  | add `input_mime`/`output_mime` columns; default to `application/json`                                                           |
| Source location for "Use" tab (Weave)             | none captured                                | parse `code.filepath`/`code.lineno`/`code.function` from OTLP attributes if present                                             |
| Unified Logs surface (Opik)                       | three tables: `traces`/`logs`/`metrics`      | build a single `Activity` view with `UNION ALL` and a type filter                                                               |
| Cost on tree row                                  | `estimated_cost` exists on `traces`          | render inline, right-aligned, heat-map above project-configured threshold                                                       |
| Per-path stable color (Helicone)                  | `request_path` and `span_name` exist         | derive bar color from a stable hash of `span_name`, not just `span_type`                                                        |
| URL-driven selection (Phoenix)                    | n/a (frontend choice)                        | use `?spanId=…&tab=…` as canonical state for the trace viewer route                                                             |
