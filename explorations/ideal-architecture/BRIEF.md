---
type: Brief
title: "Brief: beep-csv"
description: The goal beep-csv, step 4 of the order of work. A canonical CSV table codec, @beep/csv, built beside today's papaparse reader, proved identical to it on every fixture, then swapped in.
---

# Brief: `beep-csv`

Step 4 of the order of work in [README.md](README.md). It rests on the answered decisions "CSV scope", "CSV default",
"file naming", "shared kit" and "strictness" in [DECISIONS.md](DECISIONS.md), and on section 3 of
[research/04-beep-direction.md](research/04-beep-direction.md). Where this brief and the report differ, this brief is
the later word and says why.

## Problem

The app reads a CSV with papaparse 5.7.1 (`apps/inventory/src/web/lib/spreadsheet/csv.ts`). Four things are wrong
with that for the repository it is becoming:

1. The house rule for `foundation/modeling` packages is "write or vendor the engine; a third-party parser is a test
   oracle only". papaparse is a runtime dependency with its own error model (`MissingQuotes`, `InvalidQuotes`), which
   the app re-reads by string code.
2. Its lenient rules are implicit. A stray quote after a closing quote makes papaparse keep searching for a closing
   quote, across line ends if need be; spaces between a closing quote and a delimiter vanish; one line ending is
   guessed from the first megabyte. None of this is written down, and the strict mode Effect ships
   (`effect/encoding/Csv`) refuses exactly the files a person brings.
3. Reading in pieces works only because `parseCsv` re-stitches papaparse's chunk callbacks
   (`test/web/readInPieces.test.ts` checks seven fixed piece sizes, not every split).
4. Nothing round-trips. The two CSV writers (`notImportedCsv` in `src/domain/ItemImport.ts`, `heldCsv` in
   `src/web/components/review/logic.ts`) each hand-roll quoting, with different line endings.

`@beep/csv` is the repository's first own format package, so it is also where the vendored kit, the full strict
profile, exact exports and role-suffixed filenames are first proved together.

## Appetite

Scope, not time. In:

- One package, `packages/foundation/modeling/csv` (`@beep/csv`), dependent only on `effect` and the vendored
  `@beep/identity`, `@beep/schema` and `@beep/utils`.
- Reading text and bytes to one table model, leniently by default and strictly on request; writing that model
  canonically; the same through streaming channels; the whole text round trip as one `effect/Schema` codec.
- One app adapter replacing `csv.ts`'s papaparse use, behind a differential test, then papaparse and
  `@types/papaparse` leave `apps/inventory/package.json`.

Out: everything in No-gos. The goal is done when the app reads every CSV fixture and both samples exactly as it does
today, through `@beep/csv`, with papaparse gone.

## Sketch

Schemas first, then the facade, then the engine, under [docs/standards/schema-first.md](../../docs/standards/schema-first.md)
(rules SF-1 to SF-9). Every Effect name below was checked in effect 4.1.4's source (`node_modules/effect/src`). The
schemas marked "tried" were written out, type-checked under the full profile and run: their defaults apply, and
`Arbitrary.schema` derives each of them and generates only values `S.is` accepts.

Conventions for every schema below, not repeated in each: plain data is
`class X extends S.Opaque<X, { readonly brand: unique symbol }>()(S.Struct({...}).pipe($I.annoteSchema("X", {...}))) {}`;
every field, element and member is described with `S.annotateKey` (or `$I.annoteKey`) placed first in its pipe; a
non-class schema ends with `$I.annoteSchema` and exports `type X = typeof X.Type`; a field with one canonical starting
value has `S.withConstructorDefault(...)` and `S.withDecodingDefaultTypeKey(...)`; every union of cases is a
`LiteralKit` discriminator mapped to member schemas and closed with `S.toTaggedUnion(...)`; `$I` is
`$CsvId.create("<File>")` (see deviation 9).

### Positions (`CsvPosition.schema.ts`, subpath `@beep/csv/CsvPosition`)

| Schema | Definition | Behaviour beside it |
| --- | --- | --- |
| `CsvIndex` (tried) | `S.Int.check(S.isBetween({ minimum: 0, maximum: MAX_TEXT_UNITS }))`, `MAX_TEXT_UNITS = 536_870_888`, the longest JavaScript string | |
| `CsvByteOffset` (tried) | `S.Int.check(S.isBetween({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER }))` | |
| `CsvTextSpan` (tried) | `{ offset, length, line, character }`, each a `CsvIndex`, 0-based, UTF-16 units of the decoded text | `CsvTextSpan.locate(text, offset, length)` (line and character from an offset, over `@beep/utils/Text`'s `lineCharacterAt`); `CsvTextSpan.render(span)` gives the 1-based "line:column" a message shows |
| `CsvRecordEnd` (tried) | `LiteralKit(["LF", "CRLF", "CR", "EndOfInput"])`: how a record ended; `EndOfInput` is the last record with no line break | `CsvRecordEnd.text` maps each to its characters (`"\n"`, `"\r\n"`, `"\r"`, `""`) |

### The table (`CsvTable.schema.ts`, subpath `@beep/csv/CsvTable`)

| Schema | Definition | Behaviour beside it |
| --- | --- | --- |
| `CsvCell` (tried) | `S.String.check(S.isMaxLength(MAX_TEXT_UNITS))`: a cell's text as written, never coerced | `CsvCell.needsQuotes(cell, delimiter)`: the canonical quoting rule (holds the delimiter, `"`, CR or LF, or starts with U+FEFF) |
| `CsvRecord` (tried) | `S.NonEmptyArray(CsvCell).check(S.isMaxLength(MAX_FIELDS))`, `MAX_FIELDS = 1_000_000`: never empty, a blank line is one empty cell | `CsvRecord.isBlank`: exactly one empty cell |
| `CsvTable` (tried) | `{ records: S.Array(CsvRecord) }`, `records` defaulting to `[]` | `CsvTable.width` (cells in the first record, `Option`); `CsvTable.ragged(table)` (the records whose width differs) |
| `CsvRecordSlice` | `{ cells: CsvRecord, record: CsvIndex, span: CsvTextSpan, end: CsvRecordEnd }`: one record in a stream and where it was | |

The table carries no header: the app searches for its header under title rows itself (`SheetLayout.ts`), so a header
is a view (`Csv.recordsFromString`), not part of the model.

### Choices and options (`CsvOptions.schema.ts`, subpath `@beep/csv/CsvOptions`)

A choice that carries data is a tagged union; a choice between plain modes is a `LiteralKit`, whose `.match` holds
the behaviour that depends on it.

| Schema | Members (default first) | Behaviour beside it |
| --- | --- | --- |
| `CsvDelimiter` | `LiteralKit([",", ";", "\t", "\|"])` | `CsvDelimiter.name`: "commas", "semicolons", "tabs", "vertical bars" |
| `CsvDelimiterChoice` (tried) | by `kind`: `detect { candidates: NonEmptyArray<CsvDelimiter> }` (candidates default `[",", "\t", "\|", ";"]`, papaparse's order) or `fixed { delimiter }` | `CsvDelimiterChoice.resolve(choice, sample)`: a `fixed` choice returns its delimiter; `detect` runs the sniff (below) |
| `CsvEncodingName` | `LiteralKit(["utf-8", "utf-16le", "utf-16be", "windows-1252"])` (Schema.ts has no text-encoding schema) | |
| `CsvEncodingChoice` | by `kind`: `detect { window: ByteSize }` (window default 64 KiB) or `fixed { encoding }` | |
| `CsvQuoteRule` (tried) | `LiteralKit(["lenient", "strict"])` | `CsvQuoteRule.judge(rule, finding)`: a quoting finding becomes a warning under `lenient`, a fatal under `strict` (dual, data-first and pipeable) |
| `CsvRaggedRule` | `LiteralKit(["keep", "pad", "reject"])` | `CsvRaggedRule.judge(rule, finding)` and `CsvRaggedRule.apply(rule, record, width)` |
| `CsvBlankLineRule` | `LiteralKit(["keep", "skip"])` | `CsvBlankLineRule.keeps(rule, record)` |
| `CsvTrimRule` | `LiteralKit(["none", "unquoted", "all"])` | `CsvTrimRule.apply(rule, cell, quoted)` |
| `CsvLimits` (tried) | `maxRecords` (1 to 2^31 - 1, default 10,000,000), `maxFieldsPerRecord` (1 to `MAX_FIELDS`, default 100,000), `maxFieldLength` and `maxRecordLength` (1 to `MAX_TEXT_UNITS` units, defaults 16 Mi and 64 Mi), `maxInputBytes: S.ByteSize` (default `ByteSize.mebibytes(256)`) | |
| `CsvReadOptions` (tried) | `delimiter: CsvDelimiterChoice` (`detect`), `encoding: CsvEncodingChoice` (`detect`), `quotes` (`lenient`), `ragged` (`keep`), `blankLines` (`keep`), `trim` (`none`), `excelSepHint: S.Boolean` (`false`), `limits: CsvLimits` (all defaults) | `CsvReadOptions.default = CsvReadOptions.make({})` |
| `CsvTerminator` | `LiteralKit(["CRLF", "LF"])` | |
| `CsvQuoteStyle` | `LiteralKit(["minimal", "always"])` | |
| `CsvFormulaGuard` | `LiteralKit(["none", "apostrophe"])` | `CsvFormulaGuard.apply(guard, cell)`: `apostrophe` prefixes `'` to a cell starting with `=`, `+`, `-`, `@`, tab or CR |
| `CsvWriteOptions` | `delimiter: CsvDelimiter` (`,`), `terminator` (`CRLF`, as RFC 4180 and Effect's encoder), `finalTerminator: S.Boolean` (`true`), `quoteStyle` (`minimal`), `bom: S.Boolean` (`false`), `formulaGuard` (`none`) | `CsvWriteOptions.default` |
| `CsvCodecOptions` | `read: CsvReadOptions`, `write: CsvWriteOptions`, each defaulting to its `default` | `CsvCodecOptions.default` |

`strict` is RFC 4180 as Effect's `Csv` reads it: a quote inside an unquoted field, or anything but a delimiter or a
line break after a closing quote, is fatal. The report's `nonNumeric` quote style and `tab` formula guard are left out:
nothing here asks for them.

### What was found, and how serious (`CsvDiagnostic.schema.ts`, subpath `@beep/csv/CsvDiagnostic`)

Two nested tagged unions: the severity, then the kind, each member carrying exactly its own fields. A kind that can be
either (a stray quote, a ragged record) is one member schema used in both unions; a kind that can only stop a read is
only in the fatal union, so an impossible warning cannot be built.

| Finding (by `kind`) | Fields | Warning | Fatal |
| --- | --- | --- | --- |
| `UnterminatedQuote` (tried) | `at: CsvTextSpan` (where the quote opened), `record`, `field` | | always |
| `StrayQuote` (tried) | `at`, `record`, `field`: a quote inside an unquoted field | `lenient` | `strict` |
| `TextAfterClosingQuote` | `at`, `record`, `field` | `lenient` | `strict` |
| `RaggedRecord` (tried) | `at`, `record`, `expected`, `actual` | `keep`, `pad` | `reject` |
| `MixedTerminators` | `at`, `first: CsvRecordEnd`, `other: CsvRecordEnd` | always | |
| `InvalidUtf8` (tried) | `byteOffset: CsvByteOffset` | | when UTF-8 was fixed, or chosen from a stream's first window |
| `EmptyHeader` | `field` | | header view only |
| `DuplicateHeader` | `field`, `firstField`, `name: CsvCell` | | header view only |
| `LimitExceeded` | `limit: LiteralKit(["records", "fieldsPerRecord", "fieldLength", "recordLength", "inputBytes"])`, `maximum`, `at` | | always |

```ts
export const CsvWarningFinding = LiteralKit(["StrayQuote", "TextAfterClosingQuote", "RaggedRecord", "MixedTerminators"])
  .mapMembers(() => Tuple.make(StrayQuote, TextAfterClosingQuote, RaggedRecord, MixedTerminators))
  .pipe(S.toTaggedUnion("kind"), $I.annoteSchema("CsvWarningFinding", { description: "What a read can go past" }))

export const CsvFatalFinding = LiteralKit([
  "UnterminatedQuote", "StrayQuote", "TextAfterClosingQuote", "RaggedRecord",
  "InvalidUtf8", "EmptyHeader", "DuplicateHeader", "LimitExceeded"
]).mapMembers(() => Tuple.make(/* the eight member schemas */))
  .pipe(S.toTaggedUnion("kind"), $I.annoteSchema("CsvFatalFinding", { description: "What stops a read" }))

export class CsvWarning extends S.Opaque<CsvWarning, { readonly brand: unique symbol }>()(
  S.Struct({
    severity: S.tag("warning"),
    finding: CsvWarningFinding.pipe(S.annotateKey({ description: "What was read past" }))
  }).pipe($I.annoteSchema("CsvWarning", { description: "An oddity the read went past; the person is told" }))
) {}
// CsvFatal: the same with severity "fatal" and CsvFatalFinding

export const CsvDiagnostic = LiteralKit(["warning", "fatal"])
  .mapMembers(() => Tuple.make(CsvWarning, CsvFatal))
  .pipe(S.toTaggedUnion("severity"), $I.annoteSchema("CsvDiagnostic", { description: "One finding and how serious" }))
```

Beside them: `CsvDiagnostic.message(diagnostic, text?)` renders the sentence (one `.match` per kind; a position shows
1-based through `CsvTextSpan.render`), and `CsvDiagnostic.order` sorts by position. The delimiter falling back to a
comma, a `sep=` line and a non-UTF-8 file are not warnings: they are members of the read result below, so they are
said once.

### What a read returns (`CsvRead.schema.ts`, subpath `@beep/csv/CsvRead`)

One struct whose varying parts are tagged unions, so no part is optional:

| Field | Schema (by discriminator) |
| --- | --- |
| `table` | `CsvTable` |
| `delimiter` | `CsvDelimiterFound` by `how`: `given { delimiter }`, `detected { delimiter }`, `sepLine { delimiter }` (from an honoured `sep=` line), `fallback { delimiter: "," }` (detection found no consistent delimiter) |
| `source` | `CsvSource` by `input`: `text { bom: S.Boolean }` or `bytes { encoding: CsvEncodingFound, bytes: S.ByteSize }` |
| `outcome` (tried) | `CsvOutcome` by `outcome`: `clean {}` or `noted { warnings: NonEmptyArray<CsvWarning> }` |

`CsvEncodingFound` by `how`: `bom { encoding: "utf-8" \| "utf-16le" \| "utf-16be" }`, `valid { encoding: "utf-8" }`,
`fallback { encoding: "windows-1252", firstInvalidByte: CsvByteOffset }` (today's rule), `given { encoding, bom }`.
`CsvRead.warnings(read)` returns the warnings, empty for `clean`.

### Errors (`CsvError.errors.ts`, subpath `@beep/csv/CsvError`)

```ts
export class CsvParseError extends S.TaggedError<CsvParseError, { readonly brand: unique symbol }>($I`CsvParseError`)(
  "CsvParseError",
  { diagnostics: S.NonEmptyArray(CsvFatal.annotateKey({ description: "One finding that stopped the read" })) },
  $I.annote("CsvParseError", { description: "Why a CSV could not be read" })
) {
  override get message() { /* "CSV parse failed with N errors: " + CsvDiagnostic.message of the first */ }
}
```

Inside a Schema codec a `CsvParseError` becomes `new SchemaIssue.InvalidValue({ message }, input)`, so callers of the
codecs see `S.SchemaError`. There is no stringify error: writing a `CsvTable` cannot fail (every string has a quoted
spelling, and v1 writes UTF-8 only), so `stringify` is a pure, total function.

### The machine's state (`internal/machine.ts`, not exported)

The parser's state between chunks is a schema too, so a property test can generate states and the chunk-invariance
law can be stated over them:

| Schema | Definition |
| --- | --- |
| `MachineMode` | by `mode`: `fieldStart`, `unquoted`, `quoted { openedAt: CsvTextSpan }`, `quoteInQuoted`, `afterQuoteSpaces { spaces: CsvIndex }` (papaparse's spaces between a closing quote and a delimiter) |
| `MachineState` | `{ mode: MachineMode, cells: S.Array(CsvCell), field: CsvCell, quoted: S.Array(S.Boolean), pendingCr: S.Boolean, position: CsvTextSpan, record: CsvIndex, firstEnd: Option<CsvRecordEnd>, width: Option<CsvIndex> }`, defaults for a fresh read |
| `RawRecord` | `{ cells: CsvRecord, quoted: NonEmptyArray<Boolean>, span: CsvTextSpan, end: CsvRecordEnd }`: what the machine emits, keeping per-cell quoting and each record's end so a byte-lossless `CsvDocument` can be added later without changing the machine |

`push(state, chunk) => { state, records, findings }` and `end(state) => { records, findings }` are pure. Inside one
chunk the loop keeps the state in local variables for speed and builds a `MachineState` only at the chunk's end, so
the schema costs nothing per character.

### What round-trips, and what cannot

| Law | Holds on | Test |
| --- | --- | --- |
| `decode(encode(t)) = t` | every `CsvTable` (from `Arbitrary.schema(CsvTable)`), every `CsvWriteOptions` with `formulaGuard: "none"`, read back with default `CsvReadOptions` | `Csv.property.test.ts` |
| `encode(decode(s)) = s` | canonical text only (text produced by `encode`): minimal quoting, one terminator, a final terminator, no BOM, a lone empty cell written `""` | same file |
| chunk invariance | text: every split, including between `\r` and `\n` and inside `""`; bytes: every split, including inside a UTF-8 sequence, with the encoding fixed | same file: random split points; streamed slices and findings equal the one-shot read |
| every schema generates only valid values | every exported schema and `MachineState` | `CsvSchemas.property.test.ts` |
| not lossless | arbitrary text: quoting choices, terminators, a BOM and spaces after a closing quote are normalised away; under `encoding: detect`, bytes decode is many-to-one | stated, not tested |

### Lenient reading, rule by rule

papaparse's rules as the app meets them today, written down; the differential test holds them to it.

| Input | `lenient` (default) | `strict` |
| --- | --- | --- |
| BOM at offset 0 | stripped, recorded in `source` | same |
| `\n`, `\r\n`, `\r` | each ends a record; more than one style is a `MixedTerminators` warning | same |
| a final line break | ends the last record, makes no new one | same |
| a blank line | one empty cell | same |
| quoted field with `""` | one `"` | same |
| `"abc"   ,` (spaces, then a delimiter or line break) | `abc` | fatal `TextAfterClosingQuote` |
| `"12" long,x` | `TextAfterClosingQuote` warning; that quote is text and the field stays quoted until a quote followed by optional spaces and a delimiter, a line break or the end | fatal |
| `ab"c` | `ab"c`, `StrayQuote` warning | fatal |
| a quote opened, never closed | fatal `UnterminatedQuote` at the record and line where it opened | same |
| ragged records | per `CsvRaggedRule` | same |
| `sep=;` first line | only with `excelSepHint` | same |

Detection (`CsvDelimiterChoice.resolve`, over `internal/sniff.ts`) is papaparse's rule over the same first ten
records: for each candidate in order, the sum of field-count changes between consecutive records and the average
count; the lowest change with an average above 1.99 wins, ties to the higher average; when none wins, a comma, as
`fallback`. papaparse also tries two control characters (U+001E, U+001F), which the app names a comma anyway.

### Limits and streaming

`CsvLimits` caps are checked as cells grow and fail as `LimitExceeded` in the typed channel, never as a defect or a
stack overflow (toml's `internal/limits.ts` pattern). Memory is bounded by `maxRecordLength`, not the file.

`Channel.mapAccum(initial, f, { onHalt })` (effect `Channel.ts`) carries `MachineState` between chunks; its `onHalt`
is synchronous and cannot fail, so it emits the final step's findings as data and a following map fails the channel
on a fatal one. `Channel.decodeText` with `fatal: true` would turn bad UTF-8 into a defect, so the bytes path
validates UTF-8 itself (`internal/encoding.ts`, with byte offsets) before decoding.

Bytes: BOM `EF BB BF` is UTF-8, `FF FE` and `FE FF` UTF-16; otherwise valid UTF-8 is UTF-8 and anything else is
Windows-1252, as `CsvEncodingFound.fallback`. A stream decides within its `detect` window; invalid UTF-8 after it is a
fatal `InvalidUtf8` rather than mixed encodings. The one-shot `parseBytes` sees every byte, as the app does today.

### The public surface

Exact exports in `package.json`, no `./internal/*`, no wildcard:

| Subpath | File | Exports |
| --- | --- | --- |
| `@beep/csv` | `src/index.ts` | documented barrel of the seven below |
| `@beep/csv/Csv` | `src/Csv.codec.ts` | `Csv`, `CsvBoundCodec` |
| `@beep/csv/CsvPosition` | `src/CsvPosition.schema.ts` | `CsvIndex`, `CsvByteOffset`, `CsvTextSpan`, `CsvRecordEnd` |
| `@beep/csv/CsvTable` | `src/CsvTable.schema.ts` | `CsvCell`, `CsvRecord`, `CsvTable`, `CsvRecordSlice` |
| `@beep/csv/CsvOptions` | `src/CsvOptions.schema.ts` | the choices, rules, limits and option schemas above |
| `@beep/csv/CsvDiagnostic` | `src/CsvDiagnostic.schema.ts` | the nine finding schemas, `CsvWarningFinding`, `CsvFatalFinding`, `CsvWarning`, `CsvFatal`, `CsvDiagnostic` |
| `@beep/csv/CsvRead` | `src/CsvRead.schema.ts` | `CsvDelimiterFound`, `CsvEncodingFound`, `CsvSource`, `CsvOutcome`, `CsvRead` |
| `@beep/csv/CsvError` | `src/CsvError.errors.ts` | `CsvParseError` |

`Csv`, a class of statics with a private constructor, as `Toml`:

| Static | Shape |
| --- | --- |
| `parseResult` / `parse` | `(text, options = CsvReadOptions.default) => Result<CsvRead, CsvParseError>`; `Effect.fn("Csv.parse")` over `Effect.fromResult` |
| `parseBytesResult` / `parseBytes` | the same over `Uint8Array`; `source` is `bytes` |
| `stringify` / `stringifyBytes` | `(table, options = CsvWriteOptions.default) => string` / `Uint8Array` (UTF-8); pure |
| `fromString` / `CsvFromString` | `(options = CsvCodecOptions.default) => S.Codec<CsvTable, string>` / the default, pre-bound |
| `fromBytes` | `(options) => S.Codec<CsvTable, Uint8Array>`, `S.Uint8Array` the encoded side |
| `recordsFromString` | `(options) => S.Codec<ReadonlyArray<{ readonly [name: string]: CsvCell }>, string>`: first record the header; `EmptyHeader` and `DuplicateHeader` fatal; keys set as own properties (`setOwnProperty` from `@beep/utils/Record`) |
| `schema` | `TextDecodeTo<CsvCodecOptions>` = `makeTextDecodeTo(recordsFromString)` from `@beep/utils/Schema` |
| `bind` | `(target, options) => CsvBoundCodec<T>`: `{ schema, decode, encode }` |
| `decodeString` / `decode` | `(options) => Channel<NonEmptyReadonlyArray<CsvRecordSlice>, IE \| CsvParseError, Done, NonEmptyReadonlyArray<string \| Uint8Array>, IE, Done>`, the shape of Effect's `Csv.decodeString`/`decode` |
| `decodeSchema(row)` | bytes to rows through the header view, adding `S.SchemaError` |
| `encodeString` / `encode` | `(options) => Channel<NonEmptyReadonlyArray<string \| Uint8Array>, IE, Done, NonEmptyReadonlyArray<CsvRecord>, IE, Done>` |

A Schema codec reads with the same defaults as `parse` but has nowhere to put warnings, so it drops them; code that
must show them calls `parse`, and the app's adapter does.

### `internal/` (never exported; engine code never imports the facade)

| Module | Holds |
| --- | --- |
| `identity.ts` | `$CsvId` (deviation 9) |
| `machine.ts` | `MachineMode`, `MachineState`, `RawRecord`; `push` and `end` |
| `sniff.ts` | delimiter detection, behind `CsvDelimiterChoice.resolve` |
| `encoding.ts` | BOM and UTF-16 detection, UTF-8 validation with byte offsets, the Windows-1252 decode |
| `writer.ts` | the writer loop over `CsvCell.needsQuotes`, `CsvFormulaGuard.apply` and the terminator |
| `header.ts` | the header view behind `recordsFromString` |
| `limits.ts` | the caps' guard |

The schema files hold the small behaviour (`needsQuotes`, `judge`, `locate`, `message`) and may call into
`internal/` (as `CsvDelimiterChoice.resolve` calls the sniff). So that no import cycle forms, an `internal/` module
imports values only from the leaf schema files (`CsvPosition`, `CsvTable`, which import nothing else from the
package) and everything else with `import type`; nothing in `internal/` imports the `Csv` facade (toml's cycle
firewall).

### The app adapter

`apps/inventory/src/web/lib/spreadsheet/csv.ts` keeps `readCsv`'s signature and Notes and swaps its body for
`Csv.parseBytesResult` (or `push` in pieces of `pieceChars`, for progress). The read result maps onto today's Notes by
matching, not by string codes: `CsvDelimiterFound` not a comma gives `delimiter`; `CsvEncodingFound.fallback` gives
`notUtf8`; each `TextAfterClosingQuote` warning (papaparse's `InvalidQuotes`) gives a row of `strayQuote`;
`StrayQuote` warnings, which papaparse never reported, stay unmapped until Benjamin wants a Note; a fatal
`UnterminatedQuote` gives today's `fileProblem.unreadable` with the same row.

### Proof (the definition of done, written before the engine)

1. **Differential** (`apps/inventory/test/web/csvDifferential.test.ts`): old `readCsv` and the adapter over every CSV
   fixture (`quoted`, `ragged`, `semicolon-crlf`, `tab`, `utf8-bom`, `windows-1252`), both samples (`items_clean.csv`,
   `items_messy.csv`) and `readInPieces.test.ts`'s generated text (stray quotes, quoted line breaks, an unclosed
   quote), each read whole and in pieces of 5, 37, 64, 255, 1000 and 4096 characters, give identical
   `SpreadsheetTable`s (cells, row numbers, Notes, format) and identical problems. When they agree, the old reader's
   tables are written to `test/fixtures/csv-expected/*.json` (through `S.fromJsonString`) and the test compares with
   those, so it survives papaparse's removal.
2. **Oracle** (`packages/foundation/modeling/csv/test/oracle.property.test.ts`, the one file importing
   `effect/encoding/Csv`): with `quotes: "strict"`, both parsers accept the same generated RFC 4180 text with the same
   records and refuse the same generated text with stray and trailing quotes; each reads the other's encoder output
   back unchanged.
3. **Laws** (`Csv.property.test.ts`, `CsvSchemas.property.test.ts`): the round-trip table above, fixed run counts.
4. **Hostile** (`hostile.test.ts`): a 20 MiB single field, 100,001 records under `maxRecords: 100000`, an unclosed
   quote at the start of a large file and a 100,001-column record each fail as `LimitExceeded` or
   `UnterminatedQuote` with their position, never a defect or a stack overflow.
5. **App**: the full check through turbo, the production build, and `items_messy.csv` imported in a browser through
   Confirm: rows in the file, the result screen and the stored rows agree (200 rows, 155 stored).

### How this brief obeys the schema rules

| Rule ([schema-first.md](../../docs/standards/schema-first.md)) | Where it shows |
| --- | --- |
| SF-1 keys annotated as keys | every field, element and member above takes `S.annotateKey` first in its pipe; only whole schemas take `$I.annoteSchema`, classes `$I.annote` |
| SF-2 Effect's own values | `maxInputBytes`, the `detect` window and `CsvSource.bytes.bytes` are `S.ByteSize`; the bytes codec's encoded side is `S.Uint8Array`; positions are bounded integers. No time, duration or secret occurs. Text encodings have no Schema.ts schema, so `CsvEncodingName` is a `LiteralKit` |
| SF-3 normalised in the schema | none needed at this layer: a CSV cell is kept exactly as written (the table is canonical, not normalised); `trim` is a read rule applied by the machine because it depends on whether a cell was quoted, which no schema sees. The app's own normalising (codes, units) stays in its domain schemas |
| SF-4 absence is `Option` | no optional field anywhere: `CsvTable.width` and `MachineState.firstEnd`/`width` are `Option`; what was optional before (`encoding`, the diagnostic's `record`/`field`/`byteOffset`) moved into the union member that always has it |
| SF-5 defaults on the schema | every option, limit and choice has its constructor and decoding default; `CsvReadOptions.default` is `make({})`; `CsvTable.records` defaults to `[]`; no default is applied in code |
| SF-6 tagged unions | `CsvDelimiterChoice`, `CsvEncodingChoice`, `CsvDelimiterFound`, `CsvEncodingFound`, `CsvSource`, `CsvOutcome`, `MachineMode`, and severity over kind in `CsvDiagnostic`; plain modes are `LiteralKit`s with `.match` behaviour |
| SF-7 generates only valid values | `CsvIndex`, `CsvCell`, `CsvRecord` and every limit are bounded; `CsvSchemas.property.test.ts` runs "generates only valid values" over every exported schema and `MachineState` |
| SF-8 behaviour beside its data | `CsvTextSpan.locate`/`render`, `CsvCell.needsQuotes`, `CsvRecord.isBlank`, `CsvTable.width`/`ragged`, `CsvDelimiterChoice.resolve`, the rules' `judge`/`apply`, `CsvFormulaGuard.apply`, `CsvDiagnostic.message`/`order`, `CsvRead.warnings` |
| SF-9 schema forms | plain data is branded `S.Opaque`; the error is `S.TaggedError`; no `S.Class` is needed, since nothing has instance members |

### Where this deviates from the four exemplars, and why

Read in full: `@beep/toml`, `@beep/jsonl`, `@beep/jsonc` and `@beep/yaml` at beep-effect commit `c5cebd5c9de7`.

1. **Role-suffixed filenames, exact exports, no `./internal/*` export.** The exemplars are flat and export
   `./internal/*` and `./*`. Decided ("file naming"); internal tests import engine modules by relative path.
2. **Tests import `@effect/vitest` directly, with fixed run counts.** The exemplars use `@beep/test-runner` and
   `@beep/fc-runs`, which are not vendored.
3. **No docgen, biome or `beep-cli` gates.** Every export still gets JSDoc with a titled example and a category; no
   tool here compiles the examples. The type-check, oxlint, oxfmt and the tests are the gate.
4. **Options are schemas with their defaults on them.** Toml and Yaml declare `S.optionalKey` options and apply
   defaults in code; Jsonc puts constructor and decoding defaults on the schema, which this package follows (SF-5).
5. **Diagnostics are nested tagged unions.** The exemplars use one struct with a flat code union and fatality by
   channel; here severity and kind are unions and each kind carries exactly its fields (SF-6). Positions are bounded
   integers, not `S.Finite` (SF-7).
6. **Channels have no exemplar.** jsonl reads files by pages and has no decode channel; the channel signatures copy
   Effect's own `encoding/Csv`, so the two are interchangeable in a pipeline.
7. **The codec decodes to a model, not `S.Unknown`.** A CSV is always a table, so `fromString` is
   `Codec<CsvTable, string>` and the header view carries `schema` and `bind`.
8. **No stringify error, and warnings are success data.** Writing is total in v1, so `stringify` has no
   `Result`/`Effect` twin (anatomy 6 allows a pure operation without either); a lenient read succeeds with its
   warnings in `CsvRead.outcome`, because the person must get their rows and be told.
9. **`$CsvId` is not in `@beep/identity/packages`.** The vendored file must stay byte-identical to beep-effect, which
   has no `csv` entry, so `internal/identity.ts` composes it from the root (`$I.compose("csv").$CsvId`, tried), giving
   the same `@beep/csv/...` identifiers. It moves into `packages.ts` when `@beep/csv` is promoted to beep-effect.
10. **The oracle is Effect itself**, not a devDependency: no third-party parser is installed.

## Rabbit holes

- **papaparse's exact leniency** goes beyond the fixtures (comments, escape characters other than `"`, the two control
  delimiters). Match what the differential corpus exercises; anything else is written down as a known difference, not
  chased.
- **Mixed line endings.** papaparse guesses one line ending per file, so a lone `\n` inside an unquoted field of a
  CRLF file is data to it and a record break to us. No fixture has one (`items_messy.csv` has two lone `\n`, both
  inside quotes). If a case appears, the new rule stands and the expectation is re-recorded with the reason.
- **Progress.** The adapter must keep the progress the upload screen shows (rows read, rising, exact at the end); the
  push machine reports records after each piece rather than papaparse's cursor.
- **workerd's `TextDecoder`** for `windows-1252` and `utf-16be` is unverified; the reader runs in the browser's worker
  today, so the app does not depend on it in v1.
- **Header keys** named `__proto__` or `constructor`: own data properties only.
- **Schemas in the hot loop.** Building a `MachineState` or a finding per character would cost more than the parse;
  the machine keeps local variables inside a chunk and builds schema values only at a chunk's end and for each
  finding. The chunk-invariance property is what proves the two agree.

## No-gos

- No byte-lossless `CsvDocument` in v1 (decided).
- No writer switch in the app: `notImportedCsv` and `heldCsv` keep their own quoting until Benjamin decides whether the
  downloads get a BOM and the formula guard. The package offers both.
- No UTF-16 files in the app: `read.ts` refuses them as binary today, and accepting them is a product change, not
  parity.
- No Windows-1252 writing; no delimiters beyond the four; no quote character other than `"`; no comment lines.
- `@beep/xlsx` is not touched.
- No change to `SheetLayout.ts`, header search or any Note's wording.

## Map

| Part | Goal | Cites |
| --- | --- | --- |
| Vendored kit (`@beep/types`, `@beep/identity`, `@beep/schema`, `@beep/utils` subsets) | step 3, done before this goal | `packages/foundation/*/*/vendor.json` |
| Schemas: `CsvPosition`, `CsvTable`, `CsvOptions`, `CsvDiagnostic`, `CsvRead`, `CsvError`, `MachineState`, each with its behaviour | `beep-csv`, slice 1 | NET-NEW; patterns from beep-effect `packages/foundation/modeling/toml/src/Toml.ts`, `jsonl/src/LineSlice.ts`, `scratchpad/osdk` (tagged unions over `LiteralKit`, defaults on fields); rules in `docs/standards/schema-first.md` |
| Engine: `machine`, `sniff`, `encoding`, `limits`, `diagnostics` | `beep-csv`, slice 1 | NET-NEW; rules from `apps/inventory/src/web/lib/spreadsheet/csv.ts` (`decode`, delimiter set) and papaparse's documented behaviour |
| Facade one-shot + Schema codecs | `beep-csv`, slice 1 | NET-NEW over `@beep/utils/Schema` `makeTextDecodeTo` |
| Differential + oracle + law tests | `beep-csv`, slice 1 (written first) | `apps/inventory/test/web/readSpreadsheet.test.ts`, `readInPieces.test.ts`, `test/fixtures/spreadsheet/*.csv`, `public/samples/*.csv`; `effect/encoding/Csv` |
| App adapter, papaparse removed | `beep-csv`, slice 2 | `apps/inventory/src/web/lib/spreadsheet/csv.ts`, `read.ts` |
| Channels (`decodeString`, `decode`, `decodeSchema`, `encodeString`, `encode`) | `beep-csv`, slice 3 | NET-NEW; signatures from `effect/encoding/Csv` |
| Writer, `stringify`, header view | `beep-csv`, slice 3 | NET-NEW; quoting from `ItemImport.ts` `csvCell` |
| App writers on `Csv.stringify` | later, when Benjamin decides BOM and formula guard for the downloads | `ItemImport.ts` `notImportedCsv`, `review/logic.ts` `heldCsv` |
| UTF-16 accepted by the app | later, when Benjamin wants it | `read.ts` sniff |
| `CsvDocument` (byte-lossless) | later, when something edits a CSV in place | the machine's raw records |
| `$CsvId` registered upstream | later, when `@beep/csv` is promoted to beep-effect | beep-effect `packages/foundation/modeling/identity/src/packages.ts` |

The first vertical slice is slices 1 and 2 together: schemas, engine and one-shot facade, proved by the differential
test, then the app switched and papaparse removed. Slice 3 completes the package's public surface.
