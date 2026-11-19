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
- **`access-contract` (`packages/access/contract`).** Identifiers read `@beep/inventory/access/contract/...`
  (`$InventoryId.compose("access").$AccessId.compose("contract")` works as the brief assumed), and `Document.ts`
  shortens them in the OpenAPI document as it does the kernel's: 88 components, none with a path, an `Encoded`
  suffix or a number. Naming `AddPersonOutcome` removed the second copy of `Person`. `ModelCallsUsedUp` and the
  gateway's declaration are here; the app's `ModelCalls` service still does the taking until `access-host` lands.
  16 tests (every schema generates values it accepts; the three wire shapes).
- **`access-model` (`packages/access/model`).** Rules, the four ports, their twins and ten handlers, on the full
  profile with no override. Choices: a function of two or more values takes one object (`changeRole({ member,
  command })`, `keepsAnAdmin({ members, member, next })`), because the profile asks every such export to be dual;
  the twins share one in-memory state (`accessMemory(seed)`), so a person added through the people store signs in
  through the directory and their audit line reads back; the port answers `AddWrite`, `RoleWrite` and `RemoveWrite`
  are `S.TaggedUnion`s; `MemberDirectory.byId` is added for the test identity, which a header names a member to;
  the purity type is proved by a conditional type in `Rules.test.ts` (the profile reports a missing service on the
  same line a `@ts-expect-error` would sit on). 11 tests. The app is not wired to it yet: no screen changed.
- **`access-host` (`packages/access/host`).** The four D1 adapters, the session identity, sign-in, the settings and
  the test identity move out of `src/server` (`Members.ts`, `People.ts`, `Activities.ts`, `ModelCalls.ts`,
  `SessionIdentity.ts`, `SignIn.ts`, `authOptions.ts`, `TestAccounts.ts`, `Identity.ts` are gone from the app).
  - **The rabbit hole was real.** A function typed against this package's group does not fit the app's: the `Api`'s
    prefix and its `SameOrigin` and `ProblemDetails` middleware make each endpoint's type the app's own. So the host
    exports what each endpoint does (`identityEndpoints`, `peopleEndpoints`, `activityEndpoints`: an Effect that
    resolves the ports once and answers the object `handlers.handleAll` takes), and the app builds the three group
    Layers in four lines each.
  - **A handler's ports are provided where the group is built**, not per request: Effect turns a service a handler
    still requires into a per-request requirement, and only `CurrentActor` is provided per request.
  - **Span names are the ones the traces have always carried** (`People.setRole`, `Activities.recent`,
    `Members.findByUser`, `ModelCalls.take`, `Sessions.state`, and `people.setRole` for the endpoint), in memory as on
    D1; the model's handlers add no span of their own. One new span: `People.accountByEmail`. `Spans.test.ts` and
    `RequestTelemetry.test.ts` pass unchanged.
  - **The allowance is asked through `ModelAllowanceGateway`** by the table assistant, the suggestions and the
    `checkAi` endpoint; the sentence for a used-up allowance is the gateway's.
  - **The app's test support** uses the twins: `actingAs({ member, lines })` and `directoryFollowing` in
    `@inventory/access-host/AccessTest` replace the hand-written `Members` and `Activities` doubles. The two scripts
    that read the sign-in options and the test accounts import them by path.
  - Browser, fresh database: "Import 155, skip 45", "Not imported 45 · Imported 155 · Already there 0 · All 200",
    "155 items"; People: an unknown email said as "Nobody has signed up with nobody@example.test yet.", Sam added
    as editor, changed to viewer, Dana's demotion refused ("...is the only admin of Example Works (test)...") and put
    back, Sam removed (204); Events lists the three lines above the import's two.

