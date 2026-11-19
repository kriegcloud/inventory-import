// SIGN-IN. Better Auth through @beep/better-auth, with this app's options (internal/authOptions.ts) and settings (Config.ts),
// and its routes at /api/auth/* beside the HttpApi (never versioned: it is Better Auth's contract, and its browser
// client's base path). Handlers never call it: they read `CurrentActor`, which SessionIdentity.adapter.ts resolves from the
// session it looks up. A write another site asked the browser to send is refused here first, by the same rule as the
// app's own API (`RequestSource.allows`), before Better Auth's own origin and CSRF checks: two locks, and the first one
// is ours and tested.
import type { D1Database } from "@cloudflare/workers-types"
import { BetterAuth } from "@beep/better-auth/BetterAuth"
import { BetterAuthSettings } from "@beep/better-auth/BetterAuthConfig"
import { RequestSource } from "@inventory/kernel/SameOrigin"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as O from "effect/Option"
import * as Redacted from "effect/Redacted"
import * as HttpServerRequest from "effect/http/HttpServerRequest"
import * as HttpServerResponse from "effect/http/HttpServerResponse"
import type { CrossSiteRequest } from "@inventory/kernel/AccessError"
import { mayCreateAccount } from "@inventory/access-model/SignUp"
import { passwordToVerify } from "@inventory/access-model/StagePassword"
import { authSettings } from "./Config.ts"
import { authOptions } from "./internal/authOptions.ts"
import { testAccountPassword } from "./internal/TestAccounts.ts"

/**
 * Better Auth for this Worker, on the D1 binding, from the sign-in settings. In production a missing or short
 * `BETTER_AUTH_SECRET` stops the Worker (`BetterAuthConfigError`): sessions signed with a guessable key can be forged.
 * In development `bun run dev` has written one into `.dev.vars`; without it a random one is made, and sessions then end
 * whenever the dev server restarts.
 */
export const signIn = (options: {
  readonly database: D1Database
  readonly production: boolean
  /** The Worker's `waitUntil`, so Better Auth's work after an answer is not cut off. Absent in tests. */
  readonly backgroundTasks?: ((promise: Promise<unknown>) => void) | undefined
  /** Off only in tests that sign in many times from one address. */
  readonly rateLimit?: boolean | undefined
}) =>
  Layer.unwrap(
    Effect.gen(function* () {
      const settings = yield* authSettings({ production: options.production })
      return BetterAuth.layer(
        BetterAuthSettings.make({
          secret: settings.secret,
          publicUrl: settings.publicUrl,
          production: options.production
        }),
        (resolved) =>
          authOptions({
            database: options.database,
            secret: resolved.secret,
            baseURL: O.getOrUndefined(resolved.baseURL),
            // Secure cookies in a production build, unless the configured address is plain http (a private network
            // without TLS: a browser drops a Secure cookie there, and nobody could sign in); and under
            // `bun run dev:https` once BETTER_AUTH_URL names its https address.
            secureCookies: resolved.secureCookies,
            pwnedPasswordCheck: settings.pwnedPasswordCheck,
            mayCreateAccount: (email) => mayCreateAccount(settings.signUp, email),
            passwordToVerify: (typed) =>
              O.getOrUndefined(
                passwordToVerify({
                  stage: O.map(settings.testAccountPassword, Redacted.value),
                  repository: testAccountPassword,
                  typed
                })
              ),
            backgroundTasks: options.backgroundTasks,
            rateLimit: options.rateLimit
          })
      )
    })
  )

/** The answer the app's own API gives a cross-site write (`CrossSiteRequest`), so the browser reads both alike. */
const refused = HttpServerResponse.jsonUnsafe(
  {
    _tag: "CrossSiteRequest",
    reason: "This request came from another site, so it was refused. Open the app itself and try again there."
  } satisfies typeof CrossSiteRequest.Encoded,
  { status: 403 }
)

/** Better Auth's endpoints at /api/auth/*, served by the same router as the HttpApi, behind the cross-site rule. */
export const SignInRoute = BetterAuth.route({
  basePath: "/api/auth",
  guard: Effect.fn("SignIn.guard")(function* (request: HttpServerRequest.HttpServerRequest, publicOrigin) {
    const source = RequestSource.make({
      method: request.method,
      fetchSite: O.fromUndefinedOr(request.headers["sec-fetch-site"]),
      origin: O.fromUndefinedOr(request.headers["origin"]),
      own: [...O.toArray(O.map(HttpServerRequest.toURL(request), (url) => url.origin)), ...O.toArray(publicOrigin)]
    })
    if (RequestSource.allows(source)) return O.none()
    yield* Effect.logWarning("Refused a sign-in request from another site").pipe(
      Effect.annotateLogs({
        "http.origin": O.getOrElse(source.origin, () => ""),
        "http.sec_fetch_site": O.getOrElse(source.fetchSite, () => "")
      })
    )
    return O.some(refused)
  })
})
