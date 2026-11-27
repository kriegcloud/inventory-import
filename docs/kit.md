---
type: Component Guide
title: The import kit
description: The components ready for an import screen and a list of records, when to use each, and what was changed after installing them.
tags: [ui, components, import]
---

# The import kit

What is ready for an import screen and a list of records, and when to use each piece. Each was checked in the
production build under the content security policy, in both themes, at 1440, 768 and 390 px, with the keyboard, and
with Lighthouse (Accessibility 100). `docs/ui.md` "UI" and [patterns](patterns.md) section 8 still win over anything here.
Nothing here is product logic: what a row means and which rule applies are written in `packages/catalog/model/src/Review/Review.rules.ts`,
and the decisions behind them in `DECISIONS.md`.

| Need | Use | File |
| --- | --- | --- |
| Upload, Match, Review, Result | `Stepper`, its value in `?step=`, each screen in a `StepperContent`; the import page draws its steps into the shell's top bar (`BarSlotContext`) | `components/ui/stepper.tsx`, `pages/ImportPage.tsx` |
| Choose the file | `FileUpload` (Dice UI): a labelled file input, drag and drop on its box, Enter opens the picker; a file dropped anywhere else on the page goes to the same input (`UploadStep.screen.tsx`); then the `startUpload` atom is set to the file, which reads in a worker and stages in chunks, with progress and Cancel | `components/ui/file-upload.tsx`, `lib/upload/`, `pages/import/UploadStep.tsx` |
| Which sheet of a workbook | `SheetChooser`: "Sheet 3 of 6: Records", why, and a select; nothing when one sheet has data | `packages/catalog/web/src/internal/SheetChooser.tsx` |
| A refresh loses nothing | `useSavedProgress(scope, browserRuntime)`: the chosen file until the server has it, and the review's undo history beside the decisions the server keeps, for one person in one organization; cleared on Confirm | `lib/saved-progress/` |
| A table of rows to decide on | `ReviewRegion`: one card with one toolbar (search, views, Undo and Redo, column, filter, row height, download and activity icons, the counted Import button), a work list of the problem kinds beside the table, columns sized to their values (`fit`) or sharing the rest (`fill`), cut text in a hover card, one decision per group, one decision at a time on a phone. Read [the review region](review-table.md) | `components/review/` |
| A list the server pages (records, anything a second import adds to) | `DataTable` + `useDataTable` with `urlState`, the toolbar's one search box (`TableSearch`), sort and filter menus, the table assistant | `packages/ui/src/components/data-table/`, `pages/ItemsPage.tsx` |
| A list the page already holds (people, a result's rows) | `RecordsTable`: the same data table in client mode, cards on a phone | `packages/ui/src/components/data-table/data-table-records.tsx` |
| A spreadsheet to edit in bulk | `DataGrid` + `useDataGrid` from the tablecn registry (TanStack Table 9, virtualised) | `packages/ui/src/components/data-grid/` |
| Something on its way | `PageHeaderSkeleton`, `TableSkeleton`, `TablePageSkeleton`, `ReviewSkeleton`, `UploadSkeleton`, `StepsSkeleton` in the real boxes | `@inventory/ui/Skeletons` (`packages/ui/src/Skeletons.component.tsx`) |
| A failure, in words | `sayError(error)`: title, sentence and every problem; `toastError`; `answeredByLine` for which path answered | `@inventory/client/SayError`; `answeredByLine` in `lib/answeredBy.ts` |
| Every problem of a form at once | `formProblems` and `problemOf`, shown with `FieldError` under each field (the record editor reads its form with `readRecordForm` from the domain instead) | `lib/form.ts`, `pages/ItemEditor.tsx` |
| Reading and writing the API | `makeApiAtoms(tag)`: `query` (a read as an atom), `write`, `ask`, `send`; `invalidate(keys)`; `optimisticWrite`; each package's keys | `@inventory/client/Api`, `@inventory/client/OptimisticAtoms`; `packages/catalog/web/src/Catalog.keys.ts`, `packages/access/web/src/Access.keys.ts` |
| Act on selected rows or cells | `ActionBar`, passed to `DataGrid` as `actionBar` | `packages/ui/src/components/action-bar.tsx` |
| A change before it happens | `ProposedValue`: `<del>` and `<ins>` with hidden "was" and "now" | `packages/ui/src/ProposedValue.component.tsx` |
| What a run did | `AgentRun`: past-tense steps that open to show what each read and returned | `packages/ui/src/AgentRun.component.tsx` |
| A two-minute walk | `Tour`: spotlight steps over real elements, a dialog with a title | `packages/ui/src/components/tour.tsx` |
| Undo, phone sheets, filters | `toast(..., { action })`, `Drawer` or `Sheet side="bottom"`, `ToggleGroup` | `packages/ui/src/components/` |

## Steps and upload

```tsx
// setSearchParam stands for your own address update: an illustration, not a helper in the tree
<Stepper value={step} onValueChange={(v) => { setStep(v); setSearchParam("step", v) }} aria-label="Import steps">
  <StepperList id="import-steps">{steps.map((s) => (
    <StepperItem key={s.value} value={s.value}>
      <StepperTrigger><StepperIndicator /><StepperTitle>{s.title}</StepperTitle></StepperTrigger><StepperSeparator />
    </StepperItem>))}
  </StepperList>
  <StepperContent value="upload">
    <FileUpload label="Records file" accept=".csv,.xlsx" maxFiles={1} value={files} onValueChange={setFiles}
      onFileReject={(file, why) => toast.error(why)}>
      <FileUploadDropzone>Drop the file here
        <FileUploadTrigger asChild><Button variant="outline" size="sm">Choose file</Button></FileUploadTrigger>
      </FileUploadDropzone>
    </FileUpload>
  </StepperContent>
  <StepperContent value="review">…</StepperContent>
</Stepper>
```

- Render a `StepperContent` for every step: each trigger points at its panel (`aria-controls`), and the current
  trigger has `aria-current="step"`. Arrow keys move between steps; disable steps the person cannot reach yet with
  `<StepperItem disabled>`.
- Take the chosen file from `onAccept`, not `onValueChange`: with a controlled `value` the component calls
  `onValueChange` twice for one choice, which staged every file twice here. Hand it to `startUpload` from
  `@inventory/catalog-web/Upload` (an atom: `useAtomSet(startUpload)({ file })`), which reads it in a worker with `readSpreadsheet` (.csv and .xlsx, [patterns](patterns.md) section 7),
  stages it in chunks and shows progress with a Cancel. A "Use the sample file" ghost button beside "Choose file" is
  the demo path.

Under the dropzone, always: an outline button "Use the sample file" that fetches `/samples/<name>` and hands the text
or bytes to the same handler as a chosen file, and a link `<a href="/samples/<name>" download>` beside it. If the
fetch fails, say so and point at the download.

## Review table, point and ask, proposals

- Native table, not a grid: `TableHeader`, `TableRow`, `TableHead`, `TableCell` inside your own scroll container,
  `TableCaption className="sr-only"`, the name cell `<TableHead scope="row">`, a region with `tabIndex={0}` when wider
  than the screen. Past 200 rows: `useVirtualizer({ count, getScrollElement, estimateSize: () => 36, overscan: 12 })`
  from `@tanstack/react-virtual` with spacer rows (TanStack's virtual "table" example), `aria-rowcount` on the table
  and `aria-rowindex` on each rendered row.
- Point and ask: with rows selected, the row of saved views becomes a bar in reading order: "2 selected · Why
  flagged? · What would you do? · Rows like this · Clear" (ghost `Button size="sm"`). The answer is a `role="status"`
  line above the table that names the lines it is about. "What would you do?" opens a proposal; it never edits.
- A proposal shows on the real cells and in one bar: "Prepared by rules: round 6 quantities" (or "Suggested by the
  model") with Accept 6, Step through and Dismiss. Without an AI key the proposals come from rules and look the same.

```tsx
<TableCell className="text-right">
  {change ? <ProposedValue from="21.50 kg" to="22.00 kg" /> : "21.50 kg"}
</TableCell>
// A row that would be left out: <del className="text-muted-foreground">{name}</del> and a reason "Would be left out: …"
toast("Accepted 6 changes", { action: { label: "Undo", onClick: undo } })
```

`source="rule" | "model" | "person"` adds a small label after the new value (its mark, with `state`) when proposals from different sources mix
on one screen; leave it out when the bar already says who prepared them.

## Run log and walkthrough

```tsx
<AgentRun title="What the review did" producer={aiAvailable ? "AI (model name)" : "Rules (no AI key)"} steps={[
  { id: "read", label: "Read 13 rows from items_messy.csv", status: "done", input: "items_messy.csv", output: "8 columns" },
  { id: "flag", label: "Flagging rows that need a decision", status: "running" }]} />

<Button variant="outline" onClick={() => setTourOpen(true)}>Show me around</Button>
<Tour open={tourOpen} onOpenChange={setTourOpen} stepFooter={
  <TourFooter><div className="flex w-full items-center justify-between"><TourStepCounter />
    <div className="flex gap-2"><TourPrev /><TourNext /></div></div></TourFooter>}>
  <TourPortal><TourSpotlight /><TourSpotlightRing />
    <TourStep target="#import-steps" side="bottom" align="start"><TourArrow />
      <TourHeader><TourTitle>Four steps, nothing written until the last</TourTitle>
        <TourDescription>The sample file is loaded. You are on Review.</TourDescription></TourHeader><TourClose />
    </TourStep>
  </TourPortal>
</Tour>
```

- `AgentRun` is a log, not a chat: one line per tool call or rule pass, past tense when done.
- Target small elements: `#import-steps` is the `StepperList`, not the `Stepper`, which wraps every panel; a target
  taller than the screen pushes the step card off it.
- The tour opens from a button, never on load; three or four steps, each saying what to do. Escape closes it and
  returns focus to the button. A step card is 320px wide and fits a 390px phone under its target. `value` and
  `onValueChange` are the step index, so an onboarding checklist can open the tour at its step ("Show me").
- Container queries are built into Tailwind 4: `@container` on a wrapper, then `@max-[600px]:hidden` and
  `hidden @max-[600px]:block` to swap the table for a phone layout from the same rows.

## Data grid (tablecn), and when not to use it

Installed from the tablecn registry (`shadcn add https://tablecn.com/r/radix-vega/data-grid.json`, MIT) with the Dice
UI action bar, then fitted to this repo: grey regular headers without type icons, right-aligned numbers, search tints
from `--warning`, tabular figures, and Tab leaving the grid so the action bar can be reached.

Choose it when the person's job is editing many cells the way they would in a spreadsheet. Choose `ReviewRegion`
([the review region](review-table.md)) when the job is deciding flagged rows: it is a native table, and on a phone it becomes one
decision at a time by itself.
The grid scrolls sideways on a phone; `RowCards` (below) is the narrow layout for it. Cost when used: about 117 kB
gzip, so load the screen that holds it with `lazy(() => import(...))`. Unused, it adds nothing to the bundle.

Keep `columns` stable: made at module level, or a derived atom when they follow the page's state.

```tsx
const col = createColumnHelper<DataGridFeatures, Row>() // from "@tanstack/react-table"
const columns = col.columns([
  getDataGridSelectColumn<Row>(),
  col.accessor("name", { id: "name", header: "Name", meta: { label: "Name", variant: "text" },
    cell: ({ row }) => <span className="font-semibold">{row.original.name}</span> }),
  col.accessor("status", { id: "status", header: "Status", meta: { label: "Status" },
    cell: ({ row }) => <StatusPill tone={tone[row.original.status]}>{word[row.original.status]}</StatusPill> }),
  col.accessor("quantity", { id: "quantity", header: "Quantity", meta: { label: "Quantity", variant: "number" } }),
])
const { table, ...grid } = useDataGrid({ data, columns, getRowId: (r) => r.id, onDataChange: (next) => setRows(next),
  initialState: { columnPinning: { start: ["select", "name"], end: [] } }, enableSearch: true })
return <DataGrid {...grid} table={table} height={560} actionBar={<ReviewActions table={table} />} />
```

- `meta.variant` makes a column editable: `text`, `long-text`, `number`, `select` (with `meta.options`),
  `multi-select`, `boolean`, `date`, `url`. A column with no variant is read-only and shows its `cell`.
- **Local patch:** a column with a variant *and* a `cell` shows the `cell` until the person edits, then the editor.
  That is how a proposed value or a unit sits in an editable column.
- Keyboard: arrows move, Enter or F2 edits, Enter commits and moves down, Escape cancels, Ctrl or Cmd+F searches
  (`enableSearch`), Space on the first column selects the row. **Local patch:** Tab leaves the grid (upstream moved
  cell by cell, which kept the action bar out of reach). Say so in a `Kbd` hint under the grid.
- **Local patch:** typing on a focused cell opens its editor and the browser types that key into it, in a text,
  number, url or long-text column, with its own `cell` or without; upstream typed it with the deprecated
  `document.execCommand`, and its fallbacks stored 6 for a typed 56. The select, multi-select, date and file editors
  are as published: the select and multi-select drop the key that opens them.
- **Local patch:** no `try` statement, as everywhere in this repository (Benjamin, 2026-11-22). Where upstream has
  one, a callback's promise is read as a `Result` through `settle` in `data-grid-utils.ts` (an upload or a delete of
  files, a new row, a copy, a paste: a failure says the same words as before), the reason of a change is cleared with
  `Result.try` (`runWithReason` in `data-grid-features.ts`), and pasted JSON, a URL or a value JSON cannot write is
  read with `Option.liftThrowable`. The same in `data-table/format.ts` (`formatDate`), `file-upload.tsx` (an upload)
  and `stepper.tsx` (a step's check). Each is marked "Local change" where it is made; nothing on screen changed.
- **The grid's browser check:** `bun run --cwd apps/inventory grid:keys` types on those four editors, in both kinds
  of column, on the development page `/gallery/grid`, and reads what the grid stored: 56, -5, a space, a key then
  Escape, a key then undo, F2 then a key, each with no pause between keys and with 40 ms (96 cases). It fails on an
  error or warning in the page's console and when it finds no browser (`CHROME_PATH`). CI runs it after the full
  check; run it yourself after any change to the grid or a `shadcn add` of it. Measured in Chromium only. Not
  measured: Firefox, Safari, a touch keyboard, an input method, a production build of the grid.
- **As published, and not decided:** a space typed on a focused cell replaces a text cell's value with one no-break
  space and empties a number or url cell; Escape in the long-text editor keeps what was typed.
- Selection: `table.getSelectedRowModel().rows`, `table.getSelectedCells()` (a range of cells),
  `table.clearSelection()`. Re-render on change with `<Subscribe source={table.store} selector={(s) => s.rowSelection}>`
  from `@tanstack/react-table`. Write values with `table.updateCells([{ rowId, columnId, value }])`.
- Filters: pass the filtered array as `data` from the saved views ("All 30 / Needs attention 7"). The grid has its
  own filter and sort menus upstream (tablecn `data-grid-filter-menu`, `-sort-menu`); they were left out.

## Data table (tablecn), for a list the server pages

`packages/ui/src/components/data-table/` with `useDataTable` (`packages/ui/src/hooks/use-data-table.ts`) is the tablecn data table: a toolbar of
filters, sort menus in the headings, a column chooser and paging. Choose it for a list that can grow past what a
browser should hold (the Records page): the server sorts, filters and pages in SQL, and the table only shows a page.
Choose `RecordsTable` (`packages/ui/src/components/data-table/data-table-records.tsx`, a local addition) for a list the page
already holds (People, Activity, a result's rows, the columns to match): the same data table in client mode, with
sorting from the headings, a page at a time and cards on a phone. Choose `ReviewRegion` for rows to decide on. Every
table in the app is one of these three; nothing outside `@inventory/ui` draws a table of its own.

The pattern is tablecn's own, in three pieces (`packages/catalog/web/src/ItemsPage.screen.tsx` is the worked example):

```tsx
// 1. What can be sorted and filtered, and how the state reads in the address. A `variant` gives the column a filter.
const recordsTable = createDataTableConfig({
  columns: { name: { variant: "text" }, unit: { variant: "select" }, price: { variant: "number" }, date: {} },
  defaultSorting: [{ id: "code", desc: false }], enableGlobalFilter: true
})
// 2. The question for the server is an atom read from the address (`location` from `@inventory/ui/Route`), the same
//    address the table writes its state to; the page is a read whose question comes from it. Both at module level.
const recordsQuestion = Atom.map(location, ({ params }) => recordsTable.parse(params.toString()))
const recordsPage = catalogApi.query((api, get) => {
  const query = get(recordsQuestion)
  return api.items.page({ query: { page: query.page, perPage: query.perPage,
    sort: query.sorting, filters: query.filters, joinOperator: query.joinOperator, search: query.globalFilter } })
}, { reactivityKeys: catalogKeys.items })
// 3. In the screen: the read, and the table, told how many pages there are. `urlState` keeps page, order and filters
//    in the address. While the next page is fetched the read keeps the last one, marked waiting. The page is an
//    Option until the first one comes, and the table is handed it at the screen's last step: before then, `noPage`
//    (module level, `{ data: [], pageCount: 0 }`), never a `??` on each field.
const read = useAtomValue(recordsPage)
const page = O.match(AsyncResult.value(read), { onNone: () => noPage, onSome: identity })
const { table } = useDataTable({ data: page.data, columns, config: recordsTable,
  pageCount: page.pageCount, urlState: true, getRowId: (record) => record.id })
return (
  <DataTable table={table} stickyHeader>
    <DataTableToolbar table={table} quick={["unit"]} search={
        <TableSearch table={table}
          placeholder="Search records" working={read.waiting} maxLength={200} shortcutHint />}>
      <DataTableSortMenu table={table} align="end" />
      <DataTableFilterMenu table={table} align="end" />
    </DataTableToolbar>
  </DataTable>
)
```

- A table has one search box, at the left of its toolbar (`search`, a local addition; `TableSearch` in
  `@inventory/ui` is given the table: it shows the search the table holds, asks the table for the typed one after a
  300 ms pause, says it is working and empties with Escape). With it, the quick filters move to the
  right beside the menus. A search in one column is a text filter in the Filter menu, not a second box.
- The toolbar holds the few filters used all day (`quick`, a local addition: left out, every filterable column gets
  a control). `DataTableFilterMenu` reaches every filterable column with every comparison ("contains", "is not",
  "is between", "is empty") and joins them with "and" or "or"; `DataTableSortMenu` sorts by several columns in an
  order the person can drag. Both write the same state as the toolbar and the headings, so they can be mixed.

- The server's half is `packages/catalog/contract/src/Item/ItemQuery.payload.ts` (the query as a Schema), `GET /api/v1/records/page` and
  `packages/catalog/host/src/ItemStore.adapter.ts`:
  a column id becomes a column name only through a fixed table and every value is a bound parameter. Copy that file
  for another list; do not build SQL from a column id the browser sent.
- Options for a `select` filter and the range for a `number` filter come from a second, small request (`GET
  /api/v1/records/facets`: units in use with counts, lowest and highest quantity and price), put on the column's `meta`.
- **Added from the registry by hand**, not with `shadcn add` (it wanted to overwrite `button`, `popover`, `select`
  and write second copies of the kit's `lib` files): `data-table-filter-menu.tsx`, `data-table-range-filter.tsx`,
  `data-table-sort-menu.tsx`, `id.ts` and `ui/sortable.tsx` (the registry item's advanced toolbar was left out:
  the menus sit in the ordinary toolbar), with the same two
  rewrites the rest of the kit had (import paths; the registry's icon placeholder to a lucide icon). `sortable.tsx`
  needs `@dnd-kit/core`, `modifiers`, `sortable` and `utilities`; it passes five optional props only when they have
  a value, for this repo's exact optional properties. Yes/no filters say "Yes" and "No", not "True" and "False".
- **Local changes.** A heading that is a sort menu fills its cell (`data-table.tsx`), and the paging row does not say "0
  rows selected" for a table with `enableRowSelection: false`. A typed filter value (text, number, range) waits 300 ms
  for the next keystroke before `useDataTable` writes it (the field shows the draft meanwhile), as upstream's
  `debounceMs`; a choice from a list is written at once, and a change of page writes a waiting value first. In the
  filter menu the value box is keyed by its column, so choosing another field empties it. On a phone the toolbar's
  search boxes fill the row and the paging is one row, with the page size's label for a screen reader only. The
  stepper's line between two steps is never narrower than 12 px. Upstream keeps the table's state in the address with
  nuqs. Here `data-table-state.ts` does it through the app's own router when `urlState` is set, and in atoms of the
  table's own otherwise (the review's table, which sits inside a step). `DataTableConfigOptions.id` takes `undefined`, for this
  repo's exact optional properties.
- On a page as narrow as a phone, show the same page of rows as cards (`DataTableCards`, a local addition built on the
  same table instance) between the toolbar and `DataTablePagination`: a table wider than the screen fails the phone
  standard. `DataTable` takes `empty` (what an empty body says) and `withPagination` as local changes.

- **The table assistant** (`packages/catalog/web/src/TableAssistant.screen.tsx`, `Conversation.machine.ts`, `internal/view.ts`): a sparkle button in the
  toolbar opens a panel where a person types what they want to see ("sort by quantity descending and only
  Kilogram"); the answer is a change to the table's own sort, filters, search and columns, listed one by one, each
  removable, each request undoable. The page hands it a catalog of its columns (`recordsCatalog` in
  `ItemsPage.tsx`); the server checks every answer against that catalog (`checkCommand` in `packages/catalog/model/src/Assistant/TableView.rules.ts`).
  With no key the fixed rules answer "find", "sort by", "hide", "show", "only" and "clear" and the panel says so; a
  model's call comes from the day's allowance (`ModelAllowanceGateway`, `@inventory/usage-contract/ModelAllowance`), and once that is used up the rules answer
  and the panel says why.

## Point and ask, proposals, undo

```tsx
<ActionBar data-grid-popover="" open={rows.length > 0} onOpenChange={(open) => { if (!open) table.clearSelection() }}>
  <ActionBarSelection>{rows.length} rows<ActionBarSeparator /><ActionBarClose aria-label="Clear selection"><XIcon /></ActionBarClose></ActionBarSelection>
  <ActionBarSeparator />
  <ActionBarGroup>
    <ActionBarItem onSelect={(e) => { e.preventDefault(); leaveOut(rows) }}>Leave out</ActionBarItem>
  </ActionBarGroup>
</ActionBar>
```

`e.preventDefault()` keeps the selection (and the bar) open while the action's answer shows. Put that answer in a
`role="status"` line above the grid that names the lines it is about. A suggested change is data, not an edit:
render it with `<ProposedValue from="21.50 m" to="22.00 m" source="rule" state="proposed" />` in the column's `cell`,
offer Accept all, Step through and Dismiss in the title row, and confirm with
`toast("Accepted 12 changes", { action: { label: "Undo", onClick: restore } })`. Without a key, the same proposals
come from rules and say `rule`; the model's say `AI`.

### Cards from the same table, for a phone

```tsx
{useAtomValue(isNarrow) ? <RowCards table={table} titleColumnId="name" /> : <DataGrid {...grid} table={table} />}
```

- `RowCards` is for the data grid only; a review built on `ReviewRegion` needs nothing extra on a phone.
- `RowCards` reuses the grid's `table`: the same `cell` renderers, selection and action bar. It leaves out empty
  values and shows 50 rows at a time. On a phone, open with "Needs attention" and keep the bar's buttons short.

## Saved progress: a refresh loses nothing

`useSavedProgress(scope, browserRuntime)` keeps in this browser what a refresh must bring back and the server does not keep: the
chosen file until the server has all of it (a Blob in IndexedDB, read again by the worker on "Continue"), and the
review's undo history beside the decisions (localStorage, written before the next frame). The decisions themselves
and the step are on the server and in the address. The scope is the acting member, organization and screen, from the
session, never from the address: another member, or the same person in another organization, never sees it.

- **The upload step** (`packages/catalog/web/src/UploadStep.screen.tsx`) keeps the chosen file until the server has it; after a reload
  or a closed tab it offers "Continue", which reads the same file again; once an import of that file exists it is not
  offered. A save that failed on the network keeps the file, so Continue is there.
- **The review step** (`packages/catalog/web/src/ReviewStep.screen.tsx`) keeps the undo and redo history per import, used only while it
  ends at the decisions the server holds (`toDraft` and `fromDraft` of the region). Confirm clears it.
- A draft that no longer decodes (an older version) is dropped, never shown half. When the browser refuses to store (a
  private window), `progress.refused` turns true: say so once with `sayError({ _tag: "FileNotKept" })`.
- Not restored after a refresh: the review's filter and which kinds were folded.

## Reading and writing: the cache, the buttons, the errors

The Records page and its editor (`packages/catalog/web/src/ItemsPage.screen.tsx`, `ItemEditor.tsx`) are the worked example of a
screen that reads and writes; the People page's role change is a second one.

```tsx
// At module level: the read shown through an item's edit, and the edit itself.
const recordsShown = shown(recordsPage)
const saveRecord = optimisticWrite({
  send: (edit: RecordEdit) => catalogApi.send((api) => api.items.edit({ params: { id: edit.id }, payload: edit })),
  // The row shows the new values at once; a refusal takes them back and offers "Edit again".
  changes: [optimisticChange(recordsShown, (page, edit: RecordEdit) => withEdit(page, edit))],
  failed: () => "Not saved."
})
// In the screen:
const page = resultOf(useAtomValue(recordsShown))
const saving = useAtomValue(saveRecord).waiting
const save = useAtomSet(saveRecord)
<Button type="submit" disabled={saving}>{saving ? "Saving" : "Save"}</Button>
```

- **A read** (`makeApiAtoms(tag).query` in `@inventory/client/Api`) is an atom made once at module level. What it
  answered is kept for five minutes after the last screen stops reading it (`keepUnwatched`), so a screen change or a
  remount shows it at once and asks again behind it; one more try only for a failure that may pass (`isTransient`: the
  network, a server error, "too many requests"), never for a refusal. A read is kept per member and organization, so
  nothing of the last organization shows even for a moment; the session is asked once, never again on its own.
- **A write** says exactly what it changed, with the keys named in the package's `*.keys.ts` (`catalogKeys.items`, the
  import's view, `catalogKeys.activity` for its audit line), never everything: `reactivityKeys` on the write, or
  `invalidate(keys)`. Its button is disabled while the request is out. A write whose outcome the screen can show
  before the server answers is optimistic (`optimisticWrite` from `@inventory/client/OptimisticAtoms`); one only the
  server knows (a confirm, a take-back, adding a person by email) is `ask` and shows its progress instead. A write is
  sent again only by `send` and `write`, and only for a failure that may pass.
- **Every problem of a form at once**: run every field's check (`readRecordForm` in `packages/catalog/contract/src/Item/Item.read.ts`, or
  `formProblems` from `lib/form.ts`), show each under its field with `FieldError`, and send nothing while one is
  open. In the record editor an empty Name and a price with three decimals are both named after one press.
- **A failure in words**: `sayError(error)` gives `{ title, sentence, problems }` for any failure the browser can
  meet (a typed API error, a refused request with every field named, the network, a server error, an answer that
  could not be read, a file's problem). The screen shows those; the raw failure goes to the console once. A
  model's trouble is one of five sentences (`modelSentences`, the contract's in `packages/catalog/contract/src/Answer/AiUnavailable.rejection.ts`, which
  the server words `AiUnavailable` with too: no key, a key refused or out of credit, busy, a bad answer, not
  answering), and
  `answeredByLine(answeredBy)` says which path answered ("Answered by the rules: …").
- **Loading, empty, error, data**: a skeleton in the real boxes while it loads (`@inventory/ui/Skeletons` (`packages/ui/src/Skeletons.component.tsx`): the page
  header, a table's frame and header with 36px rows, the review's bands, the upload), a sentence and what to do when
  empty, `sayError` with "Try again" (disabled while it refetches) on error.

## Tables

Every table is one of three: tablecn's `DataTable` paged by the server (the Records page), `RecordsTable` for a list
the page already holds (People, a result's rows, the parent table of records with a parent), or the `ReviewRegion`
(rows to decide on; `embedded` beside a parent table, [the review region](review-table.md)). The lint refuses a
hand-rolled `table`, `tr` or `td` outside `@inventory/ui`. Each page is its own chunk (`Workspace.tsx`), so the
table code loads with the first page that has one.

## Effect DevTools (development only)

The browser's runtime can send its spans (each API call, each file read, each saved file) to the Effect DevTools
editor extension.

1. Install the Effect DevTools editor extension (the Effect extension for VS Code, `effectful-tech.effect-vscode`)
   and start its DevTools server from its panel: it listens on `ws://localhost:34437`.
2. Start the app with it switched on: `VITE_EFFECT_DEVTOOLS=true bun run dev` (or put `VITE_EFFECT_DEVTOOLS=true`
   in `.env.local`). `VITE_EFFECT_DEVTOOLS_URL` points it at another address.
3. Use the app: the spans appear in the extension's tracer as they finish.

- **Off unless switched on.** The browser prints an error for every refused WebSocket and the client tries again
  every second, so with nothing listening it would print one a second. Measured in headless Chrome: switched off, no
  connection is tried and the console stays empty; switched on with a listener, it connected once and sent the
  spans `upload.read` and `savedProgress.saveFile` (a stand-in listener counted them; not checked against the
  extension itself); switched on with nothing listening, 7 console errors in about six seconds and the first read
  started about a second late.
- **Never in production**: `devToolsLayer` is `Layer.empty` unless `import.meta.env.DEV`, so the build drops it.
  Checked by building with `VITE_EFFECT_DEVTOOLS=true` and searching every built asset for `34437`,
  `DevToolsClient` and `MetricsSnapshot`: none.
- One runtime has it: `appRuntime` in `lib/api.ts` merges the API client and `devToolsLayer`, and `browserRuntime`
  (`lib/runtime.ts`) is that same runtime, so the tab has one connection. Never build a second runtime with it.
- **The Worker's spans too**: put `EFFECT_DEVTOOLS_URL=ws://localhost:34437` in `.dev.vars` and restart `bun run dev`.
  Each request builds its own client and sends its spans after the answer (`src/server/RequestTelemetry.ts`); with
  nothing listening, one request waits up to a second and the next thirty seconds skip it. A production build has
  none of it.

## Finding and adding a component

Before building a component by hand, look for it in a registry. The agent has the shadcn MCP server and shadcn's own
`shadcn` skill (`.agents/skills/shadcn/`) for this.

| Registry | What is in it | Name an item as |
| --- | --- | --- |
| `@shadcn` | shadcn/ui: components, blocks and examples. Built in | `@shadcn/combobox` |
| `@diceui` | Dice UI, 267 items: stepper, file upload, tour, action bar, data table and more (`components.json`) | `@diceui/data-table` |
| `@tablecn` | tablecn, 15 items: the data grid this starter uses, its columns and menus, the data table (`components.json`) | `@tablecn/data-grid` |

**Look it up.** The MCP tools search (`search_items_in_registries`), show an item's files and dependencies
(`view_items_in_registries`), find demo code (`get_item_examples_from_registries`) and give the add command
(`get_add_command_for_items`). They only read; nothing is written until someone runs the add command. The search is
fuzzy and can miss an exact name ("data table" finds only `@diceui/data-table-demo`), so view a name you already know.
Without the server, the CLI does the same: `bunx shadcn@latest search @diceui -q "data table"`,
`bunx shadcn@latest view @diceui/data-table`, `bunx shadcn@latest docs table`.

**Add it.**

```sh
bunx shadcn@latest add @diceui/data-table --cwd packages/ui --dry-run   # each file: created, skipped or overwritten
yes n | bunx shadcn@latest add @diceui/data-table --cwd packages/ui     # answers "no" to every "overwrite?"
bun install --lockfile-only                                 # the CLI ran npm install; bring bun.lock along
bun run check
```

- **Make it readonly and dual as it comes in.** The components and hooks under `packages/ui` are held to the
  repository's bans like our own code (Benjamin, 2026-11-23: "Hold them to the rules"): `bun run check` refuses a
  property that is not `readonly`, a helper that names its subject and is not `dual`, a type assertion, a Promise and
  an `@effect-diagnostics` comment. A component already there is held at the number of places its ledger records
  (`packages/tooling/tool/cli/ledgers/`), which only falls as it is cleaned; a fresh one has no line in any ledger,
  so write `readonly` on its props and types and fix the rest before `bun run check` passes. Never add it to a ledger.
- **Never `--overwrite`.** The starter's components were changed after installing (the table grid, the data grid,
  the stepper); an overwrite puts the upstream version back without saying so. `yes n |` keeps them.
- **The kit files moved to atoms** no longer match their registry (goals/atoms, "The kit on atoms"): their state is
  in atoms, not React's hooks, and each says so on its first line. `shadcn add` over one of them is a merge by hand,
  never `--overwrite`: take upstream's change into the file as it is here, and keep it on atoms
  (`packages/ui/.oxlintrc.kit.json` reads these files and refuses an effect hook or a state hook). Moved so far
  (batch 1, the data table), all under `packages/ui/src/`:
  - `hooks/use-data-table.ts`, `hooks/use-debounced-callback.ts`
  - `components/data-table/`: `data-table-state.ts`, `data-table-records.tsx`, `data-table-toolbar.tsx`,
    `data-table-view-options.tsx`, `data-table-sort-menu.tsx`, `data-table-filter-menu.tsx`,
    `data-table-slider-filter.tsx`, `data-table-range-filter.tsx`, `data-table-date-filter.tsx`
  - `components/faceted.tsx`, `components/sortable.tsx`, `components/calendar.tsx`, `components/slider.tsx`
- **`bunx`, not `npx`, for `add`.** Under `npx` the CLI's own `npm install` stopped with `EALLOWSCRIPTS` (npm 11
  refuses an `allow-scripts` setting handed down as an environment variable). `bunx` without `--bun` still runs the
  CLI on Node. The CLI installs with npm here, so
  `package-lock.json` is updated and `bun.lock` is not until the line above.
- **Add into `@inventory/ui`.** Run the CLI in `packages/ui` (`--cwd packages/ui`); its `components.json` writes to
  `src/components/` and `src/hooks/` with `@inventory/ui/components/...` imports. Give each new file its exact entry in
  `packages/ui/package.json` (`beep-cli laws exports` in the package's `check` names a missing one). There is no
  `@/lib/utils` here: `import { cn } from "cn"`.
- **A new dependency is a decision.** An item that brings a second schema library or a second state model (the Dice UI
  data table brings `zod` and `nuqs`) is written down with its cost, or is not added.

**How the server is set up.** Claude Code starts it from `.mcp.json`; `.claude/settings.json` enables it and allows its
tools, so there is no prompt once the folder is trusted. `claude mcp list` (or `/mcp`) shows it as connected. Codex
reads `.codex/config.toml` once it trusts the folder. Where it does not, the same three lines go in
`~/.codex/config.toml`:

```toml
[mcp_servers.shadcn]
command = "bunx"
args = ["shadcn@4.23.0", "mcp"]
```

The version is pinned, so `bunx` starts the server from bun's cache once it has fetched it: 0.5 s to answer
`tools/list`, with or without a network (measured with the network cut off). An unpinned `shadcn@latest` asks the
registry first on every start. To update, change the version in `.mcp.json` and `.codex/config.toml` together.

## The browser for QA

The main agent looks at the app in a headless browser (`CLAUDE.md` "Look at it"), and the `qa` agent tests in one
of its own, so one never waits for the other: both are the Playwright MCP server (`@playwright/mcp`). The main
agent's is set up beside the shadcn server in `.mcp.json`, `.claude/settings.json` (enabled, tools allowed) and
`.codex/config.toml`; `qa`'s, named `playwright-qa`, is declared in the header of `.claude/agents/qa.md` and starts
with that agent (its tools `mcp__playwright-qa__*`, allowed in `.claude/settings.json`). Each drives the Google Chrome
already installed, headless, in a fresh profile of its own (`--isolated`), with a 1440 × 900 window. So no agent
shares Chrome, its tabs or its sign-ins with the person or with each other. Where an agent
program does not start `qa`'s own server (Codex, a folder Claude Code does not trust), `qa` uses the main one and
says so first, and the main agent does not look while it runs. Page snapshots go to `.scratch/playwright/` (the main
browser) and `.scratch/playwright-qa/` (`qa`'s), screenshots to `.scratch/shots/`, all git-ignored. These folders are
relative to the folder the server started in: a side session in a git worktree that should keep its files there
starts in that worktree, not in the main checkout.

**A production build** (`bun run preview`) opens on the sign-in page and offers no test accounts, as a deployed copy
does. Its local database has the test accounts all the same (migrate applies `seeds/accounts.sql`): sign in
with the first one's email and the test password (`README.md` lists them all). The dev server opens signed in.

It is pinned (`0.0.85`) and started through `bunx` from bun's cache like the shadcn server: 0.2 to 0.4 s to answer
`tools/list`, also with the network cut off.
It downloads no browser. Without Google Chrome it cannot start, and the `qa` agent then says so and stops: the Claude
in Chrome tools are never used for testing. To update, change the version in `.mcp.json` and `.codex/config.toml`
together.

## The two design lints

Both run in `bun run check`, both report every finding before the check fails, and both name the fix in the message.
Fix in the code or in the theme (`packages/ui/src/theme.css`). No disable comments, no allow-lists.

```sh
bun run lint:shadcn                                                                          # the design-system lint
bunx oxlint --disable-nested-config --deny-warnings -c ../../.oxlintrc.shadcn.json src/web/pages   # it, on one folder (from apps/inventory)
bunx oxlint --quiet src/web/pages                                                            # hand-rolled elements, one folder
```

**Design-system lint** (`@shadcn/lint` 0.2.5 in the root `.oxlintrc.shadcn.json`, run by the app, `@inventory/ui` and `@inventory/review`; every rule an error):

| Rule | What it catches | Fix |
| --- | --- | --- |
| `no-raw-colors` | A palette colour (`bg-zinc-100`, `text-red-500`, `fill="#fff"`) | The token for that meaning (`bg-muted`, `text-destructive`, `bg-success text-success-foreground`); a new meaning gets a token in `packages/ui/src/theme.css` |
| `no-arbitrary-values` | A bracket value (`p-[3px]`, `rounded-[4px]`, `grid-cols-[auto_1fr]`) | The scale step the message names (`p-0.75`), else a token in `@theme` and its utility (`rounded-chip`, `grid-cols-label-value`) |
| `no-restyle` | A non-layout class on a `ui` component (`<Button className="px-2">`, `<TableCell className="font-medium">`) | A variant, size or prop; else move the class to a plain child or wrapper element. Layout (margin, width, flex, position, `hidden`, `text-right`) is allowed |
| `no-inline-styles` | `style={{ ... }}` | Classes; a dynamic value goes in a CSS variable on `style`, read by a class (`w-(--bar)`) |
| `require-static-classes` | A class on a `ui` component that cannot be read statically (`` `bg-${tone}` ``) | The component's variant prop, or a constant in the same file |
| `no-unknown-classes` | A class Tailwind cannot generate (a typo, `origin-top-center`) | Fix the spelling, delete it, or declare it with `@utility` in `packages/ui/src/theme.css` |

String maps count too (`scanAllStrings`): `const tones = { bad: "bg-red-100" }` fails like a `className`. Inside
`packages/ui/src/components` (`@inventory/ui`) the components own their look, so `no-restyle`, `require-static-classes`,
`no-arbitrary-values` and `no-inline-styles` are off there; raw colours and unknown classes still fail.

**Hand-rolled elements** (`react/forbid-elements` in the root `.oxlintrc.web.json`, which each package's `.oxlintrc.json` extends, outside `packages/ui/src/components` (`@inventory/ui`)): `button`
-> `Button`; `input` -> `Input` (`Checkbox`, `RadioGroup`, `Switch`, `Slider`, `FileUpload` by type); `select` ->
`NativeSelect` or `Select`; `textarea` -> `Textarea`; `label` -> `Label`, or `Field` and `FieldLabel`; `table`,
`thead`, `tbody`, `tfoot`, `tr`, `th`, `td`, `caption` -> `Table` and its parts; `hr` -> `Separator`; `progress` ->
`Progress`; `dialog` -> `Dialog`, `AlertDialog` or `Sheet`; `details` -> `Collapsible` or `Accordion`; `fieldset`
-> `FieldSet`; `kbd` -> `Kbd`. Nothing fits? Look one up first ("Finding and adding a component" above).

Starter patches that make the conventions pass: `data-sticky="end"` on a `TableHead` and its `TableCell`s keeps a
row-actions column in reach (`table.tsx`); a ghost `Button` with `aria-pressed` draws the selected saved view
(`button.tsx`); `rounded-chip`, `grid-cols-label-value`, `grid-cols-field-value` and `cv-auto` are theme tokens in
`packages/ui/src/theme.css`; `packages/ui/src/utilities.css` holds the `scroll-fade` and `shimmer` utilities the chat
components use.
