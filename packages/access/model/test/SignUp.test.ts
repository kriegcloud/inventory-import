// Who may make an account (decision "infra I8"): nobody the owner has not named, however the setting is written.
import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import { mayCreateAccount, signUpOfferOf, signUpRuleOf } from "@inventory/access-model/SignUp"

describe("who may make an account", () => {
  it("is anyone only when the setting is exactly open", () => {
    expect(mayCreateAccount(signUpRuleOf("open"), "anyone@example.com")).toBe(true)
    expect(signUpOfferOf(signUpRuleOf(" OPEN "))).toBe("open")
    // A value that only contains the word does not open it.
    expect(mayCreateAccount(signUpRuleOf("open ada@example.com"), "anyone@example.com")).toBe(false)
  })

  it("is nobody when it is closed, empty or mistyped", () => {
    for (const setting of ["closed", "", "  ", "opne", "true", "no"]) {
      expect([setting, mayCreateAccount(signUpRuleOf(setting), "ada@example.com")]).toEqual([setting, false])
      expect([setting, signUpOfferOf(signUpRuleOf(setting))]).toEqual([setting, "closed"])
    }
  })

  it("is the named emails only, whatever their case and however they are separated", () => {
    const rule = signUpRuleOf("Ada@Example.com,bo@example.com\n cy@example.com")
    expect(signUpOfferOf(rule)).toBe("invited")
    expect(
      A.map(["ada@example.com", " ADA@EXAMPLE.COM ", "bo@example.com", "cy@example.com"], (email) =>
        mayCreateAccount(rule, email)
      )
    ).toEqual([true, true, true, true])
    expect(
      A.map(["dee@example.com", "ada@example.co", "@example.com", ""], (email) => mayCreateAccount(rule, email))
    ).toEqual([false, false, false, false])
  })
})
