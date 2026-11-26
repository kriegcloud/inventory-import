import * as S from "effect/Schema"
import { $InfraId } from "./identity.ts"

const $I = $InfraId.create("Secret")

/** Secret text with at least one non-whitespace character; its bytes are never trimmed. */
export const NonBlankSecret = S.String.check(S.isPattern(/\S/)).pipe(
  $I.annoteSchema("NonBlankSecret", { description: "Secret text that is not blank, kept byte for byte" })
)

/** The text of a nonblank secret. */
export type NonBlankSecret = typeof NonBlankSecret.Type
