// The deploy workflow as decided ("releases and deploys", docs/releasing.md), read from the file GitHub runs: what
// starts it, and which job runs on which event. No runner is started here: this holds the routing, and `release
// verify`'s own tests hold the tag guard that the release-tag job runs.
import * as NodeServices from "@effect/platform-node/NodeServices"
import { expect, layer } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as O from "effect/Option"
import * as Str from "effect/String"
import * as Digest from "effect/crypto/Digest"
import { Repo } from "../src/Repo.service.ts"

const here = Repo.layer().pipe(Layer.provide(Digest.layerWebCrypto), Layer.provide(NodeServices.layer))

/** A workflow's text, from the repository's root. */
const workflow = Effect.fn("workflow")(function* (name: string) {
  const repo = yield* Repo
  return yield* repo.text(repo.join(repo.root, ".github/workflows", name))
})

/** One job's block: its `  <name>:` line and what follows, up to the next job. */
const job = (text: string, name: string) =>
  A.findFirst(Str.split(/\n(?= {2}[a-z][-a-z]*:\n)/)(text), Str.startsWith(`  ${name}:\n`)).pipe(O.getOrElse(() => ""))

/** The `on:` block. */
const triggers = (text: string) =>
  O.match(Str.match(/\non:\n[\s\S]*?\n(?=permissions:)/)(text), { onNone: () => "", onSome: (found) => found[0] })

layer(here)("the deploy workflow", (it) => {
  it.effect("starts on a v* tag, a pull request and CI's completed run on main, and on no push to a branch", () =>
    Effect.gen(function* () {
      const text = yield* workflow("deploy.yml")
      expect(triggers(text)).toBe(
        '\non:\n  push:\n    tags: ["v*"]\n  pull_request:\n    types: [opened, synchronize, reopened, closed]\n  workflow_run:\n    workflows: [CI]\n    types: [completed]\n    branches: [main]\n\n'
      )
    })
  )

  it.effect("deploys production only from a tag, after the tag's guard, behind the production environment", () =>
    Effect.gen(function* () {
      const text = yield* workflow("deploy.yml")
      const production = job(text, "production")
      expect(production).toContain("\n    needs: release-tag\n")
      expect(production).toContain("if: github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v')\n")
      expect(production).toContain("environment: production\n")
      expect(production).toContain("bunx alchemy deploy --stage prod --yes")
      const guard = job(text, "release-tag")
      expect(guard).toContain("fetch-depth: 0\n")
      expect(guard).toContain('run: bun run beep release verify "$GITHUB_REF_NAME"')
      expect(guard).not.toContain("environment:")
      // No other job names the production stage.
      expect(A.length(Str.split("--stage prod ")(text))).toBe(2)
    })
  )

  it.effect("deploys staging only after CI passed on a push to main, at the commit CI checked", () =>
    Effect.gen(function* () {
      const text = yield* workflow("deploy.yml")
      const staging = job(text, "staging")
      expect(staging).toContain(
        "github.event_name == 'workflow_run' && github.event.workflow_run.conclusion == 'success' &&\n      github.event.workflow_run.event == 'push' && github.event.workflow_run.head_branch == 'main'\n"
      )
      expect(staging).toContain("ref: ${{ github.event.workflow_run.head_sha }}\n")
      expect(staging).toContain("environment: staging\n")
      expect(staging).toContain("bunx alchemy deploy --stage staging --yes")
      expect(staging).not.toContain("OPENROUTER_API_KEY")
    })
  )

  it.effect("CI, which staging waits for, is the workflow named CI and checks main and the release branches", () =>
    Effect.gen(function* () {
      const text = yield* workflow("ci.yml")
      expect(Str.startsWith("name: CI\n")(text)).toBe(true)
      expect(text).toContain('    branches: [main, "release/**"]\n')
    })
  )
})
