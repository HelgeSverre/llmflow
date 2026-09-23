import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    resolve: { conditions: ['browser'] },
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.ts'],
      globals: false,
    },
  }),
)
