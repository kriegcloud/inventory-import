// The rejections several commands of the import return, and the four decisions with them.
import * as Domain from "@alchemy.run/domain"
import * as S from "effect/Schema"
import { Change } from "../Review/Change.schema.ts"

/**
 * **Details**
 *
 * The person is a viewer, or acts in another organization, or is not the one who may do this.
 *
 * @category rejections
 * @since 0.0.0
 */
export class NotPermitted extends Domain.Rejection(
  "NotPermitted",
  {},
  { description: "This person may not do this" }
) {}
/**
 * **Details**
 *
 * An import that was never staged, is confirmed, is taken back or was removed gets it.
 *
 * @category rejections
 * @since 0.0.0
 */
export class NotOpen extends Domain.Rejection("NotOpen", {}, { description: "The import is not open for review" }) {}
/**
 * **Details**
 *
 * `last` is the import's last change, so the screen can catch up to it and send again.
 *
 * @category rejections
 * @since 0.0.0
 */
export class ReviewMovedOn extends Domain.Rejection(
  "ReviewMovedOn",
  { last: Change },
  { description: "The sender's screen has not received every change of the import" }
) {}
/**
 * **Details**
 *
 * The act names the opening it was made in, as the import's count of confirms; a confirm since then moved it.
 *
 * @category rejections
 * @since 0.0.0
 */
export class ConfirmedSince extends Domain.Rejection(
  "ConfirmedSince",
  {},
  { description: "The import was confirmed after this was made" }
) {}
/**
 * **Details**
 *
 * `matching` is the import's matching now, so the screen can read the columns again before it sends.
 *
 * @category rejections
 * @since 0.0.0
 */
export class MatchedSince extends Domain.Rejection(
  "MatchedSince",
  { matching: S.Int },
  { description: "A column was matched again after this was made" }
) {}
