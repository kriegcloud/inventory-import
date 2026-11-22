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
- **Fixed after the hour, each seen in a browser:** both answers on a discontinued yet active row (row 45 stored
  active, no date); a model's name shows its source, "Why?" and Reject, and a weak guess waits for a typed name; the
  vendors form opens with what a cut-off cell holds and the question names vendors, not JSON; every view and every
  reason in full on a phone; every confirmed import, a clean file's too, listed on Upload and under Activity, each
  linking to its result; a .txt letter refused with a message; quantities with their unit and default ("0 EA,
  default"); Activity and People on the data table; "Why flagged?"; Items filtered by Active and Lot tracked; a
  take-back restores the items it replaced. Every screen measured at 1440, 820 and 375 px: nothing past the edge. On
  the last version Confirm stored 155, the result said 155 imported and 45 not, Items showed 155.
- **Known wrong or missing:**
  - A model's weak name guess (rated low by the guard) never came up in my runs, so its panel is not seen on screen;
    a test covers the rule.
  - Activity, People and the past-imports list keep their search, sort and filters only until a refresh; Items keeps
    them in the address. On a phone their cards cannot be sorted.
  - "Why flagged?" asks about the rows that the view, the problem kind and the search narrow the table to. There is
    no tick box for picking rows one at a time.
  - On a phone the grey line under the result's heading is cut to one line.
  - A take-back restores at most ten replaces of one item in turn. No test covers two rows of one file replacing the
    same SKU.
  - **A review that saves as you decide, open in two tabs or by two people.** Each of these needs two tabs, two people
    or a lost connection; one person in one tab with a connection meets none of them.
    - A waiting row is held as "decided since by someone else or another tab" when nobody decided it (a column matched
      again took part of it back, or a colleague put the row back), and it holds Import until the person picks.
    - A row she left out, whose save reached the server but whose answer was lost, is sent again by "Save again"
      over a colleague who put the row back meanwhile, without asking: the server keeps no record of a row put back.
    - An accept unticked and ticked again after a colleague matched its column again, while the first save was on
      its way, is dropped without a word; the take-back line names the row.
    - On a line for a decision of this tab the server refused, beside a closed tab's other decision, "Keep this
      tab's" keeps nothing: it drops the closed tab's decision and leaves only Dismiss.
    - A save still on its way when the page is reloaded can land after a newer decision of the same row made on the
      new page, and replace it without a word.
    - Import, while rows wait on lines, first asks "Import 155 items?", and only after that says nothing was imported
      because the rows wait.
    - A decision of hers that a confirm wrote, whose own save is refused after the import was opened again because
      somebody changed the row since, comes back to her to pick only if her screen had already read the reopened
      import when the refusal arrived. If the refusal arrives first, it is dropped without a word.
  - **For whoever changes the code.** `tags:check` and `refs:check` read a file within a budget and refuse one past
    it in words; a file built to kill the parser behind text their scan misreads still kills the check, which then
    fails (`goals/atoms/PLAN.md` names the shapes). The kept form of a held row is a tagged union whose cases are
    still built by hand. Nothing fails when the held-confirm line is removed.
- **Not verified:** how good the model help is on other files, and what it costs; the dark theme on the new screens;
  a restore after several confirms of one import replaced the same item in turn.
- **Where my agent was wrong:** its profile missed rows 92 and 103 ("2024-13-01"), caught by the rules on the real
  file. It counted a stored SKU that could not be read yet as "Already there", caught by the code review. A group
  button named one value for rows that got different ones, caught by the browser pass. All three are fixed.
- **Checks:** `bun run check` before every commit; `bun run check:full` and `bun run build` pass on the last commit.
  In the hour, commit `81daa36` was made while the check failed on unfinished work not in the commit.

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
| Model help or the "Why flagged?" panel | Model help; the panel; both | same; the panel was added after the hour | both did not fit in the hour |
| "Internal Notes" | Left out, and said; flag the 20 rows | same | 20 rows; no such field |
| Filters on Items, Activity, People | Items only; all three | same in the hour; all three since | Activity and People moved onto the data table |
| Review's filter and column menus; scrollbars; the problems strip; messages | the table's menus; thin; one line of pills; top centre | Mine, in my words: "canonical filters dropdown form the datatable", "less 'thiccc' ... scroll bars", "scroll more naturally", "blocks page navigation controls" | seen on screen |
| A stored SKU on a row that cannot be read yet | It waits; already there | the agent's default; I was told | rows 148, 195 |
| A two-digit year; a cost below zero; quantity 12.5 | Typed by the person; proposed | the agent's default; I was told | "0 or more", "integer" |
| Discontinued yet active | Both readings; one | the agent's default, both; both are built | rows 45, 164 |
| "2024-13-01" | Cannot import until fixed; import without the date | same | rows 92, 103 |
| Take-back after a replace | Restore, unless changed since; leave it, and say so | the agent's default after the hour: restore, keep and name one changed since | a changed copy of the clean file |
| A rejected proposal | It leaves the row; stays, marked rejected | the agent's default; I was told | Ctrl+Z brings it back |
| Into the last version | A past import found again; the drop indication | Mine, in my words: "Find a past import again, Drop indication on Upload" | both seen on it |
| A model's name guess the guard rates low | Typed by the person, the guess offered beside the box; one press | the agent's default after the hour | "the app never invents a value" |
| What "Why flagged?" asks about | The rows on screen (view, kind, search); rows ticked one by one | the agent's default after the hour: it needs no new control | the standard's "the answer names them" |
| A .txt file | A table only when most rows have as many cells as the heading; any text with commas | the agent's default after the hour | a letter read as two columns |
| A save failed, rows wait unsaved, and the person reloads | Keep them and send them; warn before leaving only; drop them and say which | same, 2026-11-20 | row 130 left out with the network down: the browser asked before the reload, the row came back "not saved yet", and was sent when the network returned |
| Rows wait unsaved and someone else confirms the import | Name the rows, then drop them; drop them without a word | same, 2026-11-20 | rows 55 and 191 left out and waiting, the import confirmed in another browser: the result says "Row 55: you left out", "Row 191: you left out" |
| An accept waits while its field's column is matched again | Server refuses, screen says so; screen drops it only; as today | same, 2026-11-20 | Unit cost matched again from another screen, then rows 55 and 191 accepted: "2 accepts were taken back", both rows still open |
| Confirm, when someone else decided a row this screen has not shown | Refuse, show, confirm again; their decision stands; your screen wins | same, 2026-11-19 | two tabs on items_clean.csv: row 3 left out in one, "Import 25 items" in the other imports nothing, shows 24 and asks again |

**Reference ledger.** My own app stockroom (MIT): `src/domain/Prep.ts`, functions taken and rewritten (`inspect`,
the guard); `src/domain/ItemImport.ts`, the stored-suggestion shape and its proposal branch; `src/server/Prep.ts`,
the pattern only. Nothing was copied from anyone else's repository.

## How ambitious I was, and where I played safe

The reach is the model help: a model may suggest a name from the description or a category for "Misc", capped at
Medium by rules, never rating itself, accepted like any proposal. With no key the rules answer and say so.

## What I cut, and why

| Cut | Why | What it would take |
| --- | --- | --- |
| Messages inside the table's footer | The footer has no place for one | A status bar per page |
| Picking rows one by one to ask "Why flagged?" | The view, the kind and the search already narrow the rows | A tick column on the review table |
| A model's answer in "Why flagged?" | The rules give every reason already, and work with no key | One model call on the rows asked about, drawn from the day's allowance |

## How I worked with my agent

I decided the rules; the agent profiled the files, proposed each rule with its rows, built it and tested each
version, and I checked on each version's frozen copy. Browser and server run one pure `review`, so the preview and
the confirm cannot disagree.

## To make this production-ready

1. Sign-in hardening: a second factor or passkeys, email verification and reset.
2. Files past a few thousand rows: the review is computed in the browser.
3. A full history of every change to an item, beyond the one copy a replace keeps for its take-back.

## With another hour

Search, sort and filters of Activity and People kept in the address; a tick column for "Why flagged?"; the result's
grey line whole on a phone; a test for two rows of one file replacing the same SKU; the dark theme looked at on the
new screens.
