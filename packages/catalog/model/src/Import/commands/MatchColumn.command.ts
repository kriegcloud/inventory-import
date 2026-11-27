// One command of the import, and what the import decides of it; it returns no rejection of its own.
import * as Domain from "@alchemy.run/domain"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import { CurrentActor } from "../../Actor/Actor.context.ts"
import { Session } from "../../Actor/Session.middleware.ts"
import { Columns, ImportKey } from "../../Review/Change.schema.ts"
import * as ColumnMatched from "../events/ColumnMatched.event.ts"
import {
  ConfirmedSince,
  ImportNotFound,
  MatchedSince,
  NoImportThere,
  NotOpen,
  NotPermitted
} from "../Import.rejection.ts"
import * as ImportState from "../Import.state.ts"

/**
 * **Details**
 *
 * `columns` is every field's column after the match; `saw` is the matching the sender's screen has; `opening` is the
 * import's count of confirms as the screen had it, so a match made before a confirm is not taken after a reopen.
 *
 * @category commands
 * @since 0.0.0
 */
export class Command extends Domain.Command(
  "MatchColumn",
  {
    middleware: [Session],
    input: { importId: ImportKey, columns: Columns, saw: S.Int, opening: S.Int },
    events: [ColumnMatched.Event],
    rejects: [NotPermitted, ImportNotFound, NotOpen, ConfirmedSince, MatchedSince]
  },
  { description: "Match a column to a field, naming the last match the sender saw" }
) {}

/**
 * Records a match on an open import as one `ColumnMatched`, at the next change number and the next matching.
 *
 * **Details**
 *
 * The checks run in this order, and the first that fails is the rejection: `NotOpen` for an import that is not open;
 * `NotPermitted` for a viewer or someone in another organization; `ConfirmedSince` when `opening` is not the import's
 * count of confirms; `MatchedSince` when `saw` is not its matching.
 *
 * **Gotchas**
 *
 * The same columns again are no match: it records nothing, so neither the change number nor the matching moves.
 *
 * @category behavior
 * @since 0.0.0
 */
export const decide = Effect.fn("Import.MatchColumn")(function* (s: ImportState.State, cmd: Command) {
  const actor = yield* CurrentActor
  if (actor.role === "viewer") return yield* NotPermitted.make({ required: "editor" })
  if (ImportState.guards.Unstaged(s) || actor.organizationId !== s.organizationId) {
    return yield* ImportNotFound.make({ reason: NoImportThere })
  }
  if (!ImportState.guards.Open(s)) return yield* NotOpen.make({})
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
