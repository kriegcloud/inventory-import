import * as O from "effect/Option"
import { D1 } from "@beep/d1/D1"
import { env, waitUntil } from "cloudflare:workers"
import * as ConfigProvider from "effect/ConfigProvider"
import * as Effect from "effect/Effect"
import * as FetchHttpClient from "effect/http/FetchHttpClient"
import * as Layer from "effect/Layer"
import { AddressLimit, CounterFailed } from "./AddressLimit.ts"
import { makeApp, toTracedServe } from "./App.ts"
import { RequestTelemetry } from "./RequestTelemetry.ts"
import { SessionIdentityLive } from "@inventory/access-host/SessionIdentity"
import { signIn } from "@inventory/access-host/SignIn"
import { collector } from "./Telemetry.ts"

// Cloudflare Worker entry: the app (App.ts) on the D1 binding, with every setting and secret read through one
// ConfigProvider built from this Worker's `env` (wrangler.jsonc `vars` and `.dev.vars` locally, the stack's `env`
// deployed). Nothing else reads `env`; bindings such as `DB` are passed here and nowhere else. Tracing that leaves
// the Worker (RequestTelemetry.ts) is built per request and finished under `waitUntil` after the answer. This file is
// the one place an Effect is run: the platform asks for a promise of each answer, and `waitUntil` takes a promise of
// the work after it.

const settings = ConfigProvider.layer(ConfigProvider.fromUnknown(env))

const app = makeApp({
  database: D1.layer({ db: env.DB }),
  // Sign-in: the actor comes from the session cookie (@inventory/access-host), and Better Auth answers /api/auth/*.
  identity: SessionIdentityLive,
  // Better Auth takes the D1 binding itself. Its work after an answer (rate-limit updates, cleanup) is handed to
  // `waitUntil`, so the answer does not wait for it and the Worker is not stopped before it is done.
  auth: signIn({
    database: env.DB,
    production: import.meta.env.PROD,
    backgroundTasks: O.some(waitUntil),
    rateLimit: true
  }),
  production: import.meta.env.PROD,
  docs: import.meta.env.DEV,
  // The coarse limit in front of sign-in and the model, on the rate-limit binding (30 a minute for each address).
  // The binding answers with the platform's promise: taken in here, and a failure of it lets the request on.
  limit: AddressLimit.counting((key) =>
    Effect.tryPromise({
      try: () => env.ABUSE_LIMIT.limit({ key }),
      catch: (cause) => CounterFailed.make({ cause })
    }).pipe(Effect.map((counted) => counted.success))
  ),
  // The one place the Worker's fetch is chosen: the collector's exporters and the browser's batches go through it.
  http: FetchHttpClient.layer
}).pipe(Layer.provide(settings))

const { serve } = toTracedServe({
  app,
  telemetry: RequestTelemetry.layer.pipe(
    Layer.provide(collector({ production: import.meta.env.PROD })),
    Layer.provide(FetchHttpClient.layer),
    Layer.provide(settings)
  ),
  afterAnswer: (work) => Effect.sync(() => waitUntil(work.pipe(Effect.runPromise)))
})

/** The Worker's request handler: every /api/* request, with the API's security headers on the way out. */
export default { fetch: (request) => Effect.runPromise(serve(request)) } satisfies ExportedHandler<Env>
