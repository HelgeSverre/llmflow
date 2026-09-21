<script lang="ts">
  import { selectedItem, selectedItemData, relatedLogs } from '$lib/stores/timeline.svelte'
  import type { TraceDetail, Trace } from '$lib/stores/traces.svelte'
  import type { Log } from '$lib/stores/logs.svelte'
  import { selectTrace } from '$lib/stores/traces.svelte'
  import { setTab } from '$lib/stores/tabs.svelte'
  import { api } from '$lib/api/client'
  import SpanDetailPanel from '../trace-viewer/SpanDetailPanel.svelte'

  let linkError = $state('')
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

  async function openTrace(traceId: string) {
    linkError = ''
    try {
      const rows = await api.get<Trace[]>(
        `/api/traces?trace_id=${encodeURIComponent(traceId)}&limit=1`,
      )
      if (!rows.length) {
        linkError = 'No captured spans for this trace.'
        return
      }
      setTab('traces')
      await selectTrace(rows[0].id)
    } catch {
      linkError = 'Could not load this trace.'
    }
  }
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
    {#if span}
      <div class="span-detail"><SpanDetailPanel {span} /></div>
    {:else if log}
      <section>
        <h3>{log.severity_text || 'Log'}</h3>
        {#if log.trace_id}<button onclick={() => openTrace(log.trace_id!)}
            >Open trace {log.trace_id}</button
          >{/if}
        {#if linkError}<p role="alert">{linkError}</p>{/if}
        <h3>Body</h3>
        <pre data-testid="log-body">{log.body ?? 'No body captured.'}</pre>
        <h3>Attributes</h3>
        <pre>{JSON.stringify(log.attributes || {}, null, 2)}</pre>
        <h3>Resource</h3>
        <pre>{JSON.stringify(log.resource_attributes || {}, null, 2)}</pre>
      </section>
    {:else if selectedItem.value}
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
