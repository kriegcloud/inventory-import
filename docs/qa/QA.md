---
type: QA Report
title: Browser test passes
description: One dated section per browser test pass, appended by the qa agent, with findings and what was not tested.
tags: [qa, evidence]
---

# Browser test passes

Each section below is one pass by the `qa` agent (`.claude/agents/qa.md`), oldest first. The agent appends; nobody
edits a pass afterwards.

## 2026-11-18, v0.2.0 (frozen copy, production build, http://localhost:5274)

Tested as Dana Whitfield (admin, Example Works (test)) in the qa agent's own headless browser. Console: 0 errors,
0 warnings over the whole pass.

**What I did.** Signed in; opened the result of the stored items_messy.csv import (by its address: nothing on screen
links to it); "Fix 39/45 not imported"; read every group's reason text; typed a name (row 7), picked the day-first
date (row 44), picked a category (row 40), kept row 4 over row 10, accepted the cost and SKU group proposals;
undo twice, redo twice, refresh; confirmed 6; took the import back; items_clean.csv twice; a fresh items_messy.csv
left unconfirmed for the auto-fixed view, the phone cards, keyboard and dark theme; a .txt and a wrong .csv.

**Three numbers.**

| Case | Rows in file | Result says | Stored (Items page and GET /api/v1/items/page) |
| --- | --- | --- | --- |
| items_messy.csv as found | 200 (and one empty row, 123) | Imported 155, Not imported 45, Already there 0, All 200 | 155 |
| after 6 answers and "Import 6 items" | 200 | Imported 161, Not imported 39, All 200 | 161 |
| after the take-back | 200 | Taken back 161, Not imported 39, Imported 0, All 200; headline "removed 6 items" | 0 |
| items_clean.csv | 25 | Imported 25, Not imported 0, All 25 | 25 |
| items_clean.csv again | 25 | "Nothing new: this file is already in", 25 rows Already there, no confirm button | 25 |

Stored values of the answered rows read back: RJS-3545 "Walnut Dowel 10mm"; BGP-3307 first received 2024-06-04;
EHZ-0900 supplies; ETU-6105 30.46; CWB-5404 35.82; YDR-8742 is row 4 (Oak Cutting Oil).
Undo/redo/refresh: counts went 40/4 -> 42/3 -> 43/2 -> 42/3 -> 40/4 (Needs a decision / Ready) and were the same
after a refresh, with undo still available.

**Step 6 values.**

| Measure | Reopened messy review, 1440 | Clean review, 1440 | Clean review, 390 |
| --- | --- | --- | --- |
| Page does not scroll | true | true | true |
| Filled buttons | none ("No items ready yet" is outline, disabled) | "Import 25 items" | "Import 25 items" |
| Words outside the table / sentences | 59 / 0 (limit 40) | 42 / 0 (limit 40) | 23 / 0 |
| Data rows wholly in view | 5 of 5 (the group has 5) | 18 | cards, no table |
| Table scrolls sideways | no | no (1134/1134) | no table |
| Past the right edge | [] | [] | [] (also [] at 375 and 768) |

Items page at 1440: the table is 2062 px in a 1110 px frame. Upload, Review, Result and Items at 768 and 375: no
sideways page scroll, nothing past the right edge; confirm button in view (768: 616,970; 375: 223,758, 136x44).
Counts on a fresh messy review add up: groups 5+4+5+6+4+2+4+1+5+2+7 = 45; Needs a decision 45 + Ready 155 = All 200.

**Findings, most harmful first.**

| # | Harm | Steps | Expected | What happened (the page's words) |
| --- | --- | --- | --- | --- |
| 1 | Told wrong after a take-back | Result of messy import (155 then 6 imported) > Take back this import > "Take back 161 items" | Headline and toast say 161 | Headline "Took back items_messy.csv … removed 6 items", toast "Took back 6 items from items_messy.csv"; the tab says "Taken back 161" and Items is 0 |
| 2 | A confirmed import cannot be found again | Confirm an import, go to Upload, Items or Activity | A link to its result (take back, fix the not imported) | Upload lists only open imports; Activity's "Imported items" row is not a link. Reached only by typing /?import=<id>&step=result |
| 3 | A group proposal names one value for rows that get different ones | Review > Cost; also SKU, and the auto-fixed date group | Each row's own value in the label | "35,82 (1) · 30,46 (1) becomes 35.82 · 2 rows", button "Use 35.82 for the 2 ticked" (row 191 in fact becomes $30.46); "Use AWP-1853 for the 2 ticked" (row 195 becomes JLK-2867); "Jun 19, 2024 (1) · Jun 20, 2024 (1) → 2024-06-19" |
| 4 | "Why?" says something false | Review > Date > Why? on 04/06/2024 | The reason for a date | "In the file, First received is "04/06/2024" on 1 row, which is not on your first received list. That is a guess with low confidence, so nothing changes until you choose." |
| 5 | "Why?" is missing where it was decided | Fresh messy review: auto-fixed view, Ready view, groups SKU/Category/Cost/Number, and every card at 375 | Why? on every proposal and fixed cell; a sheet on a phone | Why? exists only on the two-reading groups (Date, True or false, Vendors, Discontinued) at 1440. 0 Why? buttons in the auto-fixed view, 0 at 375. Fixed cells for First received and Active are not in the row at all (columns Name, SKU, Category, Unit of measure); only the expanded row shows "was Jun 19, 2024 now 2024-06-19" |
| 6 | Counts that do not add up on a reopened review | Result > Fix 45 not imported | Parts that sum to what the sentence says | Tabs "Needs a decision 45 · Ready 0 · All 200" (155 Already there have no tab); footer "45 won't be imported: Needs a decision 45 · Already there 155"; confirm dialog "39 items won't be imported (Needs a decision 38, Left out 1)" beside "Download the 194 rows not imported (CSV)" |
| 7 | Money shown with four decimals | Fresh messy review, footer | $40,259,038.27 | "Stock value $40,259,038.2722" (Items shows "$3.3756" for ALY-5698) |
| 8 | Reasons and totals cut off | Review at 1440, SKU clash group and All view; any review at 768/375 | Reason in full; totals readable | "SKU YDR-8742 is also on r…", "Quantity on hand "12.5" is …" beside an empty Resolve column; in the SKU cell "see row 10" overlaps the SKU and runs into Category ("see row 10supplies"); footer ends "KG …"; at 768 "All 25 ready · 25 to imp…", at 375 "All 25 ready ·…" and tab "Needs a de…"; at 768/375 "20 values fixed for you" and the totals are not shown at all on the messy review |
| 9 | Buttons in the file's raw form | Review > Vendors (two preferred); Discontinued; True or false | "Keep Ridgeline Metals as preferred"; "Mark not active" | Buttons "Use [{"vendor_name":"Ridgeline Metals",…}] for 1" (whole JSON, three of them for row 108); "Use false for 2"; at 375 "false for 2" and "true → ?" with no field name |
| 10 | The other reading is not offered | Review > Discontinued | Two choices: not active, or clear the date | "Either it is not active, or it has no discontinued date." but only "Use false for 2", "Other active", "Leave out 2" |
| 11 | Items row action out of reach | Items at 1440 | Edit in view | Edit button at x 2316 in a 1440 window; headings cut ("U…", "Qty on h…", "Reorder p…") |
| 12 | A wrong file says nothing | Upload > Choose file > a .txt of one sentence (the picker accepts .txt) | A message | Nothing: no message, no toast, page unchanged after 4 s. (A .csv with other headings is handled: "None of the columns of wrong.csv matches a field of an item: is this the right file?", Review disabled) |
| 13 | Side-by-side compare leaves blanks and few fields | SKU clash > "see row 10" | "Not set" or the default; vendors, dates, tags compared | Quantity on hand blank for row 4, Reorder point blank for row 10; cost "21.37" / "9.3" not as money; six fields only though the reason says "with different values" |
| 14 | Defaults not shown; quantities unformatted in review | Clean or messy review, Quantity on hand | "0 EA" as the default, "3,845 EA" | "Not set" for an empty quantity (stored 0, Items shows "0 EA"); "3845", "2948" without separator or unit |
| 15 | A second problem on a row is not said | Row 56 (LWR-7294) | Both the two preferred vendors and the SKU shared with row 151 | Row 56 says only "2 vendors are marked preferred…"; row 151 says "SKU LWR-7294 is also on row 56" |
| 16 | Small words | Review | The person's words | "Type the sku" (lower case, beside "Type the SKU" in another group); dialog "Kept over a row with the same key"; "40 decisions left" beside "Needs a decision 45" with no word on why, and it went from 34 to 35 after accepting the SKU group; Activity "was Poly Crate now Poly Crate" (the trimmed spaces cannot be seen) and "Rule · high"; the empty row 123 is never mentioned ("200 rows read") |

Worked as it should: reason text on all 11 kinds of row names the column and the value; typed name, date pick,
category pick and keep-one each moved the counts by one and were stored as chosen; second load of the clean file
adds nothing and says so; take-back emptied Items; keyboard (visible ring, Enter opens the editor, focus moves to
the next row's action, Ctrl+Z undoes); dark theme reads.

Screenshots worth keeping: `.scratch/shots/v0.2.0-04-compare-1440.png` (finding 8 and 13),
`.scratch/shots/v0.2.0-18-autofixed-1440.png` (findings 3 and 5).

**Not tested.** A viewer trying to import and the second organization (the production build's user menu has only
Theme and Sign out, and one account was given); .xlsx; a re-import where a stored item differs from the file;
take-back after an item was edited; the downloads' contents; the Match step by hand; the Items editor, search and
assistant; People. Left on the copy: 25 items stored (items_clean.csv) and three open imports on the Upload page
(items_messy.csv untouched, items_clean.csv "Nothing left to decide", wrong.csv).

## 2026-11-18, v0.5.3 (frozen copy, production build, port 5274), short pass

Browser: playwright-qa, signed in as the first test account (admin). Copy held 180 items (messy once with no answers 155, clean 25) and one open import of items_messy.csv.

What was done and read, at 1440 x 900 unless said:

- Open import, Review: "200 rows read", views Needs a decision 24, Cannot import 21, Ready 0, Already there 155, All 200; the problems strip 2+3+2+2+2+1+3+2+7 = 24; "200 won't be imported: Needs a decision 24, Cannot import 21, Already there 155".
- Pressed "Suggest fixes": "Suggested 2 names. Suggested 2 categories. Answered by the model anthropic/claude-haiku-5.5." (inline under the title row; counts unchanged). Rows 40 and 116 (Category "Misc") show "(suggested by the model) finished-goods? Why?" and "Use finished-goods"; Why? reads "Model · Low. "Misc" on row 40 is not one of the 5 categories; 1 of 12 other rows whose name starts with "steel" says finished-goods." with "Use finished-goods" and "Reject this proposal". Rows 7 and 83 (Name is empty) show "Use Nylon Coil" / "Use Copper Plate 1/4in" with no "(suggested by the model)" and no Why?.
- Accepted row 40: Cannot import 20, Ready 1, "Import 1, skip 199", "1 to import: Stock value $31,818.46, EA 41". Rejected row 116 in its Why?: the row then offers "Pick a category"; counts unchanged. Ctrl+Z: the suggestion is back.
- Ready view, row 40 "was Misc accepted finished-goods (suggested by the model) Why?"; "Undo this fix": Ready 0, Cannot import 21. Ctrl+Y after it: nothing changed.
- "Fix vendors" row 80: the form opens empty (Name, Vendor SKU, Unit cost, Lead time, Preferred), though the cell shows "Keystone Components", "KE-61504". Typed Keystone Components, KE-61504, 4.25, 7; Save: Ready 1, Cannot import 20, button "Import 1, skip 199".
- Confirm dialog: "Import 1 item? 199 items won't be imported (Needs a decision 24, Cannot import 20, Already there 155)...". Pressed "Import 1 item".
- Three numbers: file 200 rows; result "Imported 1, Not imported 44, Already there 155, All 200"; Items "181 items" (was 180). Button, result and Items agree.
- Take back: dialog "Take back this import? This removes from Items the 1 item that items_messy.csv created. Your decisions in the review are kept..." with "Keep the items" / "Take back 1 item". Message "Took back 1 item from items_messy.csv" at top centre (x 542 to 898, y 64 to 118), over the h1 "Took back items_messy.csv", not over a button. Result: "Taken back 1, Not imported 44, Imported 0, Already there 155, All 200". Items: "180 items".
- README "What to try first": step 1 "Use items_messy.csv" opened the review, 200 rows read, Needs a decision 24, Cannot import 21; Ready 0 and Already there 155 here (the copy already holds the 155), and no "20 values fixed for you" line or "auto-fixed" button on this second load. Step 2: "Fix dimensions" row 91 (Length 31.2 and Width 41.4 filled in, Height empty), typed 12.5, saved: Ready 1; Ctrl+Z Ready 0; Ctrl+Y Ready 1. Step 3: search "Poly Bar Stock" on Items found it; same file again created nothing (Already there 155); take-back as above.
- 768 x 1024: Review and Items, no sideways scroll, nothing past the right edge, nothing clipped. 375 x 812: Items clean; Review shows cards ("Decision 1 of 20"), Why? opens a sheet at the bottom (375 x 162) with the rule text; the view buttons "Already there 155" and "All 200" reach past the right edge.
- Themes: Items and Activity, light and dark: one scrolling region each, scrollbar-width thin, thumb the muted ink at 45%, transparent track, no sideways bar.

Step 6 values (1440, review open, after the model's message): page does not scroll true; filled buttons []; words outside the table 79, sentences 1 (the model's message); data rows in view 16; table does not scroll sideways true. At 375: edges = the two view buttons above.

| # | Harm | Steps | Expected | Happened |
| --- | --- | --- | --- | --- |
| 1 | README step 1 is false on a copy that already holds the file | Use items_messy.csv a second time | "20 values fixed for you (press "auto-fixed")", Ready 155 | No fixed-values line or button; Ready 0, Already there 155. A fixed cell's "Undo this fix" cannot be reached then |
| 2 | A model-suggested name carries no source | Suggest fixes, Cannot import, rows 7 and 83 | "(suggested by the model)" and Why?, as on the categories | Only "Use Nylon Coil for row 7"; no source, no Why?, no reject |
| 3 | The confirm is not the filled button | Review with 1 Ready | One filled button, the confirm | "Import 1, skip 199" is outline; no filled button on the screen |
| 4 | The vendors form makes the person retype | Fix vendors, row 80 | The readable part of the cell filled in | Empty form; the cell shows the vendor's name and SKU |
| 5 | Phone: views cut at the edge | 375, Review | Every view in reach | "Already there 155", "All 200" past the right edge (a strip that scrolls, no cue) |
| 6 | Redo after "Undo this fix" | Accept, Why?, Undo this fix, Ctrl+Y | Unsure: redo of the fix, or nothing | Nothing; Ctrl+Z after it not tried |
| 7 | Words outside the table | Review after Suggest fixes | At most 40 | 79 |
| 8 | Low-confidence model category is one press | Row 40 | A weak suggestion not offered as the row's main button | "Use finished-goods" on "Model · Low ... 1 of 12 other rows" |

Not tested: a fresh copy (README counts Ready 155, the auto-fixed list and "Undo this fix" on a rule-fixed cell); the console; keyboard only; viewer role and the second organization; a wrong file; group accept and date readings; the downloads; Suggest fixes without a key; the review's filter and column menus; Items filters Active and Lot tracked; the take-back toast on a phone. Screenshots were saved, not opened. Left on the copy: one new open import of items_messy.csv (row 91's height typed), the first one taken back.
