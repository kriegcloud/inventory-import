/**
 * The sign-in settings, read as `effect/Config` from the ConfigProvider the app gives (the Worker's `env`, or a
 * test's values). Secrets are `Config.Redacted`: printed or logged they read "<redacted>".
 *
 * @packageDocumentation
 */
import * as Config from "effect/Config"
import * as O from "effect/Option"
import * as Redacted from "effect/Redacted"

import * as S from "effect/Schema"
import { PublicUrl } from "@beep/better-auth/BetterAuthConfig"
import { SignUpSetting, SignUpInvited, SignUpOpen } from "@inventory/access-model/SignUp"
import { testAccountPassword } from "./internal/TestAccounts.ts"

/** An address setting: unset or blank is none, anything else must be an http(s) origin (`PublicUrl`). */
const optionalUrl = (name: string) =>
  Config.schema(S.Union([S.Literal(""), PublicUrl]), name).pipe(
    Config.withDefault(""),
    Config.map((url) => (url === "" ? O.none() : O.some(url)))
  )

/**
 * A deployed stage's own password for its test accounts: any text but the password written in the repository. That
 * one opens the test accounts on every developer's machine, so a stage given it would open them to anyone who has read
 * the README. Blank stays allowed here: blank is no password at all (`present`).
 *
 * @category settings
 */
export const StagePassword = S.String.check(
  S.makeFilter((password: string) => password !== testAccountPassword, {
    identifier: "StagePassword",
    title: "Not the repository's password",
    description: "A stage's own password for its test accounts, never the one written in the repository",
    expected: "a password other than the one written in the repository"
  })
).annotate({ description: "A deployed stage's own password for its test accounts" })

const NonBlankSecret = S.String.check(S.isPattern(/\S/))

/** A secret that is set but blank is the same as none. */
const present = (key: O.Option<Redacted.Redacted<string>>) =>
  O.filter(key, (value) => value.pipe(Redacted.value, S.is(NonBlankSecret)))

/**
 * The sign-in settings. The shortest secret accepted, 32 characters, is `@beep/better-auth`'s rule. `production` is
 * the build's: a production build turns the breached-password check on and the test accounts off unless a variable
 * says otherwise.
 *
 * - `BETTER_AUTH_SECRET`: secret. Signs the session cookies; at least 32 characters (`openssl rand -base64 32`).
 *   Required in production. In development `bun run dev` writes one into `.dev.vars` when there is none.
 * - `BETTER_AUTH_URL`: the address people open the app at, an http(s) origin (`https://app.example.com`). Unset locally: each request's
 *   own origin is used, so any dev or preview port works. When set it is the only trusted origin, and cookies are
 *   Secure exactly when it is `https:`.
 * - `PWNED_PASSWORD_CHECK`: `true` or `false`. Refuse a new password found in known breaches (Have I Been Pwned).
 *   Default: on in a production build, off in development. On, a sign-up is refused when the service cannot be reached.
 * - `TEST_ACCOUNTS`: `true` or `false`. Offer the seeded test accounts in one click on the sign-in page. Default: on in
 *   development, off in a production build. Only accounts the database holds are offered, and only `bun run dev`
 *   writes them, so a deployed database has none whatever this says.
 * - `TEST_ACCOUNT_PASSWORD`: secret. A deployed test or preview stage's own password for its test accounts, minted by
 *   its stack. Set, it opens the seeded test accounts, the password written in the repository is refused for every
 *   account, and the sign-in page offers no test account in one click. The repository's own password is refused
 *   here. Unset on a developer's machine and in production.
 * - `SIGN_UP`: who may make an account. `open`, `closed`, or the emails that may, separated by commas. Default:
 *   closed in a production build, open in development. A value that is not `open` never opens it.
 *
 * @category settings
 */
export const authSettings = (build: { readonly production: boolean }) =>
  Config.all({
    secret: Config.Redacted("BETTER_AUTH_SECRET").pipe(Config.option, Config.map(present)),
    publicUrl: optionalUrl("BETTER_AUTH_URL"),
    pwnedPasswordCheck: Config.Boolean("PWNED_PASSWORD_CHECK").pipe(Config.withDefault(build.production)),
    testAccounts: Config.Boolean("TEST_ACCOUNTS").pipe(Config.withDefault(!build.production)),
    testAccountPassword: Config.schema(S.Redacted(StagePassword), "TEST_ACCOUNT_PASSWORD").pipe(
      Config.option,
      Config.map(present)
    ),
    signUp: Config.schema(SignUpSetting, "SIGN_UP").pipe(
      Config.withDefault(build.production ? SignUpInvited.make({ emails: [] }) : SignUpOpen.make({}))
    )
  })

/**
 * The decoded sign-in settings.
 *
 * @category settings
 */
export type AuthSettings = Config.Success<ReturnType<typeof authSettings>>
