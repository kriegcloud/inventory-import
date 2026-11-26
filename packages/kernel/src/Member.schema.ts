/**
 * A person acting inside one organization: the actor every request runs as.
 *
 * @packageDocumentation
 */
import * as S from "effect/Schema"
import { MemberId, OrganizationId } from "./Ids.id.ts"
import { $KernelId } from "./internal/identity.ts"
import { hasRole, Role } from "./Role.schema.ts"
import { aboutClass, aboutPath, aboutProperty } from "./Terms.pointer.ts"
import { DisplayName } from "./Text.schema.ts"

const $I = $KernelId.create("Member")

/**
 * A person acting inside one organization: who they are, their role, and their tenant. Everything they read or write
 * is scoped to `organizationId`.
 *
 * It points at `inv:Member` (report 14 section 3.3): `id` is the subject's id, `organizationId` fills `membershipIn`,
 * `role` is lifted to one `Grant` at the organization's scope, `name` is the person's `name` and `organizationName` the
 * tenant's (report 18 section 7). The lift writes the tenant's name on the node `organizationId` names (decision 161)
 * and nothing for the person's, which no record identifies (decisions 133 and 155). A mark is an annotation and
 * changes nothing a value decodes to.
 *
 * **Example** (May this member write?)
 *
 * ```ts
 * import { Member } from "@inventory/kernel/Member"
 *
 * Member.allows(member, "editor")
 * ```
 *
 * @category schemas
 */
export class Member extends S.Opaque<Member, { readonly brand: unique symbol }>()(
  S.Struct({
    id: MemberId.pipe(
      S.annotateKey({ description: "Who this is: people are told apart by this id", ...aboutClass("inv:Member") })
    ),
    name: DisplayName.pipe(
      S.annotateKey({
        description: "The name people read. Not unique and can change, so it never decides a permission.",
        ...aboutPath([{ property: "inv:membershipOf", node: "inv:Person" }, { property: "inv:name" }])
      })
    ),
    role: Role.pipe(
      S.annotateKey({
        description: "What this member may do in this organization",
        ...aboutPath([
          {
            property: "inv:grantedTo",
            reverse: true,
            node: "inv:Grant",
            fixed: [{ property: "inv:grantScope", concept: "inv:GrantScopeKindScheme-organization" }]
          },
          { property: "inv:grantsRole" }
        ])
      })
    ),
    organizationId: OrganizationId.pipe(
      S.annotateKey({ description: "The organization the member acts in", ...aboutProperty("inv:membershipIn") })
    ),
    organizationName: DisplayName.pipe(
      S.annotateKey({
        description: "The organization's name, for the screen.",
        ...aboutPath([{ property: "inv:membershipIn", node: "inv:Tenant" }, { property: "inv:name" }])
      })
    )
  }).pipe(
    $I.annoteSchema("Member", {
      description: "A person acting inside one organization: who they are, their role, and their tenant.",
      ...aboutClass("inv:Member")
    })
  )
) {
  /** True when the member's role is at least `minimum` (`hasRole` on their role). */
  static readonly allows = (member: Pick<Member, "role">, minimum: Role): boolean => hasRole(member.role, minimum)
}
