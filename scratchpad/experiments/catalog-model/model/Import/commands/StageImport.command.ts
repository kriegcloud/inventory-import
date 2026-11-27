// One command of the import: the rejections only it returns, and what the import decides of it.
import * as Domain from "@alchemy.run/domain"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import { CurrentActor } from "../../Actor/Actor.context.ts"
import { Session } from "../../Actor/Session.middleware.ts"
import { Columns, ImportKey } from "../../Review/Change.schema.ts"
import { NotPermitted } from "../Import.rejection.ts"
import * as ImportState from "../Import.state.ts"
import * as ImportStaged from "../events/ImportStaged.event.ts"

/**
 * **Details**
 *
 * Every state but `Unstaged` gets it, a removed import included: an id is staged once.
 *
 * @category rejections
 * @since 0.0.0
 */
export class AlreadyStaged extends Domain.Rejection(
  "AlreadyStaged",
  {},
  { description: "An import with this id was staged already" }
) {}

/**
 * **Details**
 *
 * The command names no organization: the import takes the one the person staging it acts in.
 *
 * @category commands
 * @since 0.0.0
 */
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

/**
 * Stages a file on an import that was never staged, recording one `ImportStaged` in the actor's organization.
 *
 * **Details**
 *
 * The checks run in this order, and the first that fails is the rejection: `NotPermitted` for a viewer;
 * `AlreadyStaged` for any state but `Unstaged`.
 *
 * @category behavior
 * @since 0.0.0
 */
export const decide = Effect.fn("Import.StageImport")(function* (s: ImportState.State, cmd: Command) {
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
