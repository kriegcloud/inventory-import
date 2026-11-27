// One command of the import: the rejections only it returns, and what the import decides of it.
import * as Domain from "@alchemy.run/domain"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import { CurrentActor } from "../Actor/Actor.context.ts"
import { Session } from "../Actor/Session.middleware.ts"
import { Columns, ImportKey } from "../Review/Change.schema.ts"
import { NotPermitted } from "./Import.rejection.ts"
import { ImportState } from "./Import.state.ts"
import * as ImportStaged from "./ImportStaged.event.ts"

/** An import with this id was staged already. */
export class AlreadyStaged extends Domain.Rejection(
  "AlreadyStaged",
  {},
  { description: "An import with this id was staged already" }
) {}

/** Stage a file for review. */
export class Command extends Domain.Command(
  "StageImport",
  {
    middleware: [Session],
    input: { importId: ImportKey, rows: S.Natural, columns: Columns },
    events: [ImportStaged.Event],
    rejects: [NotPermitted, AlreadyStaged]
  },
  { description: "Stage a file for review: its rows and the column each field reads by its heading" }
) {}

/** What the import decides of `StageImport`. */
export const decide = Effect.fn("Import.StageImport")(function* (s: ImportState, cmd: Command) {
  const actor = yield* CurrentActor
  if (actor.role === "viewer") return yield* NotPermitted.make({})
  if (!ImportState.guards.Unstaged(s)) return yield* AlreadyStaged.make({})
  return [
    ImportStaged.Event.make({
      organizationId: actor.organizationId,
      rows: cmd.rows,
      columns: cmd.columns,
      by: actor.memberId
    })
  ]
})
