// An event of the import that only a decision records, and what it makes of an import.
import * as Domain from "@alchemy.run/domain"
import { dual } from "effect/Function"
import * as S from "effect/Schema"
import { Change, Step } from "../Review/Change.schema.ts"
import { ImportState } from "./Import.state.ts"

/**
 * One act on one row, numbered by its import and recorded by the decision that also records the row. It says what the
 * row holds after it: the change that recorded the decision (0 when the row has none), whose it is, and its flags.
 * `actor` is who acted; after an undo the decision the row then holds can be another person's.
 */
export class ActCounted extends Domain.Event(
  "ActCounted",
  {
    change: Change,
    step: Step,
    row: S.String,
    label: S.String,
    holds: Change,
    by: S.String,
    actor: S.String,
    flags: S.String,
    madeOn: S.Int
  },
  { description: "One act on one row was taken: what the row now holds, whose it is, and who acted" }
) {}

/** What an import is after `ActCounted`. */
export const evolveActCounted: {
  (e: ActCounted): (s: ImportState) => ImportState
  (s: ImportState, e: ActCounted): ImportState
} = dual(2, (s: ImportState, e: ActCounted): ImportState => (ImportState.guards.Open(s) ? { ...s, changes: e.change } : s))
