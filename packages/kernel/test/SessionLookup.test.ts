// The session lookup's verdict: trusted for one minute at most (Benjamin, 2026-11-26, "One minute at most"), and
// never past the session's own end. That its schema generates only values it accepts (SF-7) is in
// Kernel.property.test.ts, with every other schema of the kernel.
import { describe, expect, it } from "@effect/vitest"
import * as DateTime from "effect/DateTime"
import * as O from "effect/Option"
import { MemberId, OrganizationId } from "@inventory/kernel/Ids"
import { Member } from "@inventory/kernel/Member"
import { SessionVerdict } from "@inventory/kernel/SessionLookup"

const dana = Member.make({
  id: MemberId.make("mem_dana"),
  name: "Dana Whitfield",
  role: "editor",
  organizationId: OrganizationId.make("org_prairie"),
  organizationName: "Prairie Supply"
})
const at = DateTime.makeUnsafe("2026-11-27T09:00:00.000Z")

describe("a session's verdict", () => {
  it("is trusted for one minute when the session's end is not known", () => {
    const verdict = SessionVerdict.judged({ member: dana, at, sessionEnds: O.none() })
    expect(DateTime.formatIso(verdict.until)).toBe("2026-11-27T09:01:00.000Z")
    expect(verdict.member).toEqual(dana)
  })

  it("is trusted for one minute when the session lasts for days", () => {
    const sessionEnds = O.some(DateTime.makeUnsafe("2026-12-04T09:00:00.000Z"))
    expect(DateTime.formatIso(SessionVerdict.judged({ member: dana, at, sessionEnds }).until)).toBe(
      "2026-11-27T09:01:00.000Z"
    )
  })

  it("ends with the session when the session ends within the minute", () => {
    const sessionEnds = O.some(DateTime.makeUnsafe("2026-11-27T09:00:20.000Z"))
    expect(DateTime.formatIso(SessionVerdict.judged({ member: dana, at, sessionEnds }).until)).toBe(
      "2026-11-27T09:00:20.000Z"
    )
  })

  it("carries ids and the role in its annotations, never a name", () => {
    const verdict = SessionVerdict.judged({ member: dana, at, sessionEnds: O.none() })
    expect(SessionVerdict.annotations(verdict)).toEqual({
      "actor.id": "mem_dana",
      "actor.role": "editor",
      "organization.id": "org_prairie"
    })
  })
})
