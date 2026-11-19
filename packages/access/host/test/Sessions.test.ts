// The session answer as the host builds it, over the in-memory twins and a Better Auth that has nobody signed in:
// what the settings turn on is what the sign-in page is told, and a production build offers no test accounts.
import { BetterAuthTest } from "@beep/better-auth/BetterAuthTest"
import { expect, layer } from "@effect/vitest"
import { accessServices } from "@inventory/access-host/Host"
import { Sessions } from "@inventory/access-host/SessionIdentity"
import { accessMemory } from "@inventory/access-model/Memory"
import * as ConfigProvider from "effect/ConfigProvider"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as O from "effect/Option"

const app = (build: { readonly production: boolean }, settings: Record<string, string> = {}) =>
  accessServices(build).pipe(
    Layer.provide(accessMemory()),
    Layer.provide(BetterAuthTest.signedOut),
    Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown(settings)))
  )
const answer = Effect.flatMap(Sessions, (sessions) => sessions.state(new Headers()))

layer(app({ production: false }))("a development build", (it) => {
  it.effect("offers the test accounts the database holds (none here) and skips the breach check", () =>
    Effect.gen(function* () {
      const state = yield* answer
      expect(state.status).toBe("signed-out")
      expect(O.map(state.features.testAccounts, (offer) => offer.accounts)).toEqual(O.some([]))
      expect(state.features.pwnedPasswordCheck).toBe(false)
    })
  )
})

layer(app({ production: true }))("a production build", (it) => {
  it.effect("offers no test accounts and checks new passwords against known breaches", () =>
    Effect.gen(function* () {
      const state = yield* answer
      expect([state.features.testAccounts, state.features.pwnedPasswordCheck]).toEqual([O.none(), true])
    })
  )
})

layer(app({ production: true }, { TEST_ACCOUNTS: "true", PWNED_PASSWORD_CHECK: "false" }))("the settings", (it) => {
  it.effect("win over the build's defaults", () =>
    Effect.gen(function* () {
      const state = yield* answer
      expect([O.isSome(state.features.testAccounts), state.features.pwnedPasswordCheck]).toEqual([true, false])
    })
  )
})
