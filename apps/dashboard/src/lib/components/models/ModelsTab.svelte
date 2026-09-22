<script lang="ts">
  import RequestView from '$lib/components/shared/RequestView.svelte'
  import { modelsState } from '$lib/stores/models.svelte'
  import { setTab } from '$lib/stores/tabs.svelte'
  import { traceFilters, clearSelection } from '$lib/stores/traces.svelte'
  import { modelStats, loadModels, modelFilters, modelScope } from '$lib/stores/models.svelte'
  import { formatNumber, formatCost, formatLatency } from '$lib/utils/format'
  import { tabState } from '$lib/stores/tabs.svelte'
  import EmptyState from '$lib/components/shared/EmptyState.svelte'

  $effect(() => {
    if (tabState.current === 'models') {
      loadModels()
    }
  })
  const sortedModels = $derived(
    [...modelStats].sort((a, b) =>
      modelFilters.sort === 'cost'
        ? b.total_cost - a.total_cost
        : b.request_count - a.request_count,
    ),
  )
  function viewTraces(model: string) {
    Object.assign(traceFilters, {
      q: '',
      service_name: '',
      status: '',
      model,
      dateRange: 'custom',
      dateFrom: modelScope.from,
      dateTo: modelScope.to,
    })
    clearSelection()
    setTab('traces')
  }
</script>

<div class="filter-bar">
  <select aria-label="Model time range" bind:value={modelFilters.days}
    ><option value={0}>All Time</option><option value={7}>Last 7 days</option><option value={30}
      >Last 30 days</option
    ><option value={90}>Last 90 days</option></select
  ><select aria-label="Sort models" bind:value={modelFilters.sort}
    ><option value="requests">Most requests</option><option value="cost">Highest cost</option
    ></select
  >
</div>
<div class="view-status">
  <span
    >{modelFilters.days ? `Last ${modelFilters.days} days` : 'All time'} · {modelStats.length} models
    · Refresh to update</span
  ><button class="btn-secondary" onclick={loadModels}>Refresh</button>
</div>
<RequestView state={modelsState} retry={loadModels}>
  <div class="model-grid" data-testid="model-stats">
    {#if modelStats.length === 0}
      <EmptyState
        message="No model data yet. Send requests through the proxy to see model statistics."
      />
    {:else}
      {#each sortedModels as model (model.model)}
        <div class="model-card">
          <div class="model-card-header">
            <h3 class="model-card-name">{model.model}</h3>
          </div>
          <div class="model-card-stats">
            <div class="model-stat">
              <span class="model-stat-value">{formatNumber(model.request_count)}</span>
              <span class="model-stat-label">Requests</span>
            </div>
            <div class="model-stat">
              <span class="model-stat-value">{formatNumber(model.total_tokens)}</span>
              <span class="model-stat-label">Tokens</span>
            </div>
            <div class="model-stat">
              <span class="model-stat-value">{formatCost(model.total_cost)}</span>
              <span class="model-stat-label">Cost</span>
            </div>
            <div class="model-stat">
              <span class="model-stat-value">{formatLatency(model.avg_latency)}</span>
              <span class="model-stat-label">Avg Latency</span>
            </div>
          </div>
          <button class="btn-secondary" onclick={() => viewTraces(model.model)}>View traces</button>
          <div class="model-card-tokens">
            <div class="token-bar">
              <div
                class="token-bar-prompt"
                style="width: {model.total_tokens > 0
                  ? (model.prompt_tokens / model.total_tokens) * 100
                  : 0}%"
              ></div>
            </div>
            <div class="token-legend">
              <span>Prompt: {formatNumber(model.prompt_tokens)}</span>
              <span>Completion: {formatNumber(model.completion_tokens)}</span>
            </div>
          </div>
        </div>
      {/each}
    {/if}
  </div>
</RequestView>

<style>
  .model-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 12px;
    padding: 8px;
  }

  .model-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border-primary);
    border-radius: 4px;
    padding: 16px;
  }

  .model-card-header {
    margin-bottom: 12px;
  }

  .model-card-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
    word-break: break-all;
  }

  .model-card-stats {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    margin-bottom: 12px;
  }

  .model-stat {
    display: flex;
    flex-direction: column;
  }

  .model-stat-value {
    font-size: 16px;
    font-weight: 600;
    color: var(--accent-primary);
  }

  .model-stat-label {
    font-size: 10px;
    color: var(--text-tertiary);
    text-transform: uppercase;
  }

  .model-card-tokens {
    padding-top: 12px;
    border-top: 1px solid var(--border-light);
  }

  .token-bar {
    height: 6px;
    background: var(--bg-tertiary);
    border-radius: 3px;
    overflow: hidden;
    margin-bottom: 6px;
  }

  .token-bar-prompt {
    height: 100%;
    background: var(--accent-primary);
    border-radius: 3px;
  }

  .token-legend {
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    color: var(--text-tertiary);
  }
</style>
