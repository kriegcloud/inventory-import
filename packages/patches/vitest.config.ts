import { defineConfig } from "vitest/config"
import { limits } from "../../vitest.shared.ts"

// Each patch's test proves a small model with the patched package, in seconds. `beep patches prove` runs the same
// files beside the package without its patches, where each has to fail (docs/patches.md).
export default defineConfig({ test: { include: ["test/**/*.test.ts"], ...limits } })
