// The browser's five calls against a real Better Auth (in memory, its handler in place of the network): what it did is
// an Effect that ends, and what it refused is a `BetterAuthRefused` carrying its status and its own sentence.
import { describe, it } from "@effect/vitest"
import { assertNone, assertSome } from "@effect/vitest/utils"
import { makeBetterAuthClient } from "@beep/better-auth/Client"
import { Credentials, NewAccount, NewOrganization } from "@beep/better-auth/ClientSchema"
import { betterAuth } from "better-auth"
import { memoryAdapter } from "better-auth/adapters/memory"
import { organization } from "better-auth/plugins/organization"
import * as Effect from "effect/Effect"
import { makeBrowserClient } from "../src/internal/browserClient.ts"

const origin = "http://localhost"

/** A page's client whose requests go straight to a fresh Better Auth: no network, and no cookie jar. */
const page = () => {
  const auth = betterAuth({
    baseURL: origin,
    secret: "a-test-secret-long-enough-for-better-auth",
    database: memoryAdapter({ user: [], session: [], account: [], verification: [], member: [], organization: [] }),
    emailAndPassword: { enabled: true, minPasswordLength: 12 },
    rateLimit: { enabled: false },
    plugins: [organization()]
  })
  return makeBetterAuthClient(
    Effect.sync(() =>
      makeBrowserClient({
        baseURL: origin,
        fetchOptions: { customFetchImpl: (input, init) => auth.handler(new Request(input, init)) }
      })
    )
  )
}

const dana = NewAccount.make({ name: "Dana", email: "dana@example-works.test", password: "a-long-password" })

describe("Better Auth's browser client as Effects", () => {
  it.effect("makes an account and signs it in again", () =>
    Effect.gen(function* () {
      const auth = page()
      yield* auth.preload
      yield* auth.signUp(dana)
      yield* auth.signIn(Credentials.make({ email: dana.email, password: dana.password }))
    })
  )

  it.effect("fails a wrong password with Better Auth's status and sentence", () =>
    Effect.gen(function* () {
      const auth = page()
      yield* auth.signUp(dana)
      const refused = yield* Effect.flip(auth.signIn(Credentials.make({ email: dana.email, password: "not-the-one" })))
      assertSome(refused.status, 401)
      assertSome(refused.sentence, "Invalid email or password")
    })
  )

  it.effect("fails what needs a session when the browser sends none", () =>
    Effect.gen(function* () {
      const auth = page()
      const made = yield* Effect.flip(
        auth.createOrganization(NewOrganization.make({ name: "Example Works", slug: "example-works" }))
      )
      assertSome(made.status, 401)
      const chosen = yield* Effect.flip(auth.setActiveOrganization("org_prairie"))
      assertSome(chosen.status, 401)
    })
  )

  it.effect("fails with no status when no answer comes", () =>
    Effect.gen(function* () {
      const auth = makeBetterAuthClient(
        Effect.sync(() =>
          makeBrowserClient({
            baseURL: origin,
            fetchOptions: {
              customFetchImpl: () => {
                throw new TypeError("Failed to fetch")
              }
            }
          })
        )
      )
      const refused = yield* Effect.flip(auth.signOut)
      assertNone(refused.status)
      assertNone(refused.sentence)
    })
  )
})
