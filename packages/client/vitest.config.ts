import { defineConfig } from "vitest/config"
import { limits, realTime, saidAloud } from "../../vitest.shared.ts"

export default defineConfig({ test: { include: ["test/**/*.test.ts"], ...limits, ...realTime, ...saidAloud } })
