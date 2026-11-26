import * as Effect from "effect/Effect"
import * as S from "effect/Schema"

const codec = S.fromJsonString(S.Unknown)

/** JSON text for browser state and cells, preserving property order and omitted optional values. */
export const stringify = (value: object | null): string => Effect.runSync(S.encodeEffect(codec)(value))

/** Reads JSON as an Effect for the caller to run at its browser boundary. */
export const parse = S.decodeEffect(codec)
