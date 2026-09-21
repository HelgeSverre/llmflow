<script lang="ts">
  let { value }: { value: unknown } = $props()
  function decode(input: unknown): unknown {
    if (typeof input !== 'string') return input
    try {
      return JSON.parse(input)
    } catch {
      return input
    }
  }
  function format(input: unknown): string {
    return typeof input === 'string' ? input : (JSON.stringify(input, null, 2) ?? '')
  }
  const decoded = $derived(decode(value))
  const messages = $derived.by(() => {
    const candidate =
      decoded && typeof decoded === 'object' && !Array.isArray(decoded)
        ? (decoded as Record<string, unknown>).messages
        : decoded
    if (!Array.isArray(candidate) || !candidate.length) return null
    const parsed = candidate.map(decode)
    return parsed.every(
      (item) =>
        item &&
        typeof item === 'object' &&
        typeof (item as Record<string, unknown>).role === 'string',
    )
      ? (parsed as Record<string, unknown>[])
      : null
  })
  function parts(message: Record<string, unknown>): unknown[] {
    const body = message.parts ?? message.content
    if (Array.isArray(body)) return body
    return body == null ? [message] : [body]
  }
</script>

<div class="messages">
  {#if messages}
    {#each messages as message}
      <article>
        <h3>{message.role}</h3>
        {#each parts(message) as part}
          {#if part && typeof part === 'object'}
            {@const item = part as Record<string, unknown>}
            {#if item.type === 'text'}
              <pre>{format(item.content ?? item.text)}</pre>
            {:else if item.type === 'tool_call' || item.type === 'tool_use'}
              <h4>Tool call: {item.name ?? 'Unnamed tool'}</h4>
              <pre>{format(item.arguments ?? item.input)}</pre>
            {:else if item.type === 'tool_call_response' || item.type === 'tool_result'}
              <h4>Tool response{item.id ? `: ${item.id}` : ''}</h4>
              <pre>{format(item.response ?? item.result ?? item.content)}</pre>
            {:else}
              <pre>{format(item)}</pre>
            {/if}
          {:else}
            <pre>{format(part)}</pre>
          {/if}
        {/each}
        {#if message.tool_calls}<h4>Tool calls</h4>
          <pre>{format(message.tool_calls)}</pre>{/if}
      </article>
    {/each}
  {:else}
    <pre>{format(decoded)}</pre>
  {/if}
</div>

<style>
  article {
    padding: 12px;
    margin-bottom: 12px;
    border: 1px solid var(--border-primary);
    border-radius: 6px;
  }
  h3 {
    margin: 0 0 8px;
    font-size: 13px;
    text-transform: capitalize;
  }
  h4 {
    margin: 8px 0;
    font-size: 12px;
  }
  pre {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    margin: 0;
    font: inherit;
  }
</style>
