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

## Foundation modeling second lane, row 8, 2026-11-26

Scope: CSV facade/options, XLSX facade/address/workbook and the oracle/hand-built fixture support; 32 counted
sites before edits (9 fallback, 10 absence, 13 normalise). Internal reader/writer files remain untouched.

| Owner / field | Verdict | Boundary and reason |
| --- | --- | --- |
| CSV records codec options | Required argument | Callers explicitly select the existing options schema default. The text-codec callback's optional argument belongs to its external helper contract. |
| XLSX address/range regex groups | Option at regex boundary | An unmatched expression means no parsed value. Required capture groups do not invent empty text; optional second corner uses the parsed first corner. CSV separator handling remains unchanged for the ledger reason below. |
| CSV UTF-8 trailing bytes | Required within bounded iteration | The loop reads actual bytes; no zero byte is fabricated beyond the input. |
| CSV header rows | Existing compatibility fallback | Missing keys encode as empty strings, empty records as one empty cell. Keep these until the real header-row representation can express absence without changing bytes. |
| XLSX workbook sheets | Nonempty invariant | Opening a workbook guarantees a first sheet; absence dies as an invariant failure, not a substitute sheet. |
| XLSX layout lists and counts | Option layout; required counts | Fold lists to empty arrays; counts remain the same zero compatibility fallback until a coherent missing-layout boundary is modeled. |
| XLSX address text | Reviewed reference parser | Existing case conversion remains parser behavior, not normalization of a person's inventory cell. |
| XLSX fixture recipe | Required starting arguments; Option optional own keys at entry | A named recipe start supplies namespace, workbook properties, ordering and extra parts explicitly at callers. Optional strings, styles and sheet state decode once to Option before XML construction. |
| XLSX fixture sheet wrapper | Required fields | Callers spread the named sheet start before overrides. Preserve exact XML and archive part ordering. |
| SheetJS oracle workbook metadata | Guaranteed in generated workbook | Assert metadata, sheet list and Hidden values with test narrowing helpers before comparing. No zero/empty fallback weakens the oracle. |

No baseline, exemptions, Verify lock or PLAN change. Remaining counts and validation are appended after implementation.

### Second-lane residual inventory and byte proof

Scoped defaults after edits: **17 counted sites** (3 fallback, 1 absence, 0 unwrap, 13 normalise), down from 32.
The fixture support, oracle, and the two forced fixture callers hold zero counted sites. These retained sites are
not approved exemptions; row 8 is still incomplete. Paths below are relative to `packages/foundation/modeling/`.

| File | Kind | Count | Lines | Example | Reason retained |
| --- | --- | --- | --- | --- | --- |
| `csv/src/Csv.codec.ts` | fallback | 2 | 82, 661 | `match[1] ?? ","`, `row[name] ?? ""` | The separator capture is guaranteed by its regex, but removing the fallback and cast forces a change to the exact assertion-count ledger outside this lane. The header adapter still represents missing own fields as empty CSV cells; it needs a coherent header-row boundary rather than a fallback-only schema. |
| `csv/src/Csv.codec.ts` | normalise | 1 | 107 | `options.trim` | A property read carrying the chosen parser mode, not a trim call. The syntax law counts it; this lane does not change the reader configuration. |
| `csv/src/CsvOptions.schema.ts` | normalise | 2 | 264, 265 | `Str.trim(cell)` | Chosen CSV trim behavior lives beside the mode's schema; moving it into a decode would alter when reviewed cell text changes. No new exemption is granted. |
| `xlsx/src/Xlsx.codec.ts` | fallback | 1 | 314 | `Effect.runSync` in `parseResult` | Existing synchronous facade API. Replacing it with an Effect changes the public return contract; introducing another runner or throwing decoder would disguise the same issue. |
| `xlsx/src/Xlsx.codec.ts` | absence | 1 | 213 | `header === undefined` | The records adapter accepts an empty worksheet and returns no records; it still needs a coherent empty/nonempty worksheet case. |
| `xlsx/src/Xlsx.codec.ts` | normalise | 6 | 130, 131, 364, 364, 393, 393 | `Str.toLowerCase(sheet.name)` | Case-insensitive sheet lookup compares names while preserving their exact written spelling. A schema that normalizes the stored name would change output bytes. |
| `xlsx/src/XlsxAddress.schema.ts` | normalise | 1 | 103 | `Str.toUpperCase(letters)` | Reference parsing accepts lowercase column letters. Kept in the existing parser; no new exemption. |
| `xlsx/src/XlsxWorkbook.schema.ts` | normalise | 3 | 322, 393, 393 | `Str.toLowerCase(sheet.info.name)` | Schema uniqueness guard and lookup compare sheet names without changing the names written back. |

Three further **uncounted compatibility defaults** remain in `Xlsx.outline`: missing `SheetLayout` gives `rows`,
`rowsWithValues` and `cellsWithValues` the value 0. No constructor defaults were added to the required count fields.
The facade's whole list folds use `A.empty`; no fallback-only schema, hidden literal thunk, throwing decoder or new
runtime runner was introduced. The optional callback of `makeTextDecodeTo` still belongs to that existing helper's
contract; it selects a complete records codec with the existing options-schema default.

Fixture builders now require their starting arguments explicitly (`recipeStart`, `sheetStart`); their own optional
XML parts and state decode once with `OptionFromOptionalKey`. `partsOf` now returns an Effect and the two direct
callers yield it. The recipe schema has an arbitrary-valid property. Optional XML is emitted through complete tag
or relationships cases, and absent archive parts remain actual empty part lists.

A temporary comparison against the committed fixture support checked **48 combinations**: visible/hidden/veryHidden,
shared text present/absent, styles present/absent, strings before/after sheets, and transitional/strict namespaces.
Every combination had identical XML strings, archive part order and complete ZIP bytes. Reproducer and output:
`/tmp/defaults-modeling-byte-proof/compare.ts`, `before.ts`, `result.log` in that directory. This bounded proof does
not claim every possible workbook. Existing two-way SheetJS oracle properties and reader/writer properties cover
generated workbook values. A direct single-cell range check returned `Some("B2:B2")` for `B2`.

No new undecided fallback moved onto a schema, so SPEC's defaults table is unchanged. The existing CSV compatibility
fallback and three missing-layout count defaults remain above for a future boundary/API lane. No stored or reviewed
cell data changed. Not seen on screen; no browser, commit, push or deployment in this lane.

Final validation: `bun run check --env-mode=loose` passed **105/105 tasks**, none cached, in **2m48.671s**;
log `/tmp/defaults-modeling-second-final-check.log`. The final run used `BUN_TMPDIR`, `BUN_INSTALL_CACHE_DIR`,
`XDG_CACHE_HOME` and `XDG_CONFIG_HOME` directed into `/tmp` so Bun and Wrangler could write their temporary/cache
state inside this session's allowed roots. It includes CSV 31 tests, XLSX 93 tests (including the new recipe property),
Verify five proofs, catalog model 274 tests and catalog web 401 tests with no retry. Both package type checks also
passed separately. The scoped defaults law, docs check and `git diff --check` pass. The requested formatter was run
on every changed source/test file; Markdown is excluded by the formatter and was validated by docs:check.
Baseline, Verify lock, PLAN, exemptions, vendored code and internal reader/writer files have no diff. The sample's
155-item Confirm path was not exercised in a browser in this lane; the previous packet's acceptance is not new
end-to-end proof for these edits. No `UPDATE_VERIFY_LOCK` was used.

## App tests lane, row 13, 2026-11-26

Scope: `apps/inventory/test`, plus this verdict section. The starting dirty-tree changes are preserved.
The original scoped inventory selected 49 files and held 95 sites: 37 fallback, 36 absence, 19 unwrap,
and three normalise. The corrected inventory holds **four sites: one fallback, zero absence, zero unwrap,
and three normalise**. These retained sites are named below; no exemption or baseline changed.

| Fields / owner | Verdict | Reason and boundary |
| --- | --- | --- |
| Assistant Results; import/take-back results; stored rows, columns and indices | Required expected variants in tests | Assert `Result.isSuccess`, `Result.isFailure`, or `O.isSome` on the tagged value with `assertTrue`, then read its own `success`, `failure`, or `value`. Existing payload expectations remain unconditional. No optional-value extraction precedes the assertion. |
| Startup Exit failures | Required Failure variant | Assert `Exit.isFailure` on the Exit, then read its `cause`; keep the message expectations. |
| People email and document property values | Explicit Option data | People comparisons retain Some/None. The property combines both writable Options and asserts its full proposition in both branches. |
| TestAuth, signInApp, model and suggestion fixtures | Required fixture inputs | Callers state settings, production/rate limits and model replies. Existing named starting fixtures are preserved. |
| settingsLayer and inMemoryApp | Required configuration | Settings, docs and HTTP layers are required and supplied at every caller, including the security and telemetry suites. No helper picks an omitted configuration. |
| send and browser.send | Required method and headers; Option body and actor | Callers state the method, request body presence and actor presence. Some(null) encodes JSON null; None omits the RequestInit body property. Body presence sets content-type. Header construction preserves browser Origin, cookie and empty-header behavior. |
| MatchAtomic batch hooks and Rematch before hook | Required Option capabilities | Each hook-builder caller supplies Some(effect/function) or None, including empty entries and retry-generating callbacks. None runs no hook; Some runs the original effect in the original order. |
| People signedUp membership | Required Option input | Callers explicitly choose whether the signed-up account is linked to an existing member. None skips only that update. |
| Cost digits | Required cost | Callers supply a UnitCost. ImportsTwin asserts the second vendor exists before reading its cost. |
| Staged row fixtures | Required columns | Line records have every heading. Their named starting item explicitly supplies blank cells; tableOf reads the required field without filling it. Fixed headings and letters remain paired. |
| Upload key/chunks and generated SKU prefixes | Explicit Option key; required chunk/prefix | A new upload explicitly requests a fresh key with None. Retry keys use Some. Required chunk/prefix positions assert Some; no empty chunk or ZZZ stand-in is supplied. |
| Page response status and browser fixture starts | Required fixture inputs | Every response caller supplies its status. Each page still gets fresh storage through pageStart; at/kept/tab and signed-in identity/organization stay explicit. |
| Cookie capture | Response-header Option | Keep the actual header Option until assertions. An absent response cookie leaves the previously captured cookie in place. |

### App test residual inventory

Every retained law occurrence is listed here, relative to `apps/inventory/test/`.

| File | Line | Kind | Expression | Reason retained |
| --- | --- | --- | --- | --- |
| `web/support/page.ts` | 22 | fallback | `of[key] ?? null` | Implements the third-party browser Storage.getItem contract: a missing key returns null. Storage.key also returns null for an absent index. |
| `server/ImportsTwin.test.ts` | 107 | normalise | `Str.toLowerCase(item.name)` | Compares stored display names against the search predicate for oak, preserving the search-behavior assertion. It does not change the stored item. |
| `server/MatchAtomic.slow.test.ts` | 192 | normalise | `Str.toLowerCase(column.label)` | Finds the staged column by its displayed reorder heading, preserving the alternate-column scenario. It does not change the column. |
| `server/StaleAccepts.slow.test.ts` | 34 | normalise | `Str.toLowerCase(column.label)` | The same displayed-heading lookup for the stale-accepts scenario. It does not change the staged data. |

RequestInit is an external platform shape: optional body is omitted through the Option branch at construction.
The SQL row types in People and WaitedRows still model database NULLs. Browser fakes retain the DOM's null results,
React element inspections retain React-owned optional props, and the HTTP fixtures preserve their existing untyped
empty-response representation. None is a defaulted helper argument. Optional chaining already present in unrelated
expectations and page-response scheduling was not expanded into a new fixture policy.

### App test changes and proof

All renamed unwraps were replaced by assertions on their actual Option, Result or Exit. The grep
`rg -n 'valueOrUndefined|O\.(getOrUndefined|getOrNull|getOrThrow)' apps/inventory/test` returns no matches.
The explicit-file scoped law passes for all 49 tracked test files with the four occurrences above.
No baseline, Verify lock, PLAN, SPEC, vendored code, exemption or application source was changed. No .dev.vars
was read. No commit or push was made. Effect assertion signatures and the pilot tests were read locally.

Validation: the app typecheck passes. The formatter passes on all changed test files. Full
`bun run check --env-mode=loose` passes 105/105 tasks, 82 cached, in 10.99s; the app fast suite passes
70 tests in 19 files with no retry. Log: `/tmp/app-correction-check.log`.
`bun run --cwd apps/inventory test:slow` passes 133 tests in 24 files in 67.03s, with no retry.
Log: `/tmp/app-correction-slow.log`. Final documentation and scope checks also pass.

The initial plain check hit Bun's read-only temporary directory; the initial slow attempt hit Wrangler's
read-only default registry. Reruns use BUN_TMPDIR, BUN_INSTALL_CACHE_DIR, XDG_CACHE_HOME,
WRANGLER_REGISTRY_PATH and TURBO_CACHE_DIR under /tmp as needed. Loose environment mode passes those
locations through Turbo. No repository configuration was changed for the sandbox.
No browser, hosted deployment or check:full was run; not seen on screen.

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


## Catalog web source sweep, PLAN row 11 (2026-11-26)

Written before this sweep's code changes. Scope is all of `packages/catalog/web/src`, including the earlier
internal lane's unfinished work. Effect-first-development, schema-first-development, crispen and the repository's
OKF documentation rules apply. This section records the working verdicts and will receive the final inventory.

| Owner / boundary | Fields | Verdict and preservation requirement |
| --- | --- | --- |
| Draft machine events | TakenUp.here; ViewArrived.waiting, matches, takenBack; holdingBack.accepts | Required values supplied explicitly by every caller; no optional owned helper inputs. |
| Draft stale accepts | kind, rowId, field | Required kind, rowId and field; legacy missing kind means accept at the actual stored boundary. |
| Draft and review atoms | member, owner, lookup results, decisions, held state | Options remain Options through derived atoms; absent collections fold to empty lists; own helper arguments required. |
| Upload controller and machine | chosen sheet, completion and progress callbacks, owner/upload, reader head | Required inputs and Option absence; wire remains schema encoded before clone/postMessage, decoded at receipt. |
| Spreadsheet readers | sheet, progress callback, piece size, listed limit | Required arguments explicitly supplied by callers. Native file bytes, library lookup/captures remain named boundary cases. |
| StoredWaiting | waits, lines, confirms, beside, theirs, seen, held, fileName, older forms | Decode optional keys as Options while preserving omitted versus explicit-null keys and exact writer form. |
| Conversation and notices | optional legacy attribution, patch fields, names, named/theirs | Decode at module-level storage schemas; keep legacy generations readable and writer omission behavior identical. |
| Table Patch and view | independent changed fields, column lookup, visibility | Optional patch fields become Options with constructor None; encoded omission unchanged. Third-party dictionaries stay named edges. |
| Screens | owned props, optional values and final labels | Required own data or Option; component optional props keep ?: with destructuring defaults. Final screen draw uses O.match. |
| Reviewed file cells and forms | dimensions, vendor text, numbers, labels | Preserve permissive reading and shown proposals; clean-ups remain reviewed-cell boundaries, capture absence becomes Option. |
| DOM and third-party APIs | storage/URL/file/ref nullable values; installed table/component optional props | Named real edges retained, with file, kind, count and an example in the final inventory. |

No product outcome, stored progress or draft representation, baseline, exemption, Verify lock, vendored code,
PLAN or .dev.vars will be changed. Existing undecided values move unchanged only onto their owning schema and
are listed in SPEC when moved. No browser proof is claimed by this source lane.

### Final field verdicts and compatibility

The owned editor state now lives in `ItemEditor.state.ts`: Closed has no form; Open requires base, complete form,
problems and Option notice. Form defaults belong to the form maker. Functional atom updates preserve edits queued
between draws. Items retains its stable table hook and common header/actions while data is loading or failed.
`result.ts` exposes Option data and errors; error consumers match the Option before passing its actual payload to
error wording. Draft event/helper inputs are required, and Side, Named and HeldBack own their initial fields.

StoredWaiting, conversation entries and Patch decode optional/null keys at their real module-level boundaries.
Their encoded omissions and explicit nulls remain distinct. The shared empty conversation retains its identity.
LegacySide and LegacyRules own unchanged legacy defaults. Reader requests, heads, chunks and progress cross the
worker boundary in schema encoded form, with decoding at receipt; no decoded Option object is posted as wire data.
The terminal RegionProblem/Fix display adapter compacts Option properties with R.getSomes into one constructor
call, preserving property omission without copying a whole record for every optional field. These are the owned
review library's published optional display properties, not third-party data or newly invented defaults.
Reviewed permissive cell parsing retains malformed/truncated recovery. Its form makers produce complete drafts, with one fresh mutable draft per parsed vendor.

No source `getOrThrow`, `runSync`, synchronous decoder/encoder, `S.declare` function schema, local schema,
Option-to-undefined codec, `A.join(O.toArray(...))`, or new React state/memo/effect hook was introduced. No
performance improvement is claimed: collection folds avoid added copies per row, but no benchmark was run.
The original law's 324 measured source places fell to 32; its syntax counts do not prove every pre-existing
uncounted Option branch is semantically settled. In particular, older machine branches outside the measured
syntax still merit the goal's later semantic review.

### Exact remaining source inventory

`bun run beep laws defaults <all 43 source files>` passes: **1 fallback, 15 absence, 1 unwrap, 15 normalise**.
The explicit file list includes the new untracked state module. Receipt: `/tmp/catalog-source-scoped-defaults.log`;
complete line/code inventory: `/tmp/catalog-source-residual.json` and `/tmp/catalog-source-residual.txt`.
These are retained candidates, not added or approved exemptions. The owned hook gap is unfinished work.

| Source file | Kind / count | Exact lines and example | Ownership / disposition |
| --- | --- | --- | --- |
| `Conversation.machine.ts` | absence 1 | 119; `text === null` | Browser localStorage nullable read. |
| `Draft.atoms.ts` | absence 4 | 250, 269, 281, 562; `lock === null` | Native Web Locks nullable results and optional browser API/global availability. |
| `ImportPage.screen.tsx` | absence 1 | 235; `barSlot !== null` | DOM ref slot presence before drawing its portal. |
| `ItemEditor.screen.tsx` | absence 1 | 214; `querySelector(...) !== null` | DOM querySelector nullable result when checking the mounted editor. |
| `ItemsPage.screen.tsx` | fallback 1 | 714; `O.getOrElse` | Vendored useDataTable requires numeric pageCount before the first read; retains existing 0 at that API edge. |
| `Notices.atoms.ts` | absence 1 | 86; `key === null` | Browser storage event nullable key. |
| `ReviewStep.screen.tsx` | absence 1 | 419; `line === null` | DOM row lookup before navigation/focus. |
| `UploadStep.screen.tsx` | absence 3, unwrap 1 | 116, 154, 156, 324; `input === null` | Three DOM input/closest/dataset checks. One unresolved OWN SavedProgressHook.useSavedProgress(scope-or-undefined) signature: React hook must be called unconditionally; producer must accept Option in its future package lane. This unwrap is not a third-party exemption. |
| `internal/CellForms.tsx` | normalise 5 | 127, 128, 128, 129, 130; `vendor.name.trim` | Five reviewed repair-form vendor text clean-ups; candidate cell clean-ups only. |
| `internal/WhyFlagged.tsx` | normalise 2 | 76, 77; `row.file.name.trim` | Two reviewed raw name/SKU display clean-ups; candidate cell clean-ups only. |
| `internal/cellDrafts.ts` | normalise 1 | 20; `text.trim` | Reviewed numeric/text cell repair trim; candidate cell clean-up only. |
| `internal/format.tsx` | normalise 1 | 8; `props.value.trim` | Reviewed cell ValuePill whitespace display; candidate cell clean-up only. |
| `internal/itemText.ts` | normalise 6 | 30, 61, 62, 75, 167, 188; `text.trim` | Six reviewed numeric/vendor/tag cell display clean-ups; candidate cell clean-ups only. |
| `internal/notices.ts` | absence 1 | 54; `text === null` | Browser localStorage nullable read. |
| `internal/route.ts` | absence 1 | 13; `text === null` | URLSearchParams nullable get. |
| `internal/storedWaiting.ts` | absence 1 | 270; `text === null` | Browser localStorage nullable read. |

All 43 source files were visited; the other 27 have zero measured places. No source normalization outside the
15 reviewed-cell candidate sites remains. Existing SPEC decisions distinguish cell clean-ups from fallback and
absence work: none of these candidates licenses an exemption edit in this lane.

### Forced callers and validation

The following existing tests/support files changed only for the required signatures, encoded wire fixtures, or
Closed/Open editor representation. The editor fixture now supplies the complete form formerly hidden by a cast.
No new permanent tests were added; test assertion logic was retained.

- `apps/inventory/test/server/support/files.ts`
- `apps/inventory/src/web/Workspace.tsx` (forced route Option caller; final JSX match keeps existing Crumbs props)
- `apps/inventory/test/web/session.test.ts` (forced Option atom value)
- `packages/catalog/web/test/TableAssistant.test.ts` (forced Option visibility expectations)
- `packages/catalog/web/test/Conversation.test.ts`
- `packages/catalog/web/test/Draft.machine.test.ts`
- `packages/catalog/web/test/DraftLines.test.ts`
- `packages/catalog/web/test/DraftPicks.test.ts`
- `packages/catalog/web/test/DraftServer.test.ts`
- `packages/catalog/web/test/ItemEditor.test.ts`
- `packages/catalog/web/test/ReviewModelFold.fold.test.ts`
- `packages/catalog/web/test/SessionAsked.test.ts`
- `packages/catalog/web/test/UploadMachine.test.ts`
- `packages/catalog/web/test/UploadOwner.test.ts`
- `packages/catalog/web/test/csvDifferential.test.ts`
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

## App source lane, row 13, 2026-11-26

Scope: `apps/inventory/src` only, with this verdict section. Settings continue to enter through Config; public
Vite flags keep their existing browser boundary. No stored shape, screen sentence, baseline or exemption changes.

| Fields / owner | Verdict | Boundary and reason |
| --- | --- | --- |
| Generated OpenAPI document | Third-party document edge | Effect's generated paths, methods, parameters, response and reference properties really may be absent. Preserve in-place transforms and document contents; inventory retained syntax explicitly. |
| Same-origin log annotations | Unresolved compatibility values | Keep the existing empty log fields: omitting keys would change emitted telemetry. No fallback-only codec is introduced to conceal them. |
| Settings API key | Schema-owned blank test | Config still reads a Redacted key; blank detection belongs to the setting's schema, without trimming the secret used in requests. |
| Telemetry route path | Nonempty split invariant | Splitting text always produces at least one segment; use the nonempty return type instead of fabricating empty text. Header absence remains an HTTP edge. |
| Security script capture | Required capture invariant | Every matched inline script has capture 1, including empty scripts. A missing capture is a defect, never an empty script. |
| Development gallery modules | Option capability | Production has None, development Some lazy component. Match only into the screen. |
| Breadcrumb import and filename | Option through rendering | Retain the route's Option and the async read's Option until the breadcrumb draws. DOM query nulls remain actual browser edges. |
| Shell optional React props | Component edge | Optional props remain optional, with destructuring defaults where needed. An omitted sidebar still chooses the plain frame. |
| Activity reads and view | Option through rendering | Retain AsyncResult values and failure causes as Options. Choose the same initial list by whole predicates; draw counts and skeletons at the last step. |
| Request member and sent header | Option capability | No registry or no member header means the request/answer passes through. No empty string is invented to represent either absence. |
| Browser public settings startup | Existing synchronous runtime boundary | Preserve startup timing and invalid-flag warning/default behavior; no alternate synchronous runner or throwing decoder. Name any retained place honestly. |
| Gallery rows and callbacks | Existing review-region contract | Tighten fixture tuples that always have all fields. Review callbacks still follow the other lane's contract; unresolved data fallbacks stay visible and are inventoried, not hidden by codecs. |

Final occurrence counts, exact residuals and validation follow below after implementation.

### App source residual inventory

The scoped source law now holds **19 places: 8 fallback, 9 absence, 0 unwrap, 2 normalise**, down from
51 places in 15 files (26 fallback, 20 absence, 2 unwrap, 3 normalise). This clears 32 counted places.
No baseline rewrite was run.
This lane is **not complete**: eight places are API-edge candidates and eleven are unresolved source work,
not approved exemptions. Every retained occurrence is listed below; paths are relative to `apps/inventory/src/`.

| File | Kind | Count | Lines | Example | Why retained |
| --- | --- | --- | --- | --- | --- |
| `api/v1/Document.ts` | absence | 3 | 41, 144, 160 | `operation["requestBody"] === undefined` | Effect's generated OpenAPI document may omit a method, request body or 401 response. Third-party API-edge candidates. |
| `web/Workspace.tsx` | absence, fallback | 2 | 60 | `params.get("step") ?? "review"` | DOM URLSearchParams.get returns null. The existing skeleton chooses upload when no import is named and review when its step is absent. Browser-edge candidates. |
| `web/preload.ts` | absence | 2 | 34, 37 | `opened !== null` | DOM URLSearchParams.get returns null; preload fetches import data only for a present id within the existing bound. Browser-edge candidates. |
| `web/components/app/AppShell.tsx` | absence | 1 | 44 | `props.sidebar !== undefined` | React's optional sidebar prop chooses the plain or signed-in frame. Optional-component-prop edge candidate. |
| `server/SameOrigin.ts` | fallback | 2 | 37, 38 | `O.getOrElse(source.origin, () => "")` | Existing emitted log attributes contain empty strings for absent headers. Omitting attributes changes telemetry; a fallback-only schema would conceal the issue. Unresolved, not an exemption candidate. |
| `web/lib/settings.ts` | fallback | 1 | 21 | `Effect.runSync(PublicSettings.parse(...))` | Existing synchronous module startup provides public flags before the runtime imports them, with its original invalid-flag warning/default behavior. No renamed runner or throwing decoder was substituted. Unresolved startup/API work, not an approved edge. |
| `web/pages/ReviewGallery.tsx` | fallback | 1 | 52 | `O.getOrElse` in `readState` | The absent or unknown query state selects `default`; it still needs a coherent state-entry boundary. Unresolved; no fallback-only decoder. |
| `web/pages/ReviewGallery.tsx` | fallback | 3 | 201 | `asked.cells.onHand ?? asked.row.cells.onHand ?? ""` | The recheck's partial edited cells choose edited, original, then empty text; month chooses empty text. Requires an honest input shape coordinated with the review API lane. Unresolved, not a platform edge. |
| `web/pages/ReviewGallery.tsx` | absence | 1 | 153 | `problem === undefined` | The existing own recheck contract returns Problem or undefined; row construction follows that contract. Unresolved pending that contract's Option form. |
| `web/pages/ReviewGallery.tsx` | normalise | 1 | 139 | `Str.trim(onHand)` | The gallery's cell-reading rule recognizes a negative typed count, retaining the original text in its sentence. No normalization of reviewed cells was introduced. Unresolved; no exemption requested here. |
| `web/components/app/AppSidebar.tsx` | normalise | 1 | 75 | `Str.toUpperCase` | Avatar initials are formatted for display. No runtime decoder was inserted into this pure formatter to hide the operation. Unresolved display-formatting placement, not a platform edge. |
| `web/pages/gallery/JobsReview.tsx` | absence | 1 | 61 | `code === undefined` | The own review row-action callback currently returns undefined when no job cell exists. Requires the review API's Option callback contract; no Option-to-undefined codec was added. Unresolved. |

The two gallery strings moved only at their last display step: complete row-action labels and the complete jobs
caption are matched, with the exact same words in each case. Supplier examples now have required three-element
tuples, removing three uncounted destructuring defaults. The breadcrumb still shows a filename only for a successful
read (not an older success attached to a failed read). Activity retains the prior rule for selecting Events, the
same counts, skeletons and error sentence, and the null-cause behavior of its previous shape adapter.

No stored or wire schema was changed, no worker/postMessage crossing was touched, and no stored data or exported
file is rewritten by these edits. No test, caller outside this lane, PLAN, SPEC, baseline, exemption, Verify lock or
vendored source was edited. No new undecided data fallback was moved onto a schema; the unresolved values above
remain visible in their original places. No .dev.vars was read. No commit or push was made.

Focused compatibility receipts (synthetic local proof, not browser acceptance):

- `.scratch/defaults-app-source/settings-proof.ts` compares HEAD's Settings to this lane across 35 synthetic keys,
  including all ECMAScript trim whitespace code points. Presence and every accepted key's exact bytes agree;
  the same model/fallback-model Config reads are compared. Output: `/tmp/defaults-app-source/settings-proof.log`.
- `.scratch/defaults-app-source/document-proof.ts` compares HEAD's document transform across 22 cases, including
  absent, undefined and null paths, responses and parameters, component naming/folding and security declarations.
  Output: `/tmp/defaults-app-source/document-proof.log`.
- Effect 4.1.5 source was checked for Array's nonempty head/get/getSomes, String.split's nonempty return,
  Option conversion/match/map/filter/flatMap/exists, Record.get, Schema.is/isPattern and the used Effect calls.
  The first typecheck rejected Effect 3's Option-returning Array.filterMap assumption; the final code uses
  Array.map plus Array.getSomes, matching the installed Effect 4 API.

The scoped defaults law passes for all 38 owned source files; `/tmp/defaults-app-source/defaults.log`.
The formatter ran on all eleven changed source files (Markdown is excluded by the formatter).
Full validation results follow below. No browser was opened: **not seen on screen**. Fresh import/Confirm storing
155 rows and stored/result/Items agreement, hosted behavior, check:full and performance benchmarks were not run.

### App source validation

- `bun run check --env-mode=loose`: **105/105 tasks passed**, 83 cached, 12.066s on the final source/test pass.
  `/tmp/defaults-app-source/check-final.log`. App fast tests: **70 in 19 files**, no retry. The earlier full uncached
  run also passed 105/105 in 2m51.739s, including catalog web's 401 tests and the five Verify proofs.
- `bun run --cwd apps/inventory test:slow`: **133 tests in 24 files passed**, 69.40s, no retry.
  `/tmp/defaults-app-source/slow.log`. This includes the 50,000-row match/confirm cases, but is not a dedicated
  performance comparison or on-screen import proof.
- All eleven changed source files were formatted; all 38 source files pass the scoped defaults law with
  **8 / 9 / 0 / 2** retained. `bun run docs:check` and `git diff --check` pass; docs keeps the existing status warnings.
- Sandbox cache/temp paths were passed under `/tmp/defaults-app-source/` using BUN_TMPDIR,
  BUN_INSTALL_CACHE_DIR, XDG_CACHE_HOME, XDG_CONFIG_HOME, WRANGLER_REGISTRY_PATH, TURBO_CACHE_DIR and
  MINIFLARE_CACHE_DIR. Loose environment mode passes these to Turbo; repository configuration was not changed.
- Frozen scope check: PLAN, baseline, Verify lock, review source, catalog web and app tests have no diff.

Needs the person: the eight listed API-edge candidates need an exemption decision; eleven unresolved source places
remain work. No screen words or stored-data decisions are requested. Not seen on screen; the orchestrator still
owns the real import acceptance.

## Review source lane, complete row 9 dependency scope, 2026-11-26

This pass owns all eighteen files under `packages/review/src`, starting from 474 counted places (166 fallback,
259 absence, 29 unwrap, 20 normalise). Earlier internal-only inventory above is historical. No baseline,
exemption, stored fixture or progress bytes are authorized to change.

| Owned input / state | Verdict before edits | Meaning retained |
| --- | --- | --- |
| Review column size and boolean display/filter flags; kind fixable; choice suggested; row stored | Required decoded values with schema constructor and decode defaults | Size starts fit; flags start false; kinds remain fixable unless explicitly false. Width and priority depend on other fields and require separate modeling. |
| Row applied fixes; why alternatives, labels and target columns | Required arrays with empty constructor/decode defaults | No applied fix or extra value starts empty; missing array entries still mean no indexed label/target. |
| Problem rivals and choices | Option, or retained unresolved until their consumers migrate | An absent list differs from a present empty list: empty rivals are already settled, empty choices still suppress typing. Never replace either with an empty-array default. |
| Row label, blocked override, problem; problem reason/tone/column/fix/ask/note; fix attribution/group/reason/label; column optional metadata | Option on decoded side, migration in dependency order | Preserve every distinct omitted/provided case, reference identity, and existing wording. No per-row constructor copy in view builders. |
| Review words and region optional React props | Optional component props with destructuring presentation defaults; required callable helper inputs | Existing words and component defaults stay at their entry; callers explicitly state required helper arguments. |
| Decisions, draft steps, stored review and progress | Decoded explicit values; legacy encoded flags/nulls/omitted keys preserved | Browser progress and undo/redo restore identically. Actual storage/IDB refusal and DOM nullability stay named edges. |
| Derived grid/queue/nav state | Required initial state or Option until complete-case consumption | No early unwrap followed by repeated existence questions; final screen branches consume whole cases. |
| Vendor optional property bags and nullable DOM methods | Actual edges retained by file/kind/example | Use Record.getSomes for optional outgoing library bags; no no-op capability defaults. |

No browser is authorized for this pass; all resulting screen behavior is **not seen on screen**. Final inventory,
forced callers and checks follow below when the edits are complete.

### Review edit form entry verdict

Before its final form edit: `EditText.text` is required raw browser input, and `EditText.submission` is an Option of
`SubmittedText` (trimmed, nonempty). Decode once when the form opens and on each input event; retain raw text in the
box, disable Save for None, and consume the complete Option on submit. This preserves the former trim-on-submit
policy without changing any reviewed file cell or stored decision. This is an actual form entry schema, not a
fallback-only decode. The two mark-space comparisons remain presentation comparisons and keep the original text.


### Final review-source residual inventory

The final source scan holds **153 sites: 69 fallback, 65 absence, two unwrap and 17 normalise**, down from 474.
That clears 321 counted sites. These 153 are retained places, **not approved exemptions**, and row 9 is not a
zero-baseline/schema-complete package. No baseline was written. All optional entry/decoded review schema fields
are now Options or explicit required values; remaining owned items below are mostly sparse lookups, accumulator
initialization, bounds/state relationships and presentation comparisons.

`Platform` means an actual browser or vendor API boundary. `Presentation` means a final React capability/node or
word/display choice, not an absent domain field. `Owned` is unresolved engineering work, not an exemption claim.
The two retained unwraps are only localStorage availability and Virtualizer.getScrollElement's null convention.
No synchronous escape was added. Internal state still uses some existing plain types; this pass does not claim
that every such type has been rebuilt as a schema.

| File under `packages/review/src/` | Fallback | Absence | Unwrap | Normalise | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| `ReviewRegion.atoms.ts` | 14 | 8 | 0 | 5 | 27 |
| `ReviewDraft.rules.ts` | 18 | 6 | 0 | 7 | 31 |
| `ReviewRegion.component.tsx` | 0 | 10 | 0 | 3 | 13 |
| `SavedProgress.hook.ts` | 0 | 1 | 0 | 0 | 1 |
| `internal/parts.tsx` | 2 | 8 | 0 | 1 | 11 |
| `internal/keptStore.ts` | 0 | 3 | 1 | 0 | 4 |
| `internal/WorkList.tsx` | 1 | 2 | 0 | 0 | 3 |
| `internal/ReviewQueue.tsx` | 7 | 5 | 0 | 0 | 12 |
| `internal/ReviewGrid.tsx` | 27 | 21 | 1 | 1 | 50 |
| `internal/PhoneDrawer.tsx` | 0 | 1 | 0 | 0 | 1 |
| **Total** | **69** | **65** | **2** | **17** | **153** |

Classification totals are 29 platform sites, 36 presentation sites and 88 unresolved owned sites.

Every retained occurrence is named below. Identical expressions in one file share a row; Count and Lines retain
every occurrence, including repeated line numbers. Line numbers refer to the final formatted source. The call is
shown in full for `getOrElse`/unwrap findings, where the scanner normally prints only the callee name.

#### `packages/review/src/ReviewRegion.atoms.ts`

| Kind | Count | Lines | Expression | Class | Reason retained |
| --- | ---: | --- | --- | --- | --- |
| fallback | 3 | 179, 265, 278 | `view.cells[column.id] ?? ""` | Owned | The generic review permits partial dynamic cell records. Empty text is still selected at a missing key; a total column/cell relationship is not modeled and no per-row fill/copy was added. |
| normalise | 1 | 263 | `value.trim().toLowerCase` | Owned | Facet comparison/spelling keys still trim or fold case from raw cell text. Raw values are preserved; the comparison-key boundary remains unmodeled. |
| normalise | 3 | 263, 274, 274 | `value.trim` | Owned | Facet comparison/spelling keys still trim or fold case from raw cell text. Raw values are preserved; the comparison-key boundary remains unmodeled. |
| fallback | 1 | 268 | `O.getOrElse(MutableHashMap.get(found, key), () => ({ values: MutableHashSet.empty<string>(), n: 0, spellings: {} as Record<string, number> }))` | Owned | The mutable facet accumulator still creates values/count/spellings on its first key. Its initial-record boundary remains unresolved. |
| fallback | 1 | 274 | `entry.spellings[value.trim()] ?? 0` | Owned | The mutable spelling counter still starts a missing spelling at zero; the accumulator initial state is not schema-backed. |
| fallback | 1 | 285 | `Object.entries(entry.spellings).sort((a, b) => b[1] - a[1])[0]?.[0] ?? key` | Owned | Choosing the most frequent facet spelling still falls back to its existing comparison key when the sorted spelling list is empty. |
| fallback | 1 | 291 | `facetPicked[column.id] ?? []` | Owned | The sparse selected-facet dictionary still interprets an unmentioned column as no selected values. |
| fallback | 1 | 356 | `O.getOrElse(get.self<HashSet.HashSet<string>>(), () => HashSet.empty<string>())` | Owned | AtomContext.get.self is absent on first read; the existing seen-kind set, table-order snapshot or move counter initial value is still selected here. |
| fallback | 1 | 410 | `view.cells[facet.column] ?? ""` | Owned | The generic review permits partial dynamic cell records. Empty text is still selected at a missing key; a total column/cell relationship is not modeled and no per-row fill/copy was added. |
| absence | 1 | 452 | `node === null` | Platform | Actual DOM element/query/dataset availability at the keyboard/focus/attachment boundary. Existing fallback focus order is preserved. |
| absence | 1 | 590 | `target.closest("[role=dialog], [role=alertdialog], [role=menu]") !== null` | Platform | Actual DOM element/query/dataset availability at the keyboard/focus/attachment boundary. Existing fallback focus order is preserved. |
| fallback | 1 | 616 | `table.getAllLeafColumns()[0]?.table ?? table` | Platform | TanStack may have no leaf column; use the provided table when its leaf-table pointer is absent. |
| fallback | 1 | 639 | `O.getOrElse(get.self<ReadonlyArray<RowView>>(), A.empty)` | Owned | AtomContext.get.self is absent on first read; the existing seen-kind set, table-order snapshot or move counter initial value is still selected here. |
| absence | 1 | 673 | `first !== undefined` | Owned | A folded section may have no first row under the current generic array contract; the stop is omitted. Nonempty section membership is not encoded. |
| fallback | 1 | 694 | `O.getOrElse(get.self<number>(), () => 0)` | Owned | AtomContext.get.self is absent on first read; the existing seen-kind set, table-order snapshot or move counter initial value is still selected here. |
| fallback | 1 | 705 | `root?.querySelector<HTMLElement>("[data-import-button]") ?? null` | Platform | Actual DOM element/query/dataset availability at the keyboard/focus/attachment boundary. Existing fallback focus order is preserved. |
| absence | 1 | 706 | `button !== null` | Platform | Actual DOM element/query/dataset availability at the keyboard/focus/attachment boundary. Existing fallback focus order is preserved. |
| fallback | 1 | 724 | `(group === undefined ? undefined : root?.querySelector<HTMLElement>(&#96;[data-group-id="${CSS.escape(group)}"] [data-group-accept]&#96;)) ?? row?.querySelector<HTMLElement>("[data-first-action]")` | Platform | Actual DOM element/query/dataset availability at the keyboard/focus/attachment boundary. Existing fallback focus order is preserved. |
| absence | 1 | 724 | `group === undefined` | Platform | Actual DOM element/query/dataset availability at the keyboard/focus/attachment boundary. Existing fallback focus order is preserved. |
| absence | 1 | 728 | `target === null` | Platform | Actual DOM element/query/dataset availability at the keyboard/focus/attachment boundary. Existing fallback focus order is preserved. |
| absence | 1 | 728 | `target === undefined` | Platform | Actual DOM element/query/dataset availability at the keyboard/focus/attachment boundary. Existing fallback focus order is preserved. |
| absence | 1 | 808 | `step !== undefined` | Owned | The bulk-action toast still checks the last undo entry before offering Undo. The outcome/history nonempty relationship is not encoded. |
| normalise | 1 | 954 | `event.key.toLowerCase` | Platform | Browser KeyboardEvent.key spelling for the existing case-insensitive undo/redo shortcuts. |

#### `packages/review/src/ReviewDraft.rules.ts`

| Kind | Count | Lines | Expression | Class | Reason retained |
| --- | ---: | --- | --- | --- | --- |
| fallback | 1 | 90 | `O.getOrElse(decision, () => undecided)` | Owned | A sparse decision-map lookup still selects the existing empty ReviewDecision before the requested update. No per-row decision initialization/copy was added; this map-entry initialization remains counted. |
| absence | 1 | 176 | `known !== undefined` | Platform | Native WeakMap.get can return undefined. Reuse the cached view only for the same fixable capability; row identity and cache behavior are preserved. |
| fallback | 2 | 231, 249 | `row.cells[fix.column] ?? ""` | Owned | A dynamic cell key may be absent in this generic review API. The existing empty-text value is retained; a total column/cell contract would require a coordinated representation change. |
| fallback | 1 | 270 | `row.cells[column] ?? ""` | Owned | A dynamic cell key may be absent in this generic review API. The existing empty-text value is retained; a total column/cell contract would require a coordinated representation change. |
| fallback | 1 | 292 | `cells[fix.column] ?? ""` | Owned | A dynamic cell key may be absent in this generic review API. The existing empty-text value is retained; a total column/cell contract would require a coordinated representation change. |
| fallback | 1 | 398 | `O.getOrElse(MutableHashMap.get(kinds, kind), () => 0)` | Owned | The sparse count/tally map still uses zero for an unmentioned key. Its total-count/read contract remains unresolved. |
| absence | 1 | 402 | `mark !== undefined` | Owned | Presence of an entry in the sparse marks record still decides which applied fix is counted or grouped. This lookup remains a nullable owned-map access. |
| fallback | 1 | 419 | `O.getOrElse(HashMap.get(counts.kinds, kind), () => 0)` | Owned | The sparse count/tally map still uses zero for an unmentioned key. Its total-count/read contract remains unresolved. |
| fallback | 1 | 457 | `O.getOrElse(MutableHashMap.get(tally, from), () => 0)` | Owned | The sparse count/tally map still uses zero for an unmentioned key. Its total-count/read contract remains unresolved. |
| fallback | 1 | 478 | `O.getOrElse(MutableHashMap.get(found, groupId), (): Gathered => ({ fix, rowIds: [], froms: [], mixed: false }))` | Owned | The mutable waiting/applied group accumulator still creates its first record for a key in the collector; initial group state is not schema-backed. |
| fallback | 1 | 484 | `view.row.cells[fix.column] ?? ""` | Owned | A dynamic cell key may be absent in this generic review API. The existing empty-text value is retained; a total column/cell contract would require a coordinated representation change. |
| absence | 1 | 509 | `mark === undefined` | Owned | Presence of an entry in the sparse marks record still decides which applied fix is counted or grouped. This lookup remains a nullable owned-map access. |
| fallback | 1 | 511 | `O.getOrElse(MutableHashMap.get(found, id), (): Gathered => ({ fix, rowIds: [], froms: [], mixed: false }))` | Owned | The mutable waiting/applied group accumulator still creates its first record for a key in the collector; initial group state is not schema-backed. |
| normalise | 1 | 545 | `from.trim` | Presentation | Compares before/after spaces or quotes the original spelling; does not change a reviewed cell. This display comparison remains counted. |
| absence | 1 | 642 | `step === undefined` | Owned | An empty undo/redo array is a legal state; the current last-entry bounds check returns the unchanged state. The stack lookup is not yet Option-valued. |
| fallback | 1 | 708 | `O.getOrElse(decisionOf(view.row.id), () => undecided)` | Owned | A sparse decision-map lookup still selects the existing empty ReviewDecision before the requested update. No per-row decision initialization/copy was added; this map-entry initialization remains counted. |
| fallback | 5 | 785, 817, 851, 864, 879 | `O.getOrElse(d.decisionOf(rowId), () => undecided)` | Owned | A sparse decision-map lookup still selects the existing empty ReviewDecision before the requested update. No per-row decision initialization/copy was added; this map-entry initialization remains counted. |
| absence | 1 | 921 | `unmatched !== undefined` | Owned | The first unmatched-column lookup still returns a nullable native Array.find result before building the complete primary-button case. |
| normalise | 1 | 952 | `words.ready.toLowerCase` | Presentation | Existing status, undo, column-label or sentence casing for words drawn on screen. No corresponding normalized presentation-word type was introduced. |
| fallback | 1 | 1032 | `view.row.cells[column.id] ?? ""` | Owned | A dynamic cell key may be absent in this generic review API. The existing empty-text value is retained; a total column/cell contract would require a coordinated representation change. |
| absence | 1 | 1210 | `view !== undefined` | Owned | Cyclic next-problem indexing still guards its array result. The nonempty/in-bounds relation is not carried by the array type. |
| normalise | 1 | 1262 | `text.trim` | Presentation | The unit/display-number check still trims for drawing a numeric value with its unit. Stored and edited cell text is unchanged. |
| normalise | 1 | 1263 | `shown.trim` | Presentation | The unit/display-number check still trims for drawing a numeric value with its unit. Stored and edited cell text is unchanged. |
| normalise | 1 | 1345 | `label.toUpperCase` | Presentation | Existing status, undo, column-label or sentence casing for words drawn on screen. No corresponding normalized presentation-word type was introduced. |
| normalise | 1 | 1345 | `label.toLowerCase` | Presentation | Existing status, undo, column-label or sentence casing for words drawn on screen. No corresponding normalized presentation-word type was introduced. |
| normalise | 1 | 1355 | `label.trim` | Presentation | Existing status, undo, column-label or sentence casing for words drawn on screen. No corresponding normalized presentation-word type was introduced. |

#### `packages/review/src/ReviewRegion.component.tsx`

| Kind | Count | Lines | Expression | Class | Reason retained |
| --- | ---: | --- | --- | --- | --- |
| absence | 1 | 83 | `typeof navigator !== "undefined"` | Platform | Actual navigator availability during module initialization; selects the existing keyboard labels. |
| absence | 1 | 374 | `select !== null` | Platform | Actual document.getElementById result before focus; absent matching control uses the caller matching capability. |
| normalise | 1 | 399 | `(filter === "auto" ? words.auto : words[filter]).toLowerCase` | Presentation | Existing status, undo, column-label or sentence casing for words drawn on screen. No corresponding normalized presentation-word type was introduced. |
| normalise | 2 | 462, 474 | `step.label.toLowerCase` | Presentation | Existing status, undo, column-label or sentence casing for words drawn on screen. No corresponding normalized presentation-word type was introduced. |
| absence | 1 | 522 | `props.onShowMatching === undefined` | Presentation | Optional React capability/activity/note presence controls the actual control or container drawn. Kept absent rather than supplied a no-op or a default container. |
| absence | 2 | 613, 624 | `props.explain === undefined` | Presentation | Optional React capability/activity/note presence controls the actual control or container drawn. Kept absent rather than supplied a no-op or a default container. |
| absence | 2 | 643, 867 | `props.activity === undefined` | Presentation | Optional React capability/activity/note presence controls the actual control or container drawn. Kept absent rather than supplied a no-op or a default container. |
| absence | 1 | 720 | `props.readOnlyNote !== undefined` | Presentation | Optional React capability/activity/note presence controls the actual control or container drawn. Kept absent rather than supplied a no-op or a default container. |
| absence | 1 | 806 | `props.onRetry === undefined` | Presentation | Optional React capability/activity/note presence controls the actual control or container drawn. Kept absent rather than supplied a no-op or a default container. |
| absence | 1 | 979 | `importButtonNode === null` | Presentation | A derived ReactNode may be null when Import is not offered; only existing buttons receive the footer wrapper. |

#### `packages/review/src/SavedProgress.hook.ts`

| Kind | Count | Lines | Expression | Class | Reason retained |
| --- | ---: | --- | --- | --- | --- |
| absence | 1 | 23 | `typeof indexedDB === "undefined"` | Platform | Actual absence of the IndexedDB global fails with FileNotKept; this is not an absent review field. |

#### `packages/review/src/internal/parts.tsx`

| Kind | Count | Lines | Expression | Class | Reason retained |
| --- | ---: | --- | --- | --- | --- |
| absence | 1 | 231 | `props.className === undefined` | Presentation | Optional React class/capability presence determines the wrapper or action actually drawn. No no-op capability or default action is supplied. |
| absence | 1 | 271 | `face === undefined` | Owned | The column/CSS helper still returns an optional font class. The omitted class means the normal face; this derived nullable helper remains unresolved. |
| normalise | 1 | 390 | `mark.from.trim` | Presentation | Compares before/after spaces or quotes the original spelling; does not change a reviewed cell. This display comparison remains counted. |
| absence | 1 | 461 | `element === null` | Platform | Actual DOM ref is absent while an element is detached; measurement subscribes only to an attached element. |
| fallback | 1 | 515 | `props.children ?? props.text` | Presentation | ReactNode null and undefined both choose text here. A destructuring default alone would preserve explicit null and change the content. |
| fallback | 1 | 519 | `props.card ?? props.text` | Presentation | ReactNode null and undefined both choose text here. A destructuring default alone would preserve explicit null and change the content. |
| absence | 1 | 622 | `props.onUndoFix !== undefined` | Presentation | Optional React class/capability presence determines the wrapper or action actually drawn. No no-op capability or default action is supplied. |
| absence | 1 | 626 | `props.onPick !== undefined` | Presentation | Optional React class/capability presence determines the wrapper or action actually drawn. No no-op capability or default action is supplied. |
| absence | 1 | 640 | `props.onAccept === undefined` | Presentation | Optional React class/capability presence determines the wrapper or action actually drawn. No no-op capability or default action is supplied. |
| absence | 1 | 645 | `props.all === undefined` | Presentation | Optional React class/capability presence determines the wrapper or action actually drawn. No no-op capability or default action is supplied. |
| absence | 1 | 652 | `props.onReject === undefined` | Presentation | Optional React class/capability presence determines the wrapper or action actually drawn. No no-op capability or default action is supplied. |

#### `packages/review/src/internal/keptStore.ts`

| Kind | Count | Lines | Expression | Class | Reason retained |
| --- | ---: | --- | --- | --- | --- |
| unwrap | 1 | 16 | `O.getOrUndefined(O.liftThrowable(() => window.localStorage)())` | Platform | Actual browser localStorage availability/refusal or Storage.getItem null contract. Keeps visit-only operation and bare-word compatibility. |
| absence | 2 | 33, 37 | `storage === undefined` | Platform | Actual browser localStorage availability/refusal or Storage.getItem null contract. Keeps visit-only operation and bare-word compatibility. |
| absence | 1 | 47 | `text === null` | Platform | Actual browser localStorage availability/refusal or Storage.getItem null contract. Keeps visit-only operation and bare-word compatibility. |

#### `packages/review/src/internal/WorkList.tsx`

| Kind | Count | Lines | Expression | Class | Reason retained |
| --- | ---: | --- | --- | --- | --- |
| fallback | 1 | 86 | `root?.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]') ?? null` | Platform | Actual DOM viewport/ref/first-child availability while subscribing ResizeObserver and scroll handlers. |
| absence | 1 | 99 | `element === null` | Platform | Actual DOM viewport/ref/first-child availability while subscribing ResizeObserver and scroll handlers. |
| absence | 1 | 116 | `element.firstElementChild !== null` | Platform | Actual DOM viewport/ref/first-child availability while subscribing ResizeObserver and scroll handlers. |

#### `packages/review/src/internal/ReviewQueue.tsx`

| Kind | Count | Lines | Expression | Class | Reason retained |
| --- | ---: | --- | --- | --- | --- |
| absence | 1 | 98 | `shown === undefined` | Owned | The queue card identity still uses an empty key for no card. A distinct no-card state has not replaced that existing sentinel. |
| absence | 1 | 129 | `first === undefined` | Owned | The generic column list can be empty. The name renderer still branches on its first-column lookup before using the row label. |
| fallback | 1 | 129 | `view.cells[first.id] ?? ""` | Owned | A dynamic cell key may be absent; existing empty text is retained in context, editing and value drawing without copying/filling every row. |
| fallback | 2 | 136, 142 | `view.cells[column.id] ?? ""` | Owned | A dynamic cell key may be absent; existing empty text is retained in context, editing and value drawing without copying/filling every row. |
| fallback | 1 | 329 | `O.getOrElse(HashMap.get(labels, subject), () => subject)` | Owned | The column-label dictionary still uses the actual column id when no label entry is found; the column-id/label-map relation is not total. |
| fallback | 3 | 382, 430, 472 | `view.cells[subject.value] ?? ""` | Owned | A dynamic cell key may be absent; existing empty text is retained in context, editing and value drawing without copying/filling every row. |
| absence | 2 | 517, 559 | `main === null` | Presentation | The computed main ReactNode may be absent; the first-action marker then belongs to the existing secondary action. |
| absence | 1 | 708 | `entry === undefined` | Owned | The clamped queue index can still select no entry from an empty decisions list; this queue/no-card case remains a bounds check. |

#### `packages/review/src/internal/ReviewGrid.tsx`

| Kind | Count | Lines | Expression | Class | Reason retained |
| --- | ---: | --- | --- | --- | --- |
| absence | 2 | 133, 888 | `first === undefined` | Owned | The column list may be empty; the row/name renderer keeps its complete no-first-column branch instead of inventing a column. |
| fallback | 2 | 133, 914 | `view.cells[first.id] ?? ""` | Owned | A dynamic cell key may be absent. Empty text is still selected in measurement, comparison, context or editing; no per-row fill/copy was introduced. |
| fallback | 8 | 175, 186, 309, 311, 618, 620, 624, 1141 | `view.cells[column.id] ?? ""` | Owned | A dynamic cell key may be absent. Empty text is still selected in measurement, comparison, context or editing; no per-row fill/copy was introduced. |
| fallback | 2 | 175, 187 | `other.cells[column.id] ?? ""` | Owned | A dynamic cell key may be absent. Empty text is still selected in measurement, comparison, context or editing; no per-row fill/copy was introduced. |
| absence | 1 | 191 | `props.onKeep === undefined` | Presentation | An optional React matching/keep capability omits its control when absent. No no-op action or invented selection is supplied. |
| fallback | 1 | 268 | `top[index]?.length ?? 0` | Owned | The bounded longest-value sizing queue still protects unchecked indices with zero length. A type-safe bounded selection preserving linear work is not in place. |
| fallback | 2 | 268, 269 | `top[at]?.length ?? 0` | Owned | The bounded longest-value sizing queue still protects unchecked indices with zero length. A type-safe bounded selection preserving linear work is not in place. |
| absence | 2 | 318, 566 | `mark === undefined` | Owned | The sparse owned marks record still distinguishes an absent mark from an applied/proposed mark at this lookup. This is not a DOM/vendor exemption. |
| normalise | 1 | 327 | `mark.from.trim` | Presentation | Compares before/after spaces or quotes the original spelling; does not change a reviewed cell. This display comparison remains counted. |
| fallback | 1 | 374 | `input.columns.find((column) => column.id === subject)?.label ?? subject` | Owned | The action subject may name a column without metadata; the existing actual subject id is used as its label. That cross-record relationship is not modeled. |
| fallback | 1 | 469 | `view.cells[subject.value] ?? ""` | Owned | A dynamic cell key may be absent. Empty text is still selected in measurement, comparison, context or editing; no per-row fill/copy was introduced. |
| absence | 1 | 473 | `view.marks[subject.value] === undefined` | Owned | The sparse owned marks record still distinguishes an absent mark from an applied/proposed mark at this lookup. This is not a DOM/vendor exemption. |
| absence | 1 | 618 | `view.marks[column.id] === undefined` | Owned | The sparse owned marks record still distinguishes an absent mark from an applied/proposed mark at this lookup. This is not a DOM/vendor exemption. |
| fallback | 1 | 688 | `O.getOrElse(HashMap.get(props.labels, subject), () => subject)` | Owned | The column-label dictionary still uses the actual subject/column id when a label is absent; its key-to-label contract is not total. |
| fallback | 2 | 690, 738 | `view.cells[subject] ?? ""` | Owned | A dynamic cell key may be absent. Empty text is still selected in measurement, comparison, context or editing; no per-row fill/copy was introduced. |
| absence | 1 | 772 | `only !== undefined` | Owned | After the one-choice length test, the array type still permits an absent indexed choice. The one-choice tuple refinement is not encoded. |
| absence | 1 | 914 | `view.marks[first.id] === undefined` | Owned | The sparse owned marks record still distinguishes an absent mark from an applied/proposed mark at this lookup. This is not a DOM/vendor exemption. |
| absence | 2 | 920, 936 | `hiddenSubject === undefined` | Owned | The requested hidden subject may have no column metadata. Its nullable metadata lookup still decides whether a hidden-field presentation is drawn. |
| absence | 2 | 996, 1074 | `main === null` | Presentation | The computed main ReactNode may be absent; the existing first-action marker is placed on another real control. |
| fallback | 1 | 1011 | `O.getOrElse(HashMap.get(props.labels, present), () => present)` | Owned | The column-label dictionary still uses the actual subject/column id when a label is absent; its key-to-label contract is not total. |
| fallback | 1 | 1225 | `O.getOrElse(HashMap.get(props.labels, group.column), () => group.column)` | Owned | The column-label dictionary still uses the actual subject/column id when a label is absent; its key-to-label contract is not total. |
| fallback | 1 | 1595 | `measured[index] ?? O.match(column.width, { onNone: () => fillLeast, onSome: (width) => width })` | Owned | The measured-width array is not typed as total over the current columns. Missing measurement still uses supplied minimum width or the existing fill minimum. |
| absence | 1 | 1603 | `head !== undefined` | Owned | The first shown-column lookup still guards the layout correction; a nonempty planner result is not represented in its type. |
| absence | 1 | 1670 | `head === undefined` | Owned | An empty line list still uses its existing empty first-key marker for the virtual-list change signature; no separate empty signature case is modeled. |
| absence | 1 | 1702 | `line === undefined` | Platform | The index is supplied by TanStack Virtualizer; check the current entries array before rendering or estimating that vendor-requested line. |
| unwrap | 1 | 1732 | `O.getOrNull(registry.get(scroller))` | Platform | Final conversion of the scroller Option to the null contract required by TanStack Virtualizer.getScrollElement. |
| fallback | 1 | 1778 | `O.getOrElse(get.self<Drawn>(), () => nothingDrawn)` | Owned | The virtual-list snapshot still selects nothingDrawn on its first atom read. That existing initial snapshot remains outside a schema constructor. |
| fallback | 1 | 1901 | `items[0]?.start ?? 0` | Platform | TanStack Virtualizer may return no virtual items; its empty measurement range keeps zero padding. This vendor measurement edge remains counted. |
| fallback | 1 | 1902 | `items[items.length - 1]?.end ?? 0` | Platform | TanStack Virtualizer may return no virtual items; its empty measurement range keeps zero padding. This vendor measurement edge remains counted. |
| fallback | 1 | 1908 | `columns[0]?.id ?? ""` | Owned | The first-column measurement request still sends an empty id when columns are empty. This existing sizing sentinel is unresolved, not a platform edge. |
| absence | 1 | 1933 | `sortable !== undefined` | Platform | TanStack Table.getColumn may return undefined, so its sort control is drawn only for a supplied column. |
| absence | 2 | 1934, 1937 | `props.onMatch !== undefined` | Presentation | An optional React matching/keep capability omits its control when absent. No no-op action or invented selection is supplied. |
| absence | 1 | 1945 | `sortable === undefined` | Platform | TanStack Table.getColumn may return undefined, so its sort control is drawn only for a supplied column. |
| absence | 1 | 1997 | `entry === undefined` | Platform | The index is supplied by TanStack Virtualizer; check the current entries array before rendering or estimating that vendor-requested line. |

#### `packages/review/src/internal/PhoneDrawer.tsx`

| Kind | Count | Lines | Expression | Class | Reason retained |
| --- | ---: | --- | --- | --- | --- |
| absence | 1 | 36 | `props.footer === undefined` | Presentation | Optional React footer controls whether a footer container exists. Explicit null and omission keep their previous distinct container behavior. |


### Review-source handback and proof limits

The dependency migration reaches the source consumers: decoded metadata, decision flags, saved progress, words,
atom inputs, navigation, callback capabilities and final screen cases use their canonical required/Option forms.
Rows retain their existing objects and sparse cells; there is no per-row schema copy. The unresolved owned
lookups above are retained explicitly rather than hidden behind another spelling of a default.

Storage review: `ReviewDecision.schema.ts:249` still writes sparse encoded flags; the codec at line 273 restores
the canonical representation. `SavedProgress.schema.ts:129` and line 136 convert stored steps without changing
nulls, sparse flag keys or the legacy browser format; lines 144 and 154 preserve the existing saved-review shape.
The legacy fixture is unchanged, and its exact-byte round-trip test passes. Recheck's absent result still preserves
an existing rival problem; a present-empty rival list keeps its previous vacuous-settlement behavior. Present-empty
choices still suppress the typing control. These distinctions remain Options through the consuming cases.

The edit form at `internal/parts.tsx:665` checks trimmed, nonempty submission at the actual input boundary.
Its state keeps the raw displayed text and a separate checked submission. Opening and changing the input update
both; Save remains disabled for empty/whitespace input and submits trimmed text. Six direct schema probes checked
empty, spaces, tabs, padded numeric/text and nonbreaking-space inputs. This is local proof, not screen inspection.
No product words were changed, and no new product rule was chosen.

Forced caller changes are limited to the two review gallery pages and catalog's ImportReview controller,
ReviewDraft atoms, ReviewStep and UploadStep. They state the required arguments, supply Option capabilities and
consume Option results. Six catalog test files, six review test files and the two review fixtures reflect those
canonical internal shapes/signatures. The review strict ceiling decreases from 249 to 225. No ceiling was raised;
no defaults baseline, exemption, protected fixture, lockfile, PLAN, vendor or UI component/hook file was changed.

Validation on the final code: `bun run check --env-mode=loose` passed all 105 tasks (72 cached, 2m 6.528s), using
isolated temporary cache paths. That includes the catalog's 401 fast tests and review's 115 tests. The dedicated
catalog fold run also passed all 17 properties in 149.11s. Earlier runs caught stale Option-shape expectations and
ledger/gate issues; those were corrected before the final green run without changing a baseline or exemption.
The final source scan counts the 153 sites above. Focused defaults, formatting and docs checks are recorded in the
handback after this appendix. No commit or push was made.

Nothing was inspected in a browser or on screen. The green checks establish local behavior and integration,
including saved-progress and review-model properties; they do not establish the orchestrator's visual acceptance
or a real user's complete import journey. Row 9 remains an incomplete zero-baseline migration because the 153
named sites remain, including 88 owned cases. The actual platform sites are candidates for a human exemption
judgment, not exemptions granted by this pass.

Needs the person: the existing defaults and exemption judgments in this goal packet, plus the orchestrator's
on-screen acceptance. No additional approval was requested and no new product rule was chosen.


Final focused receipts: formatting passes all 34 changed code/config files; defaults law passes all 33 changed
TypeScript files (186 fallback, 145 absence, 17 unwrap, 27 normalise across source plus forced callers/tests).
The separate review-source-only inventory remains 153. `docs:check` passes all three documentation roots with
existing status-vocabulary warnings, and `git diff --check` passes. The baseline was not lowered.

## Review tests, row 9, 2026-11-26

This lane owns `packages/review/test` only. The source migration's canonical Options are read directly; no schema
is introduced to manufacture a missing assertion value. The historical draft fixture and all stored formats stay
unchanged. The baseline is retained for the orchestrator to lower after review.

| Boundary or field | Verdict | Implementation rule |
| --- | --- | --- |
| Test lookups of rows, groups, facets, history and changes | Required | Narrow with `assertSome` or `assertDefined`; keep every existing expectation and fail on missing prerequisites |
| `ReviewRow.problem`, problem fix/rivals/choices/column and column metadata | Absent, as is | Compose the Options directly, without a nullable intermediate |
| `ReviewState.redo` and decision collections | Required, as is | Read the canonical collections without a fallback |
| Atom test builder rows/kinds and key modifiers | Required | Callers spread a named starting input and state overrides; builders have no default arguments |
| Fixture line problems and temporary fabrication problems | Absent | Use Option where the fixture can be migrated within this lane; retain any unresolved site explicitly |
| Fixture finite lists and dynamic cell lookups | Required where construction proves presence; otherwise Absent | Assert finite fixture prerequisites; preserve real sparse-cell behavior and name unresolved sites |
| Storage and external table mocks | Platform boundary | Preserve the actual API contract; unresolved null conversions are counted, not granted exemptions |
| Fixture recheck normalization and derived reason text | Derived | Preserve existing cell-reading rules and words; no fallback-only decode or renamed default |

No new undecided default or exemption is introduced. Final remaining-site inventory and validation are appended
below after implementation.

### Remaining review-test places

The final reader counts 20 places: 14 fallbacks, two absence checks and four normalizations, down from the saved
94. The four files `DraftFormat.test.ts`, `Review.test.ts`, `ReviewLayout.test.ts` and `ReviewRegion.atoms.test.ts`
have zero. The saved baseline is unchanged. Every counted remaining site is listed below; none is an exemption.

Both fixture modules are imported directly by the browser gallery (`ReviewGallery.tsx` and
`gallery/JobsReview.tsx`). They cannot import `@effect/vitest/utils`: its runtime imports Vitest and `node:assert`.
The attempted fixture narrowing assertions were removed before the final validation. The remaining finite-list
lookups need nonempty/bounded construction contracts or separation from those browser consumers; substituting an
unsafe getter, cast or synchronous runner would only rename the question. The mutable counters need an explicit
construction policy instead of a missing-key zero. The sparse cell metadata needs its required-key relationship
carried through `ReviewRow` rather than widened away by that source type. These repairs were not built in this
lane. The three trims and capitalization need a browser-safe normalization boundary compatible with the callers'
synchronous API; no fallback-only decode, invented error result or test runtime import was left behind.

| File (under `packages/review/test`) | Line | Kind | Expression | Why left |
| --- | ---: | --- | --- | --- |
| `SavedProgress.test.ts` | 37 | fallback | `state.items[key] ?? null` | The Storage mock must return null for an unknown key. An Option-to-null conversion would remain an unwrap; a named API-edge judgment is outside this lane. |
| `fixtures/fabrication.ts` | 517 | fallback | `pool[position % pool.length] ?? families[0]!` | Shared browser fixture has unchecked list indices; bounded/nonempty construction contract not built. Vitest assertions would break its browser consumer. |
| `fixtures/fabrication.ts` | 518 | fallback | `O.getOrElse` | Mutable counter selects zero on first use. Explicit counter construction policy not built; no new schema default was chosen. |
| `fixtures/fabrication.ts` | 520 | fallback | `family.sizes[turn % family.sizes.length] ?? family.sizes[0]!` | Shared browser fixture has unchecked list indices; bounded/nonempty construction contract not built. Vitest assertions would break its browser consumer. |
| `fixtures/fabrication.ts` | 629 | fallback | `row.cells.category ?? ""` | Source ReviewRow widens generated required cells to a sparse record; required-key contract not carried through. |
| `fixtures/fabrication.ts` | 631 | fallback | `O.getOrElse` | Mutable counter selects zero on first use. Explicit counter construction policy not built; no new schema default was chosen. |
| `fixtures/fabrication.ts` | 635 | fallback | `row.cells.unit ?? ""` | Source ReviewRow widens generated required cells to a sparse record; required-key contract not carried through. |
| `fixtures/fabrication.ts` | 637 | fallback | `row.cells.category ?? ""` | Source ReviewRow widens generated required cells to a sparse record; required-key contract not carried through. |
| `fixtures/fabrication.ts` | 675 | fallback | `other.cells.sku ?? ""` | Source ReviewRow widens generated required cells to a sparse record; required-key contract not carried through. |
| `fixtures/fabrication.ts` | 683 | normalise | `name.trim` | Shared browser fixture still reads cells or constructs presentation words synchronously; normalization boundary not built. |
| `fixtures/fabrication.ts` | 687 | normalise | `cost.trim` | Shared browser fixture still reads cells or constructs presentation words synchronously; normalization boundary not built. |
| `fixtures/fabrication.ts` | 689 | normalise | `onHand.trim` | Shared browser fixture still reads cells or constructs presentation words synchronously; normalization boundary not built. |
| `fixtures/jobs.ts` | 161 | fallback | `materials[(index * 3 + at * 7) % materials.length] ?? materials[0]!` | Shared browser fixture has unchecked list indices; bounded/nonempty construction contract not built. Vitest assertions would break its browser consumer. |
| `fixtures/jobs.ts` | 178 | fallback | `days[(index * 2) % days.length] ?? "Mon 23 Nov"` | Shared browser fixture has unchecked list indices; bounded/nonempty construction contract not built. Vitest assertions would break its browser consumer. |
| `fixtures/jobs.ts` | 187 | absence | `job === undefined` | Shared browser fixture has unchecked list indices; bounded/nonempty construction contract not built. Vitest assertions would break its browser consumer. |
| `fixtures/jobs.ts` | 187 | absence | `target === undefined` | Shared browser fixture has unchecked list indices; bounded/nonempty construction contract not built. Vitest assertions would break its browser consumer. |
| `fixtures/jobs.ts` | 190 | fallback | `materials[(jobAt + lineAt) % 4] ?? materials[0]!` | Shared browser fixture has unchecked list indices; bounded/nonempty construction contract not built. Vitest assertions would break its browser consumer. |
| `fixtures/jobs.ts` | 200 | fallback | `commas[comma % commas.length] ?? ["1,5", materials[0]!]` | Shared browser fixture has unchecked list indices; bounded/nonempty construction contract not built. Vitest assertions would break its browser consumer. |
| `fixtures/jobs.ts` | 231 | fallback | `strangers[stranger % strangers.length] ?? strangers[0]!` | Shared browser fixture has unchecked list indices; bounded/nonempty construction contract not built. Vitest assertions would break its browser consumer. |
| `fixtures/jobs.ts` | 403 | normalise | `reason.charAt(0).toUpperCase` | Shared browser fixture still reads cells or constructs presentation words synchronously; normalization boundary not built. |

The existing `fixtures/jobs.ts` `answerOf` column case also still has `onNone: () => ""` (the current reader does
not count that test literal). It preserves the empty-key decision lookup for a problem without a column. Making
that field required or deciding the no-column outcome would change its source contract or behavior; it was left
explicitly, not moved to a named constant or a fallback-only schema.

### Review-test checks and scope

The test builders now take required inputs. Lookup prerequisites narrow with the test utility assertions; Options
stay Options in comparisons and projections. The fixture Line schema models its optional problem; generated
fabrication problems and applied fixes use their canonical Option/list shapes. Fixture consumers remain browser
safe. No source file, caller outside this package, PLAN, baseline, exemption, lock, stored data or legacy draft
text was edited. No commit or push was made.

The installed Effect source was checked for the APIs used, including Option composition/getSuccess, Record.get,
Array lookups, Schema.OptionFromOptionalKey/decodeResult/decodeTo and SchemaTransformation.toLowerCase. The
search oracle's decode normalizes actual name text; it supplies no fallback and converts no Option to undefined.

Final focused review suite: 115 tests in seven files passed, without retries. The legacy draft exact-byte round
trip is included. An independent comparison against HEAD passed for 36 fabrication configurations (nine sizes,
including 0 and 5000, with both clean and withoutUnit flags), canonicalized job data, question rows, job review
words/status/counts under three decision sets and three left-out sets, and sparse/blank/trimmed rechecks. A final 256-case sparse/blank/padded recheck comparison also matches HEAD. The
comparison canonicalizes only the intentionally migrated optional Line.problem shape. Temporary original copies
were removed. Logs: `/tmp/defaults-review-tests-final.log` and `/tmp/defaults-review-parity.log`.

Scoped formatting and defaults checks pass. `bun run check` was run with temporary cache paths; its first failure
is a mandatory ledger decrease outside this lane. A second run with `--continue` checks the remaining tasks. The
required ledger edits, deliberately not made, are:

- `packages/tooling/tool/cli/ledgers/assertions.json`: ReviewRegion.atoms.test.ts, 11 to 10.
- `packages/tooling/tool/cli/ledgers/readonly.json`: ReviewRegion.atoms.test.ts, 17 to 15; fixtures/jobs.ts, 23 to 16.

These are decreases caused by removing the nullable assertion and optional/plain fixture fields. Adding redundant
assertions or mutable fields to retain the old ledger numbers would disguise the improvement. This lane cannot
claim a passing full check while the required bookkeeping files are outside its authorized boundary.

No browser session, hosted deployment, full import journey, check:full, slow suite or separate Verify run was
performed. This hand-back does not establish on-screen acceptance or complete row 9.

Final full-check receipt: `bun run check --continue` finished with 103 of 105 tasks successful in 2m 37.584s;
only assertions:check and readonly:check failed, for the three decreases listed above. Review typecheck/strict
ceiling and lint pass independently on the final files, as do all 115 review tests. `docs:check` passes with the
existing status-vocabulary warnings, and `git diff --check` passes. The final fixture loop uses a whole `O.match`
case, not a boolean projection in an `if`; its focused tests were rerun after that adjustment. The required
bookkeeping edits are provided, unapplied, in `/tmp/defaults-review-ledger-decreases.patch`. Full-check logs are
`/tmp/defaults-review-check.log` and `/tmp/defaults-review-check-continue.log`.

Needs the person: authorize the three ledger decreases outside this lane, or have the orchestrator apply them;
the 20 named remaining sites and the uncounted no-column fallback still need follow-up, not an exemption inferred
by this lane.

## Row 10 leftovers: client and owned UI, 2026-11-26

Written before implementation in the `defaults-ui-client-2` lane. The starting scanner inventory is 73 places:
19 in five client source files and 54 in ten owned UI source files. No exemption is granted by this section.

| Field or boundary | Verdict before implementation | Reason and intended treatment |
| --- | --- | --- |
| Query/write reactivity keys; optimistic settled keys | Required Option capability | Our own configuration must state Some(keys) or None. Keep the exact existing subscription/invalidation branches; forced callers supply the choice. |
| Query answer | Retain unresolved | The answer atom's nullable public result requires a consuming-shape migration. Do not rename the unwrap. |
| Query comparison time and toast lead | Required Option | Our helpers require explicit absence or a value; forced callers preserve their existing choices. The draft already holds an Option time, so its caller passes it directly. |
| Connection globals; navigator and lock callbacks | Browser edge | These are actual absent globals/platform capabilities and Web Locks' nullable callback argument. Retain and name each check. |
| Error sentences and path capitalization | Retain unresolved | Existing unknown-kind wording, camel-case splitting and capitalization need an actual schema/consumer design; no fallback-only decode or renamed normalization. |
| Error logging and JSON codec | Retain unresolved | Synchronous Effect execution cannot be erased by another throwing escape or by changing when logging happens or what a failed codec throws. These are not nullable browser edges. |
| Agent run step input/output/tag | Retain unresolved | Owned run-step data, not the AgentRun component's own optional props. Do not relabel it as a React edge. |
| List columns, facet counting and search text | Retain unresolved except total entry enumeration and first-column selection | Owned configuration and synchronous normalization remain. Enumerating count entries can eliminate an impossible missing count; take at most one column for pinning rather than selecting a potentially missing first id. |
| List toolbar | Required rendering case | Select the wrapper from the existing empty-row case, without asking whether the derived ReactNode is null. |
| PageHeader and ProposedValue optional props | React edge | Preserve omitted versus explicit null markup and each optional state/source case. No body default is introduced. |
| Proposal attribution helpers | Retain unresolved | Owned helper inputs and the medium confidence fallback are not component props. Keep unchanged rather than moving an undecided fallback into a fallback-only codec. |
| Route path/query | Nonempty path and query constructor cases | A string split always has a path. Read it from a nonempty split; match an absent/present first query segment into its complete URLSearchParams constructor, preserving repeated question marks. |
| Skeleton component props | React and vendor edges | Retain each actual optional prop check. Grid column width and label are owned data and remain unresolved, rather than being passed through a schema just to default them. |
| Search keyboard ownership | Browser DOM edge | closest returns null at this line. Keep the actual edge. |
| Search trimming and keyboard case | Retain unresolved | Moving a synchronous text cleanup needs a canonical decoded text carried through debounce/comparison/submission. Do not hide it behind a string helper. |
| Canvas context and font cache | Option initialization state plus browser edge | Cache initialization separately from a failed getContext; convert its null once on entry, then use Options. Preserve lazy font reads and the existing measured-width cache. |
| CSS font words | Retain unresolved | CSS returns an empty string, not a nullable API value. Existing sans-serif/monospace policies stay visible and are not classified as null edges. |

The final single remaining-site table and verification receipts follow this section after implementation.

### Final remaining-site table

The scanner now reports **60 sites: client 14, UI 46**, down from 73. The table additionally retains the canvas
`O.fromNullishOr` entry as **one browser edge**, as required by this lane: this reader does not count that token.
Thus the hand inventory has **61 places: 20 actual browser/React/vendor edges and 41 unresolved owned places**.
The latter are explicitly not exemptions and not claimed cleared. No baseline or exemption was changed.

| File | Kind | Count | Lines | Example | Which edge, or why unresolved |
| --- | --- | ---: | --- | --- | --- |
| `packages/client/src/Api.atoms.ts` | fallback | 1 | 59 | `Effect.runSync(Reactivity.make)` | **Unresolved owned.** Tab-wide synchronous Reactivity construction; no unsafe constructor exists in the installed source. |
| `packages/client/src/Api.atoms.ts` | unwrap | 1 | 260 | `O.getOrUndefined` | **Unresolved owned.** Public answer atom still converts to undefined before its screen consumers; requires consuming-shape migration. |
| `packages/client/src/Connection.atoms.ts` | absence | 2 | 21, 53 | `typeof window === "undefined"` | **Browser edge.** The window global itself may be absent during server rendering/tests. |
| `packages/client/src/SayError.controller.ts` | fallback | 1 | 36 | `(Object.hasOwn(troubles, kind) ? troubles[kind] : troubles["down"]) ?? "The model is not answering right now. Try again later."` | **Unresolved owned.** Installed trouble dictionary may lack the requested/down sentence; the existing literal sentence remains unchanged. |
| `packages/client/src/SayError.controller.ts` | normalise | 2 | 66, 84 | `last.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase` | **Unresolved owned.** Existing request-path camel-case/letter presentation needs a canonical text schema carried through its synchronous consumers. |
| `packages/client/src/SayError.controller.ts` | absence | 1 | 95 | `error === null` | **Unresolved owned.** The unknown error input may be null; this is an owned logging guard, not a browser null-returning API. |
| `packages/client/src/SayError.controller.ts` | fallback | 2 | 95, 98 | `Effect.runSync(Effect.logError("[failure]", error))` | **Unresolved owned.** Synchronous error logging remains; changing to asynchronous logging changes timing. |
| `packages/client/src/Tab.atoms.ts` | absence | 3 | 45, 45, 61 | `typeof navigator === "undefined"` | **Browser edge.** Actual missing navigator/global Web Locks capability or the nullable ifAvailable lock callback argument. |
| `packages/client/src/Tab.atoms.ts` | absence | 1 | 57 | `locks === undefined` | **Unresolved owned.** The result of our own browserLocks helper is still nullable here; only the original navigator read is a browser edge. |
| `packages/ui/src/AgentRun.component.tsx` | absence | 5 | 41, 41, 55, 79, 85 | `step.input !== undefined` | **Unresolved owned.** RunStep input/output/tag are optional owned data fields, not optional props directly owned by AgentRun. |
| `packages/ui/src/Json.codec.ts` | absence | 1 | 10 | `value === undefined` | **Unresolved owned.** Synchronous schema codec execution and the arbitrary-input undefined guard remain; preserving failure behavior needs an Effect/Option consumer migration. |
| `packages/ui/src/Json.codec.ts` | fallback | 2 | 10, 14 | `Effect.runSync(S.encodeEffect(codec)(value))` | **Unresolved owned.** Synchronous schema codec execution and the arbitrary-input undefined guard remain; preserving failure behavior needs an Effect/Option consumer migration. |
| `packages/ui/src/ListTable.component.tsx` | normalise | 2 | 68, 75 | `(typeof filterValue === "string" ? filterValue : "") .toLowerCase` | **Unresolved owned.** Case-insensitive search text is still normalized synchronously inside the filter, not at a schema boundary. |
| `packages/ui/src/ListTable.component.tsx` | fallback | 5 | 92, 115, 151, 152, 171 | `counts[text] ?? 0` | **Unresolved owned.** Owned column width/cell/hover choices and facet accumulation remain; no fallback-only schema or literal alias was introduced. |
| `packages/ui/src/ListTable.component.tsx` | absence | 4 | 124, 124, 152, 154 | `column.value !== undefined` | **Unresolved owned.** Owned ListColumn value capability remains nullable through table construction. |
| `packages/ui/src/PageHeader.component.tsx` | absence | 2 | 24, 30 | `props.line === undefined` | **React prop edge.** The component directly reads its optional line/actions props; explicit null and omission keep distinct wrapper markup. |
| `packages/ui/src/ProposalSource.words.ts` | absence | 2 | 42, 68 | `source === undefined` | **Unresolved owned.** Own helper source/confidence input and the medium-confidence policy remain unchanged; these are not React component props. |
| `packages/ui/src/ProposalSource.words.ts` | fallback | 1 | 79 | `fix.confidence ?? "medium"` | **Unresolved owned.** Own helper source/confidence input and the medium-confidence policy remain unchanged; these are not React component props. |
| `packages/ui/src/ProposedValue.component.tsx` | absence | 4 | 74, 86, 110, 110 | `props.source === undefined` | **React prop edge.** The component directly reads its optional source/state props to choose complete markup cases. |
| `packages/ui/src/Skeletons.component.tsx` | absence | 6 | 44, 166, 167, 168, 170, 199 | `props.title === undefined` | **React prop edge.** Direct title/line/action/views optional props choose markup or outgoing optional component props. |
| `packages/ui/src/Skeletons.component.tsx` | absence | 1 | 96 | `props.rows === undefined` | **React/vendor prop edge.** TableSkeleton's optional rows prop is omitted from the vendored DataTableFrameSkeleton when absent. |
| `packages/ui/src/Skeletons.component.tsx` | fallback | 2 | 114, 127 | `column.width ?? 240` | **Unresolved owned.** SkeletonColumn width/label are owned nested data, not the skeleton component's own optional props. |
| `packages/ui/src/TableSearch.component.tsx` | normalise | 6 | 115, 125, 140, 140, 151, 151 | `after.value.text.trim` | **Unresolved owned.** Five search trim sites and one KeyboardEvent key case normalization remain; the browser supplies a string, not a null/undefined value. |
| `packages/ui/src/TableSearch.component.tsx` | absence | 1 | 127 | `event.target.closest("[role=dialog]") !== null` | **Browser edge.** Element.closest returns null at this exact read; a dialog retains keyboard ownership. |
| `packages/ui/src/TextWidth.measure.ts` | fallback | 2 | 31, 32 | `style.getPropertyValue("--font-sans") \|\| "sans-serif"` | **Unresolved owned.** CSS returns an empty string; sans-serif/monospace are existing owned font policies, not nullable API edges. |
| `packages/ui/src/TextWidth.measure.ts` | absence at entry (not counted by this scanner) | 1 | 19 | `O.fromNullishOr(document.createElement("canvas").getContext("2d"))` | **Browser edge.** One conversion of the nullable canvas API result; cached initialization and all consumers keep Options. |

### Changed files and forced callers

The required canonical configuration fields are `QueryOptions.reactivityKeys`, write `reactivityKeys`,
`OptimisticWrite.settled`, `Query.askAgain` comparison time, and `toastError` lead. None carries a new default:
callers explicitly pass Some of the old supplied value or None for the old omission. The None query branch returns
exactly the former atom, and the None write branch returns exactly the former Effect. No no-op subscriber or empty
invalidation was substituted. Draft's comparison time is already an Option and now passes through directly.

List pinning takes at most one existing column; facet entries enumerate each held count with its key; the mobile
toolbar wrapper uses the already-known empty-row case. Route reads a guaranteed nonempty split and matches both
complete URLSearchParams construction cases. Canvas initialization retains a failed null read for the page's life,
reads fonts only after a usable context, and keeps the original width-cache keys and missing-context estimate.
The UI strict ceiling decreases from 40 to 39 because the native string split retired. No schema sent across a
browser/worker boundary or stored-byte codec was changed.

Owned code/configuration and its required test adaptations:

- `packages/client/src/Api.atoms.ts`
- `packages/client/src/Optimistic.atoms.ts`
- `packages/client/src/SayError.controller.ts`
- `packages/client/test/Answer.atoms.test.ts`
- `packages/client/test/Connection.atoms.test.ts`
- `packages/client/test/Freshness.atoms.test.ts`
- `packages/client/test/Member.atoms.test.ts`
- `packages/client/test/Optimistic.atoms.test.ts`
- `packages/client/test/Paging.atoms.test.ts`
- `packages/client/test/Seed.atoms.test.ts`
- `packages/client/test/SignOut.atoms.test.ts`
- `packages/client/test/SignedIn.atoms.test.ts`
- `packages/ui/src/ListTable.component.tsx`
- `packages/ui/src/Route.atoms.ts`
- `packages/ui/src/TextWidth.measure.ts`
- `packages/ui/strict-ceiling.json`

Every following out-of-package edit is a forced caller of one of the required signatures above; no independent
behavior was changed in another lane. Review source was not edited.

- `apps/inventory/src/web/components/app/AppSidebar.tsx`
- `apps/inventory/test/web/session.test.ts`
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
- `packages/catalog/web/test/ImportPage.test.ts`
- `packages/catalog/web/test/KeptRows.test.ts`
- `packages/catalog/web/test/SessionAsked.test.ts`
- `packages/catalog/web/test/TabRows.test.ts`

This section is the only documentation change. PLAN, SPEC, defaults-baseline.json, exemptions, the Verify lock,
bun.lock, stored data and vendored files remain unchanged. No commit or push was made.

### Validation and limits

- `bun run check` passed **105/105 tasks**, 75 cached, in **2m24.712s**, with temporary Bun, XDG, Wrangler and Turbo cache paths. This includes client 58 tests, catalog web 401 tests, app 70 tests, review 115 tests, catalog model 274 fast tests and five proof tests. No web test needed a second try. Log: `/tmp/defaults-ui-client-2-check.log`.
- The focused defaults law passed all 32 changed TypeScript files. The separate source inventory reconciles every finding in the 15 baseline-named client/UI source files to the table above. The canvas entry is intentionally named beyond this reader's syntactic count; no exemption was added to hide it.
- `bun run format -- <changed files>` passed on all 33 changed code/config files; this formatter excludes Markdown. `bun run docs:check` passed all documentation roots with the existing status-vocabulary warnings. `git diff --check` passed.
- Direct probes of the actual final Route atom matched the previous splitter in **509 cases**, including empty paths, absent/empty queries, duplicate parameters and repeated question marks. Two isolated canvas probes verified available-context lazy initialization, cache identity/flags/font defaults, and unavailable-context one-time null read, original width estimates and no font access. These are local mocked-platform probes, not browser observations. No new permanent tests were added for these small refactors.
- Effect 4.1.5 APIs were read in `node_modules/effect/src`: Option construction/match/map/exists, Array get/headNonEmpty/take/map, String.split, MutableHashMap get/set and Effect sync/tap. Reactivity.make was inspected and retains its named synchronous escape because it has no unsafe constructor in this version.
- Byte comparisons against HEAD confirm defaults-baseline.json, the Verify lock, PLAN and bun.lock are unchanged. Vendored UI components/hooks, exemptions, review source and stored data were not edited. No `.dev.vars` was read; UPDATE_VERIFY_LOCK was not set; no commit or push was made.

Earlier checks caught formatting, sandbox cache permissions, two new duplicated non-readonly font fields, the required decreasing UI ceiling and forced app callers. These were corrected before the final green check. The original FontFamilies fields now have one shared type declaration; no unrelated law ledger was edited.

Not checked: `check:full`, a real browser/on-screen import of the messy sample through Confirm, hosted behavior,
production deployment or a dedicated performance benchmark. No screen words, stored representation or product
rule changed. The 41 unresolved owned sites are retained work, not approved edges or a claim that row 10 reached
zero. The 20 real edge sites are named candidates; this pass grants no exemptions.

Needs the person: the existing defaults/exemption judgments for the named retained sites; no additional product decision was chosen in this lane.

- `packages/catalog/web/test/support/draftWorld.ts`
- `packages/catalog/web/test/support/files.ts`
- `packages/catalog/web/test/tableView.test.ts`
- `packages/catalog/web/test/xlsxParity.test.ts`

The strict ceiling decreases to the measured 148. The new state module is an actual owner, moved out of the
screen to satisfy fast-refresh; its runtime import smoke passes. Package `check` passes at 148/148.

Focused proofs against archived HEAD pass: saved writer/legacy reads, Patch encoded forms, Conversation V1/V2
nulls and exact writer, shared empty identity, Notices omitted/false keys, 25 malformed/scalar/array reviewed-cell
comparisons, and 14 terminal review bridge omission cases. Scratch: `.scratch/catalog-storage-proof.ts`.
The actual reader worker module accepts encoded requests after Bun File structuredClone and emits decodable
heads/chunks: messy CSV 200 rows with sheet None and workbook 6 rows with selected sheet Some(Items).
Scratch: `.scratch/catalog-worker-proof.ts`. These are local synthetic/worker-module proofs, not browser Worker
or on-screen proof. The independent app ImportsTwin test passes without retry, including 155 Ready / 24 Needs a
decision / 21 Cannot import of 200 and Confirm storing 155. Receipt: `/tmp/catalog-web-source-final-twin.log`.

Final catalog tests pass **401 tests in 38 files**, no retry. The final focused adapter/editor/upload run passes
27 tests in 4 files, no retry (`/tmp/catalog-source-final-adapters.log`). Final workspace
`bun run check --continue=always` exits 1: **102/105 tasks successful**, 75 cached, 2m42.067s. Only the assertions,
readonly and promises ledger gates fail, each demanding the measured decreases below. All code checks, lint,
tests, proofs and other workspace gates pass. Receipt: `/tmp/catalog-source-final-check-continue2.log`.
Earlier attempts exposed the now-fixed fast-refresh module ownership and invalid dual(1) (runtime smoke catches
it), the forced app signatures, and the review bridge reading its temporary stored-choice key after a decoder
removed it. The lookup now reads the required region edits before that conversion; focused review parity and
bridge encoded-shape proofs pass. Ledger decreases remain blocked by the authorized file scope. The exact
unapplied assertion patch is `.scratch/catalog-assertions-lowering.patch`; the further readonly/Promise decreases
are `.scratch/catalog-further-ledger-lowering.patch`. These tooling files are outside this lane's edit scope and
require the person's narrow authorization before applying them. No casts were reintroduced and no ledger raises
are proposed. The assertion changes remove cellDrafts and itemText (1 each) and lower ItemEditor.test 8 to 6.
The readonly changes remove Upload.machine and reader.worker and lower cellDrafts 9 to 2; Promise
changes lower Upload.controller 14 to 13 and reader.worker 3 to 2.

Formatting all changed files plus the new state module, `git diff --check`, and `docs:check` pass; the latter
retains pre-existing status warnings. All three tooling ledgers remain byte-unchanged pending scope approval.

No browser was opened: Upload, Match, Review, Result and Items were **not seen on screen**. `check:full`, hosted
behavior, an actual browser Worker, and dedicated performance proof were not run. PLAN, defaults baseline,
exemptions, Verify lock, vendored code and .dev.vars are unchanged. No commit or push was made.

Needs the person: the narrow debt-ledger scope extension is pending; unchanged undecided defaults remain
listed in SPEC. The saved-progress hook's one owned unwrap needs its producer's later Option API migration;
this lane does not declare row 11 fully cleared or propose an exemption for it.


## Row 15 browser boundary follow-up (2026-11-26): field verdicts before implementation

This pass keeps browser absence at an actual browser read, then carries Option through owned consumers.
Storage keys, lock names, selectors, encoded bytes and screen words retain their current meaning.

| Input or field | Verdict | Boundary and reason |
| --- | --- | --- |
| Browser window, Web Locks capability and nullable ifAvailable callback | Option at the client browser reader | The platform may be absent in tests/server rendering; no locks still uses the existing immediate tab id and skips claims. Shared catalog readers use the existing client export. |
| Storage getItem/key and URLSearchParams.get | Option at the browser read | Missing entries and parameters remain distinct from invalid stored text; existing codecs and malformed-address behavior remain. |
| IndexedDB and review localStorage availability | Option at the review browser reader | Review cannot depend on client; refusal behavior, transaction completion and bare-word compatibility remain. |
| DOM query/closest/dataset, nullable ref callbacks, platform string | Option at the package browser reader | Selectors and timing stay unchanged; focus, file delivery and scroll observers consume the actual read. |
| SavedProgress scope | Required Option, already implemented | Current source already takes O.Option<ProgressScope>; None reads/writes nothing. No additional signature change is required. |
| Component own optional props | Retain direct prop edge | No helper disguises a component own prop as a browser read. |
| Review row/cell lookups and vendor table/virtualizer results | Retain where conversion would allocate in row/cell loops | This boundary pass must not add per-row/cell Options; unresolved owned data and vendor cases remain named, without an exemption. |
| Text cleanup, owned null ReactNodes and stored nullable helper arguments | Review individually, retain unless producer can carry Option | No fallback-only schema, throwing extraction or synchronous Effect escape is introduced. |

The final site inventory and validation receipts will be appended after implementation.

### Browser boundary implementation and final remaining-site inventory

The current scanner inventory for the 25 changed TypeScript files is **126 to 88 places**: fallback **42 to 39**,
absence **67 to 33**, unwrap **2 to 1**, normalization **15 to 15**. This is a source measurement against HEAD,
not a baseline rewrite. The two forced test callers have zero findings before and after. No existing row/cell
loop was changed to allocate Options; ReviewGrid changes only its toTop event action.

Shared catalog/client readers use the existing `@inventory/client/Storage` export. Review cannot depend on client
under the package boundaries, so it has its own small edge module; UI stays independent as well. No package export
or dependency was added. `useSavedProgress` already required `O.Option<ProgressScope>` before this pass and
UploadStep already passed `O.map(signedIn, ...)` directly: there was no remaining unwrap or signature migration.

The following are exemption-ready boundary descriptions, not approved exemptions. Most conversions are not counted
by this syntax reader; they are named here so a zero scanner count cannot hide a browser edge. Each function reads
the named browser API, or is the platform callback entry that receives its nullable argument.

| Edge module | Kind | Actual read and reason |
| --- | --- | --- |
| `packages/client/src/Storage.browser.ts` | absence at storage read | `browserStorage.read/keys`, `storageText`, `storageKey`: getItem/key return null. The uncaught readers preserve owning transaction refusal handling; the existing BrowserStorage API keeps its refusal policy. |
| `packages/client/src/Storage.browser.ts` | absence of browser capability | `browserWindow`, `browserLocks`: direct globalThis window/navigator reads and navigator.locks may be undefined in server rendering/tests/older browsers. Both return Options. |
| `packages/client/src/Storage.browser.ts` | absence at platform callback | `requestAvailable`: Web Locks callback supplies null when ifAvailable does not acquire a lock. It passes Option at entry, preserving native promise resolution and lock lifetime. |
| `packages/catalog/web/src/internal/browser.ts` | absence at DOM read | `query`, `inputInPicker`: querySelector and the actual ref.current read. `data`: missing dataset key. `refCallback`: React nullable DOM callback entry; the stable goToLine adapter preserves focus timing and callback identity. |
| `packages/catalog/web/src/internal/browser.ts` | absence at URL/drop read | `parameter`: URLSearchParams.get; `droppedFiles`: DragEvent.dataTransfer/files. Empty text/list stays present; absent stays None. |
| `packages/review/src/internal/browser.ts` | absence at storage read, one counted absence | `localStore`, `fileDatabase`, `storedJson`: localStorage lookup/refusal, absent indexedDB and getItem null. storedJson returns Effect because KVS requires an undefined missing result. No Option is unwrapped back into undefined. |
| `packages/review/src/internal/browser.ts` | absence at DOM/platform read | `query`, `viewport`, `closest`, `data`, `firstChild`, `byId`, `platform`: actual selector, callback-root query, closest, dataset, firstElementChild, getElementById and navigator.platform reads. `refCallback` is React callback entry and preserves attach cleanup. |
| `packages/ui/src/internal/browser.ts` | absence at DOM read | `closest`: nullable closest read for keyboard ownership by an existing dialog. |

The complete scanner remainder is below. Lines are from the final inventory; examples are exact source tokens.
Counts in a grouped row include every site of that file/kind, not only the example.

| File | Kind | Count | Lines | Example | Verdict/reason |
| --- | --- | ---: | --- | --- | --- |
| `packages/catalog/web/src/ImportPage.screen.tsx` | absence | 1 | 238 | `barSlot !== null` | Owned derived ReactNode (`barSlot`) remains nullable. This is not a DOM read or the component own optional prop; retained unresolved. |
| `packages/review/src/ReviewRegion.atoms.ts` | fallback | 12 | 180, 266, 269, 275, 279, 286, 292, 357, 411, 617, 640, 695 | `view.cells[column.id] ?? ""` | Owned sparse row/cell/facet records and counters, table core lookup, action/stop indices and synchronous text normalization remain. Converting them in row/cell/facet loops would add allocations and requires a separate canonical-data design; not exemptions. |
| `packages/review/src/ReviewRegion.atoms.ts` | normalise | 5 | 264, 264, 275, 275, 963 | `value.trim().toLowerCase` | Owned sparse row/cell/facet records and counters, table core lookup, action/stop indices and synchronous text normalization remain. Converting them in row/cell/facet loops would add allocations and requires a separate canonical-data design; not exemptions. |
| `packages/review/src/ReviewRegion.atoms.ts` | absence | 2 | 674, 816 | `first !== undefined` | Owned sparse row/cell/facet records and counters, table core lookup, action/stop indices and synchronous text normalization remain. Converting them in row/cell/facet loops would add allocations and requires a separate canonical-data design; not exemptions. |
| `packages/review/src/ReviewRegion.component.tsx` | normalise | 3 | 401, 464, 476 | `(filter === "auto" ? words.auto : words[filter]).toLowerCase` | Seven direct own optional-prop checks are genuine React edges (onShowMatching, explain twice, activity twice, readOnlyNote, onRetry). The derived importButtonNode check and three label lower-case calls remain unresolved owned rendering; no helper relabels them. |
| `packages/review/src/ReviewRegion.component.tsx` | absence | 8 | 524, 615, 626, 645, 722, 808, 869, 981 | `props.onShowMatching === undefined` | Seven direct own optional-prop checks are genuine React edges (onShowMatching, explain twice, activity twice, readOnlyNote, onRetry). The derived importButtonNode check and three label lower-case calls remain unresolved owned rendering; no helper relabels them. |
| `packages/review/src/internal/ReviewGrid.tsx` | absence | 21 | 134, 192, 319, 474, 567, 619, 773, 889, 915, 921, 937, 997, 1075, 1604, 1671, 1703, 1935, 1936, 1939, 1947, 1999 | `first === undefined` | Sparse cells/marks, column/choice/index lookups, fitting measurements, derived ReactNodes, and text trimming remain owned. Direct onKeep/onMatch props are actual React edges; table.getColumn/virtualizer results and getScrollElement nullable return are vendor edges. Per-row/cell callbacks and lookup paths are unchanged, so no Option allocation was added there. |
| `packages/review/src/internal/ReviewGrid.tsx` | fallback | 27 | 134, 176, 176, 187, 188, 269, 269, 270, 310, 312, 375, 470, 619, 621, 625, 689, 691, 739, 915, 1012, 1142, 1226, 1596, 1779, 1903, 1904, 1910 | `view.cells[first.id] ?? ""` | Sparse cells/marks, column/choice/index lookups, fitting measurements, derived ReactNodes, and text trimming remain owned. Direct onKeep/onMatch props are actual React edges; table.getColumn/virtualizer results and getScrollElement nullable return are vendor edges. Per-row/cell callbacks and lookup paths are unchanged, so no Option allocation was added there. |
| `packages/review/src/internal/ReviewGrid.tsx` | normalise | 1 | 328 | `mark.from.trim` | Sparse cells/marks, column/choice/index lookups, fitting measurements, derived ReactNodes, and text trimming remain owned. Direct onKeep/onMatch props are actual React edges; table.getColumn/virtualizer results and getScrollElement nullable return are vendor edges. Per-row/cell callbacks and lookup paths are unchanged, so no Option allocation was added there. |
| `packages/review/src/internal/ReviewGrid.tsx` | unwrap | 1 | 1733 | `O.getOrNull` | Sparse cells/marks, column/choice/index lookups, fitting measurements, derived ReactNodes, and text trimming remain owned. Direct onKeep/onMatch props are actual React edges; table.getColumn/virtualizer results and getScrollElement nullable return are vendor edges. Per-row/cell callbacks and lookup paths are unchanged, so no Option allocation was added there. |
| `packages/review/src/internal/browser.ts` | absence | 1 | 24 | `text === null` | Actual Storage.getItem null at the KVS adapter. The installed KeyValueStore requires string|undefined; storedJson returns Effect and preserves that third-party representation, legacy bare words, errors and causes. Candidate absence exemption, not approved. |
| `packages/ui/src/TableSearch.component.tsx` | normalise | 6 | 116, 126, 141, 141, 152, 152 | `after.value.text.trim` | Five search-trim calls and one KeyboardEvent key lower-case call are synchronous string policies. Browser strings are present; these are not nullable browser edges. Retained unresolved. |

`ReviewGrid` keeps 50 sites, `ReviewRegion.atoms` 19, `ReviewRegion.component` 11, TableSearch 6,
ImportPage 1 and the new review browser module 1: **88 total**. This remainder includes actual prop/vendor edges
and unresolved owned places; the table does not grant blanket exemptions to any of these files.

The changed canonical helper arguments are `noticesFromText`, `storedFromText`, `waitingFromText` (required Option
text) and `browserLocks` (Option capability). All source callers and the two forced draft fixture callers were
updated together. The read/remove transaction still removes a missing entry, and does not hand it over on either
read or remove refusal. Storage keys, lock names, selectors, codecs, encoded representation and screen words
remain unchanged.

### Browser boundary validation and limits

- Full `bun run check --env-mode=loose --continue=always` completed **103/105 tasks**, 76 cached, in
  **3m11.482s**. All code checks, strict ceilings, lint, tests and proofs passed. The two failures are the expected
  unapproved browser edge and a now-stale decreasing ledger entry below. Receipt: `/tmp/defaults-browser-final2-check.log`.
- Catalog web passed **401 tests in 38 files**, review **115 in 7**, client **58 in 12**, app **70 in 19**; catalog
  model passed **274 fast tests plus 5 proofs**. No test needed a second try. The final review-only code check
  also passed at **225/225** after localStore was tightened to treat an explicitly undefined platform storage as absent.
  Receipt: `/tmp/defaults-browser-review-final-check.log`. Other strict ceilings stay client 15, UI 39, catalog 148.
- The focused defaults command over all 25 changed TypeScript files fails only
  `packages/review/src/internal/browser.ts:24`, **one absence**: actual `Storage.getItem` null at the KVS boundary.
  The reader returns Effect and KVS explicitly requires `string | undefined` (`effect/src/persistence/KeyValueStore.ts`).
  Its exemption-ready path/kind/reason is above; no exemption or baseline was edited. Receipt:
  `/tmp/defaults-browser-focused-law.log`. The other 24 changed files hold to the existing baseline.
- The only additional required ledger decrease is **remove the keptStore.ts entry** from
  `packages/tooling/tool/cli/ledgers/dual.json`: its exported uncurried multi-argument refusal helper no longer
  exists there. That ledger is outside this lane's allowed file scope and remains unchanged. No increase is proposed.
- `bun run beep laws boundaries` passes all **27 workspaces**. Formatting the 25 changed TypeScript files and
  `git diff --check` pass. `bun run docs:check` passes with existing status-vocabulary warnings.
- Local mocked-platform probes passed storage unavailable/missing/empty/refused reads, exact legacy JSON words,
  error key/method/cause, missing browser globals, unavailable/acquired lock callbacks and held identity, exact
  query/ref/viewport/closest/dataset selectors, absent/empty URL parameters, absent drop data, React callback
  attached/detached node identity and the original cleanup function identity/invocation. Scratch receipts:
  `.scratch/browser-edges-probe.ts`, `.scratch/browser-inventory.ts`; inventory JSON is
  `/tmp/defaults-browser-inventory.json`. These are synthetic probes, not browser observations.
- Effect 4.1.5 source was inspected for Option null/undefined construction and map/flatMap/match/exists,
  Effect callback/try/undefined, and the KeyValueStore representation. No getOrThrow, runSync, decodeSync,
  encodeSync, function-local schema or fallback-only schema was introduced.

The final full command used temporary Bun/XDG/Turbo caches and Wrangler registry/log paths under `/tmp`, with
Turbo loose environment mode. Earlier attempts exposed the required helper signatures, nested pipe diagnostics,
React cleanup/undefined types and new helper strict findings; these were corrected. Earlier D1 attempts failed
writing `/home/elpresidank/.config/.wrangler/registry/beep-d1-test`; the final temporary registry run completed
with no D1 failure. The last full run has no failing code or test gate.

No browser was opened: Upload, Match, Review, Result and Items were **not seen on screen**. No dedicated
performance benchmark, `check:full`, hosted behavior or actual browser Worker was exercised. ReviewGrid row/cell
loops retain their original reads, callbacks and allocations; this is source inspection, not performance proof.
PLAN, defaults-baseline.json, Defaults.rules.ts/exemptions, the Verify lock, vendored files, stored data and
bun.lock remain unchanged. No .dev.vars was read or written, UPDATE_VERIFY_LOCK was not set, and no commit or push
was made. This lane does not declare the entire goal complete.

Needs the person: approval of the named browser absence exemption and the narrow dual-ledger deletion; remaining
owned sites and prior undecided defaults stay visible, without a new product decision in this lane.

## Catalog web tests second lane, PLAN row 11, 2026-11-26

Scope: `packages/catalog/web/test` including support modules. The initial explicit 46-file law run holds
84 places: 50 fallback, 34 absence, zero unwrap and zero normalization. Source, PLAN, baseline, exemptions,
stored fixture bytes and the Verify lock are outside this lane. These verdicts are written before test edits.

| Fields / owner | Verdict | Reason and intended form |
| --- | --- | --- |
| Review row problem; problem fix, rivals, choices, column; column metadata | Already canonical Options | Read the producer's Option directly. Expected presence narrows with vitest assertions; a real absent case stays whole in an Option match. No nullish wrapper around an Option or conversion to undefined. |
| Expected rows, proposals, deferred requests, atom answers and tab identities | Required test prerequisites | Assert presence before reading. A missing expected value fails the test rather than skipping an assertion or supplying empty data. |
| Registry stand-in member, asked and idle TTL configuration | Explicit optional configuration | Callers state Options, with named starting configuration; optional library properties use Record.getSomes. No function declaration schema. |
| Toast stand-in description and action | Dependency optional observations | Preserve exact recorded values and action presence. An unresolved empty-description policy stays visible rather than being relabeled as a decode. |
| Browser Storage getItem and lock options | Platform contract | Preserve null-on-missing and exclusive-by-default behavior; retain and name any conversion which cannot honestly clear under the no-unwrap rule. |
| Independent fold model counters, histories, sentinels and attribution | Independent oracle policy | Remove absence questions only where construction or whole cases eliminate them. Do not copy production decisions into the independent model or rename a fallback constant. Remaining policy sites stay unchanged and individually named. |
| Draft-world command selection and sparse histories | Real generated states | Required command arguments become explicit at callers. Sparse selections fold their complete cases; do not assert existence where generated absence is valid. |
| Cost digits | Required where an expectation expects a cost | Narrow the vendor/row at the assertion, then compare its required cost directly. Do not convert an Option back to undefined. |

No new product default, exemption, screen wording or stored representation is chosen. The final per-place
inventory and validation receipts will be appended to this section after implementation.

### Second test lane: final changes and retained places

The final 46-file reader holds **46 places: 27 fallback and 19 absence**, down from 84. The 38 removed
places are not a baseline edit. Each retained scanner occurrence follows below; none is an exemption or a claim
that the test lane reached zero. Files are relative to `packages/catalog/web/test/`.

Registry configuration now requires Options and an explicit retry flag; callers spread registryStart. The
server fixture states its organization and optional view, and the session mock carries its optional subscription.
All test getOrThrow reads now assert Some before reading the value at the original use site. Toast descriptions,
retry actions and request methods are observed as Options rather than invented empty text. The same supplied
text and action results remain asserted. Cost digits require a cost, with the expected vendor narrowed first.

The five save commands require which; every former omission now states last. Draft history starts with the
three fixture rows, each holding the actual initial decision. Absent revisions are compared in complete Boolean
cases; the 50-name limit still fails exactly when a present list exceeds 50. The minimized failing ordering must
still have a reason and now asserts that invariant. The original expectation predicates were reviewed in the diff;
no expectation was removed. Nullable conversions that remain wrap actual dictionary/array/library reads, not
already-Option review fields.

| File | Line | Kind | Example | Why retained / work still needed |
| --- | ---: | --- | --- | --- |
| `Conversation.test.ts` | 48 | fallback | `kept[key] ?? null` | Storage.getItem must return null for a missing key. Moving this into Option-to-null or a fallback-only schema retains the same unresolved platform conversion; no exemption was granted. |
| `KeptRows.test.ts` | 59 | fallback | `kept[key] ?? null` | Storage.getItem must return null for a missing key. Moving this into Option-to-null or a fallback-only schema retains the same unresolved platform conversion; no exemption was granted. |
| `KeptRows.test.ts` | 81 | fallback | `tab[key] ?? null` | Storage.getItem must return null for a missing key. Moving this into Option-to-null or a fallback-only schema retains the same unresolved platform conversion; no exemption was granted. |
| `ReviewHistory.test.ts` | 40 | fallback | `kept[key] ?? null` | Storage.getItem must return null for a missing key. Moving this into Option-to-null or a fallback-only schema retains the same unresolved platform conversion; no exemption was granted. |
| `ReviewHistory.test.ts` | 49 | fallback | `tab[key] ?? null` | Storage.getItem must return null for a missing key. Moving this into Option-to-null or a fallback-only schema retains the same unresolved platform conversion; no exemption was granted. |
| `ReviewModelFold.fold.test.ts` | 118 | fallback | `O.getOrElse` | An absent decision supplies the independent oracle’s undecided record before a patch. Needs an explicit initial row-state contract; a fallback-only decode would rename it. |
| `ReviewModelFold.fold.test.ts` | 367 | fallback | `O.getOrElse` | A sparse decision-text map supplies NO_DECISION. Needs a total text-state model or an Option through all oracle comparisons. |
| `ReviewModelFold.fold.test.ts` | 530 | fallback | `O.getOrElse` | The first answer for a sparse counter starts at zero. Needs counter initialization with the set of answer keys. |
| `ReviewModelFold.fold.test.ts` | 600 | fallback | `O.getOrElse` | No prior undo supplies change 0 and an empty writer. Needs an explicit not-yet-undone variant, not invented provenance. |
| `ReviewModelFold.fold.test.ts` | 657 | fallback | `O.getOrElse` | A stale screen with no recorded top change supplies zero. Needs the stale-screen comparison fields made total. |
| `ReviewModelFold.fold.test.ts` | 658 | fallback | `O.getOrElse` | A stale screen with no recorded undo change supplies zero. Needs the stale-screen comparison fields made total. |
| `ReviewModelFold.fold.test.ts` | 729 | fallback | `O.getOrElse` | A sealed stack without a third-last level supplies noLevel. Needs a stack-level union carried through undo bookkeeping. |
| `ReviewModelFold.fold.test.ts` | 762 | fallback | `O.getOrElse` | A stale screen with no recorded undo supplies zero. Needs an explicit absent undo comparison state. |
| `ReviewModelFold.fold.test.ts` | 765 | fallback | `O.getOrElse` | A row with no previous undo supplies change 0 and an empty writer. Needs an explicit undo-history case. |
| `ReviewModelFold.fold.test.ts` | 780 | fallback | `O.getOrElse` | An absent historical level supplies noLevel during stale undo. Needs the stack-level state carried through this path. |
| `ReviewModelFold.fold.test.ts` | 1018 | fallback | `O.getOrElse` | An unobserved answer category is counted as zero in coverage. Needs total category counters at construction. |
| `ReviewModelFold.fold.test.ts` | 1168 | fallback | `O.getOrElse` | An unseen actor supplies nobody and empty histories. Needs an explicit actor-state construction contract. |
| `ReviewModelFold.fold.test.ts` | 1169 | fallback | `O.getOrElse` | An untouched row starts at touch 0. Needs total row-touch initialization or optional touch comparisons throughout. |
| `ReviewModelFold.fold.test.ts` | 1186 | fallback | `O.getOrElse` | A missing decision supplies undecided to compare a touch. Needs both decision cases expressed through the independent oracle. |
| `ReviewModelFold.fold.test.ts` | 1323 | fallback | `O.getOrElse` | Redo with no produced undo uses its mirror. Needs the redo result contract to distinguish an unchanged/no-step result. |
| `ReviewModelFold.fold.test.ts` | 1328 | fallback | `O.getOrElse` | A redo without expected touches supplies an empty record. Needs the no-expectation case through Done bookkeeping. |
| `ReviewModelFold.fold.test.ts` | 1747 | absence | `O.isNone(press)` | No enabled generated press means skip this pick. This is real command selection; asserting presence would reject valid generated runs. Loop construction has not been redesigned. |
| `SessionAsked.test.ts` | 35 | fallback | `of[key] ?? null` | Storage.getItem must return null for a missing key. Moving this into Option-to-null or a fallback-only schema retains the same unresolved platform conversion; no exemption was granted. |
| `TabRows.test.ts` | 47 | fallback | `of()[key] ?? null` | Storage.getItem must return null for a missing key. Moving this into Option-to-null or a fallback-only schema retains the same unresolved platform conversion; no exemption was granted. |
| `TabRows.test.ts` | 96 | fallback | `options.mode ?? "exclusive"` | The LockManager stand-in implements the dependency’s exclusive mode on omission. Needs an explicit boundary/default judgment; a new fallback-only codec is not a clearing. |
| `TabRows.test.ts` | 134 | absence | `wait === undefined` | The optional browser-query gate returns immediately or waits for its held promise. Needs an Option gate throughout the stand-in; no new Promise code was introduced. |
| `TabRows.test.ts` | 219 | fallback | `O.getOrElse` | The test deliberately observes the pending tab identity as an empty string. Needs Option through every identity consumer and this pending-state expectation; a presence assertion was incorrect and was removed. |
| `TableAssistant.test.ts` | 23 | fallback | `kept[key] ?? null` | Storage.getItem must return null for a missing key. Moving this into Option-to-null or a fallback-only schema retains the same unresolved platform conversion; no exemption was granted. |
| `reviewParity.test.ts` | 116 | absence | `O.isNone(group)` | No eligible group ends the accept-all loop. A presence assertion would reject its intended terminal state; loop construction has not been redesigned. |
| `support/draftWorld.ts` | 798 | absence | `O.isNone(world.draft.held)` | Before a picture is held the settle command only dispatches. The oracle accepts this generated state; it cannot assert a held picture. |
| `support/draftWorld.ts` | 801 | absence | `line === undefined` | A requested row may have no line. The command skips that row; needs a selection model carrying only existing lines. |
| `support/draftWorld.ts` | 816 | absence | `O.isNone(side)` | A side requested by a generated pick may no longer exist. Needs a selected-side command variant, not an assertion on valid absence. |
| `support/draftWorld.ts` | 825 | absence | `O.isNone(side.value.refused)` | Refused and sendable sides execute different whole workflows. Needs the refusal case carried into the command model. |
| `support/draftWorld.ts` | 879 | absence | `O.isSome(world.draft.held)` | PressConfirm is valid only with a held picture and an open server. Needs an enabled confirm-command variant. |
| `support/draftWorld.ts` | 883 | absence | `O.isSome(confirm.answer)` | An answered confirm is ignored on a second server-take. Needs separate unanswered/answered confirm states. |
| `support/draftWorld.ts` | 917 | absence | `O.isNone(confirm.answer)` | A confirm whose answer has not arrived does nothing. Needs separate pending/answered confirm commands. |
| `support/draftWorld.ts` | 959 | absence | `O.isNone(world.draft.held)` | A Decide command before a held picture does nothing. Needs the command precondition represented in its state. |
| `support/draftWorld.ts` | 1034 | fallback | `O.getOrElse` | A match on a row with no recorded writer credits somebody else. Needs explicit initial writer provenance; a renamed sentence/default would hide the same policy. |
| `support/draftWorld.ts` | 1086 | absence | `O.isSome(save.answer)` | An answered save is ignored by another server-take. Needs separate pending/answered save states. |
| `support/draftWorld.ts` | 1091 | absence | `O.isNone(save.answer)` | An unanswered save has no answer to deliver. Needs the command to carry a delivered answer only in that case. |
| `support/draftWorld.ts` | 1103 | absence | `O.isSome(world.draft.landed)` | A landed draft changes which rows count as still live. This is a real compound oracle precondition; no Boolean alias was introduced. |
| `support/draftWorld.ts` | 1127 | absence | `O.isSome(save.answer)` | A signed-out refusal cannot replace an answer already recorded. Needs the unanswered save state in this command. |
| `support/draftWorld.ts` | 1135 | absence | `O.isSome(save.answer)` | An already answered save is not refused. Needs the unanswered save state in this command. |
| `support/draftWorld.ts` | 1230 | absence | `O.isSome(one.refused)` | A refused taken-up side must be recorded as refused. Needs the side’s refusal case carried through take-up construction. |
| `support/draftWorld.ts` | 1627 | absence | `command === undefined` | A generated kind may contain no command. The run ends there; needs nonempty command selection, not a required-value assertion. |
| `support/draftWorld.ts` | 1630 | absence | `O.isNone(O.liftThrowable(runIn)(world, command))` | A command that throws stops further generation so broken can report its failure. Needs an explicit command-result loop; it must not assert success and lose the minimized failure. |

The current reader additionally does not count these pre-existing forms in test files. They are explicitly
retained, not declared cleared: four numeric onNone policies in ReviewModelFold.fold.test.ts (lines 169, 501,
503, 1011: row/group change and part-count zero), two empty-record onNone policies in support/draftWorld.ts
(lines 845–846: no held server decisions/no landed changes), and four existing synchronous fixture decodes
(ItemEditor.test.ts item, DraftPicks.test.ts taken, KeptRows.test.ts taken, TakenBackWords.test.ts takenBack).
The numeric/record cases need total oracle state contracts. The fixture decodes and their pre-existing
schemaSync comments remain unchanged; no new synchronous codec, runner or diagnostics comment was introduced.
List folds use A.empty, and statement-bodied no-op branches supply no data.

### Second test lane: changed files

- `packages/catalog/web/test/ConfirmDraft.test.ts`
- `packages/catalog/web/test/Draft.machine.test.ts`
- `packages/catalog/web/test/DraftPicks.test.ts`
- `packages/catalog/web/test/DraftRegion.test.ts`
- `packages/catalog/web/test/DraftServer.test.ts`
- `packages/catalog/web/test/ImportPage.test.ts`
- `packages/catalog/web/test/ImportViewAnswers.test.ts`
- `packages/catalog/web/test/ItemColumns.test.ts`
- `packages/catalog/web/test/ItemEditor.test.ts`
- `packages/catalog/web/test/ItemImport.test.ts`
- `packages/catalog/web/test/KeptRows.test.ts`
- `packages/catalog/web/test/RefusedStorage.test.ts`
- `packages/catalog/web/test/ReviewDraft.test.ts`
- `packages/catalog/web/test/ReviewHistory.test.ts`
- `packages/catalog/web/test/ReviewRules.test.ts`
- `packages/catalog/web/test/SessionAsked.test.ts`
- `packages/catalog/web/test/SessionStandIn.test.ts`
- `packages/catalog/web/test/TabRows.test.ts`
- `packages/catalog/web/test/TakenBackWords.test.ts`
- `packages/catalog/web/test/UploadOwner.test.ts`
- `packages/catalog/web/test/reviewHonesty.test.ts`
- `packages/catalog/web/test/support/catalog.ts`
- `packages/catalog/web/test/support/cost.ts`
- `packages/catalog/web/test/support/draftWorld.ts`
- `packages/catalog/web/test/support/session.ts`

The only documentation edit is this appended section. No caller outside the test package was edited.

### Second test lane: verification and limits

- Final `bun run check` passed **105/105 tasks**, 80 cached, in **3m15.334s**. Catalog web passed
  **401 tests in 38 files**, with no retry. Receipt: `/tmp/catalog-tests-check-final.log`.
- The latest observation/cost adaptations also passed **29 tests in five files**, no retry:
  `/tmp/catalog-tests-observations.log`. The four independent generated draft properties passed a focused run
  (4,000 generated orderings, 56.02s), and the eight historical ordering regressions passed independently.
  Receipts: `/tmp/catalog-draft-props.log`, `/tmp/catalog-draft-orderings.log`.
- `bun run beep laws defaults` with all 46 explicit test/support filenames passed at **27 fallback, 19 absence,
  zero unwrap, zero normalization**. The separate changed-file run passed for all 25 changed TypeScript files.
  No write mode was used. Receipts: `/tmp/catalog-tests-law.log`, `/tmp/catalog-tests-changed-law.log`.
- `bun run format -- <all changed files>`, `bun run docs:check`, and `git diff --check` passed. The formatter
  reads the 25 TypeScript files and excludes Markdown; docs retains the existing status-vocabulary warnings.
- Newly used Option, Record and Array APIs were checked in Effect 4.1.5 under `node_modules/effect/src`, including
  lazy orElse, actual undefined-to-Option conversion, match, map, toArray, getSomes, dictionary lookup/update,
  and safe list lookup. The narrowing assertion signature was read in `@effect/vitest/src/utils.ts`.
- No getOrThrow, runSync, Option-to-undefined conversion, synchronous codec, Promise code, node:fs import or
  diagnostics comment was added. Existing synchronous fixture decodes are explicitly named above.
- The pending tab identity is a genuine optional state, not a required prerequisite. An initial attempt to assert
  presence in its general getter was removed; the unchanged pending-identity observation is retained and named.
  The final tab suite and full suite pass without retry. Intermediate fixture-typing/ledger failures were corrected
  within the authorized files. The readonly ledger stayed unchanged; the earlier ledger scope question is superseded.
- Read-only Git comparisons confirm no changes to source, PLAN, SPEC, defaults-baseline.json, tooling ledgers,
  exemptions, bun.lock, fixture snapshots or the Verify lock. No `.dev.vars` was read, UPDATE_VERIFY_LOCK was not
  set, and no commit or push was made. The tree remains dirty for the orchestrator.

Not run: `check:full`, the separate review-model fold project, slow D1 tests, Verify, a browser/on-screen import,
a real browser Worker, hosted behavior or deployment. The fold test file and its imported support were not changed.
No claim of zero test debt, approved edge exemptions, changed screen words or changed stored data is made.

Needs the person: nothing. The retained places are named follow-up work; no exemption or new product rule was chosen.

## Foundation modeling final lane, row 8, 2026-11-26

Written before source edits. Scope is the five owned CSV/XLSX facade and schema files still named by the
baseline: 17 places (3 fallback, 1 absence, 13 normalise). The eleven exempt internal readers, vendored kit,
PLAN, baseline and all ledgers remain outside this lane.

| Owner / field | Verdict | Intended boundary and form |
| --- | --- | --- |
| CSV separator regex captures | Required delimiter | Decode the successful regex tuple through a module-level capture schema; the expression guarantees the delimiter. Remove the fabricated comma and cast together. |
| CSV sparse record cell at encoding | Existing empty-cell policy, retained | `row[name] ?? ""` represents a missing record key in the output. A decode solely to supply empty text would disguise it. No new policy or exemption. |
| CSV parser trim setting | Required mode, retained | `options.trim` passes the parser mode; it asks no absence question and performs no trim. Leave the syntax-reader false positive unchanged. |
| CSV applyTrim cell | Mode-dependent cleanup, conditional on quoted status | A trim schema can own the operation, but this synchronous string-returning API is consumed by the exempt parser. Do not introduce a throwing/result/runner unwrap to extract a schema result. Retain the two calls if the boundary cannot move without that forbidden parser edit. |
| XLSX sheet lookup and uniqueness | Case-insensitive comparison keys | Module-level string schema owns lowercasing. Both sides decode through it, and Effect equality/hash compare the resulting keys without unwrapping an Option or changing written sheet names. Arbitrary uniqueness must use the same equality as the runtime check. |
| XLSX column letters | Parsed optional column | Module-level uppercase schema; compose its optional decode with the existing optional bounded-column parser. Preserve the existing length guard before case conversion, including non-ASCII case expansion. |
| XLSX records header | Empty/nonempty worksheet cases | Fold the first-row Option into the complete empty-record result or complete headed-record algorithm. No fabricated header. |
| XLSX parseResult | Existing synchronous public API, retained | `Effect.runSync` cannot become another runner, throwing decoder or renamed unwrap. Migrating its public return contract is not an agreed behavior change. |

No undecided data fallback moves onto a schema in this lane. Final remaining-place table, byte comparison and
validation receipts follow after implementation. The OKF skill applies to this appended documentation section;
existing document frontmatter and structure are preserved.

### Final-lane changes and remaining places

The final six-file scoped law reads **5 places: 2 fallback, 0 absence, 0 unwrap, 3 normalise**, down from the
five baseline files' 17. The XLSX property test holds zero. Twelve places cleared; no baseline was rewritten.
Every remaining scanner occurrence in the owned CSV/XLSX scope is in this table:

| File (relative to packages/foundation/modeling/) | Line | Kind | Count | Example | Why retained / required follow-up |
| --- | ---: | --- | ---: | --- | --- |
| `csv/src/Csv.codec.ts` | 113 | normalise | 1 | `options.trim` | Required parser-mode property read, not a cleanup call. Removing it changes reader configuration; changing its name merely to escape the syntax reader is forbidden. Needs the orchestrator's scanner judgment; no exemption added. |
| `csv/src/Csv.codec.ts` | 667 | fallback | 1 | `row[name] ?? ""` | Sparse records really encode a missing key as an empty CSV cell. Requires a coherent record/header boundary carrying missing cells through encoding; a schema used only to supply empty text is expressly forbidden. Existing value retained. |
| `csv/src/CsvOptions.schema.ts` | 264 | normalise | 1 | `quoted ? cell : Str.trim(cell)` | `applyTrim` returns a plain string synchronously to the exempt machine. Returning a schema result needs an API change through that reader, which this lane may not edit; extracting it with a runner/throwing decoder or renamed unwrap is forbidden. Existing unquoted-only rule retained. |
| `csv/src/CsvOptions.schema.ts` | 265 | normalise | 1 | `Str.trim(cell)` | Same boundary constraint for the all-cells trim case. It must move with the parser's cell boundary, preserving the selected dialect rule; no universal trim or new exemption. |
| `xlsx/src/Xlsx.codec.ts` | 318 | fallback | 1 | `Effect.runSync` in `parseResult` | Existing synchronous Result API over an Effect reader. Another runner/throwing decoder is forbidden; changing the public return contract is not authorized behavior. Retain pending an explicit API migration. The current reader categorizes this as fallback, despite the law's unwrap wording. |

`XlsxSheetNameKey` owns lowercasing and compares optional decode results with Effect equality/hash. It accepts
all strings, so typed string inputs always decode; no fallback or Option unwrap extracts a key. Workbook names
remain original strings. `uniqueBy` now uses Effect equality for numeric coordinates as well as these keys;
Effect's arbitrary unique-value generator was inspected and uses the same equality/hash for object keys.
The column-letter schema composes into the existing optional parser; the length guard still runs before Unicode
uppercase expansion. The CSV separator tuple validates the successful regex's complete required captures and
removes its impossible comma fallback and cast together. Empty XLSX worksheets fold to their complete records
result; headed worksheets execute their full original algorithm.

No caller outside the packages changed. Files changed:

- `csv/src/Csv.codec.ts`
- `xlsx/src/Xlsx.codec.ts`
- `xlsx/src/XlsxAddress.schema.ts`
- `xlsx/src/XlsxWorkbook.schema.ts`
- `xlsx/test/Xlsx.property.test.ts`
- this appended VERDICTS section (the only file outside the two packages).

No new undecided fallback moved to a schema; SPEC remains unchanged. The three pre-existing uncounted
missing-layout zero counters in `Xlsx.outline` remain as previously disclosed, not claimed cleared.

### Final-lane byte proof and checks

A temporary read-only comparison loads the four committed modules beside the current modules. It checked
**39 CSV cases** (36 separator/line-ending/trim combinations and 3 empty/sparse/header record encodings),
**16 complete XLSX ZIP-byte comparisons** (4 sheet names, stored/deflated, empty/headed), plus their parsed
values, records, layouts, streams and named-sheet selections, and **267 column-reference cases**, including
Unicode uppercase expansions and invalid references. All compared equal. Receipts and reproducer:
`/tmp/defaults-modeling-final-proof/compare.ts`, `before-*.ts`, `result.log`.
This is bounded byte evidence, not a claim that arbitrary XLSX read/write reproduces its original input archive:
this writer is intentionally by-value and canonicalizes unsupported parts as documented before this lane.

Package suites pass: **CSV 31 tests in 4 files; XLSX 95 tests in 5 files**. The round-trip tests are
CSV `decode(encode(t)) = t` for all four delimiters and CRLF/LF (also asserts the rewritten text equals the first
encoding) and `the Schema codec round-trips`; XLSX `is its canonical form`, `is the same stored or deflated`,
`does not move under a second pass`, and `bytes to a workbook and back, as one Schema codec`, with the two-way
SheetJS oracle properties. XLSX's existing round-trip tests prove values; the separate committed/current comparison
above proves unchanged complete output bytes for the named bounded cases. Added checks cover key arbitrary
validity, Unicode comparison, refusal of duplicate names differing by case, and retention of the original name
through an actual encode/read. Both package type checks pass.

Effect 4.1.5 source checked: Schema tuple/decoders/decode transformation, SchemaTransformation case conversion,
Option flatMap/match, Array head/dedupeWith, Equal equality, MutableHashSet membership and the internal arbitrary
unique-value equality/hash. No synchronous decoder/encoder, runtime runner, fallback-only schema, function schema,
closure-default schema or Option-to-undefined conversion was introduced.

Final `bun run check --env-mode=loose --continue` completed **104/105 tasks**, 66 cached, in **2m50.352s**.
Its **only failure is the permitted ledger decrease**: `csv/src/Csv.codec.ts` now has **8** type assertions,
while `packages/tooling/tool/cli/ledgers/assertions.json` still records **9**. The removed separator cast accounts
for the decrease; the ledger is untouched. All other 104 tasks passed, including the repository-wide defaults
law, both package suites, all type checks/lints, catalog web **401 tests in 38 files** with no retry, and the
existing proof tasks. Receipt: `/tmp/defaults-modeling-final-check-final.log`. Temporary Bun/XDG cache paths
under `/tmp` were used. An intermediate direct `_tag` comparison in the added test was corrected to
`Result.isFailure`; the final tags law and full run pass that gate.

`bun run beep laws defaults` with the six explicit source/test files passes at the five places listed above.
`bun run format -- <changed files>`, `bun run docs:check`, and `git diff --check` pass; Markdown is excluded by
the formatter and covered by the docs check, whose existing status-vocabulary warnings remain.
Read-only Git comparisons confirm no diff in PLAN, SPEC, defaults-baseline.json, the Verify lock or tooling
ledgers. No internal reader/writer, fixture, vendored file, stored data, exemption or caller outside the packages
changed. No .dev.vars was read, UPDATE_VERIFY_LOCK was not set, and no commit or push was made; the tree is dirty.

Not run: `check:full`, the separate slow D1/Verify/fold/build gates, a browser import/Confirm, a real browser Worker,
hosted behavior or deployment. Not seen on screen. The byte comparison is local and bounded; it does not replace
an on-screen 155-item acceptance run. This lane does not claim zero foundation places or the whole goal complete.

Needs the person: nothing. The five retained places are follow-up work, not newly approved exemptions or policies.
