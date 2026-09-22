<script lang="ts">
  import RequestView from '$lib/components/shared/RequestView.svelte'
  import { analyticsState } from '$lib/stores/analytics.svelte'
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

  $effect(() => {
    if (tabState.current === 'analytics') {
      loadAnalytics()
    }
  })

  // Compute max values for chart scaling
  let maxDailyTokens = $derived(Math.max(...analytics.daily.map((d) => d.tokens), 1))
  let maxToolCost = $derived(Math.max(...analytics.by_tool.map((t) => t.total_cost), 0.01))
  let maxModelCost = $derived(Math.max(...analytics.by_model.map((m) => m.total_cost), 0.01))
  let totalToolCost = $derived(analytics.by_tool.reduce((sum, t) => sum + t.total_cost, 0))
  let totalModelCost = $derived(analytics.by_model.reduce((sum, m) => sum + m.total_cost, 0))
</script>

<div class="analytics-controls" data-testid="analytics-controls">
  <select
    id="analyticsDaysFilter"
    aria-label="Time range"
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

<RequestView state={analyticsState} retry={loadAnalytics}>
  <div class="analytics-grid" data-testid="analytics-grid">
    <!-- Token Trends Chart -->
    <div class="analytics-card analytics-card-wide" data-testid="token-trends-card">
      <div class="analytics-card-header">
        <h3>Token Usage Trends</h3>
        <span class="analytics-subtitle">Daily tokens · prompt is part of total</span>
      </div>
      <div class="analytics-card-body">
        <div class="chart-container" data-testid="token-trends-chart">
          {#if analytics.daily.length === 0}
            <EmptyState message="No data for this period" />
          {:else}
            <div class="bar-chart">
              <div class="chart-scale">
                <span>{formatNumber(maxDailyTokens)}</span><span
                  >{formatNumber(maxDailyTokens / 2)}</span
                ><span>0</span>
              </div>
              <div class="bar-chart-bars">
                {#each analytics.daily as day}
                  <div
                    class="bar-group"
                    role="img"
                    aria-label={`${day.date}: ${day.tokens.toLocaleString()} total tokens, ${day.prompt_tokens.toLocaleString()} prompt, ${day.completion_tokens.toLocaleString()} completion`}
                    style="flex: 1"
                    title="{day.date}: {formatNumber(day.tokens)} tokens"
                  >
                    <div
                      class="bar bar-total"
                      style="height: {(day.tokens / maxDailyTokens) * 100}%"
                    ></div>
                    <div
                      class="bar bar-prompt"
                      style="height: {(day.prompt_tokens / maxDailyTokens) * 100}%"
                    ></div>
                  </div>
                {/each}
              </div>
              <div class="chart-dates">
                <span>{analytics.daily[0]?.date}</span><span>{analytics.daily.at(-1)?.date}</span>
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
        <h3>Cost by Service / Provider</h3>
        <span class="analytics-subtitle">Total spend grouped by service and provider</span>
      </div>
      <div class="analytics-card-body">
        <div class="chart-container" data-testid="cost-by-tool-chart">
          {#if analytics.by_tool.length === 0}
            <EmptyState message="No tool data" />
          {:else}
            <div class="horizontal-bar-chart">
              {#each analytics.by_tool.slice(0, 5) as tool}
                <div class="h-bar-row">
                  <span class="h-bar-label" title={`${tool.service_name} (${tool.provider})`}
                    >{tool.service_name} · {tool.provider}</span
                  >
                  <div class="h-bar-track">
                    <div
                      class="h-bar-fill tool-{tool.service_name
                        .toLowerCase()
                        .replace(/[^a-z]/g, '-')}"
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
                  <th>Total tokens</th><th>Prompt</th><th>Completion</th>
                  <th>Cost</th>
                </tr>
              </thead>
              <tbody>
                {#each [...analytics.daily].reverse() as day}
                  <tr>
                    <td>{day.date}</td>
                    <td>{formatNumber(day.requests)}</td>
                    <td>{day.tokens.toLocaleString()}</td><td
                      >{day.prompt_tokens.toLocaleString()}</td
                    ><td>{day.completion_tokens.toLocaleString()}</td>
                    <td>{formatCost(day.cost)}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          {/if}
        </div>
      </div>
    </div>
  </div>
</RequestView>

<style>
  .chart-dates {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: var(--text-secondary);
  }
  :global(.bar-chart) {
    position: relative;
    padding-left: 42px;
  }
  .chart-scale {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 48px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    font-size: 11px;
    color: var(--text-secondary);
  }
  :global(.bar-chart-bars) {
    min-height: 0;
  }
  :global(.bar-group) {
    min-height: 0;
  }
  :global(.h-bar-label) {
    white-space: normal;
    overflow-wrap: anywhere;
    text-overflow: clip;
    flex: 0 1 45%;
    min-width: 0;
  }
  :global(.h-bar-value) {
    flex-shrink: 0;
  }
  :global(.bar-group) {
    min-width: 0;
  }
</style>
