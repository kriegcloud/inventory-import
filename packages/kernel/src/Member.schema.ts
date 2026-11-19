/**
 * A person acting inside one organization: the actor every request runs as.
 *
 * @packageDocumentation
 */
import * as S from "effect/Schema"
import { MemberId, OrganizationId } from "./Ids.id.ts"
import { $KernelId } from "./internal/identity.ts"
import { hasRole, Role } from "./Role.schema.ts"
import { DisplayName } from "./Text.schema.ts"

const $I = $KernelId.create("Member")

/**
 * A person acting inside one organization: who they are, their role, and their tenant. Everything they read or write
 * is scoped to `organizationId`.
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
    id: MemberId.pipe(S.annotateKey({ description: "Who this is: people are told apart by this id" })),
    name: DisplayName.pipe(
      S.annotateKey({
        description: "The name people read. Not unique and can change, so it never decides a permission."
      })
    ),
    role: Role.pipe(S.annotateKey({ description: "What this member may do in this organization" })),
    organizationId: OrganizationId.pipe(S.annotateKey({ description: "The organization the member acts in" })),
    organizationName: DisplayName.pipe(S.annotateKey({ description: "The organization's name, for the screen." }))
  }).pipe(
    $I.annoteSchema("Member", {
      description: "A person acting inside one organization: who they are, their role, and their tenant."
    })
  )
) {
  /** True when the member's role is at least `minimum` (`hasRole` on their role). */
  static readonly allows = (member: Pick<Member, "role">, minimum: Role): boolean => hasRole(member.role, minimum)
}
