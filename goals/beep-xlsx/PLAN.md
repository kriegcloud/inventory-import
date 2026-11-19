---
type: Plan
title: "@beep/xlsx, plan"
description: The steps of the beep-xlsx goal, their status, the current blocker and the choices made along the way.
from: explorations/ideal-architecture
---

# Plan

[SPEC](SPEC.md) holds the objective and acceptance. Status is one of `todo`, `doing`, `done`. The steps are the
brief's "Order of moves".

| # | Step | Status |
| --- | --- | --- |
| 1 | The package's frame beside `@beep/csv`: manifest, tsconfigs, identity, an empty barrel | done |
| 2 | Schemas in the order of the Sketch, their behaviour, `XlsxSchemas.property.test.ts` | done |
| 3 | Reading: container, parts, sheet; `parse`, `sheets`, `rows`; hostile tests | done |
| 4 | Writing: `stringify`, the codecs; round-trip laws; the SheetJS oracle | done |
| 5 | The adapter beside the SheetJS reader; parity over fixtures and generated workbooks | done |
| 6 | Expected tables frozen; the swap; SheetJS reader and its entries removed; browser pass; documents | done |

## Current blocker

None.

## Choices made

Where the brief left a choice open, or the code showed the brief could not be followed as written.

- **Checks that cannot steer generation became canonical forms.** `Arbitrary.schema` discards a whole generated value
  when any cross-field check in it fails, and a declaration's `toCodecArbitrary` is not open to an `S.Opaque` struct.
  With the brief's checks on `XlsxRange` (first corner before last), `XlsxCell` (a date only under a date format) and
  row and cell order, a generated worksheet passed 6 times in 100 and a workbook almost never, so the round-trip laws
  could not run. Those four are now what a read guarantees and what `XlsxWorkbook.canonical` restores
  (`XlsxRange.ordered`, `XlsxCell.canonical`, sorted rows and cells); "no column twice" and "no row number twice"
  stay checks, since `uniqueBy` steers generation. The laws are stated up to `canonical`.
- **A sheet's name is what a file holds, not what Excel would accept.** The brief had 1 to 31 characters and none of
  `: \ / ? * [ ]`. Other programs write longer names, and the reader must still name the sheet, so `XlsxSheetName`
  asks for 1 to 255 characters XML can carry, and `fitsExcel` answers Excel's rule.
- **Number format ids are the writer's.** Two cells may carry one id with two codes in a workbook built by hand, so
  a write numbers formats itself (Excel's id for a built-in code, 164 and up otherwise); `canonical` does the same.
  The code is what round-trips.
- **`XlsxSheetCount` also counts cells that hold something**, because the app picks "the sheet with the most data"
  by cells, not rows.
- **Behaviour is on the classes**: `XlsxCalendar.fromSerial`, `toSerial` and `toDateTime` (the brief wrote them as
  `XlsxSerial.toCalendar` and so on; `XlsxSerial` is a plain schema with no statics), and `columnLetters` and
  `columnFromLetters` beside `XlsxColumn`.
- **Rounding of displayed numbers is half away from zero**, which is Excel's. The reader this replaces rounded some
  ties the other way (826.045 under `$#,##0.00` read "$826.04") and showed no minus sign for a negative number that
  rounds to zero under some formats. General and every date format agree with it on 300,000 compared values, except
  where it showed PM for a time that rounds up to midnight and lost the 1904 system on that same carry.
- **A serial's time is cut to 15 significant digits before it is read**, as a workbook stores it and as the old
  reader did, so 0.6041666666666666 is 14:30:00 and not 14:29:59.
- **Three passes at most, usually two.** The brief had two passes with the sheets skipped on the first. Which part
  is the workbook is known only from the relationships, which can come anywhere, so the first pass holds every
  `.rels` part and every `.xml` part outside a `worksheets` folder and counts every part against the caps; a second
  pass runs only when the workbook, styles or shared text sit somewhere that pass did not hold; the last reads the
  sheets asked for. Measured in Node 26 on 50,000 rows by 15 columns (9.7 MB): 449 ms against the old reader's
  1,129 ms, and counting every sheet without keeping it 399 ms.
- **The reader builds cells without `make`.** `make` on each of 750,000 cells cost more than reading the file
  (2,300 ms). `internal/trusted.ts` is the one place a value takes its brand from parts the reader has just checked;
  the tests hold every workbook read, from a fixture, a generated file or the oracle, to `S.is(XlsxWorkbook)`.
- **A cell's text is copied out of the XML it was cut from** (`detached`), or one kept string holds a whole parsed
  chunk in memory.
- **A file cut inside its directory still reads.** The hostile test cuts a file at every hundredth byte: a cut
  inside an entry is a typed failure; a cut after the last entry reads to exactly the whole file's values, since the
  zip reader never needs the directory. The brief expected every cut to fail.
- **No file in the package is a binary fixture.** The brief had fixtures "built by one committed script"; they are
  built in the tests from the parts in `test/support/workbooks.ts`.
- **`sheetFromBytes` takes a row schema over `XlsxRecord`** (each heading to the `XlsxValue` its cell holds), and
  `recordsFromBytes` is the codec under it. A heading that is not text, or is used twice, is a schema issue.
- **`XlsxContainer` is defined beside the findings** (`NotAWorkbook` carries it) and exported from `XlsxRead` too.
- **`Xlsx.outline` beside `Xlsx.sheets`.** The adapter needs the date system, every sheet's count and the chosen
  sheet's merged ranges and hidden columns before it reads rows; `outline` gives them in one pass over the sheets
  (`XlsxOutline`, `XlsxSheetOutline` in `XlsxRead.schema.ts`), and `sheets` is its counts.
- **The grid runs to the last cell the sheet writes.** The old reader built its grid to the extent the file
  declared. On all six fixtures, the hand-built files and 150 generated workbooks the two give the same table; on a
  file whose declared extent leaves rows out, the old reader lost those rows without a word and the new one reads
  them (`xlsxParity.test.ts`, the last case). That difference is kept, and is for Benjamin to know.
- **Only the chosen sheet is built.** `describeWorkbook` in `catalog-model` is now over `describeSheets`, which takes
  what is known of every sheet and asks for one grid; the rules and sentences are the same lines.
- **Two new Notes**, which decisions X3 and X4 ask for: `unreadableCells` (warning) names the cells a file gets
  wrong and says they were left empty; `formatNotShown` (info) names a number format whose displayed text is not
  worked out and counts its cells. No fixture produces either.
- **A file that unpacks past 64 MiB** is refused as unreadable, with "it unpacks to more than 64 MB" and the advice
  the size limit gives. `tooManyBytes` wants the file's size, which is not what is wrong.
- **The comparison that stays is against recorded tables** (`test/fixtures/xlsx-expected/`, 23 files written from
  the SheetJS reader), as the CSV swap did. `xlsxOldAgainstNew.test.ts` runs both readers, on generated workbooks
  too, and goes when the SheetJS reader does.
- **The format sniff asks the package only about archives.** `read.ts` still tells a PDF, a picture, a web page and
  text from the first bytes itself; a file that starts as a zip archive or an older Office file is handed to
  `Xlsx.container`, through the workbook reader's chunk, so a CSV still never downloads it. The sentences are the
  same lines.
- **Progress counts the chosen sheet.** The old reader built every sheet and counted the rows of all of them; the
  new one reads one sheet against that sheet's exact row count.

## Seen in the browser

Dev server on port 5200, headless Chromium, signed in as Dana Whitfield, a fresh database before each of the two
samples. The workbooks were written with `Xlsx.stringify` from the app's own sample files (every cell as text, as a
CSV has them), so the numbers to expect are the samples' own.

- **`items_messy.xlsx`** (1440 wide): chose the file on the Upload step. Read on Review: "200 rows read · 20 values
  fixed for you", the button "Import 155, skip 45". Pressed it; the dialog asked "Import 155 items?" with "45 items
  won't be imported (Needs a decision 24, Cannot import 21)". Confirmed. Result read "Imported items_messy.xlsx",
  the views "Not imported 45 · Imported 155 · Already there 0 · All 200". Items page: "155 items". Stored, read from
  the local D1 file: 155 rows in `item`; outcomes `created` 155 and `notImported` 45.
- **`items_clean.xlsx`** (fresh database): Review offered an import with nothing to skip, so Confirm asked nothing;
  Result read "Not imported 0 · Imported 25 · Already there 0 · All 25"; Items page "25 items". Not read from the
  database at that point; after the next imports it held 180, which is 25 and 155.
- **A second load of the same items as a workbook** (`two_bays.xlsx`, whose main sheet is the clean sample): "25
  rows read", "Already there 25", "Nothing new: this file is already in". Nothing was written.
- **The sheet chooser** (`two_bays.xlsx`: Read me, Bay 1, Bay 2 and a hidden sheet Old): the Review step's button
  read "Sheet: Bay 1". Opened it: "Sheet 2 of 4: Bay 1", the options "Read me · 1 row", "Bay 1 · 26 rows", "Bay 2 ·
  6 rows", "Old (hidden) · 4 rows", and "It has the most data (26 rows, 15 columns). Other sheets also have data:
  "Read me" (1 row) and "Bay 2" (6 rows)." Chose Bay 2: the file was read again, Review read "5 rows read", the
  button "Sheet: Bay 2", and the chooser "Sheet 3 of 4: Bay 2 · You chose this sheet."
- **`sheets.xlsx`**, the six-sheet fixture: landed on Match, "4 of 15 fields matched", "Match Category and Unit cost
  to a column to review: they are required.", with the Items sheet's values as examples (BRK-040, HB-M8-30). Its
  chooser was not seen: it shows on Review, which this file does not reach until those fields have a column.
- **A workbook over 3 MiB** (`too_big.xlsx`, 3.4 MB): the Upload step read "This file is too large", ""too_big.xlsx"
  is 3.4 MB, and workbooks over 3.0 MB cannot be read here.", "Split it into smaller files, or delete sheets and
  columns that are not needed, and choose it again." The address stayed on the Upload step.
- **Phone width** (390 by 844): `items_messy.xlsx` again through Confirm: "Import 155, skip 45", "Import 155
  items?", then "Not imported 45 · Imported 155 · Already there 0 · All 200"; the page was 390 wide on Upload, Review
  and Result (no sideways scroll). The sheet chooser of `two_bays.xlsx` opened from 19 to 384 across, inside the
  screen, reading "Sheet 2 of 4: Bay 1". The line "200 rows read" was not read at this width.
- No error in the browser console in the whole pass (45 messages, none an error).

Not seen on screen: a workbook with a cell the file gets wrong or a number format that is not displayed (the two new
Notes; no fixture or sample has either, and none was built for the browser), a date or number cell's displayed text
on the Review step (the sample workbooks hold text only), a workbook that unpacks past 64 MB, Cancel during a
workbook read, a hidden sheet chosen, and the dark theme.

## Seen in the browser, second pass

After Benjamin's answers (DECISIONS, 2026-11-19), on a fresh database, port 5200, 1440 wide unless said. Each file
was built from the clean sample's 25 items by hand-written parts, with only the named change, and chosen on the
Upload step.

- **A cell that points at shared text the file does not have** (`unreadable_cells.xlsx`: C4 and C8, two
  descriptions): Review read "25 rows read" and "Import 25 items". Pressed the Activity button; under Steps, tagged
  Read: "2 cells could not be read and were left empty: C4, C8. The file itself holds no usable value there; open it
  in Excel and retype them if they matter."
- **A number format outside what is displayed** (`format_not_shown.xlsx`: 20 quantities under `# ?/?`): "25 rows
  read", "Import 25 items"; in Activity: "20 cells have the number format # ?/?, which is not shown here as Excel
  shows it; the stored values were read."
- **Wrong on screen, and fixed**: the Activity panel cut each of those sentences to one line with an ellipsis ("2
  cells could not be read and were left e…"), so the cells' names could not be read. It did that to every Note of
  every file, before this goal too. A step with nothing to open now wraps
  (`packages/ui/src/AgentRun.component.tsx`); a step that opens is still one line. Seen again: the sentence in four
  lines at 1440, and in four lines inside the screen at 390 wide, nothing cut.
- **A workbook of 77 kB that unpacks to 70 MiB** (`unpacks_large.xlsx`): 0.3 s after choosing it the Upload step read
  "This file could not be read", ""unpacks_large.xlsx" could not be read: it unpacks to more than 64 MB.", "Split it
  into smaller files, or delete sheets and columns that are not needed, and choose it again."
- **Displayed text of a number and a date cell** (`shown_text.xlsx`: unit costs as numbers under `$#,##0.00`, first
  received as dates under `m/d/yyyy`): on Match, the examples read "$12.33 · $8.03 · $20.59" for Unit cost and
  "3/18/2019 · 1/21/2023 · 2/14/2020" for First received (the sample's 2019-03-18). Review read "Ready 25", "Import
  25 items", the first row's cost "$12.33". Review draws a cost in the app's own money format, so a cell's displayed
  text is not what it shows; Match's examples are where it is seen.
- **Cancel during a workbook read** (`many_rows.xlsx`, 36,000 rows, 2.4 MB): the Upload step showed the file's name,
  a bar and "Reading" with a Cancel button. Pressed Cancel: the box went back to "Choose file", the address stayed
  on Upload, and no import named many_rows.xlsx was in the list of open imports.
- **Dark theme**: switched with the bar's button ("Switch to dark theme"). Looked at the Upload step with the
  "unpacks to more than 64 MB" problem (red text on the dark panel, readable), the Review step and the Activity
  panel with the unreadable-cells sentence (light text on the dark panel).
- No error in the browser console in the whole pass.

Still not shown: Cancel while a workbook's rows are being sent (the read was cancelled, not the sending); a hidden
sheet chosen in the chooser; an import of these files carried through Confirm (they were left on Review); the two
Notes anywhere but the Activity panel. That last one is worth Benjamin's eye: `unreadableCells` is a warning, and a
warning from the reader is shown only behind the Activity button, as every reader Note is.

## Closing note

`@beep/xlsx` is at `packages/foundation/modeling/xlsx`: ten schema and facade files, eleven internal ones, five test
files (92 tests). The app reads every workbook through it. SheetJS is a devDependency of the package and nothing
else; the reader's chunk in the production build is 112 kB, where SheetJS alone was 261 kB.

While building, each of the six app fixtures was read, written with `Xlsx.stringify` and read again, and equalled its
canonical form; that was a script, not a committed test, since the package may not read the app's files.

What the next goal should know:

- The strict profile refuses a native string or array method, an exported function of two arguments without a
  pipeable form (take one object), a `yield*` inside a call's arguments, and a constructor with parameter
  properties. A formatter rewrote `\ufffe` inside a pattern literal into the character itself; build such a pattern
  with `new RegExp` from text.
- `Arbitrary.schema` discards a whole value when any cross-field check fails. A check two fields share must be one
  `uniqueBy` can steer, or a canonical form.
- An `S.Opaque` field under `S.annotateKey` has the plain struct as its type, so a function over a workbook's sheets
  takes `XlsxWorkbook["sheets"][number]`, as `@beep/csv` found.
- Effect's `Zip.decode` reads no central directory; its entries' sizes may be absent; a body must be read before the
  next entry is pulled. Its `Xml.decode` reports names as written.

For Benjamin, not decided by this goal:

- The four places the build differs from the brief (the first four entries of "Choices made"): canonical forms in
  place of three checks, the sheet-name rule, format ids, and a file cut inside its directory.
- The sentences of the two new Notes and of the "unpacks to more than 64 MB" problem.
- Where the new reader is right and the old one was wrong: a declared extent that leaves rows out, rounding ties in
  displayed numbers, and a time that rounds up to midnight.
- `internal/numberFormat.ts` follows what SheetJS's formatter displayed for General and for date tokens; SheetJS is
  Apache-2.0 and the package is MIT. The code is this package's own, written against the behaviour and tested
  against it; whether that wants a notice is his call.
- The workbook limit stays at 3 MiB (X5). Measured with the new reader: 36,000 rows of a 7-column export, 3.0 MB,
  0.5 s and about 60 MB of heap.
