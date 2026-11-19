/**
 * The member a request acts as, and the role check every write starts with. Handlers read `CurrentActor`; they never
 * trust an id from a payload.
 *
 * @packageDocumentation
 */
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import { Forbidden } from "./AccessError.errors.ts"
import { AgentRun } from "./AgentRun.schema.ts"
import { CurrentAgent } from "./Agent.context.ts"
import { $KernelId } from "./internal/identity.ts"
import { Member } from "./Member.schema.ts"
import type { Role } from "./Role.schema.ts"

const $I = $KernelId.create("Actor")

/**
 * The member making this request, provided by the `Identity` middleware.
 *
 * @category services
 */
export class CurrentActor extends Context.Service<CurrentActor, Member>()($I`CurrentActor`) {}

/**
 * Fails with `Forbidden` unless the current actor has at least `minimum`, and, when an agent is acting for them,
 * unless the agent's `maxRole` allows it too. Call it first in any handler that writes. The reason speaks to the
 * person ("You are a viewer …") and never names them, so it is safe in a log too.
 *
 * @category guards
 */
export const requireRole = Effect.fn("requireRole")(function* (minimum: Role) {
  const actor = yield* CurrentActor
  if (!Member.allows(actor, minimum)) {
    return yield* Forbidden.make({
      reason: `You are a ${actor.role} in ${actor.organizationName}. This needs the ${minimum} role: ask an admin there.`,
      required: minimum
    })
  }
  const agent = yield* Effect.serviceOption(CurrentAgent)
  if (O.isSome(agent) && !AgentRun.allows(agent.value, minimum)) {
    return yield* Forbidden.make({
      reason: `${agent.value.agent} acts for you with at most the ${agent.value.maxRole} role. This needs the ${minimum} role.`,
      required: minimum
    })
  }
  return actor
})
