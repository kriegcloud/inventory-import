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

## Client and owned UI (PLAN row 10)

Written on 2026-11-26 before changing code. API retries, member isolation, optimistic rollback, sign-in states,
error sentences, stored browser bytes and rendered outcomes retain their existing behavior.

| Schema or boundary | Field | Verdict | Reason |
| --- | --- | --- | --- |
| Client query/write configuration | keeping policy and options argument | Required choices | Callers state the former keeping policy; optional reactivity keys and comparison time remain unresolved below |
| Client read/write state | held answer, given answer, pending request, optimistic entries | State / Absent | Retain actual absence and object identity through atoms; no invented answer |
| Signed-in member | session, organization, identity | State / Absent | Nobody signed in and no chosen organization remain distinct from an authenticated member |
| Client HTTP URL and header boundary | origin, page address | Required / platform edge | Preserve same-origin requests and header behavior; an unavailable platform capability is named rather than disguised |
| Client storage | missing or refused read | Absent | Existing encoded bytes stay unchanged; absence remains an Option until its consumer chooses behavior |
| Client error input | typed refusal, transport failure, cause | State / Required | Preserve every existing sentence and transient retry classification |
| Client test builders and result assertions | inputs / expected branch | Required / asserted branch | Builders receive explicit overrides over named starting objects; unexpected branches fail assertions |
| UI React component props | optional presentation choices | Optional props with destructuring defaults | React callers may omit presentation props; defaults belong at destructuring, not body fallbacks |
| UI route and measurement helpers | navigation flags, callback, font choices | Required choices / Absent | Our helpers require callers to state choices; DOM nulls remain boundary candidates |
| UI date presentation | invalid date | State | A whole match draws the original input or the formatted date |
| UI search | typed text, asked text, table search | State / Normalised at entry | Keep debounce, external search changes and keyboard behavior; decode clean text at its entry |
| UI proposal attribution | source, confidence | Absent / existing presentation policy | Never invent attribution; existing confidence wording is preserved and any undecided fallback is named |
| UI theme storage | chosen word, refused read, device setting | State / existing light policy | Bare localStorage words and pre-paint compatibility stay unchanged |
| UI JSON codec | arbitrary JSON input/output | Third-party synchronous edge candidate | Do not replace synchronous schema operations with a renamed escape or change invalid-input behavior |
| UI DOM and vendored component boundaries | missing elements, optional third-party props | Edge candidates | Leave genuinely nullable platform APIs and vendored contracts intact and inventory remaining places |

Final counts, remaining examples and validation are recorded below after implementation.

### Retained places after the row 10 sweep

The scoped scanner fell from **127 to 68**: client **64 to 16**, owned UI **63 to 52**.
Client tests have **zero** places across all 13 test/support files. These are retained places, not approved
exemptions. No baseline or exemption was changed. The broader zero-place objective remains open.

| File | Kind | Count | Example | Reason held |
| --- | --- | --- | --- | --- |
| packages/client/src/Api.atoms.ts | unwrap | 1 | answerOf: O.getOrUndefined | Changing the public derived atom requires broad dependent drawing changes; held rather than rename the unwrap |
| packages/client/src/Api.atoms.ts | absence | 3 | options.reactivityKeys === undefined; since !== undefined; keys === undefined | Own optional config not yet modeled as required Options; original checks restored rather than merely wrapping undefined at use |
| packages/client/src/Optimistic.atoms.ts | absence | 1 | spec.settled !== undefined | Own optional settled config remains; original check retained |
| packages/client/src/SayError.controller.ts | absence | 2 | options.lead === undefined; error === null | Own optional lead config remains; original logOnce object/null guard retained |
| packages/client/src/Connection.atoms.ts | absence | 2 | typeof window === "undefined" | Browser platform capability gates for server rendering/tests; unchanged |
| packages/client/src/SayError.controller.ts | fallback | 1 | troubleSentence: dictionary choice ?? fixed model sentence | Existing unknown/missing installed wording policy; retained exactly instead of moving literal to a renamed starting object or fallback-only decode |
| packages/client/src/SayError.controller.ts | normalise | 2 | fieldWords: last.replace(...).toLowerCase(); requestProblems: label.charAt(0).toUpperCase() | Existing synchronous human-readable path rendering; original capitalisation restored rather than hide normalization behind Str.capitalize |
| packages/client/src/Tab.atoms.ts | absence | 4 | typeof navigator; navigator.locks === undefined; locks === undefined; lock === null | Actual browser lock capability and ifAvailable lock-acquisition boundary; unchanged |


| File under packages/ui/src | Kind | Count | Example | Classification and reason retained |
| --- | --- | --- | --- | --- |
| AgentRun.component.tsx | absence | 5 | `step.input !== undefined` | Owned run-step presentation absence; conditional detail/tag drawing. Rendering candidates, not approved exemptions. Optional RunStep data not yet schema modeled. |
| Json.codec.ts | absence | 1 | `value === undefined` | Synchronous JSON boundary candidate. Undefined retains stringify's existing undefined output. |
| ListTable.component.tsx | fallback | 6 | `counts[text] ?? 0`, `column.width ?? room` | Unresolved owned defaults: two facet count fallbacks, fixed width 0, flexible width room, default cell renderer, hover text. No schema policy invented. |
| ListTable.component.tsx | absence | 6 | `value === undefined`, `first === undefined` | Unresolved owned column representation and final rendering; toolbar null check draws optional wrapping. These are not all third-party edges. |
| ListTable.component.tsx | normalise | 2 | filter text `.toLowerCase()` | Owned case-insensitive search comparison; existing behavior retained, boundary normalization not yet modeled. |
| PageHeader.component.tsx | absence | 2 | `props.line === undefined` | Optional React line/actions final drawing. Explicit null currently differs from omitted props (wrapper exists); a null default would change DOM behavior. Rendering candidates. |
| ProposalSource.words.ts | absence | 2 | `fix.confidence === undefined` | Unresolved owned proposal attribution absence; helper signatures/callers not migrated. |
| ProposalSource.words.ts | fallback | 1 | `fix.confidence ?? "medium"` | Unresolved owned medium-confidence presentation policy; no new schema solely to hide fallback. Existing wording preserved. |
| ProposedValue.component.tsx | absence | 4 | `props.source === undefined` | Optional React source/state final drawing; omitted state and each provided state have distinct markup. Rendering candidates. |
| Route.atoms.ts | fallback | 2 | `[path = "/", query = ""]` | Unresolved owned route-splitting defaults; preserved original split semantics. |
| Skeletons.component.tsx | absence | 7 | `props.title === undefined`, `props.rows === undefined` | React loading presentation and outgoing optional property bags, including one vendored DataTableFrameSkeleton rows boundary. Mixed rendering and vendor optional-prop candidates. |
| Skeletons.component.tsx | fallback | 2 | `column.width ?? 240`, `column.label ?? <Skeleton ... />` | Unresolved owned skeleton-column data defaults; retained rather than moving into noncomponent destructuring. |
| TableSearch.component.tsx | absence | 1 | `event.target.closest("[role=dialog]") !== null` | Real nullable DOM query candidate: preserve dialog keyboard ownership. |
| TableSearch.component.tsx | normalise | 6 | `after.value.text.trim()`, `event.key.toLowerCase()` | Five owned trim sites for search comparison/submission and one browser keyboard spelling normalization. Existing debounce, submission and shortcut behavior retained; normalization schema not introduced. |
| TextWidth.measure.ts | absence | 3 | `context === null`, `families === undefined` | One real nullable canvas API result; two owned lazy initialization states remain unresolved. |
| TextWidth.measure.ts | fallback | 2 | CSS property `|| "sans-serif"` | CSS/browser font boundary with owned fallback policy (sans-serif/monospace), unresolved rather than silently schema-wrapped. |


The five unchanged synchronous escapes beyond this checkout's scanner are `Api.atoms.ts`
`Effect.runSync(Reactivity.make)` (1), `SayError.controller.ts` synchronous `Effect.logError` (2), and
`ui/src/Json.codec.ts` synchronous encode/decode (2). They remain named candidates, not cleared sites.
`Http.runtime.ts` now consumes the native response Option with an Effect match; a missing native response dies
with the invariant. Present fetch options are provided unchanged, and absent options leave the optional
RequestInit service unprovided (FetchHttpClient supplies its existing empty options).

Uncounted own optional configuration is also still unresolved: query/write reactivity keys, `askAgain`
comparison time, optimistic retry/settled/onAnswer/onRefused/readAgainAfterRefusal callbacks and options, and
local subscription lifecycle. None is claimed schema-complete. Optional DOM chaining remains at the actual
platform edge, including search field focus and the theme-color meta element.

### Changes and forced callers

The lane requires callers to state query keeping/options, write options, error field mappings/toast options,
connection retry predicates, navigation history choice, link callbacks and text-measurement flags. Early GET
consumption returns an Option through its API consumer. Cache and display-state folds preserve complete cases.
Nonblank error reasons preserve their original bytes and continue accepting array/function carriers. React
maxWidth and skeleton rows defaults sit in component destructuring. Stored schemas, files and wire shapes did
not change, and no worker/postMessage boundary changed. No undecided fallback was moved to a new schema.

Changed files (outside client/UI, every code change is a forced caller of these signatures):

- `apps/inventory/src/web/Workspace.tsx`
- `apps/inventory/src/web/components/app/AppSidebar.tsx`
- `apps/inventory/src/web/components/app/SignedIn.tsx`
- `apps/inventory/src/web/lib/api.ts`
- `apps/inventory/src/web/pages/ActivityPage.tsx`
- `apps/inventory/test/web/session.test.ts`
- `goals/defaults-at-boundaries/PLAN.md`
- `goals/defaults-at-boundaries/VERDICTS.md`
- `packages/access/web/src/AuditEvents.screen.tsx`
- `packages/access/web/src/People.screen.tsx`
- `packages/catalog/web/src/ImportDecisions.screen.tsx`
- `packages/catalog/web/src/ImportPage.screen.tsx`
- `packages/catalog/web/src/Imports.atoms.ts`
- `packages/catalog/web/src/ItemEditor.screen.tsx`
- `packages/catalog/web/src/ItemsPage.screen.tsx`
- `packages/catalog/web/src/MatchStep.screen.tsx`
- `packages/catalog/web/src/ResultStep.screen.tsx`
- `packages/catalog/web/src/ReviewDraft.atoms.ts`
- `packages/catalog/web/src/ReviewStep.screen.tsx`
- `packages/catalog/web/src/TableAssistant.screen.tsx`
- `packages/catalog/web/src/Upload.controller.ts`
- `packages/catalog/web/src/UploadStep.screen.tsx`
- `packages/catalog/web/src/internal/SheetButton.tsx`
- `packages/catalog/web/test/readSpreadsheet.test.ts`
- `packages/client/src/Api.atoms.ts`
- `packages/client/src/Connection.atoms.ts`
- `packages/client/src/Early.runtime.ts`
- `packages/client/src/Http.runtime.ts`
- `packages/client/src/Member.atoms.ts`
- `packages/client/src/Optimistic.atoms.ts`
- `packages/client/src/SayError.controller.ts`
- `packages/client/src/Tab.atoms.ts`
- `packages/client/strict-ceiling.json`
- `packages/client/test/Answer.atoms.test.ts`
- `packages/client/test/Connection.atoms.test.ts`
- `packages/client/test/Freshness.atoms.test.ts`
- `packages/client/test/Member.atoms.test.ts`
- `packages/client/test/Optimistic.atoms.test.ts`
- `packages/client/test/Paging.atoms.test.ts`
- `packages/client/test/SayError.test.ts`
- `packages/client/test/Seed.atoms.test.ts`
- `packages/client/test/SignOut.atoms.test.ts`
- `packages/client/test/SignedIn.atoms.test.ts`
- `packages/client/test/Storage.browser.test.ts`
- `packages/client/test/support.ts`
- `packages/review/src/internal/ReviewGrid.tsx`
- `packages/ui/src/Dates.format.ts`
- `packages/ui/src/ListTable.component.tsx`
- `packages/ui/src/ProposalSource.words.ts`
- `packages/ui/src/Route.atoms.ts`
- `packages/ui/src/Skeletons.component.tsx`
- `packages/ui/src/TableSearch.component.tsx`
- `packages/ui/src/TextWidth.measure.ts`
- `packages/ui/src/Theme.provider.tsx`
- `packages/ui/strict-ceiling.json`


### Validation and proof limits

Final `bun run check --env-mode=loose` passed **105/105 tasks**, 56 cached, in **2m59.917s**
(`/tmp/defaults-client-ui-check.log`). Temporary Bun cache, XDG cache, Turbo cache and Wrangler registry paths
under `/tmp/defaults-client-ui-*` were supplied for the sandbox. Earlier integration attempts stopped on caller
formatting, the unchanged readonly ledger after extra readonly modifiers, and one missed People query keeping
argument. Each was corrected in owned code or a forced caller; no tooling ledger was edited.

The final scoped defaults command over 41 owned source/test files passed with **14 fallback, 43 absence,
1 unwrap, 10 normalise** (68). A separate command over all 13 client test/support files passed with all four
counts **zero**. The defaults baseline was not lowered. Client tests passed **58 tests in 12 files**; catalog web
passed **401 tests in 38 files**. No test needed a second try. All changed code/ceiling files were formatted;
Markdown is excluded by the formatter, and `bun run docs:check` passed for the goal packet.

UI and client strict ceilings fell from their original values **50 to 40** and **20 to 15** respectively,
matching measured diagnostics; none was raised. UI export checks passed all 136 entries. Review checks passed
251/251 for the measurement callers. A synthetic equivalence check covered 432 old/new search shown-state
combinations; this proves the derived state fold, not browser debounce timing.

HTTP proof checks credentials, cache, redirect, integrity, a forwarded non-aborted signal, and native Response
identity/body. Actual abort timing and request-body round-trip were not asserted. Error tests preserve empty-key
field labels for numeric paths and reasons carried by arrays/functions. Existing atom tests cover member
isolation, sign-out cleanup, stale answers, concurrent optimistic edits, rollback and retries.

Not run: `check:full`, slow database tests, a real browser import, hosted deployment, or on-screen verification.
**Not seen on screen.** The orchestrator still owns the sample import and its 155-item acceptance check.
No commit or push was made. No baseline, exemption, vendored file, stored snapshot or Verify lock was changed,
and `.dev.vars` was not read. Final protected hashes remain:

- `defaults-baseline.json`: `f0f425222d9a71cfab28ff687c3a1212a1c0336d2df15a43fb649da168107cb0`
- `packages/catalog/model/test/Catalog.lock.json`: `4b118da8a3dd67a567a1d25d3dbfe9fcfa8fdcebfe3796adadc3fea1bd8bcd66`

Needs the person: nothing

## Review internal lane, row 9, 2026-11-26

Scope: the eight files in `packages/review/src/internal` only. Before edits the scoped law holds 242 sites:
79 fallback, 146 absence, 12 unwrap and five normalise. Other review source and tests belong to later lanes.
This is a partial lane; no baseline or exemption is changed.

| Owner / fields | Verdict | Boundary and reason |
| --- | --- | --- |
| `PhoneDrawer` open/change/focus handlers, title, description, children | Required | Screen inputs; quiet description and footer remain optional presentation props. |
| `parts` Overlay trigger/title/about/children; align, side, open, callbacks, hover/card and className | Required core, optional screen props | Align starts at start and side at bottom. An uncontrolled overlay uses its held open state. Put these defaults in destructuring; keep the optional prop contracts. |
| `parts` OverlayHeld open/opened/byHover/timer; CutScope cut/open; EditScope text | Required starting state | Existing atom starting values retain their meaning; no persisted encoding is changed. |
| `parts` DecisionTag words; CellValue empty | Optional screen props | Existing review words and no empty-cell content are presentation defaults; destructure at the screen. |
| `parts` CutText children/card; WhyBody actions; Reason source/detail; GroupChange choices/label/display | Optional presentation or dependency-owned absence | ReactNode includes null, so a destructuring default cannot replace the children/card nullish fallback without changing the display. Fix/column/word schemas are outside this lane. |
| `ReviewGrid` RowActions/GroupActions, region atoms, virtualizer callbacks | Required capabilities or dependency-owned optional actions | Keep the callable contracts and DOM/virtualizer null conventions; do not wrap local values to disguise a boundary that belongs to another file. |
| `ReviewGrid` typeIt guess | Required argument with explicit absence | Every call must state whether it carries a proposal; the local helper's argument need not be optional. |
| `ReviewGrid` headings, signs, seen/drawn state, parts and sized columns | Required state or existing dependency-owned absence | Keep existing initial state and no per-row copy. ColumnPlan and ReviewTypes need a coordinated schema/caller lane. |
| `ReviewQueue` Place at/shown, Card key/moved; Queue atoms/handlers | Required state | Existing starts at card zero and 30 shown; identity stays explicit, not schema-defaulted. |
| `ReviewQueue` CardProps columns/labels/kinds/actions/excluded; rowAction/cellEditor | Required inputs, dependency-owned optional capabilities | ReviewTypes and ReviewRegion own these boundaries, outside this lane. |
| `WorkList` items/active/onPick/mode; More left/right; viewport | Required inputs/state; DOM nullable edge | Undefined active means another view is selected; toggle API draws it as empty. DOM query and ref null semantics stay unchanged. |
| `sizing` SizedColumn fields; ColumnPlan shown/folded/minWidth/scrolls/flex; priority/core | Required widths/state, Option flex, optional column metadata | The planner returns an Option for its flex column; candidate selection also stays Option until the loop consumes it. Missing priority/core remain the column owner's next-lane concern. |
| `keptStore` storage lookup, getItem/key and KeyValueStore read/write results | Browser/library edge | Storage can refuse access, return null, or be absent. Preserve visit-only operation and bare-word compatibility. This file writes no progress shape itself. |
| `identity` composer | Required | No optional field or fallback. |

Remaining sites will be inventoried by file and kind after edits, with examples and reasons. No stored progress schema,
wire representation, product fallback, or review words change in this lane. Not seen on screen (browser explicitly
out of scope).

### Review internal residual inventory

The scoped law after edits holds 234 sites: 72 fallback, 145 absence, 12 unwrap and five normalise.
Line numbers below count occurrences, so a repeated number means two sites on that line. These are retained sites,
not approved exemptions. `identity.ts` has none. Files are relative to `packages/review/src/internal/`.

| File | Kind | Count | Lines | Example | Reason retained |
| --- | --- | --- | --- | --- | --- |
| `PhoneDrawer.tsx` | absence | 1 | 36 | `props.footer === undefined` | Owned optional screen footer; presence decides whether a footer container is drawn. No default container is wanted. |
| `ReviewGrid.tsx` | absence | 91 | 130, 137, 187, 236, 240, 283, 292, 301, 303, 316, 350, 351, 352, 353, 357, 357, 358, 359, 361, 364, 366, 369, 416, 419, 420, 421, 424, 427, 428, 434, 437, 439, 442, 445, 472, 488, 503, 552, 555, 569, 587, 621, 629, 638, 650, 685, 686, 686, 691, 745, 745, 747, 747, 773, 791, 805, 807, 831, 837, 853, 866, 893, 903, 903, 903, 912, 922, 966, 972, 981, 1041, 1050, 1152, 1243, 1263, 1269, 1416, 1427, 1435, 1502, 1564, 1596, 1711, 1829, 1829, 1832, 1838, 1844, 1890, 1961, 1961 | `first === undefined` | Dependency-owned ReviewTypes/Draft/Region cases, optional column metadata and actions; owned conditional presentation (headings, comparison and editor branches); DOM/virtualizer presence. Requires coordinated owner schemas, or remains an actual screen conditional. |
| `ReviewGrid.tsx` | fallback | 46 | 130, 171, 171, 182, 183, 235, 237, 237, 257, 257, 258, 287, 292, 294, 354, 354, 358, 367, 424, 433, 478, 555, 557, 561, 622, 623, 626, 632, 632, 669, 709, 715, 831, 925, 1026, 1045, 1130, 1273, 1493, 1494, 1494, 1672, 1689, 1797, 1798, 1804 | `view.cells[first.id] ?? ""` | Dependency-owned cell text, problem/column/choice fields and measured-column metadata; local top-length selection and virtualizer self state. Preserve exact empty text, action words, width and previous-draw behavior; no fallback-only local codec. |
| `ReviewGrid.tsx` | unwrap | 6 | 235, 416, 1426, 1626, 1686, 1771 | `O.getOrUndefined` | HashMap kinds and region action Options currently cross screen/helper boundaries as undefined; DOM scroll element and observer/ref callbacks use vendor null/undefined conventions. Early internal unwraps remain pending owner conversion. |
| `ReviewGrid.tsx` | normalise | 1 | 310 | `mark.from.trim` | Compares before/after spaces to choose how a proposal is drawn; leaves the reviewed cell untouched. Presentation comparison is retained, not an approved cleanup exemption. |
| `ReviewQueue.tsx` | absence | 31 | 95, 126, 219, 255, 276, 296, 297, 298, 299, 300, 301, 306, 306, 320, 320, 341, 347, 360, 368, 404, 413, 424, 433, 444, 444, 449, 449, 453, 463, 492, 641 | `shown === undefined` | Dependency-owned problem/fix/choice/action/column absence plus current-card/list bounds and optional custom editor branches. Preserve exact queue transitions and the controls offered. |
| `ReviewQueue.tsx` | fallback | 15 | 126, 133, 139, 236, 276, 300, 348, 351, 355, 355, 387, 406, 418, 601, 603 | `view.cells[first.id] ?? ""` | Dependency-owned missing cell text, labels, problem ask and choice destination; custom editor display. Requires upstream field verdicts rather than local stand-in schemas. |
| `ReviewQueue.tsx` | unwrap | 4 | 204, 404, 557, 601 | `O.getOrUndefined` | HashMap kind lookup and region optional capabilities are unwrapped into current screen props; retained until the owning review contracts move. |
| `WorkList.tsx` | fallback | 3 | 53, 71, 85 | `props.active ?? ""` | Two active-view conversions to the external ToggleGroup empty selection; one nullable DOM query. Active remains a required explicit argument; these are browser/component edges. |
| `WorkList.tsx` | absence | 2 | 98, 115 | `element === null` | Actual DOM element and first child may be null; observers subscribe only to elements that exist. |
| `keptStore.ts` | unwrap | 1 | 16 | `O.getOrUndefined` | Browser localStorage access can throw; current lookup exposes undefined to the adapter. No storage or stored-progress representation change in this lane. |
| `keptStore.ts` | absence | 3 | 33, 37, 47 | `storage === undefined` | Browser storage availability and getItem null contract; preserves visit-only fallback and compatibility text. Actual browser edge, not a review domain default. |
| `parts.tsx` | absence | 17 | 227, 267, 318, 326, 348, 351, 354, 449, 538, 566, 574, 601, 605, 605, 619, 624, 631 | `props.className === undefined` | Owned screen optional className/display/actions/undo/all and custom render branches, dependency-owned marks/source/detail/decided, plus DOM ref absence. Optional actions stay absent to omit their control; no no-op defaults. |
| `parts.tsx` | fallback | 7 | 285, 292, 503, 507, 542, 547, 550 | `props.tone ?? props.kind?.tone` | Tone and group label belong to dependency-owned models. CutText children/card ReactNode null falls back to text as before; destructuring would preserve null and change what is drawn. |
| `parts.tsx` | normalise | 4 | 380, 668, 668, 682 | `mark.from.trim` | One before/after display comparison and three edit-form trims (two calls on submit, one disabled check). Moving edit normalization needs the real form boundary; no local sync decode or altered entered value. |
| `parts.tsx` | unwrap | 1 | 571 | `O.getOrUndefined` | Confidence Option passed to the external ProposalSource helper; current boundary expects undefined. |
| `sizing.ts` | fallback | 1 | 111 | `column.priority ?? (column.core === true ? 1 : 0)` | Column priority/core owner remains outside lane; keep priority 1 for core, 0 otherwise until the real column schema can carry it. |

Changes outside the eight-file lane: `test/ReviewLayout.test.ts` changes its single direct `plan.flex` assertion
from a string to `O.some("name")`; `packages/review/strict-ceiling.json` lowers 251 to 249 because two native array
calls were removed. No other source/test caller changed. Existing collection processing never adds a per-row copy.
The stored browser progress schemas and storage adapter are unchanged.

Validation: final `bun run check --env-mode=loose` passed 105/105 tasks (54 cached), 2m51.104s; log
`/tmp/review-internal-check.log`. It includes review 115 tests, strict count 249/249, catalog web 401 tests with no
retries. The five separately targeted suites passed 41 tests. Scoped defaults, docs and diff checks pass. The first
full-check attempt refused non-readonly comparator parameter properties; corrected before the passing rerun.
No baseline or Verify-lock diff. Not seen on screen; no browser, commit, push or deployment.

Needs the person: nothing.

## Catalog web tests lane, row 11, 2026-11-26

Scope: `packages/catalog/web/test` and its test support only. Before edits the scoped defaults law holds
251 sites in 46 read files: 166 fallback, 74 absence, eight unwrap and three normalise. Source files belong to
concurrent lanes and are not edited here. The baseline, PLAN, Verify lock and exemptions are not changed.

| Owner / fields | Verdict | Boundary and reason |
| --- | --- | --- |
| Fixture builders for table columns, CSV lines, workbook parts, import views, draft sides and server answers | Required explicit fixture inputs | Test callers select their starting fixture with a named object and replace the fields relevant to the case. These are invented test records, not product missing-input policy. |
| Test lookup results, patches, rows, saved questions, proposals and decoded chunks | Required when the case expects presence | Narrow before reading with the vitest utilities. A missing expected value must fail, never skip an expectation or silently supply an empty patch. |
| Progress totals | Optional when an estimate is unavailable | Preserve the property test's unknown-total case; when the test explicitly expects a total, assert presence before the numeric comparison. |
| Browser stand-in storage reads and listener registries | Real browser absence; optional recorded collections | Storage's absent key returns null. Listener collections can be empty; consuming a missing collection must enumerate no listeners. No storage representation changes. |
| Test session member identity, organization and account | Required explicit fixture values | Preserve the selected identity and organization; any fixture defaults are named starts chosen by the test caller, never defaults for authority on a product schema. |
| API stand-in registry options, session callbacks and toast options | Optional dependency configuration and explicit owned inputs | Library optional bags stay at the call boundary. Owned helpers must state their inputs. Do not introduce a no-op callback to hide absence. |
| Draft-world and independent fold-model record histories, command states and expected decisions | Explicit model states and optional history entries | Their fallback behavior is part of the test oracle. Keep a site unchanged if moving it would disguise an oracle policy as schema validation or change generated command behavior. Inventory retained sites individually after edits. |
| Review parity and honesty problem/fix/choice metadata | Dependency-owned optional review data | Preserve the distinction between a row with no question and one with a question; expected rows must assert presence. Search/iteration branches needed to choose a command remain real model branches. |
| Worker chunks and spreadsheet file cells | Encoded transfer, decoded test values | Keep the encoded form across structuredClone/postMessage, as ChunkCrossing specifies. No decoded Option is sent as a valid worker payload. |
| Presentation spelling comparisons in honesty/parity assertions | Test comparisons, no written normalization | Existing comparison semantics stay unless the assertion can compare the intended canonical result directly. No fallback-only schema is introduced; the SKU comparison uses the existing S.Trim codec. |

This lane adds no product schema default. Any remaining site is a retained candidate, not an approved exemption.
The inventory below records the retained sites after the edits; validation evidence follows it.

### Catalog web test changes and retained inventory

The final scoped inventory holds **93 sites**: **50 fallback, 43 absence, zero unwrap and zero normalise**. The 46-file read includes all tests and support, including files with no original baseline entry. Compared with the original 251 sites, 158 sites were removed; the baseline itself remains unchanged. Every retained occurrence is listed below. These are unresolved candidates, not exemptions.

Fixture callers now explicitly choose starts for columns, CSV lines, workbook parts, draft sides, save answers, visit options and session members. Helper default parameters are required, including the returned answerSave/decide methods. Optional recorded lists use full Option matches with A.empty/identity. Expected patches and matching rows narrow with assertDefined; the removal list stays Option through assertSome. The worker round-trip obtains its wire with encodeEffect before structuredClone. No valid worker chunk sends a decoded Option.

The SKU assertion retains its dynamic relation to each raw fixture cell: S.Trim decodes the expected value in Effect, and the same actual SKU list is compared with it. The no-model assertions compare the same fixed source-word outputs using /model/i; for the ASCII word model this preserves their case-insensitive substring condition without cleaning the text. All original expectations remain, apart from the equivalent removal-list expectation expressed by assertSome; presence assertions were added where the existing expected value already required presence. Real optional progress/model states use full matches to keep their original conditional properties.

Files in this table are relative to `packages/catalog/web/test/`. A repeated line is a distinct occurrence.

| File | Kind | Line | Example | Reason retained |
| --- | --- | --- | --- | --- |
| `Conversation.test.ts` | fallback | 47 | `kept[key] ?? null` | The storage stand-in implements the browser getItem contract: an absent key returns null. A schema default would invent stored text; no edge exemption is added. |
| `DraftRegion.test.ts` | fallback | 49 | `options?.description ?? ""` | The sonner stand-in observes dependency-owned optional description/action props. Empty description remains the existing observation value, and an absent action records no callable action. Callback schemas are not introduced. |
| `DraftRegion.test.ts` | absence | 50 | `options?.action !== undefined` | The sonner stand-in observes dependency-owned optional description/action props. Empty description remains the existing observation value, and an absent action records no callable action. Callback schemas are not introduced. |
| `ItemEditor.test.ts` | fallback | 56 | `options?.description ?? ""` | The sonner stand-in observes the existing optional description and action callback together. Preserve the exact empty-description observation; a description-only fallback codec would hide the same policy. |
| `KeptRows.test.ts` | fallback | 58 | `kept[key] ?? null` | Browser storage and tab identity can be absent. The mutable server stand-in also distinguishes no view (a pending read), a selected organization, and an optional session stand-in. Its real ImportView/source boundaries are outside the test lane; preserve these distinct simulated states and the existing empty-text searches. |
| `KeptRows.test.ts` | fallback | 80 | `tab[key] ?? null` | Browser storage and tab identity can be absent. The mutable server stand-in also distinguishes no view (a pending read), a selected organization, and an optional session stand-in. Its real ImportView/source boundaries are outside the test lane; preserve these distinct simulated states and the existing empty-text searches. |
| `KeptRows.test.ts` | fallback | 147 | `browser.tab["inventory:tab"] ?? ""` | Browser storage and tab identity can be absent. The mutable server stand-in also distinguishes no view (a pending read), a selected organization, and an optional session stand-in. Its real ImportView/source boundaries are outside the test lane; preserve these distinct simulated states and the existing empty-text searches. |
| `KeptRows.test.ts` | fallback | 185 | `server.in ?? "org_prairie"` | Browser storage and tab identity can be absent. The mutable server stand-in also distinguishes no view (a pending read), a selected organization, and an optional session stand-in. Its real ImportView/source boundaries are outside the test lane; preserve these distinct simulated states and the existing empty-text searches. |
| `KeptRows.test.ts` | absence | 188 | `server.view === undefined` | Browser storage and tab identity can be absent. The mutable server stand-in also distinguishes no view (a pending read), a selected organization, and an optional session stand-in. Its real ImportView/source boundaries are outside the test lane; preserve these distinct simulated states and the existing empty-text searches. |
| `KeptRows.test.ts` | absence | 208 | `session === undefined` | Browser storage and tab identity can be absent. The mutable server stand-in also distinguishes no view (a pending read), a selected organization, and an optional session stand-in. Its real ImportView/source boundaries are outside the test lane; preserve these distinct simulated states and the existing empty-text searches. |
| `KeptRows.test.ts` | absence | 217 | `session === undefined` | Browser storage and tab identity can be absent. The mutable server stand-in also distinguishes no view (a pending read), a selected organization, and an optional session stand-in. Its real ImportView/source boundaries are outside the test lane; preserve these distinct simulated states and the existing empty-text searches. |
| `KeptRows.test.ts` | fallback | 766 | `browser.kept[keyOf(id, "mem_marcus", "org_prairie")] ?? ""` | Browser storage and tab identity can be absent. The mutable server stand-in also distinguishes no view (a pending read), a selected organization, and an optional session stand-in. Its real ImportView/source boundaries are outside the test lane; preserve these distinct simulated states and the existing empty-text searches. |
| `KeptRows.test.ts` | fallback | 767 | `browser.kept[keyOf(id, "mem_marcus", "org_prairie")] ?? ""` | Browser storage and tab identity can be absent. The mutable server stand-in also distinguishes no view (a pending read), a selected organization, and an optional session stand-in. Its real ImportView/source boundaries are outside the test lane; preserve these distinct simulated states and the existing empty-text searches. |
| `ReviewHistory.test.ts` | fallback | 40 | `kept[key] ?? null` | These two getItem stand-ins implement the browser null-on-missing contract for local and session storage. No stored representation or edge exemption changes. |
| `ReviewHistory.test.ts` | fallback | 49 | `tab[key] ?? null` | These two getItem stand-ins implement the browser null-on-missing contract for local and session storage. No stored representation or edge exemption changes. |
| `ReviewModelFold.fold.test.ts` | fallback | 117 | `O.getOrElse` | Independent fold-oracle policy retained: absent decision means undecided; missing text means NO_DECISION; missing answer/touch/revision means zero; missing person means nobody; sealed next level means noLevel; missing undo history retains its existing sentinel or mirror. These values govern the independent oracle and sparse histories; a local schema wrapper would merely hide the same fallback. See the explicit mapping below. |
| `ReviewModelFold.fold.test.ts` | fallback | 366 | `O.getOrElse` | Independent fold-oracle policy retained: absent decision means undecided; missing text means NO_DECISION; missing answer/touch/revision means zero; missing person means nobody; sealed next level means noLevel; missing undo history retains its existing sentinel or mirror. These values govern the independent oracle and sparse histories; a local schema wrapper would merely hide the same fallback. See the explicit mapping below. |
| `ReviewModelFold.fold.test.ts` | fallback | 529 | `O.getOrElse` | Independent fold-oracle policy retained: absent decision means undecided; missing text means NO_DECISION; missing answer/touch/revision means zero; missing person means nobody; sealed next level means noLevel; missing undo history retains its existing sentinel or mirror. These values govern the independent oracle and sparse histories; a local schema wrapper would merely hide the same fallback. See the explicit mapping below. |
| `ReviewModelFold.fold.test.ts` | fallback | 599 | `O.getOrElse` | Independent fold-oracle policy retained: absent decision means undecided; missing text means NO_DECISION; missing answer/touch/revision means zero; missing person means nobody; sealed next level means noLevel; missing undo history retains its existing sentinel or mirror. These values govern the independent oracle and sparse histories; a local schema wrapper would merely hide the same fallback. See the explicit mapping below. |
| `ReviewModelFold.fold.test.ts` | fallback | 656 | `O.getOrElse` | Independent fold-oracle policy retained: absent decision means undecided; missing text means NO_DECISION; missing answer/touch/revision means zero; missing person means nobody; sealed next level means noLevel; missing undo history retains its existing sentinel or mirror. These values govern the independent oracle and sparse histories; a local schema wrapper would merely hide the same fallback. See the explicit mapping below. |
| `ReviewModelFold.fold.test.ts` | fallback | 657 | `O.getOrElse` | Independent fold-oracle policy retained: absent decision means undecided; missing text means NO_DECISION; missing answer/touch/revision means zero; missing person means nobody; sealed next level means noLevel; missing undo history retains its existing sentinel or mirror. These values govern the independent oracle and sparse histories; a local schema wrapper would merely hide the same fallback. See the explicit mapping below. |
| `ReviewModelFold.fold.test.ts` | fallback | 728 | `O.getOrElse` | Independent fold-oracle policy retained: absent decision means undecided; missing text means NO_DECISION; missing answer/touch/revision means zero; missing person means nobody; sealed next level means noLevel; missing undo history retains its existing sentinel or mirror. These values govern the independent oracle and sparse histories; a local schema wrapper would merely hide the same fallback. See the explicit mapping below. |
| `ReviewModelFold.fold.test.ts` | fallback | 761 | `O.getOrElse` | Independent fold-oracle policy retained: absent decision means undecided; missing text means NO_DECISION; missing answer/touch/revision means zero; missing person means nobody; sealed next level means noLevel; missing undo history retains its existing sentinel or mirror. These values govern the independent oracle and sparse histories; a local schema wrapper would merely hide the same fallback. See the explicit mapping below. |
| `ReviewModelFold.fold.test.ts` | fallback | 764 | `O.getOrElse` | Independent fold-oracle policy retained: absent decision means undecided; missing text means NO_DECISION; missing answer/touch/revision means zero; missing person means nobody; sealed next level means noLevel; missing undo history retains its existing sentinel or mirror. These values govern the independent oracle and sparse histories; a local schema wrapper would merely hide the same fallback. See the explicit mapping below. |
| `ReviewModelFold.fold.test.ts` | fallback | 779 | `O.getOrElse` | Independent fold-oracle policy retained: absent decision means undecided; missing text means NO_DECISION; missing answer/touch/revision means zero; missing person means nobody; sealed next level means noLevel; missing undo history retains its existing sentinel or mirror. These values govern the independent oracle and sparse histories; a local schema wrapper would merely hide the same fallback. See the explicit mapping below. |
| `ReviewModelFold.fold.test.ts` | fallback | 1017 | `O.getOrElse` | Independent fold-oracle policy retained: absent decision means undecided; missing text means NO_DECISION; missing answer/touch/revision means zero; missing person means nobody; sealed next level means noLevel; missing undo history retains its existing sentinel or mirror. These values govern the independent oracle and sparse histories; a local schema wrapper would merely hide the same fallback. See the explicit mapping below. |
| `ReviewModelFold.fold.test.ts` | fallback | 1167 | `O.getOrElse` | Independent fold-oracle policy retained: absent decision means undecided; missing text means NO_DECISION; missing answer/touch/revision means zero; missing person means nobody; sealed next level means noLevel; missing undo history retains its existing sentinel or mirror. These values govern the independent oracle and sparse histories; a local schema wrapper would merely hide the same fallback. See the explicit mapping below. |
| `ReviewModelFold.fold.test.ts` | fallback | 1168 | `O.getOrElse` | Independent fold-oracle policy retained: absent decision means undecided; missing text means NO_DECISION; missing answer/touch/revision means zero; missing person means nobody; sealed next level means noLevel; missing undo history retains its existing sentinel or mirror. These values govern the independent oracle and sparse histories; a local schema wrapper would merely hide the same fallback. See the explicit mapping below. |
| `ReviewModelFold.fold.test.ts` | fallback | 1188 | `O.getOrElse` | Independent fold-oracle policy retained: absent decision means undecided; missing text means NO_DECISION; missing answer/touch/revision means zero; missing person means nobody; sealed next level means noLevel; missing undo history retains its existing sentinel or mirror. These values govern the independent oracle and sparse histories; a local schema wrapper would merely hide the same fallback. See the explicit mapping below. |
| `ReviewModelFold.fold.test.ts` | fallback | 1321 | `O.getOrElse` | Independent fold-oracle policy retained: absent decision means undecided; missing text means NO_DECISION; missing answer/touch/revision means zero; missing person means nobody; sealed next level means noLevel; missing undo history retains its existing sentinel or mirror. These values govern the independent oracle and sparse histories; a local schema wrapper would merely hide the same fallback. See the explicit mapping below. |
| `ReviewModelFold.fold.test.ts` | fallback | 1326 | `O.getOrElse` | Independent fold-oracle policy retained: absent decision means undecided; missing text means NO_DECISION; missing answer/touch/revision means zero; missing person means nobody; sealed next level means noLevel; missing undo history retains its existing sentinel or mirror. These values govern the independent oracle and sparse histories; a local schema wrapper would merely hide the same fallback. See the explicit mapping below. |
| `ReviewModelFold.fold.test.ts` | absence | 1728 | `O.isNone(press)` | No generated press means there is no action to apply; continue the generated command sequence. This is oracle action selection, not a skipped required expectation. |
| `SessionAsked.test.ts` | fallback | 35 | `of[key] ?? null` | Browser missing storage, not-found organization attribution, and the source-owned import view skeleton are actual distinct states. The leave subscription is mounted only once. Retain those lifecycle transitions; no no-op callback or replacement source state schema is added. |
| `SessionAsked.test.ts` | absence | 145 | `notFoundIn === undefined` | Browser missing storage, not-found organization attribution, and the source-owned import view skeleton are actual distinct states. The leave subscription is mounted only once. Retain those lifecycle transitions; no no-op callback or replacement source state schema is added. |
| `SessionAsked.test.ts` | absence | 178 | `view.data === undefined` | Browser missing storage, not-found organization attribution, and the source-owned import view skeleton are actual distinct states. The leave subscription is mounted only once. Retain those lifecycle transitions; no no-op callback or replacement source state schema is added. |
| `SessionAsked.test.ts` | fallback | 180 | `step.leave ??= registry.mount(followDraft(id))` | Browser missing storage, not-found organization attribution, and the source-owned import view skeleton are actual distinct states. The leave subscription is mounted only once. Retain those lifecycle transitions; no no-op callback or replacement source state schema is added. |
| `TabRows.test.ts` | fallback | 47 | `of()[key] ?? null` | The browser lock stand-in preserves the Web Locks default exclusive mode and optional wait. Before a tab owns an identity the test API reports empty text, and closing it uses the same existing lock spelling; preserve the copy/lock races and pre-identity state. |
| `TabRows.test.ts` | fallback | 96 | `options.mode ?? "exclusive"` | The browser lock stand-in preserves the Web Locks default exclusive mode and optional wait. Before a tab owns an identity the test API reports empty text, and closing it uses the same existing lock spelling; preserve the copy/lock races and pre-identity state. |
| `TabRows.test.ts` | absence | 134 | `wait === undefined` | The browser lock stand-in preserves the Web Locks default exclusive mode and optional wait. Before a tab owns an identity the test API reports empty text, and closing it uses the same existing lock spelling; preserve the copy/lock races and pre-identity state. |
| `TabRows.test.ts` | fallback | 218 | `O.getOrElse` | The browser lock stand-in preserves the Web Locks default exclusive mode and optional wait. Before a tab owns an identity the test API reports empty text, and closing it uses the same existing lock spelling; preserve the copy/lock races and pre-identity state. |
| `TabRows.test.ts` | fallback | 273 | `O.getOrElse` | The browser lock stand-in preserves the Web Locks default exclusive mode and optional wait. Before a tab owns an identity the test API reports empty text, and closing it uses the same existing lock spelling; preserve the copy/lock races and pre-identity state. |
| `TableAssistant.test.ts` | fallback | 23 | `kept[key] ?? null` | The localStorage stand-in returns null for a missing key, as the browser API does. This remains an edge candidate, not an approved exemption. |
| `TakenBackWords.test.ts` | fallback | 50 | `more?.description ?? ""` | The sonner stand-in records optional dependency description text using its existing empty-description observation. No fallback-only codec or callback schema is introduced. |
| `UploadOwner.test.ts` | fallback | 53 | `init.method ?? ""` | The fetch/sonner stand-ins observe optional RequestInit.method and description text. Fiber.pollUnsafe is a dependency-owned optional completion result; the helper reports whether the worker has ended. Preserve these API edge observations. |
| `UploadOwner.test.ts` | fallback | 63 | `options?.description ?? ""` | The fetch/sonner stand-ins observe optional RequestInit.method and description text. Fiber.pollUnsafe is a dependency-owned optional completion result; the helper reports whether the worker has ended. Preserve these API edge observations. |
| `UploadOwner.test.ts` | absence | 237 | `fiber.pollUnsafe() !== undefined` | The fetch/sonner stand-ins observe optional RequestInit.method and description text. Fiber.pollUnsafe is a dependency-owned optional completion result; the helper reports whether the worker has ended. Preserve these API edge observations. |
| `reviewParity.test.ts` | absence | 108 | `O.isNone(group)` | These are action-selection boundaries in the dependency-owned review model: terminate when no automatic group remains; choose only offered SKU/choice/rival actions; an offered optional rival or choice can be absent. Full Option matches preserve the optional commands. These branches select a command, not whether a required fixture assertion runs. |
| `reviewParity.test.ts` | absence | 115 | `view.problem.rivals === undefined` | These are action-selection boundaries in the dependency-owned review model: terminate when no automatic group remains; choose only offered SKU/choice/rival actions; an offered optional rival or choice can be absent. Full Option matches preserve the optional commands. These branches select a command, not whether a required fixture assertion runs. |
| `reviewParity.test.ts` | absence | 125 | `view.problem?.choices !== undefined` | These are action-selection boundaries in the dependency-owned review model: terminate when no automatic group remains; choose only offered SKU/choice/rival actions; an offered optional rival or choice can be absent. Full Option matches preserve the optional commands. These branches select a command, not whether a required fixture assertion runs. |
| `reviewParity.test.ts` | absence | 125 | `view.problem.column !== undefined` | These are action-selection boundaries in the dependency-owned review model: terminate when no automatic group remains; choose only offered SKU/choice/rival actions; an offered optional rival or choice can be absent. Full Option matches preserve the optional commands. These branches select a command, not whether a required fixture assertion runs. |
| `reviewParity.test.ts` | absence | 132 | `choice !== undefined` | These are action-selection boundaries in the dependency-owned review model: terminate when no automatic group remains; choose only offered SKU/choice/rival actions; an offered optional rival or choice can be absent. Full Option matches preserve the optional commands. These branches select a command, not whether a required fixture assertion runs. |
| `reviewParity.test.ts` | absence | 132 | `column !== undefined` | These are action-selection boundaries in the dependency-owned review model: terminate when no automatic group remains; choose only offered SKU/choice/rival actions; an offered optional rival or choice can be absent. Full Option matches preserve the optional commands. These branches select a command, not whether a required fixture assertion runs. |
| `reviewParity.test.ts` | absence | 140 | `view.problem?.rivals !== undefined` | These are action-selection boundaries in the dependency-owned review model: terminate when no automatic group remains; choose only offered SKU/choice/rival actions; an offered optional rival or choice can be absent. Full Option matches preserve the optional commands. These branches select a command, not whether a required fixture assertion runs. |
| `reviewParity.test.ts` | absence | 149 | `rival !== undefined` | These are action-selection boundaries in the dependency-owned review model: terminate when no automatic group remains; choose only offered SKU/choice/rival actions; an offered optional rival or choice can be absent. Full Option matches preserve the optional commands. These branches select a command, not whether a required fixture assertion runs. |
| `reviewHonesty.test.ts` | absence | 81 | `row.problem?.fix === undefined` | These two predicates classify dependency-owned rows with no fix: collect existing proposals and identify refusal-only rows. No expected row is silently skipped; required row/cost fixtures now assert presence. |
| `reviewHonesty.test.ts` | absence | 160 | `view.problem?.fix === undefined` | These two predicates classify dependency-owned rows with no fix: collect existing proposals and identify refusal-only rows. No expected row is silently skipped; required row/cost fixtures now assert presence. |
| `support/catalog.ts` | absence | 45 | `input.signedIn === undefined` | AtomRegistry configuration contains optional dependency capabilities: providing no signed-in/asked atom keeps the actual default service layer; missing idleTTL uses the registry own default. These are runtime atom/service values, not serializable data; do not add S.declare for functions or a fallback-only schema. |
| `support/catalog.ts` | absence | 46 | `input.asked === undefined` | AtomRegistry configuration contains optional dependency capabilities: providing no signed-in/asked atom keeps the actual default service layer; missing idleTTL uses the registry own default. These are runtime atom/service values, not serializable data; do not add S.declare for functions or a fallback-only schema. |
| `support/catalog.ts` | absence | 48 | `input.idleTTL === undefined` | AtomRegistry configuration contains optional dependency capabilities: providing no signed-in/asked atom keeps the actual default service layer; missing idleTTL uses the registry own default. These are runtime atom/service values, not serializable data; do not add S.declare for functions or a fallback-only schema. |
| `support/draftWorld.ts` | fallback | 304 | `world.everHeld[row] ?? [O.none()]` | A row with no recorded history has the initial undecided (None) history. Preserve the independent oracle policy; an empty list would weaken the conservation assertion. |
| `support/draftWorld.ts` | fallback | 393 | `save.madeOn[row] ?? 0` | An absent oracle revision is compared as revision zero, including rematch/conflict classification. A sparse record has no entry to decode for this key; moving the sentinel into a lookup schema would retain the same hidden policy. |
| `support/draftWorld.ts` | absence | 424 | `O.isSome(written)` | This guard selects a real simulated command/state transition (a pending versus answered save/read/confirm, or a draft with versus without a picture). Preserve the generated history; the remaining guard does not suppress a required fixture expectation. |
| `support/draftWorld.ts` | absence | 479 | `O.isSome(world.read)` | This guard selects a real simulated command/state transition (a pending versus answered save/read/confirm, or a draft with versus without a picture). Preserve the generated history; the remaining guard does not suppress a required fixture expectation. |
| `support/draftWorld.ts` | fallback | 534 | `names[row]?.length ?? 0` | No named decisions has count zero in the 50-decision invariant. Retained oracle counting policy; no fallback-only record lookup codec is added. |
| `support/draftWorld.ts` | absence | 783 | `O.isNone(world.draft.held)` | This guard selects a real simulated command/state transition (a pending versus answered save/read/confirm, or a draft with versus without a picture). Preserve the generated history; the remaining guard does not suppress a required fixture expectation. |
| `support/draftWorld.ts` | absence | 786 | `line === undefined` | No matching live line/side offers no settlement action. Retain the command-enabledness rule; asserting presence would reject valid generated commands. |
| `support/draftWorld.ts` | absence | 801 | `O.isNone(side)` | No matching live line/side offers no settlement action. Retain the command-enabledness rule; asserting presence would reject valid generated commands. |
| `support/draftWorld.ts` | absence | 810 | `O.isNone(side.value.refused)` | Refused and live sides have different simulated settlement/history transitions. Preserve the generated oracle state cases; no data default is supplied. |
| `support/draftWorld.ts` | absence | 864 | `O.isSome(world.draft.held)` | This guard selects a real simulated command/state transition (a pending versus answered save/read/confirm, or a draft with versus without a picture). Preserve the generated history; the remaining guard does not suppress a required fixture expectation. |
| `support/draftWorld.ts` | absence | 868 | `O.isSome(confirm.answer)` | This guard selects a real simulated command/state transition (a pending versus answered save/read/confirm, or a draft with versus without a picture). Preserve the generated history; the remaining guard does not suppress a required fixture expectation. |
| `support/draftWorld.ts` | fallback | 875 | `confirm.madeOn[row] ?? 0` | An absent oracle revision is compared as revision zero, including rematch/conflict classification. A sparse record has no entry to decode for this key; moving the sentinel into a lookup schema would retain the same hidden policy. |
| `support/draftWorld.ts` | absence | 892 | `O.isNone(confirm.answer)` | This guard selects a real simulated command/state transition (a pending versus answered save/read/confirm, or a draft with versus without a picture). Preserve the generated history; the remaining guard does not suppress a required fixture expectation. |
| `support/draftWorld.ts` | fallback | 909 | `confirm.madeOn[row] ?? 0` | An absent oracle revision is compared as revision zero, including rematch/conflict classification. A sparse record has no entry to decode for this key; moving the sentinel into a lookup schema would retain the same hidden policy. |
| `support/draftWorld.ts` | absence | 929 | `O.isNone(world.draft.held)` | This guard selects a real simulated command/state transition (a pending versus answered save/read/confirm, or a draft with versus without a picture). Preserve the generated history; the remaining guard does not suppress a required fixture expectation. |
| `support/draftWorld.ts` | fallback | 1004 | `O.getOrElse` | The rematch oracle attributes a value with no prior recorded writer to somebody else. Preserve this provenance sentinel rather than adding a fixture schema default for authorship. |
| `support/draftWorld.ts` | absence | 1013 | `O.isSome(left)` | This guard selects a real simulated command/state transition (a pending versus answered save/read/confirm, or a draft with versus without a picture). Preserve the generated history; the remaining guard does not suppress a required fixture expectation. |
| `support/draftWorld.ts` | fallback | 1052 | `which ?? "last"` | The source-owned generated command leaves its save selector out to select the last pending save. Moving that value requires changing the command schema outside this lane; a local fallback-only decode would hide it. |
| `support/draftWorld.ts` | absence | 1054 | `O.isSome(save.answer)` | This guard selects a real simulated command/state transition (a pending versus answered save/read/confirm, or a draft with versus without a picture). Preserve the generated history; the remaining guard does not suppress a required fixture expectation. |
| `support/draftWorld.ts` | fallback | 1058 | `which ?? "last"` | The source-owned generated command leaves its save selector out to select the last pending save. Moving that value requires changing the command schema outside this lane; a local fallback-only decode would hide it. |
| `support/draftWorld.ts` | absence | 1059 | `O.isNone(save.answer)` | This guard selects a real simulated command/state transition (a pending versus answered save/read/confirm, or a draft with versus without a picture). Preserve the generated history; the remaining guard does not suppress a required fixture expectation. |
| `support/draftWorld.ts` | absence | 1071 | `O.isSome(world.draft.landed)` | This guard selects a real simulated command/state transition (a pending versus answered save/read/confirm, or a draft with versus without a picture). Preserve the generated history; the remaining guard does not suppress a required fixture expectation. |
| `support/draftWorld.ts` | fallback | 1088 | `which ?? "last"` | The source-owned generated command leaves its save selector out to select the last pending save. Moving that value requires changing the command schema outside this lane; a local fallback-only decode would hide it. |
| `support/draftWorld.ts` | fallback | 1094 | `which ?? "last"` | The source-owned generated command leaves its save selector out to select the last pending save. Moving that value requires changing the command schema outside this lane; a local fallback-only decode would hide it. |
| `support/draftWorld.ts` | absence | 1095 | `O.isSome(save.answer)` | This guard selects a real simulated command/state transition (a pending versus answered save/read/confirm, or a draft with versus without a picture). Preserve the generated history; the remaining guard does not suppress a required fixture expectation. |
| `support/draftWorld.ts` | fallback | 1102 | `which ?? "last"` | The source-owned generated command leaves its save selector out to select the last pending save. Moving that value requires changing the command schema outside this lane; a local fallback-only decode would hide it. |
| `support/draftWorld.ts` | absence | 1103 | `O.isSome(save.answer)` | This guard selects a real simulated command/state transition (a pending versus answered save/read/confirm, or a draft with versus without a picture). Preserve the generated history; the remaining guard does not suppress a required fixture expectation. |
| `support/draftWorld.ts` | absence | 1136 | `view !== undefined` | A simulated read with no view leaves the tab without a new picture. This belongs to the command/history model, not an expected-present test fixture. |
| `support/draftWorld.ts` | absence | 1199 | `O.isSome(one.refused)` | Refused and live sides have different simulated settlement/history transitions. Preserve the generated oracle state cases; no data default is supplied. |
| `support/draftWorld.ts` | fallback | 1314 | `world.everHeld[fact.row] ?? [O.none()]` | A row with no recorded history has the initial undecided (None) history. Preserve the independent oracle policy; an empty list would weaken the conservation assertion. |
| `support/draftWorld.ts` | absence | 1593 | `command === undefined` | No enabled generated command ends generation. This is valid command selection, not a required assertion fixture; asserting presence would change the generated histories. |
| `support/draftWorld.ts` | absence | 1596 | `O.isNone(O.liftThrowable(runIn)(world, command))` | Stop selecting further commands after a simulated transition throws; broken(commands) then reports the actual failing invariant. Removing this stop changes the counterexample. |
| `support/draftWorld.ts` | absence | 1598 | `O.isNone(broken(commands))` | A successful oracle replay returns normally; only a broken replay is minimized and reported. Required failure/success control flow, not a skipped expectation. |
| `support/draftWorld.ts` | fallback | 1604 | `O.getOrElse` | The synchronous counterexample reporter prints an empty reason only if the already-failing minimized replay unexpectedly yields None. Making this an Effect.die requires a coordinated Effect helper/caller conversion; no sync runner escape is added. |

The fold oracle fallback mapping is: applyPatch/now use undecided; textOf uses NO_DECISION; behind-answer counts, stale saw/sawUndone and touch ticks use zero; absent last undo uses {change: 0, by: ""}; a sealed next level uses noLevel; an absent person uses nobody; redo without a new step uses the existing mirror; absent prior touches use an empty record. No new module-level schema default was introduced, so SPEC Defaults nobody decided does not grow.


### Catalog web test files changed

Only this verdict appendix and the following 31 test/support files changed. Source and PLAN remain untouched.

- `packages/catalog/web/test/ChunkCrossing.test.ts`
- `packages/catalog/web/test/Draft.machine.test.ts`
- `packages/catalog/web/test/DraftLines.test.ts`
- `packages/catalog/web/test/DraftPicks.test.ts`
- `packages/catalog/web/test/DraftRegion.test.ts`
- `packages/catalog/web/test/ImportPage.test.ts`
- `packages/catalog/web/test/ItemImport.test.ts`
- `packages/catalog/web/test/KeptRows.test.ts`
- `packages/catalog/web/test/RefusedStorage.test.ts`
- `packages/catalog/web/test/RemoveImport.test.ts`
- `packages/catalog/web/test/ReviewDraft.test.ts`
- `packages/catalog/web/test/ReviewHistory.test.ts`
- `packages/catalog/web/test/ReviewModelFold.fold.test.ts`
- `packages/catalog/web/test/ReviewRules.test.ts`
- `packages/catalog/web/test/SessionAsked.test.ts`
- `packages/catalog/web/test/SessionStandIn.test.ts`
- `packages/catalog/web/test/TabRows.test.ts`
- `packages/catalog/web/test/TakenBackWords.test.ts`
- `packages/catalog/web/test/UploadMachine.test.ts`
- `packages/catalog/web/test/UploadOwner.test.ts`
- `packages/catalog/web/test/readInPieces.test.ts`
- `packages/catalog/web/test/readSpreadsheet.test.ts`
- `packages/catalog/web/test/readerWarnings.test.ts`
- `packages/catalog/web/test/reviewHonesty.test.ts`
- `packages/catalog/web/test/reviewParity.test.ts`
- `packages/catalog/web/test/support/cost.ts`
- `packages/catalog/web/test/support/draftWorld.ts`
- `packages/catalog/web/test/support/session.ts`
- `packages/catalog/web/test/tableView.test.ts`
- `packages/catalog/web/test/xlsxCorpus.ts`
- `packages/catalog/web/test/xlsxParity.test.ts`

### Catalog web test validation and proof limits

Final `bun run check --env-mode=loose` passed **105/105 tasks**, **80 cached**, in **2m30.574s**
(`/tmp/catalog-tests-final-full-check.log`). The catalog web task reran against the final code: **401 tests in
38 files passed**, **147.52s**, with **no test needing a second try**. The initial scoped run also passed 401/401
in 169.83s; the earlier full pass was 105/105 in 2m32.669s before the final Restart-invariant match follow-up.
The final full pass covers that follow-up and the dynamic S.Trim comparison.

The separate fold project passed **17/17 tests**, **193.41s**, with no retries; that pass covered the final fold
file. Its checked source did not change afterward. The package type/strict check passed at the unchanged
225/225 ceiling. Scoped defaults passed over all 46 test/support files with **50 fallback, 43 absence, zero unwrap,
zero normalise** (`/tmp/catalog-tests-final-defaults.log`). Formatting and the final full-check import, assertion,
diagnostics, readonly and other law gates passed. No ceiling was raised.

The first bare full-check attempt stopped at the lockfile check because Bun's temporary directory was read-only.
The passing runs used temporary Bun cache/temp, XDG cache, Turbo cache and Wrangler registry paths under
`/tmp/catalog-tests-*`. These environment paths did not change repository configuration. The docs check passed
for all 43 docs, 102 exploration and 26 goal Markdown files; existing nonstandard-status warnings remain.
`git diff --check` passes after this evidence appendix.

The baseline and Verify lock are byte-identical to HEAD, and neither has a git diff. Current hashes:

- `defaults-baseline.json`: `33aaf053efa2aa82934c8bcb87bd12489cbd710a199737b25a08529c6db4c288`
- `packages/catalog/model/test/Catalog.lock.json`: `4b118da8a3dd67a567a1d25d3dbfe9fcfa8fdcebfe3796adadc3fea1bd8bcd66`

This is partial clearance: **158 sites removed and 93 retained**. Row 11 is not claimed complete or at zero.
No source file, PLAN, SPEC, exemption, vendored file, lockfile, `.dev.vars` or Verify lock changed. No new
module-level schema default was added. No commit or push was made. Not run: `check:full`, slow database tests,
a real browser import or the 155-item on-screen sample acceptance. **Not seen on screen.**

Needs the person: nothing
