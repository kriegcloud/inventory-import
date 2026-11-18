import { Context, Effect } from "effect"
import type { AgentRun } from "../domain/Agent.ts"

// AGENTS ACT FOR A PERSON. Server code that acts as an agent runs inside `asAgent(run)`: the request's
// `CurrentActor` stays the signed-in person, `requireRole` checks both that person's role and the run's `maxRole`,
// and every `Activity` row written inside names the agent beside the person. Nothing an agent sends can change who
// it acts for: there is no agent id in any payload.

/** The agent acting in this request, when one is. Read with `Effect.serviceOption(CurrentAgent)`. */
export class CurrentAgent extends Context.Service<CurrentAgent, AgentRun>()("inventory/server/Agent/CurrentAgent") {}

/** Runs `effect` as the agent in `run`, for the current actor, with its own span. */
export const asAgent =
  (run: AgentRun) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
    effect.pipe(
      Effect.provideService(CurrentAgent, run),
      Effect.annotateLogs({ "agent.name": run.agent, "agent.maxRole": run.maxRole }),
      Effect.withSpan("Agent.run", { attributes: { "agent.name": run.agent, "agent.maxRole": run.maxRole } })
    )
