/**
 * Better Auth stand-ins for tests that do not sign in for real: nobody signed in, or one fixed session. Real sign-in on
 * a test database is the host's composition of `BetterAuth.layer` with its own options.
 *
 * @packageDocumentation
 */
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as O from "effect/Option"
import type { AuthSession } from "./BetterAuth.schema.ts"
import { BetterAuth } from "./BetterAuth.service.ts"

/**
 * Better Auth test layers.
 *
 * @category layers
 */
export class BetterAuthTest {
  private constructor() {}

  /** Nobody is ever signed in, and every /api/auth request answers 404. */
  static readonly signedOut: Layer.Layer<BetterAuth> = Layer.succeed(
    BetterAuth,
    BetterAuth.of({
      handle: Effect.fn("BetterAuth.handle")(function* () {
        return new Response(null, { status: 404 })
      }),
      session: Effect.fn("BetterAuth.session")(function* () {
        return O.none()
      }),
      publicOrigin: O.none()
    })
  )

  /** Every request carries `session`; /api/auth requests answer 404. */
  static readonly signedIn = (session: AuthSession): Layer.Layer<BetterAuth> =>
    Layer.succeed(
      BetterAuth,
      BetterAuth.of({
        handle: Effect.fn("BetterAuth.handle")(function* () {
          return new Response(null, { status: 404 })
        }),
        session: Effect.fn("BetterAuth.session")(function* () {
          return O.some(session)
        }),
        publicOrigin: O.none()
      })
    )
}
