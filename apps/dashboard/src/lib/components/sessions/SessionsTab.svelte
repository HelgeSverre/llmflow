<script lang="ts">
  import { onMount } from 'svelte'
  import { sessionsState, loadSessions } from '$lib/stores/sessions.svelte'
  import { setTab } from '$lib/stores/tabs.svelte'
  import SessionList from './SessionList.svelte'
  import SessionDetail from './SessionDetail.svelte'

  let view = $state<'list' | 'detail'>('list')

  onMount(() => loadSessions())

  function openSession(_id: string) {
    view = 'detail'
  }

  function openTrace(traceId: string) {
    // Cross-tab navigation: jump to Traces tab.
    // (Selecting the specific trace is left to the existing TracesTab —
    //  setting the hash gives a hook for that integration later.)
    setTab('traces')
    window.location.hash = `#traces?trace=${encodeURIComponent(traceId)}`
  }
</script>

<div class="sessions-tab">
  {#if view === 'list'}
    <SessionList onSelect={openSession} />
  {:else}
    <button class="back" onclick={() => (view = 'list')}>← back to sessions</button>
    <SessionDetail onOpenTrace={openTrace} />
  {/if}
</div>

<style>
  .sessions-tab {
    height: 100%;
    overflow: auto;
  }
  .back {
    background: none;
    border: 0;
    padding: 8px 16px;
    cursor: pointer;
    font-size: 12px;
    color: var(--muted);
  }
</style>
