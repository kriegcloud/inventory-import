/**
 * The data a review region shows. Everything here comes from the caller: the primitive holds no field names, status
 * words or rules of its own. Do not add one product's vocabulary to this file.
 */
import type { HashMap } from "effect"
import type { ReactNode } from "react"

/** Amber for a choice only the person can make, red for a value that cannot be imported as it is. */
export type ProblemTone = "decision" | "blocker"

/** One reason a row can need the person. `label` is the tag in the Problem column: three words or fewer. */
export type ProblemKind = {
  id: string
  label: string
  tone: ProblemTone
  /** One line under the kind's heading: what these rows need ("Each needs a cost before it can be imported."). */
  help?: string
  /**
   * `false` when nothing on this screen can settle a row of this kind (the item it names is not in the system yet):
   * such rows are counted apart from Needs you, under their own tab, with their reason and no answer to press, and
   * they never hold the import back. Left out, a kind can be settled here.
   */
  fixable?: boolean
}

/** How a column of ours was found in the file. `unmatched` blocks the import until the person picks a source. */
export type ColumnMatch =
  | { state: "matched"; source: string; by: "name" | "model"; samples: ReadonlyArray<string> }
  | { state: "unmatched"; candidates: ReadonlyArray<{ source: string; samples: ReadonlyArray<string> }> }

/**
 * How a column takes its width. `fit`: as wide as its longest value and its header, measured from the loaded rows,
 * and never cut (a code, a unit, a price, a short choice, a proposed old → new value). `fill`: shares the room the
 * `fit` columns leave and ends in an ellipsis, the whole text one hover or tap away (a name, a reason, a description).
 */
export type ColumnSize = "fit" | "fill"

export type ReviewColumn = {
  id: string
  /** One or two words. */
  label: string
  /**
   * The least width in pixels: a `fill` column never shrinks below it (160 when not given); a `fit` column is at
   * least this wide even when its values are shorter. The first column stays in view when the table scrolls sideways.
   */
  width?: number
  /** `fit` (the default) or `fill`: see `ColumnSize`. */
  size?: ColumnSize
  /**
   * Which `fit` column gives way first when the room cannot hold them all: the lowest priority moves into the row's
   * detail (and, with `under`, under the record's name) before any value is cut. Higher stays longer; ties go from the
   * right. `core` counts as 1, anything else as 0, unless a number is given.
   */
  priority?: number
  /** A second, quieter header line under the label: the unit the values are in ("USD", "kg", "days"). */
  unit?: string
  align?: "right"
  /** Kept in the table on a tablet. The first column always is. */
  core?: boolean
  /** Not shown until the person turns it on in the column menu. Its problems still show in the Status column. */
  hidden?: boolean
  /** Offered as a filter by its values (a category, a supplier). */
  facet?: boolean
  /** Searched along with the name (a SKU, a code). */
  search?: boolean
  /** Part of the one line of context on a phone card ("SKU HB-M6-16 · On hand 100"). */
  context?: boolean
  /** On a tablet this column's value sits under the name instead of in its own column (a code, a SKU). */
  under?: boolean
  /**
   * An identifier a person compares character by character: a SKU, a part number, a barcode, a lot or serial, a
   * document number. Set in the monospace face wherever it shows. Never for names, quantities or money.
   */
  code?: boolean
  match?: ColumnMatch
  /**
   * How a value is shown, when it is not shown as the file has it: money as the rest of the app shows it ("1.2" as
   * "$1.20"). Only what is drawn changes; the value the person edits, the checks and the result keep the file's text.
   * Return the text unchanged when it cannot be read.
   */
  display?: (value: string) => string
}

/** Shown when the person asks "Why?". `basis` names the rule or the model; 25 words at most with `detail`. */
export type Why = {
  basis: string
  detail?: string
  alternatives?: ReadonlyArray<string>
  /**
   * Words for the fix's `to` and then each of `alternatives`, in that order, when the values do not speak for
   * themselves ("2024-04-06 (month first)"): what the buttons that take them say.
   */
  labels?: ReadonlyArray<string>
  /**
   * The column each pick writes, for the fix's `to` and then each of `alternatives`, in that order, when a pick is a
   * value of another column ("No discontinued date" on a question asked on Active). Left out when every pick
   * is a value of the fix's own column. A pick written to another column is a typed value: one undo step, checked
   * again by `recheck`.
   */
  targets?: ReadonlyArray<string>
}

/** Who prepared a fix: a fixed rule or a model. */
export type FixSource = "rule" | "model"

/** A fix's source as the screen says it: `unknown` when the caller did not name one. */
export type MarkSource = FixSource | "unknown"

/** A change to one cell, prepared by a rule or a model. Applied when lossless, otherwise it waits for an accept. */
export type Fix = {
  column: string
  to: string
  /**
   * Who prepared it, as the caller knows it. The screen says so ("Rule", a sparkle for a model); left out, it calls
   * the change a suggestion and names nobody.
   */
  by?: FixSource
  /**
   * How sure the source is, in a word, never a percentage. A `low` fix is a question: the person picks between
   * `to` and `why.alternatives`, and it is never accepted for a group in one press.
   */
  confidence?: "high" | "medium" | "low"
  /** The problem kind this change settles. */
  kind: string
  /** Identical changes share a group, and one accept settles the whole group. Never mix reasons in a group. */
  group?: string
  /**
   * What is wrong with the value this fix would change, in one sentence: the row's reason while the fix waits for the
   * person (a rule's lossless fix held back as a proposal has no `problem` of its own to carry one).
   */
  reason?: string
  /**
   * What a group's heading and button call the change when its rows end in different values: one reading of a
   * column ("a decimal point" for 1,5 → 1.5 and 2,25 → 2.25). Each row still shows its own old and new value.
   */
  label?: string
  why: Why
}

/** One value the person may pick on a row with no default (`problem.choices`). */
export type Choice = {
  value: string
  /** The button's words ("40 L"). */
  label: string
  /** A few words after it ("as 6 of 7 lines say"): the reason for a suggestion. */
  note?: string
  /**
   * The caller's suggestion, said in words on its button ("(suggested)"), with the reason in `note`. It is never
   * picked for the person, and it looks like every other choice: no choice is the filled button.
   */
  suggested?: boolean
}

export type Problem = {
  kind: string
  /**
   * This problem's own tone, when it differs from its kind's: a `blocker` is a value that must be typed before the row
   * can be imported, so the row is counted under `words.cannot` and still offers its answers.
   */
  tone?: ProblemTone
  /**
   * The reason in one sentence, naming the column and the value ("Code is empty."): shown on the row whatever its
   * kind, a fix or none, and in the file of rows not imported. Without it the kind's `help`, then its label, stand in.
   */
  reason?: string
  /** The cell the problem is in, when it is in one. */
  column?: string
  /** What the edit button says when the only honest option is typing ("Type a cost"). */
  ask?: string
  /** A few words beside the value ("also row 31"). */
  note?: string
  /** What would settle it. Without one the person edits the value or leaves the row out. */
  fix?: Fix
  /** Rows that cannot all be imported (copies). Keeping this row leaves those out. */
  rivals?: ReadonlyArray<string>
  /**
   * A pick with no default: the values the person chooses between, as equal buttons, none proposed in the cell.
   * Picking one is the person's own value for `column`, so give a `column` and no `fix`.
   */
  choices?: ReadonlyArray<Choice>
}

export type ReviewRow = {
  id: string
  /** The line in the file, as the person would count it. Several rows share one when a line holds several records. */
  line: number
  /**
   * How the region's sentences name this row when its line alone does not tell it from the others on that line
   * ("8 · Feb": "Leave row 8 · Feb out", "Keep row 8 · Feb"). Without it they say the line. The Row column keeps the
   * line, so it still matches the file.
   */
  label?: string
  /** The file's text by column id, formatted the way it should read. */
  cells: Readonly<Record<string, string>>
  /** Lossless fixes the rules already made. Shown with a check; the person can undo a group of them. */
  applied?: ReadonlyArray<Fix>
  /** Why this row needs the person. A row without one is ready. */
  problem?: Problem
  /**
   * The record is already in the system, so nothing is written for it and there is nothing to decide: it shows under
   * All with its tag (`words.stored`, "Already there"), counts apart from Needs you, Ready and Left out, and offers
   * no answer, not even "Leave out". Give it no `problem`.
   */
  stored?: boolean
  /**
   * The caller's own word on where a row that needs the person is counted: `true` under `words.cannot` (it cannot be
   * imported as written, whatever its first problem), `false` under `words.needs`. Left out, the problem's `tone` says.
   */
  blocked?: boolean
}

/** What the person has decided about one row. Only the person writes these; proposals never do. */
export type RowDecision = {
  out?: boolean
  /** Kept over its rivals. */
  kept?: boolean
  /** Columns whose proposed fix the person accepted. */
  accepted?: ReadonlyArray<string>
  /** Columns whose applied fix the person undid. */
  reverted?: ReadonlyArray<string>
  /** Values the person typed, by column. */
  edits?: Readonly<Record<string, string>>
}

export type UndoStep = {
  label: string
  /** The decisions these rows had before the step. */
  before: HashMap.HashMap<string, RowDecision | undefined>
  /** The row to return focus to when the step is undone. */
  focus: string | undefined
}

export type ReviewState = {
  decisions: HashMap.HashMap<string, RowDecision>
  undo: ReadonlyArray<UndoStep>
  /**
   * Steps taken back, the latest last: a redo puts the last one in force again. Any new decision empties it. Each is
   * shaped like an undo step: `before` holds the decisions its rows had when it was undone.
   */
  redo?: ReadonlyArray<UndoStep>
}

/** `cannot`: the row's problem is of a kind nothing on this screen can settle (`ProblemKind.fixable: false`). */
export type RowStatus = "needs" | "cannot" | "ready" | "out" | "stored"

/** How one cell differs from the file. `proposed` waits for the person; `applied` is in force. */
export type CellMark =
  | { state: "proposed"; from: string; to: string; by: MarkSource; fix: Fix }
  | {
      state: "applied"
      from: string
      to: string
      by: MarkSource | "you"
      /** The fix this value came from, when it came from one. */
      fix?: Fix
      /** True when the person took the fix; absent when a rule applied it by itself. */
      accepted?: boolean
    }

/** A row as it stands after the person's decisions: the values that would be imported and what is still open. */
export type RowView = {
  row: ReviewRow
  status: RowStatus
  cells: Readonly<Record<string, string>>
  problem?: Problem
  /**
   * The row needs the person and cannot be imported as written: counted and listed under `words.cannot`, with its
   * answers (type the value, leave out). Only ever set on a row whose `status` is `needs`.
   */
  blocked?: boolean
  marks: Readonly<Record<string, CellMark>>
  /** Why a ready row is ready, when something happened to it: the rules fixed it, or the person decided. */
  decided?: "auto" | "accepted" | "kept" | "edited"
}

/** One line of the table or the phone queue: a heading for a problem kind, a group of identical fixes, or a row. */
export type Entry =
  | {
      type: "kind"
      kind: ProblemKind
      rowIds: ReadonlyArray<string>
      /** Rows whose open proposal is a rule's lossless fix: safe to take together. */
      safe: ReadonlyArray<string>
      collapsed: boolean
    }
  | { type: "group"; group: FixGroup; applied: boolean }
  /** Where a kind's groups end: the rows after it belong to no group and are settled one at a time. */
  | { type: "rest"; count: number }
  | { type: "row"; view: RowView }

/** A decision on a phone: a group or a row, never a heading. */
export type QueueEntry = Exclude<Entry, { type: "kind" | "rest" }>

export type FilterId = "needs" | "cannot" | "ready" | "out" | "stored" | "auto" | "all"

/** Rows waiting on the same change: one accept settles them all. */
export type FixGroup = {
  id: string
  kind: string
  column: string
  to: string
  /** The fix's `label`, when its rows end in different values. */
  label?: string
  /**
   * The rows end in different values and the caller gave no `label` for the change: the heading and its button then
   * name no value at all ("Accept for the 2 ticked"), and each row shows its own old and new value.
   */
  mixed?: boolean
  by: MarkSource
  confidence?: "high" | "medium" | "low"
  /** The file's spellings and how many rows have each, most common first. */
  variants: ReadonlyArray<{ from: string; count: number }>
  rowIds: ReadonlyArray<string>
  why: Why
}

export type Counts = {
  total: number
  needs: number
  /** Rows nothing on this screen can settle (`ProblemKind.fixable: false`): not imported, never decisions. */
  cannot: number
  /** The part of `cannot` an answer on this screen can still settle (`RowView.blocked`). */
  blocked: number
  ready: number
  out: number
  /** Rows already in the system (`row.stored`): nothing is written for them. Needs + cannot + ready + out + stored = total. */
  stored: number
  /** Undecided rows per problem kind. They add up to `needs`: rows that cannot be fixed here are not decisions. */
  kinds: HashMap.HashMap<string, number>
  /** Rule fixes in force. */
  applied: number
}

/** A step of the run, for the Activity drawer. */
export type ActivityStep = { id: string; label: string; by: "read" | "rule" | "model"; detail?: string }

export type Activity = {
  steps: ReadonlyArray<ActivityStep>
  /** What the run was allowed to do, one short line each. */
  allowed: ReadonlyArray<string>
  /** Facts as label and value: model, calls, cost, file, uploader. */
  facts: ReadonlyArray<{ label: string; value: string }>
}

/**
 * One changed value of an imported row, with who is behind it: ready to write as an Activity row.
 * `source` is where the new value came from; `decidedBy` is who put it in force. `basis` and `confidence` are the
 * fix's `why.basis` and `confidence`, under the names the agent-decisions standard uses.
 */
export type ImportChange = {
  column: string
  from: string
  to: string
  /** `unknown` when the caller did not say who prepared the fix. */
  source: MarkSource | "person"
  decidedBy: "person" | "rule"
  how: "accepted a proposal" | "typed or chose a value" | "applied by a rule"
  basis?: string
  confidence?: "high" | "medium" | "low"
}

export type ImportResult = {
  ready: ReadonlyArray<{
    id: string
    line: number
    cells: Readonly<Record<string, string>>
    changes: ReadonlyArray<ImportChange>
    /** True when the person kept this row over another with the same key. */
    kept: boolean
  }>
  /**
   * `decidedBy` is "person" for a row they left out, "nobody" for one that still needs them or cannot be fixed here,
   * "stored" for one already in the system (`row.stored`).
   */
  held: ReadonlyArray<{ id: string; line: number; reason: string; decidedBy: "person" | "nobody" | "stored" }>
}

/** The person's decisions as plain data: safe to JSON.stringify, keep in a draft, and hand back as `savedDecisions`. */
export type SavedDecisions = Readonly<Record<string, RowDecision>>

/**
 * The decisions and the undo history behind them, as JSON-safe data (`toDraft`, `fromDraft`): what survives a
 * refresh, so "Undo last step" still takes back the step before it. `null` stands for "no decision" and "no row".
 */
export type DraftStep = {
  readonly label: string
  /** The decisions these rows had before the step (for a redo step: before it was undone). */
  readonly before: ReadonlyArray<readonly [string, RowDecision | null]>
  /** The row focus returns to when the step is undone or redone. */
  readonly focus: string | null
}

export type ReviewDraft = {
  readonly decisions: SavedDecisions
  readonly undo: ReadonlyArray<DraftStep>
  /** Steps taken back and not yet redone. Absent in a draft from before redo existed. */
  readonly redo?: ReadonlyArray<DraftStep>
}

export type ReviewRegionProps = {
  /** The page's `h1`: the job and the file ("Review items.csv"). */
  title: string
  /** What a row is called, singular and plural. */
  noun: readonly [string, string]
  columns: ReadonlyArray<ReviewColumn>
  rows: ReadonlyArray<ReviewRow>
  problemKinds: ReadonlyArray<ProblemKind>
  /** Past-tense facts about the run, a few words each ("178 rows read"). Columns and fixes are added for you. */
  summary: ReadonlyArray<string>
  activity?: Activity
  /**
   * The caller's own check, run on a row after the person typed a value. Without it an edit to the problem's cell
   * settles the problem.
   */
  recheck?: (input: { row: ReviewRow; cells: Readonly<Record<string, string>> }) => Problem | undefined
  onImport: (result: ImportResult) => void
  /** The person picked a file column for a field. Re-run the review and pass new `columns` and `rows`. */
  onMatchColumn?: (columnId: string, source: string) => void
  /**
   * Opens the caller's own screen that says which file column fills each field (and takes a new match). With it the
   * toolbar has a button there, amber while a field has no column.
   */
  onShowMatching?: () => void
  state?: "ready" | "loading" | "error"
  /** One sentence for the error state, and what to try. */
  error?: string
  onRetry?: () => void
  /** The person may look but not decide. `readOnlyNote` says who can, in the caller's words. */
  readOnly?: boolean
  readOnlyNote?: string
  /**
   * The one action when the file has no rows, or when nothing in it can be imported (every row already there, left
   * out or not fixable here): it then stands where the import button was, after the words that say so ("Choose another
   * file").
   */
  emptyAction?: ReactNode
  /**
   * The caller's own quiet actions beside the grey line under the title ("Suggest fixes"): outline buttons and a
   * line of what they did. Never the filled button.
   */
  summaryAction?: ReactNode
  /**
   * What happens to the rules' own lossless fixes (`row.applied`). "propose" (the default) asks first: they are
   * proposals the person takes in one click, counted under Needs you until then. "apply" puts them in force on
   * arrival, shown with a tick and an Undo per group.
   */
  ruleFixes?: "propose" | "apply"
  /**
   * Decisions to start from: a draft restored after a refresh, or the region drawn again after the page showed
   * another view. Read once; give the region a new `key` to reset. Handed back as the very object
   * `onDecisionsChange` gave, or as `fromDraft` rebuilt it after a refresh, it brings "Undo last step" back with it;
   * a plain copy starts a new history.
   */
  savedDecisions?: SavedDecisions
  /**
   * Called after every decision and undo with the decisions as plain data, for the caller to keep as it is. Read
   * through a ref: a new function on each render is fine, and is called once per change.
   */
  onDecisionsChange?: (saved: SavedDecisions) => void
  /** One sentence for the confirm step: what the import does to what is already there ("Each row becomes a new item."). */
  importNote?: string
  /**
   * The button's words when no row is ready and none needs a decision, for a caller that can confirm with nothing
   * to add (an import reopened after it created its items). Without it the button says nothing is ready.
   */
  closingLabel?: string
  /** True while the caller is writing the import. */
  importing?: boolean
  /**
   * Inside a page that has its own heading, counts and import button (records with a parent: the page's table of
   * orders, the region for the questions on their lines). The title is an `h2`, and the footer keeps Undo but shows
   * neither the region's own tally nor its import button, so `onImport` is never called: the page's counts decide.
   */
  embedded?: boolean
  /**
   * The caller's words for the tabs and the statuses, when the task has its own ("Waiting on you" for Needs you,
   * "Will be created" for Ready). Each word is set once here and used on every tab, tag, count and file that says it;
   * what is not given keeps its default (`defaultReviewWords`).
   */
  words?: Partial<ReviewWords>
  /**
   * The sums that matter, worked out by the caller from the rows it will import, each with its unit or currency
   * ("Purchase $12,480.20"). Shown in the table's footer beside the counts. Never add different units in one.
   */
  totals?: ReadonlyArray<{ label: string; value: string }>
  /**
   * One more answer on a row that needs the person, for rows that belong to a parent record ("Leave job J-2044
   * out"). With it each such row keeps its own answers, under a group heading too: its fix or its choices, then
   * "Other answers" with typing a value, leaving the row out and this action, each named in full. Return
   * `undefined` for a row it does not fit. Keep the function stable (`useCallback`).
   */
  rowAction?: (row: ReviewRow) => RowAction | undefined
  /**
   * The caller's own form for a value the person has to give, where one box of text would not do (a cell that holds
   * several values). It stands where the region's one field would, behind the same button, and what it saves is the
   * cell's text: one undo step, checked again by `recheck`, as a typed value is. `undefined` for a cell it does not
   * fit. Keep the function stable.
   */
  cellEditor?: (input: { row: ReviewRow; column: string; value: string }) => CellEditor | undefined
}

/** The caller's form for one cell (`cellEditor`): the button's words, the panel's title, and the form itself. */
export type CellEditor = {
  label: string
  title: string
  /** `save` takes the cell's new text ("" for none) and closes the panel. */
  render: (save: (value: string) => void) => ReactNode
}

/**
 * Every status and tab word the region shows, in one place. The tabs say `needs`, `cannot`, `ready`, `out` and `all`;
 * a row's tag says `ready`, `out`, `stored` or what happened to it (`auto`, `accepted`, `kept`, `edited`, `chosen`).
 * `nothingNew` ends a review whose every row is already there, in place of the import button.
 */
export type ReviewWords = {
  needs: string
  cannot: string
  ready: string
  out: string
  all: string
  stored: string
  auto: string
  accepted: string
  kept: string
  edited: string
  chosen: string
  nothingNew: string
  nothingToImport: string
}

/** The caller's own answer on one row (`rowAction`): its words in full, and what it does. */
export type RowAction = { label: string; onSelect: () => void }
