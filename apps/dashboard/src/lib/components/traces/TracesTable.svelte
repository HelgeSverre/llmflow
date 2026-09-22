<script lang="ts">
  import { traceFilters, clearFilters } from '$lib/stores/traces.svelte'
  import { traces, selectedTraceId, selectTrace, type Trace } from '$lib/stores/traces.svelte'
  import {
    formatTimestamp,
    formatTime,
    formatNumber,
    formatCost,
    formatLatency,
  } from '$lib/utils/format'
  import EmptyState from '$lib/components/shared/EmptyState.svelte'

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

  function handleRowClick(trace: Trace) {
    selectTrace(trace.id)
  }

  function handleKeyDown(e: KeyboardEvent, trace: Trace) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      selectTrace(trace.id)
    }
  }
</script>

{#if traces.length === 0}
  {#if Object.values(traceFilters).some(Boolean)}<EmptyState
      message="No results match these filters."
    /><button class="btn-secondary" onclick={clearFilters}>Clear filters</button>
  {:else}<EmptyState
      message="No traces found. Send requests through the proxy or ingest OTLP spans."
    />{/if}
{:else}
  <table data-testid="traces-table">
    <thead>
      <tr>
        <th>Time</th>
        <th>Type</th>
        <th>Name</th>
        <th>Model</th>
        <th>Tokens</th>
        <th>Cost</th>
        <th>Latency</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody id="tracesBody" data-testid="traces-body">
      {#each traces as trace (trace.id)}
        <tr
          class="trace-row"
          class:selected={trace.id === selectedTraceId.value}
          data-testid="trace-row"
          data-trace-id={trace.id}
          onclick={() => handleRowClick(trace)}
          onkeydown={(e) => handleKeyDown(e, trace)}
          tabindex="0"
          role="button"
        >
          <td data-testid="trace-time" title={formatTimestamp(trace.timestamp)}
            >{formatTime(trace.timestamp)}</td
          >
          <td data-testid="trace-type">
            <span class="span-badge span-{getSpanTypeClass(trace.span_type)}">
              {trace.span_type || 'LLM'}
            </span>
          </td>
          <td data-testid="trace-name">{trace.span_name || trace.service_name || '-'}</td>
          <td data-testid="trace-model">{trace.model || '-'}</td>
          <td data-testid="trace-tokens">{formatNumber(trace.total_tokens)}</td>
          <td data-testid="trace-cost">{formatCost(trace.estimated_cost)}</td>
          <td data-testid="trace-latency">{formatLatency(trace.duration_ms)}</td>
          <td data-testid="trace-status">
            {#if trace.error}
              <span class="status-error">Error</span>
            {:else if trace.status && trace.status >= 400}
              <span class="status-error">{trace.status}</span>
            {:else if trace.has_child_error}
              <span class="failure-badge">Child error</span>
            {:else}
              <span class="status-success">OK</span>
            {/if}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
{/if}
