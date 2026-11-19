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
- **catalog (i), second part: `ItemInvalid` is gone (decision (C3)).** What `editProblem` checked is in the schema:
  a name needs a character that is not a space, and a day (`firstReceivedOn`, a discontinued day) must be on the
  calendar, read by the same `readDate` the import uses. A bad edit is a 400 problem document naming the field;
  the 422 and `editProblem` are removed. The checks are on the item's own fields, so they hold for a stored item too
  (every stored name and day went through the import's readers or the old edit check).
  - Read over HTTP from the signed-in page (`PUT /api/v1/items/:id` for AAT-7076): a name of three spaces: 400,
    `payload.name`, "Expected a name with at least one character that is not a space"; `firstReceivedOn`
    "2024-02-30": 400, `payload.firstReceivedOn`, "Expected a day on the calendar, written year-month-day";
    discontinued on "2024-13-45": 400, `payload.stocking.on`, the same words; the item's own values: 200. Not seen on
    screen: the editor showing such a refusal, because its form refuses the same things before anything is sent.
- **catalog (g), `RowDecision`.** In code a row's decision is `{ place, stored, accepted, reverted, edits }`, every
  part there: `place` is `open`, `kept` or `leftOut { wasKept }` (the review region's rule, written again here
  because the rules cannot import a screen package), `stored` is `undecided`, `keep` or `replace`. On the wire and in
  `importDecision.decisionJson` it is the flags it always was (`RowDecisionFlags`): the document still lists `out`,
  `kept`, `accepted`, `reverted`, `edits`, `stored`.
  - `decisionOf`, `decisionFromFlags` and `decisionToFlags` are the three ways in and out; the screen's adapter
    converts the region's decision and the server's through the flags both store. A newly written decision leaves
    out a part that says nothing (an empty `accepted` is not written), as the region's own saves already did.
  - `hasKeep` is the old `kept === true` exactly (kept, or left out after a keep), so which of two kept rows wins is
    unchanged.
  - Read on screen, fresh database: "Import 155, skip 45"; "Leave out 2": "Import 157, skip 43", sent
    `{"set":{"row-148":{"out":true},"row-195":{"out":true}},"clear":[]}`; Undo: "Import 155, skip 45", sent
    `{"set":{},"clear":["row-148","row-195"]}`; Redo: "Import 157, skip 43"; a refresh: still "Import 157, skip 43"
    with "Undo: 2 rows left out"; confirmed ("Import 157 items? 43 items won't be imported (Needs a decision 20,
    Cannot import 21, Left out 2)"): "Not imported 43 · Imported 157 · Already there 0 · All 200", Items "157 items".
- **catalog (f), first half: `Change`.** A value that differs from the file is one of `appliedByRule { field, from,
  to, basis, confidence }`, `acceptedProposal { ..., source: rule | model, basis, confidence }` or `typed { field,
  from, to }` by `how`, and `ChangeRecord` carries it as `change`, with `part` and `decidedByName` as `Option`.
  `changeSource`, `changeDecidedBy`, `changeBasis` and `changeConfidence` answer what the flat fields did.
  - **`importChange` keeps its columns and its words.** `changeToStored` writes `source`, `decidedBy`, `how`
    ("applied by a rule", "accepted a proposal", "typed or chose a value"), `basis` and `confidence` as before, and
    `changeFromStored` reads them; the count of rule fixes still asks SQL for `how = 'applied by a rule'`. A stored
    proposal with no basis or confidence (none is written that way) would read with an empty basis and "low".
  - The Activity page's "Basis" still shows the basis, or for a typed value the words "typed or chose a value".
  - Read on screen, fresh database: the messy sample confirmed ("Not imported 45 · Imported 155 · Already there 0 ·
    All 200", "20 values fixed for you in 17 rows"); Activity "Decisions 20", a row "YYE-9806 8 First received was
    Jun 19, 2024 now 2024-06-19 · Rule · high · Rule · "Jun 19, 2024" on 1 row is 2024-06-19 written another way; it
    has no other reading." The same file loaded again: "Needs a decision 24 · Cannot import 21 · Ready 0 · Already
    there 155 · All 200", "No items ready yet". On "Cost, 2 items", "Accept for the 2 ticked": "Import 2, skip 198";
    confirmed: "Not imported 43 · Imported 2 · Already there 155 · All 200", Items "157 items", Activity "Decisions
    22" with "CWB-5404 55 Unit cost was 35,82 now 35.82 · Rule · medium · Dana Whitfield · "35,82" reads as 35.82 with
    a decimal comma ..." and the answer `"change":{"how":"acceptedProposal",...,"source":"rule",...,
    "confidence":"medium"},"decidedByName":"Dana Whitfield"`. Not seen on screen: a typed value in Decisions.

- **catalog (f), second half: `Suggestion`.** A stored suggestion is one of `name` and `category`
  (`{ id, rowId, rowNumber, from, to, by, confidence, basis }`) or `column`
  (`{ id, field, column, heading, by, confidence, basis }`), by `kind`; who made it is `by`:
  `model { model }` or `rule`. A suggestion for a row's cell has no column and one for a column has no row, so the
  five nullable keys of the old struct are gone.
  - The table `importSuggestion` is not changed: `suggestionToStored` and `suggestionFromStored`
    (`src/domain/ItemImport.ts`) write and read its columns (an empty `rowId` and the heading in `toValue` for a
    column). A stored row that says no whole suggestion (a column with no position) is not listed.
  - `guard` takes `by: SuggestionBy` in place of `by` and `model`; `storedSuggestion({ id, made })` gives a new
    suggestion its id. A proposal on a row still says `by: "model" | "rule"`.
  - Read on screen, fresh database, model on: "Suggest fixes" on the messy sample: "Suggested 2 names. Suggested 2
    categories. Answered by the model anthropic/claude-haiku-5.5."; the answer's first entry
    `{"kind":"name","rowId":"row-7","rowNumber":7,"from":"","to":"Nylon Coil","by":{"kind":"model","model":...},
    "confidence":"medium",...}`. After a refresh, "Cannot import 21", row 7 reads "was empty proposed Nylon Coil
    (suggested by the model)"; "Use Nylon Coil for row 7" pressed: "Import 156, skip 44", "Cannot import 20". Not
    seen on screen: a suggested column (the samples leave no required field without a column).
- **catalog (i), third part: `UnitCost` (decision (C2)).** An item's and a vendor's `unitCost` is a `BigDecimal` in
  code and its shortest digits on the wire and in D1 (`UnitCost` in `src/domain/Item.ts`: the stored pattern on the
  wire side, so an empty string or `1e3` is refused and never read as a number). `readUnitCost` reads a cell,
  `costDigits` writes one, `decimalUnits` takes the decimal; the Items table and the editor show it through `costOf`.
  - `Items.same` compared two costs with `===`, which type-checks for two objects and is false: now
    `BigDecimal.equals`. Tests compare a cost by its digits (`test/support/cost.ts`): a decimal caches its shortest
    form once written, so two equal ones are not deeply equal.
  - The cost's wire side is named too (as `Instant`'s is), or the document held `ItemFields_1` and `Vendor_1`.
  - Read on screen, fresh database: the messy sample, "Import 155, skip 45", "Stock value $40,259,038.27" (as
    before), confirmed "Not imported 45 · Imported 155 · Already there 0 · All 200", Items "155 items". The first
    row "Brass Washer M6 AAT-7076 ... $26.99": its editor's Unit cost read "26.99"; typed "12.50", Save: the
    request sent `"12.5"`, the answer 200 with `"12.5"`, the row reads "$12.50" and the editor "12.5". Typed
    "1.23456", Save: "Unit cost is not an amount in dollars with up to 4 decimals. Write it as digits, for example
    12.50."
- **catalog (i), last part: the ids are branded.** `src/domain/Ids.ts`: `ImportId`, `ItemId`, `ConfirmId`,
  `SuggestionId` (UUIDs), `UploadKey` (1 to 64 characters) and `RowId` (`row-7`, `row-8.2`). They are on the paths
  (`/imports/:id`, `/items/:id`), `ImportView.id` and `createdIds`, `PastImport.id`, `ChangeRecord.importId`,
  `ImportEvent.batchId`, `TakeBackState.confirms`, the take-back's `confirms`, `UploadStart.key`, `StoredItem.id`, a
  suggestion's `id` and `rowId`, a reviewed row's `id` and the upload's state. The server's row schemas for a draft,
  an upload, a confirm and a change decode the id columns with them; its other private statements still bind plain
  text and move to the brands with `catalog-host`.
  - A decision's key and the review region's row key stay plain text (the brief: `RowKey` stays bounded text), so
    `recheckRow` is asked by text.
  - Wire change, as the brief lists it: a malformed id in a path answers 400 where it answered 404.
  - On the screen the address is read once (`importInAddress`, `src/web/lib/route.ts`): an `import=` that is no id is
    not sent to the server, and the page says so under the same title. **One new sentence**, mine and not in the
    brief: "The address does not name an import. Check the link, or choose a file."
  - Read on screen, fresh database: the messy sample "Import 155, skip 45"; "Leave out 2": "Import 157, skip 43",
    the same after a refresh; confirmed "Not imported 43 · Imported 157 · Already there 0 · All 200" at
    `/?import=<uuid>&step=result`; "Take back this import? This removes the 157 items ...": "Taken back 157 · Not
    imported 43 · Imported 0", Items "0 items". `/?import=nope&step=review`: "This import could not be opened. The
    address does not name an import. Check the link, or choose a file."; an id no import has: "No import with that
    id in your organization." Asked directly: `GET /imports/nope` 400, an unknown UUID 404, `PUT /items/nope` 400.
- **`catalog-contract` (`packages/catalog/contract`).** The catalog's schemas and its three groups (`ImportsApi`,
  `ItemsApi`, `AssistantApi`) on the full profile with no override; the app's `Api` adds the groups, and `src/api/v1`
  keeps only the system group, the assembled `Api`, the document and the version. 19 modules, 31 tests (28 schemas
  generate only values they accept; a cost's digits, a decision's flags and a stored suggestion's and change's
  columns keep their bytes). Exports: `./Ids`, `./Answer`, `./AiUnavailable`, `./Described`, `./Item`,
  `./ItemSearch`, `./ItemQuery`, `./FileProblem`, `./Staged`, `./Upload`, `./Mapping`, `./Suggestion`, `./Decision`,
  `./Change`, `./Import`, `./ImportRejection`, `./TableView`, `./ViewRequest`, `./Catalog`.
  - Where it differs from the brief, and why. (1) `Item/Item.read.ts` keeps the cell readers (`readDecimal`,
    `readCount`, `readDate`, `readItemForm`, `skuKey`) beside the schemas: `UnitCost` and the calendar-day check call
    them, and a contract may not import its model. (2) `Item/ItemSearch.read.ts` is the whole of
    `domain/ItemSearch.ts` (`ItemQuery` needs its `ItemSearchText`), and `Staging/FileProblem.read.ts` keeps the
    `fileProblem` sentences beside `FileProblem`. (3) Identifiers stay the plain names they were (`"ImportView"`,
    not an identity composer's), so no component of the OpenAPI document changes its name. (4) `ViewChange` is not
    yet split into `show` and `hide` cases. (5) `Mapping.read.ts` exports three constructors (`matchedByHeading`,
    `matchedByPerson`, `notMatched`) because the match classes are private to it.
  - The app's `src/domain` keeps the rules for now (`ItemImport.ts`, `Suggest.ts`, `TableView.ts`, `Upload.ts`,
    `Spreadsheet.ts`, `SheetLayout.ts`): they move with `catalog-model`.
  - Read on screen, fresh database: the messy sample "Import 155, skip 45", "Import 155 items?", "Not imported 45 ·
    Imported 155 · Already there 0 · All 200", Items "155 items", People "Dana Whitfield (you), Marcus Oyelaran,
    Priya Raman".
- **`catalog-model` (`packages/catalog/model`), first part: the rules.** The pure code the screen and the server
  both run, on the full profile with no override: `./Review` (`Review/Review.rules.ts`: `review`, `recheckRow`,
  `matchColumns`, `stageTable`, the cell readers that propose, `notImportedCsv`), `./ItemsOfRow`, `./Suggest`,
  `./TableViewRules`, `./Upload`, `./Spreadsheet`, `./SheetLayout`. The app's `src/domain` is gone. 25 tests moved
  with them (`SheetLayout`, `TableView`, `Upload`); `FileProblem` and `ItemSearch` (9) went to the contract's tests.
  - Not as the brief has it: `Review.rules.ts` is one file (the brief splits it into `Mapping`, `CellReading`,
    `Review`, `NotImported`); `UploadState` and `progressOf` stay in `Staging/Upload.rules.ts` until `catalog-web`
    takes them; `ConfirmPlan`, the ports, their twins and the handlers are not built yet.
  - `ItemImport.test.ts` and `ReviewRules.test.ts` stay in the app: they read the sample files in the app's
    `public/samples`, and a package may not reach into `apps/`.
  - The app's fast and slow tests now count 155, the packages' 65 more. `Assistant.slow.test.ts` had imported its
    column fixture from `TableView.test.ts` and so ran that file's 10 tests a second time; it has its own fixture
    now (`test/server/support/columns.ts`). Compared file by file with the commit before: no other count moved.
  - Read on screen, fresh database: the messy sample "Import 155, skip 45"; "Leave out 2": "Import 157, skip 43",
    the same after a refresh; confirmed "Not imported 43 · Imported 157 · Already there 0 · All 200"; taken back
    "Taken back 157 · Not imported 43 · Imported 0", Items "0 items".
