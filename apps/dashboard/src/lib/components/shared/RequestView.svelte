<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { LoadState } from '$lib/stores/load-state.svelte'
  let { state, retry, children }: { state: LoadState; retry: () => unknown; children: Snippet } =
    $props()
</script>

{#if state.error}
  <div class="request-notice" role="alert">
    <span>{state.loaded ? 'Showing previous results. ' : ''}{state.error}</span>
    <button class="btn-secondary" onclick={retry} disabled={state.loading}>Retry</button>
  </div>
{/if}
{#if state.loading}
  <p class="request-progress" role="status">{state.loaded ? 'Refreshing…' : 'Loading…'}</p>
{/if}
{#if state.loaded}
  {@render children()}
{/if}
