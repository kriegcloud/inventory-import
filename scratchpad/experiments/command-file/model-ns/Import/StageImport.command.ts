// One command of the import: the events it records and what each makes of an import, the rejections only it
// returns, and what the import decides of it.
import * as Domain from "@alchemy.run/domain"
import * as Effect from "effect/Effect"
import { dual } from "effect/Function"
import * as S from "effect/Schema"
import { CurrentActor } from "../Actor/Actor.context.ts"
import { Session } from "../Actor/Session.middleware.ts"
import { Columns, ImportKey } from "../Review/Change.schema.ts"
import { NotPermitted } from "./Import.rejection.ts"
import { ImportState } from "./Import.state.ts"

/** A file was staged for review: how many rows it has and which column fills each field by its heading. */
export class ImportStaged extends Domain.Event(
  "ImportStaged",
  { organizationId: S.String, rows: S.Natural, columns: Columns, by: S.String },
  { description: "A file was staged for review" }
) {}

/** What an import is after `ImportStaged`. */
export const evolve: {
  (e: ImportStaged): (s: ImportState) => ImportState
  (s: ImportState, e: ImportStaged): ImportState
} = dual(2, (_: ImportState, e: ImportStaged): ImportState =>
  ImportState.cases.Open.make({
    status: "Open",
    organizationId: e.organizationId,
    rows: e.rows,
    confirms: 0,
    matching: 0,
    columns: e.columns,
    changes: 0,
    confirmedAt: 0,
    inForce: 0,
    replaced: 0,
    standing: 0,
    lastGroup: 0,
    topGroup: 0,
    suggestions: 0
  }))

/** An import with this id was staged already. */
export class AlreadyStaged extends Domain.Rejection(
  "AlreadyStaged",
  {},
  { description: "An import with this id was staged already" }
) {}

/** Stage a file for review. */
export class StageImport extends Domain.Command(
  "StageImport",
  {
    middleware: [Session],
    input: { importId: ImportKey, rows: S.Natural, columns: Columns },
    events: [ImportStaged],
    rejects: [NotPermitted, AlreadyStaged]
  },
  { description: "Stage a file for review: its rows and the column each field reads by its heading" }
) {}

/** What the import decides of `StageImport`. */
export const decide = Effect.fn("Import.StageImport")(function* (s: ImportState, cmd: StageImport) {
  const actor = yield* CurrentActor
  if (actor.role === "viewer") return yield* NotPermitted.make({})
  if (!ImportState.guards.Unstaged(s)) return yield* AlreadyStaged.make({})
  return [
    ImportStaged.make({
      organizationId: actor.organizationId,
      rows: cmd.rows,
      columns: cmd.columns,
      by: actor.memberId
    })
  ]
})
