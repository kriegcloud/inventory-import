// Which secret signs the sessions: a set one exactly when it has 32 characters, so none anyone could guess in a few
// tries; otherwise production stops and development makes its own. Which addresses the service trusts is held where
// they are read (packages/access/host/test/AuthSettings.property.test.ts), and both schemas' arbitraries in
// BetterAuth.test.ts.
import { describe, expect, it } from "@effect/vitest"
import { resolveAuthSecret } from "@beep/better-auth/BetterAuthSession"
import * as Arbitrary from "effect/Arbitrary"
import * as O from "effect/Option"
import * as Redacted from "effect/Redacted"
import * as Result from "effect/Result"
import * as S from "effect/Schema"

const runs = { arbitrary: { runs: 300 } }

/** A secret as it may be set: any text, or one long enough, so both sides of the rule are drawn. */
const SecretText = S.Union([S.String, S.String.check(S.isMinLength(32))])

describe("the sign-in settings", () => {
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
        long
          ? "configured"
          : !production
            ? "ephemeral"
            : O.match(text, { onNone: () => "missingSecret", onSome: () => "shortSecret" })
      )
    },
    runs
  )
})
