---
type: Goal
title: "@beep/csv"
description: A canonical CSV table codec, @beep/csv, built beside the papaparse reader, proved identical to it on every fixture and both samples, then swapped into the app with papaparse removed.
status: active
from: explorations/ideal-architecture
---

# `@beep/csv`

Step 4 of the order of work in [the ideal-architecture exploration](../../explorations/ideal-architecture/README.md).
The design is [BRIEF.md](../../explorations/ideal-architecture/BRIEF.md) (its Sketch is the specification of the
package); the rules it follows are [docs/standards/schema-first.md](../../docs/standards/schema-first.md).

## Objective

The app reads every CSV through `@beep/csv`, a package of this repository's own, exactly as it read them through
papaparse: the same cells, row numbers, Notes and problems on every fixture and both samples. The package decodes any
dialect leniently (or strictly, agreeing with Effect's `Csv`) into one table model and writes it back canonically, as
one `effect/Schema` codec, with streaming channels.

## Non-goals

From the brief's No-gos: no byte-lossless `CsvDocument`; the app's two CSV downloads keep their own writers; no UTF-16
files in the app; no Windows-1252 writing, no delimiters beyond the four, no quote other than `"`, no comment lines;
`@beep/xlsx`, `SheetLayout.ts`, header search and every Note's wording untouched.

## Constraints

- The app keeps working at every commit: `items_messy.csv` (200 rows) imports to 155 stored, result screen, Items
  table and stored rows agreeing.
- Effect 4.1.4 only, every API checked in `node_modules/effect/src`; `Effect.fn`/`Effect.fnUntraced`; Effect
  collections, never `Map` or `Set`.
- The package passes the full type-check profile with no override; the schema-first standard applies throughout.
- Dependencies: `effect` and the vendored `@beep/identity`, `@beep/schema`, `@beep/utils`; nothing else at run time.
- bun only; nothing pushed or deployed.

## Acceptance

- [ ] `packages/foundation/modeling/csv` exists with exactly the export subpaths the brief lists, role-suffixed files,
      no `./internal/*` export (`package.json` read).
- [ ] Every exported schema and `MachineState` generates only valid values (`CsvSchemas.property.test.ts`).
- [ ] Round trip: `decode(encode(t)) = t` for generated tables, `encode(decode(s)) = s` for canonical text
      (`Csv.property.test.ts`).
- [ ] Chunk invariance on text and on bytes with a fixed encoding (`Csv.property.test.ts`).
- [ ] Strict mode agrees with `effect/encoding/Csv` on generated RFC 4180 text, accepted and refused
      (`oracle.property.test.ts`).
- [ ] Hostile inputs fail typed, never a defect (`hostile.test.ts`).
- [ ] Differential: old reader and adapter give identical tables and problems on the six CSV fixtures, both samples
      and the generated text, whole and in six piece sizes; the old reader's results are recorded under
      `apps/inventory/test/fixtures/csv-expected/` and compared after papaparse leaves.
- [ ] `apps/inventory`'s CSV reading goes through `@beep/csv`; `papaparse` and `@types/papaparse` are gone from every
      `package.json` and `bun.lock`.
- [ ] `bun run check:full` and `bun run build` pass on the last commit.
- [ ] Browser: `items_messy.csv` imported through Confirm on the last version; rows in the file, the result screen and
      the stored count agree (200 rows, 155 stored).

## Decisions

In [the exploration's DECISIONS.md](../../explorations/ideal-architecture/DECISIONS.md): "CSV scope", "CSV default",
"file naming", "shared kit", "strictness", "csv brief", "schema form", "kit licence".
