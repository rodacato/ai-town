import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      // The simulation, the benchmark, the model plumbing and the app's storage; rendering and React are checked in the browser.
      include: ['src/core/**', 'src/providers/**', 'src/app/townState.ts', 'src/app/memoryStorage.ts', 'src/app/keys.ts', 'src/app/features/bench/estimate.ts'],
      reporter: ['text-summary', 'text'],
      thresholds: { statements: 89, branches: 79, functions: 90, lines: 92 },
    },
  },
})
