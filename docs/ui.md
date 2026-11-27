---
type: Standard
title: "UI"
description: "The house style for screens of dense business tables: components, colour, type, buttons, tables, numbers, missing values, status words, the import's steps, layout by room, state as atoms, and writing for the person."
---

# UI

Moved here from `CLAUDE.md` word for word on 2026-11-26 (goals/focus-and-friction, step 4); `CLAUDE.md` keeps a line that links each section.

## UI

The house style for screens of dense business tables: quiet chrome, a hairline grid, numbers that line up, and colour
only where it means something.

- Components are in `packages/ui/src/components` (`@inventory/ui`) (shadcn, all installed). Compose them. Do not add another UI library.
  `bun run check` holds this: a raw `button`, `input`, `select`, `textarea`, `label` or table outside `ui/` fails, and so
  does a colour, size or restyle that does not come from the theme (`docs/kit.md`, "The two design lints").
- Colour comes from tokens in `packages/ui/src/theme.css` (`bg-background`, `text-muted-foreground`, `bg-success
  text-success-foreground`, and so on). No hex values, no Tailwind palette colours like `text-red-500`. Both themes
  must work. Colour carries meaning only: status, errors, negatives. The filled button, the mark and the focus ring
  are the brand's forest green; ticks, links and progress are ink. Nothing decorative: no glow, gradient or
  decorative colour.
- **Type** is IBM Plex Sans for text, names, quantities and money. Codes are set in a monospace face (JetBrains Mono)
  whose 0 and O, and 1, l and I, cannot be confused, and numbers keep plain figures that line up.
- **Red text is `text-destructive`.** `bg-danger text-danger-foreground` is the tinted pair for chips and cells;
  `text-danger` alone is the pale tint and unreadable as text.
- **One filled primary button per surface**, last in the top-right action group. Other actions are outline or ghost.
- **Tables** are the main surface: the workspace's frame already gives every page the full width (`Workspace.tsx`
  passes `fill` to `AppShell`), no card around the table, about 36px rows, no zebra, the record's name first in
  semibold. `Table` already draws the grid (hairline row and column lines, a 36px
  header row with grey labels): do not restyle `TableHead`.
- **Numbers** are right-aligned (tables set tabular figures; a total outside a table takes `tabular-nums`). Quantities
  carry their unit ("250.00 kg"), money is "$874.07", negatives are red, thousands separators via `Intl.NumberFormat`.
- **Missing values**: a missing required value is a red-tinted cell with the reason. A missing optional value is
  "Not set" in muted text. Never show "null", "N/A" or "-".
- **Status** is words plus colour, never colour alone: `StatusPill`, mapped once: Ready `info`, Needs a decision
  `warning`, Cannot import `danger`, Imported `success`, Already there `neutral`, Draft `outline`. The words are each set once: the review region's defaults (Needs you, Can't fix
  here, Ready, Left out, All, Already there, …) in `defaultReviewWords` (`packages/review/src/ReviewWords.words.ts`), passed as
  `words` on the region, and the import's (Created, Already there, Not imported, Taken back, All) in `importWords`
  (`packages/catalog/web/src/internal/format.tsx`): change them there, and nowhere else.
- **An import reads as steps**, and the app's already does (`packages/catalog/web/src/ImportPage.screen.tsx`): Upload, Match (our field
  on the left, the file's column on the right, required fields marked; headers are matched by name, ignoring case,
  spaces and punctuation, and the step opens by itself only when a required field found no column; Review waits
  until every required field has a column and names the ones left), Review (the views "Needs you N · Can't fix here
  N (when there are any) · Ready N · All N"), Confirm, a result with counts. Say the duplicate policy before the
  person commits.
- **AI output is a proposal.** It lands as Draft or Needs a decision, shows its reason, and the person confirms it.
  Show what the model did as past-tense lines ("Mapped 12 columns", "Flagged 3 rows").
- Every async view has four states: loading (skeleton), empty (what to do next), error (what happened and what to
  try), and data. Skeletons in the real boxes are in `@inventory/ui/Skeletons` (`packages/ui/src/Skeletons.component.tsx`).
- **Codes in `font-mono`**: a record's code, a SKU, a part number, a barcode, a lot or serial, a document number,
  anything a person compares character by character, wherever a table or card shows it. In `ReviewRegion` that is
  `code: true` on the column; elsewhere wrap the value in `Code`. Names, descriptions, quantities and money stay in the text face.
- shadcn's `TableCell` does not wrap. A column of sentences (a reason) takes `whitespace-normal min-w-72 max-w-md`
  and sits before the number columns; row buttons stay in reach with `data-sticky="end"` on the cell and its header
  (`table.tsx` draws the sticky edge; a collapsed table border does not stick). A plain helper is never named
  `useSomething`: the linter reads it as a hook.
- **The shell names the job**: `AppShell` `title` (in `App.tsx` and `Workspace.tsx`) and `<title>` in `index.html`.
  **The `h1` is the job** ("Review records"); the file name, row count and duplicate
  rule go in the grey line under it.
- **Title row**: `PageHeader` (`flex flex-wrap justify-between gap-4`, title block `min-w-0 flex-1 basis-60`, actions
  `flex flex-wrap gap-2`).
- **Decide a layout from the room the page has**, not the window: the atoms `isNarrow` and `contentBelow(px)` from
  `@inventory/ui/ContentWidth` (read with `useAtomValue`) already subtract the sidebar. A `md:` class or
  `useIsMobile()` in a page is wrong on a tablet with the sidebar open.
- **State is atoms** (`effect/reactivity`, read with `@effect/atom-react`; goals/atoms). A value a screen holds is
  `Atom.make`; one worked out from others is `Atom.readable` or `Atom.map`; state that belongs to one component on
  screen is a `ScopedAtom`; something outside (the window, a table's own store) is followed by an atom that
  subscribes and cleans up with `get.addFinalizer`; a value followed after the draw is `useAtomSubscribe` with one
  function for the component's life. `bun run check` refuses `useState`, `useReducer`, `useMemo`, `useCallback`,
  `useContext` and every effect hook in our own code, with no exception for effects, and refuses a `ref` that is not
  a DOM ref or a callback that stays the same across draws (`refs:check`). `useRef` is for a DOM node only. The
  vendored kit (`packages/ui/src/components`, `packages/ui/src/hooks`) keeps its own.
- **Saved views** ("All 30", "Needs attention 7") are ghost `Button size="sm"` with `aria-pressed`; the button draws the
  selected one (`bg-muted`), so pass no class for it.
- **Columns**: name, Status, Reason, then the file's columns, then Line. Reason text is ink; grey is for "Not set".
- **Counts mean what they sit on.** A total adds only like with like: money per currency, a quantity of one item in
  one unit, never quantities of different items ("138 each" of jars and labels). A tab's count is the rows its list
  shows, and a number shown in two places is the same in both.
- **A filter with no rows keeps the table**: its header and one `colSpan` row with a sentence and a link back to All.
- Write for the person doing the job: plain verbs, their nouns, no developer words. Say what will happen before a
  button does something that cannot be undone.
- Keyboard works, focus is visible, inputs have labels. Before building a screen with controls or a table, read
  `docs/patterns.md` section 8: nine rules, each from a point a real review screen lost in an audit. Before one that
  shows quantities, units or money, read `docs/glossary.md`: the trade words, each with the mistake an import makes.
- Benjamin points at UI with React Grab (dev only): a pasted block naming a component and file is him showing you
  exactly which element he means. Change that element, not one that looks similar.
