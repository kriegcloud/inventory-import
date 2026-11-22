import { configDefaults, defineConfig } from "vitest/config"
import { limits, realTime } from "../../../vitest.shared.ts"

// Two projects. "fast" is what `test` runs, in `bun run check`; its tests that wait in real time are tried again
// (`realTime`). "fold" is the property that the review's model holds what the review region decides
// (`*.fold.test.ts`): over a minute, so it is its own turbo task, `fold`, run by `bun run check:full` and CI's proofs
// job, and replayed until this package or what it reads changes. It is seeded and waits for nothing, so it is never
// tried again: a second try would hide a counterexample.
const fold = ["test/**/*.fold.test.ts"]

export default defineConfig({
  test: {
    ...limits,
    projects: [
      {
        extends: true,
        test: {
          name: "fast",
          include: ["test/**/*.test.ts"],
          exclude: [...configDefaults.exclude, ...fold],
          ...realTime
        }
      },
      { extends: true, test: { name: "fold", include: fold } }
    ]
  }
})
