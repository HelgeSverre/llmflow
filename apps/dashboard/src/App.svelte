<script lang="ts">
  import { onMount } from 'svelte'
  import { refreshActiveTab } from '$lib/stores/refresh'
  import Header from '$lib/components/layout/Header.svelte'
  import PricingFreshnessBanner from '$lib/components/layout/PricingFreshnessBanner.svelte'
  import Tabs from '$lib/components/layout/Tabs.svelte'
  import TimelineTab from '$lib/components/timeline/TimelineTab.svelte'
  import TracesTab from '$lib/components/traces/TracesTab.svelte'
  import LogsTab from '$lib/components/logs/LogsTab.svelte'
  import MetricsTab from '$lib/components/metrics/MetricsTab.svelte'
  import ModelsTab from '$lib/components/models/ModelsTab.svelte'
  import AnalyticsTab from '$lib/components/analytics/AnalyticsTab.svelte'
  import SessionsTab from '$lib/components/sessions/SessionsTab.svelte'
  import { tabState, initTabHashSync, setTab, validTabs } from '$lib/stores/tabs.svelte'
  import { initTheme, toggleTheme } from '$lib/stores/theme.svelte'
  import { initWebSocket, disconnectWebSocket } from '$lib/stores/websocket.svelte'
  import { loadStats, initStatsSync } from '$lib/stores/stats.svelte'

  onMount(() => {
    initTheme()
    const stopTabSync = initTabHashSync()
    initWebSocket()
    loadStats()
    const stopStatsSync = initStatsSync()

    // Polling fallback for stats
    const statsInterval = setInterval(loadStats, 30000)

    // Keyboard shortcuts
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return
      const focused = document.activeElement as HTMLElement | null
      const isInputFocused =
        !!focused &&
        (['INPUT', 'TEXTAREA', 'SELECT'].includes(focused.tagName) || focused.isContentEditable)

      // "/" to focus search
      if (e.key === '/' && !isInputFocused) {
        e.preventDefault()
        const searchInput = document.querySelector<HTMLInputElement>(
          '.tab-content.active .filter-bar input[type="text"]',
        )
        searchInput?.focus()
        return
      }

      // Escape: blur input
      if (e.key === 'Escape') {
        if (isInputFocused) {
          ;(document.activeElement as HTMLElement)?.blur()
        }
        return
      }

      if (isInputFocused) return

      // Tab shortcuts follow the displayed tab order.
      if (/^[1-9]$/.test(e.key)) {
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
        void refreshActiveTab()
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
      disconnectWebSocket()
      stopTabSync()
      stopStatsSync()
      clearInterval(statsInterval)
      window.removeEventListener('keydown', handleKeydown)
    }
  })
</script>

<div class="container">
  <Header />
  <PricingFreshnessBanner />

  <main>
    <Tabs />

    <div
      id="timelineTab"
      class="tab-content {tabState.current === 'timeline' ? 'active' : ''}"
      data-testid="timeline-tab"
    >
      <TimelineTab />
    </div>
    <div
      id="tracesTab"
      class="tab-content {tabState.current === 'traces' ? 'active' : ''}"
      data-testid="traces-tab"
    >
      <TracesTab />
    </div>
    <div
      id="sessionsTab"
      class="tab-content {tabState.current === 'sessions' ? 'active' : ''}"
      data-testid="sessions-tab"
    >
      <SessionsTab />
    </div>
    <div
      id="logsTab"
      class="tab-content {tabState.current === 'logs' ? 'active' : ''}"
      data-testid="logs-tab"
    >
      <LogsTab />
    </div>
    <div
      id="metricsTab"
      class="tab-content {tabState.current === 'metrics' ? 'active' : ''}"
      data-testid="metrics-tab"
    >
      <MetricsTab />
    </div>
    <div
      id="modelsTab"
      class="tab-content {tabState.current === 'models' ? 'active' : ''}"
      data-testid="models-tab"
    >
      <ModelsTab />
    </div>
    <div
      id="analyticsTab"
      class="tab-content {tabState.current === 'analytics' ? 'active' : ''}"
      data-testid="analytics-tab"
    >
      <AnalyticsTab />
    </div>
  </main>
</div>
