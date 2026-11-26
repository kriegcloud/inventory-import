/**
 * What adding a person comes to when it adds nobody, and when an add asked again is the same add.
 *
 * @packageDocumentation
 */
import { AddPersonProblem } from "@inventory/access-contract/PeopleCommand"
import type { Person } from "@inventory/access-contract/Person"
import type { AccountEmail } from "@inventory/access-contract/SessionState"
import type { Role } from "@inventory/kernel/Role"
import type { DisplayName } from "@inventory/kernel/Text"
import * as O from "effect/Option"

/**
 * Nobody has signed up with the email. It is named as the lookup read it: trimmed and lower-cased.
 *
 * @category rules
 */
export const noAccount = (email: AccountEmail): AddPersonProblem =>
  AddPersonProblem.make({
    kind: "noAccount",
    problem: `Nobody has signed up with ${email} yet.`,
    todo: "Ask them to create an account, then add them here."
  })

/**
 * The account is already a member, with another role than the one asked for.
 *
 * @category rules
 */
export const alreadyMember = (found: {
  readonly name: DisplayName
  readonly existing: O.Option<Person>
  readonly organization: DisplayName
}): AddPersonProblem =>
  AddPersonProblem.make({
    kind: "alreadyMember",
    problem: O.match(found.existing, {
      onNone: () => `${found.name} is already in ${found.organization}.`,
      onSome: (person) =>
        `${found.name} is already in ${found.organization} as ${person.role === "viewer" ? "a" : "an"} ${person.role}.`
    }),
    todo: "Change their role in the list instead."
  })

/**
 * True when an add finds the person already there with the role asked for: a second press or a retry, so the same
 * add. The person comes back and nothing is written. Asked for another role, it is a role change, made on purpose.
 *
 * @category rules
 */
export const sameAdd = (add: { readonly existing: O.Option<Person>; readonly role: Role }): boolean =>
  O.isSome(add.existing) && add.existing.value.role === add.role
