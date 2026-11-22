import { defineConfig } from "vitest/config"

export default defineConfig({ test: { include: ["test/**/*.test.ts"], fsModuleCachePath: "node_modules/.vitest-cache" } })
