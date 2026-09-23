import { beforeEach, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  selectedTraceId: { value: null as string | null },
  selectedLogId: { value: null as string | null },
  sessionsState: { view: 'list', selectedId: null as string | null },
}))

vi.mock('./stores/timeline.svelte', () => ({ loadTimeline: vi.fn() }))
vi.mock('./stores/traces.svelte', () => ({
  loadTraces: vi.fn(),
  loadFilterOptions: vi.fn(),
  selectTrace: vi.fn(),
  selectedTraceId: h.selectedTraceId,
}))
vi.mock('./stores/sessions.svelte', () => ({
  loadSessions: vi.fn(),
  loadSession: vi.fn(),
  sessionsState: h.sessionsState,
}))
vi.mock('./stores/logs.svelte', () => ({
  loadLogs: vi.fn(),
  loadFilterOptions: vi.fn(),
  selectLog: vi.fn(),
  selectedLogId: h.selectedLogId,
}))
vi.mock('./stores/metrics.svelte', () => ({
  loadMetrics: vi.fn(),
  loadMetricsSummary: vi.fn(),
  loadFilterOptions: vi.fn(),
}))
vi.mock('./stores/models.svelte', () => ({ loadModels: vi.fn() }))
vi.mock('./stores/analytics.svelte', () => ({ loadAnalytics: vi.fn() }))
vi.mock('./stores/stats.svelte', () => ({ loadStats: vi.fn() }))

import { refreshActiveTab } from './refresh'
import { tabState, validTabs, type Tab } from './stores/tabs.svelte'
import { loadTimeline } from './stores/timeline.svelte'
import * as traces from './stores/traces.svelte'
import * as sessions from './stores/sessions.svelte'
import * as logs from './stores/logs.svelte'
import * as metrics from './stores/metrics.svelte'
import { loadModels } from './stores/models.svelte'
import { loadAnalytics } from './stores/analytics.svelte'
import { loadStats } from './stores/stats.svelte'

const all = [
  loadTimeline,
  traces.loadTraces,
  traces.loadFilterOptions,
  traces.selectTrace,
  sessions.loadSessions,
  sessions.loadSession,
  logs.loadLogs,
  logs.loadFilterOptions,
  logs.selectLog,
  metrics.loadMetrics,
  metrics.loadMetricsSummary,
  metrics.loadFilterOptions,
  loadModels,
  loadAnalytics,
  loadStats,
].map((fn) => vi.mocked(fn))

const expected: Record<Tab, unknown[]> = {
  timeline: [loadTimeline],
  traces: [traces.loadTraces, traces.loadFilterOptions],
  sessions: [sessions.loadSessions],
  logs: [logs.loadLogs, logs.loadFilterOptions],
  metrics: [metrics.loadMetrics, metrics.loadMetricsSummary, metrics.loadFilterOptions],
  models: [loadModels],
  analytics: [loadAnalytics],
}

beforeEach(() => {
  for (const fn of all) {
    fn.mockReset()
    fn.mockResolvedValue(undefined)
  }
  h.selectedTraceId.value = null
  h.selectedLogId.value = null
  Object.assign(h.sessionsState, { view: 'list', selectedId: null })
})

it.each(validTabs)('refreshes stats and only the %s loaders', async (tab) => {
  tabState.current = tab
  await refreshActiveTab()
  const called = all.filter((fn) => fn.mock.calls.length > 0)
  expect(called).toEqual(all.filter((fn) => fn === loadStats || expected[tab].includes(fn)))
})

it('reloads the selected trace and log', async () => {
  h.selectedTraceId.value = 't1'
  h.selectedLogId.value = 'l1'
  tabState.current = 'traces'
  await refreshActiveTab()
  expect(traces.selectTrace).toHaveBeenCalledWith('t1')
  tabState.current = 'logs'
  await refreshActiveTab()
  expect(logs.selectLog).toHaveBeenCalledWith('l1')
})

it('reloads the open session instead of the list in detail view', async () => {
  Object.assign(h.sessionsState, { view: 'detail', selectedId: 's1' })
  tabState.current = 'sessions'
  await refreshActiveTab()
  expect(sessions.loadSession).toHaveBeenCalledWith('s1')
  expect(sessions.loadSessions).not.toHaveBeenCalled()
})

it('waits for the tab loaders to finish', async () => {
  let release!: () => void
  vi.mocked(loadModels).mockReturnValue(new Promise<void>((r) => (release = r)))
  tabState.current = 'models'
  let settled = false
  const done = refreshActiveTab().then(() => (settled = true))
  await Promise.resolve()
  await Promise.resolve()
  expect(settled).toBe(false)
  release()
  await done
  expect(settled).toBe(true)
})
