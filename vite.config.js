import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The GitHub Pages workflow builds with VITE_BASE=/spendwise/; local dev and preview serve from /.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  // React + React Router + Recharts land in one ~230 kB (gzip) chunk; Supabase is already split out lazily.
  build: { chunkSizeWarningLimit: 900 },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    css: false,
  },
})
