import * as S from "effect/Schema"
import { SessionState } from "@inventory/access-contract/SessionState"

/**
 * Reads the session answer through its Schema. A module of its own, asked for with the first session request: the
 * sign-in form is drawn before it arrives, so the first download carries neither Effect's Schema nor the contract
 * (src/web/lib/actor.ts).
 */
export const decodeSession = S.decodeUnknownPromise(SessionState)
