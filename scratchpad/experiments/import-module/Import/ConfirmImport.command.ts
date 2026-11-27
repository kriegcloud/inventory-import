// One command of the import: the events it records and what each makes of an import, the rejections only it
// returns, and what the import decides of it.
import * as Domain from "@alchemy.run/domain"
import * as Effect from "effect/Effect"
import { dual } from "effect/Function"
import * as S from "effect/Schema"
import { CurrentActor } from "../Actor/Actor.context.ts"
import { Session } from "../Actor/Session.middleware.ts"
import { Change, Digest, ImportKey } from "../Review/Change.schema.ts"
import { NotOpen, NotPermitted, ReviewMovedOn } from "./Import.rejection.ts"
import { ImportState } from "./Import.state.ts"

/** The import was confirmed: what became of its rows, as the four outcomes that add up to them. */
export class ImportConfirmed extends Domain.Event(
  "ImportConfirmed",
  { change: Change, created: S.Natural, updated: S.Natural, already: S.Natural, notImported: S.Natural, by: S.String },
  { description: "The import was confirmed: how many rows were created, updated, already there and not imported" }
) {}

/** What an import is after `ImportConfirmed`. */
export const evolveImportConfirmed: {
  (e: ImportConfirmed): (s: ImportState) => ImportState
  (s: ImportState, e: ImportConfirmed): ImportState
} = dual(2, (s: ImportState, e: ImportConfirmed): ImportState =>
  ImportState.guards.Open(s)
    ? ImportState.cases.Imported.make({
        status: "Imported",
        organizationId: s.organizationId,
        rows: s.rows,
        confirms: s.confirms + 1,
        matching: s.matching,
        columns: s.columns,
        changes: e.change,
        confirmedAt: e.change,
        inForce: s.inForce + e.created,
        replaced: s.replaced + e.updated,
        standing: s.standing + 1,
        lastGroup: s.lastGroup,
        topGroup: s.topGroup,
        created: e.created,
        updated: e.updated,
        already: e.already,
        notImported: e.notImported
      })
    : s
)

/** The plan was built at a change that is no longer the last: the handler builds it again. */
export class PlanBehind extends Domain.Rejection(
  "PlanBehind",
  { last: Change },
  { description: "The confirm's plan was built before the import's last change" }
) {}

/** What the plan would do is not what the button said: the stored items changed, with no change of this import between. */
export class NotWhatWasShown extends Domain.Rejection(
  "NotWhatWasShown",
  {},
  { description: "The confirm would do something else than its button said" }
) {}

/** The confirm's four outcomes do not add up to the rows in the file. */
export class CountsDoNotAddUp extends Domain.Rejection(
  "CountsDoNotAddUp",
  {},
  { description: "The confirm's outcomes do not add up to the rows in the file" }
) {}

/**
 * Confirm the import. `seen`: the screen has received every change up to this number, its own acts' included.
 * `planAt`: the handler built the plan from rows written up to this number. `shown` and `plan`: what every row
 * becomes, as one digest, as the screen had it and as the plan has it.
 */
export class ConfirmImport extends Domain.Command(
  "ConfirmImport",
  {
    middleware: [Session],
    input: {
      importId: ImportKey,
      seen: Change,
      planAt: Change,
      shown: Digest,
      plan: Digest,
      created: S.Natural,
      updated: S.Natural,
      already: S.Natural,
      notImported: S.Natural
    },
    events: [ImportConfirmed],
    rejects: [NotPermitted, NotOpen, ReviewMovedOn, PlanBehind, NotWhatWasShown, CountsDoNotAddUp]
  },
  { description: "Confirm the import, naming the last change the screen received and what its button said" }
) {}

/** What the import decides of `ConfirmImport`. */
export const decideConfirmImport = Effect.fn("Import.ConfirmImport")(function* (s: ImportState, cmd: ConfirmImport) {
  const actor = yield* CurrentActor
  if (!ImportState.guards.Open(s)) return yield* NotOpen.make({})
  if (actor.organizationId !== s.organizationId || actor.role === "viewer") return yield* NotPermitted.make({})
  if (cmd.seen !== s.changes) return yield* ReviewMovedOn.make({ last: s.changes })
  if (cmd.planAt !== s.changes) return yield* PlanBehind.make({ last: s.changes })
  if (cmd.plan !== cmd.shown) return yield* NotWhatWasShown.make({})
  if (cmd.created + cmd.updated + cmd.already + cmd.notImported !== s.rows) {
    return yield* CountsDoNotAddUp.make({})
  }
  // No more is ever in force than the file has rows.
  if (s.inForce + cmd.created > s.rows) return yield* CountsDoNotAddUp.make({})
  return [
    ImportConfirmed.make({
      change: s.changes + 1,
      created: cmd.created,
      updated: cmd.updated,
      already: cmd.already,
      notImported: cmd.notImported,
      by: actor.memberId
    })
  ]
})
