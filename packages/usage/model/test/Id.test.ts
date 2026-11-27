// The ids the usage model takes: an organization's and a member's text, never empty and at most 64 characters, so the
// prover tries only ids a real request can carry.
import { describe, expect, it } from "@effect/vitest"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import { Actor } from "../src/Actor/Actor.context.ts"
import { CallTaken, TakeCall } from "../src/Allowance/Allowance.aggregate.ts"

describe("the usage model's ids", () => {
  it("refuses an empty organization id on a command, an event and an actor", () => {
    // A case's own `make` checks its fields: an id it refuses is never built.
    expect(() => TakeCall.make({ organizationId: "", purpose: "view" })).toThrow()
    expect(() => CallTaken.make({ organizationId: "", day: 0, by: "ana", purpose: "view" })).toThrow()
    expect(S.is(Actor)({ organizationId: "", memberId: "ana", role: "editor" })).toBe(false)
  })

  it("refuses an empty member id", () => {
    expect(() => CallTaken.make({ organizationId: "org_prairie", day: 0, by: "", purpose: "view" })).toThrow()
    expect(S.is(Actor)({ organizationId: "org_prairie", memberId: "", role: "editor" })).toBe(false)
  })

  it("builds a command and an event whose ids are not empty", () => {
    expect(TakeCall.make({ organizationId: "org_prairie", purpose: "view" }).organizationId).toBe("org_prairie")
    expect(CallTaken.make({ organizationId: "org_prairie", day: 0, by: "ana", purpose: "view" }).by).toBe("ana")
  })

  it("takes an id of one to 64 characters and refuses one of 65", () => {
    expect(S.is(Actor)({ organizationId: "o", memberId: Str.repeat(64)("m"), role: "editor" })).toBe(true)
    expect(S.is(Actor)({ organizationId: Str.repeat(65)("o"), memberId: "m", role: "editor" })).toBe(false)
  })
})
