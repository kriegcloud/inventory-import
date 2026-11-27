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

/** A closed import was opened again, to fix rows it did not import. */
export class ImportReopened extends Domain.Event(
  "ImportReopened",
  { change: Change, by: S.String },
  { description: "A confirmed or taken-back import was opened again" }
) {}

/** What an import is after `ImportReopened`. */
export const evolveImportReopened: {
  (e: ImportReopened): (s: ImportState) => ImportState
  (s: ImportState, e: ImportReopened): ImportState
} = dual(2, (s: ImportState, e: ImportReopened): ImportState =>
  ImportState.guards.Imported(s) || ImportState.guards.TakenBack(s)
    ? ImportState.cases.Open.make({
        status: "Open",
        organizationId: s.organizationId,
        rows: s.rows,
        confirms: s.confirms,
        matching: s.matching,
        columns: s.columns,
        changes: e.change,
        confirmedAt: s.confirmedAt,
        inForce: s.inForce,
        replaced: s.replaced,
        standing: s.standing,
        lastGroup: s.lastGroup,
        topGroup: s.topGroup,
        suggestions: 0
      })
    : s
)

/** The import is open: only a confirmed or taken-back one is opened again. */
export class NotClosed extends Domain.Rejection("NotClosed", {}, { description: "The import is still open" }) {}

/** Open a confirmed or taken-back import again. */
export class ReopenImport extends Domain.Command(
  "ReopenImport",
  {
    middleware: [Session],
    input: { importId: ImportKey, seen: Change },
    events: [ImportReopened],
    rejects: [NotPermitted, NotClosed, ReviewMovedOn]
  },
  { description: "Open a confirmed or taken-back import again, naming its last change" }
) {}

/** What the import decides of `ReopenImport`. */
export const decideReopenImport = Effect.fn("Import.ReopenImport")(function* (s: ImportState, cmd: ReopenImport) {
  const actor = yield* CurrentActor
  if (!ImportState.guards.Imported(s) && !ImportState.guards.TakenBack(s)) return yield* NotClosed.make({})
  if (actor.organizationId !== s.organizationId || actor.role === "viewer") return yield* NotPermitted.make({})
  if (cmd.seen !== s.changes) return yield* ReviewMovedOn.make({ last: s.changes })
  return [ImportReopened.make({ change: s.changes + 1, by: actor.memberId })]
})
