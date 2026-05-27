import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  resolve: {
    alias: {
      $lib: path.resolve(__dirname, './src/lib'),
    },
  },
  build: {
    outDir: '../../public',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': `http://localhost:${process.env.DASHBOARD_PORT || 1337}`,
      '/ws': {
        target: `ws://localhost:${process.env.DASHBOARD_PORT || 1337}`,
        ws: true,
      },
    },
  },
})
