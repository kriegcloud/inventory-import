/**
 * The app's stack: one D1 database and one Worker that serves the API and the built screens, for the stage being
 * deployed. Everything that differs between stages comes from the stage's plan (`InfraStage`), never from the
 * stage's name read here.
 *
 * Must not break: production is never seeded and never answers on `workers.dev`; the sign-in secret is minted by
 * the stack and never written anywhere a person can read; a model key reaches only a stage whose plan names one; a
 * stage with test accounts never takes the repository's password for them, and no workflow log ever shows the one
 * it takes.
 *
 * @packageDocumentation
 */
import * as Cloudflare from "@alchemy.run/cloudflare"
import * as Alchemy from "alchemy"
import * as Secrets from "alchemy/Secrets"
import * as Output from "alchemy/Output"
import * as A from "effect/Array"
import * as Config from "effect/Config"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as Path from "effect/Path"
import * as Redacted from "effect/Redacted"
import * as Result from "effect/Result"
import * as Str from "effect/String"
import { InfraStage } from "./InfraStage.context.ts"
import { secretNamesOf } from "./OpReferences.rules.ts"
import { opEnvReferences } from "./OpReferences.secrets.ts"
import type { StagePlan } from "./Stage.schema.ts"
import {
  givenTestPassword,
  modelKeyFor,
  previewPasswordVariable,
  testPasswordOf,
  planFor,
  withoutModelKeyFlag
} from "./StagePlan.rules.ts"

/**
 * The model the app asks, and the one it falls back to. The same two values as `apps/inventory/wrangler.jsonc`,
 * which local development reads; a deployed stage reads these.
 */
const model = { AI_MODEL: "anthropic/claude-haiku-5.5", AI_FALLBACK_MODELS: "google/gemini-3.8-flash" } as const

/** A variable the deploy's environment holds, when it holds anything: a workflow sets a missing one to nothing. */
const secretOf = (variable: string) =>
  Config.Redacted(variable).pipe(
    Config.option,
    Config.map(O.filter((value) => value.pipe(Redacted.value, Str.trim) !== ""))
  )

const textFrom = Effect.fnUntraced(function* (source: StagePlan["signUp"]) {
  if (source.from === "nowhere") return O.none()
  return yield* Config.option(Config.String(source.variable))
})

/**
 * The app, for one stage: `bunx alchemy deploy --stage <name>` from the repository root.
 *
 * @category stacks
 */
export default Alchemy.Stack(
  "inventory",
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
    // What a stage's plan names as a secret is asked of 1Password from a workstation; a workflow's job is given
    // its own. A `.env` at the root is still read first, as before this option was set.
    secrets: [
      Secrets.DotEnv(),
      opEnvReferences((stage) => Result.match(planFor(stage), { onFailure: () => [], onSuccess: secretNamesOf }))
    ]
  },
  Effect.gen(function* () {
    const plan = yield* InfraStage
    const path = yield* Path.Path
    const app = path.resolve(import.meta.dirname, "../../../apps/inventory")

    const database = yield* Cloudflare.D1.Database("Database", {
      migrations: path.join(app, "migrations"),
      importFiles: A.map(plan.seeds, (seed) => path.join(app, "seeds", `${seed}.sql`))
    })

    // Decision I3: minted once and kept in Alchemy's state. Losing the state signs every person out.
    const signInSecret = yield* Alchemy.Random("SignInSecret", { bytes: 32 })
    // Decision "infra, a missing model key": a stage whose plan names a key stops without one, unless the flag
    // says it is meant. A stage whose plan names none never reads the variable.
    const given = plan.modelKey.from === "nowhere" ? O.none() : yield* secretOf(plan.modelKey.variable)
    const onPurpose = yield* Config.String(withoutModelKeyFlag).pipe(Config.withDefault(""))
    const modelKey = yield* Result.match(
      modelKeyFor({ stage: plan.stage, source: plan.modelKey, key: given, withoutOnPurpose: onPurpose === "true" }),
      { onFailure: Effect.die, onSuccess: Effect.succeed }
    )
    const signUp = yield* textFrom(plan.signUp)

    // The test accounts of a deployed stage never take the password written in the repository. A test stage mints
    // its own, kept in state. A preview is given the one every preview shares and stops without it.
    const passwordFrom = testPasswordOf(plan)
    const mintTestPassword = Effect.fnUntraced(function* () {
      const minted = yield* Alchemy.Random("TestAccountPassword", { bytes: 12 })
      return O.some(minted)
    })
    const readGivenPassword = Effect.fnUntraced(function* () {
      const given = yield* secretOf(previewPasswordVariable)
      const password = yield* Result.match(givenTestPassword({ stage: plan.stage, given }), {
        onFailure: Effect.die,
        onSuccess: Effect.succeed
      })
      return O.some(password)
    })
    const mintedPassword = passwordFrom === "minted" ? yield* mintTestPassword() : O.none()
    const givenPassword = passwordFrom === "given" ? yield* readGivenPassword() : O.none()
    // A workflow's log is public, so a minted password is shown only to a person deploying from their own machine.
    const inWorkflow = yield* Config.Boolean("CI").pipe(Config.withDefault(false))
    // The setup command hands its terminal to the deploy, and a terminal is not proof of a person: it asks for the
    // password to be left out, and its owner reads it with a deploy of his own (`goals/infra/PLAN.md`).
    const hidden = yield* Config.String("HIDE_TEST_ACCOUNT_PASSWORD").pipe(Config.withDefault(""))

    const website = yield* Cloudflare.Website.Vite("Website", {
      rootDir: app,
      main: "src/server/worker.ts",
      // Written out: Better Auth's password hashing needs the flag, and Alchemy does not add it for this date.
      compatibility: { date: "2026-11-01", flags: ["nodejs_compat"] },
      assets: { notFoundHandling: "single-page-application", runWorkerFirst: ["/api/*"] },
      observability: { enabled: true },
      workersDev: plan.address.at === "workersDev",
      ...(plan.address.at === "hostname"
        ? { domain: { name: plan.address.hostname, zoneName: plan.address.zone } }
        : {}),
      env: {
        DB: database,
        // Each stage trusts its own address; none is kept by hand.
        BETTER_AUTH_URL: Cloudflare.Worker.URL,
        BETTER_AUTH_SECRET: signInSecret.text,
        ...model,
        ...O.match(modelKey, { onNone: () => ({}), onSome: (key) => ({ OPENROUTER_API_KEY: key }) }),
        ...O.match(mintedPassword, {
          onNone: () => ({}),
          onSome: (password) => ({ TEST_ACCOUNT_PASSWORD: password.text })
        }),
        ...O.match(givenPassword, {
          onNone: () => ({}),
          onSome: (password) => ({ TEST_ACCOUNT_PASSWORD: password })
        }),
        ...O.match(signUp, { onNone: () => ({}), onSome: (emails) => ({ SIGN_UP: emails }) })
      }
    })

    return {
      stage: plan.stage,
      url: website.url,
      model: O.isSome(modelKey) ? "a model answers" : "the rules answer",
      signUp: O.isSome(signUp) ? "the named emails" : "closed",
      testAccountPassword: O.match(mintedPassword, {
        onNone: () =>
          O.isSome(givenPassword)
            ? "the one every preview shares; never shown"
            : "none: this stage has no test account",
        onSome: (password) =>
          inWorkflow
            ? "minted for this stage; not shown in a workflow's log"
            : hidden === "true"
              ? "minted for this stage; not shown in this run. Deploy the stage again yourself to read it"
              : Output.map(password.text, Redacted.value)
      })
    }
    // The stack is the entry point the CLI runs: this is where the plan of its stage is given.
  }).pipe(InfraStage.provided)
)
