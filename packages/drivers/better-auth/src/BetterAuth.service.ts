/**
 * Better Auth as an Effect service: built once per isolate from the host's settings and options, its HTTP handler,
 * and a typed session lookup. What Better Auth is configured to do (roles, hooks, rate limits, cookies) is the host's;
 * the secret policy, the spans and the error channel are this driver's.
 *
 * Every call into Better Auth is a span (`BetterAuth.handle`, `BetterAuth.session`) carrying the endpoint and the
 * answer's status, never an email, a password or a cookie.
 *
 * The full `better-auth`, not `better-auth/minimal`: minimal cannot take a direct database connection ("Direct database
 * connection requires Kysely") and has no migration planner, and a host hands Better Auth its D1 binding itself (Better
 * Auth builds its own Kysely D1 dialect from it). Minimal would mean an ORM adapter and a second schema.
 *
 * @packageDocumentation
 */
import { type BetterAuthOptions, betterAuth } from "better-auth"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as O from "effect/Option"
import * as Redacted from "effect/Redacted"
import * as S from "effect/Schema"
import * as SecureRandom from "effect/crypto/SecureRandom"
import * as Base64 from "effect/encoding/Base64"
import * as HttpRouter from "effect/http/HttpRouter"
import * as HttpServerRequest from "effect/http/HttpServerRequest"
import * as HttpServerResponse from "effect/http/HttpServerResponse"
import type { BetterAuthSettings } from "./BetterAuth.config.ts"
import { BetterAuthConfigError, BetterAuthError } from "./BetterAuth.errors.ts"
import {
  AuthDriverOptions,
  AuthSecret,
  type AuthSession,
  authEndpointOf,
  authSessionOf,
  resolveAuthSecret
} from "./BetterAuth.schema.ts"
import { $BetterAuthId } from "./internal/identity.ts"

const $I = $BetterAuthId.create("BetterAuth")

/**
 * What the driver resolved from the settings, handed to the host's options: the secret to sign with, the public
 * origin (none: each request's own), and whether cookies are Secure (a production build, or an `https:` address).
 *
 * @category models
 */
export interface ResolvedAuth {
  readonly secret: string
  readonly baseURL: O.Option<string>
  readonly secureCookies: boolean
}

/** A random secret for a development process: 32 bytes from the platform's crypto, with a warning. */
const ephemeralSecret = Effect.gen(function* () {
  const random = yield* SecureRandom.SecureRandom
  const bytes = yield* random.randomBytes(32)
  yield* Effect.logWarning(
    "BETTER_AUTH_SECRET is not set: using a random one, so sessions end when the server restarts."
  )
  return Base64.encode(bytes)
})

const failedAt = (operation: "handle" | "session") => (cause: unknown) => BetterAuthError.make({ operation, cause })

/**
 * Better Auth for one isolate: its HTTP handler and a session lookup.
 *
 * @category services
 */
export class BetterAuth extends Context.Service<
  BetterAuth,
  {
    readonly handle: (request: Request) => Effect.Effect<Response, BetterAuthError>
    readonly session: (headers: Headers) => Effect.Effect<O.Option<AuthSession>, BetterAuthError>
    /**
     * The origin of the address people open the app at, when one is configured. Behind a proxy the Worker sees its
     * own address, not that one, so a cross-site check is told it.
     */
    readonly publicOrigin: O.Option<string>
  }
>()($I`BetterAuth`) {
  /**
   * Better Auth from the settings and the host's options. In production a missing or short secret fails with
   * `BetterAuthConfigError`; in development a random one is made and a warning logged.
   */
  static readonly layer = (
    settings: BetterAuthSettings,
    options: (resolved: ResolvedAuth) => BetterAuthOptions
  ): Layer.Layer<BetterAuth, BetterAuthConfigError> =>
    Layer.effect(
      BetterAuth,
      Effect.gen(function* () {
        const choice = yield* Effect.fromResult(resolveAuthSecret(settings))
        const secret = yield* AuthSecret.match(choice, {
          configured: ({ secret }) => Effect.sync(() => Redacted.value(secret)),
          ephemeral: () => ephemeralSecret
        })
        const publicOrigin = O.map(settings.publicUrl, (url) => url.origin)
        const auth = betterAuth(
          options({
            secret,
            baseURL: publicOrigin,
            secureCookies: O.match(settings.publicUrl, {
              onNone: () => settings.production,
              onSome: (url) => url.protocol === "https:"
            })
          })
        )
        const { basePath } = yield* S.decodeEffect(AuthDriverOptions)(auth.options).pipe(Effect.orDie)

        return BetterAuth.of({
          publicOrigin,
          handle: Effect.fn("BetterAuth.handle")(function* (request: Request) {
            yield* Effect.annotateCurrentSpan({
              "auth.endpoint": authEndpointOf({ url: request.url, basePath }),
              "http.method": request.method
            })
            const response = yield* Effect.tryPromise({ try: () => auth.handler(request), catch: failedAt("handle") })
            yield* Effect.annotateCurrentSpan("http.status", response.status)
            return response
          }),
          session: Effect.fn("BetterAuth.session")(function* (headers: Headers) {
            const answer = yield* Effect.tryPromise({
              try: () => auth.api.getSession({ headers }),
              catch: failedAt("session")
            })
            const session = yield* authSessionOf(answer).pipe(Effect.mapError(failedAt("session")))
            yield* Effect.annotateCurrentSpan("auth.signedIn", O.isSome(session))
            return session
          })
        })
      })
    ).pipe(Layer.provide(SecureRandom.layerWebCrypto))

  /**
   * Mounts Better Auth's handler for every method under `basePath` on the router. `guard` runs first and may answer
   * instead (a cross-site refusal); otherwise the request goes to Better Auth.
   */
  static readonly route = (options: {
    readonly basePath: `/${string}`
    readonly guard: (
      request: HttpServerRequest.HttpServerRequest,
      publicOrigin: O.Option<string>
    ) => Effect.Effect<O.Option<HttpServerResponse.HttpServerResponse>>
  }): Layer.Layer<never, never, HttpRouter.HttpRouter | BetterAuth> =>
    HttpRouter.use(
      Effect.fn(function* (router) {
        const auth = yield* BetterAuth
        yield* router.add(
          "*",
          `${options.basePath}/*`,
          Effect.fn("BetterAuth.route")(function* (request: HttpServerRequest.HttpServerRequest) {
            const refused = yield* options.guard(request, auth.publicOrigin)
            if (O.isSome(refused)) return refused.value
            const web = yield* HttpServerRequest.toWeb(request).pipe(Effect.orDie)
            const response = yield* auth.handle(web).pipe(Effect.orDie)
            return HttpServerResponse.fromWeb(response)
          })
        )
      })
    )
}
