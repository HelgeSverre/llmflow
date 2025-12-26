<script lang="ts">
  import { selectedTrace } from '$lib/stores/traces.svelte'
  import SpanTree from './SpanTree.svelte'
</script>

<div class="panel-right" data-testid="traces-detail-panel">
  <div class="detail-header">
    <h2 id="detailTitle" data-testid="trace-detail-title">
      {#if selectedTrace.value}
        {selectedTrace.value.trace.span_name || selectedTrace.value.trace.model || 'Trace'}
      {:else}
        Select a trace
      {/if}
    </h2>
    <span id="detailMeta" class="detail-meta" data-testid="trace-detail-meta">
      {#if selectedTrace.value}
        {[
          selectedTrace.value.trace.model,
          selectedTrace.value.trace.provider,
          selectedTrace.value.trace.duration_ms ? `${selectedTrace.value.trace.duration_ms}ms` : null
        ].filter(Boolean).join(' · ')}
      {/if}
    </span>
  </div>
  <div class="detail-body">
    <div class="detail-section">
      <h3>Info</h3>
      <pre id="traceInfo" data-testid="trace-info">{#if selectedTrace.value}{JSON.stringify({
  id: selectedTrace.value.trace.id,
  timestamp: selectedTrace.value.trace.timestamp,
  duration_ms: selectedTrace.value.trace.duration_ms,
  model: selectedTrace.value.trace.model,
  provider: selectedTrace.value.trace.provider,
  prompt_tokens: selectedTrace.value.trace.prompt_tokens,
  completion_tokens: selectedTrace.value.trace.completion_tokens,
  total_tokens: selectedTrace.value.trace.total_tokens,
  estimated_cost: selectedTrace.value.trace.estimated_cost,
  status: selectedTrace.value.trace.status,
  error: selectedTrace.value.trace.error
}, null, 2)}{:else}{"{}"}{/if}</pre>
    </div>
    <div class="detail-section">
      <h3>Spans</h3>
      <div id="spanTree" class="span-tree" data-testid="span-tree">
        {#if selectedTrace.value?.spans && selectedTrace.value.spans.length > 0}
          <SpanTree spans={selectedTrace.value.spans} />
        {:else}
          <span class="empty-state">
            {#if selectedTrace.value}
              No spans found
            {:else}
              Click a trace to view spans
            {/if}
          </span>
        {/if}
      </div>
    </div>
    <div class="detail-section">
      <h3>Input / Output</h3>
      <pre id="traceIO" data-testid="trace-io">{#if selectedTrace.value}{JSON.stringify({
  request: selectedTrace.value.request?.body,
  response: selectedTrace.value.response?.body
}, null, 2)}{:else}{"{}"}{/if}</pre>
    </div>
  </div>
</div>
