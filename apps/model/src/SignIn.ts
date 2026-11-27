/**
 * Better Auth on the model's Worker, built on Alchemy's package (`@alchemy.run/better-auth`), for one thing only: to
 * read whose session a forwarded call carries (host-03; Benjamin, 2026-11-26, "Model's Worker only"). It is a second
 * construction from the site's one options module (`@inventory/access-host/AuthOptions`, `authRules`), so it reads the
 * same tables and the same cookie, and it signs with the site's secret, which the stack hands this Worker
 * (`packages/infra/src/Inventory.stack.ts`). The package's own migration is off: the ordered `migrations/` folder of
 * the site makes the tables. Sign-in, sign-out and every `/api/auth/*` request stay on the site's Worker (decision
 * 31), so this one answers none of them. What it gives is the repository's own driver service, `@beep/better-auth`'s
 * `BetterAuth`, so the one session lookup (`SessionLookupLive`) runs here unchanged.
 *
 * The one thing not to break: a session read here is the session the site signed. A secret, a cookie name or a table
 * that differs from the site's reads nobody, and every call would be refused "Sign in to continue.".
 *
 * @packageDocumentation
 */
import { BetterAuth as AlchemyBetterAuth } from "@alchemy.run/better-auth/BetterAuth"
import { Database as AuthDatabase } from "@alchemy.run/better-auth/Database"
import { BetterAuth } from "@beep/better-auth/BetterAuth"
import { BetterAuthError } from "@beep/better-auth/BetterAuthError"
import { AuthSecret, authSessionOf, resolveAuthSecret } from "@beep/better-auth/BetterAuthSession"
import type { D1Database } from "@cloudflare/workers-types"
import { authRules } from "@inventory/access-host/AuthOptions"
import { SessionLookupLive } from "@inventory/access-host/SessionLookup"
import type { MemberDirectory } from "@inventory/access-model/MemberDirectory"
import { RuntimeContext } from "alchemy/RuntimeContext"
import * as Config from "effect/Config"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as O from "effect/Option"
import { secretBinding, secureCookiesBinding } from "./Bindings.ts"

/**
 * What the stack tells this Worker about the site's cookie: whether it is a Secure one (`__Secure-` before its name).
 * The site's rule makes it Secure exactly when its address is `https:`, which every deployed stage's is, and not under
 * `alchemy dev`, where the site answers on `http://localhost:1337`. Unset reads Secure. Read when the Worker starts,
 * since Better Auth names its cookie once.
 */
export const secureCookiesSetting = Config.Boolean(secureCookiesBinding).pipe(Config.withDefault(true))

/**
 * The site's signing secret, read from this Worker's settings in each execution, never while the Worker is put
 * together: a setting read then would be bound to the Worker from whatever the deploying machine holds. It must be
 * the site's own, 32 characters or more; none, or a short one, is a fault of the stack, not of the request, so the
 * call ends as a 500 and no session is read.
 */
const siteSecret = Effect.gen(function* () {
  const given = yield* Config.option(Config.Redacted(secretBinding))
  // Never a secret of this Worker's own making: only the site's reads the site's cookies.
  const choice = yield* Effect.fromResult(resolveAuthSecret({ secret: given, production: true }))
  return yield* AuthSecret.match(choice, {
    configured: ({ secret }) => Effect.succeed(secret),
    ephemeral: () => Effect.die("A secret of the model Worker's own would read no session the site signed.")
  })
}).pipe(Effect.orDie)

/**
 * `@beep/better-auth`'s `BetterAuth` over Alchemy's, on the database `AuthDatabase` gives. `session` reads the cookie
 * of the headers it is given and decodes the answer as the site's driver does (`authSessionOf`), end time included;
 * `handle` answers every request 404, since sign-in is the site's. Nobody can make an account or sign in with a
 * password through this construction, whatever reaches it.
 *
 * **Example** (On the Worker, over its D1 binding)
 *
 * ```ts
 * const auth = ModelSignIn({ secureCookies: true }).pipe(Layer.provide(authDatabaseOver(database)))
 * ```
 *
 * @category layers
 */
export const ModelSignIn = (settings: { readonly secureCookies: boolean }) =>
  Layer.effect(
    BetterAuth,
    Effect.gen(function* () {
      const rules = authRules({
        baseURL: O.none(),
        secureCookies: settings.secureCookies,
        pwnedPasswordCheck: false,
        mayCreateAccount: O.some(() => false),
        passwordToVerify: O.some(() => O.none()),
        backgroundTasks: O.none(),
        rateLimit: true
      })
      const auth = yield* AlchemyBetterAuth({
        ...rules,
        // Never renewed here: a read past the session's first day would move its stored end on and set a renewed
        // cookie this Worker cannot hand back, and the site's next read would then find nothing to renew, so the
        // browser's cookie would keep its first end and sign a daily user out a week after signing in. The site's
        // Worker answers the browser, so only its reads renew (`authRules`'s `updateAge`).
        session: { ...rules.session, disableSessionRefresh: true },
        migrate: false,
        secret: siteSecret
      })
      // Alchemy's runtime context, which its calls name: the Worker's own when it runs, nothing in a test, where no
      // call of this construction reads it (no secondary storage is given).
      const context = yield* Effect.context<RuntimeContext>()
      const runtime = Context.pick(RuntimeContext)(context)
      const failedAt = (operation: "handle" | "session") => (cause: unknown) =>
        BetterAuthError.make({ operation, cause })
      return BetterAuth.of({
        publicOrigin: O.none(),
        handle: Effect.fn("BetterAuth.handle")(function* () {
          return yield* Effect.succeed(new Response(null, { status: 404 }))
        }),
        session: Effect.fn("BetterAuth.session")(function* (headers: Headers) {
          // One Better Auth instance for this lookup: Alchemy's package makes one per execution, on its scope.
          const answer = yield* auth
            .getSession(headers)
            .pipe(Effect.mapError(failedAt("session")), Effect.provideContext(runtime), Effect.scoped)
          const session = yield* authSessionOf(answer).pipe(Effect.mapError(failedAt("session")))
          yield* Effect.annotateCurrentSpan("auth.signedIn", O.isSome(session))
          return session
        })
      })
    })
  ).pipe(Layer.provide(RuntimeContext.phantom))

/**
 * Alchemy's Better Auth database over the D1 binding `database` reads in each execution: the site's database, which
 * the stack binds to both Workers. No migration is offered, so none can run.
 *
 * @category layers
 */
export const authDatabaseOver = (database: Effect.Effect<D1Database>) =>
  Layer.succeed(AuthDatabase, { provider: "sqlite", runtime: database })

/**
 * The one session lookup on this Worker, over the two stores it is given: Better Auth on Alchemy's package
 * (`ModelSignIn`) on `auth`, the member directory `directory`, and whether the site's cookie is a Secure one. The Worker
 * gives it the site's D1 database for both (`ModelWorker.ts`) and a test gives it stores in memory, so the lookup a
 * test runs is the Worker's own.
 *
 * @category layers
 */
export const sessionsOver = <E, R, E2, R2>(stores: {
  readonly auth: Layer.Layer<AuthDatabase, E, R>
  readonly directory: Layer.Layer<MemberDirectory, E2, R2>
  readonly secureCookies: boolean
}) =>
  SessionLookupLive.pipe(
    Layer.provide(
      Layer.merge(
        ModelSignIn({ secureCookies: stores.secureCookies }).pipe(Layer.provide(stores.auth)),
        stores.directory
      )
    )
  )
