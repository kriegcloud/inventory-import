// The rejections several commands of the import return, and the four decisions with them.
import * as Domain from "@alchemy.run/domain"
import { Role } from "@inventory/kernel/Role"
import * as S from "effect/Schema"
import { Change } from "../Review/Change.schema.ts"

/**
 * **Details**
 *
 * `required` is the lowest role that may do it, so the screen can say which role they have, which one this needs and
 * whom to ask, as a refused write on `/api/v1` says it. It is asked before anything stored is read, so it tells
 * nothing of the import.
 *
 * @category rejections
 * @since 0.0.0
 */
export class NotPermitted extends Domain.Rejection(
  "NotPermitted",
  { required: Role.pipe(S.annotateKey({ description: "The lowest role that may do this" })) },
  { description: "The person's role is too low for this", httpApiStatus: 403 }
) {}

/**
 * What a person reads of an import their organization has none of: the words `/api/v1` says today.
 *
 * @category rejections
 * @since 0.0.0
 */
export const NoImportThere = "No import with that id in your organization."

/**
 * **Details**
 *
 * The import was never staged, or it is another organization's. Both are answered alike, and before any state is
 * told, so nothing stored is told to whoever names an id that is not theirs. A row or a group kept under another
 * import's name is answered the same.
 *
 * @category rejections
 * @since 0.0.0
 */
export class ImportNotFound extends Domain.Rejection(
  "ImportNotFound",
  { reason: S.Literal(NoImportThere).pipe(S.annotateKey({ description: "The sentence the person reads" })) },
  { description: "No import with this id is in the person's organization", httpApiStatus: 404 }
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
