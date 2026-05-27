<script lang="ts">
  import { onMount } from 'svelte'
  import { api } from '$lib/api/client'

  type PricingStatus = {
    source: 'litellm' | 'fallback' | 'unknown'
    last_updated: number | null
    model_count: number
    upstream_url: string
  }

  type HealthResponse = {
    status: string
    timestamp: number
    pricing?: PricingStatus
  }

  const STALE_MS = 7 * 24 * 60 * 60 * 1000

  let pricing = $state<PricingStatus | null>(null)
  let dismissed = $state(false)

  onMount(async () => {
    try {
      const res = await api.get<HealthResponse>('/api/health')
      pricing = res.pricing ?? null
    } catch {
      // Health check failures aren't worth surfacing here.
    }
  })

  let staleDays = $derived(
    pricing?.last_updated ? Math.floor((Date.now() - pricing.last_updated) / (24 * 60 * 60 * 1000)) : 0,
  )

  let show = $derived(
    !dismissed &&
      pricing?.source === 'fallback' &&
      pricing.last_updated !== null &&
      Date.now() - pricing.last_updated > STALE_MS,
  )
</script>

{#if show}
  <div class="pricing-banner" role="status" data-testid="pricing-banner">
    <span>
      <strong>Cost estimates may be stale.</strong>
      LLMFlow couldn't reach the LiteLLM pricing source, so it's using a bundled fallback
      that's {staleDays} days old. Costs and tokens are still recorded; per-model rates
      may not reflect current provider pricing. Restart with network access to refresh.
    </span>
    <button
      type="button"
      class="dismiss"
      aria-label="Dismiss"
      onclick={() => (dismissed = true)}
    >
      ×
    </button>
  </div>
{/if}

<style>
  .pricing-banner {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.5rem 0.75rem;
    background: var(--color-warning-bg, #fff8e1);
    color: var(--color-warning-fg, #5d4200);
    border-bottom: 1px solid var(--color-warning-border, #f0c674);
    font-size: 0.85rem;
    line-height: 1.4;
  }

  .pricing-banner strong {
    font-weight: 600;
  }

  .dismiss {
    margin-left: auto;
    background: none;
    border: none;
    color: inherit;
    font-size: 1.1rem;
    cursor: pointer;
    line-height: 1;
    padding: 0 0.25rem;
  }

  .dismiss:hover {
    opacity: 0.7;
  }
</style>
