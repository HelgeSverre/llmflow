<script lang="ts">
  import { formatLatency } from '$lib/utils/format'

  interface Props {
    span: Record<string, unknown> | null
  }

  let { span }: Props = $props()

  let activeTab = $state<'attributes' | 'input' | 'output' | 'request' | 'response'>('attributes')

  function asJson(value: unknown): string {
    if (value == null) return ''
    if (typeof value === 'string') {
      try {
        return JSON.stringify(JSON.parse(value), null, 2)
      } catch {
        return value
      }
    }
    return JSON.stringify(value, null, 2)
  }
</script>

{#if span}
  <div class="detail-panel">
    <header>
      <div class="name">{span.span_name ?? span.name}</div>
      <div class="meta">
        <span>{span.span_type ?? '—'}</span>
        <span>·</span>
        <span>{formatLatency(span.duration_ms as number)}</span>
        {#if span.estimated_cost}
          <span>·</span>
          <span>${(span.estimated_cost as number).toFixed(4)}</span>
        {/if}
        {#if span.total_tokens}
          <span>·</span>
          <span>{span.total_tokens} tok</span>
        {/if}
      </div>
    </header>
    <nav class="tabs">
      {#each ['attributes', 'input', 'output', 'request', 'response'] as tab}
        <button
          class:active={activeTab === tab}
          onclick={() => (activeTab = tab as typeof activeTab)}
        >
          {tab}
        </button>
      {/each}
    </nav>
    <pre class="body">{asJson(span[activeTab])}</pre>
  </div>
{:else}
  <div class="detail-panel empty">Select a span to see its details.</div>
{/if}

<style>
  .detail-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    border-left: 1px solid var(--row-border);
    font-family: var(--font-sans);
  }
  .detail-panel.empty {
    align-items: center;
    justify-content: center;
    color: var(--muted);
    font-size: 13px;
  }
  header {
    padding: 12px 16px;
    border-bottom: 1px solid var(--row-border);
  }
  .name {
    font-family: var(--font-mono);
    font-size: 14px;
    font-weight: 600;
  }
  .meta {
    font-size: 12px;
    color: var(--muted);
    margin-top: 4px;
    display: flex;
    gap: 6px;
  }
  .tabs {
    display: flex;
    border-bottom: 1px solid var(--row-border);
  }
  .tabs button {
    background: none;
    border: 0;
    padding: 8px 12px;
    cursor: pointer;
    font-size: 12px;
    color: var(--muted);
    border-bottom: 2px solid transparent;
  }
  .tabs button.active {
    color: var(--text);
    border-bottom-color: var(--accent, #0072b2);
  }
  .body {
    flex: 1;
    overflow: auto;
    padding: 12px 16px;
    font-family: var(--font-mono);
    font-size: 12px;
    white-space: pre-wrap;
  }
</style>
