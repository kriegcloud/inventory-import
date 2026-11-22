// One row of one import's review as its own instance. The row decides nothing alone: `Deciding` and `Undoing` record
// its events. It holds its decision with the number of the change that recorded it, the decision under it in full, and
// every decision below that one sealed into one text, which the row compares and never reads. An undo at any depth has
// to bring the level it uncovers, and the row takes it only when it seals to exactly the text it holds (Benjamin,
// 2026-11-22: "Every step, sealed history"). The one thing not to break: `seal` writes the sizes of a level's texts
// before the texts, so two different levels never seal to the same text.
//
// Verify reads this file's code, not only its types. It reads a case told with `effect/Match` and a state built by its
// case's own `make` with the status written out; it does not read a schema's `guards` or `match`. So the guards below
// are written with Match, and every `make` of a state names its status.
import * as Domain from "@alchemy.run/domain"
import * as Match from "effect/Match"
import * as S from "effect/Schema"
import { Change, Flags, Step } from "../Review/Change.schema.ts"

/**
 * One decision as a row keeps it under the current one: the change that recorded it (0 when there is none, -1 for a
 * level that was let go), who made it, in which step, its flags, the import's matching it was made on and its label.
 * The sizes are how long each text is: the seal needs each as a number the prover can hold.
 */
export const Level = S.Struct({
  change: Change.pipe(S.annotateKey({ description: "The change that recorded it; 0 for none, -1 for one let go" })),
  by: S.String.pipe(S.annotateKey({ description: "The member who made it" })),
  step: S.String.pipe(S.annotateKey({ description: "The step it was made in" })),
  flags: S.String.pipe(S.annotateKey({ description: "The decision's flags, as text" })),
  madeOn: S.Int.pipe(S.annotateKey({ description: "The import's matching it was made on" })),
  label: S.String.pipe(S.annotateKey({ description: "What the act was called on screen" })),
  bySize: S.Int.pipe(S.annotateKey({ description: "How long `by` is" })),
  stepSize: S.Int.pipe(S.annotateKey({ description: "How long `step` is" })),
  flagsSize: S.Int.pipe(S.annotateKey({ description: "How long `flags` is" })),
  labelSize: S.Int.pipe(S.annotateKey({ description: "How long `label` is" }))
}).annotate({ description: "One decision as a row keeps it under the current one" })
/** The decoded value of `Level`. */
export type Level = typeof Level.Type

/** No decision: what lies under a row's first one. */
export const noLevel: Level = Level.make({
  change: 0,
  by: "",
  step: "",
  flags: "",
  madeOn: -1,
  label: "",
  bySize: 0,
  stepSize: 0,
  flagsSize: 0,
  labelSize: 0
})

/** A level that was let go: an undo stops here and says so. */
export const letGo: Level = Level.make({
  change: -1,
  by: "",
  step: "",
  flags: "",
  madeOn: -1,
  label: "",
  bySize: 0,
  stepSize: 0,
  flagsSize: 0,
  labelSize: 0
})

/** The sizes a level names are its texts' own. */
export const sizesAreTrue = (level: Level): boolean =>
  level.bySize === level.by.length &&
  level.stepSize === level.step.length &&
  level.flagsSize === level.flags.length &&
  level.labelSize === level.label.length

/**
 * A decision and everything below it as one text. Its numbers and the sizes of its texts come first, so two different
 * levels whose sizes are true never seal to the same text (`unseal`, in the row's test, reads one back).
 *
 * @example seal({ level: noLevel, below: "" }) // "0:-1:0:0:0:0:"
 */
export const seal = (sealed: { readonly level: Level; readonly below: string }): string =>
  `${sealed.level.change}:${sealed.level.madeOn}:${sealed.level.bySize}:${sealed.level.stepSize}:${sealed.level.labelSize}:${sealed.level.flagsSize}:${sealed.level.by}${sealed.level.step}${sealed.level.label}${sealed.level.flags}${sealed.below}`

/**
 * The last undo a row took: the change it took back, the step the undo was pressed in, and who pressed. A row keeps
 * it whatever is decided there afterwards, so the same undo sent again (its answer was lost on the way) is known and
 * answered as the first time, not refused as an undo of a decision the row no longer holds.
 */
export const Undone = S.Struct({
  change: Change.pipe(S.annotateKey({ description: "The change the undo took back; 0 when the row took no undo" })),
  step: S.String.pipe(S.annotateKey({ description: "The step the undo was pressed in" })),
  by: S.String.pipe(S.annotateKey({ description: "The member who pressed it" }))
}).annotate({ description: "The last undo a row took" })
/** The decoded value of `Undone`. */
export type Undone = typeof Undone.Type

/** No undo: what a row holds until one is taken. No press can match it: a step is never empty. */
export const noUndo: Undone = Undone.make({ change: 0, step: "", by: "" })

/** The flags of a row with nothing decided: an act that says it on such a row changes nothing. */
export const NO_DECISION = "{}"

/**
 * What a row may keep below its decisions, in characters. Past it the oldest are let go and an undo stops there, so
 * nobody is ever refused a decision because of the history, and the state stays far from the largest value an object
 * stores.
 */
export const MOST_BELOW = 1_000_000
/** What stands for a history that was let go. It can never be a seal: a seal starts with a number. */
export const CUT = "cut"

/** A row was decided: by whom, in which step, as which change of its import, with which flags, on which matching. */
export class RowDecided extends Domain.Event(
  "RowDecided",
  {
    importId: S.String,
    organizationId: S.String,
    change: Change,
    by: S.String,
    step: Step,
    flags: Flags,
    madeOn: S.Int,
    label: S.String
  },
  { description: "A row's decision was recorded, over the one it replaces" }
) {}

/**
 * The current decision was taken back; `next` goes under the one put back, with `below` under it. `undo`, `step` and
 * `by` say which change was taken back, in which step and by whom: the row keeps them as its last undo.
 */
export class StepUndone extends Domain.Event(
  "StepUndone",
  { next: Level, below: S.String, undo: Change, step: Step, by: S.String },
  { description: "A row's decision was taken back, and the one under it put back" }
) {}

/**
 * What a row holds: nothing yet, nothing again after an undo, or a decision with the one under it in full and the
 * ones below that sealed into one text. Each case also holds the last undo the row took (none, for a row no act has
 * reached: it is there so a decision carries it on without asking which case it replaces).
 */
export const RowState = S.Union([
  S.Struct({ status: S.tag("Untouched"), undone: Undone }),
  S.Struct({ status: S.tag("Undecided"), importId: S.String, organizationId: S.String, undone: Undone }),
  S.Struct({
    status: S.tag("Decided"),
    importId: S.String,
    organizationId: S.String,
    change: Change,
    by: S.String,
    step: S.String,
    flags: S.String,
    madeOn: S.Int,
    label: S.String,
    under: Level,
    below: S.String,
    undone: Undone
  })
])
  .annotate({ description: "What one row of an import's review holds" })
  .pipe(S.toTaggedUnion("status"))
/** The decoded value of `RowState`. */
export type RowState = typeof RowState.Type
/** A row that holds a decision. */
export type DecidedRow = typeof RowState.cases.Decided.Type

const yes = (): boolean => true
const no = (): boolean => false
const byStatus = Match.discriminatorsExhaustive("status")

/** True for a row no act has reached. */
export const isUntouched = (row: RowState): row is typeof RowState.cases.Untouched.Type =>
  Match.value(row).pipe(byStatus({ Untouched: yes, Undecided: no, Decided: no }))
/** True for a row whose decisions were all taken back. */
export const isUndecided = (row: RowState): row is typeof RowState.cases.Undecided.Type =>
  Match.value(row).pipe(byStatus({ Untouched: no, Undecided: yes, Decided: no }))
/** True for a row that holds a decision. */
export const isDecided = (row: RowState): row is DecidedRow =>
  Match.value(row).pipe(byStatus({ Untouched: no, Undecided: no, Decided: yes }))

/**
 * A decision's text with the matching it was made on, as one text: the matching's number ends at the first colon, so
 * two are equal only when both the matching and the flags are. One text, because the prover takes both sides of every
 * comparison it cannot settle, and "the same text on the same matching" is then one question and not two.
 *
 * @example onItsMatching({ flags: '{"kept":true}', madeOn: 1 }) // '1:{"kept":true}'
 */
export const onItsMatching = (decision: { readonly flags: string; readonly madeOn: number }): string =>
  `${decision.madeOn}:${decision.flags}`

/**
 * Taking these flags on this matching would leave the row as it is: it holds them already, made on the same matching,
 * or it holds nothing and they decide nothing. Such an act records nothing, whoever decided what is there (Benjamin,
 * 2026-11-19: "Answer says 'no change'"). The same text made again on a newer matching is a change: the row's
 * decision is then on the matching now.
 */
export const leavesAsItIs = (act: {
  readonly row: RowState
  readonly flags: string
  readonly madeOn: number
}): boolean => (isDecided(act.row) ? onItsMatching(act.row) === onItsMatching(act) : act.flags === NO_DECISION)

/**
 * One row of one import's review: its decision, the one under it, and the rest sealed. It has no command of its own,
 * so the rules about who may change a row are rules of the two decisions that record on it: an aggregate's rule may
 * read only what its own commands' middleware provides.
 */
export class Row extends Domain.Aggregate(
  "Row",
  {
    id: S.String,
    state: RowState,
    initial: RowState.cases.Untouched.make({ status: "Untouched", undone: noUndo }),
    invariants: {
      // The sizes kept beside the decision under the current one are its texts' own: one comparison a rule.
      TheSizeOfByIsTrue: (s) => !isDecided(s) || s.under.bySize === s.under.by.length,
      TheSizeOfStepIsTrue: (s) => !isDecided(s) || s.under.stepSize === s.under.step.length,
      TheSizeOfFlagsIsTrue: (s) => !isDecided(s) || s.under.flagsSize === s.under.flags.length,
      TheSizeOfLabelIsTrue: (s) => !isDecided(s) || s.under.labelSize === s.under.label.length
    },
    transitions: {
      // A row has no decision again only when nothing was under the one taken back.
      ARowIsUndecidedOnlyWhenNothingWasUnder: ({ before, after }) =>
        !isDecided(before) || !isUndecided(after) || before.under.change === 0,
      ARowNeverChangesImportOrOrganization: ({ before, after }) =>
        isUntouched(before) ||
        isUntouched(after) ||
        (before.organizationId === after.organizationId && before.importId === after.importId)
    },
    events: [RowDecided, StepUndone],
    evolve: {
      RowDecided: (s, e) =>
        RowState.cases.Decided.make({
          status: "Decided",
          importId: e.importId,
          organizationId: e.organizationId,
          change: e.change,
          by: e.by,
          step: e.step,
          flags: e.flags,
          madeOn: e.madeOn,
          label: e.label,
          under: isDecided(s)
            ? Level.make({
                change: s.change,
                by: s.by,
                step: s.step,
                flags: s.flags,
                madeOn: s.madeOn,
                label: s.label,
                bySize: s.by.length,
                stepSize: s.step.length,
                flagsSize: s.flags.length,
                labelSize: s.label.length
              })
            : noLevel,
          below:
            !isDecided(s) || s.under.change === 0
              ? ""
              : s.below.length > MOST_BELOW
                ? CUT
                : seal({ level: s.under, below: s.below }),
          undone: s.undone
        }),
      StepUndone: (s, e) =>
        !isDecided(s)
          ? s
          : s.under.change !== 0
            ? RowState.cases.Decided.make({
                status: "Decided",
                importId: s.importId,
                organizationId: s.organizationId,
                change: s.under.change,
                by: s.under.by,
                step: s.under.step,
                flags: s.under.flags,
                madeOn: s.under.madeOn,
                label: s.under.label,
                under: e.next,
                below: e.below,
                undone: Undone.make({ change: e.undo, step: e.step, by: e.by })
              })
            : RowState.cases.Undecided.make({
                status: "Undecided",
                importId: s.importId,
                organizationId: s.organizationId,
                undone: Undone.make({ change: e.undo, step: e.step, by: e.by })
              })
    }
  },
  { description: "One row of one import's review: its decision, the one under it, and the rest sealed" }
) {}
