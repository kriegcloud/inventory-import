// The ids the usage model takes: the texts of the kernel's `OrganizationId` and `MemberId`, which the model compares
// and never reads inside. One schema for both, read by who acts (`Actor.context.ts`) and by the allowance
// (`Allowance.aggregate.ts`). The one thing not to break: an id is never empty, so the prover tries only ids a real
// request can carry, and a counterexample names a real organization.
import * as S from "effect/Schema"

/** The text of a kernel id: one to 64 characters, as the kernel bounds it. */
export const IdText = S.String.check(S.isMinLength(1), S.isMaxLength(64)).annotate({
  identifier: "IdText",
  description: "The text of an organization's or a member's id: one to 64 characters"
})
/** The decoded value of `IdText`. */
export type IdText = typeof IdText.Type
