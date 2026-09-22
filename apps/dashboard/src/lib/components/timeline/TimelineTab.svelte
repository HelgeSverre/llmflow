<script lang="ts">
  import { connectionStatus } from '$lib/stores/websocket.svelte'
  import { selectedItem, clearSelection } from '$lib/stores/timeline.svelte'
  import { services, loadServices } from '$lib/stores/services.svelte'
  import { timelineItems } from '$lib/stores/timeline.svelte'
  import InvestigationLayout from '../shared/InvestigationLayout.svelte'
  import RequestView from '$lib/components/shared/RequestView.svelte'
  import { timelineState } from '$lib/stores/timeline.svelte'
  import { onMount } from 'svelte'
  import { createDebounce } from '$lib/utils/debounce'
  import TimelineList from './TimelineList.svelte'
  import TimelineDetail from './TimelineDetail.svelte'
  import {
    timelineFilters,
    loadTimeline,
    clearFilters,
    initTimelineSync,
  } from '$lib/stores/timeline.svelte'
  import { tabState } from '$lib/stores/tabs.svelte'

  let searchInput = $state('')
  $effect(() => {
    searchInput = timelineFilters.q
  })
  const searchDebounce = createDebounce(300)

  function handleSearchInput(e: Event) {
    const value = (e.target as HTMLInputElement).value
    searchInput = value
    searchDebounce.schedule(() => {
      timelineFilters.q = value
    })
  }

  function handleToolChange(e: Event) {
    timelineFilters.tool = (e.target as HTMLInputElement).value
  }

  function handleTypeChange(e: Event) {
    timelineFilters.type = (e.target as HTMLSelectElement).value
  }

  function handleDateChange(e: Event) {
    timelineFilters.dateRange = (e.target as HTMLSelectElement).value
  }

  function handleClear() {
    searchDebounce.cancel()
    searchInput = ''
    clearFilters()
  }

  onMount(() => {
    loadServices()
    const unsubscribe = initTimelineSync()
    return () => {
      unsubscribe()
      searchDebounce.cancel()
    }
  })

  $effect(() => {
    if (tabState.current === 'timeline') {
      loadTimeline()
    }
  })
</script>

<div class="filter-bar" data-testid="timeline-filters">
  <input
    type="text"
    id="timelineSearchInput"
    aria-label="Search timeline"
    data-testid="timeline-search"
    placeholder="Search timeline... (press /)"
    value={searchInput}
    oninput={handleSearchInput}
  />
  <select
    id="toolFilter"
    data-testid="timeline-tool-filter"
    aria-label="Service"
    value={timelineFilters.tool}
    onchange={handleToolChange}
    ><option value="">All Services</option>{#each services.values as service}<option value={service}
        >{service}</option
      >{/each}</select
  >
  <select
    id="timelineTypeFilter"
    aria-label="Type"
    data-testid="timeline-type-filter"
    value={timelineFilters.type}
    onchange={handleTypeChange}
  >
    <option value="">All Types</option>
    <option value="trace">Traces</option>
    <option value="log">Logs</option>
  </select>
  <select
    id="timelineDateFilter"
    aria-label="Time range"
    data-testid="timeline-date-filter"
    value={timelineFilters.dateRange}
    onchange={handleDateChange}
  >
    <option value="">All Time</option>
    <option value="1h">Last Hour</option>
    <option value="24h">Last 24h</option>
    <option value="7d">Last 7d</option>
  </select>
  <button
    id="clearTimelineFilters"
    class="btn-secondary"
    data-testid="timeline-clear-filters"
    onclick={handleClear}
  >
    Clear filters
  </button>
</div>

<div class="view-status">
  <span
    >{timelineItems.length} results · latest 100 matching records · Filters apply to this view · {connectionStatus.value ===
    'connected'
      ? 'Live'
      : 'Disconnected · use Refresh'}</span
  ><button class="btn-secondary" onclick={loadTimeline}>Refresh</button>
</div>
<RequestView state={timelineState} retry={loadTimeline}>
  <InvestigationLayout selected={!!selectedItem.value} close={clearSelection}>
    {#snippet list()}<TimelineList />{/snippet}
    {#snippet detail()}<TimelineDetail />{/snippet}
  </InvestigationLayout>
</RequestView>
