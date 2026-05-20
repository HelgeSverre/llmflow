<script lang="ts">
  import { timelineItems, selectedItem, selectTimelineItem, type TimelineItem } from '$lib/stores/timeline.svelte'
  import { formatTime, formatLatency, formatCost } from '$lib/utils/format'
  import EmptyState from '$lib/components/shared/EmptyState.svelte'

  function getTypeClass(type: string): string {
    switch (type) {
      case 'trace': return 'llm'
      case 'log': return 'chain'
      case 'metric': return 'tool'
      default: return 'custom'
    }
  }

  function handleItemClick(item: TimelineItem) {
    selectTimelineItem(item)
  }

  function handleKeyDown(e: KeyboardEvent, item: TimelineItem) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      selectTimelineItem(item)
    }
  }
</script>

<div class="timeline-list" data-testid="timeline-list">
  {#if timelineItems.length === 0}
    <EmptyState message="No timeline items. Send requests through the proxy or OTLP endpoints." />
  {:else}
    {#each timelineItems as item (item.id + item.type)}
      <div 
        class="timeline-item"
        class:selected={selectedItem.value?.id === item.id && selectedItem.value?.type === item.type}
        onclick={() => handleItemClick(item)}
        onkeydown={(e) => handleKeyDown(e, item)}
        tabindex="0"
        role="button"
      >
        <div class="timeline-item-header">
          <span class="span-badge span-{getTypeClass(item.type)}">{item.type}</span>
          <span class="timeline-item-time">{formatTime(item.timestamp)}</span>
        </div>
        <div class="timeline-item-title">{item.title}</div>
        {#if item.subtitle}
          <div class="timeline-item-subtitle">{item.subtitle}</div>
        {/if}
        <div class="timeline-item-meta">
          {#if item.model}
            <span class="timeline-meta-item">{item.model}</span>
          {/if}
          {#if item.duration_ms}
            <span class="timeline-meta-item">{formatLatency(item.duration_ms)}</span>
          {/if}
          {#if item.cost}
            <span class="timeline-meta-item">{formatCost(item.cost)}</span>
          {/if}
          {#if item.severity_text}
            <span class="severity-badge severity-{item.severity_text.toLowerCase()}">{item.severity_text}</span>
          {/if}
          {#if item.service_name}
            <span class="service-badge">{item.service_name}</span>
          {/if}
        </div>
      </div>
    {/each}
  {/if}
</div>

<style>
  .timeline-item {
    padding: 12px;
    border-bottom: 1px solid var(--border-light);
    cursor: pointer;
    transition: background 0.1s;
  }

  .timeline-item:hover {
    background: var(--bg-hover);
  }

  .timeline-item.selected {
    background: var(--bg-selected);
  }

  .timeline-item-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
  }

  .timeline-item-time {
    font-size: 11px;
    color: var(--text-tertiary);
  }

  .timeline-item-title {
    font-weight: 500;
    font-size: 13px;
    color: var(--text-primary);
    margin-bottom: 2px;
  }

  .timeline-item-subtitle {
    font-size: 12px;
    color: var(--text-secondary);
    margin-bottom: 4px;
  }

  .timeline-item-meta {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
  }

  .timeline-meta-item {
    font-size: 11px;
    color: var(--text-tertiary);
  }
</style>
