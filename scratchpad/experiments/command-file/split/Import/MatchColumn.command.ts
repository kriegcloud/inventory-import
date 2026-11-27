// One command of the import in a file of its own: the command, the event it records, and (in the second
// variant) what the import decides of it.
import * as Domain from "@alchemy.run/domain"
import * as S from "effect/Schema"
import { Session } from "../Actor/Session.middleware.ts"
import { Change, Columns, ImportKey } from "../Review/Change.schema.ts"
import { ConfirmedSince, MatchedSince, NotOpen, NotPermitted } from "./Import.rejection.ts"

/**
 * Which column fills each field now, every field a match moved included, the number of the match, and who made it:
 * the mapping, and since which match each field reads its column, can be rebuilt from the import's events alone.
 */
export class ColumnMatched extends Domain.Event(
  "ColumnMatched",
  { change: Change, matching: S.Int, columns: Columns, by: S.String },
  { description: "A column was matched to a field: every field's column after it" }
) {}

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

