/**
 * The app's stack: one D1 database, the site's Worker that serves the API and the built screens, and the model's
 * Worker that hosts the app's models on Durable Objects (`@inventory/model-app`), bound to the site's Worker and
 * reached through it alone, for the stage being deployed. Everything that differs between stages comes from the
 * stage's plan (`InfraStage`), never from the stage's name read here.
 *
 * Must not break: production is never seeded and never answers on `workers.dev`; the sign-in secret is minted by
 * the stack and never written anywhere a person can read; a model key reaches only a stage whose plan names one; a
 * stage with test accounts never takes the repository's password for them, and no workflow log ever shows the one
 * it takes.
 *
 * @packageDocumentation
 */
import * as Cloudflare from "@alchemy.run/cloudflare"
import * as DomainCloudflare from "@alchemy.run/domain/Cloudflare"
import ModelWorker, { ModelWorkerEnv, modelWorkerEnv } from "@inventory/model-app/Worker"
import * as Alchemy from "alchemy"
import * as Secrets from "alchemy/Secrets"
import * as Output from "alchemy/Output"
import * as A from "effect/Array"
import * as Config from "effect/Config"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as O from "effect/Option"
import * as Path from "effect/Path"
import * as Redacted from "effect/Redacted"
import * as Result from "effect/Result"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import { NonBlankSecret } from "./internal/Secret.ts"
import { InfraStage } from "./InfraStage.context.ts"
import { secretNamesOf } from "./OpReferences.rules.ts"
import { opEnvReferences } from "./OpReferences.secrets.ts"
import type { StagePlan } from "./Stage.schema.ts"
import {
  accessEmailsFor,
  givenTestPassword,
  telemetryFor,
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
const modelIds = { AI_MODEL: "anthropic/claude-haiku-5.5", AI_FALLBACK_MODELS: "google/gemini-3.8-flash" } as const

/** A variable the deploy's environment holds, when it holds anything: a workflow sets a missing one to nothing. */
const secretOf = (variable: string) =>
  Config.Redacted(variable).pipe(
    Config.option,
    Config.map(O.filter((value) => value.pipe(Redacted.value, S.is(NonBlankSecret))))
  )

/** A variable's text, when it holds any: a workflow writes an unset GitHub variable as "". */
const textOf = Effect.fnUntraced(function* (variable: string) {
  const given = yield* Config.option(Config.String(variable))
  return O.filter(given, (text) => text !== "")
})

const textFrom = Effect.fnUntraced(function* (source: StagePlan["signUp"]) {
  if (source.from === "nowhere") return O.none()
  return yield* textOf(source.variable)
})

/**
 * What the app is made of, for the stage whose plan it is given: the database, the minted sign-in secret and the
 * Worker. The deployed stack below gives it a deployed stage's plan; the trial of `alchemy dev`
 * (`InventoryDev.stack.ts`) gives it a personal stage's, on a person's own machine.
 *
 * @category stacks
 */
export const inventory = Effect.gen(function* () {
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
  // Decision of 2026-11-26: a preview answers only the emails its environment's secret names, behind Cloudflare
  // Access, and stops without them. Read as a secret, so no log shows an email; no other stage reads the variable.
  const namedToOpen = plan.access.from === "nowhere" ? O.none() : yield* secretOf(plan.access.variable)
  const mayOpen = yield* Result.match(
    accessEmailsFor({ stage: plan.stage, source: plan.access, given: O.map(namedToOpen, Redacted.value) }),
    { onFailure: Effect.die, onSuccess: Effect.succeed }
  )

  // Decision of 2026-11-26: staging and production send Cloudflare's own traces and logs of the Worker to the
  // collector their environment names; with no address, and on every other stage, no destination is declared.
  const collectorAddress = plan.telemetry.to === "nowhere" ? O.none() : yield* textOf(plan.telemetry.address)
  const collectorHeader = plan.telemetry.to === "nowhere" ? O.none() : yield* secretOf(plan.telemetry.authorization)
  const sendsTo = yield* Result.match(
    telemetryFor({
      stage: plan.stage,
      source: plan.telemetry,
      address: collectorAddress,
      authorization: collectorHeader
    }),
    { onFailure: Effect.die, onSuccess: Effect.succeed }
  )
  const declareDestinations = Effect.fnUntraced(function* (collector: O.Option.Value<typeof sendsTo>) {
    const headers = R.getSomes({ authorization: collector.authorization })
    const traces = yield* Cloudflare.Workers.ObservabilityDestination("TelemetryTraces", {
      url: collector.traces,
      headers,
      logpushDataset: "opentelemetry-traces"
    })
    const logs = yield* Cloudflare.Workers.ObservabilityDestination("TelemetryLogs", {
      url: collector.logs,
      headers,
      logpushDataset: "opentelemetry-logs"
    })
    return O.some({ traces: traces.name, logs: logs.name })
  })
  const destinations = O.isSome(sendsTo) ? yield* declareDestinations(sendsTo.value) : O.none()

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

  // The model's Worker: no `workers.dev` address and no domain on any stage, so the binding below is the only way
  // in. Its Durable Objects keep the models' records, so a deploy that replaces it loses them. It is yielded before
  // the site's Worker, which binds it, so under `alchemy dev` it starts first: its own port (`apps/model/src/
  // Address.ts`) leaves Alchemy's default one to the site. It reads who a call acts as from the site's own sign-in
  // (host-03; Benjamin, 2026-11-26, "Model's Worker only"): the site's database, which stays declared here ("Stay in
  // packages/infra", 2026-11-27), the site's secret, and whether the site's cookie is a Secure one, which it is
  // exactly when the site's address is `https:`: on every deployed stage, and not under `alchemy dev`, where the site
  // answers on `http://localhost:1337`. The names they are bound under are the Worker's (`modelWorkerEnv`), never
  // written here, so neither side can rename one alone.
  const dev = yield* Alchemy.ALCHEMY_DEV
  const models = yield* ModelWorker.pipe(
    Effect.provideService(ModelWorkerEnv, modelWorkerEnv({ database, secret: signInSecret.text, secureCookies: !dev }))
  )

  const website = yield* Cloudflare.Website.Vite("Website", {
    rootDir: app,
    main: "src/server/worker.ts",
    // Written out: Better Auth's password hashing needs the flag, and Alchemy does not add it for this date.
    compatibility: { date: "2026-11-01", flags: ["nodejs_compat"] },
    assets: { notFoundHandling: "single-page-application", runWorkerFirst: ["/api/*"] },
    observability: O.match(destinations, {
      onNone: () => ({ enabled: true }),
      onSome: (to) => ({
        enabled: true,
        traces: { enabled: true, destinations: [to.traces] },
        logs: { enabled: true, invocationLogs: true, destinations: [to.logs] }
      })
    }),
    workersDev: plan.address.at === "workersDev",
    ...(plan.address.at === "hostname" ? { domain: { name: plan.address.hostname, zoneName: plan.address.zone } } : {}),
    // One Access application of the Worker's own, made and removed with it: the address and its version previews
    // ask for a login first, and only the named emails pass.
    ...O.match(mayOpen, {
      onNone: () => ({}),
      onSome: (emails) => ({
        access: { policies: [{ decision: "allow" as const, include: A.map(emails, (email) => ({ email })) }] }
      })
    }),
    env: {
      DB: database,
      // The service binding to the model's Worker, typed in the app's `env.d.ts`: the forwarding route a page reaches
      // the member Api by (host-04) and the allowance's gateway, which sends `TakeCall` to the server Api (usage-03),
      // both in the app's `src/server/Models.ts`. Without it the site runs the models in memory (`bun run dev` only).
      MODEL: models,
      // The coarse limit in front of sign-in and the model (the app's `AddressLimit.ts`): the same two numbers as
      // `wrangler.jsonc`. The namespace is one for the account, so the app keys each count by its own host.
      ABUSE_LIMIT: Cloudflare.RateLimit("ABUSE_LIMIT", { namespaceId: 1001, simple: { limit: 30, period: 60 } }),
      // Each stage trusts its own address; none is kept by hand.
      BETTER_AUTH_URL: Cloudflare.Worker.URL,
      BETTER_AUTH_SECRET: signInSecret.text,
      ...modelIds,
      ...R.getSomes({ OPENROUTER_API_KEY: modelKey }),
      ...R.getSomes({ TEST_ACCOUNT_PASSWORD: O.map(mintedPassword, (password) => password.text) }),
      ...R.getSomes({ TEST_ACCOUNT_PASSWORD: givenPassword }),
      ...R.getSomes({ SIGN_UP: signUp })
    }
  })

  return {
    stage: plan.stage,
    url: website.url,
    model: O.isSome(modelKey) ? "a model answers" : "the rules answer",
    signUp: O.isSome(signUp) ? "the named emails" : "closed",
    telemetry: O.isSome(sendsTo) ? "traces and logs go to the collector its environment names" : "kept in Cloudflare",
    opens: O.isSome(mayOpen) ? "for the named emails only, after Cloudflare Access" : "for anyone; sign-in is the lock",
    testAccountPassword: O.match(mintedPassword, {
      onNone: () =>
        O.isSome(givenPassword) ? "the one every preview shares; never shown" : "none: this stage has no test account",
      onSome: (password) =>
        inWorkflow
          ? "minted for this stage; not shown in a workflow's log"
          : hidden === "true"
            ? "minted for this stage; not shown in this run. Deploy the stage again yourself to read it"
            : Output.map(password.text, Redacted.value)
    })
  }
})

/**
 * The providers of every stack that deploys the app: Cloudflare's, and the library's for a model hosted on Durable
 * Objects (the backfill a deploy waits on while a new view or projection receives its history). Without the second,
 * a deploy of the model's Worker fails: no provider handles `Cloudflare.Domain.Backfill`
 * (`@alchemy.run/domain/src/Cloudflare/Providers.ts`).
 *
 * @category stacks
 */
export const stackProviders = Layer.mergeAll(Cloudflare.providers(), DomainCloudflare.providers())

/**
 * The app, for one stage: `bunx alchemy deploy --stage <name>` from the repository root.
 *
 * @category stacks
 */
export default Alchemy.Stack(
  "inventory",
  {
    providers: stackProviders,
    state: Cloudflare.state(),
    // What a stage's plan names as a secret is asked of 1Password from a workstation; a workflow's job is given
    // its own. A `.env` at the root is still read first, as before this option was set.
    secrets: [
      Secrets.DotEnv(),
      opEnvReferences((stage) => Result.match(planFor(stage), { onFailure: () => [], onSuccess: secretNamesOf }))
    ]
  },
  // The stack is the entry point the CLI runs: this is where the plan of its stage is given.
  inventory.pipe(InfraStage.provided)
)
