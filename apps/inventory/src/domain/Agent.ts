import { Schema } from "effect"
import { Role } from "./Identity.ts"

/**
 * An agent run: which agent is acting, and the most it may do. It always acts for the signed-in person (the
 * `CurrentActor`), so what it may do is the lower of that person's role and `maxRole`: an agent never exceeds the
 * person, and an agent meant only to propose can be held below them.
 */
export class AgentRun extends Schema.Class<AgentRun, { readonly brand: unique symbol }>("AgentRun")({
  agent: Schema.NonEmptyString.annotate({
    description: 'The agent\'s name as people read it in the activity list, for example "Assistant".'
  }),
  maxRole: Role.annotate({ description: "The most this agent may do, whatever the role of the person it acts for." })
}) {}
