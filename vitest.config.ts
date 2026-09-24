import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      // The simulation, the benchmark and the model plumbing; rendering and React are checked in the browser.
      include: ['src/core/**', 'src/providers/**'],
      reporter: ['text-summary', 'text'],
      thresholds: { statements: 88, branches: 78, functions: 88, lines: 90 },
    },
  },
})
