import * as A from "effect/Array"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import type { BetterAuthOptions } from "better-auth"
import { type AuthBackgroundTasks, HookRefused, hook } from "@beep/better-auth/Hooks"
import * as Effect from "effect/Effect"
import { verifyPassword } from "better-auth/crypto"
import { haveIBeenPwned } from "better-auth/plugins/haveibeenpwned"
import { organization } from "better-auth/plugins/organization"
import { memberAc, ownerAc } from "better-auth/plugins/organization/access"
import { SignUpEmail, signUpClosedMessage } from "@inventory/access-model/SignUp"

// Better Auth's configuration, in one place for the Worker (SignIn.route.ts), the schema script
// (scripts/auth-schema.mjs) and the tests, so the tables the migration creates are the tables this config needs.
//
// The one thing not to break: the organisation plugin shares the app's `organization` and `member` tables, and
// its roles are exactly the app's three. `member.role` has a CHECK constraint, so a fourth role is refused by the
// database before any handler sees it.

/**
 * The app's roles as organisation-plugin roles. An admin holds every plugin permission (the plugin's owner), so
 * the person who creates an organisation can manage it; editor and viewer hold none, so membership changes need an
 * admin. What an editor may do that a viewer may not is decided by `requireRole` in the handlers, not here.
 */
export const organizationRoles = { admin: ownerAc, editor: memberAc, viewer: memberAc }

/** Seven days, then sign in again; the expiry moves forward once a day while the person keeps using the app. */
const sessionSeconds = 60 * 60 * 24 * 7

/** What a password found in known breaches is told, in the app's own words. */
export const pwnedPasswordMessage =
  "This password appears in known data breaches, so it is easy to guess. Choose a different one."

/**
 * The full Better Auth configuration for this app. `database` is the D1 binding in the Worker and an in-memory
 * SQLite database in the schema script and the fast tests. The rest comes from the settings (`authSettings` in
 * Settings.ts) through `signIn` (SignIn.ts).
 */
type AuthOptionsInput = {
  readonly database: NonNullable<BetterAuthOptions["database"]>
  readonly secret: string
  /** The address people open the app at (BETTER_AUTH_URL). Unset: each request's own origin. */
  readonly baseURL: O.Option<string>
  /** Secure, `__Secure-` prefixed cookies: a production build, or an `https:` BETTER_AUTH_URL. */
  readonly secureCookies: boolean
  /** Refuse a new password found in known breaches (PWNED_PASSWORD_CHECK). */
  readonly pwnedPasswordCheck: boolean
  /** Who may make an account (SIGN_UP): asked of each new account's email. None: anyone, as the schema script needs. */
  readonly mayCreateAccount: O.Option<(email: SignUpEmail) => boolean>
  /**
   * What to hold against a stored hash for a typed password, or none to refuse it (TEST_ACCOUNT_PASSWORD: a
   * deployed stage's own password for its test accounts). None: the typed password, as Better Auth does.
   */
  readonly passwordToVerify: O.Option<(typed: string) => O.Option<string>>
  /** Runs work Better Auth does after answering (rate-limit updates, cleanup). The Worker passes `waitUntil`. */
  readonly backgroundTasks: O.Option<AuthBackgroundTasks>
  /** Off only in tests that sign in many times from one address. On in `bun run dev` and in production. */
  readonly rateLimit: boolean
}

/** Builds Better Auth from explicit security choices, omitting absent third-party options. */
export const authOptions = (input: AuthOptionsInput) => {
  const settings = input
  const address = settings.baseURL
  const addressOptions: Pick<BetterAuthOptions, "baseURL"> = R.getSomes({ baseURL: address })
  const passwordOptions: Pick<NonNullable<BetterAuthOptions["emailAndPassword"]>, "password"> = R.getSomes({
    password: O.map(settings.passwordToVerify, (select) => ({
      verify: ({ hash, password }: { readonly hash: string; readonly password: string }) =>
        hook(
          O.match(select(password), {
            onNone: () => Effect.succeed(false),
            onSome: (held) => Effect.promise(() => verifyPassword({ hash, password: held }))
          })
        )
    }))
  })
  const backgroundOptions: Pick<NonNullable<BetterAuthOptions["advanced"]>, "backgroundTasks"> = R.getSomes({
    backgroundTasks: O.map(settings.backgroundTasks, (handler) => ({ handler }))
  })
  return {
    appName: "Inventory",
    database: input.database,
    secret: input.secret,
    // Unset locally: Better Auth then takes the origin of each request, so any dev or preview port works.
    ...addressOptions,
    basePath: "/api/auth",
    // The configured address is the one trusted origin (the request's own when none is set). A sign-in, a callback or
    // a redirect from or to anywhere else is refused (INVALID_ORIGIN, INVALID_CALLBACK_URL).
    trustedOrigins: A.map(O.toArray(address), (url) => new URL(url).origin),
    // A person cannot rename themselves (or change their picture) through Better Auth's `update-user`: it answers 404.
    // The app never compares names for permissions (identity is the id), and a name that changes under a decision
    // would still mislead whoever reads the activity list. Removing a member, leaving and deleting an organization
    // are off too: activity rows name their member through a foreign key, so the database would refuse the delete
    // once a member has done anything. A real People screen marks a member removed instead.
    disabledPaths: ["/update-user", "/organization/remove-member", "/organization/leave", "/organization/delete"],
    // Better Auth's usage telemetry reports to Better Auth's own servers: off, nothing about this app leaves it. Its
    // OpenTelemetry instrumentation does nothing inside a Worker (the `workerd` build of @better-auth/core has no
    // tracer), so the spans the telemetry sees around sign-in are the app's own (`BetterAuth.handle`, `BetterAuth.session`).
    telemetry: { enabled: false },
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      // No email is sent from this app, so there is no verification or reset link to click. See docs/auth.md.
      requireEmailVerification: false,
      revokeSessionsOnPasswordReset: true,
      ...passwordOptions
    },
    session: {
      expiresIn: sessionSeconds,
      updateAge: 60 * 60 * 24,
      // Off: every request reads the session row, so signing out or a revoked session ends at once, in every tab. A
      // cookie cache saves that one D1 read per request and in exchange keeps a revoked session working until the
      // cache expires: `{ enabled: true, maxAge: 60 }` accepts up to a minute of it. That is a production choice to
      // make with the traffic in view. Membership is read from D1 on every request anyway (SessionIdentity.ts), so a
      // member removed from an organization would lose access there at once even with the cache on.
      cookieCache: { enabled: false }
    },
    rateLimit: {
      enabled: settings.rateLimit,
      // Workers keep no memory between isolates, so counters live in D1 (the `rateLimit` table).
      storage: "database",
      window: 60,
      max: 100,
      // Paths are relative to basePath: "/sign-in/email", not "/api/auth/sign-in/email".
      customRules: {
        "/sign-in/email": { window: 60, max: 10 },
        "/sign-up/email": { window: 60, max: 5 }
      }
    },
    advanced: {
      useSecureCookies: settings.secureCookies,
      cookiePrefix: "inventory",
      defaultCookieAttributes: { sameSite: "lax", httpOnly: true },
      // Cloudflare sets this header to the visitor's address; rate limits are counted per address.
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
      // Never skipped, not even under test, where Better Auth would skip it by default: the tests then prove it.
      disableOriginCheck: false,
      // Rate-limit updates and cleanup run after the answer is sent, kept alive by the Worker's `waitUntil`.
      ...backgroundOptions
    },
    databaseHooks: {
      user: {
        create: {
          // Sign-up is closed to everyone the owner has not named (decision "infra I8"). Refused here, where every
          // way of making an account passes, so no route can make one the setting does not allow.
          before: (user) => {
            const email: unknown = user.email
            // No rule: anyone, as the schema script needs. An email that is no text is refused.
            const allowed = O.match(settings.mayCreateAccount, {
              onNone: () => true,
              onSome: (mayCreate) => O.exists(S.decodeUnknownOption(SignUpEmail)(email), mayCreate)
            })
            return hook(allowed ? Effect.void : Effect.fail(HookRefused.make({ message: signUpClosedMessage })))
          }
        }
      },
      session: {
        create: {
          // A new session opens in the person's earliest organisation, so the app has a tenant from the first
          // request. They switch with the plugin's `set-active`, which checks membership on the server.
          before: (session, context) =>
            hook(
              O.match(O.fromNullOr(context), {
                // No request behind it (Better Auth's own bookkeeping): the session is left as it is.
                onNone: () => Effect.undefined,
                onSome: ({ context: { adapter } }) =>
                  Effect.promise(() =>
                    adapter.findMany<{ readonly organizationId: string }>({
                      model: "member",
                      where: [{ field: "userId", value: session.userId }],
                      sortBy: { field: "createdAt", direction: "asc" },
                      limit: 1
                    })
                  ).pipe(
                    // Nobody's member yet: Better Auth wants undefined back when there is nothing to change.
                    Effect.flatMap(
                      A.match({
                        onEmpty: () => Effect.undefined,
                        onNonEmpty: (rows) =>
                          Effect.succeed({
                            data: { ...session, activeOrganizationId: A.headNonEmpty(rows).organizationId }
                          })
                      })
                    )
                  )
              })
            )
        }
      }
    },
    plugins: [
      // Have I Been Pwned: only the first five characters of the password's SHA-1 hash leave the Worker. It fails
      // closed: when the service cannot be reached, sign-up and a password change are refused (README, "Signing in").
      haveIBeenPwned({
        enabled: settings.pwnedPasswordCheck,
        customPasswordCompromisedMessage: pwnedPasswordMessage
      }),
      organization({
        // No `ac`: it is read only for dynamic (database-stored) roles, which this app does not use.
        roles: organizationRoles,
        creatorRole: "admin",
        allowUserToCreateOrganization: true,
        organizationLimit: 5,
        schema: {
          // The app's `member.name` is NOT NULL; the hook below fills it. Reads prefer the user's current name.
          member: { additionalFields: { name: { type: "string", required: false, input: false } } }
        },
        organizationHooks: {
          beforeAddMember: ({ member, user }) => hook(Effect.succeed({ data: { ...member, name: user.name } }))
        }
      })
    ]
  } satisfies BetterAuthOptions
}
