<script lang="ts">
  import { untrack } from 'svelte'
  import { TraceViewport, type SpanInput } from '$lib/trace/viewport.svelte'
  import SpanRow from './SpanRow.svelte'

  interface Props {
    spans: SpanInput[]
    traceId?: string
    onSelect?: (id: string | null) => void
  }

  let { spans, traceId, onSelect }: Props = $props()

  const ROW_HEIGHT_PX = 28
  const OVERSCAN = 8

  const viewport = new TraceViewport([])
  let previousTraceId: string | undefined

  let scrollEl: HTMLDivElement
  let axisBar: HTMLDivElement
  let scrollTop = $state(0)
  let containerHeight = $state(0)

  $effect(() => {
    const nextSpans = spans
    const nextTraceId = traceId
    untrack(() => {
      const reset = nextTraceId !== previousTraceId
      const selected = viewport.selectedId
      viewport.setSpans(nextSpans, reset)
      previousTraceId = nextTraceId
      if (selected !== viewport.selectedId) onSelect?.(viewport.selectedId)
      if (reset && scrollEl) scrollEl.scrollTop = scrollTop = 0
    })
  })

  $effect(() => {
    if (!scrollEl || !axisBar) return
    const ro = new ResizeObserver(() => {
      containerHeight = scrollEl.clientHeight
      viewport.setViewportWidth(axisBar.getBoundingClientRect().width)
    })
    ro.observe(scrollEl)
    ro.observe(axisBar)
    return () => ro.disconnect()
  })

  const total = $derived(viewport.rows.length)
  $effect(() => {
    const maxScroll = Math.max(0, total * ROW_HEIGHT_PX + 24 - containerHeight)
    if (scrollEl && scrollTop > maxScroll) scrollEl.scrollTop = scrollTop = maxScroll
  })
  const visibleStart = $derived(
    Math.min(
      total,
      Math.max(0, Math.floor(Math.max(0, scrollTop - 24) / ROW_HEIGHT_PX) - OVERSCAN),
    ),
  )
  const visibleEnd = $derived(
    Math.min(total, Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT_PX) + OVERSCAN),
  )
  const visibleRows = $derived(viewport.rows.slice(visibleStart, visibleEnd))
  const padTop = $derived(visibleStart * ROW_HEIGHT_PX)
  const padBottom = $derived((total - visibleEnd) * ROW_HEIGHT_PX)

  function handleSelect(id: string) {
    viewport.select(id)
    onSelect?.(id)
  }
</script>

<div
  bind:this={scrollEl}
  class="waterfall"
  onscroll={(e) => {
    scrollTop = (e.currentTarget as HTMLDivElement).scrollTop
  }}
>
  <div class="time-axis">
    <div class="axis-label-spacer"></div>
    <div class="axis-bar-area" bind:this={axisBar}>
      <span class="axis-tick axis-start">0ms</span>
      <span class="axis-tick axis-mid">{Math.round(viewport.totalDuration / 2)}ms</span>
      <span class="axis-tick axis-end">{Math.round(viewport.totalDuration)}ms</span>
    </div>
    <div class="axis-duration-spacer"></div>
  </div>
  <div
    class="row-list"
    role="tree"
    aria-label="Trace spans"
    style:padding-top="{padTop}px"
    style:padding-bottom="{padBottom}px"
  >
    {#each visibleRows as row (row.id)}
      <SpanRow
        {row}
        selected={viewport.selectedId === row.id}
        onClick={handleSelect}
        onToggle={(id) => viewport.toggle(id)}
      />
    {/each}
  </div>
</div>

<style>
  .waterfall {
    --waterfall-columns: minmax(100px, 35%) minmax(0, 1fr) 64px;
    --waterfall-gap: 8px;
    height: 100%;
    overflow-y: auto;
    position: relative;
    font-family: inherit;
  }
  .time-axis {
    position: sticky;
    top: 0;
    height: 24px;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-primary);
    z-index: 1;
    display: grid;
    grid-template-columns: var(--waterfall-columns);
    column-gap: var(--waterfall-gap);
  }
  .axis-bar-area {
    position: relative;
  }
  .axis-tick {
    position: absolute;
    top: 0;
    font-size: 11px;
    color: var(--text-tertiary);
    padding: 4px 0;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .axis-start {
    left: 0;
  }
  .axis-mid {
    left: 50%;
    transform: translateX(-50%);
  }
  .axis-end {
    right: 0;
  }
  .row-list {
    will-change: transform;
  }
</style>
