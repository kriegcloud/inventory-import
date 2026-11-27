/**
 * The four things done about an organization's people. Reading the list is any member's; adding, changing a role
 * and removing need the admin role, and each writes one audit line with its change or nothing at all.
 *
 * @packageDocumentation
 */
import type { AddPerson, AddPersonOutcome, ChangeRole } from "@inventory/access-contract/PeoplePayload"
import { LastAdmin, PersonNotFound } from "@inventory/access-contract/PeopleRejection"
import type { Person } from "@inventory/access-contract/Person"
import { Activity } from "@inventory/kernel/Activity"
import { CurrentActor, requireRole } from "@inventory/kernel/Actor"
import { ActivityId, MemberId } from "@inventory/kernel/Ids"
import type { Member } from "@inventory/kernel/Member"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as SecureRandom from "effect/crypto/SecureRandom"
import * as O from "effect/Option"
import * as Result from "effect/Result"
import { alreadyMember, noAccount, sameAdd } from "./AddPerson.rules.ts"
import { lastAdminSentence, personNotFoundSentence } from "./LastAdmin.rules.ts"
import { AddWrite, PeopleStore, RemoveWrite, RoleWrite } from "./PeopleStore.store.ts"

/** The audit line of something `actor` did to their organization's people, stamped now. */
const auditLine = Effect.fnUntraced(function* (
  actor: Member,
  said: { readonly action: string; readonly detail: string }
) {
  const random = yield* SecureRandom.SecureRandom
  const id = yield* random.uuidV4()
  const createdAt = yield* DateTime.now
  return Activity.make({
    id: ActivityId.make(id),
    organizationId: actor.organizationId,
    actorId: actor.id,
    actorName: actor.name,
    action: said.action,
    detail: said.detail,
    agent: O.none(),
    createdAt
  })
})

/**
 * Everyone in the actor's organization. Any member may read it.
 *
 * @category handlers
 */
export const listPeople = Effect.fnUntraced(function* () {
  const actor = yield* CurrentActor
  const store = yield* PeopleStore
  return yield* store.list(actor.organizationId)
})

/**
 * Adds the person who signed up with the command's email. Answers the person, or why not as data: nobody signed up
 * with that email, or they are already a member with another role. Already there with the role asked for is the
 * same add: the person comes back and nothing is written.
 *
 * @category handlers
 */
export const addPerson = Effect.fnUntraced(function* (command: AddPerson) {
  const actor = yield* requireRole("admin")
  const store = yield* PeopleStore
  const account = yield* store.accountByEmail(command.email)
  if (O.isNone(account)) return Result.fail(noAccount(command.email)) satisfies AddPersonOutcome
  const random = yield* SecureRandom.SecureRandom
  const member = yield* random.uuidV4()
  const audit = yield* auditLine(actor, {
    action: "Added a person",
    detail: `${account.value.name} as ${command.role}`
  })
  const write = yield* store.add({ member: MemberId.make(member), account: account.value, role: command.role, audit })
  return AddWrite.match(write, {
    added: ({ person }): AddPersonOutcome => Result.succeed(person),
    alreadyMember: ({ existing }): AddPersonOutcome =>
      sameAdd({ existing, role: command.role }) && O.isSome(existing)
        ? Result.succeed(existing.value)
        : Result.fail(alreadyMember({ name: account.value.name, existing, organization: actor.organizationName }))
  })
})

/** The person the address names, or `PersonNotFound`. */
const personNamed = Effect.fnUntraced(function* (actor: Member, member: MemberId) {
  const store = yield* PeopleStore
  const found = yield* store.find({ organization: actor.organizationId, member })
  if (O.isNone(found)) return yield* PersonNotFound.make({ reason: personNotFoundSentence })
  return found.value
})

/**
 * Gives a member a role. Refused with `LastAdmin` when it would leave the organization with no admin; the audit
 * line is written only if the role was.
 *
 * @category handlers
 */
export const changeRole = Effect.fnUntraced(function* (change: {
  readonly member: MemberId
  readonly command: ChangeRole
}) {
  const actor = yield* requireRole("admin")
  const store = yield* PeopleStore
  const before = yield* personNamed(actor, change.member)
  const audit = yield* auditLine(actor, {
    action: "Changed a role",
    detail: `${before.name}: ${before.role} to ${change.command.role}`
  })
  const write = yield* store.setRole({
    member: change.member,
    role: change.command.role,
    before: before.role,
    audit
  })
  return yield* RoleWrite.match(write, {
    changed: ({ person }): Effect.Effect<Person, PersonNotFound | LastAdmin> => Effect.succeed(person),
    lastAdmin: () =>
      Effect.fail(
        LastAdmin.make({ reason: lastAdminSentence({ person: before.name, organization: actor.organizationName }) })
      ),
    missing: () => Effect.fail(PersonNotFound.make({ reason: personNotFoundSentence }))
  })
})

/**
 * Removes a member from the organization. Refused with `LastAdmin` when it would leave no admin.
 *
 * @category handlers
 */
export const removePerson = Effect.fnUntraced(function* (member: MemberId) {
  const actor = yield* requireRole("admin")
  const store = yield* PeopleStore
  const before = yield* personNamed(actor, member)
  const audit = yield* auditLine(actor, { action: "Removed a person", detail: `${before.name} (${before.role})` })
  const write = yield* store.remove({ member, audit })
  return yield* RemoveWrite.match(write, {
    removed: (): Effect.Effect<void, PersonNotFound | LastAdmin> => Effect.void,
    lastAdmin: () =>
      Effect.fail(
        LastAdmin.make({ reason: lastAdminSentence({ person: before.name, organization: actor.organizationName }) })
      ),
    missing: () => Effect.fail(PersonNotFound.make({ reason: personNotFoundSentence }))
  })
})
