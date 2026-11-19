/**
 * Agents act for a person. Server code that acts as an agent runs inside `asAgent(run)`: the request's `CurrentActor`
 * stays the signed-in person, `requireRole` checks both that person's role and the run's `maxRole`, and every audit
 * line written inside names the agent beside the person. Nothing an agent sends can change who it acts for.
 *
 * @packageDocumentation
 */
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import type { AgentRun } from "./AgentRun.schema.ts"
import { $KernelId } from "./internal/identity.ts"

const $I = $KernelId.create("Agent")

/**
 * The agent acting in this request, when one is. Read with `Effect.serviceOption(CurrentAgent)`.
 *
 * @category services
 */
export class CurrentAgent extends Context.Service<CurrentAgent, AgentRun>()($I`CurrentAgent`) {}

/**
 * Runs `effect` as the agent in `run`, for the current actor, with its own span.
 *
 * @category combinators
 */
export const asAgent =
  (run: AgentRun) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
    effect.pipe(
      Effect.provideService(CurrentAgent, run),
      Effect.annotateLogs({ "agent.name": run.agent, "agent.maxRole": run.maxRole }),
      Effect.withSpan("Agent.run", { attributes: { "agent.name": run.agent, "agent.maxRole": run.maxRole } })
    )
