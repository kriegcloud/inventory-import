/**
 * One member of an organization, as the People page shows them.
 *
 * @packageDocumentation
 */
import { MemberId } from "@inventory/kernel/Ids"
import { Role } from "@inventory/kernel/Role"
import { DisplayName, Instant } from "@inventory/kernel/Text"
import * as S from "effect/Schema"
import { $AccessContractId } from "../internal/identity.ts"
import { AccountEmail } from "../Session/SessionState.read.ts"

const $I = $AccessContractId.create("People/Person")

/**
 * One member of the organization as the People page shows them. `email` is none for a member with no account.
 *
 * @category schemas
 */
export class Person extends S.Opaque<Person, { readonly brand: unique symbol }>()(
  S.Struct({
    memberId: MemberId.pipe(
      S.annotateKey({
        description: "The member's id: what the address of a change of role or a removal names",
        examples: [MemberId.make("mem_marcus")]
      })
    ),
    name: DisplayName.pipe(
      S.annotateKey({ description: "The name people read. Not unique, so it never tells two people apart" })
    ),
    email: AccountEmail.pipe(
      S.annotateKey({ description: "The email of the person's account; null for a member with no account" }),
      S.OptionFromNullOr
    ),
    role: Role,
    joinedAt: Instant.pipe(
      S.annotateKey({ description: "When they became a member; null when that is not known" }),
      S.OptionFromNullOr
    )
  }).pipe($I.annoteSchema("Person", { description: "One member of the organization as the People page shows them" }))
) {}
