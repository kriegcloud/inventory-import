---
type: Code Patterns
title: Patterns
description: Code and notes for cases in this stack that are easy to get wrong (D1, the API contract, the model, workbooks, accessibility).
tags: [effect, cloudflare, ai, accessibility]
---

# Patterns

Code and notes for cases in this stack that are easy to get wrong. `CLAUDE.md` points to each one at the moment it is
needed. The code in patterns 1, 2 and 4 passed `bun run check` in this repo, and patterns 1, 9 to 15 name the file
that runs it: paste, adapt the names, then run `bun run format -- <your files>` (only yours: a bare run rewrites every
lane's files). A name a pattern does not trace to a file (`Item`, `RecordNotFound`, `records.find`) is an
illustration and is not in the tree.

They are about the platform and its libraries (D1, the API contract, the model, workbooks), not about any feature.
Patterns 9 to 14 are the server's settings, problems as data, logs and errors, tenancy in SQL, tests and the API
reference. Patterns 15 and 16 are about the import's own shape: taking an import back, and a file row that holds
several records.

## 1. Writing many rows once: an idempotent batch

D1 has no interactive transactions and allows 100 bound parameters per statement. One batch of single-row statements
is atomic (every row lands or none does), and `ON CONFLICT ... DO NOTHING RETURNING` tells you which rows were new,
so a repeated request adds nothing and says how many were already there. The working version is the import's
confirm (`commit` in `packages/catalog/host/src/ImportStore.adapter.ts`), tested on D1 in `test/server/Imports.slow.test.ts`: its records go in
500 to a statement as one JSON value read with `json_each` (a handful of bound values however many rows), each
statement `ON CONFLICT (organizationId, codeKey) DO NOTHING`, and a row counts as created only when its record is
there afterwards. The smaller shape, one statement per row, is below.

A statement that needs a whole list at once (does any of these 50,000 rows differ, are all these items still as read)
cannot bind one value per piece of it: 100 values are soon passed, and one value holds at most 2 MB. Its batch first
puts the list into `importWriteList`, a piece to a statement, the statement reads it back with `json_each` (three bound
values however long it is), and the batch's last statement deletes it (`putPiece` and `inList` in the same adapter;
tested at 50,000 rows in `test/server/WriteLimits.slow.test.ts`, which counts what every statement binds).

In the Layer: `const sql = yield* D1Client.D1Client`. In the migration, the natural key is
`TEXT NOT NULL COLLATE NOCASE` with `UNIQUE (organizationId, code)`, so case variants are one key. Rows go in and come
out through the model's Schema (pattern 12 for the table).

```ts
const encodeRow = Schema.encodeEffect(Item.insert) // Item: a Model.Class like Activity
const decodeRows = Schema.decodeUnknownEffect(Schema.Array(Item))
const insertOnce = (row: typeof Item.insert.Encoded) =>
  sql`INSERT INTO item ${sql.insert(row)} ON CONFLICT (organizationId, code) DO NOTHING RETURNING *`

const load = Effect.fn("Items.load")(function* (actor: Member, codes: ReadonlyArray<string>) {
  // The id and the time come from the insert variant's defaults (a UUID, and the Clock's now).
  const rows = yield* Effect.forEach(codes, (code) =>
    Effect.flatMap(Item.insert.makeEffect({ organizationId: actor.organizationId, code }), encodeRow)
  )
  const results = A.isArrayNonEmpty(rows) ? yield* sql.batch(A.map(rows, insertOnce)) : [] // atomic
  const written = yield* Effect.forEach(results, (stored) => decodeRows(stored))
  const created = A.filter(written, (stored) => stored.length > 0).length
  return { created, alreadyThere: codes.length - created }
}, Effect.orDie)
```

Put the `Activity` row in the same batch, so the audit trail cannot disagree with the data. When the rows have no
natural key, the request does: the browser makes one id per Confirm (`newRequestId()` in `src/web/lib/api.ts`), and
each row's key is that id and its line number. Every statement goes through a Schema both ways: `D1.statement`,
run with `run` or `batch` of the `D1` service (`@beep/d1/D1`), for a write; `SqlSchema` for a read.

## 2. An endpoint with a path parameter and more than one failure

```ts
HttpApiEndpoint.get("record", "/records/:code", {
  params: { code: Schema.String },
  success: Record,
  error: [RecordNotFound, Forbidden] // each a Schema.TaggedError with httpApiStatus
})

// in handlers.handleAll({ ... }), with `records` resolved above handleAll
record: Effect.fn("records.record")(function* ({ params }) {
  const actor = yield* requireRole("viewer")
  const found = yield* records.find(actor.organizationId, params.code) // your service, returns an Option
  if (Option.isNone(found)) return yield* RecordNotFound.make({ code: params.code })
  return found.value
})

// web: one read per code, each an atom made once and kept by its key (`perKey` from `@inventory/client/Api`)
const record = perKey((code: string) => catalogApi.query((api) => api.items.record({ params: { code } })))
// in the screen: useAtomValue(record(code)), an AsyncResult with the endpoint's own failures
```

## 3. Calling a model

Model I/O is `effect/ai` with `@effect/ai-openrouter`, behind the `OpenRouter` service of `@beep/openrouter`
(`packages/drivers/openrouter`); the app meets it in `src/server/Model.ts`. The AI modules ship inside `effect`
(`effect/ai`): there is no `@effect/ai` package. Check `node_modules/effect/src/ai/` and
`node_modules/@effect/ai-openrouter/src/` before writing model code.

- For one structured answer use `askModel(openRouter, { name, prompt, system, schema, maxOutputTokens })` from
  `src/server/Model.ts`, with an Effect `Schema.Struct` whose root is an object (OpenRouter's codec refuses any other
  root). The same Schema tells the model the shape and decodes the reply. It returns an answer (`value`,
  `answeredBy`) or fails with `AiUnavailable`, never throws. Resolve `const openRouter = yield* OpenRouter` in the
  Layer or the handler group's constructor, not in the request.
- **Which one answered.** `answer.answeredBy` names the provider and the model that answered, and `fallback: true`
  when a fallback model did. End every AI feature with `answeredByRules((error) => rulesResult)`: when no model can
  answer, the feature's own rules do, and `answeredBy` is `{ _tag: "Rules", reason }`. Show it on screen.
- **One retry policy, in the driver.** `ModelPolicy` (`@beep/openrouter/OpenRouterConfig`): each attempt has a 15 s
  timeout; a transient failure (rate limit, provider error, broken connection) is tried again twice at most, with
  `Schedule.exponential` and `Schedule.jittered`; a refused key or an answer that does not fit is never tried again;
  a 40 s deadline bounds the whole call. OpenRouter's `models` list (`AI_FALLBACK_MODELS`) falls back inside one call,
  then the rules answer. Do not add a retry around `askModel`: that would be a second policy. The plan has one step on
  purpose: a step whose `while` refuses hands over to the next one, which would re-ask after a bad answer.
- **Errors**: `AiUnavailable.reason` is the contract's sentence for its `kind` (`modelSentences` in
  `packages/catalog/contract/src/Answer/AiUnavailable.rejection.ts`), the same five sentences every screen shows; the driver's `ModelUnavailable.trouble`
  is mapped to it by `aiUnavailableOf`. An empty OpenRouter credit (HTTP 402) is `refused`. The provider's own words
  are logged once per failed attempt (`ai.detail`), never sent to the screen.
- The driver has no streaming or tool-calling call: nothing uses one. Adding one is a driver change (a method beside
  `generateObject`, under the same `ModelPolicy`), not a direct `LanguageModel` call in a feature.
- Send the model the minimum: headers and digested values (next point), never a whole file or raw rows. Batch
  questions into one call.
- **Give a small model digested input.** Send distinct values, counts and three examples per column, already
  grouped, not raw rows. A small model can misread raw dates, and reads them right once they are grouped by how
  they could be read. Ask it to explain or pick, never to count. A different size or colour is not a match
  (null). Drop any key it returns that is not in your list.
- `OPENROUTER_API_KEY` in `.dev.vars` is the OpenRouter key, the one provider. `AI_ENABLED=false` turns AI off with a
  key set (in development, appended to a backed-up `.dev.vars`: `CLAUDE.md`, "Running with AI turned off"). Pattern 9 for settings.
- Tests script the model with `@beep/openrouter/OpenRouterTest`: `off("noKey", model)`, `scripted(replies, { model })`
  (replies or `AiError`s played in order through the real call path, with an attempt count), and `overHttp(settings,
  respond)` (OpenRouter's real client over a scripted transport), as the driver's own `test/OpenRouter.test.ts` does
  for retry then succeed, give up, a bad answer asked once, the timeouts and HTTP 402.

## 4. A model suggestion that cannot invent a key, and works without a key

The model picks from a list you give it. Anything it returns that is not in the list is dropped, and with no AI key
the rules answer ("no suggestion") and the caller carries on. Goes in the handler group constructor, after
`const openRouter = yield* OpenRouter`; `askModel` and `answeredByRules` come from `src/server/Model.ts`.

```ts
const Match = Schema.Struct({ code: Schema.NullOr(Schema.String), reason: Schema.String })

const suggest = Effect.fn("records.suggest")(function* (line: string, codes: ReadonlyArray<string>) {
  const answer = yield* askModel(openRouter, {
    name: "match",
    schema: Match,
    prompt: `Line: ${line}\nKnown codes:\n${A.join(codes, "\n")}`,
    system:
      "Suggest a code only when it is the same thing: same type, size and pack. " +
      "A near miss is NOT a match: answer null and say which code is close and how it differs."
  }).pipe(answeredByRules((error) => ({ code: null, reason: `No suggestion: ${error.reason}` })))
  const known = answer.value.code !== null && A.contains(codes, answer.value.code)
  return { ...(known ? answer.value : { code: null, reason: answer.value.reason }), answeredBy: answer.answeredBy }
})
```

## 5. What a call cost, and tool loops

- **What a call cost.** OpenRouter reports dollars per call on the finish part (`metadata.openrouter.usage.cost`);
  the driver turns it into `ModelAnswered.usage.costMicroUsd` (an `Option`: `None` when OpenRouter did not say).
  Measured on `anthropic/claude-haiku-5.5` with the earlier SDK: one structured answer took about 1.6 seconds.
- **Tool loops.** The driver offers none (above). `effect/ai`'s `Toolkit` with `LanguageModel.generateText` is the
  shape one would take, added to the driver under `ModelPolicy`; run such a loop inside the request, write one row
  per step, and let the page poll.

## 6. Model-written HTML, and an Effect route beside the HttpApi

Serve model-written HTML from a Worker route with its own policy (`Content-Security-Policy: sandbox allow-scripts;
default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; base-uri 'none';
form-action 'none'; frame-ancestors 'self'`) in an `<iframe sandbox="allow-scripts">`, never with
`allow-same-origin`. `srcdoc` and `blob:` inherit this app's `script-src 'self'`: they work in `bun run dev` (which
applies no policy) and are blocked in `bun run preview`. `security.ts` must give that route its own headers. The
frame gets data only by `postMessage` to the host, which checks `event.source` and an allow-list and calls the API as
the current actor. `withSecurityHeaders` in `security.ts` already gives one route its own policy: the API reference page
(pattern 14) gets a policy that allows its two inline scripts by hash. Copy that branch for a frame route, keyed on
its path.

A route beside the HttpApi (a frame document, a stream):
`HttpRouter.use(Effect.fn(function* (router) { const s = yield* Service; yield* router.add(...) }))`, aliased
`const withRouter = HttpRouter.use` so the linter does not read it as a React hook, and merged beside the HttpApi in
`makeRoutes` in `src/server/App.ts` (the Worker and the tests both build from it). Give it a path under `/api/v1`.

- **Which model can write a whole page.** Measured through OpenRouter, five different view requests each, the output
  checked for a script that parses, uses only the host helper and finishes: `anthropic/claude-haiku-5.5` 5 of 5,
  about 7 seconds and 3,100 characters each, half a cent for all five. A smaller model managed 1 of 5.
  This measures a page that runs, not one that shows the right rows: check the numbers against a query you trust.

## 7. Reading a spreadsheet (.csv and .xlsx)

The reader exists; do not write another. A file the person chooses is read by setting the `startUpload` atom to it
(`@inventory/catalog-web/Upload`, [the kit](kit.md) "Steps and upload"): a module worker runs the reader, so the page never freezes, and
the screen shows its progress and Cancel. Inside the worker and in tests, `readSpreadsheet({ file, sheet?,
onProgress? })` from `@inventory/catalog-web/Spreadsheet` returns an `Effect<SpreadsheetTable, FileProblem>` (shapes in
`packages/catalog/model/src/Reading/Spreadsheet.rules.ts` and `packages/catalog/contract/src/Staging/FileProblem.read.ts`): `columns` (header as found, a
unique `label`, the file's column `letter`), `rows` (each with `rowNumber` as Excel shows it, and one `Cell` per column:
`type` text, number, date, boolean, empty or error, and `text` with nothing coerced), `headerRowNumber`, `format`
(CSV delimiter and encoding, or every sheet and which one was chosen and why) and `notes`: what was skipped or needs a
look, as sentences to show. A file that cannot be read is a `FileProblem`, data and not an error: its `kind`, `problem`
(what is wrong, naming the file) and `todo` (what to do), shown as they are under `fileProblemTitles[kind]`. Cases
and tests: `packages/catalog/web/test/readSpreadsheet.test.ts`.

```tsx
const state = useAtomValue(uploadState)   // Idle -> Reading -> Saving -> Preparing, or Cancelling, Refused, Failed
const start = useAtomSet(startUpload)
const cancel = useAtomSet(cancelUpload)
start({ file, onEnd })                    // returns at once; `onEnd` hears how it ended (an `UploadEnd`: Arrived,
                                          // Cancelled, Refused or Failed, told apart with `UploadEnd.$match`).
                                          // Another sheet of a workbook: `start({ file, sheet })`
// "Refused": state.problem is the file's FileProblem (what is wrong, what to do)
// "Failed": the reader or the sending broke; the state says so in words
```

- **Cell text.** Numbers are plain decimals at Excel's 15 digits (`0.1+0.2` is `"0.3"`, money stays `"12.5"`, so read
  cents from the digits); `shown` is what Excel displays (`"$12.50"`, `"00123"`): use it for codes. Dates are ISO from
  the stored date (`"2026-03-04"`), never from a display format. CSV cells are always text: deciding what
  `"03/04/2026"` means is the app's question for the person.
- **Lazy, and off the page's thread.** The CSV reader (`@beep/csv`) and the workbook reader (`@beep/xlsx`) are in the
  reader worker's own files, fetched only when a file is chosen. Both are this repository's own packages: no
  third-party parser runs in the browser. `@beep/xlsx` reads the archive and its XML with Effect's `Zip` and `Xml`,
  expands no entity, and stops a file that unpacks past 64 MB.
- **Progress.** A CSV is parsed in pieces of 256 KiB (`Csv.parseBytesInPiecesResult`), giving the same rows, Notes and
  delimiter as parsing it at once (`packages/catalog/web/test/csvDifferential.test.ts`, every piece size from 5 characters), with a row
  estimate from how much text is read; a workbook says "Opening the file" while every sheet is counted, then reads the
  chosen sheet against that exact count.
- **Limits.** CSV 10 MB, .xlsx 3 MB and 64 MB unpacked (a 7-column export of 36,000 rows is 3.0 MB and reads in
  0.5 s). `.xls`, `.xlsb`, `.ods`,
  password-protected files and PDFs are refused with what to do instead. Hidden rows, columns and sheets, merged
  cells, formulas and error cells are read and named in `notes`.
- **Samples.** `public/samples/items_messy.csv` (200 items, with the mess the review exists for) and
  `items_clean.csv` (25 items that import as they are). Link: `<a href="/samples/items_clean.csv" download>Download
  the clean sample</a>`.

## 8. Screens that pass an accessibility audit

Measured with Lighthouse on a 150-row import review built from this repo's components. Each rule is something that
screen was marked down for.

- **Every control has a name.** Inputs, file inputs and `SelectTrigger` get `<Label htmlFor>` and an `id`; text beside a
  field is not a label. An icon-only button takes `aria-label` with the action and the row ("More actions for Rolled
  oats 1").
- **Repeated row buttons say which row**: keep the visible verb and add the row in `sr-only` (`Accept<span
  className="sr-only"> kg for {name}</span>`). Never an `aria-label` that drops the visible words.
- **Headings step down one level**: one `h1`, then `h2`. A word over a control is a `Label`, not an `h3`.
- **Tables say what they hold**: `TableCaption className="sr-only"`, the name cell is `<TableHead scope="row"><span
  className="font-semibold text-foreground">` (the design lint keeps classes off the component), and every column has a
  header, `<span className="sr-only">Actions</span>` over row buttons.
- **A table wider than a phone is a focusable region**: wrap `Table` in `<div role="region" aria-label="…" tabIndex={0}
  className="overflow-x-auto [&>[data-slot=table-container]]:overflow-visible">` so arrow keys reach every column.
- **Text on a tint is that tint's `-foreground`.** Red text on `bg-danger` passes only with this patch (4.6:1); check
  the dark theme too.
- **What colour or weight shows is also in the markup**: `aria-current="step"` on the current step, `aria-pressed` on
  saved views.
- **Nothing reads layout in the first render** (`getComputedStyle`, `offsetWidth`): one read cost 70 ms of blocking time
  here. No request fails on load: a 404 or 401 is a console error.
- **After each screen, `bun run lighthouse -- /path`**: Accessibility, Best Practices and SEO are 100; mobile
  Performance in the mid-90s is this machine, desktop below 100 is a finding.

## 9. Settings and secrets

Every setting and secret the server reads is an `effect/Config` in `src/server/Settings.ts`, read through one
ConfigProvider the Worker builds from its `env` (`worker.ts`). Nothing else reads `env` or `process.env`.

- **Add a setting**: declare it in `Settings.ts` (`Config.Redacted` for a secret, `Config.withDefault` when it may be
  absent, `Config.schema(Schema.Literals([...]))` for a fixed set), list it with its valid values in
  `.dev.vars.example`, type it in `src/server/env.d.ts`, and give a non-secret default in `wrangler.jsonc` `vars`.
  The Layer that needs it reads it: `const settings = yield* aiSettings`.
- **A secret is opened once**, where it is used (`Redacted.value(key)` in `routesFrom`). Logged or printed, a
  `Redacted` reads "<redacted>" (`test/server/Observability.test.ts` proves it).
- **A feature that needs a key is off without one, and says why**: `AiStatus.reason` is the model's example. A bad
  value stops the app with an error naming the variable and its valid values.
- **Tests set settings the Worker's way**: `settingsLayer({ ... })` in `test/server/support/app.ts`.
- **The browser reads only public `VITE_*` flags**, in one place: `publicSettings` in `src/web/lib/settings.ts`.
  Vite compiles them into the bundle, so they are never secret.

## 10. Problems in a person's data: returned as data, all at once

A file, a pasted list or a form the person filled is data. What is wrong in it is an answer the screen shows beside
the row, never a 400 or a 500. The import shows the whole shape.

- **The payload bounds sizes only** (`StagedRow`, `UploadChunk`: every string `Schema.isMaxLength`, every number
  `Schema.Int` or `Schema.Finite`, a chunk at most 500 rows), looser than the rules, so an odd value reaches the
  review instead of failing the request.
- **A file that cannot be staged is a `FileProblem`** (`packages/catalog/contract/src/Staging/FileProblem.read.ts`), answered with 200 inside a
  `StagingOutcome` by each upload step, so the screen titles it by kind wherever it was found.
- **A pure review states the rules** (`review` in `packages/catalog/model/src/Review/Review.rules.ts`): for every row its status, its
  problems in order, each a sentence naming the column and the value, and what the rules propose. The browser's
  review screen and the server's confirm run the same function, so a crafted request cannot write a row the screen
  refused (`test/server/Imports.slow.test.ts`, "writes only what the review says is ready").
- **Every row is reviewed, whatever the others hold**, and the confirm's result says what happened to every row, read
  back from what is stored (`ImportResult`).
- **Request validation says every field at once too**: the `Api` sets `HttpApi.PayloadParseOptions` to
  `{ errors: "all" }`, so a 400 problem document lists every wrong field, and a field a person can leave out carries
  `Schema.annotateKey({ description, messageMissingKey })`, whose sentence is the message for that field.

## 11. Logs, errors and spans

- **Log with `Effect.logInfo`, `logWarning`, `logError`**, never `console`, and annotate with ids
  (`Effect.annotateLogs({ "import.id": id })`). `LOG_LEVEL` and `LOG_FORMAT` choose what is written and how
  (`src/server/Observability.ts` lists the valid values).
- **No personal data or secrets in a log line or a span**: ids, never names, file contents or a person's input; a
  secret is a `Redacted`. A typed error's `reason` is for the person and may name their organization, so it is not
  printed by the reporter; put what a developer needs in a log line where the failure happens (the `OpenRouter` service logs
  the provider's words as `ai.detail`).
- **Failures are reported once, by the HTTP layer**, to `logReporter`: a defect at Error with its stack
  (`Cause.pretty`), a typed failure at Info. A defect is a bug: never catch it to hide it.
- **Every service method is `Effect.fn("Service.method")`**, a span. The identity middleware stamps every span and
  log line inside a request with `organization.id` and `actor.id` (`Effect.annotateSpans`), so traces need no
  arguments for it (`test/server/Spans.test.ts`).
- **Effect DevTools** works in the browser in development (`VITE_EFFECT_DEVTOOLS=true`), in the Worker in development
  (`EFFECT_DEVTOOLS_URL` in `.dev.vars`: one client per request, finished after the answer under `waitUntil`, in
  `src/server/RequestTelemetry.ts`, which has the measurements) and in the Node tests
  (`EFFECT_DEVTOOLS_URL=ws://localhost:34437 bun run test`). Never a client built once for the isolate: inside the
  Worker it goes silent after the first request.

## 12. Tenancy in SQL

Every tenant table has `organizationId`, every index on it starts with it, and a child row names its parent by
`(organizationId, id)`, so the database refuses a child that points into another organization, whatever the code
does. `migrations/0001_init.sql` does it for every tenant table (`member`, `activity`, the import tables, `record`).

```sql
CREATE TABLE importDraft (
  id TEXT PRIMARY KEY,
  organizationId TEXT NOT NULL REFERENCES organization (id),
  fileName TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  UNIQUE (organizationId, id) -- what a child's foreign key points at
);

CREATE TABLE importLine (
  id TEXT PRIMARY KEY,
  organizationId TEXT NOT NULL,
  importId TEXT NOT NULL,
  lineNumber INTEGER NOT NULL,
  FOREIGN KEY (organizationId, importId) REFERENCES importDraft (organizationId, id),
  UNIQUE (organizationId, importId, lineNumber)
);
```

SQLite cannot add a foreign key with `ALTER TABLE`: get it right in the table's first migration.
`test/server/Tenancy.slow.test.ts` reads the schema itself: every table with `organizationId` is checked for its indexes
and its foreign keys, so a new table joins it without editing a list. The actor and the organization come only from
`CurrentActor`, never from a payload, a header or a URL.

## 13. Tests

- **Rules in handlers and middleware** (roles, payloads, headers): fast, on in-memory storage. A typed client:
  `HttpApiTest.groups(Api, [...])` with `inMemoryHandlers` (`test/server/Spans.test.ts`). The real HTTP path with
  headers, through the Worker's own `fetch`: `send({ path, actingAs, body, headers })` with `inMemoryApp`
  (`test/server/Security.test.ts`).
- **SQL**: on a real D1 database with the real migrations, `TestApp` or `TestDatabase` from
  `test/server/support/app.ts`. These start workerd, so the file is `*.slow.test.ts`.
- **A pure rule with many inputs**: a property test, `it.prop(name, [Schema, ...], ([a, ...]) => ...)`, inputs generated
  from the Schema itself (`packages/catalog/model/test/ItemSearch.test.ts`, `TableView.test.ts`). Raise `size` until the generator
  reaches the rule's limits.
- **Anything timed** (retries, timeouts, polling): the `TestClock`, never real waiting. Fork the work, then move the
  clock; `settle` in `test/server/Ai.test.ts` does it for work that also waits on a promise.
- **Not** a test that repeats what the types already prove.

## 14. The API reference

The contract is versioned: it is served under `/api/v1` from `src/api/v1/`. Routes a library owns (sign-in's
`/api/auth/*`) are never versioned. The OpenAPI document is generated from the contract at `/api/v1/openapi.json`, in
development and in production. A development build also serves the API reference page (Scalar) at
`http://localhost:5173/api/v1/docs`, from the bundled script under its own content security policy; a production
build has no such page, and does not carry Scalar's 3 MB. The descriptions there are the `.annotate({ description })`
on each schema and field: write them for the person who reads the page. An `annotateKey`'s `messageMissingKey` words
the 400 for a missing field and does not reach the page. A description on the decoded side of a schema that
transforms (a trim, digits to a number) does not either: put it on the wire side with `Schema.annotateEncoded`.

- **Every endpoint** has an `OpenApi.Summary` and an `OpenApi.Description`: what it does, what is safe to send
  again, what answers 200 with a problem as data, and the role a write needs ("Needs the editor role"). Every group
  has an `OpenApi.Title` (the tag a person reads; the operation id stays `group.endpoint`) and a description, and a
  success that is a bare array or struct carries its own description, or the page says only "Success".
- **Names**: a struct used in more than one place gets `identifier` in its `.annotate`, so the document holds it once
  as a component. Not on the schema a model is shown (`ViewCommand` and its changes): a model gets inline shapes.
- **Fields**: a moment is `instant("When ...")`, a person's name `personName("Who ...")` and an error's reason
  `reasonForPerson` (`packages/catalog/contract/src/internal/Described.ts`); `examples` come from the sample file and the seeded accounts.
- **What only the document can say** is in `src/api/v1/Document.ts`, an `OpenApi.Transform` on the `Api`: the session
  cookie as the security scheme, required on every operation that can answer 401; component names without Effect's
  `Encoded` suffix; and no 403 `CrossSiteRequest` on a GET or 400 on an operation with no input, which the server
  can never send. It changes the document only, never a route or a payload.
- **A second version** is a folder `src/api/v2/` with its own `Version.ts`, an `HttpApi.make` id of its own, and its
  `HttpApiBuilder.layer` beside v1's in `makeRoutes`. `openApiPath` and `docsPath` are built from `apiPrefix`, so a
  copy of the folder changes one line; its reference page must be added to the policy in `security.ts`, or it loads
  nothing. Mark what it replaces in v1 with `OpenApi.Deprecated`.

## 15. Taking an import back (undo after Confirm)

A confirmed import can be taken back while the records it created are unchanged. The import has the whole shape:
`POST /api/v1/imports/:id/commit` is the Confirm, `POST /api/v1/imports/:id/take-back` the take-back, and the Result
step (`packages/catalog/web/src/ResultStep.screen.tsx`) says what it will do and shows what it did. Files:
`migrations/0001_init.sql` (`importBatch`, `record.batchId` and `revision`), `packages/catalog/host/src/ImportStore.adapter.ts` (`commit`,
`takeBack`, the `TakeBackState` in each view), `packages/catalog/host/src/ItemStore.adapter.ts` (`edit`), `test/server/Imports.slow.test.ts`.

- **Each Confirm is a recorded batch.** One `importBatch` row per Confirm; each record it creates names it
  (`batchId`) and starts at `revision` 1. Records, outcomes, changes, the audit line and the import's status are one
  atomic batch, and every statement checks that the import is still open, so a second Confirm writes nothing.
- **A save names what its decisions were made on.** `PUT /api/v1/imports/:id/decisions` takes `SaveRequest`: the
  rows whose decision is new or taken back, and `madeOn`, for each row of `set`, the draft's revision the screen held
  when that row was last decided (a key that names no row of `set` is not read). Each column choice records the first
  revision that has it (`MappingChoice.at`) and each match the fields it moved (`ColumnMove`); every row is judged on
  its own revision by `withoutStaleDecisions` (`packages/catalog/model/src/Import/Rematch.rules.ts`), and a part of
  its decision that rests on a column matched again since is not applied, of four kinds: an accept or an undone fix
  of that field (`accept`, `undo`), a Replace, Keep-stored or keep-one-of-two after the SKU's column (`stored`,
  `twin`), a Replace or Keep-stored after another column where the row now compares otherwise with its stored item
  (`stored`). The rest of the row's decision is applied, and the answer names each part in `notApplied` by row, field
  and kind. A confirm carries the same `madeOn` for the rows it carries, and is refused whole (`AcceptsTakenBack`,
  409) when any part of one of them would not be applied.
- **A match takes back what rests on the columns it moves, and keeps what it took.** The same rule, on the stored
  decisions as if each was made on the revision before the match, in the match's own atomic write; what it took back
  is kept with the draft by field and kind (`ImportView.takenBack`, the first 200 rows named and all counted) so every
  screen names it, the audit line counts it by kind, and it is let go when the import is confirmed. A request
  overtaken on every try (`draftTries`) is refused with `DraftBusy` (409), nothing written.
- **A Confirm names the draft it was made on.** Its payload is the revision of the draft the screen shows and the
  person's own decisions not saved yet (`ConfirmRequest`), never the screen's whole picture. The batch's first
  statement writes the confirm's row only while the import is open at that revision, and everything after it,
  the unsaved decisions included, checks for that row: on a draft somebody has changed since, nothing is written and
  the answer is `DraftMoved` (409) with the revision the draft is at. The screen then reads the import again, says
  what changed above the review, and the person confirms again (`Draft.machine.ts`, `ConfirmPressed`).
- **A change to a record moves its revision** (`Records.edit`, made on the revision the person saw; the same edit
  again writes nothing). Changed is "saved since", even if the person changed it back: the revision says a person
  touched it.
- **What a take-back would do is worked out from what is stored**: `TakeBackState` in every import's view says which
  confirms are still in force, how many of their records are still at revision 1, and names the ones someone changed
  (at most 20, the rest counted), so the screen says exactly what the press will do.
- **The take-back is one atomic write** with a marker: mark the confirms the screen offered with a fresh `takeBackId`
  (counting what it removes and keeps while every record is still there), write the audit line, delete the records
  at revision 1, each statement after the first guarded by "this take-back marked it". A second press, or one from
  another tab, finds them marked and changes nothing; the answer is read back from what is stored.
- **When nothing can be taken back** (every record changed since), the screen says so and offers no button; the
  server writes nothing.
- **Who may**: an editor or above (`requireRole`); another organization gets 404, never 403, so it learns nothing.
- **What it does not do**: remove records someone changed. "Review again" opens the import again (`reopen`): its rows
  that are still stored are "already there", and the rest can be decided and confirmed.

## 16. One row of a file becomes several records

A file with a row per item and a quantity column per month, or a row that lists two lots, holds several records in
one row. The import does this end to end: one function says how a row becomes records, and the review, the screen,
the confirm, the result and the take-back key each record on its own id. Files: `packages/catalog/model/src/Review/Review.rules.ts`
(`ItemsOfRow`, `recordsOfRow`, `rowId`, `rowPlace`), `packages/catalog/model/src/Review/ItemsOfRow.context.ts`, `packages/catalog/host/src/ImportStore.adapter.ts`,
`migrations/0001_init.sql` (`part`, `sourcePart`), `packages/catalog/web/src/ImportReview.controller.ts`,
`test/domain/RowParts.test.ts` and `test/server/RowParts.slow.test.ts`. The gallery's "One line, several records"
(`/gallery/review?state=months`) shows the region with it.

- **Say it once, in the domain.** `itemsOfRow` in `ItemImport.ts` says how a row becomes items; the review screen
  uses it, and the server reviews with `ItemsOfRow` (`packages/catalog/model/src/Review/ItemsOfRow.context.ts`), which defaults to it. Never give the server another in the app: the
  confirm would then write records the screen never showed. A test provides its own (`Layer.succeed(ItemsOfRow,
  byMonth)`).
- **A record has its own id; its row keeps its number.** Each record of a row has a `part` (1, 2, ...) and the
  file's word for it (`label`, "Feb"). Its id is `rowId({ rowNumber, part })`, `row-8.2`; decisions, rivals,
  rechecks (`recheckRow` takes the id), what an earlier confirm created (`createdIds`) and the stored outcomes are
  keyed on it. `rowNumber` stays Excel's number, repeated on each record of the row, never offset (no row 108 for
  row 8's second record): every "row 8" on screen, the Row column and the reader's notes stay findable in the file.
  A row that is one record is part 0 with the id it always had, `row-8`, and the API leaves `part` out.
- **A row that holds no record is still one entry**: when the function returns none, the review keeps the row as
  part 0 with the reason its values give, never dropped.
- **Two counts, two nouns.** `review(...).counts.rows` counts records and `counts.fileRows` the rows behind them;
  the Review step then says "12 rows in the file, 31 records". The views, the confirm button and the result count
  records and add up to them, and every row of the file is behind at least one record (the tests hold the rows with
  none at 0). Never call a record a row.
- **The region says which record it means.** The adapter gives each row of the region `label: "8 · Feb"`
  (`rowPlace`): "Leave row 8 · Feb out", "Keep row 8 · Feb", "also row 8 · Feb" and the not-imported download use
  it, and the Row column keeps the line. The domain's own sentences do the same ("Code A-1 is also on row 2 · Feb").
- **Storage.** `importOutcome` and `importChange` carry `part` (0 for a row that is one record) in their primary
  keys, and a record names its row and part (`sourceRow`, `sourcePart`), so each record's outcome, changed values
  and take-back are its own. The result and the Activity page show a record of a split row as "8 · 2" (the stored
  part; the month's word is not stored).
- **One record per code still holds.** Records of one row that share a code are rivals like any two rows: when a
  record is one per code and month, the month is a field of the record and part of its key.

In `packages/catalog/model/src/Review/Review.rules.ts`, for a file of items by month, in place of its `itemsOfRow` (the file
already imports `A` and `Str`; checked: this type-checks there):

```ts
// The file's shape: one row per item, one quantity column per month, each month its own record.
const months = [
  { part: 1, label: "Jan", column: 7 },
  { part: 2, label: "Feb", column: 8 },
  { part: 3, label: "Mar", column: 9 }
] as const

/** Each month with a quantity is its own record of its row. A row with none is kept as one entry by the review. */
export const byMonth: ItemsOfRow = ({ row, file }) =>
  A.flatMap(months, (month) => {
    const quantity = Str.trim(row.cells[month.column]?.text ?? "")
    return quantity === "" ? [] : [{ part: month.part, label: month.label, file: { ...file, quantity } }]
  })

export const recordsOfRow: ItemsOfRow = byMonth
```

The rest needs no change: `ReviewStep` already says the two counts, the adapter already labels each record, and the
commit writes each record's part.
