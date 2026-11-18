import { expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { CurrentActor } from "../../src/api/v1/Identity.ts"
import { AgentRun } from "../../src/domain/Agent.ts"
import { Member, MemberId, OrganizationId, type Role } from "../../src/domain/Identity.ts"
import { asAgent } from "../../src/server/Agent.ts"
import { requireRole } from "../../src/server/Identity.ts"

// An agent acts with the lower of two roles: the person's and its own maximum. Checked on `requireRole`, the call
// every write starts with, so no handler can forget it. Neither reason names the person.

const person = (role: Role) =>
  Member.make({
    id: MemberId.make("mem_test"),
    name: "Dana Whitfield",
    role,
    organizationId: OrganizationId.make("org_prairie"),
    organizationName: "Example Works (test)"
  })

const attempt = (role: Role, agent: AgentRun | undefined, minimum: Role) => {
  const check = requireRole(minimum)
  return (agent === undefined ? check : check.pipe(asAgent(agent))).pipe(
    Effect.provideService(CurrentActor, person(role)),
    Effect.flip
  )
}

it.effect("an agent capped at viewer cannot write for an admin", () =>
  Effect.gen(function* () {
    const refused = yield* attempt("admin", AgentRun.make({ agent: "Proposer", maxRole: "viewer" }), "editor")
    expect(refused).toMatchObject({ _tag: "Forbidden", required: "editor" })
    expect(refused.reason).toBe("Proposer acts for you with at most the viewer role. This needs the editor role.")
  })
)

it.effect("an agent capped at admin still cannot exceed a viewer it acts for", () =>
  Effect.gen(function* () {
    const refused = yield* attempt("viewer", AgentRun.make({ agent: "Assistant", maxRole: "admin" }), "editor")
    expect(refused.reason).toBe(
      "You are a viewer in Example Works (test). This needs the editor role: ask an admin there."
    )
    expect(refused.reason).not.toContain("Dana")
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
