import { expect, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import { testAccountPassword } from "@inventory/access-host/TestAccounts"
import { TooManyRequests } from "@inventory/kernel/AccessError"
import { AddressLimit } from "../../src/server/AddressLimit.ts"
import { browser, signInApp, signInStart } from "./support/app.ts"

// The coarse limit in front of Better Auth's own routes, on the app as the Worker builds it (a real D1 database in
// workerd, the session identity, /api/auth/* beside the HttpApi). The counter is a stand-in that refuses one address:
// the question here is only whether a refused request reaches Better Auth, and whether another address signs in.

const refusedAddress = "10.0.0.66"

const RefusesOne = Layer.succeed(
  AddressLimit,
  AddressLimit.of({
    take: Effect.fn("test.take")((key: string) => Effect.succeed(key !== `localhost ${refusedAddress}`))
  })
)

const dana = { email: "dana@example-works.test", password: testAccountPassword }

layer(signInApp({ ...signInStart, limit: RefusesOne }), { timeout: "60 seconds" })(
  "the coarse limit in front of sign-in",
  (it) => {
    it.effect("refuses a sign-in and a sign-up from the address before Better Auth sees them", () =>
      Effect.gen(function* () {
        const refused = browser(refusedAddress)
        const signIn = yield* refused.send("POST", "/api/auth/sign-in/email", O.some(dana), {})
        expect(signIn.status).toBe(429)
        // The app's own refusal, not Better Auth's: it decodes as one, or the test stops here.
        const refusal = yield* S.decodeUnknownEffect(TooManyRequests)(signIn.json)
        expect(refusal.reason).toBe("Too many attempts from this address. Wait a minute, then try again.")
        // The right password signed nobody in.
        expect(refused.cookie()).toBe("")
        const signUp = yield* refused.send(
          "POST",
          "/api/auth/sign-up/email",
          O.some({ name: "Ada Park", email: "ada@example.test", password: "a long enough password" }),
          {}
        )
        expect(signUp.status).toBe(429)
        // A read of the session is not counted, so the refused address still learns it is signed out.
        const session = yield* refused.send("GET", "/api/auth/get-session", O.none(), {})
        expect(session.status).toBe(200)
      })
    )

    it.effect("another address signs in", () =>
      Effect.gen(function* () {
        const other = browser("10.0.0.67")
        const signIn = yield* other.send("POST", "/api/auth/sign-in/email", O.some(dana), {})
        expect(signIn.status).toBe(200)
        expect(other.cookie()).not.toBe("")
      })
    )
  }
)
