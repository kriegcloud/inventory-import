import { defineConfig } from "vitest/config"

// Every experiment's tests, on Node as the repository's tests run. An empty scratchpad passes. The limits are the
// repository's (vitest.shared.ts at the root), written out: the scratchpad keeps its own lockfile and imports
// nothing from the workspaces.
export default defineConfig({
  test: {
    include: ["experiments/**/*.test.{ts,tsx}"],
    passWithNoTests: true,
    testTimeout: 30_000,
    hookTimeout: 60_000
  }
})
