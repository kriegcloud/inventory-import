/**
 * The data a review region shows. Everything here comes from the caller: the primitive holds no field names, status
 * words or rules of its own. Do not add one product's vocabulary to this file.
 *
 * Each shape is an Effect Schema and its type is read from it. They come in two forms, and the difference is the one
 * thing not to break here:
 *
 * - What a caller hands in or is handed back once (a column, a row, a problem, a fix, the words, the import's result,
 *   a draft) is a branded class, built with its own `make` (`ReviewRow.make({...})`; the parts inside may be plain
 *   objects). `make` checks the value and returns a copy.
 * - What the rules work out again on every press (a row's view, its marks, the groups, the table's lines, the counts,
 *   the decisions and their history) is a plain struct schema, written as an object. It must stay one: `make` copies
 *   what it is given, so a view built with it would hold a copy of its row, and the grid, which redraws a row only
 *   when its row is a new object, would redraw every row on every press.
 *
 * The lines and marks are tagged unions: branch with `Entry.match`, `CellMark.match`, `ColumnMatch.match`, test with
 * their `guards`. The component's props and the caller's own forms (`ReviewRegionProps`, `CellEditor`, `RowAction`)
 * hold functions and React nodes, so they stay types.
 *
 * A required field that is a branded class names the class bare (`why: Why`): piping it through `S.annotateKey`
 * rebuilds the struct underneath and the field's type loses the brand.
 *
 * @packageDocumentation
 */
import { LiteralKit } from "@beep/schema/LiteralKit"
import { ColumnKey, ReviewDecision, RowKey } from "@inventory/review/ReviewDecision"
import * as P from "effect/Predicate"
import * as S from "effect/Schema"
import * as Tuple from "effect/Tuple"
import type * as O from "effect/Option"
import type * as Atom from "effect/reactivity/Atom"
import type { ReactNode } from "react"
import { $ReviewId } from "./internal/identity.ts"

const $I = $ReviewId.create("ReviewRegion")

/** A count of rows: a whole number, never negative. */
const Count = S.Int.check(S.isGreaterThanOrEqualTo(0))

/** The file's text by column id. */
const Cells = S.Record(ColumnKey, S.String)

/** Amber for a choice only the person can make, red for a value that cannot be imported as it is. */
export const ProblemTone = LiteralKit(["decision", "blocker"]).pipe(
  $I.annoteSchema("ProblemTone", {
    description: "Amber for a choice only the person can make, red for a value that cannot be imported as it is."
  })
)

/** The decoded value of `ProblemTone`. */
export type ProblemTone = typeof ProblemTone.Type

/** One reason a row can need the person. `label` is the tag in the Problem column: three words or fewer. */
export class ProblemKind extends S.Opaque<ProblemKind, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.String.pipe(S.annotateKey({ description: "The kind's id, as a problem and a fix name it" })),
    label: S.String.pipe(S.annotateKey({ description: "The tag in the Problem column: three words or fewer" })),
    tone: ProblemTone.pipe(S.annotateKey({ description: "A decision (amber) or a blocker (red)" })),
    help: S.String.pipe(
      S.optionalKey,
      S.annotateKey({
        description:
          'One line under the kind\'s heading: what these rows need ("Each needs a cost before it can be imported.").'
      })
    ),
    fixable: S.Boolean.pipe(
      S.optionalKey,
      S.annotateKey({
        description:
          "`false` when nothing on this screen can settle a row of this kind (the item it names is not in the system " +
          "yet): such rows are counted apart from Needs you, under their own tab, with their reason and no answer to " +
          "press, and they never hold the import back. Left out, a kind can be settled here."
      })
    )
  }).pipe($I.annoteSchema("ProblemKind", { description: "One reason a row can need the person" }))
) {}

/** The two ways a column of ours stands against the file: found in it, or not. */
export const ColumnMatchState = LiteralKit(["matched", "unmatched"]).pipe(
  $I.annoteSchema("ColumnMatchState", { description: "Whether a column of ours was found in the file" })
)

/** The decoded value of `ColumnMatchState`. */
export type ColumnMatchState = typeof ColumnMatchState.Type

/** Who found a matched column: the heading's name, or a model. */
export const ColumnMatchSource = LiteralKit(["name", "model"]).pipe(
  $I.annoteSchema("ColumnMatchSource", { description: "What matched a column: the heading's name, or a model" })
)

/** The decoded value of `ColumnMatchSource`. */
export type ColumnMatchSource = typeof ColumnMatchSource.Type

/** A file column offered for a field that found none, with a few of its values. */
export const ColumnCandidate = S.Struct({
  source: S.String.pipe(S.annotateKey({ description: "The file column's heading" })),
  samples: S.Array(S.String).pipe(S.annotateKey({ description: "A few of that column's values" }))
}).pipe($I.annoteSchema("ColumnCandidate", { description: "A file column offered for a field that found none" }))

/** The decoded value of `ColumnCandidate`. */
export type ColumnCandidate = typeof ColumnCandidate.Type

const MatchedColumn = S.Struct({
  state: S.tag("matched"),
  source: S.String.pipe(S.annotateKey({ description: "The file column's heading" })),
  by: ColumnMatchSource.pipe(S.annotateKey({ description: "What matched it: the heading's name, or a model" })),
  samples: S.Array(S.String).pipe(S.annotateKey({ description: "A few of that column's values" }))
}).pipe($I.annoteSchema("MatchedColumn", { description: "The column was found in the file" }))

const UnmatchedColumn = S.Struct({
  state: S.tag("unmatched"),
  candidates: S.Array(ColumnCandidate).pipe(S.annotateKey({ description: "The file columns the person may pick from" }))
}).pipe($I.annoteSchema("UnmatchedColumn", { description: "No file column was found for it" }))

/**
 * How a column of ours was found in the file. `unmatched` blocks the import until the person picks a source. Branch
 * with `ColumnMatch.match`.
 */
export const ColumnMatch = ColumnMatchState.mapMembers(() => Tuple.make(MatchedColumn, UnmatchedColumn)).pipe(
  S.toTaggedUnion("state"),
  $I.annoteSchema("ColumnMatch", { description: "How a column of ours was found in the file" })
)

/** The decoded value of `ColumnMatch`. */
export type ColumnMatch = typeof ColumnMatch.Type

/**
 * How a column takes its width. `fit`: as wide as its longest value and its header, measured from the loaded rows,
 * and never cut (a code, a unit, a price, a short choice, a proposed old → new value). `fill`: shares the room the
 * `fit` columns leave and ends in an ellipsis, the whole text one hover or tap away (a name, a reason, a description).
 */
export const ColumnSize = LiteralKit(["fit", "fill"]).pipe(
  $I.annoteSchema("ColumnSize", {
    description: "fit: as wide as its longest value, never cut. fill: shares the room left and ends in an ellipsis."
  })
)

/** The decoded value of `ColumnSize`. */
export type ColumnSize = typeof ColumnSize.Type

/** How a column shows a value: the file's text in, the text to draw out. */
const DisplayValue = S.declare<(value: string) => string>((u): u is (value: string) => string => P.isFunction(u), {
  expected: "a function from the file's text to the text shown"
})

/** One column of the review: what it is called, how it is sized and drawn, and how it was found in the file. */
export class ReviewColumn extends S.Opaque<ReviewColumn, { readonly brand: unique symbol }>()(
  S.Struct({
    id: ColumnKey.pipe(S.annotateKey({ description: "The column's id: the key of its cell in every row" })),
    label: S.String.pipe(S.annotateKey({ description: "One or two words." })),
    width: S.Finite.pipe(
      S.optionalKey,
      S.annotateKey({
        description:
          "The least width in pixels: a `fill` column never shrinks below it (160 when not given); a `fit` column is " +
          "at least this wide even when its values are shorter. The first column stays in view when the table " +
          "scrolls sideways."
      })
    ),
    size: ColumnSize.pipe(
      S.optionalKey,
      S.annotateKey({ description: "`fit` (the default) or `fill`: see `ColumnSize`." })
    ),
    priority: S.Finite.pipe(
      S.optionalKey,
      S.annotateKey({
        description:
          "Which `fit` column gives way first when the room cannot hold them all: the lowest priority moves into the " +
          "row's detail (and, with `under`, under the record's name) before any value is cut. Higher stays longer; " +
          "ties go from the right. `core` counts as 1, anything else as 0, unless a number is given."
      })
    ),
    unit: S.String.pipe(
      S.optionalKey,
      S.annotateKey({
        description: 'A second, quieter header line under the label: the unit the values are in ("USD", "kg", "days").'
      })
    ),
    unitFrom: ColumnKey.pipe(
      S.optionalKey,
      S.annotateKey({
        description:
          'The column that holds each row\'s unit, for a quantity whose unit is the row\'s own ("120 EA", "4 KG"): ' +
          "the value is shown with it. Only what is drawn changes."
      })
    ),
    byDefault: S.String.pipe(
      S.optionalKey,
      S.annotateKey({
        description:
          'What an empty cell of this column becomes when the row is imported ("0" for a quantity, "true" for ' +
          "Active): an empty cell shows it, quieter, marked as the default, so nobody reads an empty cell as a " +
          "missing value."
      })
    ),
    align: S.Literal("right").pipe(
      S.optionalKey,
      S.annotateKey({ description: "`right` for numbers; left out, the column is set left." })
    ),
    core: S.Boolean.pipe(
      S.optionalKey,
      S.annotateKey({ description: "Kept in the table on a tablet. The first column always is." })
    ),
    hidden: S.Boolean.pipe(
      S.optionalKey,
      S.annotateKey({
        description:
          "Not shown until the person turns it on in the column menu. Its problems still show in the Status column."
      })
    ),
    facet: S.Boolean.pipe(
      S.optionalKey,
      S.annotateKey({ description: "Offered as a filter by its values (a category, a supplier)." })
    ),
    search: S.Boolean.pipe(
      S.optionalKey,
      S.annotateKey({ description: "Searched along with the name (a SKU, a code)." })
    ),
    context: S.Boolean.pipe(
      S.optionalKey,
      S.annotateKey({
        description: 'Part of the one line of context on a phone card ("SKU HB-M6-16 · On hand 100").'
      })
    ),
    under: S.Boolean.pipe(
      S.optionalKey,
      S.annotateKey({
        description: "On a tablet this column's value sits under the name instead of in its own column (a code, a SKU)."
      })
    ),
    code: S.Boolean.pipe(
      S.optionalKey,
      S.annotateKey({
        description:
          "An identifier a person compares character by character: a SKU, a part number, a barcode, a lot or " +
          "serial, a document number. Set in the monospace face wherever it shows. Never for names, quantities or " +
          "money."
      })
    ),
    match: ColumnMatch.pipe(
      S.optionalKey,
      S.annotateKey({ description: "How the column was found in the file, when the caller says" })
    ),
    display: DisplayValue.pipe(
      S.optionalKey,
      S.annotateKey({
        description:
          'How a value is shown, when it is not shown as the file has it: money as the rest of the app shows it ("1.2" ' +
          'as "$1.20"). Only what is drawn changes; the value the person edits, the checks and the result keep the ' +
          "file's text. Return the text unchanged when it cannot be read."
      })
    )
  }).pipe($I.annoteSchema("ReviewColumn", { description: "One column of the review" }))
) {}

/** Shown when the person asks "Why?". `basis` names the rule or the model; 25 words at most with `detail`. */
export class Why extends S.Opaque<Why, { readonly brand: unique symbol }>()(
  S.Struct({
    basis: S.String.pipe(S.annotateKey({ description: "The rule or the model behind the fix" })),
    detail: S.String.pipe(S.optionalKey, S.annotateKey({ description: "A few more words, when the basis needs them" })),
    alternatives: S.Array(S.String).pipe(
      S.optionalKey,
      S.annotateKey({ description: "The other values the person may pick instead of the fix's `to`" })
    ),
    labels: S.Array(S.String).pipe(
      S.optionalKey,
      S.annotateKey({
        description:
          "Words for the fix's `to` and then each of `alternatives`, in that order, when the values do not speak " +
          'for themselves ("2024-04-06 (month first)"): what the buttons that take them say.'
      })
    ),
    targets: S.Array(ColumnKey).pipe(
      S.optionalKey,
      S.annotateKey({
        description:
          "The column each pick writes, for the fix's `to` and then each of `alternatives`, in that order, when a " +
          'pick is a value of another column ("No discontinued date" on a question asked on Active). Left out when ' +
          "every pick is a value of the fix's own column. A pick written to another column is a typed value: one " +
          "undo step, checked again by `recheck`."
      })
    )
  }).pipe(
    $I.annoteSchema("Why", {
      description:
        'Shown when the person asks "Why?". `basis` names the rule or the model; 25 words at most with `detail`.'
    })
  )
) {}

/** Who prepared a fix: a fixed rule or a model. */
export const FixSource = LiteralKit(["rule", "model"]).pipe(
  $I.annoteSchema("FixSource", { description: "Who prepared a fix: a fixed rule or a model." })
)

/** The decoded value of `FixSource`. */
export type FixSource = typeof FixSource.Type

/** A fix's source as the screen says it: `unknown` when the caller did not name one. */
export const MarkSource = LiteralKit([...FixSource.literals, "unknown"]).pipe(
  $I.annoteSchema("MarkSource", {
    description: "A fix's source as the screen says it: `unknown` when the caller did not name one."
  })
)

/** The decoded value of `MarkSource`. */
export type MarkSource = typeof MarkSource.Type

/** How sure a fix's source is, in a word, never a percentage. */
export const Confidence = LiteralKit(["high", "medium", "low"]).pipe(
  $I.annoteSchema("Confidence", { description: "How sure a fix's source is, in a word, never a percentage." })
)

/** The decoded value of `Confidence`. */
export type Confidence = typeof Confidence.Type

/** A change to one cell, prepared by a rule or a model. Applied when lossless, otherwise it waits for an accept. */
export class Fix extends S.Opaque<Fix, { readonly brand: unique symbol }>()(
  S.Struct({
    column: ColumnKey.pipe(S.annotateKey({ description: "The column whose cell it changes" })),
    to: S.String.pipe(S.annotateKey({ description: "The value it would put there" })),
    by: FixSource.pipe(
      S.optionalKey,
      S.annotateKey({
        description:
          'Who prepared it, as the caller knows it. The screen says so ("Rule", a sparkle for a model); left out, it ' +
          "calls the change a suggestion and names nobody."
      })
    ),
    confidence: S.Option(Confidence).pipe(
      S.annotateKey({
        description:
          "How sure the source is, in a word, never a percentage. A `low` fix is a question: the person picks " +
          "between `to` and `why.alternatives`, and it is never accepted for a group in one press."
      })
    ),
    kind: S.String.pipe(S.annotateKey({ description: "The problem kind this change settles." })),
    group: S.String.pipe(
      S.optionalKey,
      S.annotateKey({
        description:
          "Identical changes share a group, and one accept settles the whole group. Never mix reasons in a group."
      })
    ),
    reason: S.String.pipe(
      S.optionalKey,
      S.annotateKey({
        description:
          "What is wrong with the value this fix would change, in one sentence: the row's reason while the fix waits " +
          "for the person (a rule's lossless fix held back as a proposal has no `problem` of its own to carry one)."
      })
    ),
    label: S.String.pipe(
      S.optionalKey,
      S.annotateKey({
        description:
          "What a group's heading and button call the change when its rows end in different values: one reading of " +
          'a column ("a decimal point" for 1,5 → 1.5 and 2,25 → 2.25). Each row still shows its own old and new value.'
      })
    ),
    why: Why
  }).pipe(
    $I.annoteSchema("Fix", {
      description:
        "A change to one cell, prepared by a rule or a model. Applied when lossless, otherwise it waits for an accept."
    })
  )
) {}

/** One value the person may pick on a row with no default (`problem.choices`). */
export class Choice extends S.Opaque<Choice, { readonly brand: unique symbol }>()(
  S.Struct({
    value: S.String.pipe(S.annotateKey({ description: "The value picking it writes" })),
    label: S.String.pipe(S.annotateKey({ description: 'The button\'s words ("40 L").' })),
    note: S.String.pipe(
      S.optionalKey,
      S.annotateKey({ description: 'A few words after it ("as 6 of 7 lines say"): the reason for a suggestion.' })
    ),
    suggested: S.Boolean.pipe(
      S.optionalKey,
      S.annotateKey({
        description:
          'The caller\'s suggestion, said in words on its button ("(suggested)"), with the reason in `note`. It is ' +
          "never picked for the person, and it looks like every other choice: no choice is the filled button."
      })
    )
  }).pipe($I.annoteSchema("Choice", { description: "One value the person may pick on a row with no default" }))
) {}

/** Why a row needs the person: its kind, its reason in a sentence, and what would settle it. */
export class Problem extends S.Opaque<Problem, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.String.pipe(S.annotateKey({ description: "The id of its problem kind" })),
    tone: ProblemTone.pipe(
      S.optionalKey,
      S.annotateKey({
        description:
          "This problem's own tone, when it differs from its kind's: a `blocker` is a value that must be typed " +
          "before the row can be imported, so the row is counted under `words.cannot` and still offers its answers."
      })
    ),
    reason: S.String.pipe(
      S.optionalKey,
      S.annotateKey({
        description:
          'The reason in one sentence, naming the column and the value ("Code is empty."): shown on the row whatever ' +
          "its kind, a fix or none, and in the file of rows not imported. Without it the kind's `help`, then its " +
          "label, stand in."
      })
    ),
    column: ColumnKey.pipe(
      S.optionalKey,
      S.annotateKey({ description: "The cell the problem is in, when it is in one." })
    ),
    ask: S.String.pipe(
      S.optionalKey,
      S.annotateKey({
        description: 'What the edit button says when the only honest option is typing ("Type a cost").'
      })
    ),
    note: S.String.pipe(S.optionalKey, S.annotateKey({ description: 'A few words beside the value ("also row 31").' })),
    fix: Fix.pipe(
      S.optionalKey,
      S.annotateKey({
        description: "What would settle it. Without one the person edits the value or leaves the row out."
      })
    ),
    rivals: S.Array(RowKey).pipe(
      S.optionalKey,
      S.annotateKey({
        description: "Rows that cannot all be imported (copies). Keeping this row leaves those out."
      })
    ),
    choices: S.Array(Choice).pipe(
      S.optionalKey,
      S.annotateKey({
        description:
          "A pick with no default: the values the person chooses between, as equal buttons, none proposed in the " +
          "cell. Picking one is the person's own value for `column`, so give a `column` and no `fix`."
      })
    )
  }).pipe($I.annoteSchema("Problem", { description: "Why a row needs the person, and what would settle it" }))
) {}

/** One row of the file as the review shows it: its cells, the fixes the rules made, and why it needs the person. */
export class ReviewRow extends S.Opaque<ReviewRow, { readonly brand: unique symbol }>()(
  S.Struct({
    id: RowKey.pipe(S.annotateKey({ description: "The row's id: what decisions and rivals name it by" })),
    line: S.Int.pipe(
      S.annotateKey({
        description:
          "The line in the file, as the person would count it. Several rows share one when a line holds several " +
          "records."
      })
    ),
    label: S.String.pipe(
      S.optionalKey,
      S.annotateKey({
        description:
          "How the region's sentences name this row when its line alone does not tell it from the others on that " +
          'line ("8 · Feb": "Leave row 8 · Feb out", "Keep row 8 · Feb"). Without it they say the line. The Row ' +
          "column keeps the line, so it still matches the file."
      })
    ),
    cells: Cells.pipe(
      S.annotateKey({ description: "The file's text by column id, formatted the way it should read." })
    ),
    applied: S.Array(Fix).pipe(
      S.optionalKey,
      S.annotateKey({
        description: "Lossless fixes the rules already made. Shown with a check; the person can undo a group of them."
      })
    ),
    problem: Problem.pipe(
      S.optionalKey,
      S.annotateKey({ description: "Why this row needs the person. A row without one is ready." })
    ),
    stored: S.Boolean.pipe(
      S.optionalKey,
      S.annotateKey({
        description:
          "The record is already in the system, so nothing is written for it and there is nothing to decide: it " +
          'shows under All with its tag (`words.stored`, "Already there"), counts apart from Needs you, Ready and ' +
          'Left out, and offers no answer, not even "Leave out". Give it no `problem`.'
      })
    ),
    blocked: S.Boolean.pipe(
      S.optionalKey,
      S.annotateKey({
        description:
          "The caller's own word on where a row that needs the person is counted: `true` under `words.cannot` (it " +
          "cannot be imported as written, whatever its first problem), `false` under `words.needs`. Left out, the " +
          "problem's `tone` says."
      })
    )
  }).pipe($I.annoteSchema("ReviewRow", { description: "One row of the file as the review shows it" }))
) {}

/**
 * What the person has decided about one row: `ReviewDecision` (`@inventory/review/ReviewDecision`). Only the person
 * writes these; proposals never do.
 */
export type RowDecision = ReviewDecision

/** One thing the person did, as undo holds it: the decisions its rows had before, and where focus returns. */
export const UndoStep = S.Struct({
  label: S.String.pipe(S.annotateKey({ description: "What the step did, in the words its undo button says" })),
  before: S.HashMap(RowKey, S.Option(ReviewDecision)).pipe(
    S.annotateKey({ description: "The decisions these rows had before the step; none for a row that had none." })
  ),
  focus: S.Option(RowKey).pipe(S.annotateKey({ description: "The row to return focus to when the step is undone." }))
}).pipe($I.annoteSchema("UndoStep", { description: "One step of the undo or redo history, as the region holds it" }))

/** The decoded value of `UndoStep`. */
export type UndoStep = typeof UndoStep.Type

/** Everything the person has decided so far, with the history that takes it back and puts it in force again. */
export const ReviewState = S.Struct({
  decisions: S.HashMap(RowKey, ReviewDecision).pipe(S.annotateKey({ description: "Each decided row's decision" })),
  undo: S.Array(UndoStep).pipe(S.annotateKey({ description: "The steps an undo takes back, the latest last" })),
  redo: S.Array(UndoStep).pipe(
    S.annotateKey({
      description:
        "Steps taken back, the latest last: a redo puts the last one in force again. Any new decision empties it. " +
        "Each is shaped like an undo step: `before` holds the decisions its rows had when it was undone."
    })
  )
}).pipe($I.annoteSchema("ReviewState", { description: "The person's decisions and the history behind them" }))

/** The decoded value of `ReviewState`. */
export type ReviewState = typeof ReviewState.Type

/** `cannot`: the row's problem is of a kind nothing on this screen can settle (`ProblemKind.fixable: false`). */
export const RowStatus = LiteralKit(["needs", "cannot", "ready", "out", "stored"]).pipe(
  $I.annoteSchema("RowStatus", {
    description: "Where a row stands: it needs the person, cannot be fixed here, is ready, left out or already stored."
  })
)

/** The decoded value of `RowStatus`. */
export type RowStatus = typeof RowStatus.Type

/** Who put a value in force: a fix's source, or the person ("you"). */
export const MarkAuthor = LiteralKit([...MarkSource.literals, "you"]).pipe(
  $I.annoteSchema("MarkAuthor", { description: "Who put a value in force: a fix's source, or the person" })
)

/** The decoded value of `MarkAuthor`. */
export type MarkAuthor = typeof MarkAuthor.Type

/** The two ways a cell differs from the file: a change that waits, or one in force. */
export const CellMarkState = LiteralKit(["proposed", "applied"]).pipe(
  $I.annoteSchema("CellMarkState", { description: "A change that waits for the person, or one in force" })
)

/** The decoded value of `CellMarkState`. */
export type CellMarkState = typeof CellMarkState.Type

const ProposedMark = S.Struct({
  state: S.tag("proposed"),
  from: S.String.pipe(S.annotateKey({ description: "The file's value" })),
  to: S.String.pipe(S.annotateKey({ description: "The value proposed" })),
  by: MarkSource.pipe(S.annotateKey({ description: "Who prepared the fix" })),
  fix: Fix
}).pipe($I.annoteSchema("ProposedMark", { description: "A change that waits for the person" }))

const AppliedMark = S.Struct({
  state: S.tag("applied"),
  from: S.String.pipe(S.annotateKey({ description: "The file's value" })),
  to: S.String.pipe(S.annotateKey({ description: "The value in force" })),
  by: MarkAuthor.pipe(S.annotateKey({ description: "Who put it in force" })),
  fix: S.Option(Fix).pipe(S.annotateKey({ description: "The fix this value came from; none when it came from none." })),
  accepted: S.Boolean.pipe(
    S.annotateKey({
      description: "True when the person took the fix; false when a rule applied it by itself."
    })
  )
}).pipe($I.annoteSchema("AppliedMark", { description: "A change in force" }))

/**
 * How one cell differs from the file. `proposed` waits for the person; `applied` is in force. Branch with
 * `CellMark.match`.
 */
export const CellMark = CellMarkState.mapMembers(() => Tuple.make(ProposedMark, AppliedMark)).pipe(
  S.toTaggedUnion("state"),
  $I.annoteSchema("CellMark", { description: "How one cell differs from the file" })
)

/** The decoded value of `CellMark`. */
export type CellMark = typeof CellMark.Type

/** Why a ready row is ready, when something happened to it: the rules fixed it, or the person decided. */
export const Decided = LiteralKit(["auto", "accepted", "kept", "edited"]).pipe(
  $I.annoteSchema("Decided", { description: "What made a ready row ready: the rules, or the person's own answer" })
)

/** The decoded value of `Decided`. */
export type Decided = typeof Decided.Type

/** A row as it stands after the person's decisions: the values that would be imported and what is still open. */
export const RowView = S.Struct({
  row: ReviewRow,
  status: RowStatus.pipe(S.annotateKey({ description: "Where the row stands now" })),
  cells: Cells.pipe(S.annotateKey({ description: "The values that would be imported, by column id" })),
  problem: Problem.pipe(S.optionalKey, S.annotateKey({ description: "What is still open on the row" })),
  blocked: S.Boolean.pipe(
    S.optionalKey,
    S.annotateKey({
      description:
        "The row needs the person and cannot be imported as written: counted and listed under `words.cannot`, " +
        "with its answers (type the value, leave out). Only ever set on a row whose `status` is `needs`."
    })
  ),
  marks: S.Record(ColumnKey, CellMark).pipe(
    S.annotateKey({ description: "How each changed cell differs from the file, by column id" })
  ),
  decided: Decided.pipe(
    S.optionalKey,
    S.annotateKey({
      description: "Why a ready row is ready, when something happened to it: the rules fixed it, or the person decided."
    })
  )
}).pipe($I.annoteSchema("RowView", { description: "A row as it stands after the person's decisions" }))

/** The decoded value of `RowView`. */
export type RowView = typeof RowView.Type

/** A file's spelling of a value and how many rows have it. */
export const Variant = S.Struct({
  from: S.String.pipe(S.annotateKey({ description: "The value as the file spells it" })),
  count: Count.pipe(S.annotateKey({ description: "How many rows of the group have it" }))
}).pipe($I.annoteSchema("Variant", { description: "A file's spelling of a value and how many rows have it" }))

/** The decoded value of `Variant`. */
export type Variant = typeof Variant.Type

/** Rows waiting on the same change: one accept settles them all. */
export const FixGroup = S.Struct({
  id: S.String.pipe(S.annotateKey({ description: "The group's id" })),
  kind: S.String.pipe(S.annotateKey({ description: "The problem kind its fixes settle" })),
  column: ColumnKey.pipe(S.annotateKey({ description: "The column its fixes change" })),
  to: S.String.pipe(S.annotateKey({ description: "The value its fixes put there" })),
  label: S.String.pipe(
    S.optionalKey,
    S.annotateKey({ description: "The fix's `label`, when its rows end in different values." })
  ),
  mixed: S.Boolean.pipe(
    S.optionalKey,
    S.annotateKey({
      description:
        "The rows end in different values and the caller gave no `label` for the change: the heading and its " +
        'button then name no value at all ("Accept for the 2 ticked"), and each row shows its own old and new value.'
    })
  ),
  by: MarkSource.pipe(S.annotateKey({ description: "Who prepared its fixes" })),
  confidence: S.Option(Confidence).pipe(
    S.annotateKey({ description: "How sure the source is; none when it did not say" })
  ),
  variants: S.Array(Variant).pipe(
    S.annotateKey({ description: "The file's spellings and how many rows have each, most common first." })
  ),
  rowIds: S.Array(RowKey).pipe(S.annotateKey({ description: "The rows waiting on the change" })),
  why: Why
}).pipe($I.annoteSchema("FixGroup", { description: "Rows waiting on the same change: one accept settles them all." }))

/** The decoded value of `FixGroup`. */
export type FixGroup = typeof FixGroup.Type

/** The four lines a table or a phone queue is made of. */
export const EntryType = LiteralKit(["kind", "group", "rest", "row"]).pipe(
  $I.annoteSchema("EntryType", { description: "A kind's heading, a group of fixes, the end of the groups, or a row" })
)

/** The decoded value of `EntryType`. */
export type EntryType = typeof EntryType.Type

const KindEntry = S.Struct({
  type: S.tag("kind"),
  kind: ProblemKind,
  rowIds: S.Array(RowKey).pipe(S.annotateKey({ description: "The rows of that kind" })),
  safe: S.Array(RowKey).pipe(
    S.annotateKey({
      description: "Rows whose open proposal is a rule's lossless fix: safe to take together."
    })
  ),
  collapsed: S.Boolean.pipe(S.annotateKey({ description: "Whether the person folded the kind's rows away" }))
}).pipe($I.annoteSchema("KindEntry", { description: "A heading for a problem kind" }))

const GroupEntry = S.Struct({
  type: S.tag("group"),
  group: FixGroup,
  applied: S.Boolean.pipe(S.annotateKey({ description: "True when the group's fixes are in force" }))
}).pipe($I.annoteSchema("GroupEntry", { description: "A group of identical fixes" }))

const RestEntry = S.Struct({
  type: S.tag("rest"),
  count: Count.pipe(S.annotateKey({ description: "How many rows follow, in no group" }))
}).pipe(
  $I.annoteSchema("RestEntry", {
    description: "Where a kind's groups end: the rows after it belong to no group and are settled one at a time."
  })
)

const RowEntry = S.Struct({
  type: S.tag("row"),
  view: RowView
}).pipe($I.annoteSchema("RowEntry", { description: "One row" }))

/**
 * One line of the table or the phone queue: a heading for a problem kind, a group of identical fixes, the end of a
 * kind's groups, or a row. Branch with `Entry.match`, test with `Entry.guards`.
 */
export const Entry = EntryType.mapMembers(() => Tuple.make(KindEntry, GroupEntry, RestEntry, RowEntry)).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("Entry", { description: "One line of the table or the phone queue" })
)

/** The decoded value of `Entry`. */
export type Entry = typeof Entry.Type

/** A decision on a phone: a group or a row, never a heading. */
export const QueueEntry = EntryType.pick(["group", "row"])
  .mapMembers(() => Tuple.make(GroupEntry, RowEntry))
  .pipe(
    S.toTaggedUnion("type"),
    $I.annoteSchema("QueueEntry", { description: "A decision on a phone: a group or a row, never a heading." })
  )

/** The decoded value of `QueueEntry`. */
export type QueueEntry = typeof QueueEntry.Type

/** The views of the rows a person can pick: each status, the rows the rules fixed, and all of them. */
export const FilterId = LiteralKit([...RowStatus.literals, "auto", "all"]).pipe(
  $I.annoteSchema("FilterId", { description: "A view of the rows: a status, the rows the rules fixed, or all" })
)

/** The decoded value of `FilterId`. */
export type FilterId = typeof FilterId.Type

/** How many rows stand where. Needs + cannot + ready + out + stored = total. */
export const Counts = S.Struct({
  total: Count.pipe(S.annotateKey({ description: "The rows in the file" })),
  needs: Count.pipe(S.annotateKey({ description: "Rows that need the person" })),
  cannot: Count.pipe(
    S.annotateKey({
      description:
        "Rows nothing on this screen can settle (`ProblemKind.fixable: false`): not imported, never decisions."
    })
  ),
  blocked: Count.pipe(
    S.annotateKey({
      description: "The part of `cannot` an answer on this screen can still settle (`RowView.blocked`)."
    })
  ),
  ready: Count.pipe(S.annotateKey({ description: "Rows that would be imported" })),
  out: Count.pipe(S.annotateKey({ description: "Rows the person left out" })),
  stored: Count.pipe(
    S.annotateKey({
      description:
        "Rows already in the system (`row.stored`): nothing is written for them. Needs + cannot + ready + out + " +
        "stored = total."
    })
  ),
  kinds: S.HashMap(S.String, Count).pipe(
    S.annotateKey({
      description:
        "Undecided rows per problem kind. They add up to `needs`: rows that cannot be fixed here are not decisions."
    })
  ),
  applied: Count.pipe(S.annotateKey({ description: "Rule fixes in force." }))
}).pipe($I.annoteSchema("Counts", { description: "How many rows stand where; the statuses add up to the total" }))

/** The decoded value of `Counts`. */
export type Counts = typeof Counts.Type

/** Who took a step of the run: the reader, a rule or a model. */
export const ActivitySource = LiteralKit(["read", ...FixSource.literals]).pipe(
  $I.annoteSchema("ActivitySource", { description: "Who took a step of the run: the reader, a rule or a model" })
)

/** The decoded value of `ActivitySource`. */
export type ActivitySource = typeof ActivitySource.Type

/** A step of the run, for the Activity drawer. */
export class ActivityStep extends S.Opaque<ActivityStep, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.String.pipe(S.annotateKey({ description: "The step's id" })),
    label: S.String.pipe(S.annotateKey({ description: "What was done, in the past tense" })),
    by: ActivitySource.pipe(S.annotateKey({ description: "Who did it" })),
    detail: S.String.pipe(S.optionalKey, S.annotateKey({ description: "A line more, when there is one" }))
  }).pipe($I.annoteSchema("ActivityStep", { description: "A step of the run, for the Activity drawer." }))
) {}

/** A fact as label and value ("Model", "none"). */
export class Fact extends S.Opaque<Fact, { readonly brand: unique symbol }>()(
  S.Struct({
    label: S.String.pipe(S.annotateKey({ description: "What the fact is about" })),
    value: S.String.pipe(S.annotateKey({ description: "The fact" }))
  }).pipe($I.annoteSchema("Fact", { description: "A fact as label and value" }))
) {}

/** What the run did and was allowed to do, for the Activity drawer. */
export class Activity extends S.Opaque<Activity, { readonly brand: unique symbol }>()(
  S.Struct({
    steps: S.Array(ActivityStep).pipe(S.annotateKey({ description: "The steps of the run, in order" })),
    allowed: S.Array(S.String).pipe(
      S.annotateKey({ description: "What the run was allowed to do, one short line each." })
    ),
    facts: S.Array(Fact).pipe(
      S.annotateKey({ description: "Facts as label and value: model, calls, cost, file, uploader." })
    )
  }).pipe($I.annoteSchema("Activity", { description: "What the run did and was allowed to do" }))
) {}

/** Where an imported value came from: a fix's source, or the person. */
export const ChangeSource = LiteralKit([...MarkSource.literals, "person"]).pipe(
  $I.annoteSchema("ChangeSource", { description: "Where an imported value came from: a fix's source, or the person" })
)

/** The decoded value of `ChangeSource`. */
export type ChangeSource = typeof ChangeSource.Type

/** Who put a changed value in force: the person, or a rule by itself. */
export const ChangeDecider = LiteralKit(["person", "rule"]).pipe(
  $I.annoteSchema("ChangeDecider", { description: "Who put a changed value in force: the person, or a rule" })
)

/** The decoded value of `ChangeDecider`. */
export type ChangeDecider = typeof ChangeDecider.Type

/** How a changed value came into force. */
export const ChangeHow = LiteralKit(["accepted a proposal", "typed or chose a value", "applied by a rule"]).pipe(
  $I.annoteSchema("ChangeHow", { description: "How a changed value came into force" })
)

/** The decoded value of `ChangeHow`. */
export type ChangeHow = typeof ChangeHow.Type

/**
 * One changed value of an imported row, with who is behind it: ready to write as an Activity row.
 * `source` is where the new value came from; `decidedBy` is who put it in force. `basis` and `confidence` are the
 * fix's `why.basis` and `confidence`, under the names the agent-decisions standard uses.
 */
export class ImportChange extends S.Opaque<ImportChange, { readonly brand: unique symbol }>()(
  S.Struct({
    column: ColumnKey.pipe(S.annotateKey({ description: "The column whose value changed" })),
    from: S.String.pipe(S.annotateKey({ description: "The file's value" })),
    to: S.String.pipe(S.annotateKey({ description: "The value imported" })),
    source: ChangeSource.pipe(
      S.annotateKey({
        description: "Where the new value came from; `unknown` when the caller did not say who prepared the fix."
      })
    ),
    decidedBy: ChangeDecider.pipe(S.annotateKey({ description: "Who put it in force" })),
    how: ChangeHow.pipe(S.annotateKey({ description: "How it came into force" })),
    basis: S.String.pipe(S.optionalKey, S.annotateKey({ description: "The fix's `why.basis`" })),
    confidence: S.Option(Confidence).pipe(S.annotateKey({ description: "The fix's `confidence`" }))
  }).pipe(
    $I.annoteSchema("ImportChange", {
      description: "One changed value of an imported row, with who is behind it"
    })
  )
) {}

/** A row to import: its values as they stand, and every value that differs from the file. */
export class ReadyRow extends S.Opaque<ReadyRow, { readonly brand: unique symbol }>()(
  S.Struct({
    id: RowKey.pipe(S.annotateKey({ description: "The row's id" })),
    line: S.Int.pipe(S.annotateKey({ description: "The line in the file" })),
    cells: Cells.pipe(S.annotateKey({ description: "The values to import, by column id" })),
    changes: S.Array(ImportChange).pipe(S.annotateKey({ description: "Each value that differs from the file" })),
    kept: S.Boolean.pipe(
      S.annotateKey({ description: "True when the person kept this row over another with the same key." })
    )
  }).pipe($I.annoteSchema("ReadyRow", { description: "A row to import" }))
) {}

/** Who is behind a row that is not imported. */
export const HeldBy = LiteralKit(["person", "nobody", "stored"]).pipe(
  $I.annoteSchema("HeldBy", {
    description:
      "person: they left the row out. nobody: it still needs them or cannot be fixed here. stored: already in the " +
      "system."
  })
)

/** The decoded value of `HeldBy`. */
export type HeldBy = typeof HeldBy.Type

/** A row that is not imported, with the reason a person can act on. */
export class HeldRow extends S.Opaque<HeldRow, { readonly brand: unique symbol }>()(
  S.Struct({
    id: RowKey.pipe(S.annotateKey({ description: "The row's id" })),
    line: S.Int.pipe(S.annotateKey({ description: "The line in the file" })),
    reason: S.String.pipe(S.annotateKey({ description: "Why it is not imported, in one sentence" })),
    decidedBy: HeldBy.pipe(
      S.annotateKey({
        description:
          '"person" for a row they left out, "nobody" for one that still needs them or cannot be fixed here, ' +
          '"stored" for one already in the system (`row.stored`).'
      })
    )
  }).pipe($I.annoteSchema("HeldRow", { description: "A row that is not imported, with its reason" }))
) {}

/** What the import button hands the caller: the rows to import and the rows held back, every row in one of them. */
export class ImportResult extends S.Opaque<ImportResult, { readonly brand: unique symbol }>()(
  S.Struct({
    ready: S.Array(ReadyRow).pipe(S.annotateKey({ description: "The rows to import" })),
    held: S.Array(HeldRow).pipe(S.annotateKey({ description: "The rows not imported, each with its reason" }))
  }).pipe($I.annoteSchema("ImportResult", { description: "The rows to import and the rows held back" }))
) {}

/** The person's decisions as plain data: safe to keep in a draft and hand back as `savedDecisions`. */
export const SavedDecisions = S.Record(RowKey, ReviewDecision).pipe(
  $I.annoteSchema("SavedDecisions", { description: "The person's decisions by row id, as plain data" })
)

/** The decoded value of `SavedDecisions`. */
export type SavedDecisions = typeof SavedDecisions.Type

/**
 * One step of the history as JSON-safe data (`toDraft`, `fromDraft`): what survives a refresh, so "Undo last step"
 * still takes back the step before it. `null` stands for "no decision" and "no row".
 */
export class DraftStep extends S.Opaque<DraftStep, { readonly brand: unique symbol }>()(
  S.Struct({
    label: S.String.pipe(S.annotateKey({ description: "What the step did, in the words its undo button says" })),
    before: S.Array(S.Tuple([RowKey, S.NullOr(ReviewDecision)])).pipe(
      S.annotateKey({
        description: "The decisions these rows had before the step (for a redo step: before it was undone)."
      })
    ),
    focus: S.NullOr(RowKey).pipe(
      S.annotateKey({ description: "The row focus returns to when the step is undone or redone." })
    )
  }).pipe($I.annoteSchema("DraftStep", { description: "One step of the history as JSON-safe data" }))
) {}

/** The decisions and the undo history behind them, as JSON-safe data (`toDraft`, `fromDraft`). */
export class ReviewDraft extends S.Opaque<ReviewDraft, { readonly brand: unique symbol }>()(
  S.Struct({
    decisions: SavedDecisions.pipe(S.annotateKey({ description: "Each row's decision, by row id" })),
    undo: S.Array(DraftStep).pipe(S.annotateKey({ description: "The steps an undo takes back, the latest last" })),
    redo: S.Array(DraftStep).pipe(
      S.optionalKey,
      S.annotateKey({
        description: "Steps taken back and not yet redone. Absent in a draft from before redo existed."
      })
    )
  }).pipe(
    $I.annoteSchema("ReviewDraft", { description: "The decisions and the undo history behind them, as JSON-safe data" })
  )
) {}

/**
 * Every status and tab word the region shows, in one place. The tabs say `needs`, `cannot`, `ready`, `out` and `all`;
 * a row's tag says `ready`, `out`, `stored` or what happened to it (`auto`, `accepted`, `kept`, `edited`, `chosen`).
 * `nothingNew` ends a review whose every row is already there, in place of the import button.
 */
export class ReviewWords extends S.Opaque<ReviewWords, { readonly brand: unique symbol }>()(
  S.Struct({
    needs: S.String.pipe(S.annotateKey({ description: "Rows that need the person" })),
    cannot: S.String.pipe(S.annotateKey({ description: "Rows that cannot be imported as written" })),
    ready: S.String.pipe(S.annotateKey({ description: "Rows that would be imported" })),
    out: S.String.pipe(S.annotateKey({ description: "Rows the person left out" })),
    all: S.String.pipe(S.annotateKey({ description: "Every row" })),
    stored: S.String.pipe(S.annotateKey({ description: "Rows already in the system" })),
    auto: S.String.pipe(S.annotateKey({ description: "A row the rules fixed" })),
    accepted: S.String.pipe(S.annotateKey({ description: "A row whose proposal the person took" })),
    kept: S.String.pipe(S.annotateKey({ description: "A row the person kept over its copies" })),
    edited: S.String.pipe(S.annotateKey({ description: "A row whose value the person typed" })),
    chosen: S.String.pipe(S.annotateKey({ description: "A row whose value the person picked" })),
    nothingNew: S.String.pipe(
      S.annotateKey({ description: "Ends a review whose every row is already there, in place of the import button" })
    ),
    nothingToImport: S.String.pipe(S.annotateKey({ description: "Ends a review in which nothing can be imported" }))
  }).pipe($I.annoteSchema("ReviewWords", { description: "Every status and tab word the region shows" }))
) {}

/** A sum the caller worked out, with its unit or currency in the value ("Purchase", "$12,480.20"). */
export type Total = { readonly label: string; readonly value: string }

export type ReviewRegionProps = {
  /** The page's `h1`: the job and the file ("Review items.csv"). */
  readonly title: string
  /** What a row is called, singular and plural. */
  readonly noun: readonly [string, string]
  /**
   * The columns and the rows, as atoms: the region and everything it works out from them (the counts, the list on
   * screen, the facets, the widths) follow them, and a caller whose rows change hands over no new props.
   */
  readonly columns: Atom.Atom<ReadonlyArray<ReviewColumn>>
  readonly rows: Atom.Atom<ReadonlyArray<ReviewRow>>
  /**
   * The person's decisions with their undo history: the caller's atom. The region writes it with every action and
   * every undo, and whoever keeps the decisions (a server draft, the browser) reads it there: `saved(state)` is the
   * plain data to keep. Start it with `restored(saved)` for kept decisions (handed back as the very object `saved`
   * gave, or as `fromDraft` rebuilt it after a refresh, they bring "Undo last step" back with them), with
   * `proposing(rows)` where the rules' fixes are proposals, or with `emptyState`. A new atom, with a new `key` on the
   * region, starts the review again.
   */
  readonly decisions: Atom.Writable<ReviewState>
  /** The kinds of problem the rows can have, in the order the work list shows them, as an atom the region follows. */
  readonly problemKinds: Atom.Atom<ReadonlyArray<ProblemKind>>
  /** Past-tense facts about the run, a few words each ("178 rows read"). Columns and fixes are added for you. */
  readonly summary: ReadonlyArray<string>
  readonly activity?: Activity
  /**
   * The caller's own check, run on a row after the person typed a value, as an atom (none while there is no rule).
   * Without it an edit to the problem's cell settles the problem.
   */
  readonly recheck?: Atom.Atom<
    O.Option<
      (input: { readonly row: ReviewRow; readonly cells: Readonly<Record<string, string>> }) => Problem | undefined
    >
  >
  readonly onImport: (result: ImportResult) => void
  /** The person picked a file column for a field. Re-run the review and pass new `columns` and `rows`. */
  readonly onMatchColumn?: (columnId: string, source: string) => void
  /**
   * Opens the caller's own screen that says which file column fills each field (and takes a new match). With it the
   * toolbar has a button there, amber while a field has no column.
   */
  readonly onShowMatching?: () => void
  readonly state?: "ready" | "loading" | "error"
  /** One sentence for the error state, and what to try. */
  readonly error?: string
  readonly onRetry?: () => void
  /**
   * True while the person may look but not decide, as an atom: the region's widths, its keys and its buttons follow
   * it. `readOnlyNote` says who can decide, in the caller's words.
   */
  readonly readOnly?: Atom.Atom<boolean>
  readonly readOnlyNote?: string
  /**
   * The one action when the file has no rows, or when nothing in it can be imported (every row already there, left
   * out or not fixable here): it then stands where the import button was, after the words that say so ("Choose another
   * file").
   */
  readonly emptyAction?: ReactNode
  /**
   * The caller's own quiet actions beside the grey line under the title ("Suggest fixes"): outline buttons and a
   * line of what they did. Never the filled button.
   */
  readonly summaryAction?: ReactNode
  /**
   * What happens to the rules' own lossless fixes (`row.applied`). "propose" (the default) asks first: they are
   * proposals the person takes in one click, counted under Needs you until then. "apply" puts them in force on
   * arrival, shown with a tick and an Undo per group. An atom, as everything the region works from is.
   */
  readonly ruleFixes?: Atom.Atom<"propose" | "apply">
  /** One sentence for the confirm step: what the import does to what is already there ("Each row becomes a new item."). */
  readonly importNote?: string
  /**
   * The button's words when no row is ready and none needs a decision, for a caller that can confirm with nothing
   * to add (an import reopened after it created its items). Without it the button says nothing is ready.
   */
  readonly closingLabel?: string
  /** True while the caller is writing the import. */
  readonly importing?: boolean
  /**
   * Inside a page that has its own heading, counts and import button (records with a parent: the page's table of
   * orders, the region for the questions on their lines). The title is an `h2`, and the footer keeps Undo but shows
   * neither the region's own tally nor its import button, so `onImport` is never called: the page's counts decide.
   */
  readonly embedded?: boolean
  /**
   * The caller's words for the tabs and the statuses, when the task has its own ("Waiting on you" for Needs you,
   * "Will be created" for Ready). Each word is set once here and used on every tab, tag, count and file that says it;
   * what is not given keeps its default (`defaultReviewWords`). An atom the region follows.
   */
  readonly words?: Atom.Atom<Partial<typeof ReviewWords.Encoded>>
  /**
   * The sums that matter, worked out by the caller from the rows it will import, each with its unit or currency
   * ("Purchase $12,480.20"). Shown in the table's footer beside the counts. Never add different units in one.
   */
  readonly totals?: ReadonlyArray<Total>
  /**
   * One more answer on a row that needs the person, for rows that belong to a parent record ("Leave job J-2044
   * out"). With it each such row keeps its own answers, under a group heading too: its fix or its choices, then
   * "Other answers" with typing a value, leaving the row out and this action, each named in full. Return
   * `undefined` for a row it does not fit. An atom (none while there is no such answer): the widths of the table's
   * answers are worked out from it.
   */
  readonly rowAction?: Atom.Atom<O.Option<(row: ReviewRow) => RowAction | undefined>>
  /**
   * "Why flagged?": the caller's own account of the flagged rows on screen (what the view, the problem kind, the
   * search and the filters narrow it to), each row named with every reason it has. Shown in a side panel from the
   * toolbar. Left out, there is no such button.
   */
  readonly explain?: (rows: ReadonlyArray<ReviewRow>) => ReactNode
  /**
   * The caller's own form for a value the person has to give, where one box of text would not do (a cell that holds
   * several values). It stands where the region's one field would, behind the same button, and what it saves is the
   * cell's text: one undo step, checked again by `recheck`, as a typed value is. `undefined` for a cell it does not
   * fit. Read when a row is drawn, and kept nowhere.
   */
  readonly cellEditor?: (input: {
    readonly row: ReviewRow
    readonly column: string
    readonly value: string
  }) => CellEditor | undefined
}

/** The caller's form for one cell (`cellEditor`): the button's words, the panel's title, and the form itself. */
export type CellEditor = {
  readonly label: string
  readonly title: string
  /** `save` takes the cell's new text ("" for none) and closes the panel. */
  readonly render: (save: (value: string) => void) => ReactNode
}

/** The caller's own answer on one row (`rowAction`): its words in full, and what it does. */
export type RowAction = { readonly label: string; readonly onSelect: () => void }
