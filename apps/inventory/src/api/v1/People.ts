import * as S from "effect/Schema"
import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/http-api"
import { reasonForPerson } from "../../domain/Described.ts"
import { AddPersonProblem, Role } from "../../domain/Identity.ts"
import { Forbidden, Identity } from "./Identity.ts"

// The limit is checked after the trim, so the document's own `maxLength` cannot state it: the sentence does.
const emailDescription =
  "The email the person signed up with, whatever its case. Spaces around it are dropped; what is left is 1 to 254 characters"

/** One member of the organization as the People page shows them. `email` is null for a member with no account. */
export const Person = S.Struct({
  memberId: S.String.annotateKey({
    description: "The member's id: what the address of a change of role or a removal names",
    examples: ["mem_marcus"]
  }),
  name: S.String.annotateKey({
    description: "The name people read. Not unique, so it never tells two people apart",
    examples: ["Marcus Oyelaran"]
  }),
  email: S.NullOr(S.String).annotateKey({
    description: "The email of the person's account; null for a member with no account"
  }),
  role: Role,
  joinedAt: S.NullOr(S.String).annotateKey({
    description: "When they became a member, as stored; null when that is not known"
  })
}).annotate({ identifier: "Person", description: "One member of the organization as the People page shows them" })
/** The decoded value of `Person`: one member of the organization as the People page shows them. */
export type Person = typeof Person.Type

/** The member in the address is not in this organization (removed meanwhile, or never there). */
export class PersonNotFound extends S.TaggedError<PersonNotFound, { readonly brand: unique symbol }>()(
  "PersonNotFound",
  { reason: reasonForPerson },
  { description: "The member in the address is not in this organization", httpApiStatus: 404 }
) {}

/**
 * What adding a person comes to: the person added (or already there with that role), or why not
 * (`AddPersonProblem`), answered with 200 either way: an email nobody signed up with is a problem with what the admin
 * typed, not a request error.
 */
export const AddPersonOutcome = S.Result(
  Person,
  // The wire side named, so the document holds it as an `AddPersonProblem` component. Annotation only.
  AddPersonProblem.pipe(
    S.annotateEncoded({
      identifier: "AddPersonProblem",
      description: "Why a person could not be added, as data the form shows beside the email typed"
    })
  )
).annotate({
  description: "The person added, or why they could not be (an AddPersonProblem)"
})
/** The decoded value of `AddPersonOutcome`: the person added, or why not. */
export type AddPersonOutcome = typeof AddPersonOutcome.Type

/** The change would leave the organization with no admin, so nobody could manage it afterwards. */
export class LastAdmin extends S.TaggedError<LastAdmin, { readonly brand: unique symbol }>()(
  "LastAdmin",
  { reason: reasonForPerson },
  {
    description: "The change would leave the organization with no admin, so nobody could manage it afterwards",
    httpApiStatus: 409
  }
) {}

const memberId = {
  memberId: S.String.check(S.isMaxLength(64)).annotateKey({
    description: "The member's id, as `people.list` gives it (`memberId`)",
    examples: ["mem_marcus"]
  })
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
      payload: S.Struct({
        // Trimmed on the way in: the description goes on both sides, so the OpenAPI document (the encoded side)
        // shows it too.
        email: S.Trim.check(S.isNonEmpty(), S.isMaxLength(254))
          .pipe(S.annotateEncoded({ description: emailDescription, examples: ["elena@sample-supply.test"] }))
          .annotateKey({
            description: emailDescription,
            messageMissingKey: "Give the email the person signed up with."
          }),
        role: Role.annotateKey({ messageMissingKey: "Choose a role: viewer, editor or admin." })
      }),
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
      payload: S.Struct({
        role: Role.annotateKey({ messageMissingKey: "Choose a role: viewer, editor or admin." })
      }),
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
      success: S.Struct({
        removed: S.Boolean.annotateKey({ description: "True: the person is no longer a member" })
      }).annotate({ description: "The person was removed from the organization" }),
      error: [Forbidden, PersonNotFound, LastAdmin]
    })
      .annotate(OpenApi.Summary, "Remove a person from the organization")
      .annotate(
        OpenApi.Description,
        "Removes a member from the organization. Refused with 409 `LastAdmin` when it would leave the organization with no admin. Needs the admin role."
      )
  )
  .middleware(Identity)
  .prefix("/people")
  .annotate(OpenApi.Title, "People")
  .annotate(
    OpenApi.Description,
    "Who is in the organization. Every member can read the list; adding a person, changing a role and removing a member need the admin role. A person is added by the email they signed up with: no email is sent."
  ) {}
