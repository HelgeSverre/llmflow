# Trace Waterfall Rendering — Techniques & Tradeoffs

> Audience: llmflow contributors planning the trace viewer rewrite.
> Stack: Svelte 5.43+, Vite 7, TypeScript. Target scale: smooth at 5k spans, hard limit 50k spans.
> Existing data shape: `Span { id, trace_id, parent_id, name, span_type, start_time, end_time, duration_ms, attributes, children }` (see `apps/dashboard/src/lib/stores/traces.svelte.ts`).

---

## Executive summary

llmflow's realistic upper bound is ~5k spans per trace, with a hard ceiling of 50k. That number sits squarely in the zone where **SVG/DOM becomes the bottleneck** (Jaeger UI users explicitly report the timeline turning to molasses at 2k spans — see [jaeger-ui#645](https://github.com/jaegertracing/jaeger-ui/issues/645) — and most SVG benchmarks fall over between 3k and 5k nodes). At the same time, the trace tree is deeply hierarchical, mostly read-only, and rarely has more than ~100 visible rows at any zoom level. That's a sweet spot for **virtualized DOM rendering**, not raw canvas.

The recommended architecture is a **hybrid DOM-virtualized waterfall with a Canvas mini-map**, mirroring what Jaeger eventually moved toward (`VirtualizedTraceView.tsx` renders `<div>` rows, while [jaeger-ui#61](https://github.com/jaegertracing/jaeger-ui/issues/61) called out canvas specifically for the mini-map). DOM rows give you free accessibility, easy CSS theming, native hit-testing, and lossless text rendering — which matters when each row needs a `span_type` badge, monospace name, attributes pill, and latency. Canvas is reserved for the mini-map (always-rendered N spans condensed to ~120px tall) and as a future optimisation path if user traces routinely exceed 20k spans.

For virtualization, `@tanstack/svelte-virtual` is the obvious pick — it's headless, framework-agnostic at its core, and the Svelte adapter is maintained. **One caveat**: it still uses the Svelte 4 store API (`$rowVirtualizer.getVirtualItems()`), and there's a known integration friction with Svelte 5 element bindings ([TanStack/virtual#866](https://github.com/TanStack/virtual/issues/866)). For a 5k row workload, a hand-rolled virtualizer (~150 LOC using `$state`, `$derived`, and a single scroll-listener `$effect`) is genuinely viable and gives full control over sticky rows and pinned columns. I'd start hand-rolled and only graduate to TanStack if expand/collapse with variable row heights gets painful.

State should live in a `TraceViewport.svelte.ts` class using runes — Rich Harris's pattern for "state with derived members" — wrapping the flattened-with-expansion-state row list as `$state.raw` (the row array is reassigned on toggle, not mutated; spans themselves are immutable once loaded — [Svelte $state.raw docs](https://svelte.dev/docs/svelte/$state)). Wrap viewport (scroll position, zoom, hover, selection) in regular `$state`.

Color encoding uses the **Okabe–Ito 8-color palette** for the seven span types ([llm, agent, chain, tool, retrieval, embedding, custom] already in `SpanTree.svelte`) plus an "error" red. It's the de facto colorblind-safe categorical standard and gives us headroom. Latency overlays use **Viridis** for sequential encoding.

## Renderer comparison

### SVG (pure)

**Pros**: declarative, CSS-stylable, accessible per element, easy gradients/clip-paths, vector-perfect zoom, native `pointer-events` per shape.

**Cons**: every `<rect>` and `<text>` is a real DOM node with full layout cost.

**Performance ceiling**: ~2–5k visible elements before frame budget collapses. [Boris Smus's classic benchmark](https://smus.com/canvas-vs-svg-performance/) shows SVG render time grows roughly linearly with node count and goes exponential in Safari; Canvas stays near-constant. The Felt mapping team [explicitly migrated from SVG to Canvas](https://felt.com/blog/from-svg-to-canvas-part-1-making-felt-faster) because "large selections" became slow once their scene had a few thousand shapes.

**Real-world example**: Jaeger UI's mini-map originally used SVG and was filed as a perf issue at [jaeger-ui#61](https://github.com/jaegertracing/jaeger-ui/issues/61) — explicit ask to switch to canvas. The main timeline reportedly degrades past ~2000 spans ([jaeger-ui#645](https://github.com/jaegertracing/jaeger-ui/issues/645)). [d3-flame-graph](https://github.com/spiermar/d3-flame-graph) is SVG-based and exposes a `minFrameSize` knob specifically to cull sub-pixel rects, because they grind the layout engine without a single visible pixel of benefit.

### DOM (divs with position: absolute)

**Pros**: same accessibility/CSS story as SVG, but `<div>` is actually cheaper than `<rect>` in most browsers because there's no SVG sub-tree to maintain. Hit-testing is native. Text wrapping, ellipsis, and CSS variables Just Work.

**Cons**: still bottoms out at a few thousand nodes without virtualization. Sub-pixel positioning via `transform: translateX(...)` is required to avoid layout thrash.

**Performance ceiling**: ~3–5k DOM nodes onscreen is the rough boundary; _virtualized_ DOM has no practical ceiling because you only ever render the visible rows (~30–80 at typical viewport sizes).

**Real-world example**: Jaeger UI today uses `<div>`s, not SVG, for span rows ([VirtualizedTraceView.tsx](https://github.com/jaegertracing/jaeger-ui/blob/main/packages/jaeger-ui/src/components/TracePage/TraceTimelineViewer/VirtualizedTraceView.tsx) — `<div className="VirtualizedTraceView--row">` wraps `SpanBarRow` and friends). Their viewBuffer is 300px (rows rendered above/below the viewport).

### Canvas 2D

**Pros**: O(1) DOM regardless of span count. ~5–10× faster than SVG at scale. GPU-accelerated compositing. OffscreenCanvas + Web Worker option for true off-main-thread rendering.

**Cons**: zero accessibility out of the box — you must mirror the visual structure in a parallel ARIA tree (see Accessibility below). No native event dispatch per shape — you build your own hit-testing. Text rendering is pixel-aligned, not subpixel/HiDPI by default (you must scale by `devicePixelRatio` and `ctx.scale(dpr, dpr)`). CSS theming requires reading computed styles and passing them in.

**Performance ceiling**: comfortably 100k+ rectangles per frame on a modern laptop if you batch fills by color. Perfetto routinely handles million-slice traces.

**Hit-testing strategies** (see dedicated section below):

1. Flat scan with viewport cull — fine up to ~5k items.
2. Color-coded off-screen hit canvas + `getImageData(x, y, 1, 1)` — O(1) per probe; great for irregular shapes.
3. Quadtree (e.g., d3-quadtree) — O(log n) point queries; good for non-uniform clusters.
4. Sorted-by-x array + binary search by start time, then linear scan over depth — O(log n + k) where k = spans at this depth.

**Real-world example**: [Perfetto's UI](https://github.com/google/perfetto) renders all tracks on canvas, backed by SQL queries that only return slices in the visible time window — viewport culling at the data layer. [Chrome DevTools Performance panel](https://github.com/ChromeDevTools/devtools-frontend/tree/main/front_end/panels/timeline) does the same: a `FlameChart` canvas component with a DOM overlay layer for interactive UI elements ([DeepWiki: Flame Chart Visualization](https://deepwiki.com/ChromeDevTools/devtools-frontend/5.1.2-flame-chart-visualization)).

### WebGL

**Pros**: tens of millions of primitives in a single draw call via instanced rectangles. Custom shaders for color gradients, fog, fades.

**Cons**: massive complexity tax. You're now writing GLSL, managing buffers, hand-rolling text rendering (canvas-to-texture or SDF fonts). Browser quirks around context loss.

**Performance ceiling**: limited mainly by GPU memory and pixel fill rate.

**When llmflow would need it**: never, at the stated scale. Even Perfetto only uses WebGL for specific visualizations (heatmaps, dense slice tracks) and most rendering is Canvas 2D.

### Recommendation table

| Span count | Recommended                       | Why                                                                              |
| ---------- | --------------------------------- | -------------------------------------------------------------------------------- |
| < 500      | SVG or DOM (no virtualization)    | Simplest path; accessibility free; no perf concern                               |
| 500 – 5k   | **DOM virtualized**               | Hits llmflow's sweet spot; keep all CSS theming, accessibility, hit-testing free |
| 5k – 50k   | DOM virtualized + Canvas mini-map | Virtualization keeps rendered nodes ~100; mini-map needs raw speed               |
| 50k – 500k | Canvas main view                  | DOM cost of mutations during rapid scroll becomes noticeable                     |
| > 500k     | Canvas + LOD aggregation          | Pre-aggregate to "bands" of N spans per pixel; drill on zoom                     |

For llmflow specifically: build for the 500–5k tier with the 5k–50k tier as a graceful next step. Don't over-engineer for the 500k case unless that becomes a real user trace.

## Virtualization

### TanStack Virtual

Status as of May 2026: `@tanstack/svelte-virtual` v3.13.x. It's the official Svelte adapter, still on the Svelte stores API ([docs](https://tanstack.com/virtual/v3/docs/framework/svelte/svelte-virtual)). Svelte 5 native runes support is tracked in [TanStack/virtual#866](https://github.com/TanStack/virtual/issues/866) and [#796](https://github.com/TanStack/virtual/discussions/796); a workaround exists but it's not first-class. Pattern:

```svelte
<script lang="ts">
  import { createVirtualizer } from '@tanstack/svelte-virtual'

  let parentRef: HTMLDivElement
  const rowVirtualizer = createVirtualizer({
    count: 5000,
    getScrollElement: () => parentRef,
    estimateSize: () => 28, // px per row
    overscan: 8,
    getItemKey: (i) => rows[i].id, // stable keys across re-renders
  })
</script>

<div bind:this={parentRef} class="scroller">
  <div style:height="{$rowVirtualizer.getTotalSize()}px" style:position="relative">
    {#each $rowVirtualizer.getVirtualItems() as item (item.key)}
      <div style:transform="translateY({item.start}px)" style:position="absolute">
        <!-- row -->
      </div>
    {/each}
  </div>
</div>
```

When to use: when you outgrow flat lists, need dynamic row heights (TanStack does measure-and-update), or want infinite scroll/dynamic loading. The store API is mildly annoying in a runes-first codebase but interoperates fine.

### svelte-virtual-list

Older, simpler. Last meaningful update predates Svelte 5. Skip.

### Roll-your-own with $state + scroll listener

Justified when:

- Row heights are uniform (llmflow's case — every span row is the same height).
- You want full ownership of sticky rows, pinned columns, and the time-axis ruler.
- You want to keep dependencies minimal.

A 150-line hand-rolled virtualizer is competitive with TanStack at uniform-height workloads and gives you total control. Sketch in the Code Sketches section.

### Sticky headers + pinned rows with virtualization

Three working patterns (synthesised from [TanStack's sticky example](https://tanstack.com/virtual/v3/docs/framework/svelte/examples/sticky) and react-window guides):

1. **Force-include in the rendered range.** Override `rangeExtractor` to always include the currently-active sticky index in the array of indices to render. Style that single row with `position: sticky; top: 0` instead of `position: absolute`.
2. **Render the pinned bar outside the virtualized container.** Two siblings: a time-axis header (`position: sticky; top: 0` at the scroll container level) and the virtualized body below it. Cleanest separation; works perfectly for the time-axis ruler in a trace viewer because the ruler doesn't move with rows.
3. **Pad the total size.** Add `stickyHeight + stickyWidth` to the virtualizer's `totalSize` and render sticky regions as absolutely-positioned overlays. Necessary when sticky rows are interleaved (group headers).

For llmflow's waterfall: pattern 2 for the time-axis ruler at the top; pattern 1 if you ever add "pinned spans" (user pins the LLM root span so they always see it while scrolling).

## Time-axis math

The trace's logical extent is `[root.start_time, root.start_time + root.duration_ms]`. Map nanosecond timestamps to pixels:

```ts
const totalDurationMs = trace.duration_ms // e.g. 12400 ms
const viewport = { startMs: 0, endMs: totalDurationMs } // updated by zoom/pan
const widthPx = container.clientWidth // e.g. 1200

function timeToPx(ms: number): number {
  return ((ms - viewport.startMs) / (viewport.endMs - viewport.startMs)) * widthPx
}

function pxToTime(px: number): number {
  return viewport.startMs + (px / widthPx) * (viewport.endMs - viewport.startMs)
}
```

**Min-bar-width**. At 1200px viewport with a 12.4s trace, 1px ≈ 10.3ms. Spans shorter than 10ms render as <1px wide and effectively disappear. Two acceptable handlers:

1. **Clamp minimum width to 1 or 2 px.** Cheap, visually honest. d3-flame-graph's `minFrameSize` does this with a higher floor (skip frames smaller than N px entirely) — see [their README](https://github.com/spiermar/d3-flame-graph).
2. **Aggregate adjacent sub-pixel spans into a "..." marker.** More complex, only worth doing past 10k spans.

For llmflow: clamp to `Math.max(1, barWidth)` and color the under-1px bars slightly desaturated so the eye can tell they're below resolution.

**Auto-fit on open**. Initial viewport = `[root.start_time, root.end_time]`. Add 2% padding either side so the very first and last spans aren't flush against the edge:

```ts
const pad = trace.duration_ms * 0.02
viewport.startMs = -pad
viewport.endMs = trace.duration_ms + pad
```

**Zoom math** (anchor at cursor). When the user wheels to zoom at cursor x:

```ts
function zoomAt(cursorPx: number, scaleFactor: number) {
  const cursorMs = pxToTime(cursorPx)
  const newRange = (viewport.endMs - viewport.startMs) / scaleFactor
  const cursorRatio = (cursorMs - viewport.startMs) / (viewport.endMs - viewport.startMs)
  viewport.startMs = cursorMs - cursorRatio * newRange
  viewport.endMs = cursorMs + (1 - cursorRatio) * newRange
}
```

This is d3-zoom's behaviour distilled. d3's default wheel delta function (worth cribbing): `Δ = -event.deltaY * (event.deltaMode === 1 ? 0.05 : event.deltaMode ? 1 : 0.002) * (event.ctrlKey ? 10 : 1)` with scale = `2^Δ` ([d3-zoom docs](https://d3js.org/d3-zoom)).

**Tick math**. Time ruler ticks at "nice" intervals: pick the largest of {1, 2, 5, 10, 20, 50, 100, …}×10^k that gives 4–8 ticks across the viewport.

## Zoom and pan UX

Survey of the major tools:

| Tool            | Pan                                                       | Zoom                                          | Region-select    |
| --------------- | --------------------------------------------------------- | --------------------------------------------- | ---------------- |
| Perfetto        | WASD or drag                                              | wheel; pinch                                  | shift-click-drag |
| Chrome DevTools | drag; "Modern" mode: wheel pans                           | Ctrl/Cmd + wheel; "Classic" mode: wheel zooms | drag in overview |
| Jaeger          | scrollbar; no native pan                                  | scrollbar-based                               | no native brush  |
| Speedscope      | drag; arrow keys                                          | wheel; +/- keys                               | n/a              |
| Chrome Profiler | Modern: scroll vert, shift-scroll horiz, Ctrl-scroll zoom | (same)                                        | drag in overview |
| Figma           | middle-click drag; two-finger drag                        | Ctrl + wheel; pinch                           | n/a              |

The crucial finding from [Chrome DevTools' shortcut menu](https://developer.chrome.com/docs/devtools/performance/reference): they ship **two modes** ("Classic" — wheel zooms; "Modern" — wheel scrolls, Ctrl/Cmd-wheel zooms) because users have strongly held opinions and the right answer depends on whether they came from a profiler background (wheel zooms) or a documents/spreadsheets background (wheel scrolls).

**Recommended defaults for llmflow** (matches Chrome DevTools' "Modern" mode, which is what trace newcomers expect):

| Gesture                 | Action                                                   |
| ----------------------- | -------------------------------------------------------- |
| Wheel scroll            | Scroll rows vertically                                   |
| Shift + wheel           | Pan horizontally along time axis                         |
| Ctrl/Cmd + wheel        | Zoom in/out, anchored at cursor                          |
| Trackpad pinch          | Zoom (delegated through `ctrlKey: true` in `WheelEvent`) |
| Click + drag (in ruler) | Brush-zoom to selected time region                       |
| Double-click (in ruler) | Reset zoom to fit                                        |
| `f` key                 | Fit selected span to viewport (Perfetto convention)      |
| `[`/`]`                 | Previous / next span at same depth                       |
| `+`/`-`                 | Zoom in / out at viewport center                         |

Use `{ passive: false }` on the wheel handler so you can `preventDefault()` and stop the page from scrolling.

## Color encoding for span bars

### By span type (categorical)

llmflow has 7 known span types in `SpanTree.svelte`: `llm`, `agent`, `chain`, `tool`, `retrieval`, `embedding`, and a catch-all `custom`/`trace`. Use the **Okabe–Ito palette** ([reference](https://conceptviz.app/blog/okabe-ito-palette-hex-codes-complete-reference)) — the gold-standard 8-color colorblind-safe categorical palette, recommended by Nature Methods (Wong 2011, "Points of view: Color blindness"):

```ts
export const SPAN_TYPE_COLORS = {
  llm: '#0072B2', // blue       — primary, most common span
  agent: '#D55E00', // vermillion — high-level orchestration
  chain: '#CC79A7', // pink       — sequence/router
  tool: '#009E73', // green      — external calls
  retrieval: '#F0E442', // yellow     — RAG/search
  embedding: '#56B4E9', // sky blue   — vectorize
  custom: '#999999', // grey       — unknown / user-defined
  error: '#E69F00', // orange     — reserved for error overlay
}
```

This palette survives protanopia, deuteranopia, and tritanopia simulation and stays distinguishable in grayscale print. For >8 categories, the next tier is [Paul Tol's palettes](https://personal.sron.nl/~pault/) (up to 12 colors) — defer until needed.

### By latency (sequential)

For optional latency-heatmap overlay (color rows by `duration_ms` percentile within trace), use **Viridis** — perceptually uniform, colorblind-safe, grayscale-safe. Five-stop palette: `#440154 → #3B528B → #21908C → #5DC863 → #FDE725`. Same recommendation as matplotlib's default.

### What others do

- **Chrome DevTools flame chart**: hashes function names to colors deterministically so the same function gets the same color across recordings ("colors are reused for same functions" — [Chrome DevTools Performance docs](https://developer.chrome.com/docs/devtools/performance/reference)). No semantic mapping. Trades scanability for stability.
- **Perfetto**: per-track palettes chosen by the trace producer (Chrome uses category-based colors; Android uses per-process hashing).
- **Tailwind**: no first-party colorblind-safe palette as of May 2026 — the v4 default palette is _not_ CVD-safe (red-500 and green-500 collapse under deuteranopia).

For llmflow, semantic mapping (Okabe–Ito by span type) beats deterministic hashing because the type vocabulary is small and stable.

## Hit testing on Canvas

If/when llmflow's mini-map (or future canvas main view) needs interactive hit-testing, the options sorted by complexity:

### 1. Flat scan with viewport cull (use this first)

```ts
function hitTest(rows: SpanRow[], x: number, y: number): SpanRow | null {
  const rowIdx = Math.floor(y / ROW_HEIGHT)
  // rows is sorted by render order; check only spans on this depth/row
  const candidates = rows.filter((r) => r.depth === rowIdx)
  for (const c of candidates) {
    if (x >= c.xPx && x < c.xPx + c.widthPx) return c
  }
  return null
}
```

For 5k spans with 10–20 depth levels, candidates per row is ~250. A flat scan completes in < 0.1 ms — comfortably within the 16 ms frame budget.

### 2. Sorted-by-x binary search

Once depth is known, the spans at that depth are sorted by `start_time`. Binary-search for the first span with `start_time ≤ cursorTime`, then check overlap. O(log n) per hover. Implement once you outgrow flat scan.

### 3. d3-quadtree

For non-uniform clusters or arbitrary-shape hit-tests. Drop-in: `import { quadtree } from 'd3-quadtree'`. Useful if you add edges/arrows between spans (flow events). Overkill for plain waterfalls.

### 4. Off-screen color-coded hit canvas

The classic "stupid canvas trick": render every span on a hidden canvas in a unique color, then `ctx.getImageData(x, y, 1, 1)` returns the color → span ID. O(1) lookup, supports arbitrary shapes. Costs you a second canvas of the same size. Recommended when shapes get complex (rounded corners, gradients) and the math for "is point in shape" stops being a one-liner.

### Recommended for llmflow

Start with **flat scan + viewport cull** (option 1). Throttle `mousemove` through `requestAnimationFrame` so hit-testing runs once per frame max. Move to option 2 (binary search by depth + start time) only if mini-map hover starts dropping frames.

## Accessibility

The hard truth: **canvas is invisible to assistive tech**. Anything you render purely on canvas has zero accessibility unless you mirror it in DOM. This is the single biggest reason to prefer DOM for the main waterfall.

### ARIA pattern

Use `role="tree"` on the row container and `role="treeitem"` on each row. Authority: [W3C WAI-ARIA APG TreeView pattern](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/examples/treeview-navigation/) and [MDN tree role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/tree_role).

Required attributes per row:

- `role="treeitem"`
- `aria-level={depth + 1}` (1-based)
- `aria-expanded={hasChildren ? expanded : undefined}` (omit on leaf rows)
- `aria-selected={selected}`
- `aria-setsize={siblingsCount}` and `aria-posinset={positionInSiblings}` — **mandatory** because virtualization breaks the implicit DOM order screen readers rely on (only one row in the tab order).
- `aria-label` or visible text — span name + duration is fine.

### Keyboard navigation

Standard tree contract (use `roving tabindex` — only the focused row has `tabindex="0"`, others have `tabindex="-1"`):

| Key             | Action                                                             |
| --------------- | ------------------------------------------------------------------ |
| ↑ / ↓           | Move focus to previous/next visible row                            |
| ← (open node)   | Collapse                                                           |
| ← (closed/leaf) | Move focus to parent                                               |
| → (closed)      | Expand                                                             |
| → (open)        | Move focus to first child                                          |
| Home / End      | First / last visible row                                           |
| Enter / Space   | Select (open details panel)                                        |
| Type-ahead      | Jump to next row whose name starts with letters typed within 500ms |
| `f` (custom)    | Fit selected span to viewport                                      |

### Screen reader gotchas

From [Accessible Culture's deep dive](https://accessibleculture.org/articles/2013/02/not-so-simple-aria-tree-views-and-screen-readers/) on ARIA trees in screen readers:

- **VoiceOver doesn't honor `aria-activedescendant` reliably** with its own navigation commands. Use real focus (`element.focus()`) on the active row, not aria-activedescendant.
- **JAWS/NVDA over-read children**: setting focus to an expanded node sometimes reads all children's text too. Avoid putting span attributes inline in the row text; defer to a side panel announced via `aria-controls` + live region.
- **VoiceOver Ctrl+Option+\\** doesn't toggle expand/collapse on `aria-expanded` — bind your own Enter/Space handlers.

### Canvas accessibility

If/when canvas comes in for the mini-map, the convention is to keep the DOM tree as the single source of truth for AT and use canvas purely as visual. The mini-map can be `aria-hidden="true"` since the main waterfall already exposes the structure.

## Svelte 5 idioms for interactive views (late 2025/2026)

The community has settled on a few patterns since runes shipped at Svelte Summit Fall 2024:

### Use classes for state with derived members

Rich Harris's [explicit recommendation](https://svelte.dev/blog/runes): when state is an object with interdependent fields, put it in a class. The Svelte 4 store API ($-prefix, `writable`/`derived`) is no longer idiomatic for component-local state. It's still fine for cross-tree global state, but `.svelte.ts` modules exporting class instances are preferred.

```ts
// trace-viewport.svelte.ts
export class TraceViewport {
  startMs = $state(0)
  endMs = $state(0)
  hoveredId = $state<string | null>(null)
  selectedId = $state<string | null>(null)

  // derived members work inside classes
  durationMs = $derived(this.endMs - this.startMs)

  zoomAt(cursorPx: number, scaleFactor: number, widthPx: number) {
    const cursorMs = this.startMs + (cursorPx / widthPx) * this.durationMs
    const newRange = this.durationMs / scaleFactor
    const ratio = (cursorMs - this.startMs) / this.durationMs
    this.startMs = cursorMs - ratio * newRange
    this.endMs = cursorMs + (1 - ratio) * newRange
  }
}
```

### `$state.raw` for the flat row array

The flattened row list (one entry per visible span, computed from the tree + expansion state) gets reassigned wholesale on every expand/collapse and never mutated in place. Wrap it in `$state.raw` — Svelte won't proxy each row, which matters at 5k spans (proxy overhead is real per the [Svelte best-practices docs](https://svelte.dev/docs/svelte/best-practices)).

```ts
let rows = $state.raw<SpanRow[]>([])

// expanding a node rebuilds the array — fine
rows = flatten(tree, expanded)
```

### `SvelteSet` for expansion state

`expanded` is a set of span IDs. Use `SvelteSet` from `svelte/reactivity` — `Set` mutations (`.add`, `.delete`) trigger reactivity, unlike a plain `Set` ([svelte/reactivity docs](https://svelte.dev/docs/svelte/svelte-reactivity)). For a string-keyed flag bag, a plain `$state({})` object also works, but `SvelteSet` makes the intent obvious and gives O(1) checks.

```ts
import { SvelteSet } from 'svelte/reactivity'
const expanded = new SvelteSet<string>()
expanded.add(spanId) // triggers re-derive
```

### `$derived` for transforms; `$effect` only for true side effects

`$derived` is memoized and runs lazily. Use it for:

- The flattened row list given tree + expanded set.
- Viewport-visible row range from scroll position.
- Total trace duration from the root span.

`$effect` is for things outside Svelte's world: subscribing to a websocket, registering a global keydown handler, wiring an IntersectionObserver. Don't use `$effect` to derive values — that's a Svelte 4 reflex and Svelte 5 will warn you.

### Stores are still fine for genuinely cross-tree pub/sub

If two distant components need to react to "current selected span", a class instance exported from `selection.svelte.ts` works as well as a writable store and reads more cleanly.

## Recommended implementation plan for llmflow

### 1. Renderer + libraries

- **Main waterfall**: virtualized DOM. Each row is a `<div>` with `transform: translateY(...)` and a CSS-grid layout for [toggle | badge | name | bar | duration].
- **Span bar**: another `<div>` inside each row, absolutely positioned, `transform: translateX(...)` and `width` driven by reactive viewport math. CSS variables for color so theming stays declarative.
- **Time-axis ruler**: SVG (small, static-ish; vector tick text is nicer than canvas for HiDPI).
- **Mini-map** (above the waterfall): Canvas 2D. One `<canvas>` element, redraw on viewport or data change.
- **Virtualization**: hand-rolled to start (uniform row heights, ~150 LOC). Migrate to `@tanstack/svelte-virtual` only if variable heights become a need.
- **Hit-testing on the mini-map**: flat scan with depth-based culling.
- **No d3 dependency** — borrow the math, skip the bundle.

### 2. State shape

```ts
// stores/trace-viewport.svelte.ts
import { SvelteSet } from 'svelte/reactivity'

export class TraceViewport {
  // Input
  trace = $state.raw<TraceTree | null>(null)

  // UI state
  expanded = new SvelteSet<string>()
  viewport = $state({ startMs: 0, endMs: 0 })
  scrollTop = $state(0)
  containerHeight = $state(0)
  hoveredId = $state<string | null>(null)
  selectedId = $state<string | null>(null)

  // Derived
  rows = $derived(this.trace ? flatten(this.trace, this.expanded) : [])
  totalHeight = $derived(this.rows.length * ROW_HEIGHT)
  visibleRange = $derived.by(() => {
    const start = Math.floor(this.scrollTop / ROW_HEIGHT) - OVERSCAN
    const count = Math.ceil(this.containerHeight / ROW_HEIGHT) + 2 * OVERSCAN
    return {
      start: Math.max(0, start),
      end: Math.min(this.rows.length, start + count),
    }
  })
  visibleRows = $derived(this.rows.slice(this.visibleRange.start, this.visibleRange.end))
}
```

What's in `$state` vs `$derived`:

- **In `$state`**: anything the user directly mutates — viewport, scroll, hover, selection, expansion set.
- **In `$derived`**: anything purely computed from inputs — flattened rows, visible range, span colors, tick positions, total duration.
- **In `$state.raw`**: the trace tree itself (large, immutable once loaded; reassigned on trace switch).

### 3. Component breakdown

```
apps/dashboard/src/lib/components/traces/
  TraceWaterfall.svelte         # top-level; owns TraceViewport instance
    TraceMinimap.svelte         # canvas, shows whole trace, current viewport rect
    TraceTimeAxis.svelte        # SVG ruler, ticks, brush-zoom handler
    TraceRowList.svelte         # virtualized container; ARIA tree root
      TraceRow.svelte           # one span row; toggle + badge + name + bar + duration
        TraceSpanBar.svelte     # the colored bar; styled by span_type
    TraceTooltip.svelte         # follows cursor; shows span details
    TraceDetailSidePanel.svelte # selected span's full attributes (replaces TraceDetail.svelte)

  shared/
    span-color.ts               # Okabe-Ito map, type → color
    time-axis.ts                # tick math, timeToPx, pxToTime, zoomAt
    flatten.ts                  # tree + expanded set → flat row array

  stores/
    trace-viewport.svelte.ts    # TraceViewport class (above)
```

Replace existing `SpanTree.svelte` (recursive component, no virtualization, no waterfall bars) with the above.

### 4. Build order

1. **Static skeleton**: TraceWaterfall + TraceRow + TraceSpanBar, no virtualization, no zoom. Just render up to 200 rows with correct bar geometry from real data. Verifies the time-axis math and the visual design.
2. **Hand-rolled virtualization**: add scroll listener, `visibleRange` derived, `transform: translateY(...)`. Tests the 5k-span case.
3. **Time axis + ruler ticks**: SVG ruler with shift-wheel zoom/pan against the viewport class.
4. **Hover tooltip**: pointer events on rows; rAF-throttled `hoveredId`; absolutely-positioned tooltip.
5. **Mini-map canvas**: full-trace overview with current-viewport rectangle. Click-to-jump and drag-to-pan.
6. **Keyboard nav + ARIA**: roving tabindex, arrow keys, expand/collapse, type-ahead.
7. **Brush-zoom in ruler**: click-drag on time-axis selects a time region.
8. **Detail side panel**: replaces today's `TraceDetail.svelte`, shows selected span attributes.

Ship 1–4 as a first iteration. 5–8 as follow-ups.

## Code sketches

### Hand-rolled virtualization with $state + $derived

```svelte
<!-- TraceRowList.svelte -->
<script lang="ts">
  import type { TraceViewport } from '$lib/stores/trace-viewport.svelte'
  import TraceRow from './TraceRow.svelte'

  const ROW_HEIGHT = 28
  const OVERSCAN = 8

  let { viewport }: { viewport: TraceViewport } = $props()

  let scrollerEl: HTMLDivElement

  function onScroll() {
    viewport.scrollTop = scrollerEl.scrollTop
  }

  $effect(() => {
    const ro = new ResizeObserver(([entry]) => {
      viewport.containerHeight = entry.contentRect.height
    })
    ro.observe(scrollerEl)
    return () => ro.disconnect()
  })
</script>

<div
  bind:this={scrollerEl}
  onscroll={onScroll}
  class="scroller"
  role="tree"
  aria-label="Trace span tree"
>
  <div style:height="{viewport.totalHeight}px" style:position="relative">
    {#each viewport.visibleRows as row, i (row.id)}
      <div
        style:position="absolute"
        style:transform="translateY({(viewport.visibleRange.start + i) * ROW_HEIGHT}px)"
        style:height="{ROW_HEIGHT}px"
        style:width="100%"
      >
        <TraceRow {row} {viewport} />
      </div>
    {/each}
  </div>
</div>

<style>
  .scroller {
    overflow: auto;
    height: 100%;
    contain: strict;
  }
</style>
```

Note `contain: strict` on the scroller — gives the browser permission to skip layout work outside the visible area; non-trivial perf win.

### Mini-map canvas with hit testing

```svelte
<!-- TraceMinimap.svelte -->
<script lang="ts">
  import type { TraceViewport } from '$lib/stores/trace-viewport.svelte'
  import { spanColor } from '$lib/components/traces/shared/span-color'

  let { viewport }: { viewport: TraceViewport } = $props()

  let canvasEl: HTMLCanvasElement
  const HEIGHT = 80

  // $derived ensures redraws happen via $effect on the deps it captures
  let drawSeed = $derived({
    rows: viewport.rows,
    start: viewport.viewport.startMs,
    end: viewport.viewport.endMs,
  })

  $effect(() => {
    void drawSeed // capture deps
    if (!canvasEl) return
    const dpr = window.devicePixelRatio || 1
    const width = canvasEl.clientWidth
    canvasEl.width = width * dpr
    canvasEl.height = HEIGHT * dpr
    const ctx = canvasEl.getContext('2d')!
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, width, HEIGHT)

    const root = viewport.trace
    if (!root) return
    const totalMs = root.duration_ms ?? 1

    // Batch fills by color for performance
    const byColor = new Map<string, Path2D>()
    for (const row of viewport.rows) {
      const color = spanColor(row.span_type)
      const x = ((row.start_time - root.start_time) / totalMs) * width
      const w = Math.max(1, ((row.duration_ms ?? 0) / totalMs) * width)
      const y = row.depth * 4
      const path = byColor.get(color) ?? new Path2D()
      path.rect(x, y, w, 3)
      byColor.set(color, path)
    }
    for (const [color, path] of byColor) {
      ctx.fillStyle = color
      ctx.fill(path)
    }

    // Viewport rectangle overlay
    const vx = (viewport.viewport.startMs / totalMs) * width
    const vw = ((viewport.viewport.endMs - viewport.viewport.startMs) / totalMs) * width
    ctx.strokeStyle = 'var(--accent)'
    ctx.lineWidth = 2
    ctx.strokeRect(vx, 0, vw, HEIGHT)
  })

  function hitTest(ev: MouseEvent): string | null {
    const rect = canvasEl.getBoundingClientRect()
    const x = ev.clientX - rect.left
    const y = ev.clientY - rect.top
    const depth = Math.floor(y / 4)
    const root = viewport.trace
    if (!root) return null
    const ms = (x / rect.width) * (root.duration_ms ?? 1) + root.start_time
    // candidates: same-depth spans, sorted by start (precomputed in viewport.rows)
    for (const row of viewport.rows) {
      if (row.depth !== depth) continue
      const end = row.start_time + (row.duration_ms ?? 0)
      if (ms >= row.start_time && ms < end) return row.id
    }
    return null
  }

  let rafScheduled = false
  function onMove(ev: MouseEvent) {
    if (rafScheduled) return
    rafScheduled = true
    requestAnimationFrame(() => {
      rafScheduled = false
      viewport.hoveredId = hitTest(ev)
    })
  }
</script>

<canvas bind:this={canvasEl} onmousemove={onMove} style:height="{HEIGHT}px" />
```

Two things to call out:

- `byColor` batching turns thousands of `fill()` calls into ~8 (one per Okabe–Ito color). Standard canvas hot-loop optimisation.
- `rafScheduled` flag throttles hover updates to once per frame. Direct mousemove dispatch can fire 200+ events/sec on a high-poll mouse and trash your frame budget.

### Wheel handler with zoom + pan modes

```svelte
<!-- TraceTimeAxis.svelte excerpt -->
<script lang="ts">
  let { viewport }: { viewport: TraceViewport } = $props()
  let containerEl: HTMLDivElement

  function onWheel(ev: WheelEvent) {
    ev.preventDefault()
    const rect = containerEl.getBoundingClientRect()
    const cursorPx = ev.clientX - rect.left

    if (ev.ctrlKey || ev.metaKey) {
      // Zoom anchored at cursor (d3 default formula)
      const delta = -ev.deltaY * (ev.deltaMode === 1 ? 0.05 : ev.deltaMode ? 1 : 0.002)
      const scaleFactor = Math.pow(2, delta)
      viewport.zoomAt(cursorPx, scaleFactor, rect.width)
    } else if (ev.shiftKey) {
      // Pan horizontally
      const range = viewport.viewport.endMs - viewport.viewport.startMs
      const dt = (ev.deltaY / rect.width) * range
      viewport.viewport = {
        startMs: viewport.viewport.startMs + dt,
        endMs: viewport.viewport.endMs + dt,
      }
    }
    // Else: let parent scroll vertically (default behavior)
  }
</script>

<div
  bind:this={containerEl}
  onwheel={onWheel}
  onwheelcapture={(e) => e.preventDefault()}
  class="time-axis"
></div>
```

`{ passive: false }` is implicit when you call `preventDefault()` in a Svelte `onwheel` handler — Svelte 5 binds the listener non-passively if your handler synchronously calls `preventDefault`. If in doubt, attach via `$effect` with `addEventListener(..., { passive: false })`.

## Open questions

1. **Do we need flow arrows between spans?** Spans across services in a distributed trace can have causal links (LLM call → tool call → second LLM call) that aren't captured by parent-child. If yes, we need a small `Path2D` overlay layer on top of the row list with curved Bézier connections — and it's the one case where Canvas pulls ahead of DOM for the main view.
2. **Streaming traces (open spans).** llmflow likely shows traces while they're still running. The viewport class needs an "auto-follow latest" mode that re-fits when new spans arrive at the right edge, with a sticky "follow" toggle (matches Chrome DevTools' recording mode).
3. **TanStack Virtual vs hand-rolled.** At 5k rows with uniform heights, hand-rolled wins on simplicity. If we later need variable row heights (e.g., inline-expand a span to show its attributes inline rather than in a side panel), TanStack's measure-and-update becomes attractive. Decision deferrable.
4. **Span attribute search/filter.** Should filtering hide rows or just dim them? Hiding changes `rows`, which invalidates the viewport's vertical position. Dimming preserves layout but is visually noisier with many spans. Recommend: hide + remember scroll-locked-span, restore on clear.
5. **Mini-map LOD.** At 50k spans, even the mini-map can't draw every span (~120px tall mini-map × 10 depth levels = 1200 pixel slots vs 50k spans). Need a "bin by pixel column" aggregation step that picks the dominant color per pixel-column bucket. Future work.
6. **WebGPU.** Available in Chromium-based browsers as of 2026. For llmflow's scale, not needed. Worth tracking if traces grow into the millions.

---

## Sources

- [Perfetto UI docs](https://perfetto.dev/docs/visualization/perfetto-ui), [Perfetto repo](https://github.com/google/perfetto)
- [Chrome DevTools Performance reference](https://developer.chrome.com/docs/devtools/performance/reference), [DeepWiki: Flame Chart Visualization](https://deepwiki.com/ChromeDevTools/devtools-frontend/5.1.2-flame-chart-visualization)
- [Jaeger UI repo](https://github.com/jaegertracing/jaeger-ui), [jaeger-ui#61 — canvas mini-map](https://github.com/jaegertracing/jaeger-ui/issues/61), [jaeger-ui#645 — >2000 spans is slow](https://github.com/jaegertracing/jaeger-ui/issues/645)
- [TanStack Virtual Svelte docs](https://tanstack.com/virtual/v3/docs/framework/svelte/svelte-virtual), [Sticky example](https://tanstack.com/virtual/v3/docs/framework/svelte/examples/sticky), [Svelte 5 support issue #866](https://github.com/TanStack/virtual/issues/866)
- [d3-zoom docs](https://d3js.org/d3-zoom), [d3-flame-graph](https://github.com/spiermar/d3-flame-graph), [Brendan Gregg on flame graphs](https://www.brendangregg.com/flamegraphs.html)
- [Boris Smus — Canvas vs SVG perf](https://smus.com/canvas-vs-svg-performance/), [Felt: SVG → Canvas migration](https://felt.com/blog/from-svg-to-canvas-part-1-making-felt-faster)
- [W3C WAI-ARIA APG TreeView pattern](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/examples/treeview-navigation/), [MDN tree role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/tree_role), [Accessible Culture: ARIA trees + screen readers](https://accessibleculture.org/articles/2013/02/not-so-simple-aria-tree-views-and-screen-readers/)
- [Okabe–Ito palette reference](https://conceptviz.app/blog/okabe-ito-palette-hex-codes-complete-reference), Wong 2011 — Nature Methods "Points of view: Color blindness"
- [Svelte 5 — Introducing runes](https://svelte.dev/blog/runes), [$state docs](https://svelte.dev/docs/svelte/$state), [svelte/reactivity docs](https://svelte.dev/docs/svelte/svelte-reactivity), [Best practices](https://svelte.dev/docs/svelte/best-practices)
- [Quadtree vs spatial hash visualization](https://zufallsgenerator.github.io/2014/01/26/visually-comparing-algorithms)
