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
  selected: null as SessionDetail | null,
  loading: false,
  error: null as string | null,
})

export async function loadSessions(limit = 50, offset = 0) {
  sessionsState.loading = true
  try {
    const r = await api.get<{ sessions: SessionSummary[]; total: number }>(
      `/api/sessions?limit=${limit}&offset=${offset}`,
    )
    sessionsState.list = r.sessions
    sessionsState.total = r.total
    sessionsState.error = null
  } catch (e) {
    sessionsState.error = (e as Error).message
  } finally {
    sessionsState.loading = false
  }
}

export async function loadSession(id: string) {
  sessionsState.loading = true
  try {
    sessionsState.selected = await api.get<SessionDetail>(`/api/sessions/${encodeURIComponent(id)}`)
    sessionsState.error = null
  } catch (e) {
    sessionsState.error = (e as Error).message
  } finally {
    sessionsState.loading = false
  }
}
