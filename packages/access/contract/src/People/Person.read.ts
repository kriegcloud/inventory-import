/**
 * One member of an organization, as the People page shows them.
 *
 * @packageDocumentation
 */
import { MemberId } from "@inventory/kernel/Ids"
import { Role } from "@inventory/kernel/Role"
import { aboutClass, aboutPath, aboutProperty } from "@inventory/kernel/TermsPointer"
import { DisplayName, Instant } from "@inventory/kernel/Text"
import { nullAsNone } from "@inventory/kernel/Wire"
import * as S from "effect/Schema"
import { $AccessContractId } from "../internal/identity.ts"
import { AccountEmail } from "../Session/SessionState.read.ts"

const $I = $AccessContractId.create("People/Person")

/**
 * One member of the organization as the People page shows them. `email` is none for a member with no account.
 *
 * It is a view of the kernel's `Member` and points at `inv:Member`, never at `inv:Person` (report 14 section 3.6,
 * decision 99): `memberId` is the subject's id, `name` and `role` carry `Member.name`'s and `Member.role`'s paths,
 * `email` is the sign-in account's `accountEmail` (decision 134) and `joinedAt` the membership's `joinedAt` (decision
 * 100). The lift states nothing for the two paths that end in an attribute (decision 155).
 *
 * @category schemas
 */
export class Person extends S.Opaque<Person, { readonly brand: unique symbol }>()(
  S.Struct({
    memberId: MemberId.pipe(
      S.annotateKey({
        description: "The member's id: what the address of a change of role or a removal names",
        examples: [MemberId.make("mem_marcus")],
        ...aboutClass("inv:Member")
      })
    ),
    name: DisplayName.pipe(
      S.annotateKey({
        description: "The name people read. Not unique, so it never tells two people apart",
        ...aboutPath([{ property: "inv:membershipOf", node: "inv:Person" }, { property: "inv:name" }])
      })
    ),
    email: AccountEmail.pipe(
      nullAsNone({
        description: "The email of the person's account; null for a member with no account",
        ...aboutPath([{ property: "inv:memberAccount", node: "inv:SignInAccount" }, { property: "inv:accountEmail" }])
      })
    ),
    // Marked with no description: a description here would change the OpenAPI document, which a mark must not.
    role: Role.pipe(
      S.annotateKey(
        aboutPath([
          {
            property: "inv:grantedTo",
            reverse: true,
            node: "inv:Grant",
            fixed: [{ property: "inv:grantScope", concept: "inv:GrantScopeKindScheme-organization" }]
          },
          { property: "inv:grantsRole" }
        ])
      )
    ),
    joinedAt: Instant.pipe(
      nullAsNone({
        description: "When they became a member; null when that is not known",
        ...aboutProperty("inv:joinedAt")
      })
    )
  }).pipe(
    $I.annoteSchema("Person", {
      description: "One member of the organization as the People page shows them",
      ...aboutClass("inv:Member")
    })
  )
) {}
