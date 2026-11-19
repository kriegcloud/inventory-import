---
type: Brief
title: "Brief: beep-xlsx"
description: The goal beep-xlsx, step 8 of the order of work. An Excel workbook as an Effect Schema codec, @beep/xlsx, built beside today's SheetJS reader, proved identical to it on every fixture, then swapped in. Not opened; it waits for "the brief matches".
---

# Brief: `beep-xlsx`

Step 8 of the order of work in [README.md](README.md). It rests on the answered decisions "CSV scope", "CSV default",
"file naming", "shared kit", "strictness", "schema form" and "next goal" in [DECISIONS.md](DECISIONS.md), on section 3
of [research/04-beep-direction.md](research/04-beep-direction.md), on [BRIEF.md](BRIEF.md) (the `beep-csv` brief,
whose package this one sits beside) and on the closing note of
[goals/contexts/PLAN.md](../../goals/contexts/PLAN.md). Where this brief and a report differ, this brief is the later
word and says why ("Where the research was wrong").

Benjamin's words for these packages: "representing the entire decoding <-> encoding two way transformation as an
effect/Schema codec". That sentence is the shape of the package: bytes on one side, a workbook value on the other, one
codec between them.

Nothing here is built. Of the six decisions at the end, Benjamin has answered X1, X2, X4, X5 and X6 with the
recommended option of each ([DECISIONS.md](DECISIONS.md), 2026-11-19); X3 is open, and nothing it would change may
be started. He has not yet said the brief matches, so no goal is open.

## Problem

The app reads a workbook with SheetJS CE 0.20.3, the "mini" build
(`packages/catalog/web/src/internal/spreadsheet/xlsx.ts`). Five things are wrong with that for the repository this has
become:

1. It is the last third-party parser in the runtime. The house rule for `foundation/modeling` packages is "write or
   vendor the engine; a third-party parser is a test oracle only"; `@beep/csv` already follows it. SheetJS is 279,523
   bytes of minified code installed from a tarball address, not the registry, named in two `package.json` files and
   in the app's `optimizeDeps`.
2. It reads everything before anything is known. Every sheet of the workbook is inflated and built in memory, though
   one is imported. That is why `maxFileBytes.xlsx` is 3 MiB when a CSV may be 10
   (`packages/catalog/model/src/Reading/Spreadsheet.rules.ts`, whose comment measures about 180 MB of heap for 50,000
   rows).
3. Nothing bounds what a small file inflates to. The only guard is 3 MiB of compressed bytes; deflate can expand
   about a thousand times.
4. Its errors are not ours. A damaged workbook is one `catch` that says "it looks damaged or incomplete", with no
   part, no cell and no reason; a cell that points nowhere is read as whatever SheetJS makes of it.
5. Nothing is written. The package Benjamin described is a two-way transformation; today there is one direction, and
   the files the app hands back (rows not imported, rows held) are CSV only.

## Appetite

Scope, not time. In:

- One package, `packages/foundation/modeling/xlsx` (`@beep/xlsx`, family `foundation`, kind `modeling`), dependent
  only on `effect` 4.1.4 and the vendored `@beep/identity`, `@beep/schema` and `@beep/utils`, as `@beep/csv` is.
- Reading `.xlsx` and `.xlsm` bytes into one workbook model, leniently by default (the answered "CSV default"
  carried over: each oddity a diagnostic); writing that model back; the whole round trip as one `effect/Schema`
  codec; one sheet read as a stream of rows.
- One app adapter replacing `xlsx.ts`'s SheetJS use behind a parity test; then `xlsx.ts`'s SheetJS reader, the
  dependency in `packages/catalog/web/package.json` and `apps/inventory/package.json`, and the `optimizeDeps` entry
  go (what stays for tests is decision X6).

Out: everything under No-gos. The goal is done when the app reads every workbook fixture exactly as it does today,
through `@beep/xlsx`, with the SheetJS reader gone.

## What was tried before writing this

Throwaway scripts (not committed) on Node 26 against effect 4.1.4's built modules, so the claims below are checked
and not read off a page:

| Tried | Result |
| --- | --- |
| `Zip.decode` over every workbook fixture (`date-1904`, `empty`, `libreoffice`, `messy`, `no-header`, `sheets`) | every part read. Excel's files carry each part's size in its local header; LibreOffice's carry none (sizes follow the data), so a size cannot be trusted to exist before inflating |
| The order of parts | `xl/worksheets/sheetN.xml` comes **before** `xl/sharedStrings.xml` and `xl/styles.xml` in every Excel-written fixture, and before `sharedStrings.xml` in LibreOffice's. One forward pass cannot resolve a cell's text |
| `Zip.decode` over `old-format.xls` and `password.xlsx` | `InvalidHeader`, "unexpected signature 0xe011cfd0 at byte 0": both are OLE files, so the container check must come first, as today's `sniff` does |
| `Xml.decode` then `Xml.elements(["*", "*", "*"])` over a sheet | one tree per `row`, `col`, `mergeCell` and `sheetView` (the elements at depth three), names as written. One pass gives rows, merged ranges and hidden columns |
| A 50,000-row, 15-column workbook written by SheetJS (9,712,573 bytes, 28,946,172 inflated) | SheetJS `read` with today's options: 1,192 ms, about 97 MB of heap kept. `Zip.decode` skipping the sheet: 83 ms. `Zip.decode` + `Xml.decode` + `Xml.elements` over the sheet, rows counted and dropped: 283 ms, about 35 MB at the peak. Inflating alone: 72 ms |
| `Effect.runSync` over the read path | works: reading has no asynchronous step |
| `Zip.encode` of a hand-written five-part workbook, read back by SheetJS | text, number, boolean and formula cells come back, for `Deflate` and for `Store`. `Deflate` cannot run under `Effect.runSync` (`AsyncFiberError`: it uses `CompressionStream`); `Store` can |
| SheetJS `SSF.parse_date_code` on serials 59, 60, 61 | 1900-02-28, 1900-02-29, 1900-03-01: it reads serial 60 as the day that never was, as Excel shows it |
| SheetJS's built-in format table through `SSF.is_date` | ids 14 to 22 and 45 to 47 are dates and times (and 56, an East Asian time) |
| The formats in the fixtures | 51 numeric cells: 37 `General`, 8 `$#,##0.00`, 1 `00000`, 5 dates in four codes (`yyyy-mm-dd`, `m/d/yyyy`, `dd/mm/yyyy`, `yyyy-mm-dd hh:mm`). 9 formula cells, none shared; 2 error cells; 2 booleans |

## Sketch

Schemas first, then the facade, then the engine, under
[docs/standards/schema-first.md](../../docs/standards/schema-first.md) (SF-1 to SF-9). The conventions are the csv
brief's and are not repeated in each table: plain data is
`class X extends S.Opaque<X, { readonly brand: unique symbol }>()(S.Struct({...}).pipe($I.annoteSchema("X", {...}))) {}`;
every field, element and member takes `S.annotateKey` first in its pipe; a non-class schema ends with
`$I.annoteSchema` and exports `type X = typeof X.Type`; a field with one canonical starting value has
`S.withConstructorDefault` and `S.withDecodingDefaultTypeKey`; every union of cases is a `LiteralKit` discriminator
closed with `S.toTaggedUnion`; `$I` is `$XlsxId.create("<File>")` from `internal/identity.ts`.

### Addresses (`XlsxAddress.schema.ts`, subpath `@beep/xlsx/XlsxAddress`)

| Schema | Definition | Behaviour beside it |
| --- | --- | --- |
| `XlsxColumn` | `S.Int` between 0 and 16,383 (column `XFD`) | `XlsxColumn.letters(column)` ("A", "AB"); `XlsxColumn.fromLetters` (an `Option`) |
| `XlsxRowNumber` | `S.Int` between 1 and 1,048,576, as Excel numbers rows | |
| `XlsxAddress` | `{ column, row }` | `XlsxAddress.parse("B7")` (an `Option`; `$B$7` accepted), `XlsxAddress.format` |
| `XlsxRange` | `{ first, last }`, both `XlsxAddress`, `first` never after `last` in either axis (a check on the struct) | `XlsxRange.parse("A1:C3")`, `format`, `contains` |

### Dates (`XlsxSerial.schema.ts`, subpath `@beep/xlsx/XlsxSerial`)

| Schema | Definition | Behaviour beside it |
| --- | --- | --- |
| `XlsxDateSystem` | `LiteralKit(["1900", "1904"])`, starting value `"1900"` | |
| `XlsxSerial` | `S.Finite` between 0 and 2,958,465.999 (31 December 9999, the last day Excel shows) | |
| `XlsxCalendar` | `{ year, month, day, hour, minute, second }`, bounded integers, `day` up to 31 with no month check | what a serial means on the sheet's calendar. It is a struct and not a `DateTime` because serial 60 in the 1900 system is 29 February 1900, a day Excel shows and no calendar has |
| | | `XlsxSerial.toCalendar(serial, system)`; `XlsxSerial.fromCalendar` (an `Option`); `XlsxSerial.toDateTime(serial, system)`, an `Option<DateTime.Utc>` that is `none` for serial 60 and for serials below 1 in the 1900 system |

The 1900 system counts 1 as 1 January 1900 and keeps the leap day that never was, so every serial from 61 on is one
more than the true day count; the 1904 system counts 0 as 1 January 1904 and has no such day. The rule is ECMA-376
part 1, section 18.17.4.1; the tests hold serials 1, 59, 60, 61 and one modern date in both systems, and the parity
test holds `date-1904.xlsx`.

### Cells (`XlsxCell.schema.ts`, subpath `@beep/xlsx/XlsxCell`)

| Schema | Definition | Behaviour beside it |
| --- | --- | --- |
| `XlsxErrorCode` | `LiteralKit(["#NULL!", "#DIV/0!", "#VALUE!", "#REF!", "#NAME?", "#NUM!", "#N/A", "#GETTING_DATA"])` | |
| `XlsxNumberFormat` | `{ id: S.Int 0..65535, code: bounded string }`, starting value `{ id: 0, code: "General" }` | `XlsxNumberFormat.kind(format)`: a tagged union `General`, `Date`, `ZeroPadded { width }`, `Fixed { decimals, thousands, percent, prefix, suffix }`, `Other`. `XlsxNumberFormat.builtin(id)` (an `Option`) holds ids 0 to 22, 37 to 40 and 45 to 49 |
| `XlsxValue` | tagged union: `Blank {}`, `Text { text }` (at most 32,767 characters), `Number { value: S.Finite }`, `Boolean { value }`, `Error { code }`, `Date { serial }` (a number whose format is a date or time), `Unreadable { raw }` (decision X4) | `XlsxValue.match`; `XlsxValue.isBlank` |
| `XlsxCell` | `{ column: XlsxColumn, value: XlsxValue, formula: Option<string>, format: XlsxNumberFormat }`; the formula without its `=`, and `value` its saved result (`Blank` when the file saved none) | `XlsxCell.shown(cell, system)`: the text Excel would display, an `Option` (decision X3 says for which formats); `XlsxCell.blank(column)` |

### The workbook (`XlsxWorkbook.schema.ts`, subpath `@beep/xlsx/XlsxWorkbook`)

| Schema | Definition | Behaviour beside it |
| --- | --- | --- |
| `XlsxSheetState` | `LiteralKit(["visible", "hidden", "veryHidden"])`, starting value `"visible"` | |
| `XlsxRow` | `{ number: XlsxRowNumber, hidden: boolean (false), cells: Array<XlsxCell> }`, cells in rising column order, none repeated | `XlsxRow.isBlank`; `XlsxRow.cellAt(row, column)` (an `Option`) |
| `XlsxSheetName` | 1 to 31 characters, none of `: \ / ? * [ ]`, as Excel allows | |
| `XlsxSheetInfo` | `{ name, state, declared: Option<XlsxRange> }`: what the workbook part alone says of a sheet. `declared` is the file's own `<dimension>`, kept as a claim and never used for extent | |
| `XlsxSheetCount` | `{ info: XlsxSheetInfo, rows: S.Int, rowsWithValues: S.Int, lastRow: Option<XlsxRowNumber> }` | what one counting pass learns of a sheet, without keeping it |
| `XlsxWorksheet` | `{ info, rows: Array<XlsxRow>, merges: Array<XlsxRange>, hiddenColumns: Array<XlsxColumn> }`, rows in rising order, none repeated | `XlsxWorksheet.extent` (an `Option<XlsxRange>` from the cells that hold something); `XlsxWorksheet.count` |
| `XlsxDroppedPart` | `{ path: bounded string, kind }`, `kind` a `LiteralKit(["theme", "styles", "drawing", "chart", "comments", "table", "pivot", "macros", "externalLink", "properties", "other"])` | |
| `XlsxWorkbook` | `{ dateSystem, sheets: NonEmptyArray<XlsxWorksheet>, dropped: Array<XlsxDroppedPart> ([]) }`, sheet names unique without regard to case | `XlsxWorkbook.sheet(workbook, name)` (an `Option`); `XlsxWorkbook.visible` |

### Options (`XlsxOptions.schema.ts`, subpath `@beep/xlsx/XlsxOptions`)

| Schema | Definition |
| --- | --- |
| `XlsxSheetChoice` | tagged union: `All {}` (the starting value), `Named { names: NonEmptyArray<XlsxSheetName> }`, `First {}` |
| `XlsxLimits` | `{ maxInputBytes, maxInflatedBytes, maxPartBytes (all S.ByteSize), maxParts, maxSheets, maxSharedStrings, maxRows (1,048,576), maxColumns (16,384), maxCellChars (32,767) }`, each with its starting value; the first two are decision X5 |
| `XlsxReadOptions` | `{ sheets: XlsxSheetChoice, limits: XlsxLimits }`; `XlsxReadOptions.default` is `make({})` |
| `XlsxCompression` | `LiteralKit(["deflate", "store"])`, starting value `"deflate"` |
| `XlsxWriteOptions` | `{ compression: XlsxCompression }` |
| `XlsxCodecOptions` | `{ read: XlsxReadOptions, write: XlsxWriteOptions }` |

### What was found (`XlsxDiagnostic.schema.ts`, `XlsxRead.schema.ts`)

`XlsxDiagnostic` is severity over kind, as `CsvDiagnostic` is: `XlsxWarning { finding }` and `XlsxFatal { finding }`,
each finding a member of a tagged union that carries exactly what it knows (no optional fields: a finding about a
cell has its `sheet` and `address`, a finding about a part has its `path`).

| Fatal findings | Warning findings |
| --- | --- |
| `NotAWorkbook { container }`, `MissingPart { path }`, `DuplicatePart { path }`, `DamagedArchive { kind, path }` (Effect's `ZipError` kinds), `DamagedXml { path, line, column, reason }` (Effect's `XmlError`, with `positions`), `LimitExceeded { limit, path }`, `NoSheets {}` | `UnreadableCell { sheet, address, reason }` (decision X4; `reason` a `LiteralKit(["sharedString", "number", "boolean", "errorCode", "date"])`), `BadAddress { sheet, row, raw }`, `RowOutOfOrder { sheet, row }`, `UnknownStyle { sheet, address, style }`, `FormatNotShown { sheet, code, cells }`, `FormulaWithoutResult { sheet, address }`, `FictitiousLeapDay { sheet, address }`, `DeclaredExtentWrong { sheet, declared, found }` |

`XlsxContainer` (`XlsxRead.schema.ts`) is what the first bytes and the names inside say the file is:
`LiteralKit(["workbook", "macroWorkbook", "encrypted", "legacyXls", "binaryWorkbook", "openDocument", "word", "otherZip", "otherOle", "notAnArchive"])`.
`XlsxRead` is `{ workbook, warnings: Array<XlsxWarning> }` with `XlsxRead.droppedKinds`. `XlsxDiagnostic.message`
gives each finding one sentence naming the part or the cell; the app writes its own sentences for the person and
never shows these.

### Errors (`XlsxError.errors.ts`, subpath `@beep/xlsx/XlsxError`)

`XlsxParseError { fatal: XlsxFatal, warnings }` and `XlsxStringifyError { reason }` (a workbook the format cannot
hold: only reachable by building one past the schema), both `S.TaggedError`. `ZipError` and `XmlError` never leave the
package: only the facade builds these two, from findings the engine returns as data.

### What round-trips, and what cannot

The law is about values, never bytes. For every workbook `w` the schema can generate,
`decode(encode(w))` equals `w`. For every readable file `b`, `decode(encode(decode(b)))` equals `decode(b)` with
`dropped` emptied: one pass and the round trip is stable.

| Round-trips | Read, reported in `dropped`, not written back |
| --- | --- |
| cell values and their kinds, error codes | fonts, fills, borders, every style but the number format |
| formula text and its saved result | column widths, row heights, frozen panes, selection |
| each cell's number format (id and code) | charts, drawings, images, pivots, slicers, comments, data validation, conditional formatting, tables, external links, macros, the theme, document properties |
| date serials and the date system | shared-string order; whether a string was shared or inline; whether a formula was shared or written out per cell |
| sheet names, order and state; merged ranges; hidden rows and columns | XML spacing and prefixes, the order of parts, compression, timestamps |

### Reading, part by part

```
bytes ─► XlsxContainer.of(bytes)                    first bytes and names; refuses OLE, .xlsb, .ods, Word
        ─► pass 1  Zip.decode, sheets skipped        [Content_Types].xml, workbook.xml and its rels, styles.xml
        │          (limits counted as bytes come)    (numFmts, cellXfs), sharedStrings.xml; duplicates refused
        ─► pass 2  Zip.decode, wanted sheets only    Xml.decode({ positions }) ► Xml.elements(["*", "*", "*"])
                                                     ► internal/sheet.ts ► XlsxRow, then merges and columns
```

Two passes over bytes already in memory, because the sheets come before the strings they point at (tried, above).
The package never holds more than the small parts, the shared strings and one row, until the caller keeps rows.
Names are matched by their local part (`x:row` is `row`): effect 4.1.4's `Xml` reports names as written and has no
namespace option.

Rule by rule, lenient reading (strict has no meaning here: there is no second grammar to be strict to, so there is
one mode and every oddity is a finding):

| In the file | Read as | Finding |
| --- | --- | --- |
| a cell with `t="s"` | `Text` from the shared strings; rich-text runs joined, phonetic runs (`rPh`) left out | |
| `t="inlineStr"`, `t="str"` | `Text` | |
| `t="b"`, `t="e"` | `Boolean`, `Error` | |
| no `t`, or `t="n"` | `Number`, or `Date` when the cell's format is a date or time | `FictitiousLeapDay` for serial 60 in the 1900 system |
| `t="d"` (an ISO date, Strict files) | `Date`, the serial worked out for the workbook's date system | |
| a cell with no value and no formula | left out of the row (a styled empty cell is not data) | |
| `<f>` with `<v>` | `formula` and the saved result | |
| `<f>` without `<v>` | `formula`, `Blank` | `FormulaWithoutResult` |
| a shared formula (`t="shared"`) | the master's text on the master; the cells that share it carry their saved result and `formula` only if the file wrote one | none: parity with today's reader decides this, see Rabbit holes |
| a cell or row with no `r` | placed after the one before it | |
| a row numbered lower than the one before | kept, sorted | `RowOutOfOrder` |
| a shared-string index past the table, text where a number belongs | decision X4 | `UnreadableCell` |
| a style index past `cellXfs` | format `General` | `UnknownStyle` |
| `<dimension>` that disagrees with the cells | ignored for extent | `DeclaredExtentWrong` |
| a part the model does not hold | named in `dropped` | |
| the same path twice in the archive | nothing read | fatal `DuplicatePart` |

`DuplicatePart` matters because `Zip.decode` reads local headers in order and never the central directory, while
Excel reads the central directory: a file built to show one sheet to Excel and another to this reader needs a
repeated or orphaned path. Refusing every repeated path closes the cheap half of that; the other half is a Rabbit
hole.

### Limits

`XlsxLimits` is checked as bytes are inflated, not from the sizes a file declares (LibreOffice declares none). A
limit passed is a fatal `LimitExceeded` in the typed channel with the part it happened in, never a defect, and the
stream ends there: `Zip.decode` would otherwise inflate the rest of a body to skip it. `Xml`'s own `maxTokenSize`,
`maxDepth` and `maxElementSize` are set from `maxCellChars` and `maxColumns`, so one hostile row cannot grow without
bound, and an `XmlError` of kind `Limit` becomes the same finding.

### The public surface

Exact exports in `package.json`, no `./internal/*`, no wildcard; every filename outside `internal/` and `index.ts`
carries its role (decision "file naming").

| Subpath | File | Exports |
| --- | --- | --- |
| `@beep/xlsx` | `src/index.ts` | documented barrel of the eight below |
| `@beep/xlsx/Xlsx` | `src/Xlsx.codec.ts` | `Xlsx`, `XlsxBoundCodec` |
| `@beep/xlsx/XlsxAddress` | `src/XlsxAddress.schema.ts` | `XlsxColumn`, `XlsxRowNumber`, `XlsxAddress`, `XlsxRange` |
| `@beep/xlsx/XlsxSerial` | `src/XlsxSerial.schema.ts` | `XlsxDateSystem`, `XlsxSerial`, `XlsxCalendar` |
| `@beep/xlsx/XlsxCell` | `src/XlsxCell.schema.ts` | `XlsxErrorCode`, `XlsxNumberFormat`, `XlsxValue`, `XlsxCell` |
| `@beep/xlsx/XlsxWorkbook` | `src/XlsxWorkbook.schema.ts` | `XlsxSheetState`, `XlsxRow`, `XlsxSheetName`, `XlsxSheetInfo`, `XlsxSheetCount`, `XlsxWorksheet`, `XlsxDroppedPart`, `XlsxWorkbook` |
| `@beep/xlsx/XlsxOptions` | `src/XlsxOptions.schema.ts` | the choices, limits and option schemas above |
| `@beep/xlsx/XlsxDiagnostic` | `src/XlsxDiagnostic.schema.ts` | the finding schemas, `XlsxWarning`, `XlsxFatal`, `XlsxDiagnostic` |
| `@beep/xlsx/XlsxRead` | `src/XlsxRead.schema.ts` | `XlsxContainer`, `XlsxRead` |
| `@beep/xlsx/XlsxError` | `src/XlsxError.errors.ts` | `XlsxParseError`, `XlsxStringifyError` |

`Xlsx`, a class of statics with a private constructor, as `Csv`:

| Static | Shape |
| --- | --- |
| `container` | `(bytes) => XlsxContainer`: pure, reads no part |
| `parseResult` / `parse` | `(bytes, options = XlsxReadOptions.default) => Result<XlsxRead, XlsxParseError>`; `Effect.fn("Xlsx.parse")` over `Effect.fromResult`. Reading is synchronous (tried), so the `Result` form exists |
| `sheets` | `(bytes, options) => Effect<ReadonlyArray<XlsxSheetCount>, XlsxParseError>`: every sheet counted, none kept |
| `rows` | `(bytes, sheet: XlsxSheetName, options) => Stream<XlsxRow, XlsxParseError>`: one sheet as it is read; its merges and hidden columns come from `sheetLayout(bytes, sheet)` |
| `stringify` | `(workbook, options = XlsxWriteOptions.default) => Effect<Uint8Array, XlsxStringifyError>`: an Effect because `deflate` needs the runtime's `CompressionStream` (tried: it cannot run synchronously) |
| `fromBytes` / `XlsxFromBytes` | `(options = XlsxCodecOptions.default) => S.Codec<XlsxWorkbook, Uint8Array>` and the default, pre-bound: `S.Uint8Array.pipe(S.decodeTo(XlsxWorkbook, SchemaTransformation.transformEffect({ decode, encode })))`, the form `Csv.fromBytes` already has. Decoded and encoded with Effect's effectful decoders only |
| `sheetFromBytes` | `(row: S.Codec<A, ...>, { sheet, header: "first" }) => S.Codec<ReadonlyArray<A>, Uint8Array>`: one sheet's rows under its first row as keys, each key an own property |
| `bind` | `(target, options) => XlsxBoundCodec<T>`: `{ schema, decode, encode }` |

A Schema codec has nowhere to put warnings, so it drops them; code that must show them calls `parse`, and the app's
adapter does.

### `internal/` (never exported; engine code never imports the facade)

| Module | Holds |
| --- | --- |
| `identity.ts` | `$XlsxId` |
| `container.ts` | the magic bytes and names behind `XlsxContainer`; the passes over `effect/encoding/Zip`, with the limits and the duplicate check. The only file importing `Zip` |
| `ooxml.ts` | local names, content types, relationships, a part's path from its relationship. The only file importing `effect/encoding/Xml` |
| `workbookPart.ts` | sheets, their states, the date system |
| `sharedStrings.ts` | the string table, rich-text runs joined |
| `styles.ts` | `numFmts` and `cellXfs` to a format per style index |
| `numberFormat.ts` | the grammar behind `XlsxNumberFormat.kind` and `XlsxCell.shown` |
| `serial.ts` | the arithmetic behind `XlsxSerial` |
| `sheet.ts` | a row tree to `XlsxRow`; merges; hidden columns |
| `writer.ts` | the parts a workbook is written as, and `Zip.file` / `Zip.encode` |
| `limits.ts` | the caps' guard |

The cycle firewall is the csv package's: an `internal/` module imports values only from the leaf schema files
(`XlsxAddress`, `XlsxSerial`) and everything else with `import type`.

### The worker boundary

The package starts no worker and touches no `File`, `Blob`, `window` or `self`: bytes in, values out, so it runs the
same in a browser worker, in Node and in a Worker on Cloudflare. The app keeps what it has: `reader.worker.ts`, the
`ReadMessage` protocol of plain fields (`internal/protocol.ts`), progress and Cancel. Schema values do not cross
between threads (a class and an `Option` do not survive the copy), so the adapter runs inside the worker and maps to
today's `Cell` there, as `xlsx.ts` does now.

### The app adapter

`packages/catalog/web/src/internal/spreadsheet/xlsx.ts` keeps `readXlsx`'s signature and swaps its body:

1. `Xlsx.sheets(bytes)` gives every sheet's count, which the sheet chooser shows and "the visible sheet with the most
   data" is picked from (`describeWorkbook`, `packages/catalog/model/src/Reading/SheetLayout.rules.ts`). Today that
   needs every sheet built; after the swap only the chosen one is.
2. `Xlsx.rows(bytes, chosen)` feeds the grid, reporting progress every 2,000 rows as now, out of the count from 1.
3. `XlsxValue` maps to today's `Cell { type, text, shown?, formula? }`: `numberText` and `dateText` stay where they
   are (`SheetLayout.rules.ts`), fed from `Number.value` and `XlsxSerial.toCalendar`; `shown` from `XlsxCell.shown`.
4. Findings map to today's Notes and problems by matching, never by string codes: a fatal finding gives
   `fileProblem.unreadable` (and `LimitExceeded` gives `tooManyBytes`, decision X5); `FormulaWithoutResult` feeds the
   `formulaWithoutResult` Note that `SheetLayout` already writes; `UnreadableCell` gives the Note of decision X4.

`read.ts`'s `sniff` keeps its sentences and takes its answer from `Xlsx.container` for the zip and OLE cases. What
stays in the app, untouched: the triage of PDFs, pictures and web pages; `SpreadsheetTable` and the Notes; the header
search, totals and second-table rules; the sheet chooser; `FileProblem`; staging, chunks, the upload and Cancel.

### Proof (the definition of done, written before the engine)

1. **Parity** (`packages/catalog/web/test/xlsxParity.test.ts`): the SheetJS `readXlsx` and the adapter give identical
   `SpreadsheetTable`s (cells with `type`, `text`, `shown` and `formula`, row numbers, Notes, the sheet list with
   counts, the chosen sheet and its reason) and identical problems over `date-1904`, `empty`, `libreoffice`, `messy`,
   `no-header` and `sheets`, over `old-format.xls` and `password.xlsx`, over the new fixtures below, and over
   workbooks SheetJS writes from generated tables. When they agree, the old reader's tables are written to
   `test/fixtures/xlsx-expected/*.json` (through `S.fromJsonString`) and the test compares with those, so it outlives
   the SheetJS reader, as `csv-expected` did papaparse. A place where the two readers differ and the new one is
   right is a finding for Benjamin with the cell and both readings, never a quiet change to the expected file.
2. **New fixtures** (`packages/foundation/modeling/xlsx/test/fixtures`, each built from hand-written parts by one
   committed script and named for what it holds): shared formulas; inline and `str` cells; rich text; a Strict
   workbook with `t="d"` dates; `x:`-prefixed XML; a `<dimension>` that lies; serials 59, 60 and 61; time-only cells;
   rows and cells without `r`; a repeated path; a sheet before and after its shared strings.
3. **Laws** (`Xlsx.property.test.ts`, `XlsxSchemas.property.test.ts`): the two round-trip laws above over generated
   workbooks, fixed run counts; "generates only valid values" over every exported schema; `XlsxAddress.parse` after
   `format` and `XlsxSerial.fromCalendar` after `toCalendar` are the identity.
4. **Hostile** (`hostile.test.ts`, generated in the test, never committed): a part that inflates past
   `maxInflatedBytes` from a few kilobytes, one cell of 20 MiB, 1,048,577 rows, a row of 16,385 cells, XML nested past
   `maxDepth`, a DOCTYPE with entities, a file cut short at every hundredth byte, and an encrypted entry each fail as
   their finding with the part named, never a defect, a stack overflow or a hang.
5. **Oracle** (decision X6): files the package writes are read by another reader to the same values, and files
   another writer made are read by the package to the same values.
6. **App**: the full check through turbo, the production build, the override sum no higher, and in a browser
   `sheets.xlsx` chosen (the chooser lists six sheets with today's counts, "Items" read), another sheet picked, and a
   workbook imported through Confirm with the result screen and the stored rows agreeing.

### How this brief obeys the schema rules

| Rule ([schema-first.md](../../docs/standards/schema-first.md)) | Where it shows |
| --- | --- |
| SF-1 keys annotated as keys | every field, element and member takes `S.annotateKey` first in its pipe; whole schemas take `$I.annoteSchema` |
| SF-2 Effect's own values | byte limits are `S.ByteSize`; the codec's encoded side is `S.Uint8Array`; `XlsxSerial.toDateTime` hands out `DateTime.Utc` where a day exists. A date cell holds its serial, not a `DateTime`: see deviation 1 |
| SF-3 normalised in the schema | none at this layer: a cell is kept as the file holds it. The row and cell order invariants are checks, and the reader sorts before it builds |
| SF-4 absence is `Option` | no optional field: `formula`, `declared`, `lastRow`, `extent` and `shown` are `Option`; what would be optional on a finding is in the member that always has it |
| SF-5 defaults on the schema | every option, limit and choice, `XlsxNumberFormat`, `XlsxSheetState`, `hidden` and `dropped` have constructor and decoding defaults; none is applied in code |
| SF-6 tagged unions | `XlsxValue`, `XlsxSheetChoice`, the format `kind`, every finding, severity over kind; plain modes are `LiteralKit`s |
| SF-7 generates only valid values | addresses, serials, text lengths and every limit are bounded; ranges, row order, cell order and unique sheet names are checks with arbitraries that satisfy them; the property test runs over every exported schema |
| SF-8 behaviour beside its data | `XlsxColumn.letters`, `XlsxAddress.parse`/`format`, `XlsxRange.contains`, `XlsxSerial.toCalendar`, `XlsxNumberFormat.kind`, `XlsxCell.shown`, `XlsxRow.cellAt`, `XlsxWorksheet.extent`, `XlsxWorkbook.sheet`, `XlsxDiagnostic.message` |
| SF-9 schema forms | plain data is branded `S.Opaque`; the two errors are `S.TaggedError`; no `S.Class`, since nothing has instance members |

### Deviations, and why

1. **A date is a serial, not a `DateTime`.** SF-2 asks a boundary to decode into Effect's own values. A workbook date
   has no time zone, and serial 60 names a day no `DateTime` can hold; the serial is also what must be written back
   for the round trip to be exact. `XlsxSerial.toDateTime` is the Effect value for every serial that has one.
2. **No strict mode.** `@beep/csv` has two because RFC 4180 is a stricter grammar than the files people bring. A
   workbook has one grammar; what varies is damage, which is findings.
3. **No streaming codec.** `Csv` has channels both ways. Here `rows` streams one sheet for reading, and writing is one
   shot: a workbook is written whole, since its shared strings and styles are known only at the end.
4. **`stringify` is an Effect.** `Csv.stringify` is pure. Deflate here is the runtime's, and asynchronous.
5. **Two engines from Effect inside.** `@beep/csv` uses Effect's `Csv` only as an oracle. Here `Zip` and `Xml` are the
   container readers, each behind one internal file (decision X1).

## Where the research was wrong

Against section 3 of [research/04-beep-direction.md](research/04-beep-direction.md):

| The report | What was found |
| --- | --- |
| "`@beep/xlsx` adds its own central-directory index", because sheets may precede the shared strings | The order is as it says, but an index is not needed: two `Zip.decode` passes over bytes already in memory do it, and skipping a 29 MB sheet costs 83 ms (tried). What the missing central directory does cost is `DuplicatePart` |
| "`Xlsx.listSheets` reads only the workbook part and rels, which is all the sheet chooser needs" | The chooser shows each sheet's row count and the reader picks the visible sheet with the most data (`readSpreadsheet.test.ts`, "picks the visible sheet with the most data"), so every sheet is counted. `Xlsx.sheets` counts without keeping |
| `Date: { serial, iso: S.String }` | An ISO string is not an Effect value (SF-2) and serial 60 has no ISO date. `Date { serial }`, with `XlsxSerial` beside it |
| `S.optionalKey` on `formula`, `numFmt`, `dimension` | SF-4: `Option`, or a starting value |
| "`makeBytesDecodeTo` is new code; it belongs beside `makeTextDecodeTo` in the vendored `@beep/utils/Schema`" | The vendored kit is never edited, and `Csv.fromBytes` already builds a bytes codec with `SchemaTransformation.transformEffect` in its own package. The same here |
| "If inflation is asynchronous, `parseResult` exists only for the synchronous inflater path" | Reading through `Zip.decode` runs under `Effect.runSync` (tried), so `parseResult` exists. Only deflated writing is asynchronous |
| Unverified: the 1900 leap-year rule; built-in date ids 14 to 22 and 45 to 47; `DecompressionStream("deflate-raw")` | Checked against SheetJS (serials 59, 60, 61; its format table) and in Node 26 (present, and not needed: `Zip.decode` has its own inflater) |
| Unverified: SheetJS's licence for use as an oracle | Apache-2.0 (`node_modules/xlsx/LICENSE`) |
| `namespaces: "strict"` is not on 4.1.4 | Confirmed in `node_modules/effect/src/encoding/Xml.ts`: `DecodeOptions` has `maxTokenSize`, `maxDepth` and `positions` only |
| A fifteen-code flat `XlsxDiagnostic { code, message, part, line?, column?, cell? }` | SF-4 and SF-6: findings are union members, each with what it always has |

[research/03-effect-modules.md](research/03-effect-modules.md) says nothing of `effect/encoding`; the two modules were
read in `node_modules/effect/src/encoding/Zip.ts` and `Xml.ts`. Both say of themselves "experimental and may receive
breaking changes in patch releases", `Zip` reads no central directory, no encryption and no method but store and
deflate, and `Xml` expands no DOCTYPE entity and reads no external resource.

## Decisions for Benjamin

Each is his. The first option of each is the recommendation, with its reason; nothing an answer would change is
built before it is given.

### X1. What inflates the archive and reads the XML?

`effect/encoding`'s `Zip` and `Xml` are marked experimental; the house rule is "write or vendor the engine".

- **Effect's `Zip` and `Xml`, each behind one internal file (Recommended).** The engine that is ours is the workbook
  reader; the archive and the XML are containers Effect already reads safely (no entity expansion, sizes and CRCs
  checked) and fast (50,000 rows in 283 ms against SheetJS's 1,192, tried). `effect` is pinned at 4.1.4 exactly, and
  the fixtures and the hostile tests are what an upgrade must pass. Nothing changes for the person's data.
- **Our own inflater and XML scanner in `internal/`.** Nothing experimental underneath and a central directory can
  be read, at the price of two more parsers to write and attack. The person sees no difference.
- **Keep SheetJS as the engine and wrap it in the schemas.** The codec exists soonest, but the third-party parser,
  the missing inflation cap and every sheet in memory all stay; it does not replace the reader, which is the goal.

### X2. What does the first version write?

- **The workbook's values (Recommended).** Cells with their kinds, formulas and saved results, number formats, the
  date system, sheet names, order and state, merged ranges, hidden rows and columns. Everything else in a file that
  was read is named in `dropped` and not written. It is what makes the codec two-way, as Benjamin described it, and
  every written file opens in Excel with its data. No screen writes a workbook in this goal; the app's downloads
  stay CSV.
- **Nothing: read only, writing in a later goal.** Smaller, but `fromBytes` would be half a codec and the round-trip
  laws, the strongest test of the reader, could not be written.
- **Values, and every unknown part carried through untouched.** A file read and written keeps its charts and
  styles. It breaks as soon as a sheet is rewritten, since those parts point into it; it waits for a use that edits
  a workbook in place.

### X3. For which number formats is the displayed text worked out?

The app keeps a cell's displayed text (`shown`) beside its value: a SKU stored as 123 under the format `00000` is
shown, and imported, as `00123`. SheetJS renders every format. In the six workbook fixtures 14 numeric cells have a
format other than `General`.

- **Dates and times, zero-padding, and one plain number pattern (Recommended):** digits with optional thousands
  separators, fixed decimals, a percent sign and a literal prefix or suffix, such as `$#,##0.00`. That covers every
  format in the fixtures (8 cells of `$#,##0.00`, for example 12.5 shown as "$12.50"; 1 of `00000`; 5 dates), so the
  parity test needs no exceptions. Any other format (fractions, scientific, formats with a section per sign, colours,
  locale codes) gives no displayed text, the cell reads by its value, and one Note names the format and counts its
  cells.
- **Dates and zero-padding only.** The smallest grammar. The 8 `$#,##0.00` cells in `messy.xlsx` lose their displayed
  text ("$12.50" becomes the value 12.5 alone), and the parity test carries that as a named exception.
- **Every format Excel has.** No cell ever loses its displayed text, at the cost of a renderer that is a project of
  its own (sections, fractions, scientific, elapsed time, locales).

### X4. What happens to a cell the file itself gets wrong?

A cell that points at a shared string that is not there, or says it is a number and holds text. No fixture has one
(0 of 173 cells); a damaged or hand-made file can.

- **Read the rest; the cell is `Unreadable` and the person is told (Recommended).** The row is read, the cell holds
  no value, and a Note names the cells ("2 cells could not be read: B14, D90") so the row lands in the review as any
  row with a missing value does. One bad cell does not cost the person the file, and nothing is loaded without a
  word.
- **Refuse the whole file as damaged.** Nothing doubtful is ever staged, but the person must repair a workbook they
  may not be able to open either.
- **Read the cell as empty, without a Note.** What a lenient reader usually does. It breaks the rule that no value
  changes silently, so it is listed only to be rejected.

### X5. How large may a workbook be?

Today: 3 MiB as chosen, because SheetJS needs about 180 MB of heap for 50,000 rows, and no cap on what the file
inflates to. Staging takes 50,000 rows at most whatever the format.

- **Keep 3 MiB, and add a cap of 64 MiB inflated (Recommended).** The swap then changes nothing the person can see:
  the same files are accepted and refused with the same sentence. The new cap only stops a file built to inflate
  without end (the tried 50,000-row, 15-column workbook is 27.6 MiB inflated at 9.3 MiB compressed, so an honest file
  under 3 MiB is far below 64). Raising the limit is then its own small decision, with measurements from the new
  reader.
- **Raise it to 10 MiB, as a CSV, with a cap of 200 MiB inflated.** The new reader keeps one sheet, so the reason
  for the lower limit is gone. More files are accepted in the same change that replaces the reader, which makes a
  parity failure harder to tell from a limit change.
- **Keep 3 MiB and add no cap.** Exactly today's behaviour, and today's exposure to a file that inflates a thousand
  times.

### X6. What becomes of SheetJS once the reader is swapped?

The SheetJS reader in `catalog-web` goes either way. The question is whether the library stays for tests.

- **Keep it as a devDependency of `@beep/xlsx` only, as the oracle (Recommended).** A round-trip law run by one
  reader and writer proves only that they agree with each other. SheetJS reading what the package writes, and the
  package reading what SheetJS writes from generated tables, is the independent check `effect/encoding/Csv` gives
  `@beep/csv`. It leaves the browser bundle and both runtime `package.json`s; the tarball address stays in the
  lockfile for development.
- **Remove it entirely.** No dependency from outside the registry anywhere. The expected tables frozen from the
  parity test and the hand-built fixtures remain; the writer is then checked only by our own reader, and by opening
  a written file in Excel by hand.
- **Remove it, and check written files with LibreOffice in the test run.** An independent reader with no library in
  the repository, but every machine and CI that runs the tests needs LibreOffice installed.

## Rabbit holes

- **Shared formulas.** SheetJS decides how many cells "hold a formula", and the app's Note counts them. The parity
  test, not a reading of the standard, settles whether the cells that share a formula carry its text; a difference
  goes to Benjamin with the count.
- **The half of the central-directory gap that `DuplicatePart` does not close**: an entry present in the archive and
  absent from the directory. Excel ignores it; this reader would see it. Only parts named by `workbook.xml`'s
  relationships are read, which makes an orphan harmless unless it takes a real part's path, and that is the
  duplicate. Say so in the package's README; do not write a directory reader for it.
- **Number-format grammar.** Whatever X3 answers, the format string has quoting (`"text"`, `\x`), sections (`;`),
  colours and conditions in brackets. The recogniser must refuse what it does not render, never guess.
- **`Xml.elements(["*", "*", "*"])` builds a tree per row.** At 15 columns it is fast (tried); a row of 16,384 cells
  is one large tree. `maxElementSize` bounds it; if a wide sheet is slow, read events directly in `internal/sheet.ts`
  behind the same function.
- **Progress.** Today the total comes from each sheet's declared range. The declared range is a claim; the count
  from `Xlsx.sheets` is exact, and costs the pass the chooser needs anyway.
- **`.xlsm`.** Read as today; the macro part is named in `dropped` and never opened.
- **Strict workbooks** use other namespace addresses and ISO dates in `t="d"`. Local-name matching reads them; the
  fixture proves it or the goal says it does not.
- **Effect patch releases.** `Zip` and `Xml` may change in a patch. `effect` stays pinned exactly; an upgrade is its
  own change, proved by this package's tests.

## No-gos

- No formula is evaluated. A formula's value is the one the file saved.
- No `.xls`, `.xlsb` or `.ods`, and no encrypted workbook: each is recognised and refused with today's sentence.
- No styles beyond the number format, no charts, pictures, pivots, comments, validation or tables, read or written.
- No editing a workbook in place, and no byte-for-byte round trip.
- No new download or screen in the app, and no reading of workbooks on the server, in this goal.
- No change to `SpreadsheetTable`, the Notes' sentences, the sheet chooser, staging or the upload protocol.
- No second reader left behind: when the goal closes, one code path reads a workbook.
- No edit to the vendored kit, and no dependency beyond `effect` and the kit at runtime.
- No change to what the CSV reader does.

## Map

| Today | After |
| --- | --- |
| `packages/catalog/web/src/internal/spreadsheet/xlsx.ts` (SheetJS) | the adapter over `@beep/xlsx`, same `readXlsx` signature |
| `packages/catalog/web/src/internal/spreadsheet/read.ts` `sniff`, zip and OLE cases | answers from `Xlsx.container`; sentences unchanged |
| `xlsx` in `packages/catalog/web/package.json` and `apps/inventory/package.json` | removed from both (a devDependency of `@beep/xlsx` under X6's first option) |
| `"xlsx/dist/xlsx.mini.min.js"` in `apps/inventory/vite.config.ts` `optimizeDeps` | removed |
| `packages/catalog/web/test/readSpreadsheet.test.ts` "Workbook" cases | stay, now over the adapter; `xlsxParity.test.ts` and `fixtures/xlsx-expected/` beside them |
| `packages/catalog/web/test/fixtures/spreadsheet/*.xlsx` | stay where the app's tests read them; the new fixtures live in the package |
| `numberText`, `dateText`, `describeWorkbook` in `packages/catalog/model/src/Reading/SheetLayout.rules.ts` | stay: they are the app's wording of a value, not the format |
| `maxFileBytes.xlsx` and its comment in `Spreadsheet.rules.ts` | as X5 answers; the comment's measurements redone with the new reader |
| nothing | `packages/foundation/modeling/xlsx` with the files above, `README.md`, `test/` |
| `scripts/check-boundaries.mjs`, `turbo.json`, root `tsconfig` references | the new package named where `@beep/csv` is |

## Order of moves

Each step leaves the check green and is one commit or a few.

1. The package's frame beside `@beep/csv`: manifest with exact exports, tsconfigs on the full profile, the boundary
   and turbo entries, an empty barrel.
2. The schemas, in the order of the Sketch, with `XlsxSchemas.property.test.ts`; then the behaviour beside them
   (`letters`, `parse`, `toCalendar`, `kind`, `shown`) with example tests from the fixtures' values.
3. Reading: `container.ts` and `ooxml.ts`, then the parts, then `sheet.ts`; `parse`, `sheets`, `rows`; the hostile
   tests.
4. Writing: `writer.ts`, `stringify`, the codecs; the round-trip laws; the oracle as X6 answers.
5. The adapter beside the SheetJS reader, and the parity test over fixtures and generated workbooks. Differences are
   settled here: fixed in the package, or put to Benjamin.
6. The expected tables frozen; the adapter becomes `readXlsx`; the SheetJS reader, its dependency entries and the
   `optimizeDeps` line removed; the browser pass; the documents that a moved fact made false.
