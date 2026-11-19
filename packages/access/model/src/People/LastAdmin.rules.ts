/**
 * An organization keeps an admin. The rule the People handlers and the in-memory store decide by; the D1 store
 * asserts the same condition inside the statement that writes, because two admins demoting each other at the same
 * moment are only refused there.
 *
 * @packageDocumentation
 */
import type { MemberId } from "@inventory/kernel/Ids"
import type { Role } from "@inventory/kernel/Role"
import type { DisplayName, Sentence } from "@inventory/kernel/Text"
import * as A from "effect/Array"
import * as O from "effect/Option"

/** A member as the rule sees them: who, with what role, and whether an account is linked (they can sign in). */
export type AdminCandidate = { readonly memberId: MemberId; readonly role: Role; readonly linked: boolean }

/**
 * True when the organization still has an admin who can sign in after `member` takes the role `next` (none: after
 * they are removed). A member who is not an admin now can always change or go.
 *
 * **Example** (The only admin cannot step down)
 *
 * ```ts
 * import { keepsAnAdmin } from "@inventory/access-model/LastAdmin"
 * keepsAnAdmin({ members: [{ memberId: dana, role: "admin", linked: true }], member: dana, next: O.some("editor") }) // false
 * ```
 *
 * @category rules
 */
export const keepsAnAdmin = (change: {
  readonly members: ReadonlyArray<AdminCandidate>
  readonly member: MemberId
  readonly next: O.Option<Role>
}): boolean => {
  const now = A.findFirst(change.members, (candidate) => candidate.memberId === change.member)
  if (O.isNone(now) || now.value.role !== "admin") return true
  if (O.isSome(change.next) && change.next.value === "admin") return true
  return A.some(
    change.members,
    (candidate) => candidate.memberId !== change.member && candidate.role === "admin" && candidate.linked
  )
}

/**
 * The sentence for a change that would leave the organization with no admin.
 *
 * @category sentences
 */
export const lastAdminSentence = (who: {
  readonly person: DisplayName
  readonly organization: DisplayName
}): Sentence => `${who.person} is the only admin of ${who.organization}. Make someone else an admin first.`

/** The sentence for a member the address names who is not in the organization. */
export const personNotFoundSentence: Sentence = "That person is not a member of your organization."
