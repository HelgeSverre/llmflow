<script lang="ts">
  import { stats } from '$lib/stores/stats.svelte'
  import { connectionStatus } from '$lib/stores/websocket.svelte'
  import { toggleTheme } from '$lib/stores/theme.svelte'
  import { formatNumber, formatCost, formatLatency } from '$lib/utils/format'
</script>

<header data-testid="header">
  <div class="header-row">
    <div class="header-left">
      <h1 class="logo" data-testid="logo">
        <svg class="logo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/>
          <path d="M2 17l10 5 10-5"/>
          <path d="M2 12l10 5 10-5"/>
        </svg>
        LLMFlow
        <span 
          id="connectionStatus" 
          class="status-dot"
          class:connected={connectionStatus.value === 'connected'}
          class:disconnected={connectionStatus.value === 'disconnected'}
          data-testid="connection-status" 
          title={connectionStatus.value === 'connected' ? 'Connected' : connectionStatus.value === 'disconnected' ? 'Disconnected - retrying...' : 'Connecting...'}
        ></span>
      </h1>
      <button class="theme-toggle" data-testid="theme-toggle" onclick={toggleTheme} title="Toggle dark mode">
        <svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
        <svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="5"/>
          <line x1="12" y1="1" x2="12" y2="3"/>
          <line x1="12" y1="21" x2="12" y2="23"/>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
          <line x1="1" y1="12" x2="3" y2="12"/>
          <line x1="21" y1="12" x2="23" y2="12"/>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
      </button>
    </div>
    <div class="stats-bar" data-testid="stats-bar">
      <div class="stat" data-testid="stat-traces">
        <span class="stat-value" data-testid="total-requests">{stats.total_requests > 0 ? formatNumber(stats.total_requests) : '-'}</span>
        <span class="stat-label">Traces</span>
      </div>
      <div class="stat" data-testid="stat-tokens">
        <span class="stat-value" data-testid="total-tokens">{stats.total_tokens > 0 ? formatNumber(stats.total_tokens) : '-'}</span>
        <span class="stat-label">Tokens</span>
      </div>
      <div class="stat" data-testid="stat-cost">
        <span class="stat-value" data-testid="total-cost">{stats.total_cost > 0 ? formatCost(stats.total_cost) : '-'}</span>
        <span class="stat-label">Cost</span>
      </div>
      <div class="stat" data-testid="stat-latency">
        <span class="stat-value" data-testid="avg-latency">{stats.avg_duration > 0 ? formatLatency(stats.avg_duration) : '-'}</span>
        <span class="stat-label">Avg Latency</span>
      </div>
    </div>
  </div>
</header>
