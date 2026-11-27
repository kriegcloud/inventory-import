// What one row of an import's review holds, and the rules that hold of every state of it. Read as a namespace named
// `RowState`: `RowState.State`, `RowState.Decided`, `RowState.guards.Decided`.
import * as S from "effect/Schema"
import { Change } from "../Review/Change.schema.ts"
import { Level } from "./Level.schema.ts"

/**
 * **Details**
 *
 * A row keeps its last undo whatever is decided there afterwards, so the same undo sent again (its answer was lost on
 * the way) is known and answered as the first time, not refused as an undo of a decision the row no longer holds.
 *
 * @category models
 * @since 0.0.0
 */
export class Undone extends S.Opaque<Undone, { readonly brand: unique symbol }>()(
  S.Struct({
    change: Change.pipe(S.annotateKey({ description: "The change the undo took back; 0 when the row took no undo" })),
    step: S.String.pipe(S.annotateKey({ description: "The step the undo was pressed in" })),
    by: S.String.pipe(S.annotateKey({ description: "The member who pressed it" }))
  }).annotate({ description: "The last undo a row took" })
) {}

/**
 * No undo: what a row holds until one is taken. No press can match it: a step is never empty.
 *
 * @category models
 * @since 0.0.0
 */
export const noUndo: Undone = Undone.make({ change: 0, step: "", by: "" })

/**
 * The flags of a row with nothing decided: an act that says it on such a row changes nothing.
 *
 * @category models
 * @since 0.0.0
 */
export const NO_DECISION = "{}"

/**
 * **Details**
 *
 * It holds the last undo the row took, none, so a decision carries it on.
 *
 * @category models
 * @since 0.0.0
 */
export class Untouched extends S.Opaque<Untouched, { readonly brand: unique symbol }>()(
  S.Struct({
    status: S.tag("Untouched"),
    undone: Undone
  }).annotate({ description: "A row no act has reached" })
) {}

/**
 * @category models
 * @since 0.0.0
 */
export class Undecided extends S.Opaque<Undecided, { readonly brand: unique symbol }>()(
  S.Struct({
    status: S.tag("Undecided"),
    importId: S.String.pipe(S.annotateKey({ description: "The import the row belongs to" })),
    organizationId: S.String.pipe(S.annotateKey({ description: "The organization of that import" })),
    undone: Undone
  }).annotate({ description: "A row whose only decision was taken back" })
) {}

/**
 * **Details**
 *
 * It holds the decision under the current one in full, as `under`, and the ones below that sealed into one text, as
 * `below`.
 *
 * @category models
 * @since 0.0.0
 */
export class Decided extends S.Opaque<Decided, { readonly brand: unique symbol }>()(
  S.Struct({
    status: S.tag("Decided"),
    importId: S.String.pipe(S.annotateKey({ description: "The import the row belongs to" })),
    organizationId: S.String.pipe(S.annotateKey({ description: "The organization of that import" })),
    change: Change.pipe(S.annotateKey({ description: "The change of its import that recorded the decision" })),
    by: S.String.pipe(S.annotateKey({ description: "The member who made it" })),
    step: S.String.pipe(S.annotateKey({ description: "The step it was made in" })),
    flags: S.String.pipe(S.annotateKey({ description: "The decision's flags, as text" })),
    madeOn: S.Int.pipe(S.annotateKey({ description: "The import's matching it was made on" })),
    label: S.String.pipe(S.annotateKey({ description: "What the act was called on screen" })),
    under: Level,
    below: S.String.pipe(S.annotateKey({ description: "Every decision below that one, sealed into one text" })),
    undone: Undone
  }).annotate({ description: "A row that holds a decision" })
) {}

/**
 * **Details**
 *
 * A row holds nothing yet, nothing again after an undo, or a decision with the one under it in full and the ones below
 * that sealed into one text. Each case also holds the last undo the row took (none, for a row no act has reached: it
 * is there so a decision carries it on without asking which case it replaces).
 *
 * @category models
 * @since 0.0.0
 */
export const State = S.Union([Untouched, Undecided, Decided])
  .annotate({ description: "What one row of an import's review holds" })
  .pipe(S.toTaggedUnion("status"))
/**
 * The decoded value of `State`: `Untouched`, `Undecided` or `Decided`, told apart by `status`.
 *
 * @category models
 * @since 0.0.0
 */
export type State = typeof State.Type
/**
 * The guards, the cases and `isAnyOf` of `State`: the file read as a namespace reads as the state does.
 *
 * @category models
 * @since 0.0.0
 */
export const { guards, cases, isAnyOf } = State

/**
 * A decision's text with the matching it was made on, as one text: the matching's number ends at the first colon, so
 * two are equal only when both the matching and the flags are. One text, because the prover takes both sides of every
 * comparison it cannot settle, and "the same text on the same matching" is then one question and not two.
 *
 * **Example** (The same text on two matchings)
 *
 * ```ts
 * import * as RowState from "./Row.state.ts"
 *
 * RowState.onItsMatching({ flags: '{"kept":true}', madeOn: 1 }) // => '1:{"kept":true}'
 * RowState.onItsMatching({ flags: '{"kept":true}', madeOn: 2 }) // => '2:{"kept":true}'
 * ```
 *
 * @category behavior
 * @since 0.0.0
 */
export const onItsMatching = (decision: { readonly flags: string; readonly madeOn: number }): string =>
  `${decision.madeOn}:${decision.flags}`

/**
 * Taking these flags on this matching would leave the row as it is: it holds them already, made on the same matching,
 * or it holds nothing and they decide nothing. Such an act records nothing, whoever decided what is there (Benjamin,
 * 2026-11-19: "Answer says 'no change'"). The same text made again on a newer matching is a change: the row's
 * decision is then on the matching now.
 *
 * **Example** (No change, and a change)
 *
 * ```ts
 * import * as Level from "./Level.schema.ts"
 * import * as RowState from "./Row.state.ts"
 *
 * const untouched = RowState.Untouched.make({ undone: RowState.noUndo })
 * const decided = RowState.Decided.make({
 *   importId: "imp-1",
 *   organizationId: "org-1",
 *   change: 4,
 *   by: "dana",
 *   step: "s-1",
 *   flags: '{"kept":true}',
 *   madeOn: 1,
 *   label: "Keep",
 *   under: Level.noLevel,
 *   below: "",
 *   undone: RowState.noUndo
 * })
 *
 * RowState.leavesAsItIs({ row: untouched, flags: RowState.NO_DECISION, madeOn: 1 }) // => true
 * RowState.leavesAsItIs({ row: decided, flags: '{"kept":true}', madeOn: 1 }) // => true
 * RowState.leavesAsItIs({ row: decided, flags: '{"kept":true}', madeOn: 2 }) // => false
 * ```
 *
 * @category behavior
 * @since 0.0.0
 */
export const leavesAsItIs = (act: { readonly row: State; readonly flags: string; readonly madeOn: number }): boolean =>
  State.guards.Decided(act.row) ? onItsMatching(act.row) === onItsMatching(act) : act.flags === NO_DECISION

// The sizes kept beside the decision under the current one are its texts' own: one comparison a rule.
/**
 * On a decided row, the size of `by` that the decision under the current one keeps is that text's length.
 *
 * @category rules
 * @since 0.0.0
 */
export const TheSizeOfByIsTrue = (s: State): boolean => !State.guards.Decided(s) || s.under.bySize === s.under.by.length

/**
 * On a decided row, the size of `step` that the decision under the current one keeps is that text's length.
 *
 * @category rules
 * @since 0.0.0
 */
export const TheSizeOfStepIsTrue = (s: State): boolean =>
  !State.guards.Decided(s) || s.under.stepSize === s.under.step.length

/**
 * On a decided row, the size of `flags` that the decision under the current one keeps is that text's length.
 *
 * @category rules
 * @since 0.0.0
 */
export const TheSizeOfFlagsIsTrue = (s: State): boolean =>
  !State.guards.Decided(s) || s.under.flagsSize === s.under.flags.length

/**
 * On a decided row, the size of `label` that the decision under the current one keeps is that text's length.
 *
 * @category rules
 * @since 0.0.0
 */
export const TheSizeOfLabelIsTrue = (s: State): boolean =>
  !State.guards.Decided(s) || s.under.labelSize === s.under.label.length
