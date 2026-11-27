// The rejections more than one command of the review returns, and `whose`, a record of fields that one of them and
// two of `DecideRow`'s own rejections spread.
import * as Domain from "@alchemy.run/domain"
import * as S from "effect/Schema"
import { Change } from "./Change.schema.ts"

/**
 * Whose a decision or an undo on a row is, and the change that recorded it: what a refusal that names one hands back.
 *
 * @category models
 * @since 0.0.0
 */
export const whose = {
  by: S.String.pipe(S.annotateKey({ description: "The member whose act it is" })),
  change: Change.pipe(S.annotateKey({ description: "The change that recorded it" }))
}

/**
 * **Details**
 *
 * It hands back no number: the screen learns the last group act only by receiving it, so nothing it is told here lets
 * the same act pass.
 *
 * @category rejections
 * @since 0.0.0
 */
export class GroupedSince extends Domain.Rejection(
  "GroupedSince",
  {},
  { description: "An act on a group of rows landed that the sender's screen had not received" }
) {}

/**
 * **Details**
 *
 * The later act is in force over what is being taken back. `last` is the import's last group in force, the one to
 * take back first: groups are taken back last first. For a group's undo it is the group over this one. For a row's
 * undo, whose sender says a group covers the row since its decision, it is that group or one made after it: the model
 * keeps no reading of a group's rows, so it cannot say which. In both, the later act was drawn on a screen that had
 * this one.
 *
 * @category rejections
 * @since 0.0.0
 */
export class GroupedAfter extends Domain.Rejection(
  "GroupedAfter",
  { last: Change },
  { description: "A later act on a group is still in force: the number of the import's last group in force" }
) {}

/**
 * **Details**
 *
 * `by` is who took the undo and `change` is the change it took back. A press drawn before the undo may name exactly
 * what the row holds again, so the number of the row's decision does not tell it from a press made after: the last
 * undo the screen has received does.
 *
 * @category rejections
 * @since 0.0.0
 */
export class UndoneSince extends Domain.Rejection(
  "UndoneSince",
  whose,
  { description: "An undo landed on the row that the sender's screen had not received: whose, and of which change" }
) {}

/**
 * **Details**
 *
 * `UndoGroup` returns it too: the group is not decided, is not the sender's, was not recorded by the change named, or
 * was taken back already.
 *
 * @category rejections
 * @since 0.0.0
 */
export class NotYourStep extends Domain.Rejection(
  "NotYourStep",
  {},
  { description: "The row does not hold that change as the sender's own decision" }
) {}

/**
 * **Details**
 *
 * A confirm that stands was made after the decision: the row is decided again, the item edited, or the import taken
 * back. What a standing confirm wrote is taken back with the import, not by an undo.
 *
 * @category rejections
 * @since 0.0.0
 */
export class DecidedBeforeTheConfirm extends Domain.Rejection(
  "DecidedBeforeTheConfirm",
  {},
  { description: "The decision was made before a confirm that stands, so it is not undone here" }
) {}
