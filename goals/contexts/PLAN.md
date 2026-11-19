---
type: Plan
title: "Contexts, plan"
description: The steps of the contexts goal, their status, the current blocker and the choices made along the way.
from: explorations/ideal-architecture
---

# Plan

[SPEC](SPEC.md) holds the objective and acceptance. Status is one of `todo`, `doing`, `done`.

| # | Step | Status |
| --- | --- | --- |
| 1 | Decisions recorded; SPEC and PLAN | done |
| 2 | Boundaries check; `@inventory/client` | done |
| 3 | access: shapes in place, then contract, model, host, web | doing |
| 4 | catalog: shapes in place, then contract, model, host, web | todo |
| 5 | Closing note | todo |

## Current blocker

None.

## Choices made

- **`@inventory/client` binds, it does not take a tag per call.** The brief sketched `call(tag, use)`; built is
  `makeApi(runtime, tag)`, which returns `call`, `callWrite` and `fork` bound to one client, and
  `makeOptimisticWrite(callWrite)`, which returns the hook. Every call site keeps `call((api) => ...)`, and a web
  package binds the same helpers to its own tag over the app's runtime.
- **`sayError` is handed the model's sentences.** `AiUnavailable` is still said by its kind, never by the error's own
  text; the package has no contract in it, so the app installs the contract's five sentences at start
  (`installTroubleSentences`). `answeredByLine` stays with the app until catalog-web takes it.
- **The client package is stage C.** Its code came from `src/web` with 22 findings, so it carries the four-rule
  override and its own ceiling (22); the app's fell from 332 to 311. Sum 668, cap 678.
- **`QueryClient.runtime.ts` and `CurrentMember.controller.ts` wait for the first web package**, which is the first
  code that cannot import the app's `lib/queries.ts` and `lib/actor.ts`.
- **access, shapes in place.** `SessionState` is a union by `status` (`SignedOut`, `NoOrganization`, `Ready`);
  `Person` carries `MemberId`, `Option<AccountEmail>` and `Option<Instant>`; `AddPerson.email` is `EmailToFind`
  (trimmed and lower-cased by the schema); `people.remove` answers 204. The sign-in gate and `useActor` narrow on
  `status` and do not call `SessionState.match`: both are in the first download, which carries no Schema code. A
  screen sends a command through its schema (`S.decodeEffect(AddPerson)`), so the trim and the lower-casing are said
  once.
- **`joinedAt` as Better Auth writes it decodes.** Checked in `Auth.slow.test.ts` (a member created through
  `/api/auth/organization/create`) and on screen ("Nov 18, 2026, 8:48 PM" for an account made in the browser).
- **Two limits of the generated document, left as they are.** A key's description does not reach the document for
  an `Option` field (`Person.email`, `Person.joinedAt`, `SignInFeatures.testAccounts`): the property is the value's
  component or null, and the sentence stays on the schema. `people.add`'s answer names a second copy of the person
  (`Person_1`): inside `S.Result` the instant is written as plain text, so `Document.ts` keeps the copy that differs.

