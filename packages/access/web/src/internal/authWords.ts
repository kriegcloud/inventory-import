import type { BetterAuthRefused } from "@beep/better-auth/ClientSchema"
import * as O from "effect/Option"

/**
 * A sentence for the person from a Better Auth refusal: its own, which is already written for people ("Invalid email
 * or password"), with two of ours where it has none worth reading.
 */
export const authSentence = (refused: BetterAuthRefused): string =>
  O.contains(refused.status, 429)
    ? "Too many attempts. Wait a minute, then try again."
    : O.match(refused.sentence, { onNone: () => "Something went wrong. Try again.", onSome: (sentence) => sentence })
