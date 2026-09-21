<script lang="ts">
  import { sessionsState } from '$lib/stores/sessions.svelte'

  interface Props {
    onOpenTrace: (traceId: string) => void
  }

  let { onOpenTrace }: Props = $props()

  function fmt(ms: number) {
    return new Date(ms).toLocaleTimeString()
  }
</script>

{#if sessionsState.selected}
  <div class="session-detail">
    <header>
      <h2>Session <span class="mono">{sessionsState.selected.session_id}</span></h2>
      <div class="summary">
        {sessionsState.selected.traces.length} traces ·
        {sessionsState.selected.summary.spans} spans ·
        {sessionsState.selected.summary.tokens.toLocaleString()} tokens · ${sessionsState.selected.summary.cost.toFixed(
          4,
        )}
        {#if sessionsState.selected.summary.errors > 0}
          · <span class="error">{sessionsState.selected.summary.errors} errors</span>
        {/if}
      </div>
    </header>
    <ol class="trace-list">
      {#each sessionsState.selected.traces as t (t.trace_id)}
        <li>
          <button type="button" onclick={() => onOpenTrace(t.root_span_id)}>
            <span class="time">{fmt(t.started_at)}</span>
            <span class="trace-id mono">{t.trace_id.slice(0, 8)}…</span>
            <span class="spans">{t.span_count} spans</span>
            <span class="cost">${t.cost.toFixed(4)}</span>
            {#if t.has_error}
              <span class="err">error</span>{/if}
          </button>
        </li>
      {/each}
    </ol>
  </div>
{:else}
  <div class="empty">Loading…</div>
{/if}

<style>
  .session-detail {
    padding: 16px;
    font-family: inherit;
  }
  header h2 {
    margin: 0 0 8px;
    font-size: 16px;
  }
  .summary {
    color: var(--text-tertiary);
    font-size: 13px;
  }
  .error {
    color: var(--error);
  }
  .trace-list {
    list-style: none;
    padding: 0;
    margin-top: 16px;
  }
  .trace-list button {
    width: 100%;
    border: 0;
    background: transparent;
    color: inherit;
    text-align: left;
    display: grid;
    grid-template-columns: 80px 100px 1fr 80px auto;
    gap: 12px;
    padding: 8px;
    cursor: pointer;
    border-bottom: 1px solid var(--border-primary);
  }
  .trace-list button:hover {
    background: var(--bg-hover);
  }
  .mono {
    font-family: ui-monospace, monospace;
    font-size: 12px;
  }
  .err {
    color: var(--error);
  }
  .empty {
    padding: 16px;
    color: var(--text-tertiary);
  }
</style>
