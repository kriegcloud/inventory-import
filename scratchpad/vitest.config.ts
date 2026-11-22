import { defineConfig } from "vitest/config"

// Every experiment's tests, on Node as the repository's tests run. An empty scratchpad passes.
export default defineConfig({
  test: {
    include: ["experiments/**/*.test.{ts,tsx}"],
    passWithNoTests: true,
    // Its own cache of transformed modules, as every package keeps (vitest.shared.ts says why).
    fsModuleCachePath: "node_modules/.vitest-cache"
  }
})
