<script lang="ts">
  import { TraceViewport, type SpanInput } from '$lib/trace/viewport.svelte'
  import SpanRow from './SpanRow.svelte'

  interface Props {
    spans: SpanInput[]
    onSelect?: (id: string) => void
  }

  let { spans, onSelect }: Props = $props()

  const ROW_HEIGHT_PX = 28
  const OVERSCAN = 8

  const viewport = new TraceViewport(spans)

  let scrollEl: HTMLDivElement
  let scrollTop = $state(0)
  let containerHeight = $state(600)
  let waterfallWidth = $state(0)

  $effect(() => {
    if (!scrollEl) return
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        containerHeight = e.contentRect.height
        const barCol = e.contentRect.width * 0.65 - 80
        waterfallWidth = Math.max(200, barCol)
        viewport.setViewportWidth(waterfallWidth)
      }
    })
    ro.observe(scrollEl)
    return () => ro.disconnect()
  })

  const total = $derived(viewport.rows.length)
  const visibleStart = $derived(Math.max(0, Math.floor(scrollTop / ROW_HEIGHT_PX) - OVERSCAN))
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
    <span class="axis-tick">0ms</span>
    <span class="axis-tick" style:left="50%">{Math.round(viewport.totalDuration / 2)}ms</span>
    <span class="axis-tick" style:right="80px">{Math.round(viewport.totalDuration)}ms</span>
  </div>
  <div class="row-list" style:padding-top="{padTop}px" style:padding-bottom="{padBottom}px">
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
    height: 100%;
    overflow-y: auto;
    position: relative;
    font-family: var(--font-sans);
  }
  .time-axis {
    position: sticky;
    top: 0;
    height: 24px;
    background: var(--bg-panel);
    border-bottom: 1px solid var(--row-border);
    z-index: 1;
  }
  .axis-tick {
    position: absolute;
    font-size: 11px;
    color: var(--muted);
    padding: 4px 6px;
  }
  .row-list {
    will-change: transform;
  }
</style>
