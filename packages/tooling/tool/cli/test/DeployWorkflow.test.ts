// The deploy workflow as decided ("releases and deploys", docs/releasing.md), read from the file GitHub runs and
// parsed as YAML, so a line that is commented out is not there and a job is found by its name whatever its name is.
// It holds what starts the workflow, which job runs on which event, in which environment, with which secrets, and
// every command each job runs, word for word: a job that deploys or destroys anything else fails here. The two shell
// guards in it (the refusal of every stage but a preview, and staging's "only main's head") are run, not only read.
// No runner is started: `release verify`'s own tests hold the tag guard that the release-tag job runs.
import * as NodeServices from "@effect/platform-node/NodeServices"
import { expect, layer } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import * as Digest from "effect/crypto/Digest"
import { parse } from "yaml"
import { Repo } from "../src/Repo.service.ts"
import { inTree } from "./support/tree.ts"

const here = Repo.layer().pipe(Layer.provide(Digest.layerWebCrypto), Layer.provide(NodeServices.layer))

const Step = S.Struct({
  name: S.optionalKey(S.String),
  id: S.optionalKey(S.String),
  if: S.optionalKey(S.String),
  uses: S.optionalKey(S.String),
  run: S.optionalKey(S.String),
  with: S.optionalKey(S.Record(S.String, S.Unknown)),
  env: S.optionalKey(S.Record(S.String, S.String))
})

const Job = S.Struct({
  name: S.String,
  if: S.String,
  needs: S.optionalKey(S.String),
  "runs-on": S.String,
  "timeout-minutes": S.Int,
  environment: S.optionalKey(S.String),
  concurrency: S.optionalKey(S.Struct({ group: S.String, "cancel-in-progress": S.Boolean })),
  env: S.optionalKey(S.Record(S.String, S.String)),
  steps: S.Array(Step)
})

/** Every key a workflow of ours has: one more (a `concurrency` for the whole workflow, say) fails the decode. */
const Workflow = S.Struct({
  name: S.String,
  on: S.Unknown,
  permissions: S.Unknown,
  jobs: S.Record(S.String, Job)
})

/** A workflow's text, from the repository's root. */
const text = Effect.fn("text")(function* (name: string) {
  const repo = yield* Repo
  return yield* repo.text(repo.join(repo.root, ".github/workflows", name))
})

/** The deploy workflow, parsed. A key the schema does not name is an error, not ignored. */
const deploy = Effect.gen(function* () {
  const source = yield* text("deploy.yml")
  const parsed: unknown = parse(source)
  return yield* S.decodeUnknownEffect(Workflow, { onExcessProperty: "error" })(parsed)
})

/** One fact about each job, by the job's name. */
const each = <T>(jobs: Readonly<Record<string, typeof Job.Type>>, read: (job: typeof Job.Type) => T) =>
  R.map(jobs, read)

/** One line: a condition written over several lines reads as one. */
const flat = (value: string) => Str.trim(Str.replace(/\s+/g, " ")(value))

const onTag = "github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v')"
const ownPullRequest = "github.event.pull_request.head.repo.full_name == github.repository"
const greenMain =
  "github.event_name == 'workflow_run' && github.event.workflow_run.conclusion == 'success' && github.event.workflow_run.event == 'push' && github.event.workflow_run.head_branch == 'main' && github.event.workflow_run.head_repository.full_name == github.repository"
const install = "bun install --frozen-lockfile"

layer(here)("the deploy workflow", (it) => {
  it.effect(
    "starts on a v* tag, a pull request and CI's completed run on main, on no push to a branch, and may only read the repository",
    () =>
      Effect.gen(function* () {
        const workflow = yield* deploy
        expect(workflow.on).toEqual({
          push: { tags: ["v*"] },
          pull_request: { types: ["opened", "synchronize", "reopened", "closed"] },
          workflow_run: { workflows: ["CI"], types: ["completed"], branches: ["main"] }
        })
        expect(workflow.permissions).toEqual({ contents: "read" })
      })
  )

  it.effect("has five jobs, each on its own event, and production only on a tag and after the tag's guard", () =>
    Effect.gen(function* () {
      const { jobs } = yield* deploy
      expect(each(jobs, (job) => flat(job.if))).toEqual({
        preview: `github.event_name == 'pull_request' && github.event.action != 'closed' && ${ownPullRequest}`,
        cleanup: `github.event_name == 'pull_request' && github.event.action == 'closed' && ${ownPullRequest}`,
        staging: greenMain,
        "release-tag": onTag,
        production: onTag
      })
      expect(each(jobs, (job) => O.getOrElse(O.fromUndefinedOr(job.needs), () => "nothing"))).toEqual({
        preview: "nothing",
        cleanup: "nothing",
        staging: "nothing",
        "release-tag": "nothing",
        production: "release-tag"
      })
    })
  )

  it.effect(
    "gives each job its environment and only that environment's secrets: the model key to production alone, and none to the tag's guard",
    () =>
      Effect.gen(function* () {
        const { jobs } = yield* deploy
        expect(each(jobs, (job) => O.getOrElse(O.fromUndefinedOr(job.environment), () => "none"))).toEqual({
          preview: "preview",
          cleanup: "preview",
          staging: "staging",
          "release-tag": "none",
          production: "production"
        })
        // Every secret and variable a job reads, in its own settings or a step's.
        const read = (job: typeof Job.Type) =>
          A.sort(Str.Order)(
            A.dedupe(
              A.flatMap([job.env ?? {}, ...A.map(job.steps, (step) => step.env ?? {})], (settings) =>
                A.flatMap(R.values(settings), (value) =>
                  A.map(
                    A.fromIterable(Str.matchAll(/\$\{\{ (secrets|vars)\.([A-Z_]+) \}\}/g)(value)),
                    (found) => `${found[1]}.${found[2]}`
                  )
                )
              )
            )
          )
        expect(each(jobs, read)).toEqual({
          preview: [
            "secrets.CLOUDFLARE_API_TOKEN",
            "secrets.PREVIEW_TEST_ACCOUNT_PASSWORD",
            "vars.CLOUDFLARE_ACCOUNT_ID"
          ],
          cleanup: ["secrets.CLOUDFLARE_API_TOKEN", "vars.CLOUDFLARE_ACCOUNT_ID"],
          staging: [
            "secrets.CLOUDFLARE_API_TOKEN",
            "secrets.PREVIEW_TEST_ACCOUNT_PASSWORD",
            "vars.CLOUDFLARE_ACCOUNT_ID"
          ],
          "release-tag": [],
          production: [
            "secrets.CLOUDFLARE_API_TOKEN",
            "secrets.OPENROUTER_API_KEY",
            "vars.CLOUDFLARE_ACCOUNT_ID",
            "vars.DEPLOY_WITHOUT_MODEL_KEY",
            "vars.SIGN_UP"
          ]
        })
        // No secret is read anywhere else in the file: not in a command, not in a step's `with`.
        const source = yield* text("deploy.yml")
        expect(A.length(Str.split("secrets.")(source)) - 1).toBe(
          A.length(A.flatMap(R.values(each(jobs, read)), A.filter(Str.startsWith("secrets."))))
        )
      })
  )

  it.effect(
    "runs these commands and no other: production's stage is deployed by the production job alone, and only a preview is ever destroyed",
    () =>
      Effect.gen(function* () {
        const { jobs } = yield* deploy
        // A step's command as one line each, so the two guards' scripts are named here and run below.
        const commands = (job: typeof Job.Type) =>
          A.flatMap(job.steps, (step) =>
            step.run === undefined ? [] : [step.name === undefined ? step.run : `(${step.name})`]
          )
        expect(each(jobs, commands)).toEqual({
          preview: [install, "(Deploy the preview)"],
          cleanup: ["(Refuse any stage but a preview)", install, "(Destroy the preview)"],
          staging: ["(Deploy only the commit main is at)", install, "(Deploy staging)"],
          "release-tag": ["(Fetch the tag as pushed)", install, "(Refuse a tag that is not a release)"],
          production: [install, "(Deploy production)"]
        })
        const named = (job: string, name: string) =>
          O.getOrElse(
            O.flatMap(R.get(jobs, job), (one) =>
              O.flatMap(
                A.findFirst(one.steps, (step) => step.name === name),
                (step) => O.fromUndefinedOr(step.run)
              )
            ),
            () => "no such step"
          )
        expect({
          preview: named("preview", "Deploy the preview"),
          cleanup: named("cleanup", "Destroy the preview"),
          staging: named("staging", "Deploy staging"),
          fetch: named("release-tag", "Fetch the tag as pushed"),
          guard: named("release-tag", "Refuse a tag that is not a release"),
          production: named("production", "Deploy production")
        }).toEqual({
          preview: 'bunx alchemy deploy --stage "$STAGE" --yes',
          cleanup: 'bunx alchemy destroy --stage "$STAGE" --yes',
          staging: "bunx alchemy deploy --stage staging --yes",
          fetch: 'git fetch --force origin "refs/tags/${GITHUB_REF_NAME}:refs/tags/${GITHUB_REF_NAME}"',
          guard: 'bun run beep release verify "$GITHUB_REF_NAME"',
          production: "bunx alchemy deploy --stage prod --yes"
        })
        // The stage a preview's two jobs name is the pull request's, and nothing else sets a stage.
        const stages = (job: typeof Job.Type) =>
          A.flatMap([job.env ?? {}, ...A.map(job.steps, (step) => step.env ?? {})], (settings) =>
            A.fromOption(R.get(settings, "STAGE"))
          )
        expect(each(jobs, stages)).toEqual({
          preview: ["pr-${{ github.event.pull_request.number }}"],
          cleanup: ["pr-${{ github.event.pull_request.number }}"],
          staging: [],
          "release-tag": [],
          production: []
        })
      })
  )

  it.effect("checks out what each job is about: CI's commit for staging, every branch for the tag's guard", () =>
    Effect.gen(function* () {
      const { jobs } = yield* deploy
      const checkout = (job: typeof Job.Type) =>
        A.flatMap(job.steps, (step) => (step.uses === "actions/checkout@v4" ? [step.with ?? {}] : []))
      expect(each(jobs, checkout)).toEqual({
        preview: [{}],
        cleanup: [{}],
        staging: [{ ref: "${{ github.event.workflow_run.head_sha }}" }],
        "release-tag": [{ "fetch-depth": 0 }],
        production: [{}]
      })
      // The refusal is the cleanup's first step, before any code of the pull request is checked out.
      expect(
        A.map(R.get(jobs, "cleanup").pipe(O.getOrThrow).steps, (step) => step.name ?? step.uses ?? step.run)
      ).toEqual([
        "Refuse any stage but a preview",
        "actions/checkout@v4",
        "actions/setup-node@v4",
        "oven-sh/setup-bun@v2",
        install,
        "Destroy the preview"
      ])
      // Everything after staging's "only main's head" step waits for its answer.
      const staging = R.get(jobs, "staging").pipe(O.getOrThrow).steps
      expect(A.map(staging, (step) => `${step.name ?? step.uses ?? step.run}: ${step.if ?? "always"}`)).toEqual([
        "actions/checkout@v4: always",
        "Deploy only the commit main is at: always",
        "actions/setup-node@v4: steps.head.outputs.deploy == 'true'",
        "oven-sh/setup-bun@v2: steps.head.outputs.deploy == 'true'",
        `${install}: steps.head.outputs.deploy == 'true'`,
        "Deploy staging: steps.head.outputs.deploy == 'true'"
      ])
      expect(
        A.findFirst(staging, (step) => step.name === "Deploy only the commit main is at").pipe(O.getOrThrow).id
      ).toBe("head")
    })
  )

  it.effect(
    "makes each deploy wait in a group of its own: a pull request's, staging's only for a run that deploys, and one for each release tag",
    () =>
      Effect.gen(function* () {
        const { jobs } = yield* deploy
        const group = (job: typeof Job.Type) =>
          job.concurrency === undefined
            ? "none"
            : `${flat(job.concurrency.group)}${job.concurrency["cancel-in-progress"] ? ", cancelling" : ""}`
        expect(each(jobs, group)).toEqual({
          preview: "deploy-pr-${{ github.event.pull_request.number }}",
          cleanup: "deploy-pr-${{ github.event.pull_request.number }}",
          staging: `\${{ (${greenMain}) && 'deploy-staging' || format('deploy-nothing-{0}', github.run_id) }}`,
          "release-tag": "none",
          production: "deploy-prod-${{ github.ref_name }}"
        })
      })
  )

  it.effect("CI, which staging waits for, is the workflow named CI and checks main and the release branches", () =>
    Effect.gen(function* () {
      const source = yield* text("ci.yml")
      const parsed: unknown = parse(source)
      const ci = yield* S.decodeUnknownEffect(S.Struct({ name: S.String, on: S.Unknown }))(parsed)
      expect(ci).toEqual({ name: "CI", on: { push: { branches: ["main", "release/**"] }, pull_request: null } })
    })
  )
})

/** A named step's script, from the file. */
const script = Effect.fn("script")(function* (job: string, name: string) {
  const { jobs } = yield* deploy
  return yield* O.flatMap(R.get(jobs, job), (one) =>
    O.flatMap(
      A.findFirst(one.steps, (step) => step.name === name),
      (step) => O.fromUndefinedOr(step.run)
    )
  ).pipe(Effect.fromOption, Effect.orDie)
})

layer(here)("the deploy workflow's two shell guards, run", (it) => {
  it.effect("the cleanup's refusal lets a preview's stage through and stops every other name", () =>
    Effect.gen(function* () {
      const refusal = yield* script("cleanup", "Refuse any stage but a preview")
      const codes = yield* inTree(
        {},
        Effect.gen(function* () {
          const repo = yield* Repo
          return yield* Effect.forEach(
            [
              "pr-1",
              "pr-42",
              "pr-123456",
              "prod",
              "staging",
              "pr-0",
              "pr-",
              "pr-12x",
              "pr-1234567",
              "test_ben",
              "dev_ben",
              ""
            ],
            (stage) =>
              Effect.map(
                repo.run("bash", ["-e", "-c", refusal], { env: { STAGE: stage } }),
                (ran) => `${stage}: ${ran.code}`
              ),
            { concurrency: 1 }
          )
        })
      )
      expect(codes).toEqual([
        "pr-1: 0",
        "pr-42: 0",
        "pr-123456: 0",
        "prod: 1",
        "staging: 1",
        "pr-0: 1",
        "pr-: 1",
        "pr-12x: 1",
        "pr-1234567: 1",
        "test_ben: 1",
        "dev_ben: 1",
        ": 1"
      ])
    })
  )

  it.effect(
    "staging's step says deploy for the commit main is at, not for an older one, and fails when main cannot be read",
    () =>
      Effect.gen(function* () {
        const step = yield* script("staging", "Deploy only the commit main is at")
        const seen = yield* inTree(
          { "a.txt": "a\n" },
          Effect.gen(function* () {
            const repo = yield* Repo
            const git = (...args: ReadonlyArray<string>) =>
              Effect.map(repo.run("git", args), (ran) => Str.trim(ran.stdout))
            yield* git("init", "-q", "-b", "main")
            yield* git("config", "user.name", "Test")
            yield* git("config", "user.email", "test@example.test")
            yield* git("config", "commit.gpgsign", "false")
            yield* git("add", "--all")
            yield* git("commit", "-q", "-m", "chore: the older commit")
            const older = yield* git("rev-parse", "HEAD")
            yield* git("commit", "-q", "--allow-empty", "-m", "chore: main's head")
            const head = yield* git("rev-parse", "HEAD")
            yield* git("init", "-q", "--bare", ".git/origin.git")
            yield* git("remote", "add", "origin", ".git/origin.git")
            yield* git("push", "-q", "origin", "main")
            const output = repo.join(repo.root, ".git/output")
            const asked = Effect.fn("asked")(function* (checked: string) {
              yield* repo.write(output, "")
              const ran = yield* repo.run("bash", ["-e", "-c", step], {
                env: { CHECKED: checked, GITHUB_OUTPUT: output }
              })
              const said = yield* repo.text(output)
              return Str.trim(`${ran.code} ${Str.trim(said)}`)
            })
            const forHead = yield* asked(head)
            const forOlder = yield* asked(older)
            yield* git("push", "-q", "origin", "--delete", "main")
            const unreadable = yield* asked(head)
            return [forHead, forOlder, unreadable]
          })
        )
        expect(seen).toEqual(["0 deploy=true", "0 deploy=false", "1"])
      })
  )
})
