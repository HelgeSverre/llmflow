<script lang="ts">
  import { connectionStatus } from '$lib/stores/websocket.svelte'
  import { selectedTraceId, clearSelection } from '$lib/stores/traces.svelte'
  import { services, loadServices } from '$lib/stores/services.svelte'
  import { traces } from '$lib/stores/traces.svelte'
  import InvestigationLayout from '../shared/InvestigationLayout.svelte'
  import RequestView from '$lib/components/shared/RequestView.svelte'
  import { tracesState } from '$lib/stores/traces.svelte'
  import { onMount } from 'svelte'
  import { createDebounce } from '$lib/utils/debounce'
  import TracesTable from './TracesTable.svelte'
  import TraceDetail from './TraceDetail.svelte'
  import {
    traceFilters,
    filterOptions,
    loadTraces,
    loadFilterOptions,
    clearFilters,
    initTracesSync,
  } from '$lib/stores/traces.svelte'
  import { tabState } from '$lib/stores/tabs.svelte'

  let searchInput = $state('')
  $effect(() => {
    searchInput = traceFilters.q
  })
  const searchDebounce = createDebounce(300)

  function handleSearchInput(e: Event) {
    const value = (e.target as HTMLInputElement).value
    searchInput = value
    searchDebounce.schedule(() => {
      traceFilters.q = value
      loadTraces()
    })
  }

  function handleModelChange(e: Event) {
    traceFilters.model = (e.target as HTMLSelectElement).value
    loadTraces()
  }

  function handleStatusChange(e: Event) {
    traceFilters.status = (e.target as HTMLSelectElement).value
    loadTraces()
  }

  function handleDateChange(e: Event) {
    traceFilters.dateRange = (e.target as HTMLSelectElement).value
    loadTraces()
  }

  function handleClear() {
    searchDebounce.cancel()
    searchInput = ''
    clearFilters()
  }

  onMount(() => {
    loadServices()
    const unsubscribe = initTracesSync()
    return () => {
      searchDebounce.cancel()
      unsubscribe()
    }
  })

  $effect(() => {
    if (tabState.current === 'traces') {
      loadFilterOptions()
      loadServices()
      loadTraces()
    }
  })
</script>

<div class="filter-bar" data-testid="traces-filters">
  <input
    type="text"
    id="searchInput"
    aria-label="Search traces"
    data-testid="traces-search"
    placeholder="Search... (press /)"
    value={searchInput}
    oninput={handleSearchInput}
  />
  <select
    aria-label="Service"
    value={traceFilters.service_name}
    onchange={(event) => {
      traceFilters.service_name = event.currentTarget.value
      loadTraces()
    }}
    ><option value="">All Services</option>{#each services.values as service}<option value={service}
        >{service}</option
      >{/each}</select
  >
  <select
    id="modelFilter"
    aria-label="Model"
    data-testid="traces-model-filter"
    value={traceFilters.model}
    onchange={handleModelChange}
  >
    <option value="">All Models</option>
    {#each filterOptions.models as model}
      <option value={model}>{model}</option>
    {/each}
  </select>
  <select
    id="statusFilter"
    aria-label="Status"
    data-testid="traces-status-filter"
    value={traceFilters.status}
    onchange={handleStatusChange}
  >
    <option value="">All Status</option>
    <option value="success">Success</option>
    <option value="error">Error</option>
  </select>
  <select
    id="dateFilter"
    aria-label="Time range"
    data-testid="traces-date-filter"
    value={traceFilters.dateRange}
    onchange={handleDateChange}
  >
    <option value="">All Time</option>{#if traceFilters.dateRange === 'custom'}<option
        value="custom">Model summary time range</option
      >{/if}
    <option value="1h">Last Hour</option>
    <option value="24h">Last 24h</option>
    <option value="7d">Last 7d</option>
  </select>
  <button
    id="clearFilters"
    class="btn-secondary"
    data-testid="traces-clear-filters"
    onclick={handleClear}
  >
    Clear filters
  </button>
</div>

<div class="view-status">
  <span
    >{traces.length} results · latest 50 matching records · Filters apply to this view · {connectionStatus.value ===
    'connected'
      ? 'Live'
      : 'Disconnected · use Refresh'}</span
  ><button class="btn-secondary" onclick={loadTraces}>Refresh</button>
</div>
<RequestView state={tracesState} retry={loadTraces}>
  <InvestigationLayout selected={!!selectedTraceId.value} close={clearSelection}>
    {#snippet list()}<TracesTable />{/snippet}
    {#snippet detail()}<TraceDetail />{/snippet}
  </InvestigationLayout>
</RequestView>
