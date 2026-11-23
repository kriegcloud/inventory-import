// What the sign-in settings let the service do. A session is never signed with a secret anyone could guess in a few
// tries, and the one address the service trusts is an origin on the web, all of it: nothing past the origin is
// dropped without a word, and no `file:` address, whose origin is "null", is trusted.
import { describe, expect, it } from "@effect/vitest"
import { BetterAuthSettings } from "@beep/better-auth/BetterAuthConfig"
import { AuthSecret, resolveAuthSecret } from "@beep/better-auth/BetterAuthSession"
import * as Arbitrary from "effect/Arbitrary"
import * as O from "effect/Option"
import * as Redacted from "effect/Redacted"
import * as Result from "effect/Result"
import * as S from "effect/Schema"

const runs = { arbitrary: { runs: 300 } }

/** A secret as it may be set: any text, or one long enough, so both sides of the rule are drawn. */
const SecretText = S.Union([S.String, S.String.check(S.isMinLength(32))])

/** An origin on the web as it is written: http or https, a host, and nothing after it. */
const webOrigin = /^https?:\/\/[^/?#@]+$/

describe("the sign-in settings", () => {
  it.prop(
    "a session is never signed with a configured secret shorter than 32 characters",
    [Arbitrary.schema(AuthSecret)],
    ([choice]) => {
      const length = AuthSecret.match(choice, {
        configured: ({ secret }) => O.some(Redacted.value(secret).length),
        ephemeral: () => O.none()
      })
      expect(O.getOrElse(length, () => 32)).toBeGreaterThanOrEqual(32)
    },
    runs
  )

  it.prop(
    "a set secret is used exactly when it has 32 characters; otherwise production stops and development makes its own",
    [SecretText.pipe(S.Option, Arbitrary.schema), Arbitrary.schema(S.Boolean)],
    ([text, production]) => {
      const chosen = resolveAuthSecret({ secret: O.map(text, Redacted.make), production })
      const long = O.exists(text, (secret) => secret.length >= 32)
      const kind = Result.match(chosen, {
        onSuccess: (secret) => secret.kind,
        onFailure: (error) => error.problem
      })
      expect(kind).toBe(
        long ? "configured" : !production ? "ephemeral" : O.isNone(text) ? "missingSecret" : "shortSecret"
      )
    },
    runs
  )

  it.prop(
    "the address the service trusts is an origin on the web, and all of the configured address",
    [Arbitrary.schema(BetterAuthSettings)],
    ([settings]) => {
      O.match(settings.publicUrl, {
        onNone: () => undefined,
        onSome: (url) => {
          expect(webOrigin.test(url.origin)).toBe(true)
          expect(url.href).toBe(`${url.origin}/`)
        }
      })
    },
    runs
  )
})
