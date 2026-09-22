<script lang="ts">
  import { tick, untrack, type Snippet } from 'svelte'
  let {
    selected,
    close,
    list,
    detail,
  }: { selected: boolean; close: () => void; list: Snippet; detail: Snippet } = $props()
  let panel: HTMLDivElement
  let previousSelection = false
  let listScroll = 0
  $effect.pre(() => {
    const next = selected
    untrack(() => {
      if (next && !previousSelection) listScroll = panel?.scrollTop ?? 0
      if (!next && previousSelection)
        void tick().then(() => {
          if (panel) panel.scrollTop = listScroll
        })
      previousSelection = next
    })
  })
</script>

{#if !selected}<p class="selection-hint">Select a record to inspect its details.</p>{/if}
<div class="split-layout investigation" class:has-selection={selected}>
  <div class="panel-left" bind:this={panel}>{@render list()}</div>
  {#if selected}
    <div class="inspector">
      <button class="btn-secondary back-to-list" onclick={close}>← Back to list</button>
      {@render detail()}
    </div>
  {/if}
</div>

<style>
  .selection-hint {
    margin: 0;
    padding: 0 12px 8px;
    font-size: 12px;
    color: var(--text-tertiary);
  }
</style>
