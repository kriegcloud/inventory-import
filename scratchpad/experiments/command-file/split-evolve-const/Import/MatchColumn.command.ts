// One command of the import in a file of its own: the command, the event it records, and (in the second
// variant) what the import decides of it.
import * as Domain from "@alchemy.run/domain"
import * as Effect from "effect/Effect"
import { dual } from "effect/Function"
import * as S from "effect/Schema"
import { CurrentActor } from "../Actor/Actor.context.ts"
import { Session } from "../Actor/Session.middleware.ts"
import { Change, Columns, ImportKey } from "../Review/Change.schema.ts"
import { ConfirmedSince, MatchedSince, NotOpen, NotPermitted } from "./Import.rejection.ts"
import { ImportState } from "./Import.state.ts"

/**
 * Which column fills each field now, every field a match moved included, the number of the match, and who made it:
 * the mapping, and since which match each field reads its column, can be rebuilt from the import's events alone.
 */
export class ColumnMatched extends Domain.Event(
  "ColumnMatched",
  { change: Change, matching: S.Int, columns: Columns, by: S.String },
  { description: "A column was matched to a field: every field's column after it" }
) {}

/** What an import is after a match: an open one takes the match, any other is as it was. */
export const evolveColumnMatched: {
  (e: ColumnMatched): (s: ImportState) => ImportState
  (s: ImportState, e: ColumnMatched): ImportState
} = dual(
  2,
  (s: ImportState, e: ColumnMatched): ImportState =>
    ImportState.guards.Open(s) ? { ...s, changes: e.change, matching: e.matching, columns: e.columns } : s
)

/** Match a column to a field. `columns` is every field's column after it; `saw` the matching the sender's screen has. */
export class MatchColumn extends Domain.Command(
  "MatchColumn",
  {
    middleware: [Session],
    input: { importId: ImportKey, columns: Columns, saw: S.Int, opening: S.Int },
    events: [ColumnMatched],
    rejects: [NotPermitted, NotOpen, ConfirmedSince, MatchedSince]
  },
  { description: "Match a column to a field, naming the last match the sender saw" }
) {}

/** What the import decides of a match: refused, nothing to record, or the match. */
export const decideMatchColumn = Effect.fn("Import.MatchColumn")(function* (s: ImportState, cmd: MatchColumn) {
  const actor = yield* CurrentActor
  if (!ImportState.guards.Open(s)) return yield* NotOpen.make({})
  if (actor.organizationId !== s.organizationId || actor.role === "viewer") return yield* NotPermitted.make({})
  if (cmd.opening !== s.confirms) return yield* ConfirmedSince.make({})
  if (cmd.saw !== s.matching) return yield* MatchedSince.make({ matching: s.matching })
  // Every field reads this already, by its heading or by hand: nothing is recorded, and nothing is taken back.
  if (s.columns === cmd.columns) return []
  return [
    ColumnMatched.make({
      change: s.changes + 1,
      matching: s.matching + 1,
      columns: cmd.columns,
      by: actor.memberId
    })
  ]
})
