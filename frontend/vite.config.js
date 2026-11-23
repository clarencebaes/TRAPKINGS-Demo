import { defineConfig } from 'vite'

const proxy = { '/api': { target: 'http://127.0.0.1:8000', changeOrigin: false } }

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  server: { proxy },
  preview: { proxy },
})
