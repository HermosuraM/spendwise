import { useSyncExternalStore } from 'react'

// Charts need the active theme in JS (to pick that theme's palette). Watch the <html class="dark"> flag.
function subscribe(onChange) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  return () => observer.disconnect()
}

const snapshot = () => (document.documentElement.classList.contains('dark') ? 'dark' : 'light')

export function useThemeMode() {
  return useSyncExternalStore(subscribe, snapshot, () => 'light')
}
