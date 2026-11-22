import { defineConfig } from "vitest/config"
import { limits } from "../../vitest.shared.ts"

export default defineConfig({ test: { include: ["test/**/*.test.ts"], ...limits } })
