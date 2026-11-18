import * as S from "effect/Schema"
import { dual } from "effect/Function"

/** The tenant. Every row of customer data carries one, and every query filters on it. */
export const OrganizationId = S.String.pipe(S.brand("OrganizationId")).annotate({
  description: "The organization (tenant) a row belongs to. It always comes from the actor, never from a request."
})
/** An `OrganizationId` as code holds it: branded, so a member id cannot be passed where a tenant is expected. */
export type OrganizationId = typeof OrganizationId.Type

/** A person within one organization. Branded so it cannot be passed where an organization id is expected. */
export const MemberId = S.String.pipe(S.brand("MemberId")).annotate({
  description: "A person within one organization. People are told apart by this id, never by name."
})
/** A `MemberId` as code holds it. Compare people with it, never with their names. */
export type MemberId = typeof MemberId.Type

/** Ordered from least to most access. */
export const Role = S.Literals(["viewer", "editor", "admin"]).annotate({
  description: "What a member may do: a viewer reads, an editor also writes, an admin also manages people.",
  examples: ["editor"]
})
/** One of the three roles. */
export type Role = typeof Role.Type

const rank: Record<Role, number> = { viewer: 0, editor: 1, admin: 2 }

/**
 * True when `role` is at least `minimum`. The server is the only place this decides anything; the browser uses it to
 * hide a button the server would refuse. Works data-first and in a pipe.
 *
 * @example
 * hasRole("editor", "viewer") // true: an editor can do what a viewer can
 * hasRole("viewer", "editor") // false
 * pipe("admin", hasRole("editor")) // true
 */
export const hasRole: {
  (minimum: Role): (role: Role) => boolean
  (role: Role, minimum: Role): boolean
} = dual(2, (role: Role, minimum: Role): boolean => rank[role] >= rank[minimum])

/** A person acting inside one organization. Everything they read or write is scoped to it. */
export class Member extends S.Class<Member, { readonly brand: unique symbol }>("Member")(
  {
    id: MemberId,
    name: S.NonEmptyString.annotateKey({
      description: "The name people read. Not unique and can change, so it never decides a permission."
    }),
    role: Role,
    organizationId: OrganizationId,
    organizationName: S.NonEmptyString.annotateKey({ description: "The organization's name, for the screen." })
  },
  { description: "A person acting inside one organization: who they are, their role, and their tenant." }
) {}

/**
 * Why an admin's "add a person" could not add them, as data the form shows beside the email typed: nobody has
 * signed up with that email (`noAccount`), or they are already in the organization with another role
 * (`alreadyMember`). A problem with what the person typed, so never a request error.
 */
export class AddPersonProblem extends S.TaggedClass<AddPersonProblem, { readonly brand: unique symbol }>()(
  "AddPersonProblem",
  {
    kind: S.Literals(["noAccount", "alreadyMember"]).annotateKey({
      description: "Nobody has signed up with the email, or they are already a member with another role"
    }),
    problem: S.String.annotateKey({ description: "What is wrong with the email given, in a sentence" }),
    todo: S.String.annotateKey({ description: "What the admin can do instead, in a sentence" })
  },
  { description: "Why a person could not be added, as data the form shows beside the email typed" }
) {}
