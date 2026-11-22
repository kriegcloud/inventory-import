import { configDefaults, defineConfig } from "vitest/config"
import { limits, realTime, saidAloud } from "../../../vitest.shared.ts"

// Two projects. "fast" is what `test` runs, in `bun run check`; its tests that wait in real time are tried again
// (`realTime`), and each retry is said aloud. "fold" is the property that the review's model holds what the review
// region decides (`*.fold.test.ts`): over a minute, so it is its own turbo task, `fold`, run by `bun run check:full`
// and CI's proofs job, and replayed until this package or what it reads changes. It is seeded and waits for nothing,
// so it is never tried again: a second try would hide a counterexample. Each project keeps its own module cache:
// turbo can start the two side by side, and each would empty the other's folder (../../../vitest.shared.ts says why);
// the one above them holds only what vitest knows of the lockfile.
const fold = ["test/**/*.fold.test.ts"]

export default defineConfig({
  test: {
    ...limits,
    ...saidAloud,
    fsModuleCachePath: "node_modules/.vitest-cache",
    projects: [
      {
        extends: true,
        test: {
          name: "fast",
          include: ["test/**/*.test.ts"],
          exclude: [...configDefaults.exclude, ...fold],
          fsModuleCachePath: "node_modules/.vitest-cache/fast",
          ...realTime
        }
      },
      {
        extends: true,
        test: { name: "fold", include: fold, fsModuleCachePath: "node_modules/.vitest-cache/fold" }
      }
    ]
  }
})
