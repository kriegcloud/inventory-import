# Working in this repo

Standing context for any coding agent here (`AGENTS.md` points to it): how we work, the skills and agents, the import
rules, then the code rules.

## What this is

Inventory import: an operations admin moving off spreadsheets loads inventory items in bulk from a messy .csv or
.xlsx, sees what was fixed for them, settles what is wrong in the app, and knows exactly what got in. It began as a
one-hour build on Benjamin's own project starter; `README.md` says so in its opening lines, and `DECISIONS.md` holds
the product decisions made then.

**The person's experience comes first.** The more the app does for the person using it, and the less effort it asks
of them, the better. Every other rule here serves that, or stays out of its way.

**Benjamin decides priorities and product questions.** When you are unsure what he wants, ask him instead of guessing
on anything that is costly to undo.

**Where the work is going** is in `explorations/` (questions being shaped: research, decisions, a brief) and `goals/`
(work with a definition of done: `SPEC.md` and `PLAN.md`). Their READMEs state the scheme and the graduation rule.
The current direction is `explorations/ideal-architecture/`: a bun + Turborepo workspace in beep-effect's model-first
package shape. Its `DECISIONS.md` is binding where a decision is answered; an open one is Benjamin's, not yours. Keep
the active goal's `PLAN.md` current as you work.

**Before building, read `docs/index.md` and the standards under "Read before building" in `docs/standards/`**:
Benjamin's rules, each with its check; the ones the person feels come first. Look up the rest, and `docs/reviewing/`
before calling a screen done.

## What is there

`bun install && bun run dev` is the whole setup: no key and no secret to make by hand (`bun run dev` writes the
sign-in secret into `.dev.vars` the first time).

- **The frame**: a sidebar with the organization (a picker when there are two), the pages and the signed-in person's
  menu (theme, sign-out, the test accounts), a breadcrumb in the bar beside it, and `PageHeader` for each page's
  title row (`src/web/components/app/AppShell.tsx`, `AppSidebar.tsx`, `PageHeader.tsx`, `src/web/Workspace.tsx`).
  **The sidebar lists only screens that exist**: each is one line in `appPages` (`AppSidebar.tsx`) and one branch in
  `Workspace.tsx`. A screen with no use is deleted, not hidden: its page file, its branch, its line, its endpoints
  and service if nothing else uses them, and its tests. Ask Benjamin before deleting one.
- **Sign-in** (Better Auth: accounts, organizations, roles, sessions; [docs/auth.md](docs/auth.md)). In development
  the app opens already signed in as the first test account, Dana Whitfield, admin of Example Works (test),
  through a real session (`useDevelopmentSignIn` in `src/web/components/app/SignedIn.tsx`); the other test accounts are
  one click away in the user menu ("Sign in as a test account"). After a sign-out that tab shows the sign-in page. A
  production build always shows the sign-in page, and offers no test accounts.
- **The import of a file of items**, in four steps, each its own file under `src/web/pages/import/`, on the page
  `src/web/pages/ImportPage.tsx` (the import and its step are in the address, so a refresh lands on the same step):

  | Step | File | What it does |
  | --- | --- | --- |
  | Upload | `UploadStep.tsx` | A .csv or .xlsx read in a worker and sent up in pieces, with progress and Cancel (`useUpload`, `@/lib/upload`); "Use items_messy.csv" (each sample its own button) and a download link; the open imports with Continue and Remove |
  | Match | `MatchStep.tsx` | Which file column fills which field, by heading, changed by hand; shown when a required field found no column. Review waits until every required field has a column and names the ones left |
  | Review | `ReviewStep.tsx`, `reviewAdapter.ts` | The review region (`src/web/components/review/`) on the rows: accept a proposal for a row or a group, pick one of two readings, type a value, keep one of two rows, leave a row out, undo and redo; the confirm button says what it will import |
  | Result | `ResultStep.tsx` | What the confirm did, counted from what is stored, the rows not imported downloadable with their reasons, and the take-back (a changed record is kept and named) |

  The server stages the file and runs the same pure `review` (`src/domain/ItemImport.ts`) at the confirm
  (`src/server/Imports.ts`, `ImportHandlers.ts`). Loading the same file again creates nothing: its rows are "Already
  there", counted from the stored SKU keys.
- **The Items page** (`src/web/pages/ItemsPage.tsx`): the data table paged, sorted and filtered by the server
  (`src/server/Items.ts`), one search box that finds every word in any order and forgives one wrong letter (a
  full-text index in the migration, `src/domain/ItemSearch.ts`), the table assistant (a request in words becomes a
  checked change to the view: `src/web/components/app/TableAssistant.tsx`, `src/server/TableAssistant.ts`), and an
  editor for one item (`ItemEditor.tsx`, editors and admins). With no key the assistant's fixed rules answer and
  it says so.
- **Activity** (`src/web/pages/ActivityPage.tsx`): every value an import wrote that differs from its file, who decided
  it, and the audit trail of uploads, imports, take-backs and changes of role.
- **People** (`src/web/pages/PeoplePage.tsx`): who is in the organization; an admin adds a person by the email they
  signed up with, changes a role or removes someone, and the organization always keeps an admin.
- **One model service** (`src/server/Ai.ts`) with **one daily allowance** (`src/server/ModelCalls.ts`, 40 calls a
  day per organization, taken before each call): every model feature draws on it, and when it is used up the feature
  says so in plain words and its rules answer. `GET /api/v1/system/status` says whether a model is on.

The sample files are in `public/samples/` (`items_messy.csv`, 200 rows, and `items_clean.csv`, 25). The messy sample
is the standing end-to-end proof: imported through Confirm it stores 155 items, and the result screen, the Items
table and the stored rows agree.

## How we work

- **Design before code.** Schema first, then the Effect `Context.Service` contract, then the implementation. For
  anything larger than a small fix, say what you will build, what you will leave out and how you will check it.
- **Smallest thing that is true.** A working plain version first, then improve it. Never leave the app broken between
  commits.
- **Use what exists before building.** Before writing a reader, a table, a review screen, an upload or a service,
  look for one in this project (`docs/kit.md`, `docs/index.md`). For a screen behaviour, use the template's own
  helper first: `useUpload` (a file read in a worker and sent up in pieces, with progress and Cancel),
  `useSavedProgress` (a refresh loses nothing), the review region's undo, `sayError` (words for any failure).
  Building a second one is a decision for Benjamin, with the reason the first does not fit.
- **Commit at each working step** with a conventional message (`feat:`, `fix:`, `test:`, `docs:`, `chore:`,
  `refactor:`) that describes the change to the app. Run `bun run check` before every commit, and
  `bun run format -- <your files>` if the format check fails. If you commit while the check fails, say so with the
  reason in the commit message.
- **Prove it, then say it.** Check a change in the running app or with a test before calling it done. Report what you
  checked and what you did not. "Not verified" is an acceptable sentence. A claim you did not check is not.
- **Look at it.** A change to what the person sees is done only when it was seen on screen, and your message says
  what you typed and what you read ("row 12: typed 8 in Quantity, it reads 8 pcs, Ready"). A test or an API call
  alone is not enough: it can pass on a field the screen does not use. Where nobody looked, say "not seen on screen".
  Never change stored rows by hand to reach a case: show it from a real import on a fresh database, or write "seen on
  a row edited by hand". Look in the headless browser (`mcp__playwright__*`). Screenshots go to `.scratch/shots/`
  (git-ignored); what they showed is written down as text.
- **Decisions by dialog.** A decision reaches Benjamin through the `AskUserQuestion` tool: at most four questions a
  round, most consequential first, two to four options each, yours first with its label ending "(Recommended)" and
  its description giving the reason and what happens to the person's data. A question on the data is one rule about
  one kind of record, with the count of rows it touches and one example. Look in the files before asking how records
  match. Start everything no open decision blocks before asking, and build nothing his answer would change. Write each
  answer down at once: product decisions in `DECISIONS.md` (in his voice, "I chose; the agent recommended the same" or
  "I chose against the recommendation"), architecture decisions in the exploration's `DECISIONS.md`.
- **Product decisions are Benjamin's.** What a rule means, which outcome a kind of row gets, who may do what, a
  threshold, how an ambiguous value is read, what a second load does to a changed record: each is his, not a default,
  even one that only holds rows back.
- **Never** commit a secret, push or deploy unless Benjamin asks in that message.

## Skills

Skills are in `.agents/skills/`, linked into `.claude/skills/` and `.codex/skills/`. One is ours
(`quality-review-fix-loop`); the rest are other people's, vendored with only their commands written for bun
(`.agents/skills/README.md` credits them). `/in-your-own-words`, `/grill-me` and `/unslop` are Benjamin's to type
(`disable-model-invocation`); `grilling` is the one you can run yourself, to put open decisions to him as questions.

| When | Skill | Here |
| --- | --- | --- |
| Before building, when a real decision is still open | `grilling` (or Benjamin types `/grill-me`) | One question per frontier decision through `AskUserQuestion`, recommended answer first, at most four per call. Each answer is written down at once |
| A bug survives one fix | `/diagnosing-bugs` | Reproduce first; no second guess without evidence |
| A screen looks generic | `design-taste-frontend` | App screens only: read its `references/app-screens.md` and run `inspect.mjs --app`. Never its page build (pictures and fonts from the network; our policy blocks them). Where it and "UI" below disagree, "UI" below wins |
| Before hand-building a component | `shadcn`, with the `shadcn` MCP server | Look it up in `@shadcn`, `@diceui` and `@tablecn` first (the MCP tools, or `bunx shadcn@latest search`). Add it with the CLI, `yes n \| bunx shadcn@latest add <item>`, then `bun install`. Never `--overwrite`. Steps in `docs/kit.md` "Finding and adding a component". Where it and "UI" below disagree (`cn` comes from `"cn"`, status is `StatusPill`), "UI" below wins |
| Sign-in, sessions, organisations or roles | The six Better Auth skills, with the `better-auth` MCP server for its docs | Sign-in is installed: read [docs/auth.md](docs/auth.md) first; where a skill disagrees with it, it wins (the skills assume a framework and a database the CLI can reach). After adding a plugin or field, `bun run auth:schema` prints the migration to add |
| Closing a goal | `/quality-review-fix-loop` | Read-only reviewers in parallel, then fixes by file ownership. Product findings come to Benjamin, not to a fixer |
| Adding or changing anything under `docs/`, `explorations/` or `goals/` | `okf-open-knowledge-format` | Frontmatter with `type`, `title`, `description`; list a `docs/` file in its folder's `index.md`, then `bun run docs:check`. Links inside `docs/` are relative (`../kit.md`), never `/`-rooted |
| Starting a new repository, or adding a starter module | `create-beep-app` | Benjamin's starter tool; `beep.json` records which modules this repository was made with |

## Sub-agents

The agents in `.claude/agents/` each read their own rules: a brief never restates them.

- **`backend`** builds everything outside the browser: `src/domain`, `src/api`, `src/server`, `migrations` and their
  tests. **`frontend`** builds screens in `src/web` from the installed components.
- **Who writes what.** Write the Schemas and the contract in `src/api/` yourself and commit them first; then screens
  and server can be built at once. A single service with a few queries, or a rule you can write in less time than a
  brief takes, write yourself.
- **A brief is three lines.** No standards, no rules from this file, no code: the agent file holds them.
  ```
  Build: <what, for whom, and the one rule that must not break>.
  From: <committed Schemas and contract; DECISIONS.md for row rules>. Done: <the test or check>.
  Decided: <what Benjamin decided, quoted>. Open: <not decided: not built>.
  ```
- **A split has owners and a hand-back.** Every work item has exactly one owner. Never edit a running agent's files.
  Each lane formats only its own files (`bun run format -- <files>`). A lane that adds, changes or relies on a
  contract field names it in its hand-back; before calling work two lanes built done, hold their hand-backs side by
  side: a field only one of them names is not done.
- **`reviewer`** reads what changed since a commit it is given and reports at most ten defects, ranked by harm.
  **`qa`** uses the running app in a real browser and reports what it saw. **`verifier`** attacks the API and tests.
  None of them writes code. Check each finding against the current code before fixing it.
- Each hand-back ends with one line, "Needs the person: …" or "Needs the person: nothing". Pass it on unchanged.

## Rules for an import

An import is judged on being coherent for the person importing the file. These rules cover where an import usually
goes wrong.

- **The task's words are the data model.** Where a requirement says what one record is ("each row is one ..."),
  tables and keys follow it literally: two rows that look alike are still two records, never merged, summed or
  dropped unless it says so. A row rule that rests on your inference, not on a stated requirement or a recorded
  decision, is a question for Benjamin before it is built.
- **The person decides; the app proposes.** Never change a value silently. Every normalisation (a unit spelling, a
  date format, a trimmed code, a guessed match) is shown as before and after, can be accepted for all similar rows
  at once, and can be rejected. If two readings are possible (03/04 as a date, the newer of two revisions, which of
  two duplicates wins), it is a question for the person, not a default. A question with no default may still carry a
  suggestion, said in words with its reason ("40 L, as 6 of 7 lines say (suggested)"), never preselected.
- **One decision where one settles a column.** When one reading explains a whole column or file (a date format, a
  unit spelling), propose it once with its evidence as counts from the file, before any question row by row, and list
  the rows it does not explain for a look. A row the proposal does not explain is never loaded without a word.
- **The outcomes, and they add up.** What happens to a row is Ready, Needs a decision or Cannot import, and every
  count on screen and in the documents uses those names. They add up to the rows in the file, shown on screen. Offering a fix
  does not change a row's outcome: a row that cannot be loaded as written is counted there, with the fix offered
  beside it. A row that could be right is never auto-accepted, and a one-click "accept all suggestions" never
  includes rows that are probably wrong.
- **Every row that is left out has a reason** a person can act on, naming the column and the value, and the left-out
  rows can be downloaded with their reasons. No empty reason cells.
- **Show totals before the commit**: row counts, and the sums that matter (value per currency, a quantity per item),
  so the person can compare them with the source. If the file has its own total row, use it as a check, not as data.
- **Nothing is written until the person confirms**, and the confirm button says what it will do ("Import 149
  items"). The server runs the same pure review function as the preview and refuses what the preview refused.
- **After Confirm, the result tells the whole truth**: what was imported, changed and left out, the left-out in named
  parts with counts and reasons that add up to the rows in the file, each number read back from what is stored
  (`docs/standards/after-confirm.md`).
- **A confirmed import can be taken back** while its records are unchanged: one atomic write, a changed record kept
  and named, the take-back recorded (`takeBack` in `src/server/Imports.ts`, the Result step's button).
- **A second import of the same file adds nothing** and says so, counted from what is stored. Keys are normalised
  before comparing (case, spaces, punctuation). Whether a re-import of a changed row updates it, keeps what is stored
  or asks is Benjamin's decision (recorded in `DECISIONS.md`), and is said before Confirm.
- **Money is whole cents read from the digits**, never `Math.round(Number(x) * 100)`: "1.005" becomes 100.
- **Check the domain rule, not just the type.** A quantity of 21.5 is a number and still wrong for an item counted
  in Each. Ask what each column means for this business before accepting it.
- **The sample file is one click away.** The samples live in `public/samples/`. The first screen offers "Use the
  sample file", which loads it through the same code path as a chosen file, and a plain download link beside it. Whoever opens the app should reach the review without hunting for a file.
- **Read everything in the file**: notes sheets, remarks, header blocks and footers often hold the rule that
  decides a case.
- **Reference data that already exists** (such as a catalogue) is a seed migration for one organization only, so
  the other proves tenancy. Generate the `INSERT` migration from its file with a short throwaway script; do not type
  rows by hand.
- **Say only what you checked.** A claim in `DECISIONS.md` that the server re-validates is checked by sending the
  server a bad row.

## Commands

**Which runner.** bun is the only package manager: run scripts with `bun run <script>`, install with `bun install`,
and one-off tools with `bunx`. Vitest, the dev server and Wrangler always run on Node, never under Bun's runtime: no `bunx --bun`, and never
`bun test`, Bun's own runner (`bun run test` runs Vitest on Node, where the sign-in, database and Worker tests pass).

| Command | What it does |
| --- | --- |
| `bun run dev` | Applies local migrations and the test accounts, then serves the app and API on http://localhost:5173, signed in by itself as the first test account |
| `bun run check` | The loop check: type-check with Effect diagnostics, lint (with the two design lints), format check and the fast tests, in a few seconds. Before every commit |
| `bun run check:full` | Everything: the type-check, lint (with the two design lints), format check, every test including the slow ones (`*.slow.test.ts`) and `docs:check`. CI runs it |
| `bun run check:strict` | The Effect diagnostics at production severity, grouped by rule with a total. A measurement in seconds: it never fails. `-- --all` lists every finding |
| `bun run lint:shadcn` | The design-system lint alone. `bunx oxlint --disable-nested-config --deny-warnings -c .oxlintrc.shadcn.json <folder>` for one folder. Fixes: `docs/kit.md` "The two design lints" |
| `bun run docs:check` | Checks that `docs/`, `explorations/` and `goals/` are Open Knowledge Format bundles (the OKF skill's validator). Needs bash |
| `bun run typecheck` | Type-check with tsrs plus the Effect diagnostics (under a second) |
| `bun run format` | oxfmt, writes files: `bun run format -- <files>` for only yours, since a bare run rewrites every file. `format:check` only reports. `bun run lint` is oxlint |
| `bun run test` | Every test, fast and slow (Vitest, Node). `bun run test -- --project fast` for the fast ones only |
| `bun run build` | Type-check with `tsc -b` (patched with the same Effect diagnostics), then the production build |
| `bun run dev:https` | Optional. The dev server over HTTPS with a local certificate (mkcert), so an `https:` origin, Secure cookies and HSTS behave as deployed. `bun run dev` needs none of it |
| `bun run build:report` | The browser's build, then each chunk's makeup by package, largest first (`-- index` for one chunk); the treemap is `.scratch/bundle/client.html`. Read it before moving code between chunks |
| `bun run preview` | Builds and serves the production build on http://localhost:4173, with security headers, compressed (brotli, else gzip) as Cloudflare serves it; `PREVIEW_COMPRESSION=off` for the raw bytes |
| `bun run lighthouse` | Lighthouse on the production build, mobile and desktop, in under a minute. `-- /path` for another page. Prints the scores and every audit that scored below 100 |
| `bun run telemetry` | Optional, Benjamin's to start (needs Docker): Grafana's LGTM stack, then `OTEL_EXPORTER_OTLP_ENDPOINT` in `.dev.vars` sends the Worker's and the browser's traces, metrics and logs to it. Never part of `bun run dev`; `telemetry:down` stops it |
| `bun run db:reset` | Deletes the local database and re-applies migrations. **Restart `bun run dev` afterwards.** |

If you add or remove a dependency, do it with `bun add` or `bun remove`; `bun.lock` is the only lockfile.

**A second dev server.** Benjamin usually runs the dev server in his own terminal on port 5173; ask before starting
another. Start one with `bun run dev -- --port 5174 --strictPort & echo $! > .dev.pid`, stop it with
`kill "$(cat .dev.pid)"`, and wait the 8 to 10 seconds it takes to answer:
`until curl -s -o /dev/null localhost:5174/api/v1/system/status; do sleep 1; done` (any answer counts, a 401 too).
Never `pkill -f` or `pgrep -f` a string that is also in the command you are typing (`pkill -f vite`): it matches your
shell. After a change to `migrations/0001_init.sql`, a copy that has run the dev server needs `bun run db:reset` once.

**Running without the AI key**, leaving `.dev.vars` alone:
`CLOUDFLARE_INCLUDE_PROCESS_ENV=true AI_ENABLED=false bun run dev -- --port 5174 --strictPort`. `/api/v1/system/status`
then reports `"available": false` and why. Without `CLOUDFLARE_INCLUDE_PROCESS_ENV=true` the Worker ignores the shell.

## Layout

```
src/domain/   Schemas and pure functions. Imports only `effect`. No I/O.
src/api/v1/   The HTTP contract (Effect HttpApi), served at /api/v1. Imports domain. Shared by server and browser.
src/server/   Cloudflare Worker: services (Context.Service + Layer), handlers, App.ts composition, worker.ts entry.
src/web/      React app. Calls the API through a client derived from src/api. Never imports src/server.
migrations/   D1 (SQLite) migrations, applied in filename order.
test/         Unit tests.
public/samples/  The sample files the Upload step offers.
docs/         Standards, the kit, patterns, the glossary and sign-in (`docs/index.md` lists them); qa/ is evidence.
explorations/ Questions being shaped: research, decisions, briefs.
goals/        Work with a definition of done: SPEC.md and PLAN.md.
.agents/      Skills (see above). Not application code; the check ignores it.
```

Dependencies point one way: `web -> api -> domain` and `server -> api -> domain`.

## Adding a feature: follow the Items example

Design in this order. Do not start from the UI.

1. **Schema** in `src/domain/` (`Item.ts`, `ItemQuery.ts`): the data and its rules, as Effect Schemas. Parse,
   don't validate: payloads, database rows and model output are decoded through a Schema. File cells are read by
   small functions that return a value or a reason naming the column and value: a Schema error is not a sentence
   for the person.
2. **Contract** in `src/api/v1/` (`Api.ts`): endpoints under `/api/v1` (sign-in's `/api/auth/*` never),
   payloads, every expected failure as a `Schema.TaggedError` with an `httpApiStatus`. Pattern 2 in
   `docs/patterns.md` has a path parameter and several failures.
3. **Service** in `src/server/` (`Items.ts`): a `Context.Service` with a `layer`. SQL lives here only, every
   statement through a Schema (`SqlSchema` for a read, `statement` and `run` from `src/server/Sql.ts` for a write).
4. **Handler** in `src/server/handlers.ts` (or its own file, as `ImportHandlers.ts`), and the service added to
   `Services` in `src/server/App.ts`.
5. **UI** in `src/web/` (`ItemsPage.tsx`): `call((api) => api.group.endpoint(...))` inside TanStack Query, with
   loading, empty and error states. A write of a value the person chose is optimistic through `useOptimisticWrite`
   (`@/lib/optimistic`, copy `ItemEditor.tsx` or the People page's role change); a write whose outcome only the
   server knows (a confirm, a take-back) shows its progress instead. A new page is one line in `appPages` and one
   branch in `Workspace.tsx`.
6. **Test** the rule that would hurt most if it were wrong ("Tests" below).

## Effect (version 4)

Models often write Effect 3 from memory. This repo uses Effect 4.1. Before using an API you have not already seen in
this repo, check it in `node_modules/effect/src/` or the guides in `node_modules/effect/ai-docs/src/`.

- Services: `class X extends Context.Service<X, Shape>()("inventory/server/X") { static readonly layer =
  Layer.effect(X, ...) }`.
- Errors a caller can act on are `Schema.TaggedError`s in the function's error type. Everything else is a defect
  (`Effect.orDie`). Never `throw`, never `try/catch` around Effects.
- Resolve services once, in the Layer or the handler group's constructor (`const x = yield* X` above
  `handlers.handleAll`). A service yielded inside a request handler must be provided per request, and only
  `CurrentActor` is.
- Modules: `effect/http`, `effect/http-api`, `effect/sql`, `effect/schema`, `effect/ai`. Not `@effect/platform`.
- Literal unions are `Schema.Literals([...])`. Classes are `Schema.Class`, `Model.Class`, `Schema.TaggedError`.
- `bun run typecheck` catches wiring mistakes (a missing Layer shows as a type error in `worker.ts`). Run it early.
- A route beside the HttpApi (a frame document, a stream) has its own shape: pattern 6 in `docs/patterns.md`.

### What the type-check enforces

The compiler runs with `strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `noImplicitReturns` and
`noImplicitOverride`. The Effect diagnostics run in `src/domain`, `src/api`, `src/server` and `test` in two profiles
(`tsconfig.base.json`): a rule whose finding can change what the code does at run time fails the check; a rule about
spelling, API preference or naming is only a suggestion, and `bun run check:strict` counts it.

**What fails the check.** Write to these from the start:

- **Optional properties**: never pass `undefined` for an optional property. Spread it conditionally:
  `...(x === undefined ? {} : { x })`.
- **Indexing can miss**: `rows[0]` is `T | undefined`. Handle it.
- **Conditions are booleans**: `if (name !== "")`, `if (value !== undefined)`, `if (row !== undefined)`. Not
  `if (name)` or `if (row)`: a count of 0 is false.
- **Every Effect runs**: an Effect that is built and not yielded, returned or assigned is an error (the work never
  happens). `return yield*` a failure; `yield*`, never a bare `yield`.
- **Every service and error is accounted for**: a missing Layer shows as a type error in `worker.ts`; no `any` or
  `unknown` in an error or requirement channel; no type assertion that hides one.
- **Failures stay typed**: errors a caller can act on are `Schema.TaggedError`s (no class extending `Error`); no
  `try/catch` in a generator, no `async` function, no `new Promise`; `Effect.try` and `Effect.tryPromise` always have
  a `catch` that returns a typed error.
- **Nothing that differs or throws on Workers**: no bare `fetch`, `JSON.parse`/`JSON.stringify`, `process.env`,
  `setTimeout`, and no Node built-in import. Use `Effect.tryPromise` at the edge of a Promise API.
- **Numbers** in Schemas are `Schema.Finite` or `Schema.Int`, never `Schema.Number`. Decode inside an Effect with
  the Effect decoders, not `decodeSync`.
- **Effect 4 only**: an API that Effect 4 removed or renamed is an error.
- **Effect's collections, never `Map` or `Set`**, anywhere in `src` and `test` (oxlint refuses them): `HashMap` and
  `HashSet` for a value handed on (React state included), `MutableHashMap` and `MutableHashSet` for one a function
  fills, or a `Record` or `Arr.dedupe`. `WeakMap` and `WeakSet` stay where an entry must go with its key. Only
  `src/web/components/ui` (vendored, as published) keeps its own.

**What the production profile would enforce, and the check does not yet.** Follow these when it costs nothing.
`bun run check:strict` measures the code ones:

- The Effect modules for strings, arrays and records (`import { Array as Arr, String as Str } from "effect"`):
  `Arr.map(xs, f)`, `Arr.findFirst` (an Option), `Str.trim(x)`, `Record.toEntries(r)`.
- `Effect.fn("Name")(function*(...) { ... })` for every Effect-returning function, so each is a span. Yield, then
  call: `const now = yield* DateTime.now`, then `DateTime.formatIso(now)`.
- Time from `Clock` or `DateTime`, randomness from `Random`, ids from `SecureRandom` (`effect/crypto`), logs through
  `Effect.log`, never `console`.
- Schema classes carry a brand (`Schema.Class<X, { readonly brand: unique symbol }>("X")(...)`), and are built with
  `.make`, not `new`.
- Service keys follow the file path (`"inventory/server/Activities"`); a two-argument exported helper is dual
  (data-first and pipeable, `dual` from `effect/Function`; see `hasRole`).
- The shorter spellings: `mapError`, `tap`, `as`, `asVoid`, `orElseSucceed`, `catchTag` and the like.
- Beyond the code: docgen-grade JSDoc with categories, versions and compiling examples; Have I Been Pwned on (with
  sign-in); the Observatory scan of a deployed copy, its grade reported; the telemetry stack on; and the session
  cookie cache's trade-off written down (a revoked session lasts up to its `maxAge`).

**Not checked by either profile**, and still rules:

- **Look up file content with `Record.get(table, key)`** (an Option; `import { Record as Rec } from "effect"`, so
  TypeScript's `Record<K, V>` stays usable). A plain `table[key]` finds `constructor` and `toString` when a cell
  says so: that is an HTTP 500 the type-check does not see.

### Tests

- **Test the rules where a wrong result hurts the person**: a count, a total,
  a match, a unit, a permission that guards a write. None for plumbing or screens. Many inputs: one `it.prop` from
  the Schema; anything timed: the `TestClock`; HTTP: the Worker's own `fetch` (`send`, `test/server/support/app.ts`).
- **Fast by default.** A test that needs sign-in or a real database is slow: name it `*.slow.test.ts`, and write it
  only when the rule cannot be shown another way. `bun run check` runs the fast tests; `bun run check:full` runs all.
- **Tests run in Node under the same Effect rules.** Read a sample file with
  `import text from "../../public/samples/items_messy.csv?raw"`. `node:fs` fails `bun run check`; for a binary file (a PDF) make the
  test file's first line `// @effect-diagnostics nodeBuiltinImport:off`, and return promises, no `async`. Provide
  layers with `layer(...)` from `@effect/vitest`, not `Effect.provide` inside the test.

In `src/web` the same compiler flags apply, but the rules that forbid native array methods, truthiness checks,
`async` and browser globals are off. The vendored components in `src/web/components/ui` are not checked by the Effect
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
- **Spreadsheets (.csv, .xlsx)**: the reader is installed; do not write another. `useUpload` from `@/lib/upload`
  reads a chosen .csv or .xlsx in a worker into one table with typed cells and Notes, then sends its rows to the
  server in pieces (`POST /api/v1/imports/uploads`, then the chunks, then finish), with its progress and Cancel;
  `SheetChooser` picks the sheet. Pattern 7 in `docs/patterns.md` has the shape, the limits and the samples.
  A file that cannot be read or staged is a `FileProblem` (`src/domain/FileProblem.ts`), data the screen shows; a
  server step that stages a file answers 200 with `StagingOutcome`, what it made or that problem.
- **PDFs**: `unpdf` reads text from a PDF in the browser and in the Worker. Nothing for PDFs is installed.
- **Secrets** and settings come from `wrangler.jsonc` `vars` and `.dev.vars` locally, `wrangler secret put` deployed,
  and are read only through `src/server/Settings.ts` (secrets as `Config.Redacted`; pattern 9). No agent reads or
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

Sign-in is Better Auth: `src/server/SessionIdentity.ts` turns the session cookie into the actor
([docs/auth.md](docs/auth.md)). `src/server/Identity.ts` (a header names the member) is for tests only. The browser
asks who is signed in once (`useActor`, `GET /api/v1/identity/session`); sign-in, a switch of organization and
sign-out drop every cached query. What must stay real in every new endpoint:

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
  role, and is named in `Activity` ([docs/auth.md](docs/auth.md), "Agents act for a person").

## AI features

Two rules shape any plan that uses a model:

- **The app must be complete without a key.** Whoever runs this may not have a key. Every AI feature has a non-AI path that is good on its own, and the UI says
  which one produced a result.
- A model proposes; it never writes. Anything it suggests lands as a draft, goes through the same validation and
  permission checks as a person's input, and the person confirms it.

**Before writing any code that calls a model**, read patterns 3 to 6 in `docs/patterns.md`: the `Ai` service, the
AI SDK 7 names models get wrong, what to send a small model, tool loops and model-written HTML. The model id defaults
to `AI_MODEL` in `wrangler.jsonc`, and `AI_MODEL` in `.dev.vars` can override it, so read it from
`/api/v1/system/status`; do not hardcode a model name. One retry policy, in `Ai.ts`: never add another; end every AI
feature with `answeredByRules(...)` and show `answeredBy` on screen. **Every model call takes one call from the day's
allowance first** (`ModelCalls.take(actor, kind)` in `src/server/ModelCalls.ts`, before the call): a new model feature
adds its kind there and in the `modelCall` table's check, and when the allowance is used up it says so and its rules
answer, as the table assistant does (`src/server/TableAssistant.ts`).

## UI

The house style for screens of dense business tables: quiet chrome, a hairline grid, numbers that line up, and colour
only where it means something.

- Components are in `src/web/components/ui` (shadcn, all installed). Compose them. Do not add another UI library.
  `bun run check` holds this: a raw `button`, `input`, `select`, `textarea`, `label` or table outside `ui/` fails, and so
  does a colour, size or restyle that does not come from the theme (`docs/kit.md`, "The two design lints").
- Colour comes from tokens in `src/web/index.css` (`bg-background`, `text-muted-foreground`, `bg-success
  text-success-foreground`, and so on). No hex values, no Tailwind palette colours like `text-red-500`. Both themes
  must work. Colour carries meaning only: status, errors, negatives. The filled button, the mark and the focus ring
  are the brand's forest green; ticks, links and progress are ink. Nothing decorative: no glow, gradient or
  decorative colour.
- **Type** is IBM Plex Sans for text, names, quantities and money. Codes are set in a monospace face (JetBrains Mono)
  whose 0 and O, and 1, l and I, cannot be confused, and numbers keep plain figures that line up.
- **Red text is `text-destructive`.** `bg-danger text-danger-foreground` is the tinted pair for chips and cells;
  `text-danger` alone is the pale tint and unreadable as text.
- **One filled primary button per surface**, last in the top-right action group. Other actions are outline or ghost.
- **Tables** are the main surface: the workspace's frame already gives every page the full width (`Workspace.tsx`
  passes `fill` to `AppShell`), no card around the table, about 36px rows, no zebra, the record's name first in
  semibold. `Table` already draws the grid (hairline row and column lines, a 36px
  header row with grey labels): do not restyle `TableHead`.
- **Numbers** are right-aligned (tables set tabular figures; a total outside a table takes `tabular-nums`). Quantities
  carry their unit ("250.00 kg"), money is "$874.07", negatives are red, thousands separators via `Intl.NumberFormat`.
- **Missing values**: a missing required value is a red-tinted cell with the reason. A missing optional value is
  "Not set" in muted text. Never show "null", "N/A" or "-".
- **Status** is words plus colour, never colour alone: `StatusPill`, mapped once: Ready `info`, Needs a decision
  `warning`, Cannot import `danger`, Imported `success`, Already there `neutral`, Draft `outline`. The words are each set once: the review region's defaults (Needs you, Can't fix
  here, Ready, Left out, All, Already there, …) in `defaultReviewWords` (`components/review/words.ts`), passed as
  `words` on the region, and the import's (Created, Already there, Not imported, Taken back, All) in `importWords`
  (`pages/import/format.tsx`): change them there, and nowhere else.
- **An import reads as steps**, and the app's already does (`src/web/pages/ImportPage.tsx`): Upload, Match (our field
  on the left, the file's column on the right, required fields marked; headers are matched by name, ignoring case,
  spaces and punctuation, and the step opens by itself only when a required field found no column; Review waits
  until every required field has a column and names the ones left), Review (the views "Needs you N · Can't fix here
  N (when there are any) · Ready N · All N"), Confirm, a result with counts. Say the duplicate policy before the
  person commits.
- **AI output is a proposal.** It lands as Draft or Needs a decision, shows its reason, and the person confirms it.
  Show what the model did as past-tense lines ("Mapped 12 columns", "Flagged 3 rows").
- Every async view has four states: loading (skeleton), empty (what to do next), error (what happened and what to
  try), and data. Skeletons in the real boxes are in `components/app/Skeletons.tsx`.
- **Codes in `font-mono`**: a record's code, a SKU, a part number, a barcode, a lot or serial, a document number,
  anything a person compares character by character, wherever a table or card shows it. In `ReviewRegion` that is
  `code: true` on the column; elsewhere wrap the value in `Code`. Names, descriptions, quantities and money stay in the text face.
- shadcn's `TableCell` does not wrap. A column of sentences (a reason) takes `whitespace-normal min-w-72 max-w-md`
  and sits before the number columns; row buttons stay in reach with `data-sticky="end"` on the cell and its header
  (`table.tsx` draws the sticky edge; a collapsed table border does not stick). A plain helper is never named
  `useSomething`: the linter reads it as a hook.
- **The shell names the job**: `AppShell` `title` (in `App.tsx` and `Workspace.tsx`) and `<title>` in `index.html`.
  **The `h1` is the job** ("Review records"); the file name, row count and duplicate
  rule go in the grey line under it.
- **Title row**: `PageHeader` (`flex flex-wrap justify-between gap-4`, title block `min-w-0 flex-1 basis-60`, actions
  `flex flex-wrap gap-2`).
- **Decide a layout from the room the page has**, not the window: `useIsNarrow()` and `useContentBelow(px)` from
  `@/lib/content-width` already subtract the sidebar. A `md:` class or `useIsMobile()` in a page is wrong on a tablet
  with the sidebar open.
- **Saved views** ("All 30", "Needs attention 7") are ghost `Button size="sm"` with `aria-pressed`; the button draws the
  selected one (`bg-muted`), so pass no class for it.
- **Columns**: name, Status, Reason, then the file's columns, then Line. Reason text is ink; grey is for "Not set".
- **Counts mean what they sit on.** A total adds only like with like: money per currency, a quantity of one item in
  one unit, never quantities of different items ("138 each" of jars and labels). A tab's count is the rows its list
  shows, and a number shown in two places is the same in both.
- **A filter with no rows keeps the table**: its header and one `colSpan` row with a sentence and a link back to All.
- Write for the person doing the job: plain verbs, their nouns, no developer words. Say what will happen before a
  button does something that cannot be undone.
- Keyboard works, focus is visible, inputs have labels. Before building a screen with controls or a table, read
  `docs/patterns.md` section 8: nine rules, each from a point a real review screen lost in an audit. Before one that
  shows quantities, units or money, read `docs/glossary.md`: the trade words, each with the mistake an import makes.
- Benjamin points at UI with React Grab (dev only): a pasted block naming a component and file is him showing you
  exactly which element he means. Change that element, not one that looks similar.

## Comments and documentation

Comments are for the next person who has to change this, not for the compiler.

- **Every export in `src/domain`, `src/api` and `src/server` has a JSDoc block.** First sentence: what it is for, in
  the business's words. Then the rule it protects or the decision it records, and why. Never restate the type.
- **Every exported schema has `.annotate({ description })`**, and an API payload field a person can leave out, or
  whose name is unclear, has `annotateKey` (with `messageMissingKey`): the same text is the code's doc, the OpenAPI
  document's and the model's. Required on every new schema.
- **`@example` on exported pure helpers** whose use is not obvious, showing a real value from the sample data.
- **A file that holds a decision opens with it**: two or three lines on the file's role and the one thing a reader
  must not break (see `src/server/Identity.ts`).
- **React components**: one line on what the person does with it. Document a prop only when its name is not enough.
- Explain *why*, and what was rejected. No commented-out code, no `TODO` without a name and a reason, no
  `@since`, `@category` or `@author` tags: there is no doc pipeline here to read them.
