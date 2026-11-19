import { expect, layer } from "@effect/vitest"
import { testAccountPassword } from "@inventory/access-host/TestAccounts"
import * as Effect from "effect/Effect"
import { browser, signInApp } from "./support/app.ts"

// The test accounts on a deployed test or preview stage (decision "infra, the test accounts' password"), through the
// Worker's own composition on a real D1 database seeded the way such a stage is: the stage's own password opens them,
// the one written in the repository opens nothing, nobody can sign up, and the page is told to offer no account.

const stagePassword = "9c41d0aa72e6b3f5d2a17c08"
const dana = "dana@example-works.test"

layer(signInApp({ production: true, settings: { TEST_ACCOUNT_PASSWORD: stagePassword } }), { timeout: "60 seconds" })(
  "a production build with a preview stage's settings",
  (it) => {
    it.effect("signs a test account in with the stage's password and not with the repository's", () =>
      Effect.gen(function* () {
        const stranger = browser("10.0.3.1")
        const known = yield* stranger.send("POST", "/api/auth/sign-in/email", {
          email: dana,
          password: testAccountPassword
        })
        expect(known.status).toBe(401)

        const reviewer = browser("10.0.3.2")
        const minted = yield* reviewer.send("POST", "/api/auth/sign-in/email", { email: dana, password: stagePassword })
        expect(minted.status).toBe(200)
        const me = yield* reviewer.send("GET", "/api/v1/identity/me")
        expect(me.json).toMatchObject({ role: "admin", organizationName: "Example Works (test)" })
      })
    )

    it.effect("makes no account for anyone, and tells the page to offer no test account and no sign-up", () =>
      Effect.gen(function* () {
        const stranger = browser("10.0.3.3")
        const refused = yield* stranger.send("POST", "/api/auth/sign-up/email", {
          name: "Ada Park",
          email: "ada@example.test",
          password: "a long enough password"
        })
        expect(refused.status).toBe(403)
        const page = yield* stranger.send("GET", "/api/v1/identity/session")
        expect(page.json).toMatchObject({ status: "signed-out", features: { signUp: "closed" } })
        expect(page.json.features.testAccounts).toBeNull()
        // Not even when the setting that offers them is on: the page would have to hand out the password.
      })
    )
  }
)

layer(signInApp({ production: true, settings: { TEST_ACCOUNT_PASSWORD: stagePassword, TEST_ACCOUNTS: "true" } }), {
  timeout: "60 seconds"
})("a stage with its own password and TEST_ACCOUNTS on", (it) => {
  it.effect("still offers no test account in one click", () =>
    Effect.gen(function* () {
      const page = yield* browser("10.0.3.4").send("GET", "/api/v1/identity/session")
      expect(page.json.features.testAccounts).toBeNull()
    })
  )
})

layer(signInApp({ production: true }), { timeout: "60 seconds" })(
  "a build with no stage password, as on a developer's machine",
  (it) => {
    it.effect("signs a test account in with the repository's password, as before", () =>
      Effect.gen(function* () {
        const signIn = yield* browser("10.0.3.5").send("POST", "/api/auth/sign-in/email", {
          email: dana,
          password: testAccountPassword
        })
        expect(signIn.status).toBe(200)
      })
    )
  }
)
