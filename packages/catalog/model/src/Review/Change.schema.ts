// The values every block of the review's model shares. Every change to an import's review has a number the import
// itself gives, one higher each time, so no two changes ever share one and no sender's id has to be trusted to be
// unique. A step is only the label of an act the person can undo: the rows of one group act share it. The import also
// counts every match (its matching) and holds which column fills each of the app's fifteen fields as one text, the
// headings' own choices included, because one match can move more than one field's column.
import * as S from "effect/Schema"

/**
 * An import's id as the model's commands take it: the text of the contract's `ImportId`, under the same brand. The
 * contract checks that an id is a UUID where a request arrives. The prover does not read that check: it tries values
 * the check refuses, and a counterexample that needs one is reported as "not proved" with no state to look at. So the
 * model bounds the text, which the prover reads, and a broken rule comes back with the state and the command.
 */
export const ImportKey = S.String.check(S.isMinLength(1), S.isMaxLength(64))
  .pipe(S.brand("ImportId"))
  .annotate({ description: "An import's id, as the model's commands take it" })
/** The decoded value of `ImportKey`: the contract's `ImportId`. */
export type ImportKey = typeof ImportKey.Type

/**
 * A row's id as the model's commands take it: the text of the contract's `RowId` ("row-12"), under the same brand,
 * bounded and not matched against its pattern, for the reason `ImportKey` gives.
 */
export const RowKey = S.String.check(S.isMinLength(1), S.isMaxLength(64))
  .pipe(S.brand("RowId"))
  .annotate({ description: "A row's id, as the model's commands take it" })
/** The decoded value of `RowKey`: the contract's `RowId`. */
export type RowKey = typeof RowKey.Type

/** The id the screen gives one act at the press: never empty. The rows of a group act share it. */
export const Step = S.String.check(S.isMinLength(1), S.isMaxLength(64)).annotate({
  description: "The id the screen gives one act at the press; the rows of a group act share it"
})
/** The decoded value of `Step`. */
export type Step = typeof Step.Type

/** A change named by its number, or 0 for none. */
export const Change = S.Int.annotate({ description: "A change of an import's review, named by its number; 0 for none" })
/** The decoded value of `Change`. */
export type Change = typeof Change.Type

/**
 * Which column fills each of the fifteen fields, as the one text an encoder writes for it; "none, on purpose" is a
 * value in it. No rule reads inside it: a match is the same as another when its text is.
 */
export const Columns = S.String.check(S.isMaxLength(10_000)).annotate({
  description: "Which column fills each field, as one text"
})
/** The decoded value of `Columns`. */
export type Columns = typeof Columns.Type

/**
 * What every row becomes at a confirm, as one digest: the screen's of what it draws, and the plan's of what it will
 * write. The import compares the two and never reads inside them. It is a hash, never the rows themselves, so it is
 * bounded at 200 characters: a bound this model sets, as it does for `ImportKey` and `RowKey`.
 */
export const Digest = S.String.check(S.isMaxLength(200)).annotate({
  description: "What every row becomes at a confirm, as one digest"
})
/** The decoded value of `Digest`. */
export type Digest = typeof Digest.Type

/**
 * A row's decision as text: the flags the `importDecision` table holds today, read through the contract's
 * `RowDecision` by the screen and by the server's `review`. Bounded as the contract bounds what a person may type into
 * one row's fifteen fields. No rule reads inside it.
 */
export const Flags = S.String.check(S.isMaxLength(600_000)).annotate({
  description: "A row's decision as text: the flags the contract's RowDecision is stored as"
})
/** The decoded value of `Flags`. */
export type Flags = typeof Flags.Type

/**
 * The rows of one act on a group, as the one text an encoder writes for them: never empty, and bounded at a million
 * characters, a bound this model sets. It takes the ids of 50,000 items at their longest (16 characters each, quoted
 * and with a comma: 950,001), which is every row of the largest file staged when each holds one item. A group over
 * more than that is no valid command and gets no named refusal: its screen has to send it as more than one act. No
 * rule reads inside it: a group names the same rows as another when its text is the same.
 */
export const Rows = S.String.check(S.isMinLength(1), S.isMaxLength(1_000_000)).annotate({
  description: "The rows one act on a group names, as one text"
})
/** The decoded value of `Rows`. */
export type Rows = typeof Rows.Type

/**
 * What one act on a group does to each of its rows, as one text: the field it fills and with what, or that the rows
 * are left out. No rule reads inside it.
 */
export const Patch = S.String.check(S.isMaxLength(10_000)).annotate({
  description: "What one act on a group does to each of its rows, as one text"
})
/** The decoded value of `Patch`. */
export type Patch = typeof Patch.Type

/** What an act is called on screen, kept with the act for the history: at most 200 characters. */
export const Label = S.String.check(S.isMaxLength(200)).annotate({ description: "What an act is called on screen" })
/** The decoded value of `Label`: a text of at most 200 characters. */
export type Label = typeof Label.Type
