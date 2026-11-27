/**
 * What the model's Worker is bound to beyond its own Durable Objects, as the stack hands it: the site's D1 database
 * (`DB`), the site's sign-in secret (`BETTER_AUTH_SECRET`) and whether the site's cookie is a Secure one
 * (`BETTER_AUTH_SECURE_COOKIES`). The database stays declared in the stack (Benjamin, 2026-11-27, "Stay in
 * packages/infra"), which binds it to both Workers, so this app never declares it and never imports the stack: the
 * stack provides `ModelWorkerEnv` when it yields the Worker (`packages/infra/src/Inventory.stack.ts`). A Worker started
 * from its bundle reads its bindings from its own `env`, not from these props, so there the reference keeps its empty
 * default.
 *
 * The one thing not to break: the names here are the names the stack binds, and the names the Worker reads
 * (`boundDatabase` and `SignIn.ts`'s settings). A name that differs reads nothing, and every call fails, so the stack
 * names none of them: it hands its values to `modelWorkerEnv`.
 *
 * @packageDocumentation
 */
import type * as Cloudflare from "@alchemy.run/cloudflare"
import type { D1Database } from "@cloudflare/workers-types"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as P from "effect/Predicate"
import * as R from "effect/Record"

/** The binding the site's D1 database is under, on this Worker as on the site's. */
export const databaseBinding = "DB"

/** The setting the site's signing secret is under, on this Worker as on the site's (`SignIn.ts` reads it). */
export const secretBinding = "BETTER_AUTH_SECRET"

/** The setting that says whether the site's cookie is a Secure one (`SignIn.ts` reads it): `"true"` or `"false"`. */
export const secureCookiesBinding = "BETTER_AUTH_SECURE_COOKIES"

/**
 * The bindings the stack hands this Worker, under the names this Worker reads: the stack gives the values, never the
 * names, so a binding cannot be renamed on one side only.
 *
 * **Example** (In the stack, as it yields the Worker)
 *
 * ```ts
 * ModelWorker.pipe(
 *   Effect.provideService(ModelWorkerEnv, modelWorkerEnv({ database, secret: signInSecret.text, secureCookies: !dev }))
 * )
 * ```
 *
 * @category constructors
 */
export const modelWorkerEnv = (bound: {
  readonly database: Cloudflare.WorkerBindingResource
  readonly secret: Cloudflare.WorkerBindingResource
  readonly secureCookies: boolean
}): Cloudflare.WorkerBindingProps => ({
  [databaseBinding]: bound.database,
  [secretBinding]: bound.secret,
  [secureCookiesBinding]: bound.secureCookies ? "true" : "false"
})

/**
 * The bindings the stack gives the model's Worker, by name: none unless the stack provides them, as it does when it
 * declares the Worker.
 *
 * @category references
 */
export const ModelWorkerEnv = Context.Reference<Cloudflare.WorkerBindingProps>(
  "@inventory/model-app/Bindings/ModelWorkerEnv",
  { defaultValue: () => ({}) }
)

/**
 * The Worker's props with the stack's bindings as its `env`.
 *
 * @category behaviour
 */
export const bindingsFromStack = Effect.fnUntraced(function* <Props extends object>(props: Props) {
  const env = yield* ModelWorkerEnv
  return { ...props, env }
})

/** A D1 binding as workerd hands it: an object that prepares statements and runs a batch. */
const isD1Database = (binding: unknown): binding is D1Database =>
  P.hasProperty(binding, "prepare") && P.hasProperty(binding, "batch")

/**
 * The site's D1 database from the Worker's `env`, read in each execution, since a Worker's `env` is filled once it
 * runs. A Worker the stack did not bind it to has none: a fault of the deploy, not of the request, so the call ends
 * as a 500.
 *
 * @category behaviour
 */
export const boundDatabase = (env: Readonly<Record<string, unknown>>) =>
  Effect.suspend(() =>
    O.match(O.filter(R.get(env, databaseBinding), isD1Database), {
      onNone: () => Effect.die(`The model's Worker has no D1 database bound as ${databaseBinding}.`),
      onSome: Effect.succeed
    })
  )
