<script lang="ts">
  import { onMount } from 'svelte'
  import { createDebounce } from '$lib/utils/debounce'
  import LogsTable from './LogsTable.svelte'
  import LogDetail from './LogDetail.svelte'
  import {
    logFilters,
    filterOptions,
    loadLogs,
    loadFilterOptions,
    clearFilters,
    initLogsSync,
  } from '$lib/stores/logs.svelte'
  import { tabState } from '$lib/stores/tabs.svelte'

  let searchInput = $state('')
  const searchDebounce = createDebounce(300)

  function handleSearchInput(e: Event) {
    const value = (e.target as HTMLInputElement).value
    searchInput = value
    searchDebounce.schedule(() => {
      logFilters.q = value
      loadLogs()
    })
  }

  function handleServiceChange(e: Event) {
    logFilters.service_name = (e.target as HTMLSelectElement).value
    loadLogs()
  }

  function handleEventChange(e: Event) {
    logFilters.event_name = (e.target as HTMLSelectElement).value
    loadLogs()
  }

  function handleSeverityChange(e: Event) {
    const value = (e.target as HTMLSelectElement).value
    logFilters.severity_min = value ? parseInt(value, 10) : null
    loadLogs()
  }

  function handleClear() {
    searchDebounce.cancel()
    searchInput = ''
    clearFilters()
  }

  onMount(() => {
    loadFilterOptions()
    const unsubscribe = initLogsSync()
    return () => {
      searchDebounce.cancel()
      unsubscribe()
    }
  })

  $effect(() => {
    if (tabState.current === 'logs') {
      loadLogs()
    }
  })
</script>

<div class="filter-bar" data-testid="logs-filters">
  <input
    type="text"
    id="logSearchInput"
    data-testid="logs-search"
    placeholder="Search logs... (press /)"
    value={searchInput}
    oninput={handleSearchInput}
  />
  <select
    id="logServiceFilter"
    data-testid="logs-service-filter"
    value={logFilters.service_name}
    onchange={handleServiceChange}
  >
    <option value="">All Services</option>
    {#each filterOptions.services as service}
      <option value={service}>{service}</option>
    {/each}
  </select>
  <select
    id="logEventFilter"
    data-testid="logs-event-filter"
    value={logFilters.event_name}
    onchange={handleEventChange}
  >
    <option value="">All Events</option>
    {#each filterOptions.event_names as eventName}
      <option value={eventName}>{eventName}</option>
    {/each}
  </select>
  <select
    id="logSeverityFilter"
    data-testid="logs-severity-filter"
    value={logFilters.severity_min ?? ''}
    onchange={handleSeverityChange}
  >
    <option value="">All Severity</option>
    <option value="17">Error+</option>
    <option value="13">Warn+</option>
    <option value="9">Info+</option>
    <option value="5">Debug+</option>
  </select>
  <button
    id="clearLogFilters"
    class="btn-secondary"
    data-testid="logs-clear-filters"
    onclick={handleClear}
  >
    Clear
  </button>
</div>

<div class="split-layout">
  <div class="panel-left">
    <LogsTable />
  </div>
  <LogDetail />
</div>
