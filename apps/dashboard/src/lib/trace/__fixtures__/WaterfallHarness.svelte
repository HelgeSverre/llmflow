<script lang="ts">
  import SpanWaterfall from '$lib/components/trace-viewer/SpanWaterfall.svelte'
  import type { SpanInput } from '../viewport.svelte'

  let spans = $state<SpanInput[]>([])
  let traceId = $state('a')
  export function update(next: SpanInput[], id = 'a') {
    spans = next
    traceId = id
  }
</script>

<SpanWaterfall {spans} {traceId} />
