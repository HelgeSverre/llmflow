// The initial theme is applied by the inline script in index.html (before first paint);
// this module only flips it and persists the choice under the same key.
export function toggleTheme() {
  const root = document.documentElement
  const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'
  if (next === 'dark') root.setAttribute('data-theme', 'dark')
  else root.removeAttribute('data-theme')
  localStorage.setItem('llmflow-theme', next)
}
