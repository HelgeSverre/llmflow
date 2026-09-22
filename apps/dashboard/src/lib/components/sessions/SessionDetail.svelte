<script lang="ts">
  import CopyButton from '../shared/CopyButton.svelte'
  import { formatTime, formatTimestamp, formatExactCost, plural } from '$lib/utils/format'
  import { sessionsState, loadSession } from '$lib/stores/sessions.svelte'

  interface Props {
    onOpenTrace: (traceId: string) => void
  }

  let { onOpenTrace }: Props = $props()
</script>

{#if sessionsState.error}<p role="alert">
    {sessionsState.error}<button
      class="btn-secondary"
      onclick={() => sessionsState.selectedId && loadSession(sessionsState.selectedId)}
      >Retry</button
    >
  </p>{/if}
{#if sessionsState.selected}
  <div class="session-detail">
    <header>
      <h2>
        {sessionsState.selected.traces[0]?.name ||
          sessionsState.selected.traces[0]?.service_name ||
          'Session'}
      </h2>
      <p class="mono">Session {sessionsState.selected.session_id}</p>
      <CopyButton value={sessionsState.selected.session_id} label="session ID" />
      <div class="summary">
        {plural(sessionsState.selected.traces.length, 'trace')} ·
        {plural(sessionsState.selected.summary.spans, 'span')} ·
        {plural(sessionsState.selected.summary.tokens, 'token')} · {formatExactCost(
          sessionsState.selected.summary.cost,
        )}
        {#if sessionsState.selected.summary.errors > 0}
          · <span class="error"
            >{plural(sessionsState.selected.summary.errors, 'trace')} with errors</span
          >{/if}
      </div>
    </header>
    <ol class="trace-list">
      {#each sessionsState.selected.traces as t (t.trace_id)}
        <li>
          <button type="button" onclick={() => onOpenTrace(t.root_span_id)}>
            <span class="time" title={formatTimestamp(t.started_at)}
              >{formatTime(t.started_at)}</span
            >
            <span class="trace-id mono">{t.name || t.service_name || t.trace_id}</span>
            <span>{t.service_name || 'Service not supplied'}</span>
            <span class="spans">{plural(t.span_count, 'span')}</span>
            <span class="cost">{formatExactCost(t.cost)}</span>
            {#if t.has_error}
              <span class="err">error</span>{/if}
          </button>
          <div class="trace-actions">
            <CopyButton value={t.trace_id} label="trace ID" />{#if t.error_span_id}<button
                class="btn-secondary"
                onclick={() => onOpenTrace(t.error_span_id!)}>View failed span</button
              >{/if}
          </div>
        </li>
      {/each}
    </ol>
  </div>
{:else}
  <div class="empty">Loading…</div>
{/if}

<style>
  header h2,
  .trace-id {
    overflow-wrap: anywhere;
  }
  .trace-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 8px;
  }
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
  .trace-list > li > button {
    width: 100%;
    border: 0;
    background: transparent;
    color: inherit;
    text-align: left;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
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
