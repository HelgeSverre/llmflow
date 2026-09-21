import { api } from '$lib/api/client'

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
  limit: 50,
  offset: 0,
  selected: null as SessionDetail | null,
  loading: false,
  error: null as string | null,
})

let listRequest = 0
export async function loadSessions(limit = sessionsState.limit, offset = sessionsState.offset) {
  const request = ++listRequest
  sessionsState.loading = true
  try {
    const r = await api.get<{ sessions: SessionSummary[]; total: number }>(
      `/api/sessions?limit=${limit}&offset=${offset}`,
    )
    if (request !== listRequest) return
    sessionsState.limit = limit
    sessionsState.offset = offset
    sessionsState.list = r.sessions
    sessionsState.total = r.total
    sessionsState.error = null
  } catch (e) {
    if (request === listRequest) sessionsState.error = (e as Error).message
  } finally {
    if (request === listRequest) sessionsState.loading = false
  }
}

let detailRequest = 0
export async function loadSession(id: string) {
  const request = ++detailRequest
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
