// The two rules the kernel decides with: who may write (`requireRole`, with an agent's cap) and which requests may
// write at all (`RequestSource.allows`), and how the audit line's `agent` is stored.
import { describe, expect, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import { Forbidden } from "@inventory/kernel/AccessError"
import { Activity } from "@inventory/kernel/Activity"
import { CurrentActor, requireRole } from "@inventory/kernel/Actor"
import { asAgent } from "@inventory/kernel/Agent"
import { AgentRun } from "@inventory/kernel/AgentRun"
import { ActivityId, MemberId, OrganizationId } from "@inventory/kernel/Ids"
import { Member } from "@inventory/kernel/Member"
import type { Role } from "@inventory/kernel/Role"
import { RequestSource } from "@inventory/kernel/SameOrigin"

// An agent acts with the lower of two roles: the person's and its own maximum. Neither reason names the person.
const person = (role: Role) =>
  Member.make({
    id: MemberId.make("mem_test"),
    name: "Dana Whitfield",
    role,
    organizationId: OrganizationId.make("org_prairie"),
    organizationName: "Example Works (test)"
  })

const attempt = (role: Role, agent: O.Option<AgentRun>, minimum: Role) => {
  const check = requireRole(minimum)
  return O.match(agent, { onNone: () => check, onSome: (run) => check.pipe(asAgent(run)) }).pipe(
    Effect.provideService(CurrentActor, person(role)),
    Effect.flip
  )
}

describe("requireRole", () => {
  it.effect("an agent capped at viewer cannot write for an admin", () =>
    Effect.gen(function* () {
      const refused = yield* attempt("admin", O.some(AgentRun.make({ agent: "Proposer", maxRole: "viewer" })), "editor")
      expect(S.is(Forbidden)(refused)).toBe(true)
      expect(refused.required).toBe("editor")
      expect(refused.reason).toBe("Proposer acts for you with at most the viewer role. This needs the editor role.")
    })
  )

  it.effect("an agent capped at admin still cannot exceed a viewer it acts for", () =>
    Effect.gen(function* () {
      const refused = yield* attempt(
        "viewer",
        O.some(AgentRun.make({ agent: "Assistant", maxRole: "admin" })),
        "editor"
      )
      expect(refused.reason).toBe(
        "You are a viewer in Example Works (test). This needs the editor role: ask an admin there."
      )
      expect(refused.reason).not.toContain("Dana")
    })
  )

  it.effect("a viewer with no agent is refused a write", () =>
    Effect.gen(function* () {
      const refused = yield* attempt("viewer", O.none(), "editor")
      expect(refused.required).toBe("editor")
    })
  )

  it.effect("an agent within both roles is allowed, and acts as the person", () =>
    Effect.gen(function* () {
      const actor = yield* requireRole("editor").pipe(
        asAgent(AgentRun.make({ agent: "Assistant", maxRole: "editor" })),
        Effect.provideService(CurrentActor, person("admin"))
      )
      expect(actor.id).toBe("mem_test")
    })
  )
})

// Which requests may write. The claim that would hurt most if wrong: a write that a page on another site made the
// browser send is refused, whichever of the two headers says so, and the app's own pages are never refused.
describe("RequestSource.allows", () => {
  const own = ["https://inventory.example"]
  const from = (method: string, fetchSite: string | undefined, origin: string | undefined) =>
    RequestSource.allows(
      RequestSource.make({ method, fetchSite: O.fromUndefinedOr(fetchSite), origin: O.fromUndefinedOr(origin), own })
    )

  it("takes a write from the app's own pages", () => {
    expect(from("POST", "same-origin", "https://inventory.example")).toBe(true)
    expect(from("POST", "none", undefined)).toBe(true)
    expect(from("PUT", undefined, "https://inventory.example")).toBe(true)
    expect(from("DELETE", undefined, "HTTPS://inventory.EXAMPLE")).toBe(true)
  })

  it("refuses a write another site asked for", () => {
    expect(from("POST", "cross-site", "https://elsewhere.example")).toBe(false)
    expect(from("POST", "same-site", "https://other.inventory.example")).toBe(false)
    expect(from("DELETE", undefined, "https://elsewhere.example")).toBe(false)
    expect(from("PUT", undefined, "null")).toBe(false)
    expect(from("POST", "cross-site", "https://inventory.example")).toBe(false)
    expect(from("post", "cross-site", undefined)).toBe(false)
  })

  it("leaves reading alone, and a request no browser page made", () => {
    expect(from("GET", "cross-site", "https://elsewhere.example")).toBe(true)
    expect(from("HEAD", "cross-site", undefined)).toBe(true)
    expect(from("POST", undefined, undefined)).toBe(true)
  })
})

describe("Activity", () => {
  const row = {
    id: "8f0c4d2e-1a2b-4c3d-8e9f-0a1b2c3d4e5f",
    organizationId: "org_prairie",
    actorId: "mem_dana",
    actorName: "Dana Whitfield",
    action: "Imported items",
    detail: "Created 11 items from items.csv",
    createdAt: "2026-11-18T09:30:00.000Z"
  }
  it.effect("reads a stored NULL agent as None and stores None as NULL", () =>
    Effect.gen(function* () {
      const stored = yield* S.decodeEffect(Activity)({ ...row, agent: null })
      expect(O.isNone(stored.agent)).toBe(true)
      expect(stored.id).toBe(ActivityId.make(row.id))
      const back = yield* S.encodeEffect(Activity)(stored)
      expect(back.agent).toBeNull()
    })
  )
  it.effect("reads the API's line with no agent key, or a named agent", () =>
    Effect.gen(function* () {
      const none = yield* S.decodeEffect(Activity.json)(row)
      expect(O.isNone(none.agent)).toBe(true)
      const some = yield* S.decodeEffect(Activity.json)({ ...row, agent: "Assistant" })
      expect(some.agent).toEqual(O.some("Assistant"))
    })
  )
})
