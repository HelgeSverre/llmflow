<script lang="ts">
  let { value, label }: { value: string; label: string } = $props()
  let result = $state('')
  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      result = 'Copied'
    } catch {
      result = 'Could not copy. Select the ID to copy it manually.'
    }
  }
</script>

<button class="btn-secondary" title={value} onclick={copy}>Copy {label}</button>
{#if result}<span role="status">{result}</span>{#if result !== 'Copied'}<code>{value}</code
    >{/if}{/if}
