import * as S from "effect/Schema"
import * as Model from "effect/schema/Model"
import { personName } from "./Described.ts"
import { MemberId, OrganizationId } from "./Identity.ts"

/** The id of one audit-trail row. A UUID generated on insert, never supplied by a request. */
export const ActivityId = S.String.pipe(S.brand("ActivityId")).annotate({
  description: "The id of one audit-trail row"
})
/** The decoded value of `ActivityId`: the id of one audit-trail row. */
export type ActivityId = typeof ActivityId.Type

/**
 * The key the browser makes once for each thing a person does (one click of a write button, one Confirm). Sent again
 * on a retry or a double submit, it names the same write, so the server answers with what is stored instead of
 * writing a second copy.
 */
export const RequestId = S.String.check(S.isUUID()).pipe(S.brand("RequestId")).annotate({
  description:
    "A UUID the browser makes once per action a person takes. A request repeated with the same id writes nothing new."
})
/** A `RequestId` as code holds it: branded, so a row id cannot stand in for it. */
export type RequestId = typeof RequestId.Type

/**
 * One line of the audit trail: who did what, in words a person can read.
 * `Activity` is the database row; `Activity.json` is what crosses the API.
 */
export class Activity extends Model.Class<Activity>("Activity")(
  {
    id: Model.UuidV4Insert(ActivityId),
    organizationId: OrganizationId,
    actorId: MemberId,
    actorName: personName("Who did it"),
    action: S.NonEmptyString.annotateKey({
      description: "What was done, in a few words a person reads",
      examples: ["Imported items"]
    }),
    detail: S.String.annotateKey({
      description: "What it was done to and what came of it, in a sentence; may be empty",
      examples: ["Created 11 items from items.csv"]
    }),
    agent: S.String.pipe(S.NullOr, S.optionalKey).annotateKey({
      description: "The agent that did this for the actor (src/server/Agent.ts). Absent or null: the person did it."
    }),
    createdAt: Model.DateTimeInsert
  },
  { description: "One line of the audit trail: who did what, in words a person can read" }
) {}
