<script lang="ts">
  import { onMount } from 'svelte'
  import MetricsSummary from './MetricsSummary.svelte'
  import MetricsTable from './MetricsTable.svelte'
  import { 
    metricFilters, 
    filterOptions, 
    loadMetrics, 
    loadMetricsSummary,
    loadFilterOptions, 
    clearFilters 
  } from '$lib/stores/metrics.svelte'
  import { tabState } from '$lib/stores/tabs.svelte'

  function handleNameChange(e: Event) {
    metricFilters.name = (e.target as HTMLSelectElement).value
    loadMetrics()
  }

  function handleServiceChange(e: Event) {
    metricFilters.service_name = (e.target as HTMLSelectElement).value
    loadMetrics()
  }

  function handleTypeChange(e: Event) {
    metricFilters.metric_type = (e.target as HTMLSelectElement).value
    loadMetrics()
  }

  function handleClear() {
    clearFilters()
  }

  onMount(() => {
    loadFilterOptions()
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
    Clear
  </button>
</div>

<div class="metrics-layout">
  <MetricsSummary />
  <div class="metrics-table-container">
    <MetricsTable />
  </div>
</div>
