export function createDebounce(delay: number) {
  let timer: ReturnType<typeof setTimeout> | undefined
  function cancel() {
    clearTimeout(timer)
    timer = undefined
  }
  return {
    cancel,
    schedule(callback: () => void) {
      cancel()
      timer = setTimeout(() => {
        timer = undefined
        callback()
      }, delay)
    },
  }
}
