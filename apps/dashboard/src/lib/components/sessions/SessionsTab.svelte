<script lang="ts">
  import { onMount, untrack } from 'svelte'
  import {
    sessionsState,
    loadSessions,
    loadSession,
    initSessionsSync,
  } from '$lib/stores/sessions.svelte'
  import { selectTrace } from '$lib/stores/traces.svelte'
  import { setTab, tabState } from '$lib/stores/tabs.svelte'
  import SessionList from './SessionList.svelte'
  import SessionDetail from './SessionDetail.svelte'

  let view = $state<'list' | 'detail'>('list')

  function refresh() {
    if (view === 'detail' && sessionsState.selectedId) void loadSession(sessionsState.selectedId)
    else void loadSessions()
  }

  onMount(() => initSessionsSync(refresh))

  $effect(() => {
    if (tabState.current === 'sessions') untrack(refresh)
  })

  function openSession(_id: string) {
    view = 'detail'
  }

  function openTrace(traceId: string) {
    setTab('traces')
    void selectTrace(traceId)
  }
</script>

<div class="sessions-tab">
  {#if view === 'list'}
    <SessionList onSelect={openSession} />
  {:else}
    <button
      class="back"
      onclick={() => {
        view = 'list'
        void loadSessions()
      }}>← back to sessions</button
    >
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
