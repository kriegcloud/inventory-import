import { expect, layer } from "@effect/vitest"
import { Array as Arr, Effect, String as Str } from "effect"
import { pwnedPasswordMessage } from "../../src/server/authOptions.ts"
import { browser, signInApp } from "./support/app.ts"

// The breach check against the real Have I Been Pwned service, through the Worker's own composition with
// PWNED_PASSWORD_CHECK on (network needed; `bun run check:full`). Only the first five characters of each password's
// SHA-1 hash leave this machine, exactly as in production.

layer(signInApp({ settings: { PWNED_PASSWORD_CHECK: "true" } }), { timeout: "60 seconds" })(
  "the breach check against the real service",
  (it) => {
    it.effect("refuses a password from known breaches and accepts a strong one", () =>
      Effect.gen(function* () {
        const refused = yield* browser("10.4.0.1").send("POST", "/api/auth/sign-up/email", {
          name: "Breached Password",
          email: "breached@example.test",
          password: "password1234"
        })
        expect([refused.status, refused.json.message]).toEqual([400, pwnedPasswordMessage])

        // Twenty random bytes as hex: a password no breach can have held.
        const strong = Arr.join(
          Arr.map(Arr.fromIterable(crypto.getRandomValues(new Uint8Array(20))), (byte) =>
            Str.padStart(2, "0")(byte.toString(16))
          ),
          ""
        )
        const accepted = yield* browser("10.4.0.2").send("POST", "/api/auth/sign-up/email", {
          name: "Strong Password",
          email: "strong@example.test",
          password: strong
        })
        expect(accepted.status).toBe(200)
      })
    )
  }
)
