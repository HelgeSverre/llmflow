<script lang="ts">
  import { logFilters, clearFilters } from '$lib/stores/logs.svelte'
  import { logs, selectedLogId, selectLog, type Log } from '$lib/stores/logs.svelte'
  import { formatTimestamp, formatTime } from '$lib/utils/format'
  import EmptyState from '$lib/components/shared/EmptyState.svelte'

  function getSeverityClass(severityText?: string): string {
    if (!severityText) return 'info'
    const s = severityText.toLowerCase()
    if (s.includes('fatal')) return 'fatal'
    if (s.includes('error')) return 'error'
    if (s.includes('warn')) return 'warn'
    if (s.includes('debug')) return 'debug'
    if (s.includes('trace')) return 'trace'
    return 'info'
  }

  function handleRowClick(log: Log) {
    selectLog(log.id)
  }

  function handleKeyDown(e: KeyboardEvent, log: Log) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      selectLog(log.id)
    }
  }
</script>

{#if logs.length === 0}
  {#if Object.values(logFilters).some(Boolean)}<EmptyState
      message="No results match these filters."
    /><button class="btn-secondary" onclick={clearFilters}>Clear filters</button>
  {:else}<EmptyState message="No logs found. Send OTLP logs to /v1/logs" />{/if}
{:else}
  <table data-testid="logs-table">
    <thead>
      <tr>
        <th>Time</th>
        <th>Severity</th>
        <th>Service</th>
        <th>Event</th>
        <th>Body</th>
      </tr>
    </thead>
    <tbody id="logsBody" data-testid="logs-body">
      {#each logs as log (log.id)}
        <tr
          class="trace-row"
          class:selected={log.id === selectedLogId.value}
          data-testid="log-row"
          data-log-id={log.id}
          onclick={() => handleRowClick(log)}
          onkeydown={(e) => handleKeyDown(e, log)}
          tabindex="0"
          role="button"
        >
          <td data-testid="log-time">{formatTime(log.timestamp)}</td>
          <td data-testid="log-severity">
            <span class="severity-badge severity-{getSeverityClass(log.severity_text)}">
              {log.severity_text || 'INFO'}
            </span>
          </td>
          <td data-testid="log-service">
            {#if log.service_name}
              <span class="service-badge">{log.service_name}</span>
            {:else}
              -
            {/if}
          </td>
          <td data-testid="log-event">
            {#if log.event_name}
              <span class="event-badge">{log.event_name}</span>
            {:else}
              -
            {/if}
          </td>
          <td data-testid="log-body-preview">
            <span class="log-body-preview">{log.body || '-'}</span>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
{/if}
