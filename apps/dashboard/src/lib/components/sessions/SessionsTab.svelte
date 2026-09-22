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

  function refresh() {
    if (sessionsState.view === 'detail' && sessionsState.selectedId)
      void loadSession(sessionsState.selectedId)
    else void loadSessions()
  }

  onMount(() => initSessionsSync(refresh))

  $effect(() => {
    if (tabState.current === 'sessions') untrack(refresh)
  })

  function openTrace(traceId: string) {
    setTab('traces')
    void selectTrace(traceId)
  }
</script>

<div class="sessions-tab">
  {#if sessionsState.view === 'list'}
    <div class="filter-bar">
      <input
        type="text"
        aria-label="Search sessions"
        placeholder="Search session, trace name, agent or service"
        value={sessionsState.q}
        oninput={(event) => {
          sessionsState.q = event.currentTarget.value
          void loadSessions(50, 0)
        }}
      /><button
        class="btn-secondary"
        onclick={() => {
          sessionsState.q = ''
          void loadSessions(50, 0)
        }}>Clear filters</button
      ><button class="btn-secondary" onclick={refresh}>Refresh</button><span
        >All time · updates live while open</span
      >
    </div>
    <SessionList />
  {:else}
    <button
      class="back"
      onclick={() => {
        sessionsState.view = 'list'
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
    color: var(--text-tertiary);
  }
</style>
