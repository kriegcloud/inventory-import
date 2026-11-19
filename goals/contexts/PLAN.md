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
| 3 | access: shapes in place, then contract, model, host, web | done |
| 4 | catalog: shapes in place, then contract, model, host, web | doing |
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
- **`access-web` (`packages/access/web`).** The session controller, sign-in, the People page and the audit trail's
  events list move out of `src/web`.
  - **The client seam took the brief's shape after all.** `@inventory/client` gains `ApiRuntime` (a React context
    holding the app's runtime) and `useApi(tag)`; `access-web` declares `AccessClient` over
    `HttpApiClient.Client<IdentityApi | PeopleApi | ActivityApi, ...>` and its screens call `useAccess()` and
    `useAccessWrite(spec)`. The app provides `AccessClient` from its one client with no cast: the client type names
    the errors of the two middlewares the assembled `Api` adds (`ProblemDetails`, `SameOrigin`).
  - **`configureSession({ sessionPath, onSignedIn })`** is the one thing the app tells the controller: where it asks
    for the session and what it starts for a signed-in member (its `preload`). The app's `lib/actor.ts` is that call
    and `useActor = useSession`. `useMember` in `@inventory/client` waits for `catalog-web`, its first reader.
  - **`@inventory/client/QueryClient`** holds the query client; each web package owns its keys (`accessKeys`), and
    the app's `queryKeys` spreads them.
  - **Dates** (`when`, `whenShort`, `day`) moved to `@inventory/ui/Dates`: both contexts' screens format them.
  - **The Activity page** stays in the app and composes `useAuditEvents`, `AuditEvents` and its columns (A1).
  - Ceilings: app 294, review 283, ui 52, client 22, access-web 17: sum 668, cap 678.
  - Built: the stylesheet is the same 124.37 kB, the entry chunk 261.22 kB (261.25 before); the first download has
    `Session.controller` (2.01 kB) and not `SessionState.read` (31.86 kB) or `authClient` (40.79 kB), which load when
    needed, as before.
  - Browser, fresh database: the same three numbers; signed out, made an account ("Sam Okafor", "Sam Works") on the
    moved sign-in screen, signed in as Dana from the test accounts, and the People pass and Events read as after
    `access-host`. Not read this time: Sam's own People list right after sign-up (the script read the placeholder
    rows before the list arrived).
- **catalog (a), timestamps.** `ImportResult.importedAt`, `ImportEvent.at`, `ImportView.createdAt`,
  `PastImport.confirmedAt`, `ChangeRecord.createdAt` and the item's `createdAt` are `Instant`; the rows read from SQL
  decode them, and the history is ordered by the moment itself. `ChangedItem.changedAt` could not wait for (b): it
  was `""` when not stored, which is no instant, so it is `Option<Instant>` (null on the wire) already, and a changed
  item with no stored moment reads "changed by ..." without a trailing "on". `src/domain/Item.ts` imports the
  kernel's `Instant`. The wire keeps its text: 197 app tests pass unchanged. Read on screen: Activity, Decisions
  "Nov 18, 9:10 PM" (title "Nov 18, 2026, 9:10 PM"); Imports "Nov 18, 9:10 PM"; the result "Dana Whitfield · Nov
  18, 2026, 9:10 PM"; "Imported before" on the first screen. Not seen on screen: the Items table's created cell
  (the column is not shown by default).
- **catalog (b), `Option` for absence.** An item's `description`, `reorderPoint`, `firstReceivedOn`, `dimensions` and
  a vendor's `vendorSku` and `leadTimeDays`; the staged head's `sheet`; `ImportView.result`; `ChangedItem.changedBy`;
  the facets' `min` and `max`; the match command's `column`. The wire and the stored rows keep `null`. Every
  `?? ""` that reached the wire is gone: a result is said once the confirm's name and moment are stored, a take-back
  event once its name and moment are. `discontinuedOn` waits for (c), and the fields of `RowOutcome`, `ColumnMatch`,
  `Suggestion`, `Change` and the assistant's answers for their own steps.
  - **`nullAsNone` in `@inventory/kernel/Wire`.** A key annotation on `S.OptionFromNullOr` reaches the decoder but
    not the OpenAPI document, and `Security.test.ts` reads a field's sentence from the document. `nullAsNone({
    description, messageMissingKey? })`, last in a field's pipe, puts the words on both sides. The access contract's
    three optional fields use it too, so their sentences are in the document again (PLAN said they were not).
  - **The instant's wire side is named** (`Instant` in the kernel): inside a `S.Result` the document is written from
    the wire side alone, and five schemas that hold an instant came out as second copies that differed.
  - **`Document.ts` folds identical copies to a fixpoint**, compared by shape whatever the key order: a copy that
    points at another copy is identical only once that one is folded. 87 components, none numbered, none with a
    path; `Security.test.ts` now asserts it.
  - **An `Option` does not survive the copy between threads.** The reader worker posted the staged head with
    `sheet` as an `Option`; the page then could not encode it, and every upload ended "The file was not saved". No
    test saw it (the tests stage in one thread); the browser import did. The head now crosses as plain fields
    (`PlainHead` in `lib/upload/protocol.ts`) and the page makes the `Option` again.
  - **`=== null` on an `Option` type-checks and is always false.** Thirteen such comparisons in the Items page and
    the editor were found by reading, not by the compiler; `Items.same` compared optional values by identity and
    now uses `Equal.equals`.
  - Read on screen, fresh database: the three numbers; Items "Reorder point" cells "Not set" and "312 EA", "First
    received" "Not set" and "2024-09-11"; the editor's Dimensions "69 × 27.3 × 45.4 cm"; typed 40 in Reorder point
    and cleared Description, Save: "Saved AAT-7076", the request sent `"description":null,"reorderPoint":40`, and
    the row reads "40 BX" after a reload; saving the same values again answered 200.
- **catalog (c), `Stocking`.** An item, its fields and an edit carry `stocking`: `active`, `inactive` or
  `discontinued { on }`, in place of `isActive` beside `discontinuedOn`; "discontinued and active" has no case.
  - **The two columns stay.** `ItemRow` reads `isActive` and `discontinuedOn` as stored and `storedItem(row)` makes
    the one value (a date wins over the flag; the table's CHECK already refuses the pair). The confirm's and the
    replace's statements write the columns from the item's JSON (`$.stocking.kind = 'active'`, `$.stocking.on`), the
    edit's from the command. No row is rewritten.
  - **The file's two fields stay two cells.** `isActive` and `discontinuedOn` are still what a row of the file says
    and what the review asks about; `itemText` writes a stored item back into those two cells, so the comparison of
    a stored item with a row is unchanged. The Items table keeps its Active and Discontinued columns and their
    filter.
  - `editProblem` no longer has the "discontinued yet active" sentence to say; the form still says it before
    anything is sent.
  - 197 app tests pass; the slow tests exercise the edit, the replace and the take-back on SQL.
  - Read on screen, fresh database: the three numbers; Items "Active" cells "Yes" and "No"; Fiberglass Crate
    (XRR-0266) "No", its editor Discontinued "2025-02-26" with Active off; switched Active on and Save: "A
    discontinued item cannot be active. Switch Active off, or clear the discontinued date."; cleared the date and
    Save: the request sent `"stocking":{"kind":"active"}`, 200, and the row reads "Yes" after a reload.
- **catalog (d), `RowOutcome` and `DecidedBy`.** A row of the result is one of `created`, `updated`, `already`,
  `notImported`, `takenBack` by `outcome`, each with only what it has: `already` and `notImported` a reason,
  `notImported` who decided (`{"kind":"person","name":"..."}` or `{"kind":"nobody"}`). `part` is `Option` in code and
  left out on the wire as before (`absentAsNone`, the optional-key twin of `nullAsNone` in `@inventory/kernel/Wire`).
  - **`importOutcome` keeps its columns.** `outcomeOf` reads a stored row into its case; a person is named when
    their name was kept with the row, otherwise the row reads as decided by nobody.
  - **A reason is bounded text, not `Sentence`:** a reason stored before a rule on its form existed must still
    read, or the whole result would answer 500.
  - Ceilings: app 293 (one finding went with the result screen's old filter-then-map). Sum 667.
  - Read on screen, fresh database: the review's first problem, "Leave out 2", moved the button from "Import 155,
    skip 45" to "Import 157, skip 43" (the two rows it left out had blocked two others); confirmed: "Not imported 43
    · Imported 157 · Already there 0 · All 200". Not imported: "Zinc-Plated Gloves L ... You left this row out.
    (Dana Whitfield)" and "Oak Cutting Oil ... SKU YDR-8742 is also on row 10 with different values. Keep one row,
    or leave one out." with no name; an imported row has no reason. "Download 43 not imported" made 44 records
    (heading and 43), last columns "Row" and "Why it was not imported", no empty reason.
- **catalog (e), `ColumnMatch`.** A field's match is one of `heading { field, column }`, `person { field, column }`
  or `none { field }` by `how`, and a column is a `ColumnPick { index, header, examples }`; `matchedColumn(match)`
  answers the column whatever settled it, and every reader uses it. Not stored, so nothing to map.
  - **A person's "None" still reads as not matched**, as before: `matchColumns` has always given `how: "none"` to a
    field a person pointed at no column. The union allows `person` with no column; the picker does not make one.
  - `S.annotate` in a pipe after `S.toTaggedUnion` loses the union's `match` in its type (the kernel's
    `$I.annoteSchema` keeps it); `matchedColumn` is written on `how` for that reason. Solved for good when these
    schemas get their `$I` in `catalog-contract`.
  - Read on screen (items_clean.csv, step Match): "items_clean.csv · 15 of 15 fields matched"; "SKU Required | A:
    sku | By its heading | SHH-9574 · GZN-1338 · NMN-3238". Chose None for Description: "Description | None | Not
    matched | Not set", the line "14 of 15 fields matched", the answer `{"how":"none","field":"description"}`. Chose
    "A: sku": "By a person" with that column's examples, the answer `{"how":"person","field":"description",
    "column":{"index":0,"header":"sku","examples":[...]}}`. Then, fresh database, the messy sample through Confirm:
    the three numbers.
- **catalog (h), the assistant says who answered with the contract's one value.** `ViewAnswer` and `ViewRefusal`
  carry `answeredBy` (`Model { provider, model, fallback }` or `Rules { reason }`) in place of `by` beside a nullable
  `model`, and `note` is `Option`. `AnsweredBy` and `AiProvider` moved to `src/domain/Answer.ts` (the contract
  re-exports them), so the table view's rules can name them. Taken before (f) and (g): it is self-contained, and
  (f) reaches about 250 places in the review rules.
  - **The reason the rules answered is `answeredBy.reason`, not the note.** The screen and the stored conversation
    are unchanged: the entry keeps "Rules" and that sentence, or the model's name and what it could not do.
  - Read on screen, model on (status: "Answers come from OpenRouter (anthropic/claude-haiku-5.5, then
    google/gemini-3.8-flash); then the non-AI path."): asked "show only packaging, most expensive first"; the answer
    carried `"answeredBy":{"_tag":"Model","provider":"openrouter","model":"anthropic/claude-haiku-5.5",
    "fallback":false},"note":null`; the panel read "Answered by anthropic/claude-haiku-5.5 · Applied changes ·
    Filtered: Category is packaging · Sorted by Unit cost, high to low", the table "28 of 155 items", first row
    "Zinc-Plated Box 12x12x8 ... $12.82".
  - Read on screen, AI turned off by the recipe in CLAUDE.md (status: "AI suggestions are off: AI_ENABLED is set to
    false."): asked "sort by name descending": "Answered by Rules · No AI key is set, so the rules answered. ·
    Applied changes · Sorted by Name, Z to A", first row "Zinc-Plated Workbench"; asked "which items are slow
    movers": "Answered by Rules · The rules could not read “which items are slow movers”." The settings file was put
    back afterwards.
- **catalog (i), first part: the two answers that were a lone boolean.** Cancelling an upload answers
  `UploadDiscard` (`{"kind":"discarded"}` or `{"kind":"nothingToDiscard"}`) and removing an import answers 204 with
  no body (decision (A2)). The rest of (i) is not done: branded ids, `ItemInvalid` as a 400 (C3), `UnitCost` as a
  decimal (C2).
  - Read on screen: items_clean.csv uploaded, its card on the first screen ("Nothing left to decide · Dana
    Whitfield · Nov 18, 9:43 PM"), Remove, "Remove items_clean.csv? This deletes the 25 rows it loaded ...": the
    request answered 204 with an empty body and the card went. The cancel was asked of the server from the page (an
    upload begun and not finished): first `{"kind":"discarded"}`, asked again `{"kind":"nothingToDiscard"}`. Not seen
    on screen: Cancel pressed during an upload (the sample files finish before it can be pressed).

