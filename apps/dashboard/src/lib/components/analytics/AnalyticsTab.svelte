<script lang="ts">
  import { onMount } from 'svelte'
  import { analytics, analyticsDays, loadAnalytics } from '$lib/stores/analytics.svelte'
  import { tabState } from '$lib/stores/tabs.svelte'
  import { formatNumber, formatCost } from '$lib/utils/format'
  import EmptyState from '$lib/components/shared/EmptyState.svelte'

  function handleDaysChange(e: Event) {
    analyticsDays.value = parseInt((e.target as HTMLSelectElement).value, 10)
    loadAnalytics()
  }

  function handleRefresh() {
    loadAnalytics()
  }

  onMount(() => {
    if (tabState.current === 'analytics') {
      loadAnalytics()
    }
  })

  $effect(() => {
    if (tabState.current === 'analytics') {
      loadAnalytics()
    }
  })

  // Compute max values for chart scaling
  let maxDailyTokens = $derived(Math.max(...analytics.daily.map(d => d.total_tokens), 1))
  let maxToolCost = $derived(Math.max(...analytics.by_tool.map(t => t.total_cost), 0.01))
  let maxModelCost = $derived(Math.max(...analytics.by_model.map(m => m.total_cost), 0.01))
  let totalToolCost = $derived(analytics.by_tool.reduce((sum, t) => sum + t.total_cost, 0))
  let totalModelCost = $derived(analytics.by_model.reduce((sum, m) => sum + m.total_cost, 0))
</script>

<div class="analytics-controls" data-testid="analytics-controls">
  <select 
    id="analyticsDaysFilter" 
    data-testid="analytics-days-filter"
    value={String(analyticsDays.value)}
    onchange={handleDaysChange}
  >
    <option value="7">Last 7 days</option>
    <option value="14">Last 14 days</option>
    <option value="30">Last 30 days</option>
    <option value="90">Last 90 days</option>
  </select>
  <button 
    id="refreshAnalytics" 
    class="btn-secondary" 
    data-testid="analytics-refresh"
    onclick={handleRefresh}
  >
    Refresh
  </button>
</div>

<div class="analytics-grid" data-testid="analytics-grid">
  <!-- Token Trends Chart -->
  <div class="analytics-card analytics-card-wide" data-testid="token-trends-card">
    <div class="analytics-card-header">
      <h3>Token Usage Trends</h3>
      <span class="analytics-subtitle">Daily token consumption</span>
    </div>
    <div class="analytics-card-body">
      <div class="chart-container" data-testid="token-trends-chart">
        {#if analytics.daily.length === 0}
          <EmptyState message="No data for this period" />
        {:else}
          <div class="bar-chart">
            <div class="bar-chart-bars">
              {#each analytics.daily as day}
                <div class="bar-group" style="flex: 1" title="{day.date}: {formatNumber(day.total_tokens)} tokens">
                  <div 
                    class="bar bar-total" 
                    style="height: {(day.total_tokens / maxDailyTokens) * 100}%"
                  ></div>
                  <div 
                    class="bar bar-prompt" 
                    style="height: {(day.prompt_tokens / maxDailyTokens) * 100}%"
                  ></div>
                </div>
              {/each}
            </div>
            <div class="bar-chart-legend">
              <div class="legend-item">
                <span class="legend-dot legend-total"></span>
                <span>Total</span>
              </div>
              <div class="legend-item">
                <span class="legend-dot legend-prompt"></span>
                <span>Prompt</span>
              </div>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>

  <!-- Cost by Tool -->
  <div class="analytics-card" data-testid="cost-by-tool-card">
    <div class="analytics-card-header">
      <h3>Cost by Tool</h3>
      <span class="analytics-subtitle">Total spend per AI tool</span>
    </div>
    <div class="analytics-card-body">
      <div class="chart-container" data-testid="cost-by-tool-chart">
        {#if analytics.by_tool.length === 0}
          <EmptyState message="No tool data" />
        {:else}
          <div class="horizontal-bar-chart">
            {#each analytics.by_tool.slice(0, 5) as tool}
              <div class="h-bar-row">
                <span class="h-bar-label" title={tool.tool}>{tool.tool}</span>
                <div class="h-bar-track">
                  <div 
                    class="h-bar-fill tool-{tool.tool.toLowerCase().replace(/[^a-z]/g, '-')}" 
                    style="width: {(tool.total_cost / maxToolCost) * 100}%"
                  ></div>
                </div>
                <span class="h-bar-value">{formatCost(tool.total_cost)}</span>
              </div>
            {/each}
          </div>
          <div class="chart-total">Total: {formatCost(totalToolCost)}</div>
        {/if}
      </div>
    </div>
  </div>

  <!-- Cost by Model -->
  <div class="analytics-card" data-testid="cost-by-model-card">
    <div class="analytics-card-header">
      <h3>Cost by Model</h3>
      <span class="analytics-subtitle">Total spend per model</span>
    </div>
    <div class="analytics-card-body">
      <div class="chart-container" data-testid="cost-by-model-chart">
        {#if analytics.by_model.length === 0}
          <EmptyState message="No model data" />
        {:else}
          <div class="horizontal-bar-chart">
            {#each analytics.by_model.slice(0, 5) as model}
              <div class="h-bar-row">
                <span class="h-bar-label" title={model.model}>{model.model}</span>
                <div class="h-bar-track">
                  <div 
                    class="h-bar-fill" 
                    style="width: {(model.total_cost / maxModelCost) * 100}%"
                  ></div>
                </div>
                <span class="h-bar-value">{formatCost(model.total_cost)}</span>
              </div>
            {/each}
          </div>
          <div class="chart-total">Total: {formatCost(totalModelCost)}</div>
        {/if}
      </div>
    </div>
  </div>

  <!-- Daily Summary Table -->
  <div class="analytics-card analytics-card-wide" data-testid="daily-summary-card">
    <div class="analytics-card-header">
      <h3>Daily Summary</h3>
      <span class="analytics-subtitle">Requests, tokens, and costs per day</span>
    </div>
    <div class="analytics-card-body">
      <div class="daily-summary-table" data-testid="daily-summary-table">
        {#if analytics.daily.length === 0}
          <EmptyState message="No data for this period" />
        {:else}
          <table class="summary-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Requests</th>
                <th>Tokens</th>
                <th>Cost</th>
              </tr>
            </thead>
            <tbody>
              {#each analytics.daily as day}
                <tr>
                  <td>{day.date}</td>
                  <td>{formatNumber(day.request_count)}</td>
                  <td>{formatNumber(day.total_tokens)}</td>
                  <td>{formatCost(day.total_cost)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </div>
    </div>
  </div>
</div>
