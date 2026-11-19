/**
 * The day's model calls: which calls count, and what is said when they are used.
 *
 * @packageDocumentation
 */
import { usedUpWords } from "@inventory/access-contract/ModelAllowance"
import type { Sentence } from "@inventory/kernel/Text"
import * as DateTime from "effect/DateTime"

/**
 * The start of the window whose calls count against the allowance: 24 hours before `now`. So the allowance comes
 * back by itself, call by call, a day after each was taken.
 *
 * @category rules
 */
export const windowStart = (now: DateTime.Utc): DateTime.Utc => DateTime.subtract(now, { hours: 24 })

/**
 * What is said when the allowance is used up and nothing else can answer.
 *
 * @category sentences
 */
export const usedUpSentence: Sentence = `${usedUpWords}. They come back over the next day.`
