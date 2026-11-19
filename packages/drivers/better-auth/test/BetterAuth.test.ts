// The secret policy (a guessable key never signs sessions in production), the session answer as Better Auth gives it,
// and what a span may carry.
import { describe, expect, it } from "@effect/vitest"
import * as Arbitrary from "effect/Arbitrary"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as Redacted from "effect/Redacted"
import * as Result from "effect/Result"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import { BetterAuthSettings } from "@beep/better-auth/BetterAuthConfig"
import {
  AuthEmail,
  AuthEndpoint,
  authEndpointOf,
  AuthOrganizationId,
  AuthSecret,
  AuthSession,
  AuthSessionAnswer,
  AuthUserId,
  resolveAuthSecret
} from "@beep/better-auth/BetterAuthSession"

const long = Redacted.make(Str.repeat(32)("k"))
const short = Redacted.make("too-short")

describe("resolveAuthSecret", () => {
  it("uses a configured secret of 32 characters or more, in any build", () => {
    for (const production of [true, false]) {
      const chosen = resolveAuthSecret({ secret: O.some(long), production })
      expect(Result.isSuccess(chosen) && chosen.success.kind).toBe("configured")
    }
  })
  it("refuses a missing or short secret in production, naming which", () => {
    const missing = resolveAuthSecret({ secret: O.none(), production: true })
    const tooShort = resolveAuthSecret({ secret: O.some(short), production: true })
    expect(Result.isFailure(missing) && missing.failure.problem).toBe("missingSecret")
    expect(Result.isFailure(tooShort) && tooShort.failure.problem).toBe("shortSecret")
    expect(Result.isFailure(missing) && missing.failure.message).toContain(
      "BETTER_AUTH_SECRET is not set. Set it with `wrangler secret put BETTER_AUTH_SECRET`"
    )
  })
  it("makes an ephemeral one in development", () => {
    const chosen = resolveAuthSecret({ secret: O.some(short), production: false })
    expect(Result.isSuccess(chosen) && chosen.success.kind).toBe("ephemeral")
  })
})

describe("the session answer", () => {
  const decode = S.decodeUnknownEffect(AuthSessionAnswer)
  it.effect("reads nobody, an account in no organization, and one with an organization", () =>
    Effect.gen(function* () {
      const nobody = yield* decode(null)
      expect(nobody).toBeNull()
      const none = yield* decode({ session: { userId: "u1" }, user: { email: "dana@example-works.test" } })
      expect(none !== null && O.isNone(none.session.activeOrganizationId)).toBe(true)
      const cleared = yield* decode({
        session: { userId: "u1", activeOrganizationId: null },
        user: { email: "dana@example-works.test" }
      })
      expect(cleared !== null && O.isNone(cleared.session.activeOrganizationId)).toBe(true)
      const chosen = yield* decode({
        session: { userId: "u1", activeOrganizationId: "org_prairie" },
        user: { email: "dana@example-works.test" }
      })
      expect(chosen?.session.activeOrganizationId).toEqual(O.some("org_prairie"))
    })
  )
})

describe("a span's endpoint", () => {
  it("is the path under the base path, never the query", () => {
    expect(authEndpointOf({ url: "https://app.example/api/auth/sign-in/email?email=x", basePath: "/api/auth" })).toBe(
      "/sign-in/email"
    )
  })
})

describe("every schema generates only valid values", () => {
  const schemas = {
    AuthUserId,
    AuthOrganizationId,
    AuthEmail,
    AuthEndpoint,
    AuthSession,
    AuthSecret,
    BetterAuthSettings
  }
  for (const [name, schema] of R.toEntries(schemas)) {
    it.prop(
      name,
      [Arbitrary.schema(schema as S.Top)],
      ([value]) => {
        expect(S.is(schema as S.Top)(value)).toBe(true)
      },
      { arbitrary: { runs: 50 } }
    )
  }
})
