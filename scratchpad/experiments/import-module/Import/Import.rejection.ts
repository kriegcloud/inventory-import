// The rejections several commands of the import return, and the four decisions with them.
import * as Domain from "@alchemy.run/domain"
import * as S from "effect/Schema"
import { Change } from "../Review/Change.schema.ts"

/** The person is a viewer, or acts in another organization, or is not the one who may do this. */
export class NotPermitted extends Domain.Rejection(
  "NotPermitted",
  {},
  { description: "This person may not do this" }
) {}
/** The import is not open for review. */
export class NotOpen extends Domain.Rejection("NotOpen", {}, { description: "The import is not open for review" }) {}
/** The screen has not received every change: the last one's number. */
export class ReviewMovedOn extends Domain.Rejection(
  "ReviewMovedOn",
  { last: Change },
  { description: "The sender's screen has not received every change of the import" }
) {}
/** The import was confirmed after the act was made: the screen names it. */
export class ConfirmedSince extends Domain.Rejection(
  "ConfirmedSince",
  {},
  { description: "The import was confirmed after this was made" }
) {}
/** A column was matched again: the matching now. */
export class MatchedSince extends Domain.Rejection(
  "MatchedSince",
  { matching: S.Int },
  { description: "A column was matched again after this was made" }
) {}
