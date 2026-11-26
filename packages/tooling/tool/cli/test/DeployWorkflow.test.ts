// The deploy workflow as decided ("releases and deploys", docs/releasing.md), read from the file GitHub runs and
// parsed as YAML, so a line that is commented out is not there and a job is found by its name whatever its name is.
// It holds what starts the workflow, which job runs on which event, in which environment, with which secrets, and
// every step of every job in order: each action with its version and what it is given, each command and each guard's
// whole script word for word, and each step's own condition. A step added, moved, swapped or switched off in any job fails here. The three shell
// guards in it (the refusal of every stage but a preview, staging's "only main's head", and production's "still the
// release branch's head" after the approval) are run, not only read. What an action does is not read: its name and
// version are.
// No runner is started: `release verify-head`'s own tests hold the guard that the release-tag job runs.
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
  outputs: S.optionalKey(S.Record(S.String, S.String)),
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

const greenRelease =
  "github.event_name == 'workflow_run' && github.event.workflow_run.conclusion == 'success' && github.event.workflow_run.event == 'push' && startsWith(github.event.workflow_run.head_branch, 'release/') && github.event.workflow_run.head_repository.full_name == github.repository"
const ownPullRequest = "github.event.pull_request.head.repo.full_name == github.repository"
const greenMain =
  "github.event_name == 'workflow_run' && github.event.workflow_run.conclusion == 'success' && github.event.workflow_run.event == 'push' && github.event.workflow_run.head_branch == 'main' && github.event.workflow_run.head_repository.full_name == github.repository"
const install = "bun install --frozen-lockfile"

// The three shell guards, word for word as the file has them: a line added to one (a second command after its last
// `fi`, say) fails the step list below, whatever the script still exits with.
const refusePreviewOnly = `case "$STAGE" in
  pr-[1-9]|pr-[1-9][0-9]|pr-[1-9][0-9][0-9]|pr-[1-9][0-9][0-9][0-9]|pr-[1-9][0-9][0-9][0-9][0-9]|pr-[1-9][0-9][0-9][0-9][0-9][0-9]) ;;
  *) echo "Refusing to destroy \\"$STAGE\\": only pr-<number> may be destroyed by a workflow." >&2; exit 1 ;;
esac
`
const onlyMainsHead = `main="$(git ls-remote origin refs/heads/main | awk '$2 == "refs/heads/main" { print $1 }')"
if [ -z "$main" ]; then
  echo "git could not say where main is, so nothing is deployed." >&2
  exit 1
fi
if [ "$main" = "$CHECKED" ]; then
  echo "deploy=true" >> "$GITHUB_OUTPUT"
else
  echo "Not deploying $CHECKED: main is at $main now, and that commit's own CI run deploys staging."
  echo "deploy=false" >> "$GITHUB_OUTPUT"
fi
`
const onlyTheBranchsHead = `head="$(git ls-remote origin "refs/heads/$BRANCH" | awk '$2 == "refs/heads/" ENVIRON["BRANCH"] { print $1 }')"
tagged="$(git ls-remote origin "refs/tags/$TAG^{}" | awk '$2 == "refs/tags/" ENVIRON["TAG"] "^{}" { print $1 }')"
if [ -z "$head" ] || [ -z "$tagged" ]; then
  echo "git could not say where $BRANCH and $TAG are, so nothing is deployed." >&2
  exit 1
fi
if [ "$head" != "$CHECKED" ] || [ "$tagged" != "$CHECKED" ]; then
  echo "Not deploying $TAG at $CHECKED: $BRANCH is at $head and $TAG at $tagged now. A later release of this line took its place." >&2
  exit 1
fi
`

layer(here)("the deploy workflow", (it) => {
  it.effect(
    "starts on a pull request and on CI's completed run on main or a release branch, on no push of a tag or a branch, and may only read the repository",
    () =>
      Effect.gen(function* () {
        const workflow = yield* deploy
        expect(workflow.on).toEqual({
          pull_request: { types: ["opened", "synchronize", "reopened", "closed"] },
          workflow_run: { workflows: ["CI"], types: ["completed"], branches: ["main", "release/**"] }
        })
        expect(workflow.permissions).toEqual({ contents: "read" })
      })
  )

  it.effect("has five jobs, each on its own event, and production only after the release's guard named a tag", () =>
    Effect.gen(function* () {
      const { jobs } = yield* deploy
      expect(each(jobs, (job) => flat(job.if))).toEqual({
        preview: `github.event_name == 'pull_request' && github.event.action != 'closed' && ${ownPullRequest}`,
        cleanup: `github.event_name == 'pull_request' && github.event.action == 'closed' && ${ownPullRequest}`,
        staging: greenMain,
        "release-tag": greenRelease,
        production: "needs.release-tag.outputs.tag != ''"
      })
      // The tag the guard names is the one its verify step wrote, and nothing else.
      expect(each(jobs, (job) => job.outputs ?? {})).toEqual({
        preview: {},
        cleanup: {},
        staging: {},
        "release-tag": { tag: "${{ steps.verify.outputs.tag }}" },
        production: {}
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
            "secrets.SIGN_UP",
            "vars.CLOUDFLARE_ACCOUNT_ID"
          ],
          "release-tag": [],
          production: [
            "secrets.CLOUDFLARE_API_TOKEN",
            "secrets.OPENROUTER_API_KEY",
            "secrets.SIGN_UP",
            "vars.CLOUDFLARE_ACCOUNT_ID",
            "vars.DEPLOY_WITHOUT_MODEL_KEY"
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
          "release-tag": ["(Fetch the tags as pushed)", install, "(Refuse a release that is not one)"],
          production: ["(Deploy only a release that is still its branch's head)", install, "(Deploy production)"]
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
          fetch: named("release-tag", "Fetch the tags as pushed"),
          guard: named("release-tag", "Refuse a release that is not one"),
          production: named("production", "Deploy production")
        }).toEqual({
          preview: 'bunx alchemy deploy --stage "$STAGE" --yes',
          cleanup: 'bunx alchemy destroy --stage "$STAGE" --yes',
          staging: "bunx alchemy deploy --stage staging --yes",
          fetch: "git fetch --force --tags origin",
          guard: 'bun run beep release verify-head "$BRANCH" "$CHECKED" --output "$GITHUB_OUTPUT"',
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

  it.effect(
    "checks out what each job is about: CI's commit for staging and for production, and main's code with every branch for the release's guard",
    () =>
      Effect.gen(function* () {
        const { jobs } = yield* deploy
        const checkout = (job: typeof Job.Type) =>
          A.flatMap(job.steps, (step) => (step.uses === "actions/checkout@v4" ? [step.with ?? {}] : []))
        expect(each(jobs, checkout)).toEqual({
          preview: [{}],
          cleanup: [{}],
          staging: [{ ref: "${{ github.event.workflow_run.head_sha }}" }],
          "release-tag": [{ ref: "main", "fetch-depth": 0 }],
          production: [{ ref: "${{ github.event.workflow_run.head_sha }}" }]
        })
        // The guard is told the branch and the commit as values, and writes the tag as its step's output.
        const verify = O.getOrThrow(
          O.flatMap(R.get(jobs, "release-tag"), (job) =>
            A.findFirst(job.steps, (step) => step.name === "Refuse a release that is not one")
          )
        )
        expect({ id: verify.id, env: verify.env }).toEqual({
          id: "verify",
          env: {
            BRANCH: "${{ github.event.workflow_run.head_branch }}",
            CHECKED: "${{ github.event.workflow_run.head_sha }}"
          }
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
    "every job's steps are these, in this order, and no other: each action with its version and what it is given, each command, each step's own condition",
    () =>
      Effect.gen(function* () {
        const { jobs } = yield* deploy
        // An action is told by its `uses`, whatever it is named, so a name cannot stand in for one; a command is its
        // whole text, so a name cannot stand in for a script either.
        const steps = (job: typeof Job.Type) =>
          A.map(job.steps, (step) => ({
            does: step.uses ?? step.run,
            named: step.name ?? "",
            given: step.with ?? {},
            told: step.env ?? {},
            when: step.if ?? "always"
          }))
        const uses = (does: string, given: Record<string, unknown>, when = "always") => ({
          does,
          named: "",
          given,
          told: {},
          when
        })
        const checkout = (given: Record<string, unknown>) => uses("actions/checkout@v4", given)
        const node = (when = "always") => uses("actions/setup-node@v4", { "node-version": 22 }, when)
        const bun = (when = "always") => uses("oven-sh/setup-bun@v2", { "bun-version-file": ".bun-version" }, when)
        // What a step is told is part of what it does: a guard given another commit to compare checks nothing.
        const runs = (named: string, does: string, when = "always", told: Record<string, string> = {}) => ({
          does,
          named,
          given: {},
          told,
          when
        })
        const ciBranch = "${{ github.event.workflow_run.head_branch }}"
        const ciSha = "${{ github.event.workflow_run.head_sha }}"
        const onHead = "steps.head.outputs.deploy == 'true'"
        const ciCommit = { ref: "${{ github.event.workflow_run.head_sha }}" }
        expect(each(jobs, steps)).toEqual({
          preview: [
            checkout({}),
            node(),
            bun(),
            runs("", install),
            runs("Deploy the preview", 'bunx alchemy deploy --stage "$STAGE" --yes')
          ],
          cleanup: [
            runs("Refuse any stage but a preview", refusePreviewOnly),
            checkout({}),
            node(),
            bun(),
            runs("", install),
            runs("Destroy the preview", 'bunx alchemy destroy --stage "$STAGE" --yes')
          ],
          staging: [
            checkout(ciCommit),
            runs("Deploy only the commit main is at", onlyMainsHead, "always", { CHECKED: ciSha }),
            node(onHead),
            bun(onHead),
            runs("", install, onHead),
            runs("Deploy staging", "bunx alchemy deploy --stage staging --yes", onHead)
          ],
          "release-tag": [
            checkout({ ref: "main", "fetch-depth": 0 }),
            runs("Fetch the tags as pushed", "git fetch --force --tags origin"),
            bun(),
            runs("", install),
            runs(
              "Refuse a release that is not one",
              'bun run beep release verify-head "$BRANCH" "$CHECKED" --output "$GITHUB_OUTPUT"',
              "always",
              { BRANCH: ciBranch, CHECKED: ciSha }
            )
          ],
          production: [
            checkout(ciCommit),
            runs("Deploy only a release that is still its branch's head", onlyTheBranchsHead, "always", {
              BRANCH: ciBranch,
              CHECKED: ciSha,
              TAG: "${{ needs.release-tag.outputs.tag }}"
            }),
            node(),
            bun(),
            runs("", install),
            runs("Deploy production", "bunx alchemy deploy --stage prod --yes")
          ]
        })
        // The only places the file names the deploy tool are those four commands: no script holds a fifth.
        const source = yield* text("deploy.yml")
        expect(A.length(Str.split("alchemy")(source)) - 1).toBe(4)
        // Each job's own variables, by name and by what is written for each: nothing is added to a job unseen.
        const account = {
          CLOUDFLARE_API_TOKEN: "${{ secrets.CLOUDFLARE_API_TOKEN }}",
          CLOUDFLARE_ACCOUNT_ID: "${{ vars.CLOUDFLARE_ACCOUNT_ID }}"
        }
        const password = { PREVIEW_TEST_ACCOUNT_PASSWORD: "${{ secrets.PREVIEW_TEST_ACCOUNT_PASSWORD }}" }
        const stage = { STAGE: "pr-${{ github.event.pull_request.number }}" }
        expect(each(jobs, (job) => job.env ?? {})).toEqual({
          preview: { ...account, ...password, ...stage },
          cleanup: { ...account, ...stage },
          staging: { ...account, ...password, SIGN_UP: "${{ secrets.SIGN_UP }}" },
          "release-tag": {},
          production: {
            ...account,
            OPENROUTER_API_KEY: "${{ secrets.OPENROUTER_API_KEY }}",
            DEPLOY_WITHOUT_MODEL_KEY: "${{ vars.DEPLOY_WITHOUT_MODEL_KEY }}",
            SIGN_UP: "${{ secrets.SIGN_UP }}"
          }
        })
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
          production: "deploy-prod-${{ needs.release-tag.outputs.tag }}"
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

layer(here)("the deploy workflow's three shell guards, run", (it) => {
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
            // A branch whose name only ends as main's does, which `git ls-remote` lists first, answers for nothing.
            yield* git("push", "-q", "origin", `${older}:refs/heads/a/refs/heads/main`)
            const decoyAtOlder = yield* Effect.all([asked(head), asked(older)], { concurrency: 1 })
            yield* git("push", "-q", "origin", "--delete", "a/refs/heads/main")
            yield* git("push", "-q", "origin", "--delete", "main")
            const unreadable = yield* asked(head)
            return [forHead, forOlder, ...decoyAtOlder, unreadable]
          })
        )
        expect(seen).toEqual(["0 deploy=true", "0 deploy=false", "0 deploy=true", "0 deploy=false", "1"])
      })
  )

  it.effect(
    "production's step after the approval passes only for a commit that is still its release branch's head and still carries the tag: a release a later one replaced, a tag that moved and a branch it cannot read all fail",
    () =>
      Effect.gen(function* () {
        const step = yield* script("production", "Deploy only a release that is still its branch's head")
        const seen = yield* inTree(
          { "a.txt": "a\n" },
          Effect.gen(function* () {
            const repo = yield* Repo
            const git = (...args: ReadonlyArray<string>) =>
              Effect.map(repo.run("git", args), (ran) => Str.trim(ran.stdout))
            yield* git("init", "-q", "-b", "release/1.0")
            yield* git("config", "user.name", "Test")
            yield* git("config", "user.email", "test@example.test")
            yield* git("config", "commit.gpgsign", "false")
            yield* git("config", "tag.gpgsign", "false")
            yield* git("add", "--all")
            yield* git("commit", "-q", "-m", "chore: release v1.0.0")
            yield* git("tag", "-a", "v1.0.0", "-m", "v1.0.0")
            const first = yield* git("rev-parse", "HEAD")
            yield* git("init", "-q", "--bare", ".git/origin.git")
            yield* git("remote", "add", "origin", ".git/origin.git")
            yield* git("push", "-q", "origin", "release/1.0", "v1.0.0")
            const asked = (checked: string, tag: string, branch = "release/1.0") =>
              Effect.map(
                repo.run("bash", ["-e", "-c", step], { env: { BRANCH: branch, CHECKED: checked, TAG: tag } }),
                (ran) => ran.code
              )
            const whileHead = yield* asked(first, "v1.0.0")
            const noSuchTag = yield* asked(first, "v1.0.9")
            const noSuchBranch = yield* asked(first, "v1.0.0", "release/9.9")
            // A later release of the line is pushed while the first waits for its approval.
            yield* git("commit", "-q", "--allow-empty", "-m", "chore: release v1.0.1")
            yield* git("tag", "-a", "v1.0.1", "-m", "v1.0.1")
            const second = yield* git("rev-parse", "HEAD")
            yield* git("push", "-q", "origin", "release/1.0", "v1.0.1")
            const replaced = yield* asked(first, "v1.0.0")
            const later = yield* asked(second, "v1.0.1")
            // The tag is moved off the commit that was checked.
            const movedTag = yield* asked(second, "v1.0.0")
            // A branch whose name only ends as the real one does, at the first release's commit: `git ls-remote`
            // lists it before the real one, and the first release still may not deploy. This case runs the branch
            // line's exact match; the one after it stops on the branch too, whatever its tag line reads.
            yield* git("push", "-q", "origin", `${first}:refs/heads/a/refs/heads/release/1.0`)
            yield* git("push", "-q", "origin", "v1.0.0:refs/tags/a/refs/tags/v1.0.1")
            const decoyBranch = yield* asked(first, "v1.0.0")
            const decoyTag = yield* asked(first, "v1.0.1")
            const laterStill = yield* asked(second, "v1.0.1")
            // The tag line's exact match, run: the branch's head is the commit checked, the real v1.0.0 is on the
            // older commit, and only a tag whose name ends as v1.0.0 does is on the head, listed first.
            yield* git("push", "-q", "origin", "v1.0.1:refs/tags/a/refs/tags/v1.0.0")
            const decoyTagAtHead = yield* asked(second, "v1.0.0")
            return [
              whileHead,
              noSuchTag,
              noSuchBranch,
              replaced,
              later,
              movedTag,
              decoyBranch,
              decoyTag,
              laterStill,
              decoyTagAtHead
            ]
          })
        )
        expect(seen).toEqual([0, 1, 1, 1, 0, 1, 1, 1, 0, 1])
      })
  )
})
