<script lang="ts">
  import RequestView from '../shared/RequestView.svelte'
  import { logsDetailState } from '$lib/stores/logs.svelte'

  import CorrelationActions from '../shared/CorrelationActions.svelte'
  import { formatTimestamp } from '$lib/utils/format'
  import { selectedLog, selectedLogId, selectLog } from '$lib/stores/logs.svelte'
</script>

<div id="logDetailPanel" class="panel-right" data-testid="logs-detail-panel">
  <RequestView
    state={logsDetailState}
    retry={() => selectedLogId.value && selectLog(selectedLogId.value)}
  >
    <div class="detail-header">
      <h2 data-testid="log-detail-title">
        {#if selectedLog.value}
          {selectedLog.value.event_name || selectedLog.value.service_name || 'Log'}
        {:else}
          Select a log
        {/if}
      </h2>
      <span class="detail-meta" data-testid="log-detail-meta">
        {#if selectedLog.value}
          {[
            selectedLog.value.severity_text,
            selectedLog.value.service_name,
            selectedLog.value.trace_id
              ? `trace: ${selectedLog.value.trace_id.slice(0, 8)}...`
              : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        {/if}
      </span>
    </div>
    <div class="detail-body">
      {#if selectedLog.value}<p>{formatTimestamp(selectedLog.value.timestamp)}</p>
        <CorrelationActions
          traceId={selectedLog.value.trace_id}
          spanId={selectedLog.value.span_id}
        />{/if}
      <div class="detail-section">
        <h3>Body</h3>
        <pre data-testid="log-body">{selectedLog.value?.body ?? 'No body captured.'}</pre>
      </div>
      <div class="detail-section">
        <h3>Attributes</h3>
        <pre data-testid="log-attributes">{JSON.stringify(
            selectedLog.value?.attributes || {},
            null,
            2,
          )}</pre>
      </div>
      <div class="detail-section">
        <h3>Resource</h3>
        <pre data-testid="log-resource">{JSON.stringify(
            selectedLog.value?.resource_attributes || {},
            null,
            2,
          )}</pre>
      </div>
    </div>
  </RequestView>
</div>
