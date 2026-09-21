import { tabState, type Tab } from './tabs.svelte'
import { loadTimeline } from './timeline.svelte'
import {
  loadTraces,
  loadFilterOptions as loadTraceFilters,
  selectTrace,
  selectedTraceId,
} from './traces.svelte'
import { loadSessions, loadSession, sessionsState } from './sessions.svelte'
import {
  loadLogs,
  loadFilterOptions as loadLogFilters,
  selectLog,
  selectedLogId,
} from './logs.svelte'
import {
  loadMetrics,
  loadMetricsSummary,
  loadFilterOptions as loadMetricFilters,
} from './metrics.svelte'
import { loadModels } from './models.svelte'
import { loadAnalytics } from './analytics.svelte'
import { loadStats } from './stats.svelte'

const refreshers: Record<Tab, () => Promise<unknown>> = {
  timeline: loadTimeline,
  traces: () =>
    Promise.all([
      loadTraces(),
      loadTraceFilters(),
      selectedTraceId.value ? selectTrace(selectedTraceId.value) : undefined,
    ]),
  sessions: () =>
    Promise.all([
      loadSessions(),
      sessionsState.selected ? loadSession(sessionsState.selected.session_id) : undefined,
    ]),
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
