<script lang="ts">
  import { metricFilters, clearFilters } from '$lib/stores/metrics.svelte'
  import { metrics, type Metric } from '$lib/stores/metrics.svelte'
  import { formatTimestamp, formatTime } from '$lib/utils/format'
  import EmptyState from '$lib/components/shared/EmptyState.svelte'

  function formatValue(m: Metric): string {
    if (m.metric_type === 'histogram') {
      const parts: string[] = []
      if (m.value_int != null) parts.push(`count: ${m.value_int.toLocaleString()}`)
      if (m.value_double != null)
        parts.push(`sum: ${m.value_double.toLocaleString(undefined, { maximumFractionDigits: 4 })}`)
      return parts.join(' · ') || '-'
    }
    const value = m.value_double ?? m.value_int
    if (value != null) return value.toLocaleString(undefined, { maximumFractionDigits: 4 })
    return '-'
  }
</script>

{#if metrics.length === 0}
  {#if Object.values(metricFilters).some(Boolean)}<EmptyState
      message="No results match these filters."
    /><button class="btn-secondary" onclick={clearFilters}>Clear filters</button>
  {:else}<EmptyState message="No metrics found. Send OTLP metrics to /v1/metrics" />{/if}
{:else}
  <table data-testid="metrics-table">
    <thead>
      <tr>
        <th>Time</th>
        <th>Type</th>
        <th>Name</th>
        <th>Value</th>
        <th>Service</th>
      </tr>
    </thead>
    <tbody data-testid="metrics-body">
      {#each metrics as metric (metric.id)}
        <tr class="metric-row">
          <td title={formatTimestamp(metric.timestamp)}>{formatTime(metric.timestamp)}</td>
          <td>
            <span class="metric-badge metric-{metric.metric_type || 'gauge'}">
              {metric.metric_type || 'gauge'}
            </span>
          </td>
          <td>{metric.name}</td>
          <td
            ><span class="metric-value"
              >{formatValue(metric)}{metric.unit ? ` ${metric.unit}` : ''}</span
            ></td
          >
          <td>
            {#if metric.service_name}
              <span class="service-badge">{metric.service_name}</span>
            {:else}
              -
            {/if}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
{/if}
