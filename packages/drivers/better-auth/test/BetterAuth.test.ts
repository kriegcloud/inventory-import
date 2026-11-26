// The secret policy (a guessable key never signs sessions in production), the session answer as Better Auth gives it,
// and what a span may carry.
import { assertSome, assertFailure } from "@effect/vitest/utils"
import { describe, expect, it } from "@effect/vitest"
import * as Arbitrary from "effect/Arbitrary"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import { BetterAuthConfigError } from "@beep/better-auth/BetterAuthError"
import { BetterAuthSettings, PublicUrl } from "@beep/better-auth/BetterAuthConfig"
import {
  AuthDriverOptions,
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

describe("resolveAuthSecret", () => {
  it("says how to set a missing secret in production", () => {
    const missing = resolveAuthSecret({ secret: O.none(), production: true })
    assertFailure(missing, BetterAuthConfigError.make({ problem: "missingSecret" }))
    expect(missing.failure.message).toContain(
      "BETTER_AUTH_SECRET is not set. Set it with `wrangler secret put BETTER_AUTH_SECRET`"
    )
  })
})

describe("driver options", () => {
  it.effect("reads the usual base path only when absent, and preserves a custom path", () =>
    Effect.gen(function* () {
      const usual = yield* S.decodeEffect(AuthDriverOptions)({})
      const custom = yield* S.decodeEffect(AuthDriverOptions)({ basePath: "/accounts" })
      const nullPath = yield* S.decodeEffect(AuthDriverOptions)({ basePath: null })
      const emptyPath = yield* S.decodeEffect(AuthDriverOptions)({ basePath: "" })
      expect(usual).toEqual({ basePath: "/api/auth" })
      expect(custom).toEqual({ basePath: "/accounts" })
      expect(nullPath).toEqual(usual)
      expect(emptyPath).toEqual({ basePath: "" })
    })
  )
})

describe("the session answer", () => {
  const decode = S.decodeUnknownEffect(AuthSessionAnswer)
  it.effect("reads nobody, an account in no organization, and one with an organization", () =>
    Effect.gen(function* () {
      const nobody = yield* decode(null)
      expect(nobody).toEqual(O.none())
      const none = yield* decode({ session: { userId: "u1" }, user: { email: "dana@example-works.test" } })
      assertSome(none, {
        session: { userId: AuthUserId.make("u1"), activeOrganizationId: O.none() },
        user: { email: "dana@example-works.test" }
      })
      expect(none.value.session.activeOrganizationId).toEqual(O.none())
      const cleared = yield* decode({
        session: { userId: "u1", activeOrganizationId: null },
        user: { email: "dana@example-works.test" }
      })
      assertSome(cleared, {
        session: { userId: AuthUserId.make("u1"), activeOrganizationId: O.none() },
        user: { email: "dana@example-works.test" }
      })
      expect(cleared.value.session.activeOrganizationId).toEqual(O.none())
      const chosen = yield* decode({
        session: { userId: "u1", activeOrganizationId: "org_prairie" },
        user: { email: "dana@example-works.test" }
      })
      assertSome(chosen, {
        session: {
          userId: AuthUserId.make("u1"),
          activeOrganizationId: O.some(AuthOrganizationId.make("org_prairie"))
        },
        user: { email: "dana@example-works.test" }
      })
      expect(chosen.value.session.activeOrganizationId).toEqual(O.some("org_prairie"))
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

const runs = { arbitrary: { runs: 50 } }

/** `schema` generates only values it accepts. */
const generatesOnlyValid = <Schema extends S.Top>(name: string, schema: Schema) =>
  it.prop(
    name,
    [Arbitrary.schema(schema)],
    ([value]) => {
      expect(S.is(schema)(value)).toBe(true)
    },
    runs
  )

describe("every schema generates only valid values", () => {
  generatesOnlyValid("AuthDriverOptions", AuthDriverOptions)
  generatesOnlyValid("AuthUserId", AuthUserId)
  generatesOnlyValid("AuthOrganizationId", AuthOrganizationId)
  generatesOnlyValid("AuthEmail", AuthEmail)
  generatesOnlyValid("AuthEndpoint", AuthEndpoint)
  generatesOnlyValid("AuthSession", AuthSession)
  generatesOnlyValid("AuthSecret", AuthSecret)
  generatesOnlyValid("BetterAuthSettings", BetterAuthSettings)
  generatesOnlyValid("PublicUrl", PublicUrl)
})
