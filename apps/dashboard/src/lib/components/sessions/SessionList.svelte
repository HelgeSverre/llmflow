<script lang="ts">
  import { sessionsState, loadSession, loadSessions } from '$lib/stores/sessions.svelte'

  import { formatTime, formatTimestamp, formatNumber, formatCost } from '$lib/utils/format'
</script>

{#if sessionsState.error}<p role="alert">
    {sessionsState.error}
    <button class="btn-secondary" onclick={() => loadSessions()}>Retry</button>
  </p>{/if}
{#if sessionsState.loading}<p role="status">Loading sessions…</p>{/if}
{#if sessionsState.loaded && sessionsState.total > 0}
  <nav aria-label="Session pages">
    <button
      class="btn-secondary"
      disabled={sessionsState.loading || sessionsState.offset === 0}
      onclick={() =>
        loadSessions(sessionsState.limit, Math.max(0, sessionsState.offset - sessionsState.limit))}
      >Previous</button
    >
    <span
      >{sessionsState.total === 0 ? 0 : sessionsState.offset + 1}–{Math.min(
        sessionsState.offset + sessionsState.list.length,
        sessionsState.total,
      )} of {sessionsState.total}</span
    >
    <button
      class="btn-secondary"
      disabled={sessionsState.loading ||
        sessionsState.offset + sessionsState.limit >= sessionsState.total}
      onclick={() => loadSessions(sessionsState.limit, sessionsState.offset + sessionsState.limit)}
      >Next</button
    >
  </nav>

  <table class="sessions-table">
    <thead>
      <tr>
        <th>Session</th>
        <th>Agent / Service</th>
        <th>Traces</th>
        <th>Tokens</th>
        <th>Cost</th>
        <th>Last seen</th>
      </tr>
    </thead>
    <tbody>
      {#each sessionsState.list as s (s.session_id)}
        <tr>
          <td class="mono"
            ><button
              class="session-open"
              onclick={() => {
                loadSession(s.session_id)
              }}>{s.session_id}</button
            ></td
          >
          <td>{s.agent_name ?? s.service_name ?? '—'}</td>
          <td>{s.trace_count}</td>
          <td>{formatNumber(s.total_tokens)}</td>
          <td>{formatCost(s.total_cost)}</td>
          <td title={formatTimestamp(s.last_seen)}>{formatTime(s.last_seen)}</td>
        </tr>
      {/each}
    </tbody>
  </table>
{:else if sessionsState.loaded && !sessionsState.loading && !sessionsState.error}
  <p class="empty-state">
    {sessionsState.q
      ? 'No sessions match these filters. Clear filters to see all sessions.'
      : 'No sessions yet. Attach session.id to OTLP spans or session_id to ingested spans to group related traces.'}
  </p>
{/if}

<style>
  .session-open {
    border: 0;
    background: none;
    color: var(--accent-primary);
    text-align: left;
    overflow-wrap: anywhere;
    cursor: pointer;
    font: inherit;
  }
  nav {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
  }
  .sessions-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  th,
  td {
    padding: 8px 12px;
    text-align: left;
    border-bottom: 1px solid var(--border-primary);
  }
  th {
    font-weight: 600;
    color: var(--text-tertiary);
  }
  tbody tr:hover {
    background: var(--bg-hover);
  }
  .mono {
    font-family: ui-monospace, monospace;
    font-size: 12px;
  }
</style>
