import { defineConfig } from "vitest/config"
import { slowLimits } from "../../../../vitest.shared.ts"

// The slow tests' own configuration (`bun run test:slow`), so they keep their own module cache. Turbo starts this
// package's fast and slow tests side by side; from one configuration both used one cache folder, and after a change
// to `bun.lock` each emptied it under the other (../../../../vitest.shared.ts says what that does).
// As in vitest.config.ts, no test sees the `LEDGER_BASE` CI names for the real tree.
export default defineConfig({ test: { include: ["test/**/*.slow.test.ts"], env: { LEDGER_BASE: "" }, ...slowLimits } })
