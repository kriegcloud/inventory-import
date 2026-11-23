// The sign-in settings as the host reads them from its environment. A stage's password for its test accounts is
// never the one written in the repository, so that one opens nothing on a deployed stage; a blank one is none; and the
// public address is read only as an http(s) origin, all of it.
import { describe, expect, it } from "@effect/vitest"
import { authSettings } from "@inventory/access-host/Config"
import { testAccountPassword } from "@inventory/access-host/TestAccounts"
import { passwordToVerify } from "@inventory/access-model/StagePassword"
import * as Arbitrary from "effect/Arbitrary"
import * as ConfigProvider from "effect/ConfigProvider"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as Redacted from "effect/Redacted"
import * as Result from "effect/Result"
import * as S from "effect/Schema"
import * as Str from "effect/String"

const runs = { arbitrary: { runs: 200 } }

/** A password a stage may be given: the repository's own, or any other text. */
const Given = S.Union([S.Literal(testAccountPassword), S.String])

/** The settings read from `values`, or why they cannot be. */
const read = (values: Readonly<Record<string, string>>, production: boolean) =>
  authSettings({ production }).parse(ConfigProvider.fromUnknown(values)).pipe(Effect.result)

describe("the sign-in settings as read", () => {
  it.effect.prop(
    "a stage's password is read only when the repository's password opens nothing with it, and blank is none",
    [Arbitrary.schema(Given), Arbitrary.schema(S.Boolean)],
    ([given, production]) =>
      Effect.gen(function* () {
        const settings = yield* read({ TEST_ACCOUNT_PASSWORD: given }, production)
        expect(Result.isFailure(settings)).toBe(given === testAccountPassword)
        if (Result.isSuccess(settings)) {
          const stage = O.map(settings.success.testAccountPassword, Redacted.value)
          expect(O.isNone(stage)).toBe(Str.trim(given) === "")
          if (O.isSome(stage)) {
            const opened = passwordToVerify({ stage, repository: testAccountPassword, typed: testAccountPassword })
            expect(O.isNone(opened)).toBe(true)
          }
        }
      }),
    runs
  )

  it.effect.prop(
    "a public address is read only when it is an http(s) origin and nothing more",
    [Arbitrary.schema(S.URL), Arbitrary.schema(S.Boolean)],
    ([url, production]) =>
      Effect.gen(function* () {
        const settings = yield* read({ BETTER_AUTH_URL: url.href }, production)
        const origin = /^https?:\/\/[^/?#@]+$/.test(url.origin) && url.href === `${url.origin}/`
        expect(Result.isSuccess(settings)).toBe(origin)
      }),
    runs
  )
})
