<script lang="ts">
  import { sessionsState, loadSession } from '$lib/stores/sessions.svelte'

  interface Props {
    onSelect: (id: string) => void
  }

  let { onSelect }: Props = $props()

  function fmtDate(ms: number): string {
    return new Date(ms).toISOString().slice(0, 19).replace('T', ' ')
  }
  function fmtAgo(ms: number): string {
    const diff = Date.now() - ms
    if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
    return `${Math.floor(diff / 86_400_000)}d ago`
  }
</script>

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
      <tr
        onclick={() => {
          loadSession(s.session_id)
          onSelect(s.session_id)
        }}
      >
        <td class="mono">{s.session_id}</td>
        <td>{s.agent_name ?? s.service_name ?? '—'}</td>
        <td>{s.trace_count}</td>
        <td>{s.total_tokens.toLocaleString()}</td>
        <td>${s.total_cost.toFixed(4)}</td>
        <td title={fmtDate(s.last_seen)}>{fmtAgo(s.last_seen)}</td>
      </tr>
    {/each}
  </tbody>
</table>

<style>
  .sessions-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  th,
  td {
    padding: 8px 12px;
    text-align: left;
    border-bottom: 1px solid var(--row-border);
  }
  th {
    font-weight: 600;
    color: var(--muted);
  }
  tbody tr {
    cursor: pointer;
  }
  tbody tr:hover {
    background: var(--row-hover);
  }
  .mono {
    font-family: var(--font-mono);
    font-size: 12px;
  }
</style>
