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

Schemas first, then the facade, then the engine. Every name below is a planned export; every Effect API named was
checked against effect 4.1.4's source in `node_modules/effect/src` (the version both repositories pin).

### The table model (`CsvTable.schema.ts`, subpath `@beep/csv/CsvTable`)

```ts
const $I = $CsvId.create("CsvTable")

/** One record: its cells as written, never coerced. Never empty: a blank line reads as one empty cell. */
export const CsvRecord = S.NonEmptyArray(S.String)                       // readonly [string, ...string[]]

/** The canonical decoded side of every codec. */
export class CsvTable extends S.Opaque<CsvTable, { readonly brand: unique symbol }>()(
  S.Struct({ records: S.Array(CsvRecord) })
) {}

/** How a record ended in the source. "" = the last record, with no line break after it. */
export const CsvTerminator = LiteralKit(["\n", "\r\n", "\r", ""])

/** One record in a stream, with where it was. All positions 0-based, in UTF-16 units of the decoded text. */
export class CsvRecordSlice extends S.Opaque<CsvRecordSlice, { readonly brand: unique symbol }>()(
  S.Struct({ cells: CsvRecord, record: Count, line: Count, offset: Count, length: Count, terminator: CsvTerminator })
) {}

/** What a one-shot read returns: the table, and what was found on the way. */
export class CsvParsed extends S.Opaque<CsvParsed, { readonly brand: unique symbol }>()(
  S.Struct({
    table: CsvTable,
    dialect: CsvDialect,                                  // the delimiter used, detected or given
    bom: S.Boolean,                                       // a byte-order mark was stripped
    encoding: S.optionalKey(CsvEncodingName),             // bytes input only
    warnings: S.Array(CsvDiagnostic)                      // every oddity read past; empty when strict succeeded
  })
) {}
```

`Count` is `S.Int.check(S.isGreaterThanOrEqualTo(0))`, as jsonl's `ByteCount`. The table carries no header: the app
searches for its header under title rows itself (`SheetLayout.ts`), so a header is a view, `Csv.recordsFromString`,
not part of the model. This drops the report's `header: S.Option(...)` field, and with it the unverified question of
`S.Option`'s encoded form.

### Options and dialect (`CsvOptions.schema.ts`, subpath `@beep/csv/CsvOptions`)

All `S.Opaque` structs of `S.optionalKey` fields; defaults applied in code, as `TomlStringifyOptions`.

| Schema | Fields (default) |
| --- | --- |
| `CsvDelimiter` | `LiteralKit([",", ";", "\t", "\|"])`: the four the app knows and names |
| `CsvDialect` | `delimiter: CsvDelimiter` (`,`); the quote is always `"` in v1 |
| `CsvEncodingName` | `LiteralKit(["utf-8", "utf-16le", "utf-16be", "windows-1252"])` |
| `CsvLimits` | `maxRecords` (10,000,000), `maxFieldsPerRecord` (100,000), `maxFieldLength` (16 Mi units), `maxRecordLength` (64 Mi units); the app passes its own |
| `CsvReadOptions` | `delimiter: CsvDelimiter \| "detect"` (`detect`); `quotes: "lenient" \| "strict"` (`lenient`); `ragged: "keep" \| "pad" \| "fail"` (`keep`); `blankLines: "keep" \| "skip"` (`keep`); `trim: "none" \| "unquoted" \| "all"` (`none`); `excelSepHint: S.Boolean` (`false`); `encoding: CsvEncodingName \| "detect"` (`detect`, bytes only); `limits: CsvLimits` |
| `CsvWriteOptions` | `delimiter` (`,`); `terminator: "\n" \| "\r\n"` (`"\r\n"`, as RFC 4180 and Effect's encoder); `finalTerminator` (`true`); `quoteStyle: "minimal" \| "always"` (`minimal`); `bom` (`false`); `formulaGuard: "none" \| "apostrophe"` (`none`) |
| `CsvCodecOptions` | `read: CsvReadOptions`, `write: CsvWriteOptions` |

`quotes: "strict"` is RFC 4180 as Effect's `Csv` reads it: a quote inside an unquoted field, or anything but a
delimiter or line break after a closing quote, fails. The report's `nonNumeric` quote style and `tab` formula guard
are left out: nothing here asks for them.

### Diagnostics and errors (`CsvDiagnostic.schema.ts`, `CsvError.errors.ts`)

```ts
export const CsvDiagnosticCode = LiteralKit([
  // quoting
  "UnterminatedQuote",      // a quote opened and the input ended (always fatal)
  "StrayQuote",             // a quote inside an unquoted field (lenient: kept as text)
  "TextAfterClosingQuote",  // a closing quote followed by text (lenient: the quote is text and the field stays open)
  // shape
  "RaggedRecord",           // a record wider or narrower than the first (keep/pad: warning; fail: fatal)
  "MixedTerminators",       // more than one line-break style
  "DelimiterNotDetected",   // detection found no consistent delimiter; a comma was used
  "ExcelSepHint",           // a `sep=` first line was honoured and dropped
  // encoding (bytes input)
  "NotUtf8",                // not valid UTF-8, read as Windows-1252 (warning)
  "InvalidUtf8",            // invalid UTF-8 where UTF-8 was required or already chosen (fatal)
  // header view (recordsFromString)
  "EmptyHeader", "DuplicateHeader",
  // limits (always fatal)
  "TooManyRecords", "TooManyFields", "FieldTooLong", "RecordTooLong"
])

export class CsvDiagnostic extends S.Opaque<CsvDiagnostic, { readonly brand: unique symbol }>()(
  S.Struct({
    code: CsvDiagnosticCode,
    message: S.String,
    offset: Count, length: Count, line: Count, character: Count,   // in the decoded text, 0-based
    record: S.optionalKey(Count), field: S.optionalKey(Count),     // absent for encoding diagnostics
    byteOffset: S.optionalKey(Count)                               // encoding diagnostics only
  })
) {}

export class CsvParseError extends S.TaggedError<CsvParseError, { readonly brand: unique symbol }>($I`CsvParseError`)(
  "CsvParseError",
  { diagnostics: S.NonEmptyArray(CsvDiagnostic) }
) { override get message() { /* "CSV parse failed with N errors: <code> at <line+1>:<character+1> …" */ } }
```

One code list, not one per stage: whether a code is fatal is decided by the options, so the channel carries it (in
`CsvParseError.diagnostics` it was fatal, in `CsvParsed.warnings` it was read past). Inside a Schema codec a parse
failure becomes `new SchemaIssue.InvalidValue({ message: error.message }, input)`, so callers see `S.SchemaError`.

There is no `CsvStringifyError`: writing a `CsvTable` cannot fail (every string has a quoted spelling, and v1 writes
UTF-8 only), so `stringify` is pure and total. It returns when an encoding that can fail is added.

### What round-trips, and what cannot

| Law | Holds on | Test |
| --- | --- | --- |
| `decode(encode(t)) = t` | every `CsvTable`, every write option except `formulaGuard: "apostrophe"` (which changes cells on purpose) and `quotes`/`blankLines`/`trim` read options that drop data | `Csv.property.test.ts` over `Arbitrary` of `CsvTable` with quotes, delimiters, CR, LF, a leading U+FEFF and astral characters |
| `encode(decode(s)) = s` | canonical text only: minimal quoting, one terminator, a final terminator, no BOM, a lone empty cell written `""` | same file, over text produced by `encode` |
| chunk invariance | text: every split, including between `\r` and `\n` and inside `""`; bytes: every split, including inside a UTF-8 sequence, when the encoding is fixed | same file: random split points, streamed slices and warnings equal the one-shot read |
| not lossless | arbitrary text: quoting choices, terminators, a BOM and spaces after a closing quote are normalised away. Under `encoding: "detect"` bytes decode is many-to-one | stated, not tested |

Canonical quoting quotes a cell that holds the delimiter, `"`, CR or LF, starts with U+FEFF, or is the only cell of
its record and empty (so it does not read back as a blank line under `blankLines: "skip"`).

### Lenient reading, rule by rule

These are papaparse's rules as the app meets them today, written down; the differential test holds them to it.

| Input | Lenient | Strict |
| --- | --- | --- |
| BOM at offset 0 | stripped, `bom: true` | same |
| `\n`, `\r\n`, `\r` | each ends a record; more than one style warns `MixedTerminators` | same, no warning |
| a final line break | ends the last record, makes no new one | same |
| a blank line | one empty cell, `[""]` | same |
| quoted field with `""` | one `"` | same |
| `"abc"   ,` (spaces, then delimiter or line break) | `abc` | fails `TextAfterClosingQuote` |
| `"12" long,x` (text after a closing quote) | warning `TextAfterClosingQuote`; that quote is text and the field stays quoted until a quote followed by optional spaces and a delimiter, line break or end | fails |
| `ab"c` (quote in an unquoted field) | `ab"c`, warning `StrayQuote` | fails |
| quote opened, never closed | fails `UnterminatedQuote` at the record and line where it opened | same |
| ragged records | `keep`: as written, warning; `pad`: padded with `""`; `fail`: fatal | same |
| `sep=;` first line | only with `excelSepHint` | same |

Delimiter detection (`internal/sniff.ts`) is papaparse's rule over the same first ten records: for each of `,` `\t`
`|` `;` in that order, the sum of field-count changes between consecutive records and the average count; the lowest
change with an average above 1.99 wins, ties to the higher average; none wins, a comma and `DelimiterNotDetected`.
One difference: papaparse also tries two control characters (U+001E, U+001F), which the app maps to a comma anyway.

### Limits and streaming

The engine (`internal/machine.ts`) is one push-based state machine: states field-start, unquoted, quoted,
quote-in-quoted, after-quote-spaces, plus a pending-CR flag. It holds at most one partial record, so memory is bounded
by `maxRecordLength`, not by the file. `parseResult(text)` is `push(text)` then `end()`; the channels push each chunk.
Limits are checked as cells grow and fail with their codes in the typed channel, never as a defect or a stack
overflow (`internal/limits.ts`, toml's pattern).

`Channel.mapAccum(initial, f, { onHalt })` (Channel.ts:4991) carries the machine state between chunks, but its
`onHalt` is synchronous and cannot fail, so it emits the final step's result as data and a following map fails the
channel on a fatal one. `Channel.decodeText` with `fatal: true` would turn bad UTF-8 into a defect, so the bytes path
validates UTF-8 itself, with byte offsets, before decoding.

Bytes (`internal/encoding.ts`): BOM `EF BB BF` is UTF-8; `FF FE` and `FE FF` are UTF-16 LE and BE; otherwise valid
UTF-8 is UTF-8, and anything else is Windows-1252 with `NotUtf8` naming the first bad byte (today's rule). A stream
decides from its first 64 KiB; invalid UTF-8 found after that fails `InvalidUtf8` rather than mixing encodings. The
one-shot `parseBytes` sees every byte, as the app's reader does today.

### The public surface

Exact exports in `package.json`, no `./internal/*`, no wildcard:

| Subpath | File | Exports |
| --- | --- | --- |
| `@beep/csv` | `src/index.ts` | documented barrel re-exporting the five below |
| `@beep/csv/Csv` | `src/Csv.codec.ts` | `Csv` (the facade), `CsvBoundCodec` |
| `@beep/csv/CsvTable` | `src/CsvTable.schema.ts` | `CsvTable`, `CsvRecord`, `CsvRecordSlice`, `CsvTerminator`, `CsvParsed` |
| `@beep/csv/CsvOptions` | `src/CsvOptions.schema.ts` | `CsvDelimiter`, `CsvDialect`, `CsvEncodingName`, `CsvLimits`, `CsvReadOptions`, `CsvWriteOptions`, `CsvCodecOptions` |
| `@beep/csv/CsvDiagnostic` | `src/CsvDiagnostic.schema.ts` | `CsvDiagnosticCode`, `CsvDiagnostic` |
| `@beep/csv/CsvError` | `src/CsvError.errors.ts` | `CsvParseError` |

`Csv`, a class of statics with a private constructor, as `Toml`:

| Static | Shape |
| --- | --- |
| `parseResult` / `parse` | `(text, options?: CsvReadOptions) => Result<CsvParsed, CsvParseError>`; `Effect.fn("Csv.parse")` over `Effect.fromResult` |
| `parseBytesResult` / `parseBytes` | the same over `Uint8Array`; `CsvParsed.encoding` is set |
| `stringify` / `stringifyBytes` | `(table, options?: CsvWriteOptions) => string` / `Uint8Array` (UTF-8, BOM per option); pure |
| `sniff` | `(sample: string) => CsvDialect & { detected: boolean }`; pure |
| `fromString` / `CsvFromString` | `(options?: CsvCodecOptions) => S.Codec<CsvTable, string>` / the default, pre-bound |
| `fromBytes` | `(options?: CsvCodecOptions) => S.Codec<CsvTable, Uint8Array>` (`S.Uint8Array` encoded side) |
| `recordsFromString` | `(options?) => S.Codec<ReadonlyArray<{ readonly [k: string]: string }>, string>`: first record is the header; `EmptyHeader`/`DuplicateHeader` fail; keys set as own properties (`setOwnProperty` from `@beep/utils/Record`, so a `__proto__` heading is data) |
| `schema` | `TextDecodeTo<CsvCodecOptions>` = `makeTextDecodeTo(recordsFromString)` from `@beep/utils/Schema` |
| `bind` | `(target, options?) => CsvBoundCodec<T>`: `{ schema, decode, encode }` |
| `decodeString` / `decode` | `(options?) => Channel<NonEmptyReadonlyArray<CsvRecordSlice>, IE \| CsvParseError, Done, NonEmptyReadonlyArray<string \| Uint8Array>, IE, Done>`, the shape of Effect's `Csv.decodeString`/`decode` |
| `decodeSchema(row)` | bytes to rows through the header view, adding `S.SchemaError`, as Effect's `Csv.decodeSchema` |
| `encodeString` / `encode` | `(options?) => Channel<NonEmptyReadonlyArray<string \| Uint8Array>, IE, Done, NonEmptyReadonlyArray<CsvRecord>, IE, Done>` |

A Schema codec reads with the same defaults as `parse` but has nowhere to put warnings, so it drops them; code that
must show them calls `parse`. That is the app's case, and the adapter uses `parse`.

### `internal/` (never exported; engine code never imports the facade)

| Module | Holds |
| --- | --- |
| `identity.ts` | `$CsvId` (see deviation 9) |
| `machine.ts` | the only parser: push, end, raw records with per-field `quoted` flags and each record's terminator |
| `sniff.ts` | delimiter detection |
| `encoding.ts` | BOM and UTF-16 detection, UTF-8 validation with byte offsets, the Windows-1252 decode |
| `writer.ts` | quoting, terminators, BOM, the formula guard |
| `header.ts` | the header view behind `recordsFromString` |
| `diagnostics.ts` | raw diagnostic records; offset to line and character |
| `limits.ts` | the caps and the guard carrier |

The facade materialises `CsvDiagnostic`s from raw records (toml's cycle firewall). Raw records keep `quoted` and the
terminator so a byte-lossless `CsvDocument` can be added later without touching the machine.

### The app adapter

`apps/inventory/src/web/lib/spreadsheet/csv.ts` keeps `readCsv`'s signature and its Notes, and swaps its body:
`Csv.parseBytesResult` (or the push machine in pieces of `pieceChars`, for progress) instead of `decode` plus
`parseCsv`. Warnings map to today's Notes: `TextAfterClosingQuote` to `strayQuote` (papaparse's `InvalidQuotes`),
`NotUtf8` to `notUtf8`, the dialect to `delimiter`; `StrayQuote`, which papaparse never reported, stays unmapped
until Benjamin wants a Note for it. `UnterminatedQuote` becomes today's `fileProblem.unreadable` with the same row.

### Proof (the definition of done, written before the engine)

1. **Differential** (`apps/inventory/test/web/csvDifferential.test.ts`): old `readCsv` and the adapter over every CSV
   fixture (`quoted`, `ragged`, `semicolon-crlf`, `tab`, `utf8-bom`, `windows-1252`), both samples (`items_clean.csv`,
   `items_messy.csv`) and `readInPieces.test.ts`'s generated text (stray quotes, quoted line breaks, an unclosed
   quote), each read whole and in pieces of 5, 37, 64, 255, 1000 and 4096 characters, must give identical
   `SpreadsheetTable`s (cells, row numbers, notes, format) and identical problems. When they agree, the old reader's
   tables are written to `test/fixtures/csv-expected/*.json` and the test compares against those, so it survives
   papaparse's removal.
2. **Oracle** (`packages/foundation/modeling/csv/test/oracle.property.test.ts`, the one file that imports
   `effect/encoding/Csv`): with `quotes: "strict"`, both parsers accept the same generated RFC 4180 text with the
   same records, and both refuse the same generated text with stray and trailing quotes. Effect's encoder output reads
   back identically through ours, and ours through Effect's decoder.
3. **Laws** (`Csv.property.test.ts`): the three laws in the round-trip table, fixed run counts.
4. **Hostile** (`hostile.test.ts`): a 20 MiB single field, 100,001 records under `maxRecords: 100000`, an unclosed
   quote at the start of a large file and a 100,001-column record each fail typed with their code and position, never
   a defect or a stack overflow.
5. **App**: the full check through turbo, the production build, and `items_messy.csv` imported in a browser through
   Confirm: rows in the file, the result screen and the stored rows agree (200 rows, 155 stored).

### Where this deviates from the four exemplars, and why

Read in full: `@beep/toml`, `@beep/jsonl`, `@beep/jsonc` and `@beep/yaml` at beep-effect commit `c5cebd5c9de7`.

1. **Role-suffixed filenames, exact exports, no `./internal/*` export.** The exemplars are flat and export
   `./internal/*` and `./*`. Decided ("file naming"); internal tests import engine modules by relative path.
2. **Tests import `@effect/vitest` directly, with fixed run counts.** The exemplars use `@beep/test-runner` (an
   instrumented `it`) and `@beep/fc-runs`; neither is vendored, because they are test tooling outside the three
   decided packages.
3. **No docgen, biome or `beep-cli` gates.** Every export still gets JSDoc with an example and a category, but no
   tool here compiles the examples. The type-check, oxlint, oxfmt and the tests are the gate.
4. **Diagnostic positions are non-negative integers**, not `S.Finite` (toml, yaml): they are counts.
5. **Channels have no exemplar.** jsonl reads files by pages and has no decode channel; the channel signatures copy
   Effect's own `encoding/Csv` instead, so the two are interchangeable in a pipeline.
6. **The codec decodes to a model, not `S.Unknown`.** Toml, Jsonc and Yaml decode to `unknown`; a CSV is always a
   table, so `fromString` is `Codec<CsvTable, string>` and the header view carries `schema`/`bind`.
7. **No stringify error.** Writing is total in v1, so `stringify` has no `Result`/`Effect` twin (anatomy 6 allows a
   pure operation without either).
8. **Warnings are success data.** Toml fails on the first error and Jsonc fails when any error was recovered; a CSV
   read leniently succeeds with its warnings in `CsvParsed`, because the person must get their rows and be told.
9. **`$CsvId` is not in `@beep/identity/packages`.** The vendored file must stay byte-identical to beep-effect, which
   has no `csv` entry, so `internal/identity.ts` composes it from the root (`$I.compose("csv")`) and gives the same
   `@beep/csv/...` identifiers. It moves into `packages.ts` when `@beep/csv` is promoted to beep-effect.
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
| Schemas: `CsvTable`, `CsvOptions`, `CsvDiagnostic`, `CsvError` | `beep-csv`, slice 1 | NET-NEW; patterns from beep-effect `packages/foundation/modeling/toml/src/Toml.ts`, `TomlDiagnostic.ts`, `jsonl/src/LineSlice.ts` |
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
