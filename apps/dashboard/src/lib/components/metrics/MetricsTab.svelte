<script lang="ts">
  import { connectionStatus } from '$lib/stores/websocket.svelte'
  import { metrics } from '$lib/stores/metrics.svelte'
  import RequestView from '$lib/components/shared/RequestView.svelte'
  import { metricsState, metricSummaryState } from '$lib/stores/metrics.svelte'
  import { onMount } from 'svelte'
  import MetricsSummary from './MetricsSummary.svelte'
  import MetricsTable from './MetricsTable.svelte'
  import {
    initMetricsSync,
    metricFilters,
    filterOptions,
    loadMetrics,
    loadMetricsSummary,
    loadFilterOptions,
    clearFilters,
  } from '$lib/stores/metrics.svelte'
  import { tabState } from '$lib/stores/tabs.svelte'

  function handleNameChange(e: Event) {
    metricFilters.name = (e.target as HTMLSelectElement).value
  }

  function handleServiceChange(e: Event) {
    metricFilters.service_name = (e.target as HTMLSelectElement).value
  }

  function handleTypeChange(e: Event) {
    metricFilters.metric_type = (e.target as HTMLSelectElement).value
  }

  function handleClear() {
    clearFilters()
  }

  onMount(() => {
    loadFilterOptions()
    return initMetricsSync()
  })

  $effect(() => {
    if (tabState.current === 'metrics') {
      loadMetrics()
      loadMetricsSummary()
    }
  })
</script>

<div class="filter-bar" data-testid="metrics-filters">
  <select
    id="metricNameFilter"
    aria-label="Metric"
    data-testid="metrics-name-filter"
    value={metricFilters.name}
    onchange={handleNameChange}
  >
    <option value="">All Metrics</option>
    {#each filterOptions.names as name}
      <option value={name}>{name}</option>
    {/each}
  </select>
  <select
    id="metricServiceFilter"
    aria-label="Service"
    data-testid="metrics-service-filter"
    value={metricFilters.service_name}
    onchange={handleServiceChange}
  >
    <option value="">All Services</option>
    {#each filterOptions.services as service}
      <option value={service}>{service}</option>
    {/each}
  </select>
  <select
    id="metricTypeFilter"
    aria-label="Type"
    data-testid="metrics-type-filter"
    value={metricFilters.metric_type}
    onchange={handleTypeChange}
  >
    <option value="">All Types</option>
    <option value="sum">Sum (Counter)</option>
    <option value="gauge">Gauge</option>
    <option value="histogram">Histogram</option>
  </select>
  <button
    id="clearMetricFilters"
    class="btn-secondary"
    data-testid="metrics-clear-filters"
    onclick={handleClear}
  >
    Clear filters
  </button>
</div>

<div class="view-status">
  <span
    >{metrics.length} results · latest 100 matching records · Filters apply to this view · All time ·
    {connectionStatus.value === 'connected' ? 'Live' : 'Disconnected · use Refresh'}</span
  ><button
    class="btn-secondary"
    onclick={() => {
      loadMetrics()
      loadMetricsSummary()
      loadFilterOptions()
    }}>Refresh</button
  >
</div>
<RequestView state={metricsState} retry={loadMetrics}>
  <div class="metrics-layout">
    <RequestView state={metricSummaryState} retry={loadMetricsSummary}
      ><MetricsSummary /></RequestView
    >
    <div class="metrics-table-container">
      <MetricsTable />
    </div>
  </div>
</RequestView>
