<script lang="ts">
  import { api } from '$lib/api/client'
  import { selectTrace, type Trace, type TraceDetail } from '$lib/stores/traces.svelte'
  import { loadSession } from '$lib/stores/sessions.svelte'
  import { setTab } from '$lib/stores/tabs.svelte'
  import CopyButton from './CopyButton.svelte'
  let { traceId, spanId }: { traceId?: string | null; spanId?: string | null } = $props()
  let error = $state('')
  let busy = $state(false)
  let sessionId = $state<string | null>(null)
  let resolved = $state<string | null>(null)
  let generation = 0
  $effect(() => {
    const trace = traceId,
      span = spanId
    const request = ++generation
    error = ''
    sessionId = null
    resolved = null
    if (!trace && !span) return
    busy = true
    async function resolve() {
      try {
        let exact: Trace | undefined
        if (span) {
          try {
            exact = (await api.get<TraceDetail>(`/api/traces/${encodeURIComponent(span)}`)).trace
          } catch {
            /* A retained sibling can still provide trace context after eviction. */
          }
        }
        const rows = trace
          ? await api.get<Trace[]>(`/api/traces?trace_id=${encodeURIComponent(trace)}&limit=10000`)
          : []
        const target = exact ?? rows.find((row) => row.id === span) ?? rows[0]
        if (request !== generation) return
        resolved = target?.id ?? null
        sessionId = target?.session_id ?? rows.find((row) => row.session_id)?.session_id ?? null
        if (!target) error = 'No captured spans for this trace.'
      } catch {
        if (request === generation) error = 'Could not resolve this trace.'
      } finally {
        if (request === generation) busy = false
      }
    }
    void resolve()
    return () => {
      generation++
    }
  })
</script>

<div class="correlation-actions">
  {#if traceId || spanId}
    <button
      class="btn-secondary"
      disabled={busy || !resolved}
      onclick={() => {
        if (resolved) {
          setTab('traces')
          void selectTrace(resolved)
        }
      }}>Open trace</button
    >
    {#if traceId}<CopyButton value={traceId} label="trace ID" />{/if}
    {#if spanId}<CopyButton value={spanId} label="span ID" />{/if}
    {#if sessionId}<button
        class="btn-secondary"
        onclick={() => {
          if (sessionId) {
            setTab('sessions')
            void loadSession(sessionId)
          }
        }}>Open session</button
      >{/if}
    {#if error}<p role="status">{error}</p>{/if}
  {:else}<p>No trace correlation captured.</p>{/if}
</div>

<style>
  .correlation-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 8px 0;
    font-size: 12px;
  }
</style>
