import { defineConfig } from "vitest/config"
import { limits, realTime } from "../../../vitest.shared.ts"

export default defineConfig({ test: { include: ["test/**/*.test.ts"], ...limits, ...realTime } })
