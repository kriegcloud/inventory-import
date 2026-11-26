// Better Auth's optional configuration stays compatible at its boundary, including the callback hooks.
import { describe, expect, it } from "@effect/vitest"
import { assertDefined } from "@effect/vitest/utils"
import { authOptions } from "@inventory/access-host/AuthOptions"
import { betterAuth } from "better-auth"
import { memoryAdapter } from "better-auth/adapters/memory"
import { hashPassword } from "better-auth/crypto"
import * as O from "effect/Option"
import * as Effect from "effect/Effect"
import * as DateTime from "effect/DateTime"

const database = () =>
  memoryAdapter({ user: [], session: [], account: [], verification: [], member: [], organization: [] })
const choices = {
  baseURL: O.none(),
  secureCookies: false,
  pwnedPasswordCheck: false,
  rateLimit: true,
  mayCreateAccount: O.none(),
  passwordToVerify: O.none(),
  backgroundTasks: O.none()
}
const secret = "a-test-secret-long-enough-for-better-auth"

const user = {
  id: "user",
  name: "Ada",
  email: "ada@example.test",
  emailVerified: false,
  createdAt: DateTime.makeUnsafe(0).pipe(DateTime.toDateUtc),
  updatedAt: DateTime.makeUnsafe(0).pipe(DateTime.toDateUtc)
}
const session = {
  id: "session",
  userId: "user",
  token: "token",
  expiresAt: DateTime.makeUnsafe(1000).pipe(DateTime.toDateUtc),
  createdAt: DateTime.makeUnsafe(0).pipe(DateTime.toDateUtc),
  updatedAt: DateTime.makeUnsafe(0).pipe(DateTime.toDateUtc),
  extra: "preserved"
}

describe("Better Auth configuration boundary", () => {
  it("omits third-party optional keys for explicit None choices", () => {
    const options = authOptions({ ...choices, database: database(), secret })
    expect(options).not.toHaveProperty("baseURL")
    expect(options.trustedOrigins).toEqual([])
    expect(options.rateLimit.enabled).toBe(true)
    expect(options.advanced.useSecureCookies).toBe(false)
    expect(options.advanced).not.toHaveProperty("backgroundTasks")
    expect(options.emailAndPassword).not.toHaveProperty("password")
  })

  it("forwards explicit flags, configured URL and background handler", () => {
    const handler = () => {}
    const configured = authOptions({
      ...choices,
      database: database(),
      secret,
      baseURL: O.some("https://inventory.example.test"),
      secureCookies: true,
      pwnedPasswordCheck: true,
      rateLimit: false,
      backgroundTasks: O.some(handler)
    })
    expect(configured.baseURL).toBe("https://inventory.example.test")
    expect(configured.trustedOrigins).toEqual(["https://inventory.example.test"])
    expect(configured.rateLimit.enabled).toBe(false)
    expect(configured.advanced.useSecureCookies).toBe(true)
    expect(configured.advanced.backgroundTasks?.handler).toBe(handler)
  })

  it.effect("permits an absent signup predicate, consults a supplied predicate and rejects refused accounts", () =>
    Effect.gen(function* () {
      const open = authOptions({ ...choices, database: database(), secret })
      yield* Effect.promise(() => open.databaseHooks.user.create.before(user))
      const invited = authOptions({
        ...choices,
        database: database(),
        secret,
        mayCreateAccount: O.some((email) => email === user.email)
      })
      yield* Effect.promise(() => invited.databaseHooks.user.create.before(user))
      yield* Effect.promise(() =>
        expect(
          invited.databaseHooks.user.create.before({ ...user, email: "other@example.test" })
        ).rejects.toMatchObject({ status: "FORBIDDEN" })
      )
    })
  )

  it.effect("refuses an absent selected password and verifies the selected value against the stored hash", () =>
    Effect.gen(function* () {
      const hash = yield* Effect.promise(() => hashPassword("held-password"))
      const options = authOptions({
        ...choices,
        database: database(),
        secret,
        passwordToVerify: O.some((typed) => (typed === "stage-password" ? O.some("held-password") : O.none()))
      })
      const password = options.emailAndPassword.password
      assertDefined(password)
      const verify = password.verify
      assertDefined(verify)
      const accepted = yield* Effect.promise(() => verify({ hash, password: "stage-password" }))
      expect(accepted).toBe(true)
      const refused = yield* Effect.promise(() => verify({ hash, password: "held-password" }))
      expect(refused).toBe(false)
    })
  )

  it.effect("leaves a session untouched when Better Auth supplies no context", () =>
    Effect.gen(function* () {
      const options = authOptions({ ...choices, database: database(), secret })
      const answer = yield* Effect.promise(() => options.databaseHooks.session.create.before(session, null))
      expect(answer).toBeUndefined()
      expect(session.extra).toBe("preserved")
    })
  )

  it.effect("selects the earliest membership on real sign-in and retains Better Auth's session fields", () =>
    Effect.gen(function* () {
      const store: Record<string, Array<Record<string, unknown>>> = {
        user: [],
        session: [],
        account: [],
        verification: [],
        member: [],
        organization: []
      }
      const auth = betterAuth(authOptions({ ...choices, database: memoryAdapter(store), secret, rateLimit: false }))
      const signedUp = yield* Effect.promise(() =>
        auth.api.signUpEmail({ body: { name: "Ada", email: user.email, password: "my-long-password" } })
      )
      expect(store["session"]).toEqual([expect.not.objectContaining({ activeOrganizationId: expect.anything() })])
      store["member"] = [
        {
          id: "late",
          userId: signedUp.user.id,
          organizationId: "org_late",
          role: "viewer",
          createdAt: DateTime.makeUnsafe(2000).pipe(DateTime.toDateUtc)
        },
        {
          id: "first",
          userId: signedUp.user.id,
          organizationId: "org_first",
          role: "admin",
          createdAt: DateTime.makeUnsafe(1000).pipe(DateTime.toDateUtc)
        }
      ]
      const signedIn = yield* Effect.promise(() =>
        auth.api.signInEmail({
          body: { email: user.email, password: "my-long-password" },
          headers: new Headers({ "user-agent": "session-parity-test" })
        })
      )
      expect(store["session"]).toContainEqual(
        expect.objectContaining({
          userId: signedUp.user.id,
          token: signedIn.token,
          activeOrganizationId: "org_first",
          id: expect.any(String),
          expiresAt: expect.any(Date),
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
          userAgent: "session-parity-test"
        })
      )
    })
  )
})
