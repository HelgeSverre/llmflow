<script lang="ts">
  import { tabState, setTab, validTabs, type Tab } from '$lib/stores/tabs.svelte'
  
  const tabLabels: Record<Tab, string> = {
    timeline: 'Timeline',
    traces: 'Traces',
    logs: 'Logs',
    metrics: 'Metrics',
    models: 'Models',
    analytics: 'Analytics'
  }
</script>

<div class="tabs" data-testid="tabs">
  {#each validTabs as tab}
    <button 
      class="tab" 
      class:active={tabState.current === tab}
      data-testid="tab-{tab}" 
      onclick={() => setTab(tab)}
    >
      {tabLabels[tab]}
    </button>
  {/each}
</div>
