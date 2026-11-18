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
| 1 | Package skeleton: package.json, tsconfigs, identity, exports | todo |
| 2 | Schemas with their behaviour (positions, table, options, diagnostics, read, error) | todo |
| 3 | Tests that define done: differential (app), oracle, laws, hostile | todo |
| 4 | Engine: machine, sniff, encoding, limits; one-shot facade | todo |
| 5 | Old and new agree on every fixture; expectations recorded | todo |
| 6 | Writer, header view, Schema codecs, channels | todo |
| 7 | App adapter; papaparse removed | todo |
| 8 | Proof: check:full, build, browser import | todo |

## Current blocker

None.

## Choices made

- The vendored kit's licence is MIT (decision "kit licence"); done before this goal's code.
