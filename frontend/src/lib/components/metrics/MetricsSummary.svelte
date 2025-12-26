<script lang="ts">
  import { metricsSummary, type MetricSummary } from '$lib/stores/metrics.svelte'

  function formatMetricValue(m: MetricSummary): string {
    if (m.metric_type === 'sum' && m.sum != null) {
      return m.sum.toLocaleString()
    }
    if (m.latest_value != null) {
      return typeof m.latest_value === 'number' 
        ? m.latest_value.toLocaleString(undefined, { maximumFractionDigits: 2 })
        : String(m.latest_value)
    }
    if (m.avg != null) {
      return m.avg.toLocaleString(undefined, { maximumFractionDigits: 2 })
    }
    return '-'
  }
</script>

{#if metricsSummary.length > 0}
  <div class="metrics-summary" data-testid="metrics-summary">
    {#each metricsSummary.slice(0, 8) as m (m.name + m.service_name)}
      <div class="metric-card">
        <div class="metric-card-header">
          <span class="metric-card-name" title={m.name}>{m.name}</span>
          <span class="metric-badge metric-{m.metric_type || 'gauge'}">{m.metric_type || 'gauge'}</span>
        </div>
        <div class="metric-card-value">{formatMetricValue(m)}</div>
        <div class="metric-card-meta">
          <span>{m.data_points} data points</span>
          <span>{m.service_name || 'unknown'}</span>
        </div>
      </div>
    {/each}
  </div>
{/if}
