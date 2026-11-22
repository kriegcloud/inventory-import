import { defineConfig } from "vitest/config"

// The tests that start the real test runner and type-checker (`*.slow.test.ts`): `bun run check:full` runs them.
export default defineConfig({ test: { include: ["test/**/*.slow.test.ts"] } })
