---
type: Reference
title: Defaults at boundaries, field verdicts
description: Every schema and state union of the catalog's contract, model and host packages, each field with one verdict and its reason; the other packages get theirs at the start of their lane.
from: explorations/ideal-architecture
---

# Field verdicts

One verdict per field, from the table in [SPEC.md](SPEC.md)'s goal: **Empty** (starts empty or at a usual value:
`withConstructorDefault` and a decoding default, or `emptyWhenLeftOut` where the stored form leaves the key out),
**Non-empty** (a non-empty array, proved once where it is built), **Absent** (`Option`, decoded by the `OptionFrom*`
that matches the input), **State** (split the union), **Normalised** (a transformation on the schema, the decoded type
named), **Derived** (a function beside the schema, not stored), **Required** (no default: an identity, an authority,
provenance, money, or a field whose empty value is the widest). A row "the rest" covers every field of the schema not
named above it.

Written by hand from the code on 2026-11-23. Paths are under `packages/catalog/`. A verdict marked *as is* already
holds in the code.

## Contract

### `Import/Decision.command.ts`

| Schema | Field | Verdict | Reason |
| --- | --- | --- | --- |
| `RowDecisionFlags` (the stored and wire form) | `out`, `kept` | Empty (`false`), `emptyWhenLeftOut` | `partsOfFlags` reads a missing flag as false; the stored form leaves it out, so the key stays out when false |
| | `accepted`, `reverted` | Empty (`[]`), `emptyWhenLeftOut` | "an absent flag becomes an empty part" (`partsOfFlags`); stored drafts omit empty lists |
| | `edits` | Empty (`{}`), `emptyWhenLeftOut` | as above |
| | `stored` | State: decoded `"undecided" \| "keep" \| "replace"`, left out when undecided | the flag's absence is the third case, `StoredUndecided` |
| `RowDecisionParts`, `PlaceOpen`/`PlaceKept`/`PlaceLeftOut`, `StoredUndecided`/`Keep`/`Replace` | all | State, *as is* | already the tagged unions the flags decode to |
| `decisionOf(parts?)` (built by code) | each part | Empty | a decision from the parts that say something: `RowDecisionParts.make` with constructor defaults replaces the `??` chain and the parameter default |
| `rowId({ rowNumber, part? })` | `part` | Absent | "a row that is one item (no part, or part 0)": `part` becomes `O.Option<number>`. Part 0 is today a second spelling of none (`itemsOfRow` gives a one-item row part 0); it is turned into none once, where a `RowItem` becomes a `ReviewedRow`, and ids stay as they are |
| `DecisionDelta` | `set`, `clear` | Required, *as is* | `messageMissingKey` asks for `{}`/`[]`: a save names both |
| `StaleAccept` | `kind` | Empty (`"accept"`), *as is* | entries stored before `kind` was kept were accepts |
| `DecidedSince` | `theirs` | Absent, *as is* | null for no stored decision |
| `SaveRequest` | `over` | Empty (`{}`), decoding default | `Waited.rules.ts` reads a missing `over` as `{}`: nothing waited over |
| `ConfirmRequest` | the rest | Required | |

### `Import/Change.read.ts`

| Schema | Field | Verdict | Reason |
| --- | --- | --- | --- |
| `AppliedByRule`, `AcceptedProposal`, `TypedValue` | all | State, *as is* | `basis` and `confidence` exist only on the two proposal cases |
| `StoredChange` (a D1 row) | `basis`, `confidence` | Absent on the row (`OptionFromNullOr`); a proposal case with none reads `""` and `"low"` on the row schema | a row of an older build: the stand-in values are listed in "Defaults nobody decided" |
| `changeToStored` | `basis`, `confidence` | Derived, *as is* | `O.getOrNull` moves into the row schema's encode |

### `Import/Import.read.ts`

| Schema | Field | Verdict | Reason |
| --- | --- | --- | --- |
| `DecidedByPerson`/`Nobody`, `RowCreated`…`RowTakenBack` | all | State, *as is* | |
| `MatchTakeBack` | `matched`, `reads`, `saved` | Absent (`OptionFromOptionalKey`) | "Left out on an entry stored before this was kept": unknown, not empty. A reader that substitutes a value is listed under "Defaults nobody decided" |
| `ChangedItem` | `changedBy`, `changedAt` | Absent, *as is* | |
| `ImportView` | `result` | Absent, *as is* | null before the first confirm |
| `ChangeRecord` | `part` | Absent, *as is*; `decidedByName` Absent, *as is* | |
| `ImportResultWire`, `TakeBackState`, `OpenImports`, `PastImport(s)`, `SuggestOutcome`, `ImportView` | the rest | Required | counts, ids and lists every view states |

### `Import/Mapping.read.ts`

| Schema | Field | Verdict | Reason |
| --- | --- | --- | --- |
| `MappingChoice` | `column` | Absent (`nullAsNone`) | null is "no column, on purpose"; `Mapping.rules.ts` compares with `null` today |
| | `at` | Empty (`0`), *as is* | |
| `ColumnMove` | `knownFrom` | Absent (`OptionFromOptionalKey`) | only on a first move matched before moves were kept |
| | `was`, `column` | Absent (`OptionFromNullOr`) | null for none |
| `MatchedByHeading`/`ByPerson`/`NotMatched` | all | State, *as is* | |

### `Item/Item.read.ts`, `Item/ItemQuery.command.ts`

| Schema | Field | Verdict | Reason |
| --- | --- | --- | --- |
| `ItemFields`, `StoredItem`, `ItemEdit` | optional fields | Absent, *as is* | `description`, `reorderPoint`, `firstReceivedOn`, `dimensions` decode with `nullAsNone` |
| | `stocking` | State, *as is* | `Active`/`Inactive`/`Discontinued` |
| | `tags`, `vendors` | Required | every stored item states its lists; an import's empty cell is decided as empty by the review, not by this schema |
| `skuKey({ sku })` | — | Normalised, *exempt* | the key two rows are compared by, never shown as a fix. A schema transformation would need `S.decodeSync`, which the type-check refuses, and every caller is pure code that needs the key at once; Benjamin ruled it its own file, `Item/SkuKey.rules.ts`, on the law's `exemptions` for clean-ups (SPEC, question 3) |
| `ItemFilter` | `filterId` | Absent | the table kit's own optional key; kept at its boundary |
| `rangeSchema` | `min`, `max` | Absent, *as is* | |
| `ItemQuery` | `search` | Normalised | the words of the search decoded once (`SearchText`), not split in the model |
| the rest | | Required | |

### `Staging/Staged.read.ts`, `Staging/FileProblem.read.ts`, `Staging/Upload.command.ts`

| Schema | Field | Verdict | Reason |
| --- | --- | --- | --- |
| `StagedCell` | `shown` | Absent (`absentAsNone`), and `shownText` Derived beside it | a CSV cell has no display text; the review reads what Excel shows, else the text |
| `StagedTable` | `sheet` | Absent, *as is* | |
| `FileProblem` | all | Required, *as is* | |
| `fileProblem.*` inputs (built by code) | `todo` | Empty: the usual sentence of each kind, written once in the maker's input schema | the two kinds whose sentence a caller may replace |
| | `where` | State: `emptyFile` (a file of no bytes) and `noValues` (nothing in the place read, `where` required) | "a file of no bytes (no `where`)" was a second kind of problem in one maker |
| | `sheet` | Absent (`O.Option<string>`) | a CSV has no sheet; the caller already holds it as an Option |
| `UploadStart*`, `UploadChunk`, `UploadDiscarded`/`NothingToDiscard` | all | Required / State, *as is* | |

### `Suggestion/Suggestion.read.ts`, `Assistant/*`, `Answer/*`

| Schema | Field | Verdict | Reason |
| --- | --- | --- | --- |
| `SuggestedByModel`/`ByRule`, `Name`/`Category`/`ColumnSuggestion` | all | State, *as is* | |
| `StoredSuggestionRow` (a D1 row) | `rowNumber`, `column`, `model` | Absent on the row (`OptionFromNullOr`) | `suggestionFromStored` compares with `null`; the case is read from `kind` |
| `suggestionFits` | `to`, `file.name` | Required, checked by schemas | nothing is cleaned: a proposed name is one `S.Trimmed` with something in it and at most 120 characters, and the row's name is blank when it holds only spaces (`S.isPattern`), both `S.is` guards beside the function |
| `ViewAnswer`, `ViewRefusal` | `note` | Absent, *as is* | |
| the rest | | Required | |

## Model

| Schema or type | Field | Verdict | Reason |
| --- | --- | --- | --- |
| `Review.rules.ts` `Proposal` | `suggestionId` | Absent | only a proposal from a stored suggestion has one |
| | `alternatives`, `labels`, `targets` | Empty (`[]`), a named constant | `oneReading`, spread by each proposal with one value to take; a plain type, not a schema, since a schema's `make` would check every proposal of every row on each review |
| `Review.rules.ts` `ReviewedRow`, `RowItem`, `FileRow` | `part`, `partLabel` / `label` | Absent, together: `part: O.Option<RowPart>`, `RowPart = { number, label }` | "absent for a row that is one item"; `RowItem`'s own doc gives a row of several items both |
| `Review.rules.ts` `ReviewedRow` | `item`, `reason` | Absent | "none unless it is ready", "none when ready" |
| `Review.rules.ts` `Problem` | `proposal` | Absent | `field`, `ask`, `note` stay `\| null`: only the screen compares them, and it is not in the pilot |
| `recheckRow` result | — | Absent | the first problem a row still has, or none; the screen turns none into the region's `undefined` at its last step |
| `Review.rules.ts` `review` input | `createdIds`, `suggestions`, `itemsOf` | Required; `noHistory` is the named value of all three for a file nothing has happened to | a plain type, not a schema: it holds a function, and a schema's `make` would check every row of the table on each review. `recheckRow`, `firstDecisions` and `carryDecisions` take `itemsOf` the same way |
| `Review.rules.ts` `Wrong` | `choices` | Empty (`[]`) | read as `wrong.choices ?? []` |
| `Review.rules.ts` `fault` result | — | Absent | `Wrong \| undefined` becomes `O.Option<Wrong>` |
| `rowPlace({ label })` | `label` | Absent | `string \| null \| undefined` and `""` all mean "one item": one `Option` |
| `NotImported.rules.ts` rows | `label` | Absent | |
| `Waited.rules.ts` save | `over` | Empty (`{}`) | as `SaveRequest.over` |
| `Rematch.rules.ts` `ItemsAsRead` | `asked` | Required | which reads a save was judged against: neither value is the usual one |
| | `keys`, `items`, `created`, `suggestions` | Empty (`[]`) | `noItemsRead` is the empty read; the store's parameter default moves onto the schema |
| `Rematch.rules.ts` `ColumnsAsked` | `reads` | Absent per entry (`OptionFromNullOr`) | |
| `Spreadsheet.rules.ts` `Cell` | `shown`, `formula` | Absent, kept as a key left out and read with `shownOf`, `formulaOf` | a CSV cell has neither. The table crosses the reader's worker as plain structured-clone values (`web/src/internal/protocol.ts`), where an Option loses its prototype, so the Option is taken where the cell is read |
| `Spreadsheet.rules.ts` `Row` | `extra` | Empty (`[]`), `emptyWhenLeftOut` | cells past the last column; most rows have none; empty stays omitted when encoded |
| | `hidden` | Empty (`false`), `emptyWhenLeftOut` | a row is shown unless Excel hides it; false stays omitted when encoded |
| `CellReading.rules.ts` `DimensionsCell` | `length`, `width`, `height`, `unit` | Absent | "all three measurements together" is a reason for the person, read from the Options |
| `CellReading.rules.ts` `VendorCell` | `vendor_name`, `unit_cost` | Absent | a vendor with no name or cost is a reason for the person |
| | `vendor_sku`, `lead_time_days` | Absent (`OptionFromOptionalKey(NullOr(...))`) | the outer Option keeps a key left out apart from an explicit null; the cell reader collapses those two absent readings, while `withPreferred` encodes the original spelling |
| | `is_preferred` | Absent (`OptionFromOptionalKey(Boolean)`) on the cell; Derived preference predicate | a missing flag and false both mean not preferred; the Option retains the original omitted key when encoding, and `withPreferred` writes the selected flag explicitly |
| `ImportStore.store.ts` `StoredDecisions` | `saves` | Empty (`0`), decoding and constructor default | a missing draft has no saved decisions; twin and D1 use the same schema |
| | the rest | Required | the store states every decision, author and revision map |
| `ImportStore.store.ts` `Draft` | `importedBy`, `importedAt` | Absent, *as is* | |
| `ImportStore.store.ts` `decide(…, read, expected)` | `read` | Required; `noItemsRead` is the empty read | as `ItemsAsRead`; the port, the twin and the adapter no longer default it |
| | `expected` | Absent, required (`O.none()` asks no comparison) | |
| `ImportStore.store.ts` `matchColumn(…, compare)` | `compare` | Required; `noComparison` compares nothing | |
| `Imports.handler.ts` `known?`, `unsaved?`, `also = 0` | | Absent (`known`, `unsaved`), Empty (`also`) | `known` is a table already read, else read here; both become explicit `Option`s |
| `ItemEdit.rules.ts` `ItemForm` | every text box | Normalised (`S.Trim`) | the editor's boxes are not file cells: nobody reviews their clean-up |
| | `quantityOnHand` | Empty (`0`) when the box is empty | listed under "Defaults nobody decided" |
| `ItemSearch.rules.ts` search text | — | Normalised (`SearchText`) | lower case, accents off, edges dropped, each word once |
| `TableView.rules.ts` the assistant's words | — | Normalised | the request's words are compared lower-cased; no person reviews them |
| `SheetLayout.rules.ts` headings | — | Normalised (`HeadingKey`) | a heading matched to a field is compared without case or spaces |
| `Catalog.memory.ts` `catalogMemoryWith(options)` | `answerer`, `calls` | Required; `offline` holds `Answerer.off` and `40`, and `catalogMemory` is the twin set up with it | the test twin's usual setting; 40 is the decided allowance |
| aggregates (`Import`, `Row`, `Group`) and the four decisions | all | Required, State *as is* | each state's `make` writes every field out, which the prover reads; no default added there |
| `Confirm.rules.ts` `Planned*`, `ConfirmPlan`; `ImportStore.store.ts` results; `Suggest.rules.ts` `SuggestAnswer` | all but the two below | State / Required, *as is* | |
| `Suggest.rules.ts` `SuggestAnswer` | `names[].name`, `categories[].category` | Normalised (`S.Trim`) | a model's answer is decoded, so its spaces come off there; the guard used to trim them in code |
| `Staged.read.ts` `fieldWords` | — | Derived, written out | each field as a sentence names it; written beside `fieldLabels` so no code lower-cases a label |

## Host

| Row schema | Field | Verdict | Reason |
| --- | --- | --- | --- |
| `ChangeInsert`, `ChangeRow` | `decidedByName` | Absent (`OptionFromNullOr`) | a rule's change has no person |
| | `basis`, `confidence` | Absent (as `StoredChange`) | |
| `BatchRow` | `takeBackId` | Absent | `other.takeBackId !== null` today |
| `findDecisions` | `lastSavedById` | Absent | "a row stored before who last saved it was kept has no name" |
| `putListOf` | `expected`, `expectedSaves` | Absent | the SQL guard is added only when one is given: `O.match` into the statement |
| `Totals` | `quantityMin`…`costMax` | Absent | null with no items |
| `Stored` (suggestions) | `rowNumber`, `column`, `model` | Absent | as `StoredSuggestionRow` |
| `Line` (audit) | `agent` | Absent | only an agent's act names one |
| `OutcomeRow` | `decidedBy`, `decidedByName` | Absent, *as is* | |
| `ItemRow` | `discontinuedOn`, `dimensions` | Absent, *as is* | |
| `ItemStore.adapter.ts` search and sort text | — | Normalised | through `SearchText` and the contract's schemas |
| the rest | | Required | ids, counts, revisions, timestamps, actors |

## The other packages

Each lane starts by writing its package's verdicts here, in the form above, before it changes code. Draft
inventories of the boundaries of every other package were made by Codex lanes on 2026-11-23; they are machine
heuristics, not verdicts, and are not copied here.

## Ontology tests (pilot follow-up)

`test/Reason.test.ts` has no field or stored encoding changes. Its fake fetch folds an optional refusal; expected
refusal/success paths narrow with `assertTrue` from `@effect/vitest/utils`, so an unexpected branch fails the test.

## Kernel and drivers

Written from each schema and its callers on 2026-11-25. Paths in this section are under `packages/`.

| Schema or state | Field | Verdict | Reason |
| --- | --- | --- | --- |
| `kernel` `Member` | `id`, `name`, `role`, `organizationId`, `organizationName` | Required, as is | identity, authority and the names supplied by the membership lookup |
| `AgentRun` | `agent`, `maxRole` | Required, as is | attribution and the explicit authority cap |
| `Activity` | `agent` | Absent, as is | `FieldOption` reads SQL NULL and an omitted JSON key; neither is an agent |
| | `id`, `createdAt` | Required/generated by the existing Model fields, as is | the insert generates provenance; existing rows retain it |
| | `organizationId`, `actorId`, `actorName`, `action`, `detail` | Required, as is | an audit entry states its tenant, actor and event, including an explicitly empty detail |
| `NotSignedIn`, `CrossSiteRequest`, `Forbidden` | `reason`; `Forbidden.required` | Required, as is | refusals name the reason and required authority |
| `RequestSource` | `fetchSite`, `origin` | Absent, as is | missing browser headers differ from a header refusing a write |
| | `method`, `own` | Required; comparisons Normalised | case-insensitive method/origin comparisons remain the same; no origin is invented |
| `RequestSource.allows` | no browser headers | State | a non-browser request is allowed, as the documented security policy already states |
| `Ids`, `Role`, `DisplayName`, `Sentence`, `Instant`, ontology pointers | scalar value | Required, as is | their existing bounds, brands and literal domains define the whole value |
| `Wire` `nullAsNone`, `absentAsNone` | wrapped value | Absent, as is | adapters preserve SQL NULL or a key left out while exposing Option |
| `Wire` `emptyWhenLeftOut` | wrapped value | Empty, as is | the decoded empty value encodes back to a key left out |
| `drivers/better-auth` `BetterAuthSettings` | `secret`, `publicUrl` | Absent, as is | no secret selects the explicit development/production policy; no public URL uses each request's origin |
| | `production` | Required, as is | never default the production security setting |
| `AuthSession`, `AuthSessionAnswer` | `activeOrganizationId` | Absent, as is | absent/NULL means no organization chosen |
| `AuthSessionAnswer` | whole answer | Absent (`OptionFromNullOr`) | Better Auth returns NULL for nobody signed in |
| `AuthSession`, `AuthSessionAnswer` | `userId`, `email`, session/user containers | Required, as is | a signed-in session must name its account |
| `ConfiguredSecret`, `EphemeralSecret`, `AuthSecret` | all | State/Required, as is | configured secret versus development-only random secret, never a guessed production secret |
| `AuthUserId`, `AuthOrganizationId`, `AuthEmail`, `AuthEndpoint`, `PublicUrl`, `SigningSecret` | scalar value | Required, as is | existing identity, endpoint and security bounds |
| `AuthDriverOptions` | `basePath` | Empty (`/api/auth`), decoding default | existing library-boundary nullish fallback, unchanged |
| `ResolvedAuth` | `secret`, `baseURL`, `secureCookies` | Required; `baseURL` Absent, as is | computed settings supplied to the host, never persisted |
| `BetterAuthError`, `BetterAuthConfigError` | all | Required, as is | operation/problem and original cause identify the failure |
| `drivers/openrouter` `OpenRouterSettings` | `enabled`, `fallbackModels` | Empty (`true`, `[]`), as is | existing configuration defaults |
| | `apiKey` | Absent, as is | no key turns AI off |
| | `model` | Required, as is | caller names which model to ask |
| `ModelPolicy` | `attemptTimeout`, `retries`, `backoff`, `deadline` | Empty (15s, 2, 500ms, 40s), as is | existing retry policy remains one ExecutionPlan step |
| `ModelAccess`, `ModelStatus`, their on/off members | all | State/Required, as is | off carries why, on carries the fallback list and access alone the key |
| `ModelPrompt` | `system`, `maxOutputTokens` | Absent, as is | no system instruction or token cap is supplied |
| | `name`, `prompt` | Required, as is | each call names its structured answer and question |
| `ReportedTokenCount`, `ReportedTokenTotals`, `ModelUsage` | `inputTokens`, `outputTokens` | Empty (`0`) at provider boundary | provider totals may be missing, undefined or NULL; retained unchanged and listed in SPEC |
| | `costMicroUsd` | Absent, as is | the provider need not report cost |
| `ModelAnswered` | `model` | Required; explicit `O.match` uses the requested model when provider attribution is absent | preserves the existing attribution fallback, listed in SPEC |
| | `fallback`, `usage` | Required, as is | computed from the actual response |
| `ModelId`, `ModelName`, `OffReason`, `ModelTrouble`, `TokenCount` | scalar value | Required, as is | existing bounds/literal domains |
| `ModelUnavailable`, `AttemptTimedOut`, `Trouble` | all | State/Required, as is | trouble and retryability keep their existing mapping |
| service/test layer arguments | `policy` | Required | `layer`, `layerFetch` and `overHttp` require the caller to name its policy; ordinary callers state `ModelPolicy.default` |
| scripted model options | `fallbackModels`, `policy` | Required | callers state `[]` and `ModelPolicy.default`, or the explicit fallback list and policy under test; no options decode |
| scripted text reply | `modelId` | Absent (`O.Option<string>`) | metadata explicitly matches both cases; None names the requested model and Some names the scripted model |
| scripted reply | text / hang / AiError | State, as is | each branch answers, never completes or fails |
| `drivers/d1` `D1TestOptions` | `seeds` | Empty (`[]`), as is | most test databases need only migrations |
| | `migrations` | Required, as is | caller names the migration folder |
| `D1Instant`, `D1Stage`, `NoRows` | whole value | Required, as is | timestamp codec, failure stage and the empty tuple a non-returning write must answer |
| `D1Error`, `D1Query`, `Pending`, `Answers` | all | Required, as is | failure provenance, statement/decode function and typed batch answers; no optional data |

Row 7 review revision: the service and test layers no longer decode a parameter merely to supply its default.
Scripts declare no schemas; response token totals use the one module-level `ReportedTokenTotals` schema, and
answered-model attribution uses an explicit `O.match`. The same-origin decision explicitly allows no Origin,
compares a supplied Origin against the app's own, and refuses a source that fails to decode (`O.exists` on None).
No refused place was left as on main. Forced callers outside kernel/drivers are
`apps/inventory/src/server/Model.ts`, `apps/inventory/test/server/Suggestions.test.ts`, and
`apps/inventory/test/server/Assistant.slow.test.ts`.

Validation for this revision: targeted `bun run beep laws defaults` passed (11 code files; two existing fallback
places remain within baseline); `bun run format -- <revision files>` completed; `bun run check` exited 0. The
OpenRouter suite passed 29 tests and kernel passed 32. No baseline was lowered. Slow tests (including the updated
Assistant caller), a live provider, browser behavior and `check:full` were not run. Needs the person: nothing.
