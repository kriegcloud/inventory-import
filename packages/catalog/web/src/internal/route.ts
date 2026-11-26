// Where an import's step lives in the address. The address helpers themselves are in @/ui-kit/Route.hook.
import { parameter } from "./browser.ts"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import { ImportId } from "@inventory/catalog-contract/Ids"
/**
 * The import an address names, if it names one: `import=` holds an import's id, and anything else there (a link cut
 * short, a typed word) names none and is said so, never sent to the server.
 */
export const importInAddress = (
  params: URLSearchParams
): { readonly id: O.Option<ImportId>; readonly malformed: boolean } => {
  const text = parameter("import")(params)
  if (O.isNone(text)) return { id: O.none(), malformed: false }
  const id = S.decodeOption(ImportId)(text.value)
  return { id, malformed: O.isNone(id) }
}

/** The address of an import's step ("/?import=…&step=review"). */
export const importAddress = (id: string, step: string): string => `/?import=${encodeURIComponent(id)}&step=${step}`
