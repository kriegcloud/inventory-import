// One command of the import: the events it records and what each makes of an import, the rejections only it
// returns, and what the import decides of it.
import * as Domain from "@alchemy.run/domain"
import * as Effect from "effect/Effect"
import { dual } from "effect/Function"
import * as S from "effect/Schema"
import { CurrentActor } from "../Actor/Actor.context.ts"
import { Session } from "../Actor/Session.middleware.ts"
import { Change, ImportKey } from "../Review/Change.schema.ts"
import { NotPermitted, ReviewMovedOn } from "./Import.rejection.ts"
import { ImportState } from "./Import.state.ts"

/**
 * The import was taken back. Of the items its confirms created: how many were removed, and kept because someone
 * changed them. Of the replacements they made (a count of replacements, as the confirms said them, not of items):
 * how many were put back, and kept for the same reason.
 */
export class ImportTakenBack extends Domain.Event(
  "ImportTakenBack",
  { change: Change, removed: S.Natural, kept: S.Natural, restored: S.Natural, keptReplaced: S.Natural, by: S.String },
  { description: "The import was taken back: what was removed, put back and kept" }
) {}

// Taken back from its result it says so; taken back while it is open again it stays open.
/** What an import is after `ImportTakenBack`. */
export const evolveImportTakenBack: {
  (e: ImportTakenBack): (s: ImportState) => ImportState
  (s: ImportState, e: ImportTakenBack): ImportState
} = dual(2, (s: ImportState, e: ImportTakenBack): ImportState =>
  ImportState.guards.Open(s)
    ? { ...s, changes: e.change, confirmedAt: 0, inForce: e.kept, replaced: 0, standing: 0 }
    : ImportState.guards.Imported(s)
      ? ImportState.cases.TakenBack.make({
          status: "TakenBack",
          organizationId: s.organizationId,
          rows: s.rows,
          confirms: s.confirms,
          matching: s.matching,
          columns: s.columns,
          changes: e.change,
          confirmedAt: 0,
          inForce: e.kept,
          replaced: 0,
          standing: 0,
          lastGroup: s.lastGroup,
          topGroup: s.topGroup,
          removed: e.removed,
          kept: e.kept
        })
      : s
)

/** No confirm of this import stands, so there is nothing to take back. */
export class NotImported extends Domain.Rejection(
  "NotImported",
  {},
  { description: "No confirm of this import stands" }
) {}

/** A take-back says it keeps more items than are in force. */
export class MoreKeptThanInForce extends Domain.Rejection(
  "MoreKeptThanInForce",
  {},
  { description: "A take-back keeps more items than the import has in force" }
) {}

/** Take back everything the import has in force, saying how many changed items are kept. */
export class TakeBackImport extends Domain.Command(
  "TakeBackImport",
  {
    middleware: [Session],
    input: { importId: ImportKey, seen: Change, kept: S.Natural, keptReplaced: S.Natural },
    events: [ImportTakenBack],
    rejects: [NotPermitted, NotImported, ReviewMovedOn, MoreKeptThanInForce]
  },
  { description: "Take back everything the import has in force, keeping the items someone changed" }
) {}

/** What the import decides of `TakeBackImport`. */
export const decideTakeBackImport = Effect.fn("Import.TakeBackImport")(function* (s: ImportState, cmd: TakeBackImport) {
  const actor = yield* CurrentActor
  if (!ImportState.guards.Imported(s) && !ImportState.guards.Open(s)) return yield* NotImported.make({})
  if (actor.organizationId !== s.organizationId || actor.role === "viewer") return yield* NotPermitted.make({})
  if (s.standing < 1) return yield* NotImported.make({})
  if (cmd.seen !== s.changes) return yield* ReviewMovedOn.make({ last: s.changes })
  if (cmd.kept > s.inForce || cmd.keptReplaced > s.replaced) return yield* MoreKeptThanInForce.make({})
  return [
    ImportTakenBack.make({
      change: s.changes + 1,
      removed: s.inForce - cmd.kept,
      kept: cmd.kept,
      restored: s.replaced - cmd.keptReplaced,
      keptReplaced: cmd.keptReplaced,
      by: actor.memberId
    })
  ]
})
