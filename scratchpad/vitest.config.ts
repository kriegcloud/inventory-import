import { defineConfig } from "vitest/config"
import { limits } from "../vitest.shared.ts"

// Every experiment's tests, on Node as the repository's tests run, with the repository's limits. An empty scratchpad
// passes.
export default defineConfig({
  test: { include: ["experiments/**/*.test.{ts,tsx}"], passWithNoTests: true, ...limits }
})
