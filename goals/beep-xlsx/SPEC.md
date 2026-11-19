---
type: Goal
title: "@beep/xlsx"
description: An Excel workbook as an Effect Schema codec, @beep/xlsx, built beside the SheetJS reader, proved identical to it on every fixture, then swapped into the app with SheetJS left only as the package's test oracle.
status: active
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

- [ ] `packages/foundation/modeling/xlsx` exists with exactly the export subpaths the brief lists and no
      `./internal/*` export.
- [ ] Every exported schema generates only valid values (`XlsxSchemas.property.test.ts`).
- [ ] Round trip: `decode(encode(w)) = w` for generated workbooks, and `decode(encode(decode(b))) = decode(b)` with
      `dropped` emptied for every fixture (`Xlsx.property.test.ts`).
- [ ] `XlsxAddress.parse` after `format` and `XlsxSerial.fromCalendar` after `toCalendar` are the identity; serials
      1, 59, 60, 61 and a modern date hold in both date systems.
- [ ] Hostile inputs fail typed, never a defect, a stack overflow or a hang (`hostile.test.ts`).
- [ ] Oracle: SheetJS reads what the package writes, and the package reads what SheetJS writes, to the same values
      (`oracle.property.test.ts`, the only file in the package importing SheetJS).
- [ ] Parity: the SheetJS reader and the adapter give identical tables and problems on every workbook fixture, the
      new fixtures and generated workbooks; the old reader's results are recorded under
      `packages/catalog/web/test/fixtures/xlsx-expected/` and compared after the old reader leaves
      (`xlsxParity.test.ts`).
- [ ] The app's workbook reading goes through `@beep/xlsx`; `xlsx` is in no `package.json` but the package's own
      `devDependencies`, and the `optimizeDeps` entry is gone.
- [ ] `bun run check:full` passes on the last commit; the override sum is no higher than 666.
- [ ] Browser, fresh database: each sample workbook through every step to Confirm with the three numbers read; a
      multi-sheet file through the sheet chooser; a file over 3 MiB refused with today's sentence; phone width.

## Decisions

In [the exploration's DECISIONS.md](../../explorations/ideal-architecture/DECISIONS.md): "next goal", "xlsx engine
(X1)", "xlsx writing (X2)", "xlsx displayed text (X3)", "xlsx unreadable cell (X4)", "xlsx size (X5)", "SheetJS
afterwards (X6)", "xlsx brief", "who builds xlsx"; and from before, "file naming", "shared kit", "strictness",
"schema form".
