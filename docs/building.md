---
type: Standard
title: "Building a feature"
description: "How a feature is built here: the Items example step by step, Effect 4, the review model's blocks that Verify reads, tests, Cloudflare Workers and D1, identity and permissions, AI features, and comments."
---

# Building a feature

Moved here from `CLAUDE.md` word for word on 2026-11-26 (goals/focus-and-friction, step 4); `CLAUDE.md` keeps a line that links each section.

What the type-check and the laws refuse is in [laws](laws.md).

## Adding a feature: follow the Items example

Design in this order. Do not start from the UI.

1. **Schema** in the context's contract package (`packages/catalog/contract/src/Item/Item.read.ts`,
   `ItemQuery.payload.ts`): the data and its rules, as Effect Schemas. Parse,
   don't validate: payloads, database rows and model output are decoded through a Schema. File cells are read by
   small functions that return a value or a reason naming the column and value: a Schema error is not a sentence
   for the person.
2. **Contract** in the same package (`Catalog.contract.ts`; `src/api/v1/Api.ts` adds the group): endpoints under
   `/api/v1` (sign-in's `/api/auth/*` never),
   payloads, every expected failure as a `Schema.TaggedError` with an `httpApiStatus`. Pattern 2 in
   `docs/patterns.md` has a path parameter and several failures.
3. **Port and adapter**: the port (a `Context.Service` with no Layer) in the model package
   (`Item/ItemStore.store.ts`), its Layer on D1 in the host package (`ItemStore.adapter.ts`). SQL lives in the host only, every
   statement through a Schema (`SqlSchema` for a read, `D1.statement` run with `run` or `batch` of `@beep/d1/D1` for a write).
4. **Handler** in the model package (`Item/Items.handler.ts`: what each endpoint does, the ports resolved once);
   the group Layer is built in `src/server/handlers.ts`, and the adapter added to `servicesWith` in
   `src/server/App.ts`.
5. **UI** in the web package (`ItemsPage.screen.tsx`). A read is an atom, made once at module level:
   `catalogApi.query((api) => api.group.endpoint(...), { reactivityKeys })` (the package's `Catalog.runtime.ts`, from
   `makeApiAtoms` in `@inventory/client/Api`), read with `useAtomValue`, with loading, empty and error states; what a
   write changed is said with `invalidate(keys)`. A write of a value the person chose is optimistic through
   `optimisticWrite` (`@inventory/client/OptimisticAtoms`; copy `ItemEditor.screen.tsx` or the People page's role
   change); a write whose outcome only the server knows (a confirm, a take-back) is `catalogApi.ask` and shows its
   progress instead. A screen's own state is an atom too ("UI" in [ui](ui.md), "State is atoms"). A new page is one line in
   `appPages` and one branch in `Workspace.tsx`.
6. **Test** the rule that would hurt most if it were wrong ("Tests" below).

## Effect (version 4)

Models often write Effect 3 from memory. This repo uses Effect 4.1. Before using an API you have not already seen in
this repo, check it in `node_modules/effect/src/` or the guides in `node_modules/effect/ai-docs/src/`.

- Services: `class X extends Context.Service<X, Shape>()("@inventory/app/server/X") { static readonly layer =
  Layer.effect(X, ...) }`.
- Errors a caller can act on are `Schema.TaggedError`s in the function's error type. Everything else is a defect
  (`Effect.orDie`). Never `throw`, never `try/catch` around Effects.
- Resolve services once, in the Layer or the handler group's constructor (`const x = yield* X` above
  `handlers.handleAll`). A service yielded inside a request handler must be provided per request, and only
  `CurrentActor` is.
- Modules live under `effect/http/`, `effect/http-api/`, `effect/sql/`, `effect/schema/`, `effect/ai/`, each imported
  from its own path (`effect/sql/SqlClient`; `docs/standards/effect-imports.md`). Not `@effect/platform`.
- Literal unions are `Schema.Literals([...])`. Classes are `Schema.Class`, `Model.Class`, `Schema.TaggedError`.
- A tagged value's case is told by what its type gives: `O.isSome` and `O.match`, `AsyncResult.isFailure`, a
  `Data.taggedEnum`'s `$is` and `$match`, a `Schema.TaggedUnion`'s `guards`, `isAnyOf` and `match`, `Match.valueTags`
  for plain data, `Schema.is` of one error class. Never `x._tag === "A"` or `switch (x._tag)`:
  `bun run check` refuses both, in every src and test folder (`tags:check`).
- `bun run typecheck` catches wiring mistakes (a missing Layer shows as a type error in `worker.ts`). Run it early.
- A route beside the HttpApi (a frame document, a stream) has its own shape: pattern 6 in `docs/patterns.md`.

### The model's blocks: what Verify reads

The review is also a model of `@alchemy.run/domain` (`packages/catalog/model`: `Import/Import.aggregate.ts`,
`Row/Row.aggregate.ts`, `Group/Group.aggregate.ts`, the four `Review/*.decision.ts`, `Catalog.model.ts` and its Api,
`Catalog.api.ts`). Verify proves its rules from the code of `decide` and `evolve`, so that code is written for two
readers. Before changing one of those files, read [docs/verify.md](verify.md).

- **`.make` everywhere, a `decide` included**: an event or a rejection is built with `X.make(...)` in `*.aggregate.ts`
  and `*.decision.ts` as in every other file, and no file turns a diagnostic off. The prover reads `X.make(...)` as the
  instance it builds, through the repository's third patch to it (`docs/patches.md`).
- **A case is told by its schema's own guard** (`ImportState.guards.Open`, `ImportCommand.isAnyOf([...])`,
  `ImportEvent.guards.ActCounted`), never by a copy written beside it: the prover reads a tagged union's `guards`,
  `isAnyOf`, `match` and `matchOrElse`, and `Schema.is`, through the repository's third patch to it
  (`docs/patches.md`), from a union the file exports. **A state is built by its case's own `make`, with the status written
  out** (`ImportState.cases.Open.make({ status: "Open", ... })`): the prover sees only what `make` is given. A state's
  union is keyed by `status`.
- **A rule is one comparison.** The prover takes both sides of every `&&`, `||` and `?:` it cannot settle, in the code
  and in every rule a decision reads; past 4,096 paths it proves nothing. The proof tests state each decision's paths.
  A relation of the model is proved across each decision too, with paths of its own that no proof test states: a
  `decide` that asks the same thing of its command twice (`cmd.covered`, then `cmd.covered` again after other checks)
  doubles them, and the relation is then only searched, which fails `verify`. Ask once, and branch. What counts most
  is how many ways through the `decide` reach the record: a check that lets an act go on in two ways ("the text
  differs, or the matching does") is written as one comparison (`onItsMatching`).
- **An aggregate's rule reads only what its own commands' middleware provides.** `Row` and `Group` have no command, so
  the rules about who may change a row or a group are rules of each decision that records on it, under the same
  name in each, and only where the rule can fail: who may take a decision or a group back is the undo's rule, not the
  act's. A new decision that records on one states them too, and its proof calls the check that it
  does with the events its command records, as the four do (`missingRules` in `test/proving.ts`, which runs only where a proof calls it): ours, because the lock and the list of rules that must stay proved take its
  rules as they are written, and nothing in the library asks whose act a decision records.
- **Annotate `keyOf`'s parameter** in a decision (`keyOf: (cmd: DecideRow) => ...`): without it the parameters of
  `decide` are `any`, and a typo in one passes the type-check.
- **Which rules there are, and that each stays proved, is the library's**: the lock (below), and Verify's
  `require: { proved }` in `test/Catalog.verify.test.ts`, given the lock's rules of the kinds a proof covers. A proof
  file (`Prove.report`, `Prove.decisionReport`) takes neither, so each has a check of ours: every rule its report
  names is proved. A model's invariant is only searched, and a `sometimes` rule says only that one sequence gets
  there.
- **Every check a `decide` makes has a mutant** (`packages/catalog/model/mutants/`, and the usage model's in
  `packages/usage/model/mutants/`): a change that removes it, and one for each field of a new event, which a proof or
  a story must notice. A new check without one is a gap the nightly cannot see; how to add one is in the catalog's
  README, and what a second model package must add to use the runner is in its section "A second model package".
- **The rules as written are locked** (`test/Catalog.lock.json`, written by Verify): a rule taken out or whose text
  changed fails `bun run --cwd packages/catalog/model verify`, and in CI so does a rule the file does not list. To
  change a rule on purpose, run that once with `UPDATE_VERIFY_LOCK=1` and commit the file. Never set it to make a
  failing run pass, and never edit the file by hand.
- **A model's task names what it reads** (`packages/catalog/model/turbo.json`): a file a block of the model imports
  from outside those inputs is added there, or its change replays an old proof.

### Tests

- **Test the rules where a wrong result hurts the person**: a count, a total,
  a match, a unit, a permission that guards a write. None for plumbing or screens. Many inputs: one `it.prop` from
  the Schema; anything timed: the `TestClock`; HTTP: the Worker's own `fetch` (`send`, `test/server/support/app.ts`).
- **A test narrows with an assert, never a check.** `assertSome`, `assertNone`, `assertDefined`, `assertSuccess`,
  `assertFailure`, `assertExitSuccess` and `assertExitFailure` from `@effect/vitest/utils` narrow the type and fail
  with the value. No `if (x === undefined)`, no `??`, no `if (O.isSome(x))` around an expectation: `defaults:check`
  counts those in tests too.
- **Fast by default.** A test that needs sign-in or a real database is slow: name it `*.slow.test.ts`, and write it
  only when the rule cannot be shown another way. `bun run check` runs the fast tests; `bun run check:full` runs all.
- **Tests run in Node under the same Effect rules.** Read a sample file with
  `import text from "../../public/samples/items_messy.csv?raw"`. `node:fs` fails `bun run check`. A test that
  reads a binary file (a PDF) is to read it without `node:fs` and without a diagnostics comment; no reader for that is
  set up yet. The eight test files that read one through `node:fs` today do it under an `@effect-diagnostics` comment
  held in `packages/tooling/tool/cli/ledgers/diagnostics.json`, and come off as they move. No new such comment is
  written (`diagnostics:check` refuses one), and a test writes no Promise: for example no `async` function,
  `await`, `new Promise`, `Promise.*` call or `.then` chain (`promises:check`; a Promise a call hands back without naming one
  is caught only where its type is read). Provide layers with `layer(...)` from `@effect/vitest`, not `Effect.provide` inside the test.

In `src/web` the same compiler flags apply, but the type-check's rules that forbid native array methods, truthiness
checks, `async` and browser globals are off there; `async` is refused everywhere all the same, by `promises:check`. The vendored components in `packages/ui/src/components` (`@inventory/ui`) are not checked by the Effect
diagnostics at all.

## Platform: Cloudflare Workers and D1

The API runs in workerd, locally and deployed. Measured in this repo:

- **No interactive transactions.** `sql.withTransaction` dies on D1. For several writes that must succeed or fail
  together, build the statements and run `D1Client.batch([...])`: one atomic batch. 3,000 single-row inserts in one
  batch took 73 ms locally.
- **At most 100 bound parameters per statement.** A multi-row `sql.insert(rows)` fails with "too many SQL variables"
  past that (30 rows of 4 columns already fails). Write many rows as one `yield* sql.batch(statements)` (with
  `const sql = yield* D1Client.D1Client`) of single-row statements, each
  `INSERT ... ON CONFLICT (organizationId, key) DO NOTHING RETURNING id`. A second import of the same file then adds
  nothing, and you can tell the person how many rows were already there. Pattern 1 in `docs/patterns.md` has the code.
- **No filesystem.** Read uploaded files in the browser, or send their text in a JSON payload. Do not use multipart
  persistence.
- **Spreadsheets (.csv, .xlsx)**: the reader is installed; do not write another. `startUpload` from
  `@inventory/catalog-web/Upload` (an atom: set it to the chosen file; `uploadState` is its progress, `cancelUpload` its Cancel)
  reads a chosen .csv or .xlsx in a worker into one table with typed cells and Notes, then sends its rows to the
  server in pieces (`POST /api/v1/imports/uploads`, then the chunks, then finish), with its progress and Cancel;
  `SheetChooser` picks the sheet. Pattern 7 in `docs/patterns.md` has the shape, the limits and the samples.
  A file that cannot be read or staged is a `FileProblem` (`packages/catalog/contract/src/Staging/FileProblem.read.ts`), data the screen shows; a
  server step that stages a file answers 200 with `StagingOutcome`, what it made or that problem.
- **PDFs**: `unpdf` reads text from a PDF in the browser and in the Worker. Nothing for PDFs is installed.
- **Secrets** and settings come from `wrangler.jsonc` `vars` and `.dev.vars` locally, and from the stack deployed
  (`packages/infra/src/Inventory.stack.ts`, the Worker's `env`), and are read only through `src/server/Settings.ts` (secrets as `Config.Redacted`; pattern 9). No agent reads or
  prints `.dev.vars`: the app and the project's scripts read it themselves. New bindings are
  declared in `wrangler.jsonc` and typed in `src/server/env.d.ts`; each new variable goes in `.dev.vars.example`.
- **Security headers** are in `public/_headers` (static files) and `src/server/security.ts` (API): nothing from
  another origin, no inline `<script>`. Check `bun run preview` if you add anything that loads a resource.
- A request whose payload does not match its Schema gets a `400` problem document naming every wrong field and its
  rule (`HttpApiMiddleware.ProblemDetails` on the `Api`). Bound every string in a payload (`Schema.isMaxLength`).
  Problems in a person's data are not request errors: review every row with a pure function, write the good ones in
  one batch, and say what happened to every row as data (the import's commit and its `ImportResult`).
- Columns are camelCase, the same as the Schema fields. Dates are ISO strings.

## Identity and permissions

Sign-in is Better Auth: `@inventory/access-host/SessionIdentity` turns the session cookie into the actor
([docs/auth.md](auth.md)). `HeaderIdentity` in `@inventory/access-host/AccessTest` (a header names the member) is
for tests only. The browser
asks who is signed in once (the `session` atom of `@inventory/access-web/Session`, `GET /api/v1/identity/session`; a
screen reads `member` from `@inventory/client/MemberAtoms`). Every read is kept per member and organization, so
another account or another organization starts from nothing, and a sign-out lets every read go. What must stay real
in every new endpoint:

- Attach `.middleware(Identity)` to the group. Read the actor with `yield* CurrentActor`. Never accept an
  organization or member id from a payload.
- Every table that holds customer data has `organizationId`, every query filters on it, its indexes start with it,
  and a child row references its parent by `(organizationId, id)`; `Tenancy.slow.test.ts` reads the schema and
  checks every table that has `organizationId`.
- Anything that writes starts with `yield* requireRole("editor")` (or `"admin"`). The UI mirrors the rule with
  `hasRole` so nobody is offered a button that will be refused. A write is safe to send twice: it names what it acts
  on (an upload's key, the revision an edit was made on, an import still open), so a retry writes once;
  `newRequestId()` makes a key once per press for a new write that has nothing of its own. A write from another site
  is refused before identity (`SameOrigin`).
- Anything that changes data records an `Activity` row saying who did what.
- People are told apart by id (`actor.id`), never by name. A name is not unique and its owner can change it, so a
  rule such as "nobody approves their own count" compares ids.
- Server code acting as an agent runs inside `asAgent(...)`: it acts for the signed-in person, never above their
  role, and is named in `Activity` ([docs/auth.md](auth.md), "Agents act for a person").

## AI features

Two rules shape any plan that uses a model:

- **The app must be complete without a key.** Whoever runs this may not have a key. Every AI feature has a non-AI path that is good on its own, and the UI says
  which one produced a result.
- A model proposes; it never writes. Anything it suggests lands as a draft, goes through the same validation and
  permission checks as a person's input, and the person confirms it.

**Before writing any code that calls a model**, read patterns 3 to 6 in `docs/patterns.md`: `askModel` and the `OpenRouter` service,
what to send a small model, cost and tool loops, and model-written HTML. The model id defaults
to `AI_MODEL` in `wrangler.jsonc`, and `AI_MODEL` in `.dev.vars` can override it, so read it from
`/api/v1/system/status`; do not hardcode a model name. One retry policy, `ModelPolicy` in `@beep/openrouter`: never add another; end every AI
feature with `answeredByRules(...)` and show `answeredBy` on screen. **Every model call takes one call from the day's
allowance first** (`ModelAllowanceGateway.take(purpose)` from `@inventory/access-contract/ModelAllowance`, before the
call): a new model feature adds its purpose there (`ModelCallPurpose`) and in the `modelCall` table's check, and when the allowance is used up it says so and its rules
answer, as the table assistant does (`packages/catalog/model/src/Assistant/Assistant.handler.ts`).

## Comments and documentation

Comments are for the next person who has to change this, not for the compiler.

- **Every export in a contract, model or host package, `src/api` and `src/server` has a JSDoc block.** First sentence: what it is for, in
  the business's words. Then the rule it protects or the decision it records, and why. Never restate the type.
- **Every exported schema has `.annotate({ description })`**, and an API payload field a person can leave out, or
  whose name is unclear, has `annotateKey` (with `messageMissingKey`): the same text is the code's doc, the OpenAPI
  document's and the model's. Required on every new schema.
- **`@example` on exported pure helpers** whose use is not obvious, showing a real value from the sample data.
- **A file that holds a decision opens with it**: two or three lines on the file's role and the one thing a reader
  must not break (see `packages/access/host/src/AccessTest.test-layer.ts`).
- **React components**: one line on what the person does with it. Document a prop only when its name is not enough.
- Explain *why*, and what was rejected. No commented-out code, no `TODO` without a name and a reason, no
  `@since`, `@category` or `@author` tags: there is no doc pipeline here to read them.
