import { expect, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as R from "effect/Record"
import { browser, signInApp } from "./support/app.ts"

// Closed sign-up end to end (decision "infra I8"), through the Worker's own composition on a real D1 database: a
// production build makes no account for anyone the owner has not named, by any route, and the person he names makes
// their account and is the admin of the organization they create.

// The sentence a refused person reads, as written in the access model.
const signUpClosedMessage =
  "New accounts are not open here. Ask the person who runs this app to add your email, then try again."

const person = (email: string) => ({ name: "Ada Park", email, password: "a long enough password" })

layer(signInApp({ production: true }), { timeout: "60 seconds" })(
  "a production build with no SIGN_UP setting",
  (it) => {
    it.effect("refuses a sign-up, says why, makes no account, and tells the page not to offer one", () =>
      Effect.gen(function* () {
        const ada = browser("10.0.1.1")
        const refused = yield* ada.send("POST", "/api/auth/sign-up/email", person("ada@example.test"))
        expect(refused.status).toBe(403)
        expect(refused.json.message).toBe(signUpClosedMessage)
        const signIn = yield* ada.send("POST", "/api/auth/sign-in/email", {
          email: "ada@example.test",
          password: "a long enough password"
        })
        expect(signIn.status).toBe(401)
        const session = yield* ada.send("GET", "/api/v1/identity/session")
        expect(session.json).toMatchObject({ status: "signed-out", features: { signUp: "closed" } })
      })
    )
  }
)

layer(
  signInApp({
    production: true,
    settings: { SIGN_UP: "Owner@Example.test, second@example.test" }
  }),
  { timeout: "60 seconds" }
)("a production build whose owner named two emails", (it) => {
  it.effect("makes the first admin of an organization from a named email, and refuses any other", () =>
    Effect.gen(function* () {
      const stranger = browser("10.0.2.1")
      const refused = yield* stranger.send("POST", "/api/auth/sign-up/email", person("stranger@example.test"))
      expect(refused.status).toBe(403)
      expect(refused.json.message).toBe(signUpClosedMessage)
      const page = yield* stranger.send("GET", "/api/v1/identity/session")
      expect(page.json).toMatchObject({ status: "signed-out", features: { signUp: "invited" } })
      // The emails themselves are not told to the browser.
      expect(R.keys(page.json.features)).toEqual(["testAccounts", "pwnedPasswordCheck", "signUp"])

      const owner = browser("10.0.2.2")
      const made = yield* owner.send("POST", "/api/auth/sign-up/email", person("owner@example.test"))
      expect(made.status).toBe(200)
      const created = yield* owner.send("POST", "/api/auth/organization/create", {
        name: "Owner Works",
        slug: "owner-works"
      })
      expect(created.status).toBe(200)
      const me = yield* owner.send("GET", "/api/v1/identity/me")
      expect(me.json).toMatchObject({ role: "admin", organizationName: "Owner Works" })
    })
  )
})
