// The site's sign-in, as a test of the model's Worker has it: the site's own construction of Better Auth
// (`authOptions`, the one options module) on a store in memory, which the model's construction (`SignIn.ts`) is given
// too, as both Workers are given the one D1 database. A person signs up and in on the site's construction, and the
// cookie they are handed is what the site's Worker forwards to the model's ("Forward the cookie", Benjamin,
// 2026-11-26). Nothing here is the model's: what the model reads, it reads with its own construction.
import { authOptions } from "@inventory/access-host/AuthOptions"
import { betterAuth } from "better-auth"
import { type MemoryDB, memoryAdapter } from "better-auth/adapters/memory"
import * as A from "effect/Array"
import * as ConfigProvider from "effect/ConfigProvider"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as Str from "effect/String"

/** The site's signing secret in a test: what the stack hands both Workers. */
export const siteSecret = "a-test-secret-the-stack-hands-both-workers"

/** The settings the model's Worker reads its secret from, as its stack binds them: the secret, or none at all. */
const settingsOf = (secret: O.Option<string>) =>
  ConfigProvider.fromUnknown(
    O.match(secret, { onNone: () => ({}), onSome: (BETTER_AUTH_SECRET) => ({ BETTER_AUTH_SECRET }) })
  )

/** An effect run with the model Worker's settings holding `secret`, or no secret at all. */
export const withWorkerSettings = (secret: O.Option<string>) =>
  Effect.provideService(ConfigProvider.ConfigProvider, settingsOf(secret))

/** The one database, empty: Better Auth's tables, and the organisation plugin's two. */
export const authStore = (): MemoryDB => ({
  user: [],
  session: [],
  account: [],
  verification: [],
  member: [],
  organization: []
})

/** The site's construction on `store`, as the site's Worker makes it under `alchemy dev`: no Secure cookie. */
export const siteAuth = (store: MemoryDB) =>
  betterAuth(
    authOptions({
      database: memoryAdapter(store),
      secret: siteSecret,
      baseURL: O.none(),
      secureCookies: false,
      pwnedPasswordCheck: false,
      rateLimit: false,
      mayCreateAccount: O.none(),
      passwordToVerify: O.none(),
      backgroundTasks: O.none()
    })
  )

/** The `cookie` header a browser sends back for the cookies a response set. */
const cookieOf = (headers: Headers): string =>
  A.join(
    A.map(headers.getSetCookie(), (cookie) => A.headNonEmpty(Str.split(cookie, ";"))),
    "; "
  )

/** A password long enough for the site's rule. */
const password = "a-password-long-enough"

/**
 * `email` signed up on the site's construction, made a member of `organizationId` as `role` there, then signed in, so
 * the session opens in that organization: the id Better Auth gave the account, the cookie the browser holds, and the
 * session's end as the site's construction reads it.
 */
export const signedInMember = Effect.fnUntraced(function* (
  store: MemoryDB,
  member: {
    readonly email: string
    readonly memberId: string
    readonly organizationId: string
    readonly role: "admin" | "editor" | "viewer"
  }
) {
  const auth = siteAuth(store)
  const signedUp = yield* Effect.promise(() =>
    auth.api.signUpEmail({ body: { name: `Member ${member.memberId}`, email: member.email, password } })
  )
  const at = DateTime.makeUnsafe(0).pipe(DateTime.toDateUtc)
  // The organisation and the membership as the site's own writes make them, through Better Auth's adapter.
  const { adapter } = yield* Effect.promise(() => auth.$context)
  yield* Effect.promise(() =>
    adapter.create({
      model: "organization",
      data: { id: member.organizationId, name: member.organizationId, slug: member.organizationId, createdAt: at },
      forceAllowId: true
    })
  )
  yield* Effect.promise(() =>
    adapter.create({
      model: "member",
      data: {
        id: member.memberId,
        organizationId: member.organizationId,
        userId: signedUp.user.id,
        role: member.role,
        createdAt: at
      },
      forceAllowId: true
    })
  )
  const signedIn = yield* Effect.promise(() =>
    auth.api.signInEmail({ body: { email: member.email, password }, returnHeaders: true })
  )
  const cookie = cookieOf(signedIn.headers)
  const onSite = yield* Effect.promise(() => auth.api.getSession({ headers: new Headers({ cookie }) }))
  return {
    userId: signedUp.user.id,
    cookie,
    sessionEnds: O.map(O.fromNullOr(onSite), ({ session }) => DateTime.fromDateUnsafe(session.expiresAt))
  }
})
