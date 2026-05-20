<script lang="ts">
    import { sessionsState } from '$lib/stores/sessions.svelte'

    interface Props {
        onOpenTrace: (traceId: string) => void
    }

    let { onOpenTrace }: Props = $props()

    function fmt(ms: number) { return new Date(ms).toLocaleTimeString() }
</script>

{#if sessionsState.selected}
    <div class="session-detail">
        <header>
            <h2>Session <span class="mono">{sessionsState.selected.session_id}</span></h2>
            <div class="summary">
                {sessionsState.selected.traces.length} traces ·
                {sessionsState.selected.summary.spans} spans ·
                {sessionsState.selected.summary.tokens.toLocaleString()} tokens ·
                ${sessionsState.selected.summary.cost.toFixed(4)}
                {#if sessionsState.selected.summary.errors > 0}
                    · <span class="error">{sessionsState.selected.summary.errors} errors</span>
                {/if}
            </div>
        </header>
        <ol class="trace-list">
            {#each sessionsState.selected.traces as t (t.trace_id)}
                <li onclick={() => onOpenTrace(t.trace_id)}>
                    <span class="time">{fmt(t.started_at)}</span>
                    <span class="trace-id mono">{t.trace_id.slice(0, 8)}…</span>
                    <span class="spans">{t.span_count} spans</span>
                    <span class="cost">${t.cost.toFixed(4)}</span>
                    {#if t.has_error} <span class="err">error</span>{/if}
                </li>
            {/each}
        </ol>
    </div>
{:else}
    <div class="empty">Loading…</div>
{/if}

<style>
    .session-detail { padding: 16px; font-family: var(--font-sans); }
    header h2 { margin: 0 0 8px; font-size: 16px; }
    .summary { color: var(--muted); font-size: 13px; }
    .error { color: var(--err, #d55e00); }
    .trace-list { list-style: none; padding: 0; margin-top: 16px; }
    .trace-list li {
        display: grid; grid-template-columns: 80px 100px 1fr 80px auto;
        gap: 12px; padding: 8px; cursor: pointer; border-bottom: 1px solid var(--row-border);
    }
    .trace-list li:hover { background: var(--row-hover); }
    .mono { font-family: var(--font-mono); font-size: 12px; }
    .err { color: var(--err, #d55e00); }
    .empty { padding: 16px; color: var(--muted); }
</style>
