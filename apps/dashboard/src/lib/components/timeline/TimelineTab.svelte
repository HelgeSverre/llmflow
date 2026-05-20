<script lang="ts">
  import { onMount } from 'svelte'
  import TimelineList from './TimelineList.svelte'
  import TimelineDetail from './TimelineDetail.svelte'
  import { 
    timelineFilters, 
    loadTimeline, 
    clearFilters,
    initTimelineSync 
  } from '$lib/stores/timeline.svelte'
  import { tabState } from '$lib/stores/tabs.svelte'

  let searchInput = $state('')
  let debounceTimer: ReturnType<typeof setTimeout>

  function handleSearchInput(e: Event) {
    const value = (e.target as HTMLInputElement).value
    searchInput = value
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      timelineFilters.q = value
      loadTimeline()
    }, 300)
  }

  function handleToolChange(e: Event) {
    timelineFilters.tool = (e.target as HTMLSelectElement).value
    loadTimeline()
  }

  function handleTypeChange(e: Event) {
    timelineFilters.type = (e.target as HTMLSelectElement).value
    loadTimeline()
  }

  function handleDateChange(e: Event) {
    timelineFilters.dateRange = (e.target as HTMLSelectElement).value
    loadTimeline()
  }

  function handleClear() {
    searchInput = ''
    clearFilters()
  }

  onMount(() => {
    initTimelineSync()
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
    data-testid="timeline-search" 
    placeholder="Search timeline... (press /)" 
    value={searchInput}
    oninput={handleSearchInput}
  />
  <select 
    id="toolFilter" 
    data-testid="timeline-tool-filter"
    value={timelineFilters.tool}
    onchange={handleToolChange}
  >
    <option value="">All Tools</option>
    <option value="claude-code">Claude Code</option>
    <option value="codex-cli">Codex CLI</option>
    <option value="gemini-cli">Gemini CLI</option>
    <option value="aider">Aider</option>
    <option value="proxy">Proxy</option>
  </select>
  <select 
    id="timelineTypeFilter" 
    data-testid="timeline-type-filter"
    value={timelineFilters.type}
    onchange={handleTypeChange}
  >
    <option value="">All Types</option>
    <option value="trace">Traces</option>
    <option value="log">Logs</option>
    <option value="metric">Metrics</option>
  </select>
  <select 
    id="timelineDateFilter" 
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
    Clear
  </button>
</div>

<div class="split-layout">
  <div class="panel-left">
    <TimelineList />
  </div>
  <TimelineDetail />
</div>
