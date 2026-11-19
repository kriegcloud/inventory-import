---
type: Plan
title: "Kernel and drivers, plan"
description: The steps of the kernel-drivers goal, their status, the current blocker and the choices made along the way.
from: explorations/ideal-architecture
---

# Plan

[SPEC](SPEC.md) holds the objective and acceptance. Status is one of `todo`, `doing`, `done`.

| # | Step | Status |
| --- | --- | --- |
| 1 | Decisions recorded; SPEC and PLAN | done |
| 2 | `@inventory/kernel`; the app switched; proof | done |
| 3 | `@beep/d1` with `D1Test`; the app switched; proof | doing |
| 4 | `@beep/better-auth`; the app switched; proof with sign-out and sign-in | todo |
| 5 | `@beep/openrouter`; the AI SDK removed; proof with and without a model | todo |
| 6 | Closing note | todo |

## Current blocker

None.

## Choices made

Where the brief left a choice open, or the code showed the brief could not be followed as written.

- **`Role` is `S.Literals`, not a `LiteralKit`.** The vendored `LiteralKit` imports the `@beep/utils` root, which
  names Node types; the Worker's type-check then needs `"node"` types, and Node's `URL` type clashes with the Workers
  one in `@beep/utils/NodeUrl` (tried). A plain union of three scalars is allowed by SF-6, and the kernel depends on
  `@beep/identity` and `effect` only.
- **`Described.ts` stays in the app.** `instant()`, `personName()` and `reasonForPerson` describe contract fields that
  move with their context (decision "rules reach"); the kernel's own fields use `DisplayName` and `Sentence`.
- **OpenAPI component names.** Effect names a schema with an identity identifier by its whole path
  (`_beep_inventory_kernel_AccessError_ForbiddenEncoded`); `src/api/v1/Document.ts` now takes the last part when it is
  free, so the document still says `Forbidden`, `NotSignedIn`, `CrossSiteRequest`, `Member`.
- **Test ids.** `ActivityId` is a UUID, as every stored line's id is; the in-memory audit lines and the tenancy test's
  foreign line now use UUIDs instead of `act_0`.
- **The test identity decodes its header.** `MemberId` checks its text, so `IdentityLive` decodes the `x-acting-as`
  header and answers `NotSignedIn` for one that is not an id, instead of throwing in `MemberId.make`.
- **Kernel proof** (commit of step 2): check:full 23/23 tasks (kernel 26 tests, app 217 fast + 45 slow); build in
  check:full. Browser on port 5199, fresh database: review "200 rows read", "Import 155, skip 45"; confirm dialog
  "Import 155 items"; result "Imported 155 · Not imported 45 · All 200"; Items "155 items"; D1 `item` 155 rows;
  Activity lists the import's lines.

