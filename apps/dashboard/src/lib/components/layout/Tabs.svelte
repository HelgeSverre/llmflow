<script lang="ts">
  import { tabState, setTab, validTabs, type Tab } from '$lib/stores/tabs.svelte'

  const tabLabels: Record<Tab, string> = {
    timeline: 'Timeline',
    traces: 'Traces',
    sessions: 'Sessions',
    logs: 'Logs',
    metrics: 'Metrics',
    models: 'Models',
    analytics: 'Analytics',
  }
</script>

<nav aria-label="Dashboard views" class="tabs" data-testid="tabs">
  {#each validTabs as tab}
    <button
      aria-current={tabState.current === tab ? 'page' : undefined}
      class="tab"
      class:active={tabState.current === tab}
      data-testid="tab-{tab}"
      onclick={() => setTab(tab)}
    >
      {tabLabels[tab]}
    </button>
  {/each}
</nav>
