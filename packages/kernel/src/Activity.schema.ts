/**
 * One line of the audit trail: who did what, in words a person can read. `Activity` is the stored row;
 * `Activity.json` is what crosses the API.
 *
 * A `Model.Class` takes one type argument, so this class carries no brand (schema rule SF-9's one exception here);
 * its id is branded.
 *
 * @packageDocumentation
 */
import * as S from "effect/Schema"
import * as Model from "effect/schema/Model"
import { ActivityId, MemberId, OrganizationId } from "./Ids.id.ts"
import { DisplayName } from "./Text.schema.ts"

/**
 * One line of the audit trail: who did what, in words a person can read. Written by the thing it records, in the same
 * batch; never by a request of its own.
 *
 * @category schemas
 */
export class Activity extends Model.Class<Activity>("Activity")(
  {
    id: Model.UuidV4Insert(ActivityId),
    organizationId: OrganizationId,
    actorId: MemberId,
    actorName: DisplayName.pipe(
      S.annotateKey({ description: "Who did it: the member's name as it was then, for the screen. Not an id" })
    ),
    action: S.String.check(S.isMinLength(1), S.isMaxLength(120)).pipe(
      S.annotateKey({ description: "What was done, in a few words a person reads", examples: ["Imported items"] })
    ),
    detail: S.String.check(S.isMaxLength(4000)).pipe(
      S.annotateKey({
        description: "What it was done to and what came of it, in a sentence; may be empty",
        examples: ["Created 11 items from items.csv"]
      })
    ),
    agent: Model.FieldOption(
      DisplayName.pipe(
        S.annotateKey({ description: "The agent that did this for the actor. None: the person did it themselves." })
      )
    ),
    createdAt: Model.DateTimeInsert
  },
  { description: "One line of the audit trail: who did what, in words a person can read" }
) {}
