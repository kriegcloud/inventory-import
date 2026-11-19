import { NotSet } from "@inventory/ui/NotSet"
import { StatusPill, type Tone } from "@inventory/ui/StatusPill"
import type { ReviewWords } from "@inventory/review/ReviewTypes"

/** A cell's text, or "Not set" in grey when the file left it empty. */
export function Text(props: { value: string }) {
  return props.value.trim() === "" ? <NotSet /> : <>{props.value}</>
}

/**
 * Every status word of the import, set once: the result's pills and tabs and the review's tabs and tags read them from
 * here. The outcomes before the confirm (Ready, Needs a decision, Cannot import) are the review's own words.
 */
export const importWords = {
  created: "Imported",
  updated: "Updated",
  already: "Already there",
  notImported: "Not imported",
  takenBack: "Taken back",
  all: "All"
} as const

/**
 * The review's words for this import (`words` on the region): the ones it shares with the result come from
 * `importWords`; the rest keep the region's own defaults.
 */
export const reviewStepWords: Partial<ReviewWords> = { stored: importWords.already, all: importWords.all }

const outcomeTone = {
  created: "success",
  updated: "success",
  already: "neutral",
  notImported: "danger",
  takenBack: "outline"
} as const satisfies Record<string, Tone>

/** Where a row stands, in words and colour. */
export function OutcomePill(props: { outcome: keyof typeof outcomeTone }) {
  return <StatusPill tone={outcomeTone[props.outcome]}>{importWords[props.outcome]}</StatusPill>
}

// The date helpers live in their own module so the upload screen can show a date without loading the table code
// this file brings in.
export { day, when } from "@/lib/dates"

/**
 * A column of the file no field of an item reads, said the same on every step: it is not imported, and how many rows
 * hold a value in it.
 *
 * @example notImportedColumn({ label: "Internal Notes", filled: 20 }) // "“Internal Notes” is not imported (20 rows have a value)"
 */
export const notImportedColumn = (column: { readonly label: string; readonly filled: number }): string =>
  `“${column.label}” is not imported (${column.filled} ${column.filled === 1 ? "row has" : "rows have"} a value)`

/** Saves text as a file from the browser. */
export const download = (fileName: string, text: string) => {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }))
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}
