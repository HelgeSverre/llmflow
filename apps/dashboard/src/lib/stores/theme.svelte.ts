const STORAGE_KEY = 'llmflow-theme'

function getInitialTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'dark' || saved === 'light') return saved
  
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export const theme = $state<{ value: 'light' | 'dark' }>({ value: getInitialTheme() })

export function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
  
  if (theme.value === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark')
  } else {
    document.documentElement.removeAttribute('data-theme')
  }
  
  localStorage.setItem(STORAGE_KEY, theme.value)
}

export function initTheme() {
  if (theme.value === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark')
  }
}
