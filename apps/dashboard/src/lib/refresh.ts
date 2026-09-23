import { tabState, type Tab } from './stores/tabs.svelte'
import { loadTimeline } from './stores/timeline.svelte'
import {
  loadTraces,
  loadFilterOptions as loadTraceFilters,
  selectTrace,
  selectedTraceId,
} from './stores/traces.svelte'
import { loadSessions, loadSession, sessionsState } from './stores/sessions.svelte'
import {
  loadLogs,
  loadFilterOptions as loadLogFilters,
  selectLog,
  selectedLogId,
} from './stores/logs.svelte'
import {
  loadMetrics,
  loadMetricsSummary,
  loadFilterOptions as loadMetricFilters,
} from './stores/metrics.svelte'
import { loadModels } from './stores/models.svelte'
import { loadAnalytics } from './stores/analytics.svelte'
import { loadStats } from './stores/stats.svelte'

const refreshers: Record<Tab, () => Promise<unknown>> = {
  timeline: loadTimeline,
  traces: () =>
    Promise.all([
      loadTraces(),
      loadTraceFilters(),
      selectedTraceId.value ? selectTrace(selectedTraceId.value) : undefined,
    ]),
  sessions: () =>
    sessionsState.view === 'detail' && sessionsState.selectedId
      ? loadSession(sessionsState.selectedId)
      : loadSessions(),
  logs: () =>
    Promise.all([
      loadLogs(),
      loadLogFilters(),
      selectedLogId.value ? selectLog(selectedLogId.value) : undefined,
    ]),
  metrics: () => Promise.all([loadMetrics(), loadMetricsSummary(), loadMetricFilters()]),
  models: loadModels,
  analytics: loadAnalytics,
}
export async function refreshActiveTab() {
  await Promise.all([loadStats(), refreshers[tabState.current]()])
}
