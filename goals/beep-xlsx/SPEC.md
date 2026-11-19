---
type: Goal
title: "@beep/xlsx"
description: An Excel workbook as an Effect Schema codec, @beep/xlsx, built beside the SheetJS reader, proved identical to it on every fixture, then swapped into the app with SheetJS left only as the package's test oracle.
status: done
from: explorations/ideal-architecture
---

# `@beep/xlsx`

Step 8 of the order of work in [the ideal-architecture exploration](../../explorations/ideal-architecture/README.md).
The design is [BRIEF-xlsx.md](../../explorations/ideal-architecture/BRIEF-xlsx.md) (its Sketch is the specification
of the package); the rules it follows are [docs/standards/schema-first.md](../../docs/standards/schema-first.md).

## Objective

The app reads every workbook through `@beep/xlsx`, a package of this repository's own, exactly as it read them
through SheetJS: the same cells, displayed text, formulas, row numbers, Notes, sheet list and problems on every
fixture. The package reads `.xlsx` and `.xlsm` bytes into one workbook model, writes that model back, and offers the
round trip as one `effect/Schema` codec; one sheet can be read as a stream of rows.

## Non-goals

From the brief's No-gos: no formula is evaluated; no `.xls`, `.xlsb`, `.ods` or encrypted workbook; no styles beyond
the number format, no charts, pictures, pivots, comments, validation or tables; no editing in place and no
byte-for-byte round trip; no new download or screen and no reading on the server; `SpreadsheetTable`, the Notes'
sentences, the sheet chooser, staging and the upload protocol unchanged; the CSV reader untouched; the vendored kit
never edited.

## Constraints

- The app keeps working at every commit: `items_messy.csv` (200 rows) imports to 155 stored, and every workbook
  fixture reads as before.
- Effect 4.1.4 only, every API checked in `node_modules/effect/src`; `Effect.fn`/`Effect.fnUntraced`; Effect
  collections, never `Map` or `Set`.
- The package passes the full type-check profile with no override; the override sum stays at or below 666.
- Run-time dependencies: `effect` and the vendored `@beep/identity`, `@beep/schema`, `@beep/utils`. SheetJS is a
  devDependency of `@beep/xlsx` only (decision X6).
- A role suffix in every filename outside `internal/` and `index.ts`; exact exports; `internal/` never exported.
- bun only; nothing pushed or deployed.

## Acceptance

- [x] `packages/foundation/modeling/xlsx` exists with exactly the export subpaths the brief lists and no
      `./internal/*` export (`package.json` read: `.`, `./Xlsx`, `./XlsxAddress`, `./XlsxSerial`, `./XlsxCell`,
      `./XlsxWorkbook`, `./XlsxOptions`, `./XlsxDiagnostic`, `./XlsxRead`, `./XlsxError`).
- [x] Every exported schema generates only valid values (`XlsxSchemas.property.test.ts`, 30 schemas, 50 runs each).
- [x] Round trip, up to `XlsxWorkbook.canonical` (PLAN, "Choices made"): a generated workbook written and read back
      is its canonical form, stored or deflated and through the Schema codec, and does not move under a second pass
      (`Xlsx.property.test.ts`, 150 and 50 runs); each of the six app fixtures written and read back equals its
      canonical form (run by hand while building, PLAN closing note; not a committed test).
- [x] `XlsxAddress.parse` after `format` is the identity; `XlsxCalendar.toSerial` after `fromSerial` is the identity
      on whole seconds up to serial 99,999; serials 1, 59, 60, 61 and a modern date hold in both date systems
      (`XlsxSchemas.property.test.ts`).
- [x] Hostile inputs fail typed, never a defect, a stack overflow or a hang (`hostile.test.ts`, 13 cases). One
      differs from the brief: a file cut inside its directory still reads, to the whole file's values.
- [x] Oracle: SheetJS reads what the package writes, and the package reads what SheetJS writes, to the same values,
      formulas, formats, sheet names and states; displayed text is what SheetJS displayed
      (`oracle.property.test.ts`, the only file in the package importing SheetJS; 100 to 2,000 runs).
- [x] Parity: the SheetJS reader and the adapter gave identical tables and problems on every workbook fixture for
      every sheet of each, on files built by hand and on 150 generated workbooks (commit `bdaca41`, where both
      readers ran); the old reader's results are recorded under `packages/catalog/web/test/fixtures/xlsx-expected/`
      (23 files) and compared now that it is gone (`xlsxParity.test.ts`, 24 cases).
- [x] The app's workbook reading goes through `@beep/xlsx`; `xlsx` is in no `package.json` but the package's own
      `devDependencies` (`git grep '"xlsx"' -- '*package.json'` finds that one line), and the `optimizeDeps` entry is
      gone.
- [x] `bun run check:full` passes on the last commit; the override sum is 657, down from 666.
- [x] Browser, fresh database: both samples as workbooks through Confirm with the three numbers read; a four-sheet
      file through the sheet chooser; a file over 3 MiB refused with today's sentence; phone width (PLAN, "Seen in
      the browser").

## Decisions

In [the exploration's DECISIONS.md](../../explorations/ideal-architecture/DECISIONS.md): "next goal", "xlsx engine
(X1)", "xlsx writing (X2)", "xlsx displayed text (X3)", "xlsx unreadable cell (X4)", "xlsx size (X5)", "SheetJS
afterwards (X6)", "xlsx brief", "who builds xlsx"; and from before, "file naming", "shared kit", "strictness",
"schema form".
