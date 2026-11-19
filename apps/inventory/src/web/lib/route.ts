// Where an import's step lives in the address. The address helpers themselves are in @/ui-kit/Route.hook.
import { Option } from "effect"
import * as S from "effect/Schema"
import { ImportId } from "@inventory/catalog-contract/Ids"
/**
 * The import an address names, if it names one: `import=` holds an import's id, and anything else there (a link cut
 * short, a typed word) names none and is said so, never sent to the server.
 */
export const importInAddress = (
  params: URLSearchParams
): { readonly id: ImportId | undefined; readonly malformed: boolean } => {
  const text = params.get("import")
  if (text === null) return { id: undefined, malformed: false }
  const id = Option.getOrUndefined(S.decodeOption(ImportId)(text))
  return { id, malformed: id === undefined }
}

/** The address of an import's step ("/?import=…&step=review"). */
export const importAddress = (id: string, step: string): string => `/?import=${encodeURIComponent(id)}&step=${step}`
