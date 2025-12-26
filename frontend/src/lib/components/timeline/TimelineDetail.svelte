<script lang="ts">
  import { selectedItem, selectedItemData, relatedLogs } from '$lib/stores/timeline.svelte'
  import { formatTime } from '$lib/utils/format'
</script>

<div class="panel-right" data-testid="timeline-detail-panel">
  <div class="detail-header">
    <h2 data-testid="timeline-detail-title">
      {#if selectedItem.value}
        {selectedItem.value.title}
      {:else}
        Select an item
      {/if}
    </h2>
    <span class="detail-meta" data-testid="timeline-detail-meta">
      {#if selectedItem.value}
        {[
          selectedItem.value.type,
          selectedItem.value.model,
          selectedItem.value.service_name
        ].filter(Boolean).join(' · ')}
      {/if}
    </span>
  </div>
  <div class="detail-body">
    <div class="detail-section">
      <pre data-testid="timeline-detail-data">{JSON.stringify(selectedItemData.value || {}, null, 2)}</pre>
    </div>
    {#if relatedLogs.length > 0}
      <div class="detail-section">
        <h3>Related Logs</h3>
        <div data-testid="related-logs">
          {#each relatedLogs as log}
            <div class="related-log-item">
              <pre>{JSON.stringify(log, null, 2)}</pre>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .related-log-item {
    padding: 8px;
    background: var(--bg-tertiary);
    border-radius: 4px;
    margin-bottom: 8px;
  }

  .related-log-item pre {
    font-size: 11px;
    white-space: pre-wrap;
    word-break: break-all;
  }
</style>
