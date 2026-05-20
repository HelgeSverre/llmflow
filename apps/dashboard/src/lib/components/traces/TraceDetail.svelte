<script lang="ts">
  import SpanWaterfall from '$lib/components/trace-viewer/SpanWaterfall.svelte'
  import SpanDetailPanel from '$lib/components/trace-viewer/SpanDetailPanel.svelte'
  import { selectedTrace } from '$lib/stores/traces.svelte'

  let selectedId = $state<string | null>(null)
  const selectedSpan = $derived(
    selectedTrace.value?.spans?.find((s) => s.id === selectedId) ?? null,
  )

  // Adapt store-shape spans to viewport input shape.
  // SpanInput requires: id, parent_id?, name, start_time, duration_ms, span_type?
  // Span has all of these, so we just pass through + spread to keep extra fields.
  const viewportSpans = $derived(
    selectedTrace.value?.spans?.map((s) => ({
      id: s.id,
      parent_id: s.parent_id,
      name: s.name,
      start_time: s.start_time,
      duration_ms: s.duration_ms ?? 0,
      span_type: s.span_type,
      ...s,
    })) ?? [],
  )
</script>

<div class="trace-detail" data-testid="traces-detail-panel">
  {#if selectedTrace.value && viewportSpans.length > 0}
    <div class="waterfall-pane">
      <SpanWaterfall spans={viewportSpans} onSelect={(id) => (selectedId = id)} />
    </div>
    <div class="detail-pane">
      <SpanDetailPanel span={selectedSpan} />
    </div>
  {:else}
    <div class="empty-state">
      {#if !selectedTrace.value}
        <p>Select a trace to view spans</p>
      {:else}
        <p>No spans found</p>
      {/if}
    </div>
  {/if}
</div>

<style>
  .trace-detail {
    display: grid;
    grid-template-columns: 1fr 380px;
    height: 100%;
    min-height: 400px;
  }

  @media (max-width: 900px) {
    .trace-detail {
      grid-template-columns: 1fr;
      grid-template-rows: 1fr 1fr;
    }
  }

  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--muted);
    font-size: 14px;
  }
</style>
