/**
 * An agent run: which agent acts for the signed-in person, and the most it may do.
 *
 * @packageDocumentation
 */
import * as S from "effect/Schema"
import { $KernelId } from "./internal/identity.ts"
import { hasRole, Role } from "./Role.schema.ts"
import { aboutClass, aboutProperty } from "./Terms.pointer.ts"
import { DisplayName } from "./Text.schema.ts"

const $I = $KernelId.create("AgentRun")

/**
 * An agent run: which agent is acting, and the most it may do. It always acts for the signed-in person (the
 * `CurrentActor`), so what it may do is the lower of that person's role and `maxRole`: an agent never exceeds the
 * person, and an agent meant only to propose can be held below them.
 *
 * It points at `inv:AgentRun` on its own annotations alone: a run stores no id (decision 135), so no field names the
 * class, and the lift refuses a record of it. `agent` is the run's `agentName`, `maxRole` its `maxRole`.
 *
 * @category schemas
 */
export class AgentRun extends S.Opaque<AgentRun, { readonly brand: unique symbol }>()(
  S.Struct({
    agent: DisplayName.pipe(
      S.annotateKey({
        description: 'The agent\'s name as people read it in the activity list, for example "Assistant".',
        ...aboutProperty("inv:agentName")
      })
    ),
    maxRole: Role.pipe(
      S.annotateKey({
        description: "The most this agent may do, whatever the role of the person it acts for.",
        ...aboutProperty("inv:maxRole")
      })
    )
  }).pipe(
    $I.annoteSchema("AgentRun", {
      description: "Which agent acts for the signed-in person, and the most it may do",
      ...aboutClass("inv:AgentRun")
    })
  )
) {
  /** True when the run's `maxRole` reaches `minimum`; the person's own role is checked separately. */
  static readonly allows = (run: Pick<AgentRun, "maxRole">, minimum: Role): boolean => hasRole(run.maxRole, minimum)
}
