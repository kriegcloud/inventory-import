import { Effect } from "effect"
import * as S from "effect/Schema"

const codec = S.fromJsonString(S.Unknown)

/** JSON text for browser state and cells, preserving property order and omitted optional values. */
export function stringify(value: object | null): string
export function stringify(value: unknown): string | undefined
export function stringify(value: unknown): string | undefined {
  return value === undefined ? undefined : Effect.runSync(S.encodeEffect(codec)(value))
}

/** Reads JSON at the synchronous browser boundary; callers keep their existing invalid-input fallback. */
export const parse = (text: string): unknown => Effect.runSync(S.decodeEffect(codec)(text))
