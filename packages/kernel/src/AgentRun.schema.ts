/**
 * An agent run: which agent acts for the signed-in person, and the most it may do.
 *
 * @packageDocumentation
 */
import * as S from "effect/Schema"
import { $KernelId } from "./internal/identity.ts"
import { hasRole, Role } from "./Role.schema.ts"
import { DisplayName } from "./Text.schema.ts"

const $I = $KernelId.create("AgentRun")

/**
 * An agent run: which agent is acting, and the most it may do. It always acts for the signed-in person (the
 * `CurrentActor`), so what it may do is the lower of that person's role and `maxRole`: an agent never exceeds the
 * person, and an agent meant only to propose can be held below them.
 *
 * @category schemas
 */
export class AgentRun extends S.Opaque<AgentRun, { readonly brand: unique symbol }>()(
  S.Struct({
    agent: DisplayName.pipe(
      S.annotateKey({
        description: 'The agent\'s name as people read it in the activity list, for example "Assistant".'
      })
    ),
    maxRole: Role.pipe(
      S.annotateKey({ description: "The most this agent may do, whatever the role of the person it acts for." })
    )
  }).pipe(
    $I.annoteSchema("AgentRun", { description: "Which agent acts for the signed-in person, and the most it may do" })
  )
) {
  /** True when the run's `maxRole` reaches `minimum`; the person's own role is checked separately. */
  static readonly allows = (run: Pick<AgentRun, "maxRole">, minimum: Role): boolean => hasRole(run.maxRole, minimum)
}
