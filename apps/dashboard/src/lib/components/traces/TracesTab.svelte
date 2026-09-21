<script lang="ts">
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
    loadFilterOptions()
    const unsubscribe = initTracesSync()
    return () => {
      searchDebounce.cancel()
      unsubscribe()
    }
  })

  $effect(() => {
    if (tabState.current === 'traces') {
      loadTraces()
    }
  })
</script>

<div class="filter-bar" data-testid="traces-filters">
  <input
    type="text"
    id="searchInput"
    data-testid="traces-search"
    placeholder="Search... (press /)"
    value={searchInput}
    oninput={handleSearchInput}
  />
  <select
    id="modelFilter"
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
    data-testid="traces-date-filter"
    value={traceFilters.dateRange}
    onchange={handleDateChange}
  >
    <option value="">All Time</option>
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
    Clear
  </button>
</div>

<div class="split-layout">
  <div class="panel-left">
    <TracesTable />
  </div>
  <TraceDetail />
</div>
