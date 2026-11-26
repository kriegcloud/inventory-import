/**
 * The region's status and tab words, in one place. A caller with the task's own words passes them as `words` on the
 * region; every tab, tag, count, sentence and downloaded file then says them. Nothing else in the region spells one.
 */
import { ReviewWords } from "@inventory/review/ReviewTypes"

/** The words when the caller gives none. */
export const defaultReviewWords: ReviewWords = ReviewWords.make({})

/** The caller's words over the defaults. */
export const reviewWords = (given: Partial<ReviewWords>): ReviewWords => ReviewWords.make(given)
