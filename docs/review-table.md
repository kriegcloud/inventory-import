---
type: Component Guide
title: The review region
description: How to wire ReviewRegion, the Review step of an import, to real rows and a pure check in minutes.
tags: [ui, components, import, review]
---

# The review region

`ReviewRegion` (`@inventory/review` (`packages/review`)) is the Review step of an import as one region that fills the screen and
never scrolls the page: the title and one line, then one card holding a toolbar (the search at the left, then Undo and
Redo and the icon buttons for columns, filter, row height, the download of the rows not imported and the activity, at
fixed places; the views "Needs you 42 · Can't fix here 3 · Ready 133 · All 178" as a button group and one button at the
far right, "Import 133, skip 45"), a work list
of the problem kinds beside the table, the rows with each problem and a button that says what it will do about it, and a
footer with what will not be imported and how many decisions are left. It is built only from `@inventory/ui` parts
(`sticky-table`, `data-table` headers, `Button` variants) and passes both design lints. It holds no product words and
fetches nothing: you give it rows and it gives you back what to write. See it at `/gallery/review` while `bun run dev`
runs (states in the grid icon, top right; "Records with a parent", `?state=parent`, is a page of jobs with the region
for the questions on their lines; "One line, several records", `?state=months`, is a file with a count per month, each
month its own row of the region, labelled "3 · Feb").

## What you pass

| Prop | What it is |
| --- | --- |
| `title`, `noun` | Required. The `h1` ("Review items_messy.csv") and what a row is called, `["record", "records"]`, for the button |
| `columns` | Our fields in order. The first is the record's own column, pinned when the table scrolls sideways. `size`: `"fit"` (the default: as wide as its longest value and its header, measured from the rows in view, never cut; a code, a unit, a price, a short choice) or `"fill"` (shares what is left and ends in an ellipsis, the whole text in a hover card; a name, a description). `width` is the least width (a `fill` column's default is 160). `priority`: short of room the lowest `fit` column moves into the row's detail first (higher stays longer; `core` counts as 1, others 0; ties go from the right). `unit` is a second header line ("$", "days"). `align: "right"` for numbers, `under` to show it under the name when it gives way, `hidden` to start it hidden (the Columns menu shows it), `facet` for a filter by its values, `search` to search it with the name, `context` for the phone card's one line, `code` for an identifier compared character by character (a SKU, part number, barcode, lot or serial: set in the monospace face), `match` to say which file column fed it, `display` for how a value is shown when not as the file has it (money: "1.2" as "$1.20"; only what is drawn changes, the edit, the checks and the result keep the file's text) |
| `rows` | One per file line, or one per record when a line holds several (`id` its own, `line` shared, `label` "8 · Feb" for the region's sentences: [patterns](patterns.md) section 16): `{ id, line, label?, cells: { [columnId]: text }, problem?, applied?, stored? }`. `label` names the row in "Leave row 8 · Feb out", "Keep row 8 · Feb", the "row 8 · Feb" link and the download; the Row column keeps `line`. Cells are already formatted text. A row with no `problem` is ready. `stored: true` is a record already in the system: it counts apart (Already there), shows under All with its tag, and offers nothing, not even "Leave out" |
| `problemKinds` | An atom of `{ id, label, tone, help?, fixable? }`, in the order the work list shows them: the tag in the Problem column, three words at most. `decision` is amber, `blocker` is red. `help` is one line under the kind's heading. `fixable: false` is a kind nothing on this screen can settle (the item it names is not in the system yet): its rows are counted under Can't fix here, offer no answer and never hold the import back |
| `problem` | `{ kind, reason?, column?, ask?, note?, fix?, rivals?, choices? }`: `kind` is a `problemKinds` id; `reason` is the row's sentence, naming the column and the value ("Code is empty."), shown on every row whatever its kind, a fix or none, and in `result.held` and the download (without it the kind's `help`, then its label, stand in); `column` the cell it is in, `note` a few words beside the tag ("row 31") |
| `problem.fix` | A proposal: `{ column, to, by?: "rule" \| "model", kind, group?, label?, reason?, confidence, why: { basis, detail?, alternatives? } }` (`confidence` is an `Option` the caller always gives: `O.some("high")`, or `O.none()` when nothing rated it). Shown struck-old, green new value, button "Use pcs". `by` names who prepared it ("Rule", a sparkle for a model); left out, the change is called a suggestion and names nobody. `reason` is what is wrong with the value, the row's sentence while the fix waits (a rule's lossless fix has no `problem` of its own). Same `group` on identical changes gives a heading above those rows with "Use pcs for 9". `confidence: "low"` makes it a question: the person picks `to` or one of `why.alternatives`, and there is no accept for the group |
| `fix.label` | What a group's heading and button call the change when its rows end in different values: one reading of a column, `label: "a decimal point"` for 1,5 → 1.5 and 2,25 → 2.25. The heading reads "1,5 (1) · 2,25 (1) → a decimal point" and the button "Use a decimal point for the 2 ticked"; each row still shows its own old and new value, and an accept gives each row its own `to` |
| `problem.choices` | A pick with no default: `[{ value, label, note?, suggested? }]`, with a `column` and no `fix`. Equal outline buttons, nothing proposed in the cell; one choice is its own button, several open from one (`problem.ask`, or "Choose"). A pick is the person's own value for `column` (your `recheck` sees it) and the row then says "Chosen". `suggested: true` with the reason in `note` reads "40 L, as 6 of 7 lines say (suggested)": said in words only, never picked for the person, never the filled button |
| `problem.rivals` | Ids of rows that cannot all go in (the same code). The row gets "Keep row 5", which leaves the rivals out, and a "row 56" link that shows the two side by side |
| `row.applied` | Lossless rule fixes already made (a spelling). Shown with a check and "Auto-fixed"; the "17 auto-fixed" chip lists them by group, each with Undo |
| `recheck` | Your pure check of one row, run after the person types a value. Return a `Problem` or `undefined` |
| `onImport(result)` | `result.ready` (id, line, final cells) is what to write; `result.held` has a reason per row |
| `summary`, `activity` | Extra past-tense chips, and the Activity drawer: steps tagged Read, Rule or Model, what it was allowed, facts |
| `state`, `onMatchColumn`, `emptyAction`, `importing` | `"loading" \| "error" \| "ready"`; a column the file did not answer |
| `readOnly` | An atom of a boolean: true while the person may look but not decide. The region's buttons, its keys and the width of its answers follow it |
| `ruleFixes` | An atom of `"propose"` (the default) or `"apply"`: see "Asking first" below |
| `embedded` | Inside a page with its own heading, counts and import button: the title is an `h2`, the toolbar keeps Undo and Redo, and the region shows neither its own tally nor its import button, so `onImport` is never called. See "When records have a parent" |
| `words` | An atom of the task's own words for the tabs and the statuses, each set once and used on every tab, tag, count, sentence and downloaded file; what is left out keeps its default (`defaultReviewWords` in `words.ts`). The tabs: `needs` (Needs you), `cannot` (Can't fix here), `ready`, `out` (Left out), `all`; a row's tag: `stored` (Already there), `auto` (Auto-fixed), `accepted`, `kept`, `edited`, `chosen`; and `nothingNew` ("Nothing new: this file is already in") and `nothingToImport` ("Nothing here can be imported") in place of the import button. `{ needs: "Waiting on you" }`. The table's caption follows them |
| `totals` | `[{ label, value }]`: the sums that matter, worked out by you from the rows you will import ("Purchase $3,771.18"), shown in the footer. Never add different units or currencies in one |
| `rowAction` | An atom of `Option<(row) => ({ label, onSelect }) \| undefined>` (none while there is no such answer): one more answer on a row that needs the person, for rows with a parent ("Leave job J-2044 out"). Each such row keeps its own answers, under a group heading too (no ticks there; the heading's button then says "for all 3"): its fix, pick or typing, then "Other answers" with typing a value beside a fix, "Leave row 8 out" and yours, each in full; a phone card lists them as buttons. Return `undefined` for a row it does not fit. The widths of the table's answers are worked out from it, so it is an atom like the rows: `Atom.make(O.some(fn))` at module level, or a derived atom when it reads the page's state |
| `decisions` | The person's decisions with their undo and redo, as the caller's own atom (`Atom.Writable<ReviewState>`). The region writes it with every action; whoever keeps the decisions reads it there (`saved(state)` is the plain data). Start it with `proposing(rows)` (the rules' fixes as proposals), `emptyState`, `restored(saved)` for decisions kept as plain data (a new history), or `fromDraft(draft)` for a review kept with its Undo and Redo (`toDraft(state)`) |

## From the spreadsheet reader to the review

`readSpreadsheet({ file })` (`packages/catalog/web/src/internal/spreadsheet`, pattern 7) returns a `SpreadsheetTable`: columns with the
header as found, rows with the row number the person sees in Excel, and notes. The review takes it from there:

```tsx
import type { SpreadsheetTable } from "../../domain/Spreadsheet.ts"
import type { Activity, ReviewRow } from "@inventory/review/ReviewTypes"

const headers = { name: "Name", unit: "UOM", qty: "Qty on hand" } // our field id -> the file's header

export const toReviewRows = (table: SpreadsheetTable): ReadonlyArray<ReviewRow> =>
  table.rows.map((row) => {
    const cells: Record<string, string> = {}
    for (const [id, header] of Object.entries(headers)) {
      const cell = row.cells[table.columns.findIndex((column) => column.label === header)]
      cells[id] = cell === undefined ? "" : (cell.shown ?? cell.text)
    }
    const problem = check(cells) // your pure rule, below
    return { id: `row-${row.rowNumber}`, line: row.rowNumber, cells, ...(problem === undefined ? {} : { problem }) }
  })

// The reader's notes are sentences, so they go in the Activity drawer, not in a chip.
export const toActivity = (table: SpreadsheetTable): Activity => ({
  steps: table.notes.map((note, index) => ({ id: String(index), by: "read" as const, label: note.message })),
  allowed: ["Read the uploaded file"],
  facts: [{ label: "File", value: table.fileName }]
})
```

`line` is Excel's row number, so the Row column and every "row 56" match what the person sees in the file. A header the
file does not have is a `match: ColumnMatch.Unmatched({ candidates })` on that column (below), not a guess. Then
`<ReviewRegion rows={toReviewRows(table)} activity={toActivity(table)} summary={[`${table.rows.length} rows read`]} …
/>`. Checked: this hand-off type-checks as written against the reader's types.

## Wiring it to a pure review function

```tsx
import { AppShell } from "@/components/app/AppShell"
import { ReviewRegion } from "@inventory/review/ReviewRegion"
import type { Problem, ProblemKind, ReviewColumn, ReviewRow } from "@inventory/review/ReviewTypes"
import * as O from "effect/Option"
import * as Atom from "effect/reactivity/Atom"

const columns: ReadonlyArray<ReviewColumn> = [
  { id: "name", label: "Name", width: 220, core: true },
  { id: "unit", label: "Unit", width: 150, core: true },
  { id: "qty", label: "On hand", width: 90, align: "right", core: true }
]
const kinds = [
  { id: "unit", label: "Unknown unit", tone: "decision" },
  { id: "qty", label: "Below zero", tone: "blocker" }
] as const
const kindsAtom = Atom.make<ReadonlyArray<ProblemKind>>(kinds) // what the region works from is an atom of the caller's
const spellings: Record<string, string> = { ea: "pcs", each: "pcs" } // your rule table; Record.get in the model package

// The same pure function the server runs. One problem per row: the first rule that fails.
const check = (cells: Readonly<Record<string, string>>): Problem | undefined => {
  const unit = cells.unit ?? ""
  const to = Object.hasOwn(spellings, unit) ? spellings[unit] : undefined
  if (to !== undefined) {
    const why = { basis: `Fixed rule: "${unit}" means ${to}.` }
    return { kind: "unit", column: "unit", fix: { column: "unit", to, by: "rule", kind: "unit", group: `unit:${to}`, confidence: O.none(), why } }
  }
  if (!["pcs", "kg", "m"].includes(unit)) return { kind: "unit", column: "unit" }
  if ((cells.qty ?? "").startsWith("-")) return { kind: "qty", column: "qty" }
  return undefined
}
const review = (file: ReadonlyArray<Record<string, string>>): ReadonlyArray<ReviewRow> =>
  file.map((cells, index) => {
    const problem = check(cells)
    return { id: `line-${index + 2}`, line: index + 2, cells, ...(problem === undefined ? {} : { problem }) }
  })

export function ReviewStep(props: { file: ReadonlyArray<Record<string, string>>; onImport: (cells: unknown) => void }) {
  return (
    <AppShell fill title="Import records">
      <ReviewRegion title="Review items_messy.csv" noun={["record", "records"]} columns={columnsAtom} rows={rowsAtom}
        decisions={decisionsAtom} problemKinds={kindsAtom} summary={[`${useAtomValue(rowsAtom).length} rows read`]}
        recheck={recheckAtom}
        onImport={(result) => props.onImport(result.ready.map((row) => row.cells))} />
    </AppShell>
  )
}
```

- `AppShell fill` gives the region the screen below the header. Inside another frame, give its parent a height.
- `rows`, `columns`, `recheck` and `decisions` are atoms, made at module level beside the file's own atom
  (`const rowsAtom = Atom.map(fileAtom, review)`, `const columnsAtom = Atom.make(columns)`,
  `const recheckAtom = Atom.make(O.some(({ cells }) => check(cells)))`,
  `const decisionsAtom = Atom.make(emptyState)`): the region derives everything from them, once per change.
- A model's proposals are the same `fix` with `by: "model"`; they get a sparkle. Merge them into `rows` when they
  arrive. A row the person already decided keeps the person's decision. Give the region a new `key` for a new file.
- The server still decides: send `result.ready` to an endpoint that runs the same `check` and refuses what it refuses.

## When records have a parent (orders with lines)

The region reviews one level: one row per thing the person decides. When the file's lines belong to a parent (an
order and its lines, an invoice and its items), the screen is split this way (the other way round, one line that
holds several records, is [patterns](patterns.md) section 16):

- **The table by parent is the project's own**: one row per order and what it becomes (its lines, its total, ready
  or waiting), in the app's data table (`RecordsTable` in `packages/ui/src/components/data-table/data-table-records.tsx`: every
  table here is the data table or this region). The page's counts and its import button live
  there, and a waiting order opens its questions.
- **The questions go on `ReviewRegion`**: one region row per line (or per question) that needs the person, with its
  `problem` and `fix` as above, and a column for the parent's number (`code: true`, and `context: true` for the
  phone card), so every row says which order it belongs to. Pass `embedded`: the title becomes an `h2` under the
  page's heading, and the region shows neither its own tally nor its import button.
- **The page counts, not the region.** Read the decisions from the atom the region writes
  (`Atom.map(decisionsAtom, saved)`), turn them into the project's answers, and run the project's own pure review of the parents with them. That
  one function gives every count on the page and what its button imports: the region counts rows, and an order is
  ready only when every one of its lines is.
- **The filter words follow the task's own names.** Where the task calls the waiting ones "Waiting on you", pass
  `words={Atom.make({ needs: "Waiting on you" })}` (made once, at module level) and give the parent table's tabs the same words, so the page and the
  region say one thing.
- **A line's own answers, and its parent's.** `rowAction` adds the parent's answer to every line that needs the
  person ("Leave job J-2044 out"), beside "Leave row 8 out"; the page leaves the parent out and drops its lines from
  `rows`. A question with no default is `problem.choices`, one of them `suggested` with its reason in `note`.
- **Two views, one history.** A page that shows the parent table and the questions as two views unmounts the region
  when it switches. The decisions are the page's atom, so they outlive the region: it comes back with its answers
  and with "Undo last step". After a refresh, `fromDraft(draft)` brings the decisions and their history back; the
  plain decisions alone (`restored(saved)`) bring them back and start a new history.
- **Twelve parent rows at 1440 by 900.** The parent table is the data table (`RecordsTable`), one line a row with
  the reason cut to one line and the whole sentence in its `title`, one status pill, the totals on one line beside
  the import button and the filters on the same row as the view tabs.

The gallery's "Records with a parent" state (`src/web/pages/gallery/JobsReview.tsx`, sample `jobs.ts`) is this
shape: 24 jobs, a reason on each, filters on the tab row; "Questions" holds the region with a unit to pick (one
choice suggested), a decimal comma under one labelled group, a SKU not in stock, and "Leave job … out" on every line.

## What it does, so you do not build it again

- Every button says its outcome: "Use pcs", "Set cost" (one field, then your `recheck`), "Keep row 5", "Leave out".
  A value with no `ask` is asked for as "Set" and the column's name ("Set item #"), so no article is guessed.
- A decision is one undo step. Undo and Redo are two icon buttons in the toolbar, each naming the step and its keys
  in a tooltip ("Undo: 5 fixes accepted (Ctrl+Z)"), dimmed with nothing to do. Ctrl or Cmd+Z undoes; Ctrl or
  Cmd+Shift+Z and Ctrl+Y redo; inside a text field the browser's own undo applies. Any new decision empties the redo
  stack. A step that settled several rows also shows a toast with Undo, which takes back that step only while it is
  still the last. Focus then moves to the next row that needs a decision in the kind on screen, then to the next kind
  on the work list, then to the import button (or the table, where there is none), never to the page's body.
- The problem kinds are a work list (`WorkList.tsx`): a rail beside the table on a desk, one row of toggle chips above
  it on a tablet, each kind with how many rows are left and a tick once none are. Needs you shows the kind picked on
  it, under a heading with what its rows need and its answers for all of them ("Accept 9 safe fixes", "Leave out 11").
  `J` and `K` step through its rows; "Next problem" in the footer goes down the list when a kind is done. The rail is
  there only on Needs you; Ready and All give the table its whole width.
- Each group of identical fixes is a heading above its rows, two lines lined up with the names below: the change (the
  file's spellings with their counts, an arrow, the proposed value, how many rows), then the reason in full with a
  Rule or Model badge. Its answers sit under the actions column: the accept (the screen's filled button while it is in
  view), then "Other unit" and "Leave out 9", quiet, or one "More answers" when they do not fit side by side. A line
  "5 rows to settle one at a time" says where the last group ends.
- "Why?" gives the reason in 25 words (`why.basis` + `why.detail`) and "here" or "all 9". It opens after a short
  pause on hover as well as on click, Enter and tap; it is a popover, so a screen reader meets it as a dialog.
- Widths (`sizing.ts`, `planColumns`, tested): every `fit` column is as wide as its header and the widest value it
  shows in the rows in view, a proposed change included ("ea.", an arrow, the new value in a chip, its "Why?"),
  measured on a canvas by `@inventory/ui/TextWidth`, never on an element; the `fill` columns share the rest. The Status
  column is as wide as its widest tag. Short of room the lowest-priority `fit` column moves into the row's detail,
  opened by a button before the row number (an `under` column moves under the name instead), before any value is cut.
  A column the person turned on in the Columns menu and the column the kind on screen is about never move: when they
  do not fit, the table scrolls sideways under its pinned first column. A header is as wide as its column, its sort
  mark beside its own label (before it in a column of numbers); numbers are right-aligned.
- A value that ends in an ellipsis (a `fill` cell, a struck-through old value cut short, a group's spellings) shows its
  whole text in a hover card on hover, on keyboard focus and on a tap; such a cell joins the tab order, one that fits
  does not. Nothing in the region uses a native `title`: a short hint is the app's Tooltip.
- A change with nothing a person could see struck through shows the new value alone, in its chip: an empty cell
  under a group heading that says "empty → Foot", and a value that only loses the spaces around it. A screen reader
  hears "was empty" or "spaces removed", a tooltip says what it was, and the group heading puts a value with spaces
  at its ends in quotation marks (“Foot ” → Foot), so the change can be seen. A short value (8 characters or fewer)
  is shown the same way in its row; a longer one (a SKU, a name) stands alone.
- Sort and hide from each column's header menu (the heading is one control as large as its cell); the Columns icon
  lists every column with a tick to show it and the file column it was read from (a column the file did not answer
  turns the icon amber and has its choice there); one search box searches the name and the `search` columns. Rows are
  virtualised; 5,000 are fine.
- "Filter" (an icon) is one panel: for each `facet` column, a tick box per value the file has, with how many rows of
  the showing view have it. Values that differ only by spaces around them are one choice. The icon is pressed while a
  filter is on, because hidden rows give no other sign, and "Clear filters" takes them all off. A long list scrolls
  inside the panel on a thin bar of its own (`ScrollArea`), as do the units to choose from and the Columns menu.
- Row height is compact (36 px) or comfortable (44 px), from the toolbar, remembered in this browser.
- The download icon gives the rows that will not be imported as a CSV with a reason on every line.
- "Import 136 records" opens a confirm when rows are held: what will be imported and what will not.
- A column with `match: ColumnMatch.Unmatched({ candidates })` (the enum from `@inventory/review/ReviewTypes`; a
  column found in the file is `ColumnMatch.Matched({ source, by, samples })`) turns the Columns icon amber, puts a select in that
  column's header and changes the button to "Match Unit to import".
- Widths are the page's own room, not the window's: the window less a sidebar beside the page, which the shell
  reports with `setContentInset` (`@inventory/ui/ContentWidth`; without one it is the window), less the card's margins and
  the rail. From 1101 px a full toolbar and the rail; 768 to 1100 px the toolbar on two lines (the search and the
  import, then the views and the tools) and the work list as chips; under 768 px one decision at a time (a group is
  one decision), with "Decision 3 of 14" counted the same way as the footer's "decisions left", Undo and Redo, 44 px
  buttons and bottom sheets, and the tabs' counts under their words so a long label never runs into its number.
- The Status column is left out while every row showing would say the same word ("Ready", before anything was
  decided), and on Needs you, where the heading says it. The import button says "Import 136, skip 42" on every tab
  and is outlined on every tab while a decision is open; on Needs you it is filled only when no group's accept is in
  view. With decisions open and nothing ready it says "No records ready yet" and is disabled. With nothing to import
  and nothing to decide it gives way to words, "Nothing new: this file is already in" (every row already there) or
  "Nothing here can be imported" (`words.nothingNew`, `words.nothingToImport`), and beside them `emptyAction`
  ("Choose another file").
- On a phone a group's rows are each the label of their tick box: the whole 44 px line toggles it.

## Asking first, who decided, and not losing work (the standards)

- **Nothing changes until the person accepts** (`ruleFixes`, default `"propose"`): the rules' lossless fixes
  (`row.applied`) wait as proposals under Needs you, with "Accept 17 safe fixes" on their kind's heading and one
  heading per spelling. `ruleFixes={Atom.make("apply")}` puts them in force on arrival with a tick, "17 auto-fixed" and Undo.
- **Who decided each thing** is in `onImport`'s result, ready for an Activity row per change:
  `result.ready[i].changes` is `{ column, from, to, source: "rule" | "model" | "person", decidedBy: "person" | "rule",
  how, basis?, confidence }` (`basis` and `confidence` are the fix's `why.basis` and `confidence`, the latter an `Option`), `kept` marks a row
  kept over another, and `result.held[i].decidedBy` is `"person"` for a row left out, `"nobody"` for one still open.
- **A refresh does not lose work**: decisions are plain data. Keep them and hand them back (the caller's atom keeps
  "Undo last step" too while the page is open: "Two views, one history"):

```tsx
// One atom per file: read is what is held, or what was kept; a write holds it and keeps it (your server draft or localStorage).
const decisionsOf = perKey((fileId: string) => {
  const held = Atom.make<O.Option<ReviewState>>(O.none())
  return Atom.writable(
    (get) => O.getOrElse(get(held), () => restored(readDraft(fileId) ?? {})),
    (ctx, next: ReviewState) => { ctx.set(held, O.some(next)); writeDraft(fileId, saved(next)) }
  )
})
<ReviewRegion key={fileId} decisions={decisionsOf(fileId)} … />
```

## Not included

- Row selection and "ask about the selection" (Why flagged? What would you do?). The hook a caller would use is a
  selection state beside `rows`; the region has none today.

## What it deliberately does not do

- No parsing, fetching, storage or model calls. It never invents a value: without a `fix` the person types one.
- On a phone there is no sorting, filtering or search: the flow is the decisions, in order.
- One problem per row at a time. When it is settled, `recheck` may return the next.
- Editing is one field, the one that is wrong. For editing many cells use the data grid ([the kit](kit.md)).
- No sums of its own: it cannot know which columns add up or in what units. Pass yours in `totals`, and a check
  against the file in `summary` ("Totals match file").
- It keeps no decisions of its own: they live in the caller's `decisions` atom, for as long as the caller keeps that
  atom, and across a reload only if the caller's atom writes them somewhere (see "A refresh does not lose work"). The
  undo and redo history lives in the state the atom holds; to keep it across a refresh, store `toDraft(state)`
  and start again from `fromDraft(draft)` (the Review step does this with the saved progress; a draft saved
  before redo existed opens with nothing to redo).

## Wired to the example Record

The app's own Review step is the worked example: `packages/catalog/web/src/ReviewStep.screen.tsx` draws the region, and
`packages/catalog/web/src/ImportReview.controller.ts` turns the pure review (`review` in `packages/catalog/model/src/Review/Review.rules.ts`) into its rows,
columns and problem kinds and the region's decisions back into the saved draft. The region holds no record words and
the adapter holds no rules: a different kind of record changes `ItemImport.ts` and the adapter's columns, never the
region. `packages/catalog/web/test/reviewParity.test.ts` drives the region's logic and `review` side by side on `items_messy.csv` and
requires the same statuses after every step.
