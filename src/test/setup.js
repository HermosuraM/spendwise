import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Recharts' ResponsiveContainer measures its parent; jsdom has no layout, so give it a fixed size.
class ResizeObserverStub {
  constructor(callback) {
    this.callback = callback
  }
  observe(target) {
    this.callback([{ target, contentRect: { width: 800, height: 400 } }])
  }
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub
window.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {} })

afterEach(() => {
  cleanup()
  localStorage.clear()
  document.documentElement.classList.remove('dark')
})
