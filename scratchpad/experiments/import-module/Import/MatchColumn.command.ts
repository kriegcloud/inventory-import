// One command of the import: the rejections only it returns, and what the import decides of it.
import * as Domain from "@alchemy.run/domain"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import { CurrentActor } from "../Actor/Actor.context.ts"
import { Session } from "../Actor/Session.middleware.ts"
import { Columns, ImportKey } from "../Review/Change.schema.ts"
import * as ColumnMatched from "./ColumnMatched.event.ts"
import { ConfirmedSince, MatchedSince, NotOpen, NotPermitted } from "./Import.rejection.ts"
import * as ImportState from "./Import.state.ts"

/** Match a column to a field. `columns` is every field's column after it; `saw` the matching the sender's screen has. */
export class Command extends Domain.Command(
  "MatchColumn",
  {
    middleware: [Session],
    input: { importId: ImportKey, columns: Columns, saw: S.Int, opening: S.Int },
    events: [ColumnMatched.Event],
    rejects: [NotPermitted, NotOpen, ConfirmedSince, MatchedSince]
  },
  { description: "Match a column to a field, naming the last match the sender saw" }
) {}

/** What the import decides of `MatchColumn`. */
export const decide = Effect.fn("Import.MatchColumn")(function* (s: ImportState.State, cmd: Command) {
  const actor = yield* CurrentActor
  if (!ImportState.guards.Open(s)) return yield* NotOpen.make({})
  if (actor.organizationId !== s.organizationId || actor.role === "viewer") return yield* NotPermitted.make({})
  if (cmd.opening !== s.confirms) return yield* ConfirmedSince.make({})
  if (cmd.saw !== s.matching) return yield* MatchedSince.make({ matching: s.matching })
  // Every field reads this already, by its heading or by hand: nothing is recorded, and nothing is taken back.
  if (s.columns === cmd.columns) return []
  return [
    ColumnMatched.Event.make({
      change: s.changes + 1,
      matching: s.matching + 1,
      columns: cmd.columns,
      by: actor.memberId
    })
  ]
})
