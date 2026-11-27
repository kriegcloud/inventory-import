// An event of the import that only a decision records, and what it makes of an import.
import * as Domain from "@alchemy.run/domain"
import { dual } from "effect/Function"
import * as S from "effect/Schema"
import { Change, Step } from "../Review/Change.schema.ts"
import { ImportState } from "./Import.state.ts"

/**
 * One act on a group of rows, or its undo, numbered by its import and recorded by the decision that also records the
 * group: how many rows it is of, and who acted. `top` is the last act on a group still in force after this one: itself
 * when it decides a group, the one that was under it when it takes one back (0 for none).
 */
export class GroupCounted extends Domain.Event(
  "GroupCounted",
  { change: Change, step: Step, rows: S.Natural, label: S.String, by: S.String, top: Change },
  {
    description:
      "One act on a group of rows, or its undo, was taken: how many rows, who acted, which group is last in force"
  }
) {}

/** What an import is after `GroupCounted`. */
export const evolveGroupCounted: {
  (e: GroupCounted): (s: ImportState) => ImportState
  (s: ImportState, e: GroupCounted): ImportState
} = dual(2, (s: ImportState, e: GroupCounted): ImportState =>
  ImportState.guards.Open(s) ? { ...s, changes: e.change, lastGroup: e.change, topGroup: e.top } : s)
