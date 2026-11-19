/**
 * What an admin may ask about an organization's people, and what adding a person comes to.
 *
 * @packageDocumentation
 */
import { LiteralKit } from "@beep/schema/LiteralKit"
import { Role } from "@inventory/kernel/Role"
import { Sentence } from "@inventory/kernel/Text"
import * as S from "effect/Schema"
import * as SchemaTransformation from "effect/SchemaTransformation"
import { $AccessContractId } from "../internal/identity.ts"
import { AccountEmail } from "../Session/SessionState.read.ts"
import { Person } from "./Person.read.ts"

const $I = $AccessContractId.create("People/People")

// The limit is checked after the trim, so the document's own `maxLength` cannot state it: the sentence does.
const emailDescription =
  "The email the person signed up with, whatever its case. Spaces around it are dropped; what is left is 1 to 254 characters"

/**
 * The email an admin types to add a person, as the lookup key: the spaces around it dropped and its letters
 * lower-cased, because an account is found whatever the case it was typed in.
 *
 * @category schemas
 */
export const EmailToFind = S.Trim.pipe(
  S.decode(SchemaTransformation.toLowerCase()),
  S.decodeTo(AccountEmail),
  $I.annoteSchema("EmailToFind", { description: emailDescription }),
  S.annotateEncoded({ description: emailDescription, examples: ["elena@sample-supply.test"] })
)

/**
 * The decoded value of `EmailToFind`.
 *
 * @category models
 */
export type EmailToFind = typeof EmailToFind.Type

/**
 * Add the person who signed up with this email, with this role.
 *
 * @category schemas
 */
export class AddPerson extends S.Opaque<AddPerson, { readonly brand: unique symbol }>()(
  S.Struct({
    email: EmailToFind.pipe(
      S.annotateKey({ description: emailDescription, messageMissingKey: "Give the email the person signed up with." })
    ),
    role: Role.pipe(S.annotateKey({ messageMissingKey: "Choose a role: viewer, editor or admin." }))
  }).pipe($I.annoteSchema("AddPerson", { description: "Add the person who signed up with this email, with this role" }))
) {}

/**
 * Give a member this role.
 *
 * @category schemas
 */
export class ChangeRole extends S.Opaque<ChangeRole, { readonly brand: unique symbol }>()(
  S.Struct({
    role: Role.pipe(S.annotateKey({ messageMissingKey: "Choose a role: viewer, editor or admin." }))
  }).pipe($I.annoteSchema("ChangeRole", { description: "Give a member this role" }))
) {}

/**
 * The two reasons an add comes to nothing: nobody signed up with the email, or they are already a member.
 *
 * @category schemas
 */
export const AddPersonProblemKind = LiteralKit(["noAccount", "alreadyMember"]).pipe(
  $I.annoteSchema("AddPersonProblemKind", {
    description: "Nobody has signed up with the email, or they are already a member with another role"
  })
)

/**
 * The decoded value of `AddPersonProblemKind`.
 *
 * @category models
 */
export type AddPersonProblemKind = typeof AddPersonProblemKind.Type

/**
 * Why an admin's "add a person" could not add them, as data the form shows beside the email typed: nobody has
 * signed up with that email (`noAccount`), or they are already in the organization with another role
 * (`alreadyMember`). A problem with what the person typed, so never a request error.
 *
 * @category schemas
 */
export class AddPersonProblem extends S.Opaque<AddPersonProblem, { readonly brand: unique symbol }>()(
  S.TaggedStruct("AddPersonProblem", {
    kind: AddPersonProblemKind,
    problem: Sentence.pipe(S.annotateKey({ description: "What is wrong with the email given, in a sentence" })),
    todo: Sentence.pipe(S.annotateKey({ description: "What the admin can do instead, in a sentence" }))
  }).pipe(
    $I.annoteSchema("AddPersonProblem", {
      description: "Why a person could not be added, as data the form shows beside the email typed"
    })
  )
) {}

/**
 * What adding a person comes to: the person added (or already there with that role), or why not
 * (`AddPersonProblem`), answered with 200 either way: an email nobody signed up with is a problem with what the admin
 * typed, not a request error.
 *
 * @category schemas
 */
export const AddPersonOutcome = S.Result(Person, AddPersonProblem).pipe(
  $I.annoteSchema("AddPersonOutcome", {
    description: "The person added, or why they could not be (an AddPersonProblem)"
  })
)

/**
 * The decoded value of `AddPersonOutcome`: the person added, or why not.
 *
 * @category models
 */
export type AddPersonOutcome = typeof AddPersonOutcome.Type
