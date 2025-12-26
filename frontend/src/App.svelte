<script lang="ts">
  import { onMount } from 'svelte'
  import Header from '$lib/components/layout/Header.svelte'
  import Tabs from '$lib/components/layout/Tabs.svelte'
  import TimelineTab from '$lib/components/timeline/TimelineTab.svelte'
  import TracesTab from '$lib/components/traces/TracesTab.svelte'
  import LogsTab from '$lib/components/logs/LogsTab.svelte'
  import MetricsTab from '$lib/components/metrics/MetricsTab.svelte'
  import ModelsTab from '$lib/components/models/ModelsTab.svelte'
  import AnalyticsTab from '$lib/components/analytics/AnalyticsTab.svelte'
  import { tabState, initTabHashSync, setTab, validTabs } from '$lib/stores/tabs.svelte'
  import { initTheme, toggleTheme } from '$lib/stores/theme.svelte'
  import { initWebSocket } from '$lib/stores/websocket.svelte'
  import { loadStats, initStatsSync } from '$lib/stores/stats.svelte'

  

  onMount(() => {
    initTheme()
    initTabHashSync()
    initWebSocket()
    loadStats()
    initStatsSync()
    
    // Polling fallback for stats
    const statsInterval = setInterval(loadStats, 30000)
    
    // Keyboard shortcuts
    const handleKeydown = (e: KeyboardEvent) => {
      const isInputFocused = ['INPUT', 'TEXTAREA', 'SELECT'].includes((document.activeElement?.tagName || ''))
      
      // "/" to focus search
      if (e.key === '/' && !isInputFocused) {
        e.preventDefault()
        const searchInput = document.querySelector<HTMLInputElement>('.filter-bar input[type="text"]')
        searchInput?.focus()
        return
      }
      
      // Escape: blur input
      if (e.key === 'Escape') {
        if (isInputFocused) {
          (document.activeElement as HTMLElement)?.blur()
        }
        return
      }
      
      if (isInputFocused) return
      
      // Tab shortcuts: 1-6 for tabs
      if (e.key >= '1' && e.key <= '6' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const tabIndex = parseInt(e.key) - 1
        if (tabIndex < validTabs.length) {
          e.preventDefault()
          setTab(validTabs[tabIndex])
        }
        return
      }
      
      // "t" to toggle theme
      if (e.key === 't' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        toggleTheme()
        return
      }
      
      // Arrow key / j/k navigation
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'j' || e.key === 'k') {
        e.preventDefault()
        navigateList(e.key === 'ArrowDown' || e.key === 'j' ? 1 : -1)
        return
      }
      
      // "r" to refresh
      if (e.key === 'r' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        // Trigger refresh by dispatching custom event or calling load functions
        window.dispatchEvent(new CustomEvent('llmflow:refresh'))
        return
      }
    }
    
    function navigateList(direction: number) {
      let rows: HTMLElement[]
      let currentSelected: HTMLElement | null
      
      if (tabState.current === 'timeline') {
        rows = Array.from(document.querySelectorAll('.timeline-item'))
        currentSelected = document.querySelector('.timeline-item.selected')
      } else if (tabState.current === 'traces') {
        rows = Array.from(document.querySelectorAll('#tracesBody .trace-row'))
        currentSelected = document.querySelector('#tracesBody .trace-row.selected')
      } else if (tabState.current === 'logs') {
        rows = Array.from(document.querySelectorAll('[data-testid="logs-body"] .trace-row'))
        currentSelected = document.querySelector('[data-testid="logs-body"] .trace-row.selected')
      } else if (tabState.current === 'metrics') {
        rows = Array.from(document.querySelectorAll('[data-testid="metrics-body"] .trace-row'))
        currentSelected = document.querySelector('[data-testid="metrics-body"] .trace-row.selected')
      } else {
        return
      }
      
      if (rows.length === 0) return
      
      let currentIndex = currentSelected ? rows.indexOf(currentSelected) : -1
      let newIndex = currentIndex + direction
      
      if (newIndex < 0) newIndex = rows.length - 1
      if (newIndex >= rows.length) newIndex = 0
      
      const newRow = rows[newIndex]
      if (newRow) {
        newRow.click()
        newRow.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }
    
    window.addEventListener('keydown', handleKeydown)
    
    return () => {
      clearInterval(statsInterval)
      window.removeEventListener('keydown', handleKeydown)
    }
  })
</script>

<div class="container">
  <Header />

  <main>
    <Tabs />

    <div id="timelineTab" class="tab-content {tabState.current === 'timeline' ? 'active' : ''}" data-testid="timeline-tab">
      <TimelineTab />
    </div>
    <div id="tracesTab" class="tab-content {tabState.current === 'traces' ? 'active' : ''}" data-testid="traces-tab">
      <TracesTab />
    </div>
    <div id="logsTab" class="tab-content {tabState.current === 'logs' ? 'active' : ''}" data-testid="logs-tab">
      <LogsTab />
    </div>
    <div id="metricsTab" class="tab-content {tabState.current === 'metrics' ? 'active' : ''}" data-testid="metrics-tab">
      <MetricsTab />
    </div>
    <div id="modelsTab" class="tab-content {tabState.current === 'models' ? 'active' : ''}" data-testid="models-tab">
      <ModelsTab />
    </div>
    <div id="analyticsTab" class="tab-content {tabState.current === 'analytics' ? 'active' : ''}" data-testid="analytics-tab">
      <AnalyticsTab />
    </div>
  </main>
</div>
