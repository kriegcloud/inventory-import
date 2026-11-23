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
import { aboutClass, aboutProperty, noTerm } from "./Terms.pointer.ts"
import { DisplayName } from "./Text.schema.ts"

// The marks of the three fields built as a `Model` `Field` (report 14 section 3.5). A `Field` is marked on each variant
// it has with `Model.fieldEvolve`, each function written in place as `(s) => s.annotateKey(mark)` so that it keeps the
// variant's own type; the marks are hoisted as annotation objects, never as an `S.annotateKey(...)` callback, which
// would type every variant it touched as `Top`.
const subjectMark = aboutClass("inv:AuditEntry")
const deferredMark = {
  description: "The agent that did this for the actor. None: the person did it themselves.",
  ...noTerm("deferred", "party")
}
const atMark = aboutProperty("inv:recordedAt")

/**
 * One line of the audit trail: who did what, in words a person can read. Written by the thing it records, in the same
 * batch; never by a request of its own.
 *
 * It points at `inv:AuditEntry` (report 14 section 3.5, decision 98). Every field carries one mark, and each mark
 * reaches all six variants: `Activity.json`, the element of the audit trail, carries the same field marks and no
 * class pointer of its own.
 *
 * @category schemas
 */
export class Activity extends Model.Class<Activity>("Activity")(
  {
    id: Model.fieldEvolve(Model.UuidV4Insert(ActivityId), {
      select: (s) => s.annotateKey(subjectMark),
      insert: (s) => s.annotateKey(subjectMark),
      update: (s) => s.annotateKey(subjectMark),
      json: (s) => s.annotateKey(subjectMark)
    }),
    // Marked with no description: a description here would change the OpenAPI document, which a mark must not.
    organizationId: OrganizationId.pipe(S.annotateKey(aboutProperty("inv:inTenant"))),
    actorId: MemberId.pipe(S.annotateKey(aboutProperty("inv:recordedActor"))),
    actorName: DisplayName.pipe(
      S.annotateKey({
        description: "Who did it: the member's name as it was then, for the screen. Not an id",
        ...noTerm("screen")
      })
    ),
    action: S.String.check(S.isMinLength(1), S.isMaxLength(120)).pipe(
      S.annotateKey({
        description: "What was done, in a few words a person reads",
        examples: ["Imported items"],
        ...aboutProperty("inv:action")
      })
    ),
    detail: S.String.check(S.isMaxLength(4000)).pipe(
      S.annotateKey({
        description: "What it was done to and what came of it, in a sentence; may be empty",
        examples: ["Created 11 items from items.csv"],
        ...noTerm("screen")
      })
    ),
    agent: Model.fieldEvolve(Model.FieldOption(DisplayName), {
      select: (s) => s.annotateKey(deferredMark),
      insert: (s) => s.annotateKey(deferredMark),
      update: (s) => s.annotateKey(deferredMark),
      json: (s) => s.annotateKey(deferredMark),
      jsonCreate: (s) => s.annotateKey(deferredMark),
      jsonUpdate: (s) => s.annotateKey(deferredMark)
    }),
    createdAt: Model.fieldEvolve(Model.DateTimeInsert, {
      select: (s) => s.annotateKey(atMark),
      insert: (s) => s.annotateKey(atMark),
      json: (s) => s.annotateKey(atMark)
    })
  },
  {
    description: "One line of the audit trail: who did what, in words a person can read",
    ...aboutClass("inv:AuditEntry")
  }
) {}
