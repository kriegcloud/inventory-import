---
type: Plan
title: "Infra, plan"
description: The steps of the infra goal, their status, the choices made, what was proved without a cloud, what waits for the first apply, and what Benjamin does by hand.
from: explorations/ideal-architecture
---

# Plan

[SPEC](SPEC.md) holds the objective and acceptance. Status is one of `todo`, `doing`, `done`. The steps are the
brief's "Order of moves" up to the first one that touches anything outside this machine, with closed sign-up (I8)
as a step of its own.

| # | Step | Status |
| --- | --- | --- |
| 1 | The seed rows out of the migration into `seeds/`; the local script and the tests apply them | doing |
| 2 | Sign-up closed, with a first-admin path (I8) | todo |
| 3 | `packages/infra`: the stage schema, `planFor` and its test | todo |
| 4 | Alchemy at one exact version; the two stacks; `deploy.yml`, not merged to `main` | todo |
| 5 | Browser pass, the documents the moves made false, and the hand-over list | todo |

**Not done by this goal, and Benjamin's:** step 5 of the brief (his Cloudflare login and `alchemy state bootstrap`)
and everything after it.

## Current blocker

None.

## Choices made

Where the brief left a choice open, or the code showed the brief could not be followed as written.
