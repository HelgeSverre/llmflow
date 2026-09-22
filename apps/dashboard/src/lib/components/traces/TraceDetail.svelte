<script lang="ts">
  import RequestView from '../shared/RequestView.svelte'
  import { tracesDetailState } from '$lib/stores/traces.svelte'

  import SpanWaterfall from '$lib/components/trace-viewer/SpanWaterfall.svelte'
  import SpanDetailPanel from '$lib/components/trace-viewer/SpanDetailPanel.svelte'
  import { selectedTrace, selectedTraceId, selectTrace } from '$lib/stores/traces.svelte'

  import { flattenTraceTree } from '$lib/trace/tree'

  let replaying = $state(false)
  let replayError = $state('')
  async function replay() {
    const id = selectedId || selectedTraceId.value
    if (!id) return
    replaying = true
    replayError = ''
    try {
      const response = await fetch(`/api/traces/${encodeURIComponent(id)}/replay`, {
        method: 'POST',
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Replay failed')
      await selectTrace(result.id)
      selectedId = result.id
    } catch (error) {
      replayError = (error as Error).message
    } finally {
      replaying = false
    }
  }

  let selectedId = $state<string | null>(null)
  // Reset span selection when the trace changes so we don't keep an id pointing into the old trace.
  $effect(() => {
    selectedTraceId.value
    selectedId = selectedTraceId.value
  })

  const viewportSpans = $derived(flattenTraceTree(selectedTrace.value?.spans ?? []))
  const selectedSpan = $derived(viewportSpans.find((s) => s.id === selectedId) ?? null)
</script>

<div class="panel-right trace-panel" data-testid="traces-detail-panel">
  <RequestView
    state={tracesDetailState}
    retry={() => selectedTraceId.value && selectTrace(selectedTraceId.value)}
  >
    {#if selectedTrace.value}
      <div class="replay-bar">
        <button
          class="btn-secondary"
          disabled={replaying || !!selectedSpan?.replay_unavailable_reason}
          onclick={replay}>{replaying ? 'Replaying…' : 'Replay request'}</button
        >
        <span
          >{selectedSpan?.replay_unavailable_reason ||
            'Runs a new provider request using the server’s configured credentials.'}</span
        >
        {#if replayError}<p role="alert">{replayError}</p>{/if}
      </div>
    {/if}
    {#if selectedTrace.value?.partial}
      <p class="partial-notice">
        Partial trace — some spans were evicted or have not arrived. Totals cover retained spans.
      </p>
    {/if}
    <div class="trace-detail">
      {#if selectedTrace.value && viewportSpans.length > 0}
        <div class="waterfall-pane">
          <SpanWaterfall
            spans={viewportSpans}
            {selectedId}
            traceId={selectedTraceId.value ?? undefined}
            onSelect={(id) => (selectedId = id)}
          />
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
  </RequestView>
</div>

<style>
  .replay-bar {
    padding: 8px 12px;
    font-size: 12px;
    flex-shrink: 0;
  }
  .replay-bar span {
    margin-left: 8px;
    color: var(--text-tertiary);
  }
  .partial-notice {
    padding: 8px;
    color: var(--warning);
    flex-shrink: 0;
  }
  .trace-panel {
    container-type: inline-size;
  }

  .trace-detail {
    flex: 1;
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(280px, 38%);
    min-width: 0;
    min-height: 0;
  }

  @container (max-width: 1000px) {
    .trace-detail {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: minmax(100px, 30%) minmax(0, 1fr);
    }
  }

  .waterfall-pane,
  .detail-pane {
    min-width: 0;
    min-height: 0;
  }

  .empty-state {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-tertiary);
    font-size: 14px;
  }
</style>
