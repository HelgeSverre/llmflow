<script lang="ts">
  import type { Span } from '$lib/stores/traces.svelte'
  import { formatLatency } from '$lib/utils/format'
  import SpanTree from './SpanTree.svelte'

  interface Props {
    spans: Span[]
    depth?: number
  }

  let { spans, depth = 0 }: Props = $props()

  function getSpanTypeClass(type?: string): string {
    if (!type) return 'custom'
    const t = type.toLowerCase()
    if (t.includes('llm')) return 'llm'
    if (t.includes('agent')) return 'agent'
    if (t.includes('chain')) return 'chain'
    if (t.includes('tool')) return 'tool'
    if (t.includes('retrieval')) return 'retrieval'
    if (t.includes('embedding')) return 'embedding'
    return 'trace'
  }

  let expanded = $state<Record<string, boolean>>({})

  function toggleSpan(spanId: string) {
    expanded[spanId] = !expanded[spanId]
  }
</script>

{#each spans as span (span.id)}
  <div class="span-node" style="margin-left: {depth * 16}px">
    <div class="span-header">
      {#if span.children && span.children.length > 0}
        <button 
          class="span-toggle" 
          onclick={() => toggleSpan(span.id)}
          aria-label={expanded[span.id] ? 'Collapse' : 'Expand'}
        >
          {expanded[span.id] ? '▼' : '▶'}
        </button>
      {:else}
        <span class="span-toggle-placeholder"></span>
      {/if}
      <span class="span-badge span-{getSpanTypeClass(span.span_type)}">
        {span.span_type || 'span'}
      </span>
      <span class="span-name">{span.name}</span>
      {#if span.duration_ms}
        <span class="span-duration">{formatLatency(span.duration_ms)}</span>
      {/if}
    </div>
    {#if span.children && span.children.length > 0 && expanded[span.id]}
      <SpanTree spans={span.children} depth={depth + 1} />
    {/if}
  </div>
{/each}

<style>
  .span-node {
    padding: 4px 0;
  }

  .span-header {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .span-toggle {
    background: none;
    border: none;
    cursor: pointer;
    padding: 2px 4px;
    font-size: 10px;
    color: var(--text-tertiary);
    width: 20px;
  }

  .span-toggle:hover {
    color: var(--text-primary);
  }

  .span-toggle-placeholder {
    width: 20px;
  }

  .span-name {
    font-family: monospace;
    font-size: 12px;
    color: var(--text-primary);
  }

  .span-duration {
    font-size: 11px;
    color: var(--text-tertiary);
    margin-left: auto;
  }
</style>
