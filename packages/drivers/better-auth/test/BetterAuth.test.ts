// The secret policy (a guessable key never signs sessions in production), the session answer as Better Auth gives it,
// and what a span may carry.
import { assertSome, assertFailure } from "@effect/vitest/utils"
import { describe, expect, it } from "@effect/vitest"
import * as Arbitrary from "effect/Arbitrary"
import * as DateTime from "effect/DateTime"
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
  authSessionOf,
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
  /** The end Better Auth gives a session, as a `Date`, and the same moment as the driver reads it. */
  const endsAt = DateTime.makeUnsafe("2026-12-04T09:30:00.000Z")
  const ends = endsAt.pipe(DateTime.toDateUtc)
  const session = (fields: Record<string, unknown>) => ({
    session: { userId: "u1", expiresAt: ends, ...fields },
    user: { email: "dana@example-works.test" }
  })
  it.effect("reads nobody, an account in no organization, and one with an organization", () =>
    Effect.gen(function* () {
      const nobody = yield* decode(null)
      expect(nobody).toEqual(O.none())
      const none = yield* decode(session({}))
      assertSome(none, {
        session: { userId: AuthUserId.make("u1"), activeOrganizationId: O.none(), expiresAt: endsAt },
        user: { email: "dana@example-works.test" }
      })
      const cleared = yield* decode(session({ activeOrganizationId: null }))
      assertSome(cleared, {
        session: { userId: AuthUserId.make("u1"), activeOrganizationId: O.none(), expiresAt: endsAt },
        user: { email: "dana@example-works.test" }
      })
      const chosen = yield* decode(session({ activeOrganizationId: "org_prairie" }))
      assertSome(chosen, {
        session: {
          userId: AuthUserId.make("u1"),
          activeOrganizationId: O.some(AuthOrganizationId.make("org_prairie")),
          expiresAt: endsAt
        },
        user: { email: "dana@example-works.test" }
      })
    })
  )

  it.effect("hands its host the session with when it ends, and nobody as none", () =>
    Effect.gen(function* () {
      const signedIn = yield* authSessionOf(session({ activeOrganizationId: "org_prairie" }))
      assertSome(
        signedIn,
        AuthSession.make({
          userId: AuthUserId.make("u1"),
          email: AuthEmail.make("dana@example-works.test"),
          activeOrganizationId: O.some(AuthOrganizationId.make("org_prairie")),
          expiresAt: endsAt
        })
      )
      const nobody = yield* authSessionOf(null)
      expect(nobody).toEqual(O.none())
    })
  )

  it.effect("refuses an answer whose session has no end", () =>
    Effect.gen(function* () {
      const refused = yield* Effect.flip(authSessionOf({ session: { userId: "u1" }, user: { email: "a@b.test" } }))
      expect(refused).toBeInstanceOf(S.SchemaError)
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
