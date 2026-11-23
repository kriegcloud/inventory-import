// Every exported schema generates only values it accepts (schema-first rule SF-7), and the role order is a total
// order consistent with `Role`'s list.
import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Arbitrary from "effect/Arbitrary"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import { Activity } from "@inventory/kernel/Activity"
import { AgentRun } from "@inventory/kernel/AgentRun"
import { ActivityId, MemberId, OrganizationId, RequestId, UserId } from "@inventory/kernel/Ids"
import { Member } from "@inventory/kernel/Member"
import { hasRole, Role } from "@inventory/kernel/Role"
import { RequestSource } from "@inventory/kernel/SameOrigin"
import { DisplayName, Instant, Sentence } from "@inventory/kernel/Text"

const runs = { arbitrary: { runs: 50 } }
const schemas: Readonly<Record<string, S.Top>> = {
  OrganizationId,
  MemberId,
  UserId,
  ActivityId,
  RequestId,
  Role,
  DisplayName,
  Sentence,
  Instant,
  Member,
  AgentRun,
  Activity,
  ActivityJson: Activity.json,
  RequestSource
}

describe("every schema generates only valid values", () => {
  for (const [name, schema] of R.toEntries(schemas)) {
    it.prop(
      name,
      [Arbitrary.schema(schema)],
      ([value]) => {
        expect(S.is(schema)(value)).toBe(true)
      },
      runs
    )
  }
})

describe("hasRole", () => {
  const order = ["viewer", "editor", "admin"] as const
  it.prop(
    "agrees with the order of Role's list",
    [Arbitrary.schema(Role), Arbitrary.schema(Role)],
    ([a, b]) => {
      expect(hasRole(a, b)).toBe(A.findFirstIndex(order, (r) => r === a) >= A.findFirstIndex(order, (r) => r === b))
    },
    runs
  )
  it("lets a role do what lower roles can, and refuses one below the minimum", () => {
    expect(hasRole("admin", "editor")).toBe(true)
    expect(hasRole("editor", "editor")).toBe(true)
    expect(hasRole("editor", "viewer")).toBe(true)
    expect(hasRole("viewer", "editor")).toBe(false)
    expect(hasRole("editor", "admin")).toBe(false)
  })
})

describe("ids", () => {
  it("are bounded", () => {
    expect(S.is(OrganizationId)("org_prairie")).toBe(true)
    expect(S.is(MemberId)(Str.repeat(64)("x"))).toBe(true)
    expect(S.is(MemberId)(Str.repeat(65)("x"))).toBe(false)
    expect(S.is(MemberId)("mem dana")).toBe(false)
    expect(S.is(MemberId)("")).toBe(false)
  })
})
