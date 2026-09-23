export function createLoadState() {
  const state = $state({ loading: false, loaded: false, error: '' })
  return state
}

export type LoadState = ReturnType<typeof createLoadState>
