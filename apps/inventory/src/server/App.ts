import type { D1 } from "@beep/d1/D1"
import { Effect, Layer, ManagedRuntime } from "effect"
import { HttpRouter, HttpServer } from "effect/http"
import { HttpApiBuilder, HttpApiMiddleware, HttpApiScalar } from "effect/http-api"
import type { Identity } from "@inventory/kernel/Identity"
import type { SqlClient } from "effect/sql"
import { Api, docsPath, openApiPath } from "../api/v1/Api.ts"
import { sessionCookieScheme } from "../api/v1/Document.ts"
import { Activities } from "./Activities.ts"
import type { OpenRouter } from "@beep/openrouter/OpenRouter"
import { ModelLive } from "./Model.ts"
import type { BetterAuth } from "@beep/better-auth/BetterAuth"
import { Handlers } from "./handlers.ts"
import { Imports } from "./Imports.ts"
import { Members } from "./Members.ts"
import { ModelCalls } from "./ModelCalls.ts"
import * as Observability from "./Observability.ts"
import { RequestTelemetry } from "./RequestTelemetry.ts"
import { SameOriginLive } from "./SameOrigin.ts"
import { SignInRoute } from "./SignIn.ts"
import { withSecurityHeaders } from "./security.ts"
import { People } from "./People.ts"
import { Items } from "./Items.ts"
import { Sessions } from "./SessionIdentity.ts"
import { Suggestions } from "./Suggestions.ts"
import { TableAssistant } from "./TableAssistant.ts"
import { HttpTracing, OtlpProxyRoute, RequestMetrics } from "./Telemetry.ts"

// The app as layers, without the Cloudflare runtime: worker.ts gives it the D1 binding and the environment, and the
// tests give it a test database and their own settings. One Layer is built for the life of the isolate:
// routes <- handlers <- services <- database, sign-in, model clients and settings.

/**
 * How the reference page is set up. Every option is one Scalar reads; none loads anything from another origin.
 *
 * - `withDefaultFonts: false`: no font request, so the page stays one request.
 * - `showDeveloperTools: "never"`: Scalar's top bar ("Share", "Generate SDKs", its AI tools) sends the document to
 *   scalar.com, which the page's policy (`connect-src 'self'`, security.ts) blocks, so the buttons would be dead
 *   ends. The fix that keeps the policy is to hide the bar, not to widen it. Effect's `ScalarConfig` does not list
 *   the option; the bundled Scalar reads it (default "localhost"), and the object is passed to it as it is.
 * - `showOperationId`: the id is what the browser's client calls (`api.imports.takeBack`).
 * - `defaultOpenAllTags`: seven groups and 29 operations read as one page, and the browser's own find works.
 * - `favicon`: the app's, from this origin.
 * - `authentication`: the session cookie is the one scheme (`sessionCookieScheme`, Document.ts). On "Send", Scalar
 *   logs a console warning that it is "trying to add a Cookie header": it does that for any scheme sent in a cookie,
 *   with this option or without it, and a browser never lets a page set that header. The request still carries the
 *   real session cookie, which the browser adds itself, so "Try it" works; the warning is Scalar's, and harmless.
 */
const scalarOptions = {
  withDefaultFonts: false,
  showDeveloperTools: "never",
  showOperationId: true,
  defaultOpenAllTags: true,
  favicon: "/favicon.svg",
  authentication: { preferredSecurityScheme: sessionCookieScheme }
}

/**
 * The API reference page (Scalar) at /api/v1/docs, in a development build only. Decided here, at module level, so a
 * production build drops it and the 3 MB Scalar bundle with it: production serves the OpenAPI document and no page.
 * Its bundled script, not `HttpApiScalar.layerCdn`, which loads an unpinned script from a CDN with no integrity
 * check; the page's own content security policy is in security.ts.
 */
export const DocsRoute = import.meta.env.DEV
  ? HttpApiScalar.layer(Api, { path: docsPath, scalar: scalarOptions })
  : Layer.empty

/**
 * The HttpApi with its OpenAPI document, Better Auth's routes at /api/auth/* beside it (SignIn.ts), and the middleware
 * every request passes through, needing the services and `BetterAuth`. `identity` is the `Identity` middleware's
 * implementation: the caller chooses it (worker.ts passes `SessionIdentityLive`, which reads the session; the tests
 * pass the header identity, `IdentityLive`), so this file never pulls one into a build.
 */
export const makeRoutes = <E, R>(options: { readonly docs: boolean; readonly identity: Layer.Layer<Identity, E, R> }) =>
  Layer.mergeAll(
    HttpApiBuilder.layer(Api, { openapiPath: openApiPath }),
    SignInRoute,
    options.docs ? DocsRoute : Layer.empty,
    OtlpProxyRoute,
    RequestMetrics
  ).pipe(
    Layer.provide(Handlers),
    Layer.provide(options.identity),
    Layer.provide(SameOriginLive),
    Layer.provide(HttpApiMiddleware.layerProblemDetails({ includeDetails: true }))
  )

/**
 * Every service the handlers use, on a given model service: the Worker passes `ModelLive` (its key), the tests none
 * or a scripted model. Built once and shared by the Worker and the tests, so a service added here is added everywhere.
 */
export const servicesWith = <E, R>(ai: Layer.Layer<OpenRouter, E, R>) => {
  const storage = Layer.mergeAll(
    Activities.layer,
    Members.layer,
    Imports.layer,
    Items.layer,
    People.layer,
    ModelCalls.layer,
    ai
  )
  // The table assistant and the import's suggestions use the model and the day's allowance; everything else uses
  // storage only.
  return Layer.mergeAll(
    storage,
    TableAssistant.layer.pipe(Layer.provide(storage)),
    Suggestions.layer.pipe(Layer.provide(storage))
  )
}

/** Every service the handlers use, with the model the settings allow. */
export const Services = servicesWith(ModelLive)

/**
 * The whole app on a given database, identity and sign-in. Settings come from the ConfigProvider the caller provides
 * (src/server/Settings.ts).
 * `production` picks the log format's default and the sign-in defaults; `docs` mounts the API reference page; `auth`
 * is Better Auth on the D1 binding (`signIn` in SignIn.ts), which the identity, the session answer and /api/auth/* share.
 */
export const makeApp = <E, R, IE, IR, AE, AR>(options: {
  readonly database: Layer.Layer<D1 | SqlClient.SqlClient, E, R>
  readonly identity: Layer.Layer<Identity, IE, IR>
  readonly auth: Layer.Layer<BetterAuth, AE, AR>
  readonly production: boolean
  readonly docs: boolean
}) =>
  makeRoutes({ docs: options.docs, identity: options.identity }).pipe(
    Layer.provide(Sessions.layer({ production: options.production })),
    Layer.provide(Services),
    Layer.provide(options.auth),
    Layer.provide(options.database),
    Layer.provide(HttpServer.layerServices),
    // Merged, not just provided: the logger, log level and error reporter must be in the context requests run in.
    Layer.provideMerge(Observability.layer({ production: options.production })),
    Layer.provideMerge(HttpTracing)
  )

/** A `fetch` for the app: every response leaves with the API's security headers. `dispose` closes the app's layer. */
export const toFetch = <E>(app: Layer.Layer<never, E, HttpRouter.HttpRouter>) => {
  const { dispose, handler } = HttpRouter.toWebHandler(app)
  return {
    fetch: (request: Request): Promise<Response> => handler(request).then(withSecurityHeaders(request)),
    dispose
  }
}

/**
 * The Worker's `fetch`: `toFetch`, and each request also runs with its own tracing (RequestTelemetry.ts: Effect
 * DevTools in development when EFFECT_DEVTOOLS_URL is set), finished after the answer under `waitUntil`. Off, the
 * default, it builds nothing and adds no wait.
 */
export const toTracedFetch = <E, TE>(options: {
  readonly app: Layer.Layer<never, E, HttpRouter.HttpRouter>
  readonly telemetry: Layer.Layer<RequestTelemetry, TE>
  readonly waitUntil: (promise: Promise<unknown>) => void
}) => {
  const memoMap = Layer.makeMemoMapUnsafe()
  const { dispose, handler } = HttpRouter.toWebHandler(options.app, { memoMap })
  const edge = ManagedRuntime.make(options.telemetry, { memoMap })
  const serve = Effect.fnUntraced(function* (request: Request) {
    const telemetry = yield* RequestTelemetry
    const scope = yield* telemetry.begin
    const response = yield* Effect.promise(() => handler(request, scope.context))
    // After the answer: finish this request's tracing, inside this request, so the runtime lets its I/O through.
    yield* Effect.sync(() => options.waitUntil(edge.runPromise(scope.done)))
    return response
  })
  return {
    fetch: (request: Request): Promise<Response> => edge.runPromise(serve(request)).then(withSecurityHeaders(request)),
    dispose: () => Promise.all([dispose(), edge.dispose()]).then(() => undefined)
  }
}
