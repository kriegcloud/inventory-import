// What a tab has to say of the person's unsaved decisions, as this browser keeps it, and in words. The one thing not to
// break: every row is named, with the decision where it was let go and not only moved.
import * as O from "effect/Option"
import * as S from "effect/Schema"
import { RowDecision } from "@inventory/catalog-contract/Decision"
import { namedWords, rowsWords } from "./leftOver.ts"

/**
 * One thing a tab says until it is dismissed: rows of one import another tab of the person's took up, or decisions of
 * theirs let go because the import was removed. `at` is when, in milliseconds.
 */
export const Notice = S.TaggedUnion({
  TakenUp: {
    importId: S.String,
    fileName: S.OptionFromNullOr(S.String),
    rows: S.String.pipe(S.Array),
    at: S.Finite
  },
  Removed: {
    importId: S.String,
    fileName: S.OptionFromNullOr(S.String),
    rows: S.Record(S.String, S.OptionFromNullOr(RowDecision)),
    beside: S.Record(S.String, RowDecision.pipe(S.OptionFromNullOr, S.Array)),
    at: S.Finite
  }
}).annotate({ description: "What a tab says of the person's unsaved decisions, until it is dismissed" })
/** The decoded value of `Notice`. */
export type Notice = typeof Notice.Type

/** One tab's notices as this browser keeps them; none is no entry. */
export const NoticesKept = Notice.pipe(S.Array, S.OptionFromNullOr).annotate({
  description: "One tab's notices as this browser keeps them; none is no entry"
})
/** The decoded value of `NoticesKept`. */
export type NoticesKept = typeof NoticesKept.Type

const asText = S.fromJsonString(NoticesKept)
const decodeText = S.decodeUnknownOption(asText)
const encodeText = S.encodeOption(asText)

/** The notices as the text this browser keeps. */
export const noticesText = (stored: NoticesKept): O.Option<string> => encodeText(stored)

/** The notices from that text: none where there is none or it cannot be read. */
export const noticesFromText = (text: string | null): NoticesKept =>
  text === null ? O.none() : O.flatten(decodeText(text))

/**
 * A notice in words: what happened, and to which rows of which import.
 *
 * @example noticeWords(taken).text // "Row 12, row 31 of items_messy.csv: another tab of yours has them now, …"
 */
export const noticeWords = (notice: Notice): { readonly title: string; readonly text: string } =>
  Notice.match(notice, {
    TakenUp: ({ fileName, rows }) => ({
      title: "Your waiting decisions were taken up by another tab",
      text: `${rowsWords(rows)} of ${O.getOrElse(fileName, () => "an import")}: another tab of yours has ${rows.length === 1 ? "your decision" : "your decisions"} now, and this tab no longer sends ${rows.length === 1 ? "it" : "them"}.`
    }),
    Removed: (gone) => ({
      title: `${O.getOrElse(gone.fileName, () => "An import")} was removed`,
      text: `Your decisions on it that were not saved went with it. ${namedWords(gone)}.`
    })
  })
