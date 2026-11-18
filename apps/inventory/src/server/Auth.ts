import type { D1Database } from "@cloudflare/workers-types"
// The full `better-auth`, not `better-auth/minimal`: minimal cannot take a direct database connection ("Direct
// database connection requires Kysely") and has no migration planner, and this app hands Better Auth the D1 binding
// itself (Better Auth builds its own Kysely D1 dialect from it). Minimal would mean an ORM adapter and a second schema.
import { betterAuth } from "better-auth"
import { Context, Effect, Layer, Option, Redacted, String as Str } from "effect"
import * as S from "effect/Schema"
import { SecureRandom } from "effect/crypto"
import * as Base64 from "effect/encoding/Base64"
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http"
import { CrossSiteRequest } from "../api/v1/Security.ts"
import { authOptions } from "./authOptions.ts"
import { allowsRequest } from "./SameOrigin.ts"
import { authSettings, minimumSecretLength } from "./Settings.ts"

// Sign-in, sessions and organisations, by Better Auth. This file wraps it in an Effect service and mounts its HTTP
// handler at /api/auth/* beside the HttpApi (never versioned: it is Better Auth's contract, and its browser client's
// base path). Handlers never call it: they read `CurrentActor`, which SessionIdentity.ts resolves from the session
// this service reads.
//
// Every call into Better Auth is a span (`Auth.handler`, `Auth.session`) carrying the endpoint and the answer's
// status, never an email, a password or a cookie.

/** What a valid session cookie says: whose it is, and which organisation they are working in. */
export class AuthSession extends S.Class<AuthSession, { readonly brand: unique symbol }>("AuthSession")({
  userId: S.String.annotateKey({ description: "Better Auth's user id: who signed in." }),
  email: S.String.annotateKey({ description: "The email the person signed in with, for the account menu." }),
  activeOrganizationId: S.NullOr(S.String).annotateKey({
    description: "The organisation the person last chose. Null until they belong to one."
  })
}) {}

/** The part of Better Auth's `getSession` answer this app reads. Anything else in it is ignored. */
const SessionAnswer = S.NullOr(
  S.Struct({
    session: S.Struct({
      userId: S.String,
      activeOrganizationId: S.String.pipe(S.NullOr, S.optional)
    }),
    user: S.Struct({ email: S.String })
  })
)

const basePath = "/api/auth"

/** The endpoint a Better Auth request is for, relative to /api/auth ("/sign-in/email"). Never its query or body. */
const endpointOf = (request: Request): string => {
  const path = new URL(request.url).pathname
  return Str.startsWith(basePath)(path) ? Str.slice(basePath.length)(path) : path
}

/**
 * Better Auth for this Worker: its HTTP handler (sign-up, sign-in, sign-out, organisations) and a session lookup for
 * the identity middleware. One instance per isolate, built from the D1 binding and the sign-in settings.
 */
export class Auth extends Context.Service<
  Auth,
  {
    readonly handle: (request: Request) => Effect.Effect<Response>
    session(headers: Headers): Effect.Effect<Option.Option<AuthSession>>
    /**
     * The origin of the address people open the app at, when one is configured (`BETTER_AUTH_URL`). Behind a proxy the
     * Worker sees its own address, not that one, so the cross-site check is told it.
     */
    readonly publicOrigin: Option.Option<string>
  }
>()("@inventory/app/server/Auth") {
  /**
   * In production a missing or short `BETTER_AUTH_SECRET` stops the Worker: sessions signed with a guessable key can
   * be forged. In development `bun run dev` has written one into `.dev.vars`; without it a random one is made, and
   * sessions then end whenever the dev server restarts.
   */
  static readonly layer = (options: {
    readonly database: D1Database
    readonly production: boolean
    /** The Worker's `waitUntil`, so Better Auth's work after an answer is not cut off. Absent in tests. */
    readonly backgroundTasks?: ((promise: Promise<unknown>) => void) | undefined
    /** Off only in tests that sign in many times from one address. */
    readonly rateLimit?: boolean | undefined
  }) =>
    Layer.effect(
      Auth,
      Effect.gen(function* () {
        const settings = yield* authSettings({ production: options.production })
        const configured = Option.filter(
          settings.secret,
          (secret) => Redacted.value(secret).length >= minimumSecretLength
        )
        let secret: string
        if (Option.isSome(configured)) {
          secret = Redacted.value(configured.value)
        } else if (options.production) {
          return yield* Effect.die(
            `BETTER_AUTH_SECRET is ${Option.isNone(settings.secret) ? "not set" : "shorter than 32 characters"}. ` +
              "Set it with `wrangler secret put BETTER_AUTH_SECRET` (a value from `openssl rand -base64 32`)."
          )
        } else {
          const random = yield* SecureRandom.SecureRandom
          const bytes = yield* random.randomBytes(32)
          secret = Base64.encode(bytes)
          yield* Effect.logWarning(
            "BETTER_AUTH_SECRET is not set in .dev.vars: using a random one, so sessions end when the dev server restarts."
          )
        }
        const publicOrigin = Option.map(settings.publicUrl, (url) => url.origin)
        const auth = betterAuth(
          authOptions({
            database: options.database,
            secret,
            baseURL: Option.getOrUndefined(publicOrigin),
            // Secure cookies in a production build, unless the configured address is plain http (a private network
            // without TLS: a browser drops a Secure cookie there, and nobody could sign in); and under
            // `bun run dev:https` once BETTER_AUTH_URL names its https address.
            secureCookies: Option.match(settings.publicUrl, {
              onNone: () => options.production,
              onSome: (url) => url.protocol === "https:"
            }),
            pwnedPasswordCheck: settings.pwnedPasswordCheck,
            backgroundTasks: options.backgroundTasks,
            rateLimit: options.rateLimit
          })
        )
        const decodeSession = S.decodeUnknownEffect(SessionAnswer)

        return Auth.of({
          publicOrigin,
          handle: Effect.fn("Auth.handler")(function* (request: Request) {
            yield* Effect.annotateCurrentSpan({ "auth.endpoint": endpointOf(request), "http.method": request.method })
            const response = yield* Effect.promise(() => auth.handler(request))
            yield* Effect.annotateCurrentSpan("http.status", response.status)
            return response
          }),
          session: Effect.fn("Auth.session")(function* (headers: Headers) {
            const answer = yield* Effect.promise(() => auth.api.getSession({ headers }))
            const decoded = yield* decodeSession(answer).pipe(Effect.orDie)
            yield* Effect.annotateCurrentSpan("auth.signedIn", decoded !== null)
            if (decoded === null) return Option.none()
            return Option.some(
              AuthSession.make({
                userId: decoded.session.userId,
                email: decoded.user.email,
                activeOrganizationId: decoded.session.activeOrganizationId ?? null
              })
            )
          })
        })
      })
    ).pipe(Layer.provide(SecureRandom.layerWebCrypto))
}

// Named so the linter does not read it as a React hook (pattern 6 in docs/patterns.md).
const withRouter = HttpRouter.use

/** The answer the app's own API gives a cross-site write (`CrossSiteRequest`), so the browser reads both alike. */
const refused = HttpServerResponse.jsonUnsafe(
  {
    _tag: "CrossSiteRequest",
    reason: "This request came from another site, so it was refused. Open the app itself and try again there."
  } satisfies typeof CrossSiteRequest.Encoded,
  { status: 403 }
)

/**
 * Better Auth's endpoints at /api/auth/*, served by the same router as the HttpApi, with its spans and headers. A
 * write another site asked the browser to send is refused here first, by the same rule as the app's own API
 * (SameOrigin.ts), before Better Auth's own origin and CSRF checks: two locks, and the first one is ours and tested.
 */
export const AuthRoute = withRouter(
  Effect.fn(function* (router) {
    const auth = yield* Auth
    yield* router.add(
      "*",
      "/api/auth/*",
      Effect.fn("Auth.handle")(function* (request: HttpServerRequest.HttpServerRequest) {
        const source = {
          method: request.method,
          fetchSite: request.headers["sec-fetch-site"],
          origin: request.headers["origin"],
          own: [
            ...Option.toArray(Option.map(HttpServerRequest.toURL(request), (url) => url.origin)),
            ...Option.toArray(auth.publicOrigin)
          ]
        }
        if (!allowsRequest(source)) {
          yield* Effect.logWarning("Refused a sign-in request from another site").pipe(
            Effect.annotateLogs({ "http.origin": source.origin ?? "", "http.sec_fetch_site": source.fetchSite ?? "" })
          )
          return refused
        }
        const web = yield* HttpServerRequest.toWeb(request).pipe(Effect.orDie)
        const response = yield* auth.handle(web)
        return HttpServerResponse.fromWeb(response)
      })
    )
  })
)
