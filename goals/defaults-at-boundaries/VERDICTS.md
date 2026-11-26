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
