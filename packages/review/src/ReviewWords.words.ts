/**
 * The region's status and tab words, in one place. A caller with the task's own words passes them as `words` on the
 * region; every tab, tag, count, sentence and downloaded file then says them. Nothing else in the region spells one.
 */
import type { ReviewWords } from "@inventory/review/ReviewTypes"

/** The words when the caller gives none. */
export const defaultReviewWords: ReviewWords = {
  needs: "Needs a decision",
  cannot: "Cannot import",
  ready: "Ready",
  out: "Left out",
  all: "All",
  stored: "Already there",
  auto: "Auto-fixed",
  accepted: "Accepted",
  kept: "Kept",
  edited: "Edited",
  chosen: "Chosen",
  nothingNew: "Nothing new: this file is already in",
  nothingToImport: "Nothing here can be imported"
}

/** The caller's words over the defaults. */
export const reviewWords = (given: Partial<ReviewWords> | undefined): ReviewWords =>
  given === undefined ? defaultReviewWords : { ...defaultReviewWords, ...given }
