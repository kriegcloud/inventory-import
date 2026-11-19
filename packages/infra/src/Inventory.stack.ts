/**
 * The app's stack: one D1 database and one Worker that serves the API and the built screens, for the stage being
 * deployed. Everything that differs between stages comes from the stage's plan (`InfraStage`), never from the
 * stage's name read here.
 *
 * Must not break: production is never seeded and never answers on `workers.dev`; the sign-in secret is minted by
 * the stack and never written anywhere a person can read; a model key reaches only a stage whose plan names one.
 *
 * @packageDocumentation
 */
import * as Cloudflare from "@alchemy.run/cloudflare"
import * as Alchemy from "alchemy"
import * as A from "effect/Array"
import * as Config from "effect/Config"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as Path from "effect/Path"
import { InfraStage } from "./InfraStage.context.ts"
import type { SettingSource } from "./Stage.schema.ts"

/**
 * The model the app asks, and the one it falls back to. The same two values as `apps/inventory/wrangler.jsonc`,
 * which local development reads; a deployed stage reads these.
 */
const model = { AI_MODEL: "anthropic/claude-haiku-5.5", AI_FALLBACK_MODELS: "google/gemini-3.8-flash" } as const

/** The variable a plan names, when the deploy's environment holds it. A stage whose plan names none gets none. */
const secretFrom = Effect.fnUntraced(function* (source: SettingSource) {
  if (source.from === "nowhere") return O.none()
  return yield* Config.option(Config.Redacted(source.variable))
})

const textFrom = Effect.fnUntraced(function* (source: SettingSource) {
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
  { providers: Cloudflare.providers(), state: Cloudflare.state() },
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
    const modelKey = yield* secretFrom(plan.modelKey)
    const signUp = yield* textFrom(plan.signUp)

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
        ...O.match(signUp, { onNone: () => ({}), onSome: (emails) => ({ SIGN_UP: emails }) })
      }
    })

    return {
      stage: plan.stage,
      url: website.url,
      model: O.isSome(modelKey) ? "a model answers" : "the rules answer",
      signUp: O.isSome(signUp) ? "the named emails" : "closed"
    }
    // The stack is the entry point the CLI runs: this is where its one layer is provided.
    // @effect-diagnostics-next-line strictEffectProvide:off
  }).pipe(Effect.provide(InfraStage.layer))
)
