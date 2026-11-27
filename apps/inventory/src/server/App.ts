import type { D1 } from "@beep/d1/D1"
import * as Digest from "effect/crypto/Digest"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as ManagedRuntime from "effect/ManagedRuntime"
import type * as HttpClient from "effect/http/HttpClient"
import * as HttpRouter from "effect/http/HttpRouter"
import * as HttpServer from "effect/http/HttpServer"
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder"
import * as HttpApiMiddleware from "effect/http-api/HttpApiMiddleware"
import * as HttpApiScalar from "effect/http-api/HttpApiScalar"
import { AccessLive } from "@inventory/access-host/Host"
import { SignInRoute } from "@inventory/access-host/SignIn"
import type { Identity } from "@inventory/kernel/Identity"
import type { SessionLookup } from "@inventory/kernel/SessionLookup"
import type * as SqlClient from "effect/sql/SqlClient"
import { Api, docsPath, openApiPath } from "../api/v1/Api.ts"
import { sessionCookieScheme } from "../api/v1/Document.ts"
import type { OpenRouter } from "@beep/openrouter/OpenRouter"
import { ModelLive } from "./Model.ts"
import type { BetterAuth } from "@beep/better-auth/BetterAuth"
import { Handlers } from "./handlers.ts"
import { CatalogLive } from "@inventory/catalog-host/Host"
import * as Observability from "./Observability.ts"
import { RequestTelemetry } from "./RequestTelemetry.ts"
import { type AddressLimit, LimitedByAddress } from "./AddressLimit.ts"
import { SameOriginLive } from "./SameOrigin.ts"
import { ModelAllowanceOverUsage, type Models } from "./Models.ts"
import { ModelRoute } from "./ModelRoute.ts"
import { unsecuredAnswer, withSecurityHeaders } from "./security.ts"
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
 * The HttpApi with its OpenAPI document, Better Auth's routes at /api/auth/* beside it (@inventory/access-host/SignIn),
 * the route a page reaches the models by (/api/model/*, ModelRoute.ts), and the middleware every request passes
 * through, needing the services and `BetterAuth`. `identity` is the `Identity` middleware's
 * implementation: the caller chooses it (worker.ts passes `SessionIdentityLive`, which reads the session; the tests
 * pass the header identity, `IdentityLive`), so this file never pulls one into a build.
 */
export const makeRoutes = <E, R>(options: {
  readonly docs: boolean
  readonly identity: Layer.Layer<Identity, E, R>
  /** The coarse limit's counter (AddressLimit.ts): the Worker's binding, or none in a test that is not about it. */
  readonly limit: Layer.Layer<AddressLimit>
}) =>
  Layer.mergeAll(
    HttpApiBuilder.layer(Api, { openapiPath: openApiPath }),
    SignInRoute,
    options.docs ? DocsRoute : Layer.empty,
    OtlpProxyRoute,
    ModelRoute,
    RequestMetrics,
    LimitedByAddress.pipe(Layer.provide(options.limit))
  ).pipe(
    Layer.provide(Handlers),
    Layer.provide(options.identity),
    Layer.provide(SameOriginLive),
    Layer.provide(HttpApiMiddleware.layerProblemDetails({ includeDetails: true }))
  )

/**
 * Every service the handlers use, on a given model service, the app's models and the one session lookup: the Worker
 * passes `ModelLive` (its key), the models where they run (over the binding, or in memory under `bun run dev`) and
 * `SessionLookupLive`; the tests none or a scripted model, the models in memory and the header lookup. Built once and
 * shared by the Worker and the tests, so a service added here is added everywhere.
 */
export const servicesWith = <E, R, ME, MR, SE, SR>(options: {
  readonly ai: Layer.Layer<OpenRouter, E, R>
  readonly production: boolean
  /** Where the app's models run (`Models.ts`): over the service binding, or in this Worker's memory. */
  readonly models: Layer.Layer<Models, ME, MR>
  /** The one session lookup: what the forwarding route checks a live read's address by, and the memory host reads. */
  readonly sessions: Layer.Layer<SessionLookup, SE, SR>
}) => {
  // The access context (its ports on D1 and the session answer) and the model.
  const base = Layer.mergeAll(AccessLive(options), options.ai)
  // The app's models, the session lookup beside them, and the gateway to the day's model allowance through them.
  const reach = options.models.pipe(Layer.provideMerge(options.sessions), Layer.provide(base))
  const gateway = ModelAllowanceOverUsage.pipe(Layer.provide(reach))
  // The catalog: its two stores on D1, and suggestions and the table assistant, which use the model and the allowance.
  return Layer.mergeAll(base, reach, gateway, CatalogLive.pipe(Layer.provide(Layer.merge(base, gateway))))
}

/**
 * The whole app on a given database, identity and sign-in. Settings come from the ConfigProvider the caller provides
 * (src/server/Settings.ts).
 * `production` picks the log format's default and the sign-in defaults; `docs` mounts the API reference page; `auth`
 * is Better Auth on the D1 binding (`signIn` in SignIn.ts), which the identity, the session answer and /api/auth/* share;
 * `http` is how it reaches the collector, so a test can answer for it without the network.
 */
export const makeApp = <E, R, IE, IR, AE, AR, ME, MR, SE, SR>(options: {
  readonly database: Layer.Layer<D1 | SqlClient.SqlClient, E, R>
  readonly identity: Layer.Layer<Identity, IE, IR>
  readonly auth: Layer.Layer<BetterAuth, AE, AR>
  readonly production: boolean
  readonly docs: boolean
  /** How the app reaches other services (the collector): fetch in the Worker. */
  readonly http: Layer.Layer<HttpClient.HttpClient>
  /** The coarse limit in front of sign-in and the model: the Worker's rate-limit binding (AddressLimit.ts). */
  readonly limit: Layer.Layer<AddressLimit>
  /** Where the app's models run (`Models.ts`), chosen by worker.ts. */
  readonly models: Layer.Layer<Models, ME, MR>
  /** The one session lookup (`SessionLookupLive` in the Worker). */
  readonly sessions: Layer.Layer<SessionLookup, SE, SR>
}) =>
  makeRoutes({ docs: options.docs, identity: options.identity, limit: options.limit }).pipe(
    Layer.provide(options.http),
    Layer.provide(
      servicesWith({
        ai: ModelLive,
        production: options.production,
        models: options.models,
        sessions: options.sessions
      })
    ),
    Layer.provide(options.auth),
    Layer.provide(options.database),
    Layer.provide(HttpServer.layerServices),
    // Merged, not just provided: the logger, log level and error reporter must be in the context requests run in.
    Layer.provideMerge(Observability.layer({ production: options.production })),
    Layer.provideMerge(HttpTracing)
  )

/**
 * The app as the Worker's entry runs it: `serve` answers one request, `dispose` closes the app's layer. Both are
 * Effects, so nothing here runs one: the entry (worker.ts) does, and a test yields them.
 */
export type Served = {
  readonly serve: (request: Request) => Effect.Effect<Response>
  readonly dispose: Effect.Effect<void>
}

/**
 * The response with the API's security headers. If the API reference page cannot be read to hash its scripts, the
 * answer is a 500 that still carries them: nothing leaves without the headers.
 */
const secured = (request: Request) => (response: Response) =>
  withSecurityHeaders(response, request).pipe(
    Effect.catch((cause) =>
      Effect.logError("The response could not be given its security headers", cause).pipe(Effect.as(unsecuredAnswer()))
    )
  )

/**
 * `answer` served in the services of `edge` (the hashing the headers need, and whatever `answer` asks for), each
 * response secured; `dispose` closes the router's layer and `edge`.
 */
const servedIn = <R, ER>(
  edge: ManagedRuntime.ManagedRuntime<R | Digest.Digest, ER>,
  answer: (request: Request) => Effect.Effect<Response, never, R>,
  dispose: Effect.Effect<void>
): Served => ({
  serve: (request) =>
    edge.contextEffect.pipe(
      Effect.flatMap((context) => Effect.provideContext(Effect.flatMap(answer(request), secured(request)), context)),
      Effect.orDie
    ),
  dispose: Effect.all([dispose, edge.disposeEffect], { concurrency: "unbounded", discard: true })
})

/**
 * The app served: every response leaves with the API's security headers. The router's web handler is a promise, the
 * library's edge, taken in here; it answers every request, failures included, so it never rejects.
 */
export const toServe = <E>(app: Layer.Layer<never, E, HttpRouter.HttpRouter>): Served => {
  const memoMap = Layer.makeMemoMapUnsafe()
  const { dispose, handler } = HttpRouter.toWebHandler(app, { memoMap })
  const edge = ManagedRuntime.make(Digest.layerWebCrypto, { memoMap })
  return servedIn(
    edge,
    (request) => Effect.promise(() => handler(request)),
    Effect.promise(() => dispose())
  )
}

/**
 * The Worker's app: `toServe`, and each request also runs with its own tracing (RequestTelemetry.ts: Effect DevTools
 * in development when EFFECT_DEVTOOLS_URL is set), finished after the answer by `afterAnswer`, which the entry hands to
 * the platform's `waitUntil`. Off, the default, it builds nothing and adds no wait.
 */
export const toTracedServe = <E, TE>(options: {
  readonly app: Layer.Layer<never, E, HttpRouter.HttpRouter>
  readonly telemetry: Layer.Layer<RequestTelemetry, TE>
  readonly afterAnswer: (work: Effect.Effect<void>) => Effect.Effect<void>
}): Served => {
  const memoMap = Layer.makeMemoMapUnsafe()
  const { dispose, handler } = HttpRouter.toWebHandler(options.app, { memoMap })
  const edge = ManagedRuntime.make(Layer.merge(options.telemetry, Digest.layerWebCrypto), { memoMap })
  const answer = Effect.fnUntraced(function* (request: Request) {
    const telemetry = yield* RequestTelemetry
    const scope = yield* telemetry.begin
    const response = yield* Effect.promise(() => handler(request, scope.context))
    // After the answer: finish this request's tracing, inside this request, so the runtime lets its I/O through.
    yield* options.afterAnswer(scope.done)
    return response
  })
  return servedIn(
    edge,
    answer,
    Effect.promise(() => dispose())
  )
}
