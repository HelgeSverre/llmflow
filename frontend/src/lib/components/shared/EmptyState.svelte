<script lang="ts">
  interface Props {
    message?: string
  }
  
  let { message = 'No data' }: Props = $props()
</script>

<div class="empty-state">{message}</div>
