import { configDefaults, defineConfig } from "vitest/config"

// Three projects. "fast" is what `test` runs: the rules' tests and the model's stories. "prove" holds the files named
// `*.prove.test.ts`: the proofs of the import and of the four decisions, about half a minute together, run by `prove` as part of
// `bun run check`, where turbo replays them until the model's files or the pinned library change. "verify" holds
// `*.verify.test.ts`: the search of the whole model under Verify, run by the `verify` task, which only
// `bun run check:full` and CI's proofs job run. A `*.slow.test.ts` file here would land in "fast".
const prove = ["test/**/*.prove.test.ts"]
const verify = ["test/**/*.verify.test.ts"]

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "fast",
          include: ["test/**/*.test.ts"],
          exclude: [...configDefaults.exclude, ...prove, ...verify]
        }
      },
      { extends: true, test: { name: "prove", include: prove } },
      { extends: true, test: { name: "verify", include: verify } }
    ]
  }
})
