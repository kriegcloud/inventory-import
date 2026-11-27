import { configDefaults, defineConfig } from "vitest/config"
import { limits } from "../../../vitest.shared.ts"

// Four projects. "fast" is what `test` runs: the rules' tests and the model's stories. "prove" holds the files named
// `*.prove.test.ts`: the proofs of the import, the group, the row's starting state and the four decisions, run by
// `prove` as part of `bun run check`, where turbo replays them until the model's files or the pinned library change.
// "verify" holds `*.verify.test.ts`: the search of the whole model under Verify, run by the `verify` task, which only
// `bun run check:full` and CI's proofs job run. "explore" holds `*.explore.test.ts`: the nightly's longer search, on
// walks picked by the day, run by the `explore` task, which only the nightly runs. A `*.slow.test.ts` file here would
// land in "fast".
const prove = ["test/**/*.prove.test.ts"]
const verify = ["test/**/*.verify.test.ts"]
const explore = ["test/**/*.explore.test.ts"]

// Each project keeps its own module cache: turbo starts the fast tests, the proofs and the search side by side, and
// each would empty another's folder (../../../vitest.shared.ts says why). The one above them holds only what vitest
// knows of the lockfile.
const cache = (name: string) => ({ fsModuleCachePath: `node_modules/.vitest-cache/${name}` })

export default defineConfig({
  test: {
    ...limits,
    fsModuleCachePath: "node_modules/.vitest-cache",
    projects: [
      {
        extends: true,
        test: {
          name: "fast",
          include: ["test/**/*.test.ts"],
          exclude: [...configDefaults.exclude, ...prove, ...verify, ...explore],
          ...cache("fast")
        }
      },
      { extends: true, test: { name: "prove", include: prove, ...cache("prove") } },
      { extends: true, test: { name: "verify", include: verify, ...cache("verify") } },
      { extends: true, test: { name: "explore", include: explore, ...cache("explore") } }
    ]
  }
})
