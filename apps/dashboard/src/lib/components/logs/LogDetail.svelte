<script lang="ts">
  import { selectedLog } from '$lib/stores/logs.svelte'
</script>

<div id="logDetailPanel" class="panel-right" data-testid="logs-detail-panel">
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
          selectedLog.value.trace_id ? `trace: ${selectedLog.value.trace_id.slice(0, 8)}...` : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      {/if}
    </span>
  </div>
  <div class="detail-body">
    <div class="detail-section">
      <h3>Body</h3>
      <pre data-testid="log-body">{selectedLog.value?.body || '-'}</pre>
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
</div>
