import { configDefaults, defineConfig } from "vitest/config"
import { limits, slowLimits } from "../../vitest.shared.ts"

// Two projects. "fast" is what `test` runs: the model's Worker in process, on the memory host, each Api at its own
// prefix. "slow" holds the files named `*.slow.test.ts`: the D1 client the Worker's ports will use, on a test
// database in workerd, run by `test:slow` in `bun run check:full`.
const slow = ["test/**/*.slow.test.ts"]

// Each project keeps its own module cache: turbo may start both at once, and each would empty the other's folder
// (../../vitest.shared.ts says why).
const cache = (name: string) => ({ fsModuleCachePath: `node_modules/.vitest-cache/${name}` })

export default defineConfig({
  test: {
    environment: "node",
    fsModuleCachePath: "node_modules/.vitest-cache",
    projects: [
      {
        extends: true,
        test: {
          name: "fast",
          include: ["test/**/*.test.ts"],
          exclude: [...configDefaults.exclude, ...slow],
          ...limits,
          ...cache("fast")
        }
      },
      { extends: true, test: { name: "slow", include: slow, ...slowLimits, ...cache("slow") } }
    ]
  }
})
