import { D1 } from "@beep/d1/D1"
import { env, waitUntil } from "cloudflare:workers"
import * as ConfigProvider from "effect/ConfigProvider"
import * as Layer from "effect/Layer"
import { makeApp, toTracedFetch } from "./App.ts"
import { RequestTelemetry } from "./RequestTelemetry.ts"
import { SessionIdentityLive } from "@inventory/access-host/SessionIdentity"
import { signIn } from "@inventory/access-host/SignIn"
import { collector } from "./Telemetry.ts"

// Cloudflare Worker entry: the app (App.ts) on the D1 binding, with every setting and secret read through one
// ConfigProvider built from this Worker's `env` (wrangler.jsonc `vars` and `.dev.vars` locally, the stack's `env`
// deployed). Nothing else reads `env`; bindings such as `DB` are passed here and nowhere else. Tracing that leaves
// the Worker (RequestTelemetry.ts) is built per request and finished under `waitUntil` after the answer.

const settings = ConfigProvider.layer(ConfigProvider.fromUnknown(env))

const app = makeApp({
  database: D1.layer({ db: env.DB }),
  // Sign-in: the actor comes from the session cookie (@inventory/access-host), and Better Auth answers /api/auth/*.
  identity: SessionIdentityLive,
  // Better Auth takes the D1 binding itself. Its work after an answer (rate-limit updates, cleanup) is handed to
  // `waitUntil`, so the answer does not wait for it and the Worker is not stopped before it is done.
  auth: signIn({ database: env.DB, production: import.meta.env.PROD, backgroundTasks: waitUntil }),
  production: import.meta.env.PROD,
  docs: import.meta.env.DEV
}).pipe(Layer.provide(settings))

const { fetch } = toTracedFetch({
  app,
  telemetry: RequestTelemetry.layer.pipe(
    Layer.provide(collector({ production: import.meta.env.PROD })),
    Layer.provide(settings)
  ),
  waitUntil
})

/** The Worker's request handler: every /api/* request, with the API's security headers on the way out. */
export default { fetch } satisfies ExportedHandler<Env>
