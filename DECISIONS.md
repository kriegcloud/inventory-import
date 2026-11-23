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
  linking to its result; a .txt of plain text refused with a message (a letter whose every line holds exactly one comma is read as two columns and opens Match); quantities with their unit and default ("0 EA,
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
  - On Items, a filter value typed in the Filter menu and followed within a third of a second by a click on a page
    not opened yet since the app loaded is written into that page's address (`/activity?name=brass`): the Items
    page stays drawn while the other page's code loads. On a page opened before, nothing is written. It was so
    before the table moved to atoms.
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
    - Import in a tab that is behind, after my own other tab confirmed the import and opened it again, says "Someone
      else changed this import while you were reviewing it", though nobody else did: it was me, in the other tab.
      Nothing is imported and none of my decisions is written, so only the words are wrong.
    - A decision of hers made before somebody else's confirm is let go without a word when the import, opened again,
      holds an equal value that may be hers (a save of it got no answer, or she decided over a colleague's decision
      that a match can leave equal to hers), and nothing names it when the row is decided otherwise after. The screen
      cannot tell her save from the colleague's: that needs the review model on the server. Where no save of hers can
      have written it, it is named.
    - A decision from another tab of mine, made after the import was confirmed and opened again, and taken up by a tab
      that has not read the reopened import yet, is sent as if made before the confirm: the server refuses it, and I
      am told it was not saved, though the other tab's own save may have written it. It can also be named as not part
      of the import, or let go, when that tab reads the reopened import.
    - A tab loaded before the server asked every save for the number of confirms it was decided over gets, on its
      next save, "Opening was not accepted. Check it and try again.", words about a field the person never saw, and
      every save fails until the page is reloaded. Nothing is written. Answering that save with "the import changed:
      reload" instead is possible on the server, not built.
    - After the import is confirmed and opened again, the notice that names a decision a closed tab of mine left
      (a row I kept in this tab and left out in the other) says "you left out" without "in another tab of yours",
      when the same notice also names my own decision of that row as one that may have been saved.
    - The server reads an import's decisions and its history in two steps. A confirm and a reopen by somebody else
      that land between them give my screen the old decisions with the new number of confirms, and a decision I then
      make on that picture is written into the import opened again, as if I had made it after the reopen. Not seen
      happen: it needs both within one read.
  - **For whoever changes the code.** `tags:check`, `refs:check` and `try:check` read a file within a budget and
    refuse one past it in words; a file built to kill the parser behind text their scan misreads still kills the
    check, which then fails (`goals/atoms/PLAN.md` and `docs/standards/no-try.md` name the shapes). `try:check`
    misses a `try` in a few doc-comment examples that are not modules by themselves (`docs/standards/no-try.md`
    lists them). No test fails when the guard on browser storage is taken out of the review's kept store or of
    the five places that write who was signed in. The kept form of a held row is a tagged union whose cases are
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
| A stored SKU that reads, on a row where another cell does not | Already there, the stored item not changed; it waits with its proposal offered again | I chose; the agent recommended the same, 2026-11-22 | rows 55, 85, 135, 172, 186, 191, stored after an accepted proposal: the same file again gives Already there 161, Needs a decision 18, Cannot import 21 |
| A stored SKU that reads, with another cell that does not, on a row the person acted on | It waits and shows the cell; already there | I chose; the agent recommended the same, 2026-11-22 | narrows the row above: a typed value, an accepted proposal or Replace on the row stays on screen. It follows the row before that one too: a row the person has work on waits until it reads |
| A two-digit year; a cost below zero; quantity 12.5 | Typed by the person; proposed | the agent's default; I was told | "0 or more", "integer" |
| Discontinued yet active | Both readings; one | the agent's default, both; both are built | rows 45, 164 |
| "2024-13-01" | Cannot import until fixed; import without the date | same | rows 92, 103 |
| Take-back after a replace | Restore, unless changed since; leave it, and say so | the agent's default after the hour: restore, keep and name one changed since | a changed copy of the clean file |
| A rejected proposal | It leaves the row; stays, marked rejected | the agent's default; I was told | Ctrl+Z brings it back |
| Into the last version | A past import found again; the drop indication | Mine, in my words: "Find a past import again, Drop indication on Upload" | both seen on it |
| A model's name guess the guard rates low | Typed by the person, the guess offered beside the box; one press | the agent's default after the hour | "the app never invents a value" |
| What "Why flagged?" asks about | The rows on screen (view, kind, search); rows ticked one by one | the agent's default after the hour: it needs no new control | the standard's "the answer names them" |
| A .txt file | A table only when most rows have as many cells as the heading; any text with commas | the agent's default after the hour; kept by me on 2026-11-22 for a letter with one comma on every line ("Keep reading it": I chose; the agent recommended the same) | of six files tried, the letters with uneven or no commas are refused; a letter with one comma on every line opens Match as two columns |
| A save failed, rows wait unsaved, and the person reloads | Keep them and send them; warn before leaving only; drop them and say which | same, 2026-11-20 | row 130 left out with the network down: the browser asked before the reload, the row came back "not saved yet", and was sent when the network returned |
| Rows wait unsaved and someone else confirms the import | Name the rows, then drop them; drop them without a word | same, 2026-11-20 | rows 55 and 191 left out and waiting, the import confirmed in another browser: the result says "Row 55: you left out", "Row 191: you left out" |
| An accept waits while its field's column is matched again | Server refuses, screen says so; screen drops it only; as today | same, 2026-11-20 | Unit cost matched again from another screen, then rows 55 and 191 accepted: "2 accepts were taken back", both rows still open |
| What a review action says (accept, a typed value, leave out, undo, redo) | No toast: its words beside the toolbar's Undo, which takes it back, until the next action, read out politely; a failed or unsaved save keeps its banner | I decided, 2026-11-22: "I don't like the toast that pops up … covers up UI & is distracting to me I think that the toasts deserve to be part of the table itself" | a group accepted: "2 fixes accepted" beside Undo, no toast; Undo: "Undone: 2 fixes accepted" |
| The review's toolbar | One line: View, Category and Unit of measure in the row with the views and Import; the search an icon that opens into the field ("/" or Ctrl+K), closes on Escape when empty, stays open while it holds text | I decided, 2026-11-22: "View / Category / Unit of Measure could go here on the right since there is empty space … Then all of these would fit on one line instead of wasting space", the search as "an icon which expands to the search bar" | one line from 1,490 px of page; at 1,541 px with the sidebar folded the whole toolbar is one line |
| A narrowed table | The search and every ticked filter as a chip with a cross ("Search: washer ×", "Category: packaging ×") | I decided, 2026-11-22 | "washer" typed: the chip "Search: washer" and 1 item; its cross: 2 items, no chip |
| A double click on a group's accept | A pointer's second click within 400 ms of a group's accept does nothing; Enter and Space are never held back | I decided, 2026-11-22: one click on "Use components for the 1 ticked" and the cursor sat on "Accept for the 2 ticked" | two clicks 50 ms apart: Needs a decision 24 to 22, one group; Enter twice: 24 to 21, both |
| The toolbar's icons | Grouped by meaning: history (Undo, Redo, Activity), view (matched columns, row height, the filters), Download, Why flagged | I decided, 2026-11-22 | the groups stand apart, with a rule between |
| The toolbar and the totals with little room | Folded by the room the page has (the sidebar taken off), never by the window, between groups; Import never leaves the right edge; the totals fold between totals, never inside one | I decided, 2026-11-22: the totals wrapped "… M 33,705, L" then "8,804" at 1,541 px | at 1,541 px with the sidebar open: two lines, Import top right; the totals' second line is "L 8,804" whole |
| A save made before a confirm, arriving after the import was opened again | The server refuses it and writes nothing; the screen names its rows once, when the refusal comes, and not while its answer is owed | decided by the rule, for me to overrule | a save of row 55 decided in the first opening, sent after a confirm and a reopen: 409, row 55 not written; the same save made in the second opening is written (by test, not seen on screen) |
| A decision from before a confirm whose save got no answer (lost, or the page loaded again first) | Never said to be not sent: told apart as "may have been saved before the import was confirmed", with a word to look at the row; not sent into the import opened again. On the result it is listed apart, under "no answer came to say whether it was saved first". A save the server refused, and a decision never sent, are said as not sent | decided by the rule, for me to overrule | row a left out, saved, its answer lost, the import confirmed and opened again: "1 decision of yours may have been saved before the import was confirmed" (by test, not seen on screen) |
| A decision she was told the server refused, when the import is then confirmed or opened again | Named once, by the refusal: its line stays until the row is decided again, dismissed or the import is confirmed (the refusal's words say so), and the close or the reopened import does not name it again | decided by the rule, for me to overrule | row a left out, refused after a confirm and a reopen, then the import read: one notice for row a (by test, not seen on screen) |
| A press that leaves an undecided row undecided | No decision: nothing sent, nothing named | decided by the rule, for me to overrule | a row shown undecided, pressed to undecided: no save, no notice (by test, not seen on screen) |
| A decision of hers waits, and the server holds an equal value somebody else may have saved | Never let go on that value: hers is sent, and the server writes it as hers or answers that the row was decided otherwise since, and a line asks; a closed tab's stays on its line | decided by the rule, for me to overrule | row a left out, its save lost, a colleague's left-out read, then the colleague kept it: her left-out is sent, and the line asks "Row a: decided since by someone else or another tab: kept over the other row with its SKU. Yours: left out.", with "Use mine" and "Keep theirs" (by test, not seen on screen) |
| The browser refuses to keep her waiting decisions | The screen says they could not be kept on this browser and are lost if the page is closed or loaded again before they are sent; it never says they are kept | decided by the rule, for me to overrule | seen on screen with storage refusing and the save failing, "Leave out 2" pressed: the line and the toast said so, and after a reload the two decisions were gone |
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
