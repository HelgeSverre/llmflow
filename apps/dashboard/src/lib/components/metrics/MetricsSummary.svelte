<script lang="ts">
  import { metricsSummary, type MetricSummary } from '$lib/stores/metrics.svelte'

  function formatMetricValue(m: MetricSummary): string {
    const value =
      m.metric_type === 'histogram'
        ? m.sum_int
        : m.metric_type === 'gauge'
          ? m.avg_value
          : m.sum_value
    if (value != null) return value.toLocaleString(undefined, { maximumFractionDigits: 2 })
    return '-'
  }
</script>

{#if metricsSummary.length > 0}
  <div class="metrics-summary" data-testid="metrics-summary">
    {#each metricsSummary.slice(0, 8) as m (JSON.stringify( [m.name, m.service_name, m.metric_type], ))}
      <div class="metric-card">
        <div class="metric-card-header">
          <span class="metric-card-name" title={m.name}>{m.name}</span>
          <span class="metric-badge metric-{m.metric_type || 'gauge'}"
            >{m.metric_type || 'gauge'}</span
          >
        </div>
        <div class="metric-card-value">{formatMetricValue(m)}</div>
        <div class="metric-card-meta">
          <span
            >{m.metric_type === 'histogram'
              ? 'Observations'
              : m.metric_type === 'gauge'
                ? 'Average'
                : 'Total'} · {m.data_points} data points</span
          >
          <span>{m.service_name || 'unknown'}</span>
        </div>
      </div>
    {/each}
  </div>
{/if}
