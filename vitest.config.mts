import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, '.') },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['lib/**/*.ts'],
      exclude: ['lib/types.ts'],
      reporter: ['text-summary', 'text'],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
})
