import { LiteralKit } from "@beep/schema/LiteralKit"
import * as S from "effect/Schema"
import * as SchemaTransformation from "effect/SchemaTransformation"
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema, OpenApi } from "effect/http-api"
import { MemberId } from "@inventory/kernel/Ids"
import { Role } from "@inventory/kernel/Role"
import { DisplayName, Instant, Sentence } from "@inventory/kernel/Text"
import { AccountEmail } from "./Identity.ts"
import { Forbidden } from "@inventory/kernel/AccessError"
import { Identity } from "@inventory/kernel/Identity"

/** The two reasons an add comes to nothing: nobody signed up with the email, or they are already a member. */
export const AddPersonProblemKind = LiteralKit(["noAccount", "alreadyMember"]).annotate({
  identifier: "AddPersonProblemKind",
  description: "Nobody has signed up with the email, or they are already a member with another role"
})
/** The decoded value of `AddPersonProblemKind`. */
export type AddPersonProblemKind = typeof AddPersonProblemKind.Type

/**
 * Why an admin's "add a person" could not add them, as data the form shows beside the email typed: nobody has
 * signed up with that email (`noAccount`), or they are already in the organization with another role
 * (`alreadyMember`). A problem with what the person typed, so never a request error.
 */
export class AddPersonProblem extends S.Opaque<AddPersonProblem, { readonly brand: unique symbol }>()(
  S.TaggedStruct("AddPersonProblem", {
    kind: AddPersonProblemKind,
    problem: Sentence.pipe(S.annotateKey({ description: "What is wrong with the email given, in a sentence" })),
    todo: Sentence.pipe(S.annotateKey({ description: "What the admin can do instead, in a sentence" }))
  }).annotate({
    identifier: "AddPersonProblem",
    description: "Why a person could not be added, as data the form shows beside the email typed"
  })
) {}

// The limit is checked after the trim, so the document's own `maxLength` cannot state it: the sentence does.
const emailDescription =
  "The email the person signed up with, whatever its case. Spaces around it are dropped; what is left is 1 to 254 characters"

/**
 * The email an admin types to add a person, as the lookup key: the spaces around it dropped and its letters
 * lower-cased, because an account is found whatever the case it was typed in.
 */
export const EmailToFind = S.Trim.pipe(
  S.decode(SchemaTransformation.toLowerCase()),
  S.decodeTo(AccountEmail),
  S.annotate({ identifier: "EmailToFind", description: emailDescription }),
  S.annotateEncoded({ description: emailDescription, examples: ["elena@sample-supply.test"] })
)
/** The decoded value of `EmailToFind`. */
export type EmailToFind = typeof EmailToFind.Type

/** One member of the organization as the People page shows them. `email` is none for a member with no account. */
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
  }).annotate({ identifier: "Person", description: "One member of the organization as the People page shows them" })
) {}

/** The member in the address is not in this organization (removed meanwhile, or never there). */
export class PersonNotFound extends S.TaggedError<PersonNotFound, { readonly brand: unique symbol }>()(
  "PersonNotFound",
  { reason: Sentence },
  { description: "The member in the address is not in this organization", httpApiStatus: 404 }
) {}

/**
 * What adding a person comes to: the person added (or already there with that role), or why not
 * (`AddPersonProblem`), answered with 200 either way: an email nobody signed up with is a problem with what the admin
 * typed, not a request error.
 */
export const AddPersonOutcome = S.Result(Person, AddPersonProblem).annotate({
  description: "The person added, or why they could not be (an AddPersonProblem)"
})
/** The decoded value of `AddPersonOutcome`: the person added, or why not. */
export type AddPersonOutcome = typeof AddPersonOutcome.Type

/** The change would leave the organization with no admin, so nobody could manage it afterwards. */
export class LastAdmin extends S.TaggedError<LastAdmin, { readonly brand: unique symbol }>()(
  "LastAdmin",
  { reason: Sentence },
  {
    description: "The change would leave the organization with no admin, so nobody could manage it afterwards",
    httpApiStatus: 409
  }
) {}

/** Add the person who signed up with this email, with this role. */
export class AddPerson extends S.Opaque<AddPerson, { readonly brand: unique symbol }>()(
  S.Struct({
    email: EmailToFind.pipe(
      S.annotateKey({ description: emailDescription, messageMissingKey: "Give the email the person signed up with." })
    ),
    role: Role.pipe(S.annotateKey({ messageMissingKey: "Choose a role: viewer, editor or admin." }))
  }).annotate({ identifier: "AddPerson", description: "Add the person who signed up with this email, with this role" })
) {}

/** Give a member this role. */
export class ChangeRole extends S.Opaque<ChangeRole, { readonly brand: unique symbol }>()(
  S.Struct({
    role: Role.pipe(S.annotateKey({ messageMissingKey: "Choose a role: viewer, editor or admin." }))
  }).annotate({ identifier: "ChangeRole", description: "Give a member this role" })
) {}

const memberId = {
  memberId: MemberId.pipe(
    S.annotateKey({
      description: "The member's id, as `people.list` gives it (`memberId`)",
      examples: [MemberId.make("mem_marcus")]
    })
  )
}

/**
 * Who is in the organization. Every member can read the list; adding a person, changing a role and removing a
 * member need the admin role. A person is added by the email they signed up with: no email is sent.
 */
export class PeopleApi extends HttpApiGroup.make("people")
  .add(
    HttpApiEndpoint.get("list", "/", {
      success: S.Array(Person).annotate({ description: "Every member of the caller's organization" })
    })
      .annotate(OpenApi.Summary, "List the people of the caller's organization")
      .annotate(
        OpenApi.Description,
        "Who is in the caller's organization, with each person's role. Any member may read it."
      ),
    HttpApiEndpoint.post("add", "/", {
      payload: AddPerson,
      success: AddPersonOutcome,
      error: Forbidden
    })
      .annotate(OpenApi.Summary, "Add a person who has signed up, with a role")
      .annotate(
        OpenApi.Description,
        "Adds a person by the email they signed up with; no email is sent. Answers 200 either way: the person added (or already there with that role), or why not (`AddPersonProblem`: nobody signed up with that email, or they are already a member with another role). Needs the admin role."
      ),
    HttpApiEndpoint.post("setRole", "/:memberId/role", {
      params: memberId,
      payload: ChangeRole,
      success: Person,
      error: [Forbidden, PersonNotFound, LastAdmin]
    })
      .annotate(OpenApi.Summary, "Change a person's role")
      .annotate(
        OpenApi.Description,
        "Changes a member's role. Refused with 409 `LastAdmin` when it would leave the organization with no admin. Needs the admin role."
      ),
    HttpApiEndpoint.delete("remove", "/:memberId", {
      params: memberId,
      success: HttpApiSchema.NoContent,
      error: [Forbidden, PersonNotFound, LastAdmin]
    })
      .annotate(OpenApi.Summary, "Remove a person from the organization")
      .annotate(
        OpenApi.Description,
        "Removes a member from the organization and answers 204 with no body. Refused with 409 `LastAdmin` when it would leave the organization with no admin. Needs the admin role."
      )
  )
  .middleware(Identity)
  .prefix("/people")
  .annotate(OpenApi.Title, "People")
  .annotate(
    OpenApi.Description,
    "Who is in the organization. Every member can read the list; adding a person, changing a role and removing a member need the admin role. A person is added by the email they signed up with: no email is sent."
  ) {}
