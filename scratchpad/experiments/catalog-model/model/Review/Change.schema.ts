// The values every block of the review's model shares. Every change to an import's review has a number the import
// itself gives, one higher each time, so no two changes ever share one and no sender's id has to be trusted to be
// unique. A step is only the label of an act the person can undo: the rows of one group act share it. The import also
// counts every match (its matching) and holds which column fills each of the app's fifteen fields as one text, the
// headings' own choices included, because one match can move more than one field's column.
import * as S from "effect/Schema"

/** The bound the model sets on an id and a step: never empty, at most 64 characters. */
const ShortText = S.String.check(S.isMinLength(1), S.isMaxLength(64))

/**
 * **Details**
 *
 * It is the text of the contract's `ImportId`, under the same brand. The contract checks that an id is a UUID where a
 * request arrives. The prover does not read that check: it tries values the check refuses, and a counterexample that
 * needs one is reported as "not proved" with no state to look at. So the model bounds the text, at 1 to 64 characters,
 * which the prover reads, and a broken rule comes back with the state and the command.
 *
 * **Example** (Bounded, not matched as a UUID)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as Str from "effect/String"
 * import * as Change from "./Change.schema.ts"
 *
 * O.isSome(Change.ImportKey.makeOption("imp-1")) // => true
 * O.isNone(Change.ImportKey.makeOption("")) // => true
 * O.isNone(Change.ImportKey.makeOption(Str.repeat(65)("x"))) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ImportKey = ShortText.pipe(S.brand("ImportId"))
  .annotate({ description: "An import's id, as the model's commands take it" })
/**
 * The decoded value of `ImportKey`: the contract's `ImportId`.
 *
 * @category models
 * @since 0.0.0
 */
export type ImportKey = typeof ImportKey.Type

/**
 * **Details**
 *
 * It is the text of the contract's `RowId` ("row-12"), under the same brand, bounded at 1 to 64 characters and not
 * matched against its pattern, for the reason `ImportKey` gives.
 *
 * **Example** (Bounded, not matched against its pattern)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as Change from "./Change.schema.ts"
 *
 * O.isSome(Change.RowKey.makeOption("row-12")) // => true
 * O.isSome(Change.RowKey.makeOption("twelve")) // => true
 * O.isNone(Change.RowKey.makeOption("")) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const RowKey = ShortText.pipe(S.brand("RowId"))
  .annotate({ description: "A row's id, as the model's commands take it" })
/**
 * The decoded value of `RowKey`: the contract's `RowId`.
 *
 * @category models
 * @since 0.0.0
 */
export type RowKey = typeof RowKey.Type

/**
 * **Details**
 *
 * A step is never empty and at most 64 characters. A row's `noUndo` holds an empty step, so no press matches it.
 *
 * **Example** (A step is never empty)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as Change from "./Change.schema.ts"
 *
 * O.isSome(Change.Step.makeOption("s-1")) // => true
 * O.isNone(Change.Step.makeOption("")) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Step = ShortText.annotate({
  description: "The id the screen gives one act at the press; the rows of a group act share it"
})
/**
 * The decoded value of `Step`: a text of 1 to 64 characters.
 *
 * @category models
 * @since 0.0.0
 */
export type Step = typeof Step.Type

/**
 * @category models
 * @since 0.0.0
 */
export const Change = S.Int.annotate({
  description: "A change of an import's review, named by its number; 0 for none, -1 for a level let go"
})
/**
 * The decoded value of `Change`: a whole number, 0 for none, -1 for a level let go.
 *
 * @category models
 * @since 0.0.0
 */
export type Change = typeof Change.Type

/**
 * **Details**
 *
 * It is the one text an encoder writes for the fifteen fields; "none, on purpose" is a value in it. It is at most
 * 10,000 characters. No rule reads inside it: a match is the same as another when its text is.
 *
 * @category models
 * @since 0.0.0
 */
export const Columns = S.String.check(S.isMaxLength(10_000)).annotate({
  description: "Which column fills each field, as one text"
})
/**
 * The decoded value of `Columns`: a text of at most 10,000 characters.
 *
 * @category models
 * @since 0.0.0
 */
export type Columns = typeof Columns.Type

/**
 * **Details**
 *
 * A confirm carries two: the screen's of what it draws, and the plan's of what it will write. The import compares the
 * two and never reads inside them. It is a hash, never the rows themselves, so it is bounded at 200 characters: a
 * bound this model sets, as it does for `ImportKey` and `RowKey`.
 *
 * **Example** (A digest is bounded)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as Str from "effect/String"
 * import * as Change from "./Change.schema.ts"
 *
 * O.isSome(Change.Digest.makeOption("sha256:9f2c")) // => true
 * O.isNone(Change.Digest.makeOption(Str.repeat(201)("x"))) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Digest = S.String.check(S.isMaxLength(200)).annotate({
  description: "What every row becomes at a confirm, as one digest"
})
/**
 * The decoded value of `Digest`: a text of at most 200 characters.
 *
 * @category models
 * @since 0.0.0
 */
export type Digest = typeof Digest.Type

/**
 * **Details**
 *
 * The flags are what the `importDecision` table holds today, read through the contract's `RowDecision` by the screen
 * and by the server's `review`. They are bounded at 600,000 characters, as the contract bounds what a person may type
 * into one row's fifteen fields. No rule reads inside them.
 *
 * @category models
 * @since 0.0.0
 */
export const Flags = S.String.check(S.isMaxLength(600_000)).annotate({
  description: "A row's decision as text: the flags the contract's RowDecision is stored as"
})
/**
 * The decoded value of `Flags`: a text of at most 600,000 characters.
 *
 * @category models
 * @since 0.0.0
 */
export type Flags = typeof Flags.Type

/**
 * **Details**
 *
 * It is the one text an encoder writes for the rows: never empty, and bounded at a million characters, a bound this
 * model sets. It takes the ids of 50,000 items at their longest (16 characters each, quoted and with a comma:
 * 950,001), which is every row of the largest file staged when each holds one item. A group over more than that is no
 * valid command and gets no named refusal: its screen has to send it as more than one act. No rule reads inside it: a
 * group names the same rows as another when its text is the same.
 *
 * **Example** (A group names at least one row)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as Change from "./Change.schema.ts"
 *
 * O.isSome(Change.Rows.makeOption('["row-1","row-2"]')) // => true
 * O.isNone(Change.Rows.makeOption("")) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Rows = S.String.check(S.isMinLength(1), S.isMaxLength(1_000_000)).annotate({
  description: "The rows one act on a group names, as one text"
})
/**
 * The decoded value of `Rows`: a text of 1 to 1,000,000 characters.
 *
 * @category models
 * @since 0.0.0
 */
export type Rows = typeof Rows.Type

/**
 * **Details**
 *
 * It says the field the act fills and with what, or that the rows are left out. It is at most 10,000 characters. No
 * rule reads inside it.
 *
 * @category models
 * @since 0.0.0
 */
export const Patch = S.String.check(S.isMaxLength(10_000)).annotate({
  description: "What one act on a group does to each of its rows, as one text"
})
/**
 * The decoded value of `Patch`: a text of at most 10,000 characters.
 *
 * @category models
 * @since 0.0.0
 */
export type Patch = typeof Patch.Type

/**
 * **Details**
 *
 * It is kept with the act for the history, and is at most 200 characters.
 *
 * @category models
 * @since 0.0.0
 */
export const Label = S.String.check(S.isMaxLength(200)).annotate({ description: "What an act is called on screen" })
/**
 * The decoded value of `Label`: a text of at most 200 characters.
 *
 * @category models
 * @since 0.0.0
 */
export type Label = typeof Label.Type

/**
 * What an undo is called among the acts the import counts, a row's undo or a group's.
 *
 * @category constants
 * @since 0.0.0
 */
export const UNDO_LABEL = "undo"
