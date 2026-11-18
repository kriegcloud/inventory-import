---
type: Plan
title: "@beep/csv, plan"
description: The steps of the beep-csv goal, their status, the current blocker and the choices made along the way.
from: explorations/ideal-architecture
---

# Plan

[SPEC](SPEC.md) holds the objective and acceptance. Status is one of `todo`, `doing`, `done`.

| # | Step | Status |
| --- | --- | --- |
| 1 | Package skeleton: package.json, tsconfigs, identity, exports | done |
| 2 | Schemas with their behaviour (positions, table, options, diagnostics, read, error) | done |
| 3 | Tests that define done: differential (app), oracle, laws, hostile | done |
| 4 | Engine: machine, sniff, encoding, limits; one-shot facade | done |
| 5 | Old and new agree on every fixture; expectations recorded | done |
| 6 | Writer, header view, Schema codecs, channels | done |
| 7 | App adapter; papaparse removed | done |
| 8 | Proof: check:full, build, browser import | done |

## Current blocker

None.

## Choices made

Where the brief left a choice open, or the code showed the brief could not be followed as written.

- **Kit licence** is MIT (decision "kit licence"), changed before this goal's code; vendored bodies unchanged.
- **Detection window**: the delimiter is detected from the first 256 Ki characters, the old reader's first piece, so
  files of any size are detected as before. An internal constant (`internal/sniff.ts`), not an option.
- **papaparse's preview counts a trailing empty record**: a sample that is the whole input and ends with a line break
  adds one empty record before measuring, as papaparse's preview did. Without it a short semicolon file would be
  detected where papaparse fell back to a comma.
- **An `S.Opaque` loses its brand under `S.annotateKey`**: a field typed with an Opaque class and described with
  `annotateKey` (rule SF-1) has the plain struct as its type, as toml's `TomlStringifyError.diagnostic` does upstream.
  Internal functions therefore take the field types (`CsvCodecOptions["write"]`, `CsvReadOptions["limits"]`) and
  `Csv.stringify` takes `Pick<CsvTable, "records">`. Values are still validated by the same struct.
- **Behaviour placement differs from the brief in four places**: `recordEndText`, `delimiterName`, `judgeQuote`,
  `judgeRagged`, `applyTrim` and `applyFormulaGuard` are exports beside their `LiteralKit`s rather than statics on them;
  `describeFinding` replaces `CsvDiagnostic.message` and there is no `order` (findings come in file order);
  `CsvDelimiterChoice.resolve` is not a static, because a schema file calling the sniff (which runs the machine, which
  imports the options) would close an import cycle; the facade calls the sniff, and `Csv.sniff` is public.
- **`TooManyBytes`** is its own fatal finding: the byte cap is a `ByteSize` and has no text position, so it does not
  fit `LimitExceeded`.
- **`Csv.parseBytesInPiecesResult`** is added to the brief's surface: the upload screen's progress needs a synchronous
  read that reports after each piece, which neither `parse` nor the channels give.
- **Header view**: a short record's missing cells read as "", a long record's extra cells (no heading) are dropped.
- **The web tsconfig gains Node's types**: the vendored `LiteralKit` imports the `@beep/utils` root, whose index names
  Node types. No client chunk contains a Node module (checked in `dist/client/assets`). It goes when `LiteralKit`
  imports `@beep/utils/Array` upstream.
- **Stage C ceiling** falls from 688 to 678: the papaparse reader's native calls are gone.
- **Vite optimizeDeps** now lists the effect subpath modules the reader reaches: without it a cold dev server optimised
  them on the first file and reloaded, losing that file (found in the browser proof, fixed in `cfb8132`).
- **Recorded expectations** in `apps/inventory/test/fixtures/csv-expected/` are excluded from oxfmt so they stay as
  recorded.
- **Commits**: the package commit comes before the lockfile change; `bun.lock` changes with the app switch, in one
  commit, because the same edit removes papaparse.
- **JSDoc**: every export has a lead sentence and a category, and the main ones an example; no tool compiles the
  examples here (brief deviation 3).

## Closing note

What changed: the app reads CSV through `@beep/csv`, its own package; papaparse is gone. Old and new agreed on every
input and every piece size before the switch, and the old results are kept as the test's expectations. What was
learned: papaparse's leniency is a small set of rules (a quote after a closing quote is text and the field stays open;
spaces between a closing quote and a delimiter vanish; detection over ten records, counting a trailing empty one), and
written down they fit one push machine that also does strict RFC 4180 exactly as Effect's own `Csv`. The cost: the
browser's CSV chunk is now 75 KB (Effect Schema, the identity kit and the parser) where papaparse was a smaller chunk.
