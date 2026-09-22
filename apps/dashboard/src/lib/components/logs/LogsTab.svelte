<script lang="ts">
  import { connectionStatus } from '$lib/stores/websocket.svelte'
  import { selectedLogId, clearSelection } from '$lib/stores/logs.svelte'
  import { logs } from '$lib/stores/logs.svelte'
  import InvestigationLayout from '../shared/InvestigationLayout.svelte'
  import RequestView from '$lib/components/shared/RequestView.svelte'
  import { logsState } from '$lib/stores/logs.svelte'
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
  $effect(() => {
    searchInput = logFilters.q
  })
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
    const unsubscribe = initLogsSync()
    return () => {
      searchDebounce.cancel()
      unsubscribe()
    }
  })

  $effect(() => {
    if (tabState.current === 'logs') {
      loadFilterOptions()
      loadLogs()
    }
  })
</script>

<div class="filter-bar" data-testid="logs-filters">
  <input
    type="text"
    id="logSearchInput"
    aria-label="Search logs"
    data-testid="logs-search"
    placeholder="Search logs... (press /)"
    value={searchInput}
    oninput={handleSearchInput}
  />
  <select
    id="logServiceFilter"
    aria-label="Service"
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
    aria-label="Event"
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
    aria-label="Severity"
    data-testid="logs-severity-filter"
    value={logFilters.severity_min == null ? '' : String(logFilters.severity_min)}
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
    Clear filters
  </button>
</div>

<div class="view-status">
  <span
    >{logs.length} results · latest 100 matching records · Filters apply to this view · {connectionStatus.value ===
    'connected'
      ? 'Live'
      : 'Disconnected · use Refresh'}</span
  ><button class="btn-secondary" onclick={loadLogs}>Refresh</button>
</div>
<RequestView state={logsState} retry={loadLogs}>
  <InvestigationLayout selected={!!selectedLogId.value} close={clearSelection}>
    {#snippet list()}<LogsTable />{/snippet}
    {#snippet detail()}<LogDetail />{/snippet}
  </InvestigationLayout>
</RequestView>
