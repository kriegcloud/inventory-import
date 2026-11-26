// Who may make an account (decision "infra I8"): nobody the owner has not named, however the setting is written.
import { expect, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Arbitrary from "effect/Arbitrary"
import * as S from "effect/Schema"
import { mayCreateAccount, SignUpEmail, SignUpSetting, signUpOfferOf } from "@inventory/access-model/SignUp"

it.effect("opens only an exact open setting and closes empty or mistyped settings", () =>
  Effect.gen(function* () {
    const email = yield* S.decodeEffect(SignUpEmail)("ada@example.com")
    for (const setting of ["open", " OPEN ", "closed", "", "  ", "opne", "true", "no", "open,open"]) {
      const rule = yield* S.decodeEffect(SignUpSetting)(setting)
      const opens = setting === "open" || setting === " OPEN "
      expect([setting, mayCreateAccount(rule, email)]).toEqual([setting, opens])
      expect([setting, signUpOfferOf(rule)]).toEqual([setting, opens ? "open" : "closed"])
    }
    const mixed = yield* S.decodeEffect(SignUpSetting)("open ada@example.com")
    const stranger = yield* S.decodeEffect(SignUpEmail)("anyone@example.com")
    expect(mayCreateAccount(mixed, stranger)).toBe(false)
    expect(signUpOfferOf(mixed)).toBe("invited")
  })
)

it.effect("admits only named emails after the boundary trims and folds case", () =>
  Effect.gen(function* () {
    const rule = yield* S.decodeEffect(SignUpSetting)("Ada@Example.com,bo@example.com\n cy@example.com")
    expect(signUpOfferOf(rule)).toBe("invited")
    for (const text of ["ada@example.com", " ADA@EXAMPLE.COM ", "bo@example.com", "cy@example.com"]) {
      const key = yield* S.decodeEffect(SignUpEmail)(text)
      expect(mayCreateAccount(rule, key)).toBe(true)
    }
    for (const text of ["dee@example.com", "ada@example.co", "@example.com", ""]) {
      const key = yield* S.decodeEffect(SignUpEmail)(text)
      expect(mayCreateAccount(rule, key)).toBe(false)
    }
  })
)

it.effect("normalizes repeated separators, Unicode whitespace and duplicate email case without widening signup", () =>
  Effect.gen(function* () {
    const rule = yield* S.decodeEffect(SignUpSetting)(
      "\u00a0Ada@Example.com,,\tADA@example.com \n Bo@Example.com\u3000"
    )
    const key = yield* S.decodeEffect(SignUpEmail)("\u3000BO@EXAMPLE.COM\u00a0")
    expect(rule).toEqual({ kind: "invited", emails: ["ada@example.com", "bo@example.com"] })
    expect(mayCreateAccount(rule, key)).toBe(true)
    const mixed = yield* S.decodeEffect(SignUpSetting)("open,ADA@example.com")
    expect(signUpOfferOf(mixed)).toBe("invited")
  })
)

it.prop("generates only normalized admission keys", [Arbitrary.schema(SignUpEmail)], ([key]) => {
  expect(S.is(SignUpEmail)(key)).toBe(true)
})
