# Decisions

## What I was asked to build

An operations admin at a warehouse loads inventory items in bulk from a file and must "trust what got in and what
didn't": a messy file in, what is wrong fixed in the app, a clear account of the result.

## Where it stands

- **Works, and I checked it** (in a browser, on a frozen production build): `items_messy.csv` reads as 200 rows:
  155 Ready, 24 Needs a decision, 21 Cannot import, 20 values in 17 rows fixed for you. Confirm stored 155; the
  result said 155 imported, 45 not imported; Items showed 155. With row 91's dimensions fixed in the form: 156, 44,
  156. `items_clean.csv`: 25 Ready, 25 imported, 25 stored; loaded again it adds nothing and says so.
- **Works by test, seen in part:** a second import (155 Already there; rows 148, 195 wait); a take-back naming every
  item removed; the item editor refusing a discontinued yet active item.
- **Known wrong or missing:**
  - A discontinued yet active row offers one answer, "Not active"; clearing the date means typing in its cell.
  - A name suggested by the model shows no source, "Why?" or reject (a category does); a weak model suggestion is
    still the row's one-press answer.
  - The vendors form opens empty for a cut-off cell; the vendors question shows the cell's raw text.
  - On a phone the last two views sit past the edge. A reason in the review is cut to one line, whole on hover.
  - A past import is reached from Activity only when it changed a value; the clean file's has no link.
  - A .txt file chosen by mistake gets no message. Quantities in the review have no unit and show no default.
  - Activity and People are not on the data table.
- **Not verified on the last version:** read on it: the messy file to Confirm, the clean file (Items 155 to 180),
  the link from Activity, the drop message. Read one to four versions earlier: answers, undo, refresh, the
  dimension form, take-back, the second load. Read by the browser tester one version earlier: "Reject this
  proposal", "Undo this fix", the vendors form, scrollbars in both themes, the review and Items at tablet and phone
  widths. Seen by nobody: the review's filter and column menus, the Items filters for active and lot tracked, Upload
  and Result at tablet and phone widths, the rendered diagrams. The model help made one real call that I saw
  ("Suggested 2 names. Suggested 2 categories."); its quality on other files and its cost are not measured.
- **Where my agent was wrong:** its profile missed rows 92 and 103 ("2024-13-01"), caught by the rules on the real
  file. It counted a stored SKU that could not be read yet as "Already there", caught by the code review. A group
  button named one value for rows that got different ones, caught by the browser pass. All three are fixed.
- **Checks:** `bun run check` before commits; `npm run check:full` in each checkpoint's clean copy, passing at the
  last. Commit `81daa36` was made while the check failed on unfinished work not in the commit.

## What the data does

`items_messy.csv`: 200 items and one empty row, 16 shuffled columns under other headings, plus "Internal Notes",
no field of an item. Rows count the heading as row 1. Outcomes: **Ready**, **Needs a decision**, **Cannot import**.

| Kind of row | Rows | What the app does | Why |
| --- | --- | --- | --- |
| Form only: spaces, "bx", "$26.41", yes/Y/1, "Jun 19, 2024", "Metal\|metal\| METAL", "Packaging" | 17 | Fixed for you, listed, undoable | "Fix what's safely fixable automatically, and show them what changed" |
| A reading the file supports: "35,82", "1,200", "Component", "Finished Good", a lower-case SKU | 9 | A proposal with evidence | my inference, so it waits |
| Two readings: "03/04/2024", discontinued yet active, lot tracked "maybe", two preferred vendors | 8 | A question, nothing preselected | "Calendar date"; "If set, is_active must be false"; "At most one vendor" |
| The same SKU on two rows | 6 pairs | Side by side: keep one, or type a SKU | "Unique across the file and existing records" |
| Needs a value: empty SKU or name, "ab-12", "Misc", "TBD", a cost below zero, quantity 12.5, "2024-13-01", no height, vendors cut off | 21 | Cannot import until typed, picked or fixed | "required"; "0 or more"; "integer"; "all three measurements together" |
| Empty quantity, active, lot tracked | 36 and more | Ready, the default used | "Defaults to 0", "to true", "to false" |

Nothing is written before Confirm, and the server runs the same review again at Confirm.

## What I chose to build, and why

The item import first, then "Why?" on every proposal, a form for vendors and dimensions, one model feature last.
The starter's example record became the item with its 15 fields; no screen was deleted. In "Who decided", "same"
means I chose and the agent recommended the same.

| Decision | Options (recommended first) | Who decided | Evidence |
| --- | --- | --- | --- |
| The plan | Ambitious, model last; Balanced; Safe | same | the starter already imports a file |
| Sure fixes | Applied, listed, undoable; one click for all; one per kind | same | 17 rows; the brief's words |
| Confidence | High: form only, applied. Medium: proposed with counts. Low: asked | same | 9 Medium rows, e.g. row 55 |
| A stored item that differs on a second import | Ask per row; keep; update | same: "nothing stored changes without them" | "existing records" |
| A date that reads two ways | One proposal per column; ask every row | same | 3 rows; none decides, so each asks |
| The same SKU twice in a file | A question, side by side; two items; neither | same | 6 pairs |
| "Why?" card | Kept, on every proposal, a word and its evidence, with Reject | I chose: "Keep it, style as hover card", "Every proposal", "A word and its evidence", "Reject this proposal" | opens by hover, click, keyboard |
| Model help or the "Why flagged?" panel | Model help; the panel; both | same | both did not fit |
| "Internal Notes" | Left out, and said; flag the 20 rows | same | 20 rows; no such field |
| Filters on Items, Activity, People | Items only; all three | same | the other two are on a simpler table |
| Review's filter and column menus; scrollbars; the problems strip; messages | the table's menus; thin; one line of pills; top centre | Mine, in my words: "canonical filters dropdown form the datatable", "less 'thiccc' ... scroll bars", "scroll more naturally", "blocks page navigation controls" | seen on screen |
| A stored SKU on a row that cannot be read yet | It waits; already there | the agent's default; I was told | rows 148, 195 |
| A two-digit year; a cost below zero; quantity 12.5 | Typed by the person; proposed | the agent's default; I was told | "0 or more", "integer" |
| Discontinued yet active | Both readings; one | the agent's default was both; one is built | rows 45, 164 |
| "2024-13-01" | Cannot import until fixed; import without the date | same | rows 92, 103 |
| Take-back after a replace | Leave it, and say so; restore | same | no sample row |
| A rejected proposal | It leaves the row; stays, marked rejected | the agent's default; I was told | Ctrl+Z brings it back |
| Into the last version | A past import found again; the drop indication | Mine, in my words: "Find a past import again, Drop indication on Upload" | both seen on it |

**Reference ledger.** My own app stockroom (MIT): `src/domain/Prep.ts`, functions taken and rewritten (`inspect`,
the guard); `src/domain/ItemImport.ts`, the stored-suggestion shape and its proposal branch; `src/server/Prep.ts`,
the pattern only. Nothing was copied from anyone else's repository.

## How ambitious I was, and where I played safe

The reach is the model help: a model may suggest a name from the description or a category for "Misc", capped at
Medium by rules, never rating itself, accepted like any proposal. With no key the rules answer and say so.

## What I cut, and why

| Cut | Why | What it would take |
| --- | --- | --- |
| The "Why flagged?" panel | I asked for it, then chose the model help first | The ask rules, an endpoint and the panel, from stockroom |
| Activity and People on the data table, with filters, a column toggle and the assistant | Each is a move onto the data table | Rebuild both pages as Items is |
| Messages inside the table's footer | The footer has no place for one | A status bar per page |
| Restoring old values when a replace is taken back | Needs a copy of each replaced item | A history row per replace |
| "Clear the date" for a discontinued yet active row | It made the confirm button and the stored count disagree, so I withdrew it | A pick that writes another column, read alike by screen and server |

## How I worked with my agent

I decided the rules; the agent profiled the files, proposed each rule with its rows, built it and tested each
version, and I checked on each version's frozen copy. Browser and server run one pure `review`, so the preview and
the confirm cannot disagree.

## To make this production-ready

1. Sign-in hardening: a second factor or passkeys, email verification and reset.
2. Files past a few thousand rows: the review is computed in the browser.
3. A history of replaced items, so a take-back restores them.

## With another hour

The "Why flagged?" panel; Activity and People on the data table; past imports listed on Upload; the strip's arrows,
the filter menus and the three widths looked at on every screen; both answers on a discontinued row; reasons in
full; units and defaults in the review.
