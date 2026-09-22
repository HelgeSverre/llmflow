import { api } from '$lib/api/client'
import { onMessage } from './websocket.svelte'
import { tabState } from './tabs.svelte'

export interface SessionSummary {
  session_id: string
  first_seen: number
  last_seen: number
  trace_count: number
  total_cost: number
  total_tokens: number
  agent_name: string | null
  service_name: string | null
}

export interface SessionDetail {
  session_id: string
  traces: Array<{
    trace_id: string
    root_span_id: string
    name?: string
    service_name?: string
    error_span_id?: string
    started_at: number
    ended_at: number
    cost: number
    tokens: number
    span_count: number
    has_error: number
  }>
  summary: { cost: number; tokens: number; spans: number; errors: number }
}

export const sessionsState = $state({
  list: [] as SessionSummary[],
  total: 0,
  q: '',
  loaded: false,
  view: 'list' as 'list' | 'detail',
  limit: 50,
  offset: 0,
  selected: null as SessionDetail | null,
  selectedId: null as string | null,
  loading: false,
  error: null as string | null,
})

let listRequest = 0
let pendingPage: { limit: number; offset: number } | null = null
export async function loadSessions(
  limit = pendingPage?.limit ?? sessionsState.limit,
  offset = pendingPage?.offset ?? sessionsState.offset,
) {
  if (sessionsState.view === 'list') detailRequest++
  pendingPage = { limit, offset }
  const request = ++listRequest
  sessionsState.loading = true
  try {
    const r = await api.get<{ sessions: SessionSummary[]; total: number }>(
      `/api/sessions?limit=${limit}&offset=${offset}${sessionsState.q ? `&q=${encodeURIComponent(sessionsState.q)}` : ''}`,
    )
    if (request !== listRequest) return
    sessionsState.limit = limit
    sessionsState.offset = offset
    sessionsState.loaded = true
    sessionsState.list = r.sessions
    sessionsState.total = r.total
    sessionsState.error = null
  } catch (e) {
    if (request === listRequest) sessionsState.error = (e as Error).message
  } finally {
    if (request === listRequest) {
      pendingPage = null
      sessionsState.loading = false
    }
  }
}

let detailRequest = 0
export async function loadSession(id: string) {
  listRequest++
  pendingPage = null
  sessionsState.view = 'detail'
  const request = ++detailRequest
  if (sessionsState.selectedId !== id) sessionsState.selected = null
  sessionsState.selectedId = id
  sessionsState.loading = true
  try {
    const detail = await api.get<SessionDetail>(`/api/sessions/${encodeURIComponent(id)}`)
    if (request !== detailRequest) return
    sessionsState.selected = detail
    sessionsState.error = null
  } catch (e) {
    if (request === detailRequest) sessionsState.error = (e as Error).message
  } finally {
    if (request === detailRequest) sessionsState.loading = false
  }
}

export function initSessionsSync(refresh: () => void) {
  let timer: ReturnType<typeof setTimeout> | undefined
  const unsubscribe = onMessage((msg) => {
    if (tabState.current !== 'sessions' || timer) return
    if (msg.type !== 'new_trace' && msg.type !== 'new_span') return
    timer = setTimeout(() => {
      timer = undefined
      if (tabState.current === 'sessions') refresh()
    }, 50)
  })
  return () => {
    unsubscribe()
    clearTimeout(timer)
    listRequest++
    pendingPage = null
    detailRequest++
  }
}
