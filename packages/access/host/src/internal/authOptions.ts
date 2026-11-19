import type { BetterAuthOptions } from "better-auth"
import { APIError } from "better-auth/api"
import { verifyPassword } from "better-auth/crypto"
import { haveIBeenPwned } from "better-auth/plugins/haveibeenpwned"
import { organization } from "better-auth/plugins/organization"
import { memberAc, ownerAc } from "better-auth/plugins/organization/access"
import { signUpClosedMessage } from "@inventory/access-model/SignUp"

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
export const authOptions = (input: {
  readonly database: NonNullable<BetterAuthOptions["database"]>
  readonly secret: string
  /** The address people open the app at (BETTER_AUTH_URL). Unset: each request's own origin. */
  readonly baseURL?: string | undefined
  /** Secure, `__Secure-` prefixed cookies: a production build, or an `https:` BETTER_AUTH_URL. */
  readonly secureCookies?: boolean | undefined
  /** Refuse a new password found in known breaches (PWNED_PASSWORD_CHECK). */
  readonly pwnedPasswordCheck?: boolean | undefined
  /** Who may make an account (SIGN_UP): asked of each new account's email. Unset: anyone, as the schema script needs. */
  readonly mayCreateAccount?: ((email: string) => boolean) | undefined
  /**
   * What to hold against a stored hash for a typed password, or undefined to refuse it (TEST_ACCOUNT_PASSWORD: a
   * deployed stage's own password for its test accounts). Unset: the typed password, as Better Auth does.
   */
  readonly passwordToVerify?: ((typed: string) => string | undefined) | undefined
  /** Runs work Better Auth does after answering (rate-limit updates, cleanup). The Worker passes `waitUntil`. */
  readonly backgroundTasks?: ((promise: Promise<unknown>) => void) | undefined
  /** Off only in tests that sign in many times from one address. On in `bun run dev` and in production. */
  readonly rateLimit?: boolean | undefined
}) =>
  ({
    appName: "Inventory",
    database: input.database,
    secret: input.secret,
    // Unset locally: Better Auth then takes the origin of each request, so any dev or preview port works.
    ...(input.baseURL === undefined || input.baseURL === "" ? {} : { baseURL: input.baseURL }),
    basePath: "/api/auth",
    // The configured address is the one trusted origin (the request's own when none is set). A sign-in, a callback or
    // a redirect from or to anywhere else is refused (INVALID_ORIGIN, INVALID_CALLBACK_URL).
    trustedOrigins: input.baseURL === undefined || input.baseURL === "" ? [] : [new URL(input.baseURL).origin],
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
      ...(input.passwordToVerify === undefined
        ? {}
        : {
            password: {
              // The stored hashes are Better Auth's own; only which password is held against one is decided here.
              verify: ({ hash, password }: { hash: string; password: string }) => {
                const held = input.passwordToVerify?.(password)
                return held === undefined ? Promise.resolve(false) : verifyPassword({ hash, password: held })
              }
            }
          })
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
      enabled: input.rateLimit ?? true,
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
      useSecureCookies: input.secureCookies ?? false,
      cookiePrefix: "inventory",
      defaultCookieAttributes: { sameSite: "lax", httpOnly: true },
      // Cloudflare sets this header to the visitor's address; rate limits are counted per address.
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
      // Never skipped, not even under test, where Better Auth would skip it by default: the tests then prove it.
      disableOriginCheck: false,
      // Rate-limit updates and cleanup run after the answer is sent, kept alive by the Worker's `waitUntil`.
      ...(input.backgroundTasks === undefined ? {} : { backgroundTasks: { handler: input.backgroundTasks } })
    },
    databaseHooks: {
      user: {
        create: {
          // Sign-up is closed to everyone the owner has not named (decision "infra I8"). Refused here, where every
          // way of making an account passes, so no route can make one the setting does not allow.
          before: (user) =>
            input.mayCreateAccount === undefined || input.mayCreateAccount(user.email)
              ? Promise.resolve()
              : Promise.reject(new APIError("FORBIDDEN", { message: signUpClosedMessage }))
        }
      },
      session: {
        create: {
          // A new session opens in the person's earliest organisation, so the app has a tenant from the first
          // request. They switch with the plugin's `set-active`, which checks membership on the server.
          before: (session, context) =>
            context === null
              ? Promise.resolve()
              : context.context.adapter
                  .findMany<{ organizationId: string }>({
                    model: "member",
                    where: [{ field: "userId", value: session.userId }],
                    sortBy: { field: "createdAt", direction: "asc" },
                    limit: 1
                  })
                  .then((rows) =>
                    rows[0] === undefined
                      ? undefined
                      : { data: { ...session, activeOrganizationId: rows[0].organizationId } }
                  )
        }
      }
    },
    plugins: [
      // Have I Been Pwned: only the first five characters of the password's SHA-1 hash leave the Worker. It fails
      // closed: when the service cannot be reached, sign-up and a password change are refused (README, "Signing in").
      haveIBeenPwned({
        enabled: input.pwnedPasswordCheck ?? false,
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
          beforeAddMember: ({ member, user }) => Promise.resolve({ data: { ...member, name: user.name } })
        }
      })
    ]
  }) satisfies BetterAuthOptions
