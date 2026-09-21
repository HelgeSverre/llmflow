<script lang="ts">
  import Messages from './Messages.svelte'
  import { formatLatency } from '$lib/utils/format'

  interface Props {
    span: Record<string, unknown> | null
  }

  let { span }: Props = $props()

  type TabKey = 'attributes' | 'input' | 'output' | 'request' | 'response'
  let activeTab = $state<TabKey>('attributes')
  const activeBody = $derived(span ? tabContent(span, activeTab) : null)

  // gen_ai-style spans carry `input`/`output`; HTTP-proxy spans carry `request_body`/`response_body`
  // with separate `*_headers`/`*_status`. Resolve both shapes per tab so the panel works for either.
  function tabContent(s: Record<string, unknown>, tab: TabKey): unknown {
    switch (tab) {
      case 'attributes':
        return s.attributes
      case 'input':
        return s.input
      case 'output':
        return s.output
      case 'request':
        return {
          method: s.request_method,
          path: s.request_path,
          headers: s.request_headers,
          body: s.request_body,
        }
      case 'response':
        return {
          status: s.response_status,
          headers: s.response_headers,
          body: s.response_body,
        }
    }
  }

  function isEmpty(value: unknown): boolean {
    if (value == null) return true
    if (typeof value === 'string') return value.length === 0
    if (Array.isArray(value)) return value.length === 0 || value.every(isEmpty)
    if (typeof value === 'object') {
      const entries = Object.values(value as Record<string, unknown>)
      return entries.length === 0 || entries.every(isEmpty)
    }
    return false
  }

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
      <div class="name">{span.name}</div>
      <div class="meta">
        <span>{span.span_type ?? '—'}</span>
        <span>·</span>
        <span>{formatLatency(span.duration_ms as number | null)}</span>
        {#if span.estimated_cost != null}
          <span>·</span>
          <span>${(span.estimated_cost as number).toFixed(4)}</span>
        {/if}
        {#if span.total_tokens != null}
          <span>·</span>
          <span>{span.total_tokens} tok</span>
        {/if}
      </div>
    </header>
    <nav class="tabs">
      {#each ['attributes', 'input', 'output', 'request', 'response'] as tab}
        {@const content = tabContent(span, tab as TabKey)}
        <button
          class:active={activeTab === tab}
          class:muted={isEmpty(content)}
          onclick={() => (activeTab = tab as TabKey)}
        >
          {tab}
        </button>
      {/each}
    </nav>
    {#if isEmpty(activeBody)}
      <div class="body empty-body">No {activeTab} captured for this span.</div>
    {:else if activeTab === 'input' || activeTab === 'output'}
      <div class="body"><Messages value={activeBody} /></div>
    {:else}
      <pre class="body">{asJson(activeBody)}</pre>
    {/if}
  </div>
{:else}
  <div class="detail-panel empty">Select a span to see its details.</div>
{/if}

<style>
  .detail-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    min-width: 0;
    border-left: 1px solid var(--border-primary);
    font-family: inherit;
  }
  .detail-panel.empty {
    align-items: center;
    justify-content: center;
    color: var(--text-tertiary);
    font-size: 13px;
  }
  header {
    flex-shrink: 0;
    overflow-wrap: anywhere;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-primary);
  }
  .name {
    font-family: ui-monospace, monospace;
    font-size: 14px;
    font-weight: 600;
  }
  .meta {
    font-size: 12px;
    color: var(--text-tertiary);
    margin-top: 4px;
    display: flex;
    gap: 6px;
  }
  .tabs {
    flex-shrink: 0;
    overflow-x: auto;
    display: flex;
    border-bottom: 1px solid var(--border-primary);
  }
  .tabs button {
    background: none;
    border: 0;
    padding: 8px 12px;
    cursor: pointer;
    font-size: 12px;
    color: var(--text-tertiary);
    border-bottom: 2px solid transparent;
  }
  .tabs button.active {
    color: var(--text-primary);
    border-bottom-color: var(--accent-primary);
  }
  .tabs button.muted {
    opacity: 0.4;
  }
  .body {
    min-height: 0;
    overflow-wrap: anywhere;
    flex: 1;
    overflow: auto;
    padding: 12px 16px;
    font-family: ui-monospace, monospace;
    font-size: 12px;
    white-space: pre-wrap;
  }
  .empty-body {
    color: var(--text-tertiary);
    font-style: italic;
  }
</style>
