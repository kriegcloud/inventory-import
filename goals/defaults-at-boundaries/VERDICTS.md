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

## Access contract, model and host (PLAN row 6)

Reworked on 2026-11-26 after review. Paths below are under `packages/access/`. The access contract's stored
columns and HTTP shapes have no changes. Optional input from the platform is decoded where it enters; internal
configuration receives explicit choices.

| Schema or boundary | Field | Verdict | Reason |
| --- | --- | --- | --- |
| Contract session states, people commands, audit reads and allowance gateway | all | Required / State / Absent, as main | Existing Options and tagged states already express absence and outcomes; no authority is invented |
| `MemoryAccount`, `MemoryMembership`, `MemoryCall` | row fields | Required / Absent | Named schemas own the rows; the matching types are derived with `typeof X.Type` |
| `AccessMemoryState` | accounts, memberships, lines, calls | Empty tables on constructor and decoding schemas | A fresh twin contains no records; partial seeds preserve supplied rows |
| Memory seed boundary | account email key | Normalised once | `EmailToFind` decodes the stored key when seeding; lookup compares that key directly and preserves the original account email |
| `SignUpSetting` / `SignUpEmail` | setting text / candidate email | Normalised at entry | `Config.schema` decodes setting words into `SignUpRule`; Better Auth decodes a trimmed, lower-case branded email key before admission, refusing a failed decode |
| Stage-password comparison | absent right-hand code units | Algorithmic padding | `A.pad` fills the right array to the left length, `A.zipWith` compares code units, and the initial length XOR distinguishes unequal lengths; no fallback schema |
| Already-member message | existing membership | Derived sentences | `O.match` chooses a complete sentence; no role suffix is joined from an Option |
| D1 membership `Chosen` | organizationId | `OptionFromNullOr` at SQL boundary | One query uses `coalesce` and stable creation/id ordering; no active organization chooses the earliest membership |
| Better Auth internal input | baseURL, mayCreateAccount, passwordToVerify, backgroundTasks | Required Options | Every caller states its choice; selected passwords remain Options through the model and adapter |
| Better Auth internal input | secureCookies, pwnedPasswordCheck, rateLimit | Required booleans | Production, development, tests and schema generation state their own flags explicitly |
| Better Auth optional output | baseURL, password, backgroundTasks | Absent keys omitted | `R.getSomes` creates the third-party property bags; no decode/encode wrapper or function declaration schema |
| Better Auth session callback | context / first membership | Two absence places retained exactly as main | Third-party callback uses null context and undefined when no row exists; these are exemption candidates, not newly cleared places |
| Settings | blank secret / stage password / public URL | Absent | One named nonblank-text schema checks redacted values; blank public URL is decoded in Config |
| Cross-site warning | origin, fetch site | Omit missing annotation | `R.getSomes` reads the already-checked source Options; no empty strings are manufactured |
| Session identity | optional page header | Absent at request boundary | Header schema decodes the platform dictionary once before identity comparison |
| Test identity / actingAs | missing header / audit lines | Header decoding default / required lines | The header default stays only in `S.decodeEffect`; `actingAs` requires its caller's audit lines |
| Audit count | missing COUNT row | Defect | A COUNT aggregate always produces a row; absence dies rather than reporting a false zero |

The only forced callers outside this lane are `apps/inventory/src/server/worker.ts`,
`apps/inventory/scripts/auth-schema.mjs`, `apps/inventory/test/server/support/app.ts`,
`Auth.slow.test.ts`, `AuthSchema.slow.test.ts`, and `Pwned.test.ts`: they supply the new required choices.

The scoped defaults audit reports **0 fallback, 2 absence, 0 unwrap, 0 normalise** across 57 access source/test
files. Both remaining places are in `host/src/internal/authOptions.ts`'s session hook, restored exactly from main:
`context === null ? Promise.resolve() : ...` and `rows[0] === undefined ? undefined : { data: ... }`.
They are third-party callback exemption candidates. No exemption or baseline change was made, and this lane does
not claim zero absence. No `Result.getOrThrow`, `Effect.runSync`, synchronous schema decoder/encoder, or `S.declare`
remains in these packages.

Validation: access model tests pass (31 tests); host tests pass (15 tests). `bun run check` passed all 105 tasks
(11.314 seconds, 73 cached). The direct app slow-test command first failed because Wrangler attempted to write its
registry outside the sandbox. Rerunning with `WRANGLER_REGISTRY_PATH=/tmp/defaults-access-rework-wrangler` passed
all 133 tests in 24 files in 61.07 seconds, with no individual test retries. Formatting was run on the changed
files; the formatter excludes Markdown, and the repository documentation check passed. No browser or production
deployment was inspected. No commit or push was made; the held baseline, `Catalog.lock.json`, vendor files and
`.dev.vars` were untouched.

## Infra (PLAN row 14)

Written on 2026-11-26 before changing infra code. All paths below are under `packages/infra`. The stage plan,
resource declarations, variable names, reference precedence and secret bytes must stay unchanged.

| Schema or boundary | Field | Verdict | Reason |
| --- | --- | --- | --- |
| Stage names, kinds, addresses, seeds, setting sources and five plan cases | all | Required / State, as is | Each case fixes its address, seeds, deployment policy and setting sources; no stage or deployment choice is added |
| `UnknownStage`, `StageNotDeployed`, missing password/token/model-key errors | all | Required, as is | Refusals retain their stage, variable and complete action sentence |
| Stack secret configuration | model key, preview token, preview password | Absent when missing or whitespace-only; otherwise exact original bytes | A module-level nonblank schema supplies the presence predicate; no secret is trimmed or rewritten |
| Reference-file line boundary | line text | Normalised (`S.Trim`) | Surrounding line whitespace is ignored before finding the last matching assignment; quoted spaces inside a reference remain intact |
| Reference parser | invalid/missing assignment | Absent | Invalid, commented, template and unrequested references produce no dictionary entry |
| Process environment | CI | Derived predicate | None, empty, `false` and `0` mean a workstation; every other nonempty value means workflow, with no manufactured empty string |
| Process environment and file reads | missing/error | Absent / existing empty-file recovery, as is | Preserve environment precedence and the existing failure policy; no file is written |
| Alchemy secret-provider wrapper | layer / names callback | Required, as is | Runtime service and callback remain ordinary code, with no function schema |
| Third-party Worker environment | model key, minted/given test password, sign-up | Absent keys omitted | Spread `R.getSomes` over the existing Options, preserving keys and values |
| Test stage-plan and layer results | success/failure | Required asserted branch | Narrow with `assertTrue` from `@effect/vitest/utils`; a wrong branch fails before reading its contents |
| Reference test fixture | own-file text | Required argument | Every caller explicitly supplies its own file, including an empty file |

No stored encoding changes, new deployment defaults or exemption requests are intended. Literal failure branches
in the stack secret-name callbacks are held as written unless they can be removed without changing behavior for
an invalid stage. The scoped law now reports zero; PLAN.md records validation and the two unchanged, uncounted failure branches.

## Access web (PLAN row 12)

Written on 2026-11-26 before code changes. Sign-in, organization switching, adding people, roles and removal retain their behavior and wording.

| Boundary or field | Verdict | Reason |
| --- | --- | --- |
| Saved ended-session text | Absent when missing or malformed | Read the two required positions as Options; no invented empty member or address |
| Session view actor, email, failure | Absent as Option | Keep absence until the final screen; loading and existing member retention remain unchanged |
| Session view organizations | Derived list | Empty while no session/organization is known, retaining the existing shell behavior |
| Sign-in refusal and pending email | Absent as Option | A waiting or successful attempt has no refusal; only a matching attempt shows its spinner |
| People add outcome and failed request | Absent as Option | A domain refusal and a failed request remain separate, with the same sentences |
| People rows and audit rows | Derived list | Fold unavailable reads with `onNone: A.empty`, `onSome: identity` |
| Signed-in member in People | Absent as Option | Admin checks and own-row labels use the member without manufacturing a record |
| AuditEvents updating prop | React optional prop, destructured default false | The caller can omit a display flag |
| Better Auth optional message/error | Third-party boundary retained pending honest schema route | Preserve Better Auth error ownership and messages |
| Organization slug | Own unresolved fallback and normalization, retained | Preserve existing lowercase, punctuation removal, truncation and empty-name fallback |
| People ListColumn email/joinedAt value/title | UI boundary retained | ListTable requires text for search/sort/title; preserve empty-sort and "Not set" title semantics |
| DOM availability | DOM edge retained | Server imports do not subscribe to browser events |

Uncleared places will be named by file, kind, count and example in the hand-back. No baseline or exemption changes are authorized.


Access web implementation and evidence:

- `SessionView.actor`, `email` and `error` now carry Options; its organization list folds the unavailable answer with
  `onNone: A.empty`, `onSome: identity`. Waiting retains a ready member and hides an initial/no-organization answer as before.
- Ended-session text uses the first two positions as Options. Missing/malformed text still does not navigate; a real
  member/address pair is consumed once, retaining the same checks against another member and an unsafe address.
- People add-result refusal, failed request, member and loaded-list absence remain Options until rendering. Lists
  use Effect arrays; role/removal and optimistic behavior are unchanged. SignIn refusal/pending email use Options.
- The audit table folds its unavailable answer to an empty list, and its optional display prop defaults in the React
  destructure. No new schemas or undecided defaults were introduced.
- Forced callers outside the package: `apps/inventory/src/web/Workspace.tsx`, `components/app/AppSidebar.tsx`,
  `components/app/SignedIn.tsx`, and `apps/inventory/test/web/session.test.ts`. They consume the Option fields;
  the test's builders now require explicit options and its known values narrow with `assertSome` from `@effect/vitest/utils`.
- `packages/access/web/strict-ceiling.json` fell from 14 to 6 after replacing native array methods. No baseline,
  exemption, lockfile, Verify lock, vendor file or secret file was edited.

The scoped defaults command read all nine package TypeScript files and the forced session test. It holds **4 fallback,
3 absence, 0 unwrap, 1 normalise** (8 total, down from the package's 37); the forced test has zero. Remaining places:

| File | Kind and count | Example and reason |
| --- | --- | --- |
| `People.screen.tsx` | fallback 2 | `O.getOrElse(person.email, () => "")` supplies ListTable's required search/sort text; title uses "Not set". UI boundary candidates, held unchanged |
| `Session.atoms.ts` | absence 2 | `typeof window === "undefined"`, likewise document: DOM subscription guard, candidate only |
| `SignIn.screen.tsx` | fallback 1, normalise 1 | Slug lowercases and uses "organization" when generated text is empty. Own unresolved normalization/default, retained unchanged, not an exemption candidate |
| `internal/authClient.ts` | fallback 1, absence 1 | Better Auth optional `message` uses the existing general sentence; nullable `result.error` chooses error/data. Third-party boundary candidates, held unchanged |

Uncounted folds are also explicit: People joinedAt value/title retain empty sort text and "Not set"; they predate this
change. New literal `onNone` cases are final screen output (hidden message/menu/breadcrumb, loading status, "closed"
sign-up offer), and the existing sign-in refusal's general sentence remains. Organization and list absence use
`A.empty`/`identity`, not renamed literal defaults. The JSX password `minLength` and header actions retain vendor prop
omission; DOM/vendor props are not changed into owned nullable data. No postMessage boundary exists in this package.

Validation: focused session/workspace tests pass, 31 tests in 2 files with no retry. Full `bun run check` passed
105 tasks (15.751 seconds) before the final test tightening. The final rerun after `assertSome` passed all 105 tasks
(20.532 seconds, 71 cached); app fast tests passed 70 tests in 19 files with no retry. Package source type-check
passed. Formatting touched only the changed code files and own strict ceiling. No browser was opened: signing in,
switching organization, adding a person, changing a role and removal were **not seen on screen**. `check:full`, the
155-item messy-sample path and production behavior were not checked; this lane is doing, not done.

Needs the person: nothing for this refactor; the existing slug default remains unresolved work for the sweep.

Final receipts: `/tmp/access-web-check-final.log`, `/tmp/access-web-tests.log`, and `/tmp/access-web-defaults.log`.
No cache overrides were needed; the existing app Vitest cache location was used. The explicit all-package scoped
law was rerun after the final edits, and `git diff --check` passed. A first full check failed only because the
strict ceiling had fallen; a later intermediate check caught the test narrowing's pipe diagnostic; both were
corrected before the successful final full check. No browser layout or view arrangement was changed.

## Foundation modeling: CSV, XLSX and vocabulary (PLAN row 8)

Written before code changes on 2026-11-26 from the owned source and test boundaries. These three packages are
ours; `schema`, `identity` and `utils` have `vendor.json` manifests and are outside this lane. The initial scoped
law reads 54 files: 107 fallback, 49 absence, 12 unwrap and 29 normalise places (197 total).

| Schema or boundary | Field | Verdict | Reason |
| --- | --- | --- | --- |
| CSV options and codec settings | delimiter, quoting, terminator, encoding, limits, BOM and progress | Required choices / existing schema defaults | Existing option schemas already name their usual values; owned calls must state their choice explicitly rather than default arguments |
| CSV table, records, record slices and positions | cells, quoted flags, record/field/offset/line | Required / State, as is | The machine checks and constructs these values; no per-cell decoding is added |
| CSV header view | missing trailing cell | Empty text, existing behavior | Short rows still fill a heading's cell with empty text; this policy must stay visible on the boundary schema if moved |
| CSV diagnostics and parse errors | finding and first diagnostic | Required / State | A parse error has a nonempty diagnostics array, so its first diagnostic is always present |
| CSV byte scanner | bytes inside checked length bounds | Required | Missing indexed bytes are impossible after the loop's bounds checks; retain a defect if violated, never a fabricated zero |
| CSV sep hint | delimiter capture | Required | The successful regex guarantees one allowed delimiter |
| XLSX workbook, sheets, rows and cells | names, coordinates, values, date system, formatting, formula, visibility | Required / State / existing Options, as is | Preserve the public workbook model and its writer; the streaming machine checks fields without decoding or copying each cell |
| XLSX XML and relationships | absent metadata and attributes | Absent or the existing compatibility value | Platform XML positions and optional relationship attributes enter here; malformed-file behavior must stay the same |
| XLSX address, formula and escape matches | successful match index and required capture groups | Required | Regex guarantees these captures; missing capture is a defect, not empty text or zero |
| XLSX writer and number-format scanner | characters inside checked string bounds | Required | Checked loop indices name an actual UTF-16 unit; lookahead and incomplete format syntax need their existing explicit cases |
| XLSX workbook fixture builder | namespace, surrounding XML, extra parts | Named starting values | A partial recipe is spread over one named starting object; optional part presence continues to decide which XML relationships exist |
| XLSX hostile test helpers | read limits | Required | Each test states the limit it intends to exercise; the ordinary limit is a named value |
| XLSX SheetJS oracle | absent library result fields | Absent at the third-party boundary | Compare Options; do not manufacture a workbook, cell or formula when an expected branch is missing |
| Vocabulary model, RDF registry and pointers | terms, marks, identity, parents, domains and ranges | Required / State / existing Options, as is | These are structural vocabulary checks, not new ontology terms; AST annotations are optional platform metadata |
| Vocabulary pointer test | unwrapped optional key fixtures | State, retained where testing the schema AST itself | Changing a deliberately optional schema node changes the subject of the pointer test |
| All owned tests | expected success, failure, row or cell | Required assertion | Narrow with `@effect/vitest/utils`; an absent expected branch must fail, never skip an expectation |

Unresolved compatibility readers and third-party edges remain unchanged until a truthful boundary can be established;
this lane records their final counts and examples below. No baseline or exemption is changed.

### Coverage of the existing schema fields

All of these schemas and their existing constructor/decoding defaults retain their public shape and encoding.
No schema was added or changed by this lane.

| Schema group | Field verdicts |
| --- | --- |
| CSV position scalars, `CsvTextSpan`, `CsvCell`, `CsvRecord`, `CsvRecordSlice`, `CsvTable` | Required values and bounded indices/text; record cells and spans are required, not defaulted. |
| `CsvDetectDelimiter`, `CsvFixedDelimiter`, `CsvDelimiterChoice`; `CsvDetectEncoding`, `CsvFixedEncoding`, `CsvEncodingChoice` | State cases; fixed delimiter/encoding required; detect candidates/window keep their existing schema defaults. |
| `CsvLimits`, `CsvReadOptions`, `CsvWriteOptions`, `CsvCodecOptions` | Existing schema defaults for each cap, dialect/encoding choice, quote/ragged/blank/trim rule, sep hint, writer separator/terminator/quote/BOM/formula guard and nested read/write settings. Internal callers now explicitly pass these schema-owned values. |
| All CSV diagnostic finding cases, `CsvWarning`, `CsvFatal`, `CsvDiagnostic`, `CsvParseError` | Required finding fields, positions and limits; severity/kind are State. Parse error diagnostics are nonempty, so its message reads index 0 directly. |
| `CsvDelimiterGiven`, `CsvDelimiterDetected`, `CsvDelimiterFromSepLine`, `CsvDelimiterFallback`, `CsvDelimiterFound`; all four encoding cases and `CsvEncodingFound` | State with required attribution; fallback comma and Windows-1252 are already explicit tagged cases, unchanged. |
| `CsvFromText`, `CsvFromBytes`, `CsvSource`, `CsvClean`, `CsvNoted`, `CsvOutcome`, `CsvRead`; `Pending`, `BytesPending`, machine state | State cases; source attribution, bytes and records required; clean outcome and the mutable machine's counters/buffers keep their existing starting values. |
| XLSX address/range/serial/date-system/column/row scalars and `XlsxAddress`, `XlsxRange`, `XlsxNumberFormat` | Required coordinates, bounds and serial interpretation; format id/code keep their existing General starting values. |
| `XlsxBlank`, `XlsxText`, `XlsxNumber`, `XlsxBoolean`, `XlsxError`, `XlsxDate`, `XlsxUnreadable`, `XlsxValue` | State cases with required case payloads. No new value or format is invented. |
| `XlsxCell` | column/value Required; formula Absent (Option, starts None); format existing General schema default. |
| `XlsxRow`, `XlsxSheetInfo`, `XlsxSheetCount` | row number/cells and sheet name/counts Required; hidden starts false; state starts visible; declared extent and last populated row Absent Options. |
| `XlsxWorksheet`, `XlsxWorkbook`, `XlsxDroppedPart`, dropped-kind/state enums | Required sheet identity and nonempty workbook sheets; rows/merges/hiddenColumns/dropped retain empty starting collections; date system retains 1900; dropped path/kind Required. |
| `XlsxAllSheets`, `XlsxNamedSheets`, `XlsxFirstSheet`, `XlsxSheetChoice`, `XlsxLimits`, `XlsxReadOptions`, `XlsxWriteOptions`, `XlsxCodecOptions` | State and Required named-sheet list; every existing cap and read-all/deflate/nested option default remains on its schema. |
| XLSX diagnostic finding cases, warning/fatal/diagnostic unions, `XlsxParseError`, `XlsxRead`, `XlsxSheetOutline`, `XlsxOutline`; `RawFormatKind` | State/Required existing finding/value fields; warnings/outline collections retain their schema starting values. Format variants retain required payloads. |
| Vocabulary key/IRI/text/ratification/enumeration scalars, RDF registry | Required existing bounds and literal domains; no term, authority or provenance receives a default. |
| `GistParent`, `LocalParent`, `NoParent`, `ParentLink`; `StatedIdentity`, `InheritedIdentity`, `IdentityCriterion`; `ClassRange`, `SchemeRange`, `RangeTarget` | State cases with Required payloads. NoParent carries its explicit reason. |
| `ClassTerm`, `ObjectPropertyTerm`, `DatatypePropertyTerm`, `Concept`, `ConceptScheme` | label/definition/ratification and case-specific tag/parent/identity/range/datatype/closed/concepts Required; altLabels Empty []; domain/evidence/alsoInstanceOf Absent Options as declared. |
| `GistClass`, `GistProjection`, `Vocabulary` | Gist parent Absent; versions/namespaces/IRIs/gist projection and every term table/disjoint-pair list Required. |
| Pointer mark/read cases, `FieldMark`, `SchemaMarks`, rule findings | State/Required mark payloads; fields Absent for a non-record; missing annotations remain unmarked. Generic annotation-maker input shapes remain unchanged. |

### Remaining counted sites

The final source inventory below is deliberate incomplete work, not exemptions and not a zero claim. All 54 files
were read. There are **123** retained sites: **60 fallback, 34 absence, 0 unwrap, 29 normalise**. Compared with the
initial 197, 74 sites were removed. Two normalise sites are configuration-field reads (`options.trim` and
`this.config.trim`), which this syntax reader counts. Seven counted sites remain in tests; no Option/Result test
branch still skips an expectation and no `getOrUndefined`/`getOrNull` remains. The two deliberately unwrapped
`S.optionalKey` pointer-test fixtures also remain unchanged; this law does not count them outside contract/model/host.

Paths below start at `packages/foundation/modeling/`. Counts are fallback / absence / unwrap / normalise. Line lists
name every remaining counted place in the formatted code; the example is one representative expression.

| File | Counts | Retained lines by kind | Reason and example |
| --- | --- | --- | --- |
| `csv/src/Csv.codec.ts` | 4 / 0 / 0 / 1 | fallback: 82, 391, 645, 662; normalise: 107 | Guaranteed delimiter capture and bounded byte access remain; the short-object-row empty-cell policy remains. `recordsFromString` must still accept omitted options from the vendored `TextDecodeTo` composer. `options.trim` is a configuration-field read counted by the syntax reader, not a clean-up call. Example: `match[1] ?? ","`. |
| `csv/src/CsvOptions.schema.ts` | 0 / 0 / 0 / 2 | normalise: 264, 265 | Dialect-selected trimming deliberately changes the raw CSV cell according to its selected trim rule; moving it to a universal schema would change dialect behavior. Example: `Str.trim`. |
| `csv/src/internal/encoding.ts` | 2 / 0 / 0 / 0 | fallback: 12, 32 | Bounds-checked UTF-8 scanning: no per-byte schema decode or new access allocation was added merely to lower the counter. Example: `bytes[i] ?? 0`. |
| `csv/src/internal/header.ts` | 1 / 0 / 0 / 0 | fallback: 36 | A short record fills missing headed cells with empty text. Retained rather than adding a decode or padding copy to every row. Example: `record[index] ?? ""`. |
| `csv/src/internal/machine.ts` | 0 / 2 / 0 / 1 | absence: 385, 385; normalise: 340 | Mutable parser head/quoted-head state checks remain. `this.config.trim` is a field read counted by the syntax reader. Example: `this.config.trim`. |
| `csv/src/internal/sniff.ts` | 0 / 1 / 0 / 0 | absence: 62 | An empty preview has no first width; this is delimiter-detection state. Example: `first === undefined`. |
| `xlsx/src/Xlsx.codec.ts` | 0 / 2 / 0 / 6 | absence: 168, 211; normalise: 130, 131, 362, 362, 391, 391 | Empty/missing sheet-header cases and case-insensitive sheet selection remain. They are not approved exemptions. Example: `Str.toLowerCase`. |
| `xlsx/src/XlsxAddress.schema.ts` | 2 / 3 / 0 / 1 | fallback: 140, 187; absence: 137, 186, 188; normalise: 102 | Reference regex failure, optional range end and required captures remain together with column-case interpretation; no throwing unwrap substituted. Example: `Str.toUpperCase`. |
| `xlsx/src/XlsxWorkbook.schema.ts` | 0 / 0 / 0 / 3 | normalise: 322, 393, 393 | Case-insensitive sheet-name uniqueness and lookup remain with the workbook algorithms. Example: `Str.toLowerCase`. |
| `xlsx/src/internal/container.ts` | 1 / 0 / 0 / 0 | fallback: 36 | A ByteSize too large to represent as number is capped at MAX_SAFE_INTEGER for comparison, unchanged. Example: `O.getOrElse`. |
| `xlsx/src/internal/formula.ts` | 6 / 0 / 0 / 0 | fallback: 20, 21, 21, 21, 21, 21 | Match index and regex captures remain; no unsafe unwrap or empty-string alias substituted. Example: `found.index ?? 0`. |
| `xlsx/src/internal/numberFormat.ts` | 13 / 4 / 0 / 7 | fallback: 77, 91, 112, 120, 142, 148, 252, 273, 281, 297, 306, 372, 376; absence: 145, 319, 361, 386; normalise: 59, 93, 137, 183, 274, 292, 306 | Format grammar scanning, optional decimal capture, partial tokens and rendering tables remain. These mix guaranteed indices with deliberately permissive malformed-format handling; a hotloop rewrite needs separate grammar and performance proof. Example: `Str.toLowerCase`. |
| `xlsx/src/internal/ooxml.ts` | 7 / 2 / 0 / 0 | fallback: 53, 54, 146, 147, 148, 159, 160; absence: 34, 91 | Third-party XML positions, missing attributes/root and Excel escape captures remain. Attribute reads are also used in streaming hotloops. Example: `exact !== undefined`. |
| `xlsx/src/internal/sheet.ts` | 13 / 8 / 0 / 5 | fallback: 117, 126, 306, 312, 335, 406, 407, 407, 420, 505, 506, 507, 555; absence: 118, 353, 395, 409, 422, 487, 498, 511; normalise: 485, 491, 491, 496, 518 | Streaming mutable row/cell state, absent XML attributes, style lookup, optional ISO time parts and unreadable-cell interpretation remain; no per-cell schema decode or per-row copy introduced. Example: `reference[i] ?? ""`. |
| `xlsx/src/internal/workbookPart.ts` | 4 / 6 / 0 / 2 | fallback: 95, 115, 237, 290; absence: 73, 92, 114, 120, 276, 281; normalise: 293, 296 | Missing metadata parts, styles, relationships and unnamed-sheet compatibility remain, plus case-insensitive duplicate names. This needs a coherent metadata-boundary change, not decodes for individual fallback expressions. Example: `renderDate({ code: format.code, serial: 1, date1904: false }) === undefined`. |
| `xlsx/src/internal/writer.ts` | 5 / 1 / 0 / 1 | fallback: 44, 45, 51, 52, 127; absence: 25; normalise: 24 | UTF-16 lookahead and surrogate handling, escaping case and guaranteed registered styles remain; the by-value XML writer was not changed. Example: `Str.toUpperCase`. |
| `xlsx/test/oracle.property.test.ts` | 2 / 0 / 0 / 0 | fallback: 174, 174 | SheetJS may omit workbook-sheet metadata or a visible-sheet Hidden flag. Existing [] and 0 comparisons are retained third-party boundary candidates. Example: `theirs.Workbook?.Sheets ?? []`. |
| `xlsx/test/support/workbooks.ts` | 0 / 5 / 0 / 0 | absence: 63, 64, 71, 85, 88 | A missing shared-text/styles part omits both the part and its relationship; a missing state omits its XML attribute. Five existing optional fixture checks remain; the independent starting values now use named object spreads. Example: `recipe.sharedStrings === undefined`. |

The existing `Effect.runSync` in `xlsx/src/Xlsx.codec.ts`'s synchronous `Xlsx.parseResult` is retained unchanged.
Removing that public synchronous entry point requires a separate API migration; this lane adds no `runSync`,
`Result.getOrThrow`, synchronous schema decoder/encoder, local default schema, or function `S.declare`. No optional
sort was rewritten and no new Optional-to-undefined codec was introduced. No owned file outside these packages was
forced to change: the catalog spreadsheet readers already passed explicit options.

### Validation for row 8

- `bun run beep laws defaults <all 54 owned source/test files>` passed: 60 fallback, 34 absence, 0 unwrap,
  29 normalise remain. The changed-file run passed 12 files with 6 fallback, 7 absence, 0 unwrap, 7 normalise.
  Logs: `/tmp/modeling-defaults-final.log`,
  `/tmp/modeling-residual.txt` and `/tmp/modeling-residual.json` (the final 123-site syntax inventory), and
  `/tmp/modeling-defaults-changed.log`. The baseline was never rewritten.
- The CSV suite passed 31 tests, the XLSX suite 92, and vocabulary 96. These include the CSV Effect oracle,
  SheetJS reading/writing/display properties, hostile files and arbitrary-model checks. Logs:
  `/tmp/modeling-csv-tests.log`, `/tmp/modeling-xlsx-tests.log`, `/tmp/modeling-vocabulary-tests.log`.
- The catalog web CSV differential (12), XLSX parity (24), and spreadsheet reader (37) suites passed all 73 tests
  with no retries: `/tmp/modeling-web-parity.log`. Their historical snapshots were not re-recorded.
- `bun run check` exited 0: 105/105 tasks successful, 64 cached, 3m24.356s. The log is
  `/tmp/modeling-full-check.log`. This includes the final fixture-builder changes; catalog web reported no retries.
  The run had a quiet interval after catalog model finished, then completed normally; it was not cancelled or rerun.
- `bun run format -- <12 changed TypeScript files>`, each package's targeted typecheck, `bun run docs:check`, and
  `git diff --check` passed. The docs checker retains the existing goal-status warnings. Effect 4.1.5 source was
  checked for the used Option/Array/Result APIs; test assertion signatures were read in `@effect/vitest/src/utils.ts`.
- Frozen paths have no diff. Baseline SHA-256 is
  `b342c617ccb4211d873737b819bdc1556f7089e52e3673eee45efe8437bb3bcd`; Verify lock is
  `4b118da8a3dd67a567a1d25d3dbfe9fcfa8fdcebfe3796adadc3fea1bd8bcd66`. No lockfile, vendored file,
  exemption or `.dev.vars` was edited. No commit or push was made.

Not run: `check:full`, a fresh on-screen messy-sample import through Confirm, a hosted deployment, or a dedicated
performance benchmark. This lane changes no schema sent through the browser and leaves all byte/cell parser
hotloops and the workbook XML writer untouched; the parity suites establish the local reader boundary only.
Row 8 remains incomplete with the 123 named places above.

Needs the person: nothing to approve for these edits. Row 8 still needs work on the 123 named sites; any
exemptions proposed later require Benjamin's explicit decision. No new product behavior was chosen in this lane.


## Catalog web internals (PLAN row 11)

Written before code changes on 2026-11-26. This lane owns only `packages/catalog/web/src/internal` and any
minimal callers forced by an owned signature. The initial explicit 20-file law run counts 100 places:
49 fallback, 23 absence, 8 unwrap and 20 normalise. The lane is doing, not done.

| Schema or boundary | Field | Verdict | Reason |
| --- | --- | --- | --- |
| `StoredSide` | decision, madeOn, seen, here, overtaken, refused | Required / existing Option, as is | A stored side preserves its decision and attribution; refusal and the decision already use null Options. |
| `StoredSide` | dates | Empty record when omitted | An older side kept no per-field dates; the writer already omits an empty record. `emptyWhenLeftOut` preserves that form. |
| `StoredLine` | sides, theirs | Required sides; Absent outer Option for theirs | An omitted key means no server comparison; explicit null means the server holds no decision. Both meanings must survive a reload. |
| `OlderClosed`, `OlderHold`, `OlderHeld` | decision, madeOn, seen, refused; kind/reason/theirs/thisTab; mine/madeOn/why/closed | Required / State / existing Options; thisTab and closed become outer Options | Old generations still read. Omitted thisTab differs from explicit null. An absent closed list contributes no sides. |
| `StoredWaiting` | waits, lines, confirms, leftOver, rows, beside, theirs, madeOn, seen, held, fileName | Existing forms retained; fileName Absent Option | Optional collection keys and legacy revision/seen compatibility values stay until their exact encodings can be preserved honestly. The current writer's keys and omission behavior do not change. |
| `Notice`, `NoticesKept` | kind, importId, fileName, rows, named, beside, theirs, at | State / Required / existing Options, retained | Legacy omitted named/theirs fields and final screen wording remain compatible. |
| `Patch` | sorting, column, columnFilters, filters, visibility, search | Independent optional patch data, retained | A patch remembers only the parts one action changed. A union migration needs to preserve older saved conversations and their exact stored form; no fallback-only decode is introduced. |
| `Sort`, `FilterItem`, `ViewState`, `ViewFilter`, `Kept` | all existing fields | Required, as is | Table state is supplied by the installed table; its optional column lookup and visibility dictionary semantics remain explicit residuals. |
| Worker protocol | request file/sheet; progress rowsRead/rowsAbout/exact; head/chunkSizes/workbook; chunk seq/rows; problem/message | Required wire data / State, retained | Payloads cross in encoded form. A staged cell's Option is encoded before postMessage and decoded on receipt; a structured clone cannot preserve its prototype. |
| Spreadsheet readers | file/bytes, sheet, notes, progress callback, piece size; Sniffed cases and read progress | Existing Required / State / optional callback contracts, retained | Native file bytes and library output enter here. Reader compatibility and clean-ups are inventoried, not silently changed. |
| Cell drafts and item text | dimensions, vendor fields, regex groups, parsed JSON | Existing reader behavior, retained | These are permissive presentations of possibly truncated or invalid file cells. Defaults and clean-ups need a complete reader boundary, not a schema made only to hide a fallback. |
| `Drawn`, `Opened`, route address reader | data/error/refused/gone/behind; import id/malformed | Existing screen adapter shapes, retained | Changing these requires the next screen/controller lane. DOM nullable address values are named residual edges. |
| Sheet controls | open workbook, disabled | Workbook Option rendered as whole cases; optional disabled with destructuring default | No workbook renders no control. The component keeps `disabled?: boolean` and its default is in destructuring, as requested; vendor optional props keep their documented form. |
| Decision line rendering and flagged rows | optional beside list, lookup results, proposal labels, counts | Absence list folds; existing data-dependent labels retained | A missing beside list contributes no lines. Counts group problem kinds once and read each group length, without copying a tally per row. Final screen words remain exact. |
| `CellForms`, `answeredBy` | draft form/error, actor display | Existing form state / final rendering, retained | No new atom or hook is needed. Typed drafts, validation and attribution keep their current behavior. |

No new undecided fallback is moved to a schema by this lane. The existing older draft's missing revision 0,
missing seen `[None]`, default false flags, and reader/display fallback values remain visible until their own
boundaries are settled. No new exemption or baseline is written.

### Remaining places in catalog web internals

The final internal inventory retains **88** places: **43 fallback, 19 absence, 6 unwrap, 20 normalise**.
Twelve places were removed from the initial 100. These are incomplete work, not approved exemptions. Every
remaining counted place is named by kind and line below; the exact expressions are also in
`/tmp/catalog-internal-residual.txt` and `/tmp/catalog-internal-residual.json`. Paths start at
`packages/catalog/web/src/internal/`; counts are fallback / absence / unwrap / normalise.

| File | Counts | Every retained line by kind | Why it remains and example |
| --- | --- | --- | --- |
| `CellForms.tsx` | 2 / 2 / 0 / 6 | fallback: 62, 142; absence: 105, 226; normalise: 80, 122, 123, 123, 124, 125 | Draft derivation remains a fallback from typed state to the file reader (62, 142); optional error presentation and six form-text clean-ups remain. Moving these needs the form-state boundary; no local default schema was introduced. |
| `WhyFlagged.tsx` | 3 / 1 / 0 / 2 | fallback: 15, 19, 79; absence: 38; normalise: 69, 70 | Unknown kind labels and sparse proposal labels retain their existing text; model Problem.field remains nullable. File-name/SKU trim only controls final display. Example: `proposal.labels[at] ?? value`. |
| `cellDrafts.ts` | 2 / 2 / 1 / 1 | fallback: 33, 80; absence: 11, 55; unwrap: 8; normalise: 18 | Permissive truncated-JSON reader and optional regex captures remain together. Example: `parsed(piece) ?? vendorFound(piece)`. A full schema needs to preserve partial cell content; no fallback-only parser was added. |
| `format.tsx` | 1 / 0 / 0 / 1 | fallback: 84; normalise: 8 | ValuePill uses trim to decide whether to draw the empty label; older take-back records with no kind still say accept. Example: `taken.kind ?? "accept"`. |
| `itemText.ts` | 5 / 3 / 1 / 6 | fallback: 19, 20, 58, 59, 131; absence: 18, 57, 104; unwrap: 101; normalise: 17, 42, 43, 56, 132, 150 | Money regex match/captures and permissive JSON presentation preserve invalid text; tags and money display still trim. Example: `parts[2] ?? ""`. A failed presentation must keep the original cell, not invent a valid item. |
| `leftOver.ts` | 3 / 0 / 0 / 0 | fallback: 30, 104, 354 | Unknown field names show the field itself; refused lines retain empty text only if their refusal is unexpectedly absent; multi-row list final indexing retains its defensive empty text. Example: `numbers[numbers.length - 1] ?? ""`. |
| `notices.ts` | 3 / 1 / 0 / 0 | fallback: 66, 70, 71; absence: 49 | DOM storage null remains at entry; legacy optional theirs and final import-name wording remain. Example: `gone.theirs ?? {}`. No change to stored notices or screen wording. |
| `reader.worker.ts` | 0 / 1 / 0 / 0 | absence: 51 | Wire request sheet is null for CSV/first read, compared at the platform boundary before building the reader input. Example: `sheet === null`. Head and chunks now cross fully encoded. |
| `result.ts` | 0 / 1 / 2 / 0 | absence: 24; unwrap: 22, 55 | The existing screen adapter returns undefined data and nullable error, and callers in the screen lane depend on them. Example: `AsyncResult.value` to `O.getOrUndefined`. This lane does not conceal it in a codec. |
| `route.ts` | 0 / 2 / 1 / 0 | absence: 13, 15; unwrap: 14 | URLSearchParams.get returns null; the existing controller-facing id remains undefined for absent/invalid input. Example: `id === undefined`. A decoded Option return needs the screen/controller lane. |
| `spreadsheet/csv.ts` | 1 / 0 / 0 / 0 | fallback: 33 | Owned optional progress and piece size remain part of direct reader/test API, including callback omission. Example: `input.pieceChars ?? pieceChars`. Required explicit arguments would force reader-test callers and need their own focused migration. |
| `spreadsheet/read.ts` | 4 / 1 / 0 / 4 | fallback: 51, 53, 131, 190; absence: 73; normalise: 83, 83, 131, 142 | Owned optional input/callback contracts, archive instruction override, ASCII scan index, extension regex and format sniff/display clean-ups remain. Example: `input.onProgress ?? (() => {})`. Native File bytes and regex results are boundary data. |
| `spreadsheet/xlsx.ts` | 2 / 2 / 0 / 0 | fallback: 100, 172; absence: 127, 138 | Owned optional callback and listed limit remain; indexed package sheet/last cell, unreadable display checks and format-frequency start value remain. Example: `MutableHashMap.get(notShown, code)` with zero. Missing sheet still defects; no throwing unwrap replaces it. |
| `storedWaiting.ts` | 8 / 1 / 1 / 0 | fallback: 114, 163, 163, 167, 171, 178, 181, 186; absence: 232; unwrap: 203 | Legacy maps and revision/seen compatibility remain, and confirms still writes explicit null. Example: `entry.waits ?? {}`. Using emptyWhenLeftOut for every map would omit empty keys that the current writer writes, so it was not used there. |
| `view.ts` | 9 / 2 / 0 / 0 | fallback: 60, 65, 118, 127, 131, 166, 168, 171, 173; absence: 169, 172 | Installed table dictionaries and column lookup semantics plus independently optional stored patches remain. Example: `patch.search ?? state.search`. A state union migration must also preserve saved assistant conversations; no fallback-only decode was added. |

`answeredBy.ts`, `SheetButton.tsx`, `SheetChooser.tsx`, `protocol.ts` and `spreadsheet/index.ts` have no counted
places. `SheetChooser.disabled` remains a component optional prop with its default in destructuring, as requested.
The remaining owned reader optional arguments and optional keys are unresolved work too, even where this web-law
reader does not count their declarations. No new optional owned input was added. The real nullable platform edges
still include localStorage text, URLSearchParams, RegExp captures, File/worker request payloads and package/table
indexed lookup results. None was added to exemptions.

Literal empty-return cases added by this lane are final JSX output (`SheetButton` renders null), not data stand-ins.
The two absent-list folds use `O.match` with `A.empty` and `identity`. No optional-value sort was changed. The
flagged-row counts group kinds and read group lengths, avoiding the prior copied record for every problem. No
performance claim is made without a benchmark.

Forced files outside internal: `Upload.controller.ts` decodes the encoded head once on receipt, beside the existing
chunk decoder; `test/UploadOwner.test.ts` supplies the valid encoded head the new receipt decoder requires (kind,
headerRowNumber and one column) while keeping its pre-existing assertion and test logic;
`strict-ceiling.json` falls from 225 to the measured 216 because native collection calls fell. There are no other
forced callers. No .dev.vars, defaults baseline, exemptions, Verify lock, vendor, UI component or hook was changed.
The forced caller/test law counts are unchanged: Upload.controller 3 fallback / 6 absence / 2 unwrap;
UploadOwner.test 2 fallback / 1 absence. Their existing places belong to later lanes.
Receipt: `/tmp/catalog-internal-3238a079-forced-law.jsonl`.


### Validation for catalog web internals

- The explicit 20-internal-file `bun run beep laws defaults <files>` passed with 43 fallback, 19 absence,
  6 unwrap and 20 normalise remaining. The 22-file run including forced caller/test passed with 48 fallback,
  26 absence, 8 unwrap and 20 normalise. Receipts:
  `/tmp/catalog-internal-3238a079-internal-law.log`, `/tmp/catalog-internal-3238a079-defaults-final.log`.
  No baseline was rewritten.
- A local scratch comparison against HEAD's old StoredWaiting implementation passed six cases, comparing both
  reconstructed Waiting values and the encoded output of toStored: omitted/null line.theirs and thisTab,
  per-field dates, named left-over rows, confirms and optional file name. Receipt:
  `/tmp/catalog-internal-3238a079-stored-proof.log`. This is focused synthetic compatibility proof.
- A local scratch run of the actual reader worker module passed: 201 columns still gives exactly the existing
  stagingProblem refusal; a 40,000-character heading still reaches the original server validation path; encoded
  heads for both None/Some sheet survive structuredClone and schema decode. Receipt:
  `/tmp/catalog-internal-3238a079-worker-proof.log`. The complete-head encode/decode uses disableChecks only for
  same-build wire refinements, preserving where existing bounds are refused; Option transformations still run.
  Effect 4.1.5 SchemaAST.ts documents this at ParseOptions.disableChecks and the runtime proof checks it.
- The first full check exposed the fake worker's incomplete UploadOwner head. Its one fixture was corrected as
  listed above. Follow-up attempts stopped on the assertion count during an intermediate fixture edit (the
  pre-existing assertion is retained in the final code, ledger unchanged), then Bun temporary/cache and Wrangler
  registry/log EROFS restrictions. The final run redirects BUN_TMPDIR, BUN_INSTALL_CACHE_DIR, TMPDIR,
  TURBO_CACHE_DIR, XDG_CONFIG_HOME and MINIFLARE_CACHE_DIR into `/tmp/catalog-internal-3238a079-*`.
- Effect 4.1.5 source was checked for the added Array/Option/Record/Schema/Function calls and the existing
  emptyWhenLeftOut implementation was read. No local schema, synchronous decoder/encoder, throwing unwrap,
  runSync, function declaration schema, Option-to-undefined codec or new React state/effect hook was added.

No browser was opened. Upload, Match, Review, Result and Items were **not seen on screen**. A fresh Confirm storing
155 rows, the stored/result/Items agreement, check:full, hosted behavior and a dedicated performance benchmark
were not checked by this lane. The sample's local pure review and clone-wire tests do not establish those gates.

Final validation: `bun run check` exited 0 with the temporary environment above: **105/105 tasks successful**,
64 cached, 2m42.014s. Log: `/tmp/catalog-internal-3238a079-final5-check.log`. Catalog web passed **401 tests in
38 files** with no retry; these include ItemImport (6 tests, messy sample 155 Ready / 200), ChunkCrossing (2),
DraftLines (29), DraftPicks (14), DraftServer (5), UploadOwner (9), reader parity and the draft scenarios.

- `bun run beep laws defaults <all 20 internal files>` passed with 43 / 19 / 6 / 20, log
  `/tmp/catalog-internal-3238a079-internal-law.log`. Adding the forced controller and test passed 22 files,
  48 / 26 / 8 / 20, log `/tmp/catalog-internal-3238a079-defaults-final.log`. The forced controller's own counts
  remain 3 / 6 / 2 / 0 and the forced test's 2 / 1 / 0 / 0, exactly as at HEAD; their exact sites are in
  `/tmp/catalog-internal-3238a079-forced-law.jsonl`.
- The six-case local saved-waiting comparison against HEAD passed equal Waiting values and equal encoded
  `toStored` forms, covering omitted/null `theirs` and `thisTab`, per-field dates, left-over rows and confirms.
  Receipt: `/tmp/catalog-internal-3238a079-stored-proof.log`.
- A local proof importing the actual worker module passed: 201 columns keeps the exact staging refusal;
  a 40,000-character heading keeps the existing server-validation path; both sheet Option cases preserve
  their value through encoded head, structured clone and decoding. Receipt:
  `/tmp/catalog-internal-3238a079-worker-proof.log`. Head encoding/receipt disable only schema checks, retaining
  structure and transformations (`SchemaAST.ParseOptions`, Effect 4.1.5), so the server keeps the previous
  bounds-validation responsibility and wording. Chunk validation is unchanged.
- Formatting the changed files, `bun run docs:check`, and `git diff --check` passed. Docs retains the existing
  goal-status warnings. No baseline rewrite was run. Frozen-file diffs are empty; baseline SHA-256 is
  `df503235c0673f190db92339592c05c686721888b6c595113de7214108727894`, Verify lock
  `4b118da8a3dd67a567a1d25d3dbfe9fcfa8fdcebfe3796adadc3fea1bd8bcd66`.

Not run: `check:full`, fresh on-screen upload/Confirm/Result/Items proof, hosted deployment or dedicated performance
benchmark. The sample assertion proves local review counts, not 155 newly stored rows or what the screen draws.
The UI was **not seen on screen**. No commit or push was made.

Needs the person: nothing to approve for these edits. The 88 named internal places and the rest of catalog web
remain sweep work; this lane proposes no exemption or new product decision.
