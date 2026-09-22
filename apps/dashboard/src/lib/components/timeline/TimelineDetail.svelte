<script lang="ts">
  import {
    selectedItem,
    selectedItemData,
    selectedItemError,
    selectTimelineItem,
    relatedLogs,
  } from '$lib/stores/timeline.svelte'
  import type { TraceDetail } from '$lib/stores/traces.svelte'
  import type { Log } from '$lib/stores/logs.svelte'
  import SpanDetailPanel from '../trace-viewer/SpanDetailPanel.svelte'

  import CorrelationActions from '../shared/CorrelationActions.svelte'
  const detail = $derived(
    selectedItem.value?.type === 'trace' ? (selectedItemData.value as TraceDetail | null) : null,
  )
  const log = $derived(
    selectedItem.value?.type === 'log' ? (selectedItemData.value as Log | null) : null,
  )
  const span = $derived(
    detail
      ? {
          ...detail.trace,
          name: detail.trace.span_name || detail.trace.id,
          request_method: detail.request?.method,
          request_path: detail.request?.path,
          request_headers: detail.request?.headers,
          request_body: detail.request?.body,
          response_status: detail.response?.status,
          response_headers: detail.response?.headers,
          response_body: detail.response?.body,
        }
      : null,
  )
</script>

<div class="panel-right" data-testid="timeline-detail-panel">
  <div class="detail-header">
    <h2 data-testid="timeline-detail-title">{selectedItem.value?.title || 'Select an item'}</h2>
    <span class="detail-meta" data-testid="timeline-detail-meta"
      >{[selectedItem.value?.type, selectedItem.value?.service_name]
        .filter(Boolean)
        .join(' · ')}</span
    >
  </div>
  <div class="detail-body">
    {#if selectedItemError.value}
      <section>
        <p role="alert">{selectedItemError.value}</p>
        <button
          class="btn-secondary"
          onclick={() => selectedItem.value && selectTimelineItem(selectedItem.value)}>Retry</button
        >
      </section>
    {/if}
    {#if span}
      <div class="span-detail"><SpanDetailPanel {span} /></div>
    {:else if log}
      <section>
        <h3>{log.severity_text || 'Log'}</h3>
        <CorrelationActions traceId={log.trace_id} spanId={log.span_id} />
        <h3>Body</h3>
        <pre data-testid="log-body">{log.body ?? 'No body captured.'}</pre>
        <h3>Attributes</h3>
        <pre>{JSON.stringify(log.attributes || {}, null, 2)}</pre>
        <h3>Resource</h3>
        <pre>{JSON.stringify(log.resource_attributes || {}, null, 2)}</pre>
      </section>
    {:else if selectedItem.value && !selectedItemError.value}
      <p>Loading details…</p>
    {/if}
    {#if relatedLogs.length}
      <section data-testid="related-logs">
        <h3>Related Logs</h3>
        {#each relatedLogs as entry (entry.id)}
          <article>
            <strong>{entry.severity_text}</strong>
            <pre>{entry.body}</pre>
          </article>
        {/each}
      </section>
    {/if}
  </div>
</div>

<style>
  .detail-body {
    min-height: 0;
    overflow: auto;
  }
  .span-detail {
    height: 420px;
    min-height: 240px;
  }
  section {
    padding: 12px 16px;
  }
  pre {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  article {
    padding: 8px;
    margin-bottom: 8px;
    background: var(--bg-tertiary);
  }
</style>
