import { Effect, Layer, Option } from "effect"
import { HttpServerRequest } from "effect/http"
import { actingAsHeader, CurrentActor, Forbidden, Identity, NotSignedIn } from "../api/v1/Identity.ts"
import { hasRole, MemberId, type Role } from "../domain/Identity.ts"
import { CurrentAgent } from "./Agent.ts"
import { Members } from "./Members.ts"

// TEST IDENTITY. There are no credentials: the `x-acting-as` header names a member, and a request without it acts
// as `defaultMemberId`. Handler and database tests use it to run as a fixed actor. The Worker does not: `worker.ts`
// passes `SessionIdentityLive` (SessionIdentity.ts), which reads the session cookie, `bun run build` checks this
// layer is not in the Worker bundle (scripts/check-production-identity.mjs), and test/server/Auth.slow.test.ts
// checks the header changes nothing there.
//
// `requireRole` below is shared by both: role checks run on the server whichever identity is in place.

/** Who a request without the header acts as in a test. */
const defaultMemberId = "mem_dana"

/**
 * The test implementation of the `Identity` middleware: resolves the member named by the header. Marked pure, so a
 * production bundle, which never provides it, leaves it out. Every span and log line inside the request carries the
 * actor's and organization's ids (never a name), as with the session identity.
 */
export const IdentityLive = /* @__PURE__ */ Layer.effect(
  Identity,
  /* @__PURE__ */ Effect.gen(function* () {
    const members = yield* Members
    return Identity.of(
      Effect.fn("Identity")(function* (httpEffect) {
        const request = yield* HttpServerRequest.HttpServerRequest
        const header = request.headers[actingAsHeader]
        const member = yield* members.findById(MemberId.make(header ?? defaultMemberId))
        if (Option.isNone(member)) {
          // The header's value is not echoed: what a request sent is not repeated to the screen or the log.
          return yield* NotSignedIn.make({ reason: "The test identity names no member of this app." })
        }
        const who = {
          "actor.id": member.value.id,
          "actor.role": member.value.role,
          "organization.id": member.value.organizationId
        }
        yield* Effect.annotateCurrentSpan(who)
        return yield* httpEffect.pipe(
          Effect.provideService(CurrentActor, member.value),
          Effect.annotateSpans(who),
          Effect.annotateLogs(who)
        )
      })
    )
  })
)

/**
 * Fails with `Forbidden` unless the current actor has at least `minimum`, and, when an agent is acting for them
 * (src/server/Agent.ts), unless the agent's `maxRole` allows it too. Call it first in any handler that writes. The
 * reason speaks to the person ("You are a viewer …") and never names them, so it is safe in a log too.
 */
export const requireRole = Effect.fn("requireRole")(function* (minimum: Role) {
  const actor = yield* CurrentActor
  if (!hasRole(actor.role, minimum)) {
    return yield* Forbidden.make({
      reason: `You are a ${actor.role} in ${actor.organizationName}. This needs the ${minimum} role: ask an admin there.`,
      required: minimum
    })
  }
  const agent = yield* Effect.serviceOption(CurrentAgent)
  if (Option.isSome(agent) && !hasRole(agent.value.maxRole, minimum)) {
    return yield* Forbidden.make({
      reason: `${agent.value.agent} acts for you with at most the ${agent.value.maxRole} role. This needs the ${minimum} role.`,
      required: minimum
    })
  }
  return actor
})
