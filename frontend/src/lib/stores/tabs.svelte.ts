export const validTabs = ['timeline', 'traces', 'logs', 'metrics', 'models', 'analytics'] as const
export type Tab = typeof validTabs[number]

function getTabFromHash(): Tab {
  if (typeof window === 'undefined') return 'timeline'
  const hash = window.location.hash.slice(1)
  return validTabs.includes(hash as Tab) ? (hash as Tab) : 'timeline'
}

// Create a reactive state class that components import
class TabStore {
  #current = $state<Tab>(getTabFromHash())
  
  get current(): Tab {
    return this.#current
  }
  
  set current(value: Tab) {
    this.#current = value
  }
}

export const tabState = new TabStore()

export function setTab(tab: Tab) {
  if (!validTabs.includes(tab)) return
  
  tabState.current = tab
  
  if (window.location.hash !== '#' + tab) {
    history.pushState(null, '', '#' + tab)
  }
}

export function initTabHashSync() {
  // Set initial hash if not already set
  if (!window.location.hash || !validTabs.includes(window.location.hash.slice(1) as Tab)) {
    history.replaceState(null, '', '#' + tabState.current)
  }
  
  window.addEventListener('hashchange', () => {
    const tab = getTabFromHash()
    if (tab !== tabState.current) {
      tabState.current = tab
    }
  })
}
