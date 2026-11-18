---
type: Standard
title: Reading the file
description: A .csv or .xlsx is read as it is, what the reader noticed reaches the person, and a refused file says what to do.
tags: [import]
status: draft
---

The reader exists ([patterns](../patterns.md), section 7). These are the rules it keeps; code added around it keeps
them too.

- **.csv and .xlsx both work**, through `readSpreadsheet`, and a workbook with several sheets says which one it read
  and why. Check: both samples in `public/samples/` reach the same review.
- **Nothing is coerced.** Cells keep their text, a value with two readings is a question for the person, and merged
  cells are never filled down. Check: a test gives an ambiguous date and gets a question, not a value.
- **What the reader noticed reaches the person**: rows above the header, a total row, hidden rows or sheets,
  formulas. Check: the sample workbook's notes are on screen or one click away.
- **A refused file says why and what to do**: the reader fails with a `FileProblem` (`src/domain/FileProblem.ts`),
  data the screen shows under its kind's heading, what is wrong, then what to do ([errors](errors.md)). Check: an
  `.xls` file shows "This file is not a spreadsheet" and "save it as "Excel Workbook (.xlsx)" or "CSV UTF-8"".
- **Row numbers are the file's own**, so a row named on screen can be found in the spreadsheet. Check: compare one.
