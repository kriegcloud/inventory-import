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
| 5 | The adapter beside the SheetJS reader; parity over fixtures and generated workbooks | doing |
| 6 | Expected tables frozen; the swap; SheetJS reader and its entries removed; browser pass; documents | todo |

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
