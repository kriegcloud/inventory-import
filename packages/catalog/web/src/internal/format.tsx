import * as A from "effect/Array"
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

const wholeNumber = new Intl.NumberFormat()

/**
 * What is left to do on an open import, for its card on the Upload step: the rows that wait for a decision and the
 * rows that cannot be imported as written, each under its own name and with the number the review shows for it.
 * They were once one number called "need a decision", which the review then showed as two.
 *
 * @example leftToDecide({ decision: 24, cannot: 21, rows: 200 }) // "24 of 200 rows need a decision, 21 cannot be imported"
 */
export const leftToDecide = (progress: {
  readonly decision: number
  readonly cannot: number
  readonly rows: number
}): string => {
  const of = `of ${wholeNumber.format(progress.rows)} ${progress.rows === 1 ? "row" : "rows"}`
  const decision = wholeNumber.format(progress.decision)
  const cannot = wholeNumber.format(progress.cannot)
  if (progress.decision === 0 && progress.cannot === 0) return "Nothing left to decide"
  if (progress.decision === 0) return `${cannot} ${of} cannot be imported`
  const needs = `${decision} ${of} ${progress.decision === 1 ? "needs" : "need"} a decision`
  return progress.cannot === 0 ? needs : `${needs}, ${cannot} cannot be imported`
}

/**
 * What the Review step says when a confirm was not made: nothing was imported, and why. Until the newer picture is
 * read it says only that it is being read (the totals below are not the import's yet); then how many rows it decides
 * otherwise (none where only a column was matched) and the accepts taken back, named with `accepts`. It never says
 * where the change was made: the person's own match on this screen can be the cause.
 *
 * @example heldBackSentence({ why: { read: true, apart: 1, accepts: [] }, accepts: "" }) // "Nothing was imported: 1 row is decided otherwise since you pressed Import. …"
 */
export const heldBackSentence = (input: {
  readonly why: {
    readonly read: boolean
    readonly apart: number
    readonly accepts: ReadonlyArray<{ readonly kind: string }>
  }
  /** The accepts taken back, in words. */
  readonly accepts: string
}): string => {
  const { why, accepts } = input
  if (!why.read) {
    return "Nothing was imported: the import changed while you were reviewing. Its newer version is being read; import again once it is shown."
  }
  const rows =
    why.apart === 0
      ? "the import changed while you were reviewing."
      : why.apart === 1
        ? "1 row is decided otherwise since you pressed Import."
        : `${why.apart} rows are decided otherwise since you pressed Import.`
  const one = why.accepts.length === 1
  const taken =
    why.accepts.length === 0
      ? ""
      : A.every(why.accepts, (taken) => taken.kind === "accept")
        ? ` A column was matched again after you accepted its proposal, so ${one ? "that accept was" : "those accepts were"} taken back: ${accepts}.`
        : ` A column was matched again after you decided, so ${one ? "that decision was" : "those decisions were"} taken back: ${accepts}.`
  return `Nothing was imported: ${rows}${taken} The review and its totals below show the import as it is now. Check them, then import again.`
}

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
export { day, when } from "@inventory/ui/Dates"

/**
 * A column of the file no field of an item reads, said the same on every step: it is not imported, and how many rows
 * hold a value in it.
 *
 * @example notImportedColumn({ label: "Internal Notes", filled: 20 }) // "“Internal Notes” is not imported (20 rows have a value)"
 */
export const notImportedColumn = (column: { readonly label: string; readonly filled: number }): string =>
  `“${column.label}” is not imported (${column.filled} ${column.filled === 1 ? "row has" : "rows have"} a value)`

/** Saves text as a file from the browser. */
export { saveCsv as download } from "@inventory/ui/SaveFile"
