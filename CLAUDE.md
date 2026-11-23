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

**Before writing or changing any Effect Schema, read `docs/standards/schema-first.md`**: Benjamin's schema rules
(SF-1 to SF-9), each with its check. They bind every new package and all code as it moves into one.

**Every Effect import follows `docs/standards/effect-imports.md`** (beep-effect's rules): each module whole from its
own path under its one name (`import * as O from "effect/Option"`, `import * as HttpClient from
"effect/http/HttpClient"`), never from `"effect"` or a folder of modules such as `effect/http`; only `pipe`, `flow`,
`identity` and `dual` are picked by name, from `effect/Function`. `bun run check` fails on anything else and prints
the line to write; `bun run imports:fix` repairs code.

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
  through a real session (the `developmentSignIn` atom in `src/web/components/app/SignedIn.tsx`); the other test accounts are
  one click away in the user menu ("Sign in as a test account"). After a sign-out that tab shows the sign-in page. A
  production build always shows the sign-in page, and offers no test accounts.
- **The import of a file of items**, in four steps, each its own file in `@inventory/catalog-web` (`packages/catalog/web/src/`), on the page
  `packages/catalog/web/src/ImportPage.screen.tsx` (the import and its step are in the address, so a refresh lands on the same step):

  | Step | File | What it does |
  | --- | --- | --- |
  | Upload | `UploadStep.screen.tsx` | A .csv or .xlsx read in a worker and sent up in pieces, with progress and Cancel (the upload's atoms, `@inventory/catalog-web/Upload`); "Use items_messy.csv" (each sample its own button) and a download link; the open imports with Continue and Remove |
  | Match | `MatchStep.screen.tsx` | Which file column fills which field, by heading, changed by hand; shown when a required field found no column. Review waits until every required field has a column and names the ones left |
  | Review | `ReviewStep.screen.tsx`, `ImportReview.controller.ts` | The review region (`@inventory/review`, `packages/review`) on the rows: accept a proposal for a row or a group, pick one of two readings, type a value, keep one of two rows, leave a row out, undo and redo; the confirm button says what it will import |
  | Result | `ResultStep.screen.tsx` | What the confirm did, counted from what is stored, the rows not imported downloadable with their reasons, and the take-back (a changed record is kept and named) |

  The server stages the file and runs the same pure `review` (`packages/catalog/model/src/Review/Review.rules.ts`) at the confirm
  (`packages/catalog/host/src/ImportStore.adapter.ts`, and `packages/catalog/model/src/Import/Imports.handler.ts`). Loading the same file again creates nothing: its rows are "Already
  there", counted from the stored SKU keys.
- **The Items page** (`packages/catalog/web/src/ItemsPage.screen.tsx`): the data table paged, sorted and filtered by the server
  (`packages/catalog/host/src/ItemStore.adapter.ts`), one search box that finds every word in any order and forgives one wrong letter (a
  full-text index in the migration, `packages/catalog/model/src/Item/ItemSearch.rules.ts`), the table assistant (a request in words becomes a
  checked change to the view: `packages/catalog/web/src/TableAssistant.screen.tsx`, `packages/catalog/model/src/Assistant/Assistant.handler.ts`), and an
  editor for one item (`ItemEditor.screen.tsx`, editors and admins). With no key the assistant's fixed rules answer and
  it says so.
- **Activity** (`src/web/pages/ActivityPage.tsx`): every value an import wrote that differs from its file, who decided
  it, and the audit trail of uploads, imports, take-backs and changes of role.
- **People** (`@inventory/access-web/People`): who is in the organization; an admin adds a person by the email they
  signed up with, changes a role or removes someone, and the organization always keeps an admin.
- **One model service** (`@beep/openrouter`, set up by the app in `src/server/Model.ts` and asked through `@inventory/catalog-host/Model`) with **one daily allowance** (the access context's `ModelAllowanceGateway`, 40 calls a
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
  helper first: the upload's atoms (`startUpload`, `uploadState`, `cancelUpload`: a file read in a worker and sent up
  in pieces, with progress and Cancel), `useSavedProgress` (a refresh loses nothing), the review region's undo,
  `sayError` (words for any failure).
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

Skills are in `.agents/skills/`, linked into `.claude/skills/` and `.codex/skills/`. Twenty-one come from Benjamin's
beep-effect as they stand there (`.agents/skills/README.md`, "From beep-effect"): `effect-first-development`,
`schema-first-development`, `crispen`, `grill-with-docs`, `grilling`, `grill-me`, `teach`, `adhd`, `portless`,
`turborepo`, `quality-review-fix-loop`, `unslop`, `sparql-expert` and the eight `ontology-*` skills. They still name
beep-effect's standards and paths in places; where they disagree with this file, this file wins. The rest are other
people's, vendored with only their commands written for bun, and `create-beep-app` is Benjamin's starter tool.
`/in-your-own-words`, `/grill-me` and `/teach` are Benjamin's to type (`disable-model-invocation`); `grilling` is the
one you can run yourself, to put open decisions to him as questions.

| When | Skill | Here |
| --- | --- | --- |
| Before building, when a real decision is still open | `grilling` (or Benjamin types `/grill-me`) | One question per frontier decision through `AskUserQuestion`, recommended answer first, at most four per call. Each answer is written down at once |
| A bug survives one fix | `/diagnosing-bugs` | Reproduce first; no second guess without evidence |
| Writing or changing Effect code | `effect-first-development`, `schema-first-development` | Schema first, then the `Context.Service` contract, then the implementation; check each API against Effect 4's source. Where they name beep-effect paths or packages that do not exist here, follow "Effect (version 4)" below |
| Refactoring code whose rules belong in a schema | `crispen` | Absorbs guard and decode helpers into existing schemas; not for new models |
| Stress-testing an architecture plan against the exploration's decisions | `grill-with-docs` | Here its decision log is the exploration's `DECISIONS.md` |
| Open-ended design or naming with no known answer | `adhd` | Divergent ideation; skip it for closed questions |
| Turborepo tasks, caching, `turbo.json` | `turborepo` | Reads the docs bundled in the installed `turbo` package |
| Named local dev URLs | `portless` | `bun run --cwd apps/inventory dev:portless` serves the app as `inventory` |
| Ontology work (classes, mappings, SPARQL) | the `ontology-*` skills, `sparql-expert` | Not used by the app today |
| Cutting filler from prose | `unslop` | On documents and messages, never on code |
| A screen looks generic | `design-taste-frontend` | App screens only: read its `references/app-screens.md` and run `inspect.mjs --app`. Never its page build (pictures and fonts from the network; our policy blocks them). Where it and "UI" below disagree, "UI" below wins |
| Before hand-building a component | `shadcn`, with the `shadcn` MCP server | Look it up in `@shadcn`, `@diceui` and `@tablecn` first (the MCP tools, or `bunx shadcn@latest search`). Add it with the CLI, `yes n \| bunx shadcn@latest add <item>`, then `bun install`. Never `--overwrite`. Steps in `docs/kit.md` "Finding and adding a component". Where it and "UI" below disagree (`cn` comes from `"cn"`, status is `StatusPill`), "UI" below wins |
| Sign-in, sessions, organisations or roles | The six Better Auth skills, with the `better-auth` MCP server for its docs | Sign-in is installed: read [docs/auth.md](docs/auth.md) first; where a skill disagrees with it, it wins (the skills assume a framework and a database the CLI can reach). After adding a plugin or field, `bun run auth:schema` prints the migration to add |
| Closing a goal | `/quality-review-fix-loop` | Read-only reviewers in parallel, then fixes by file ownership. Product findings come to Benjamin, not to a fixer |
| Adding or changing anything under `docs/`, `explorations/` or `goals/` | `okf-open-knowledge-format` | Frontmatter with `type`, `title`, `description`; list a `docs/` file in its folder's `index.md`, then `bun run docs:check`. Links inside `docs/` are relative (`../kit.md`), never `/`-rooted |
| Starting a new repository, or adding a starter module | `create-beep-app` | Benjamin's starter tool; `beep.json` records which modules this repository was made with |

## Sub-agents

The agents in `.claude/agents/` each read their own rules: a brief never restates them.

- **`backend`** builds everything outside the browser: the contract, model and host packages of a context
  (`packages/catalog`, `packages/access`), `src/api`, `src/server`, `migrations` and their tests. **`frontend`**
  builds screens in a context's web package and in `src/web` from the installed components.
- **Who writes what.** Write the Schemas and the contract (a context's contract package) yourself and commit them first; then screens
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
  and named, the take-back recorded (`takeBack` in `packages/catalog/host/src/ImportStore.adapter.ts`, the Result step's button).
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

**Where commands run.** The repository is a bun workspace driven by Turborepo. Root scripts (below, first group) run
from the repository root; `check`, `check:full`, `build`, `lint` and `test` go through `turbo`, which caches each
package's task and replays it when nothing it reads has changed. The app's own scripts (second group) run with
`bun run --cwd apps/inventory <script>`, or plain `bun run <script>` inside `apps/inventory`.

| Root command | What it does |
| --- | --- |
| `bun run dev` | Applies local migrations and the test accounts, then serves the app and API on http://localhost:5173, signed in by itself as the first test account |
| `bun run check` | The loop check through turbo: type-check with Effect diagnostics, lint (with the two design lints), the fast tests, the proofs of the review's model (`prove`: half a minute when they run, replayed by turbo until the model's own files or the pinned library change), the format check, `docs:check`, the key scan (`keys:check`), the vendored-kit hash check (`vendor:check`), the Alchemy packages kept as files against their recorded hashes (`alchemy:check`; needs python3), which package may import which (`boundaries:check`), the two stylesheet lists (`screens:check`), every `ref` a DOM ref or a callback that stays the same across draws (`refs:check`), no `_tag` compared or built by hand in any src or test folder (`tags:check`), no file holding more fallbacks, comparisons with null or undefined or clean-ups outside a schema than its baseline allows, the baseline compared with main's so its numbers only fall (`defaults:check`), no type assertion (`assertions:check`), no Promise (`promises:check`), no `@effect-diagnostics` comment (`diagnostics:check`), every helper that names the value it acts on taking it first and `dual` (`dual:check`), every property `readonly` (`readonly:check`), every file of screens exporting components only (`fast-refresh:check`), each of those six with a ledger of today's files whose numbers only fall, compared with the ledger at the branch's base: where it left main, or on a push the last push whose run passed (`packages/tooling/tool/cli/ledgers/`), no deprecated API used, read from every file's types (`deprecated:check`; `docs/standards/deprecated-apis.md`), the root's own configuration files type-check (`configs:check`) and the Effect imports (`imports:check`; `imports:fix` repairs code), every version written in more than one place equal to its one source (`version-sync`) and the configuration that follows from the workspaces (`config-sync:check`), `bun.lock` holding what every package.json asks for (`lockfile:check`), no home path or private folder in the scratchpad (`private-paths:check`), and every patch to a dependency with its header and a test of its own, for what is installed, and needed: its test fails with that one patch left out (`patches:check`, `patches:prove`), with every task that runs code waiting until what is installed holds the patches (`patches:installed`; `docs/patches.md`). Before every commit |
| `bun run beep <group> <command>` | One of the repository's own rules by hand: `bun run beep laws boundaries`, `bun run beep quality ceilings`, `bun run beep vendor check`; `--help` on any of them lists its flags. `bun run check` runs them all under their root script names (`boundaries:check`, `vendor:check` and the rest) |
| `bun run check:full` | `check` plus Verify's search of the whole model (`verify`: two minutes when it runs), the property that holds the model against the review region (`fold`: a minute and a half), a sample of the model's mutants (`mutants:sample`: under a minute), the slow tests (`*.slow.test.ts`: workerd, D1, sign-in) and the production build. The model's tasks are replayed by turbo until what they read changes |
| `bun run check:ci` | What CI's main job runs: `check:full` without the model's proofs, search, fold and mutants. CI runs those in a job of their own (`proofs` in `ci.yml`, the tasks of `bun run proofs`, turbo's results restored from the last run on `main`), and every night with nothing replayed and every mutant (`.github/workflows/proofs-nightly.yml`; `bun run proofs:nightly` runs the same four tasks by hand with nothing replayed, with two differences: turbo starts the four at once on one machine, so the first mutants share it with the proofs, Verify's search and the fold, where the nightly runs those three in one job and the mutants on runners of their own; and every mutant runs in one task, two at a time, with `row-open` given 50 minutes beside another mutant where the nightly runs it alone with 100: `docs/verify.md`) |
| `bun run build` | The production build through turbo |
| `bun run test` | Every test: fast, the proofs, the search and slow (Vitest, Node). Not the fold or the mutants: `bun run proofs` |
| `bun run format` | oxfmt, writes files: `bun run format -- <files>` for only yours, since a bare run rewrites every file. `format:check` only reports |
| `bun run deps:update` | Moves every dependency of every package to its newest version, except the ones `.syncpackrc.json` holds back (each is named with its reason and how to move it), runs `version-sync -- --write`, then `bun install` once, and says what moved from which version to which; a failed install puts every file back. `-- --dry-run` lists the moves and writes nothing. `deps:lint` and `deps:outdated` (syncpack) read the same packages and the same held list |
| `bun run version-sync` | Names every place where a version or a date differs from its one source (`.bun-version`, `engines.node`, the `effect` the packages state, the app's `wrangler.jsonc` and the rest) and fails. `-- --write` rewrites them, `-- --dry-run` lists what would be written. `docs/sync-commands.md` has every source and what is left alone |
| `bun run config-sync` | Writes what follows from the workspaces: syncpack's sources and its list of the catalog's names, tsconfig references, each package's scripts, the paths that depend on a package's depth, the root tasks the three checks (`check`, `check:full`, `check:ci`) run; installs when it wrote a package.json. `config-sync:check` only compares, `-- --dry-run` lists what would be written |
| `bun run scratch:new <name> --template <probe\|service\|screen\|verify>` | Starts an experiment in `scratchpad/experiments/<name>` from a template whose test already passes. `scratch:test [name]` runs the experiments' tests, or one experiment's folder only (Vitest, Node); `scratch:check` holds the scratchpad's own rules (no install inside an experiment, a note for each) and runs the type-checker with the Effect diagnostics; `scratch:list` shows what is open with its age; `scratch:serve experiments/<name>` serves a screen on the first free port from 5273; `scratch:graduate <name> --to <path> --learned "<line>"` or `scratch:drop <name> --learned "<line>"` ends one. `bun run check`, the build and CI never read the scratchpad (`docs/scratchpad.md`) |
| `bun run docs:check` | Checks that `docs/`, `explorations/` and `goals/` are Open Knowledge Format bundles (the OKF skill's validator). Needs bash |
| `bun run db:reset` | Deletes the local database and re-applies migrations. **Restart `bun run dev` afterwards.** |
| `bun run preview` | Builds and serves the production build on http://localhost:4173, with security headers, compressed (brotli, else gzip) as Cloudflare serves it; `PREVIEW_COMPRESSION=off` for the raw bytes |
| `bun run telemetry` | Optional, Benjamin's to start (needs Docker): Grafana's LGTM stack, then `OTEL_EXPORTER_OTLP_ENDPOINT` in `apps/inventory/.dev.vars` sends the Worker's and the browser's traces, metrics and logs to it. Never part of `bun run dev`; `telemetry:down` stops it |
| `bun run release <major\|minor\|patch>` | Benjamin asks for it. Cuts a release: `major` or `minor` makes `release/<major>.<minor>` from `main`, `patch` tags the next patch on the release branch it is run on; it sets the app's version, writes the notes, runs `check:full`, commits and makes an annotated tag. It pushes nothing and prints the one push that sends branch and tag together (`docs/releasing.md`). `bun run beep release verify <tag>` says whether a tag may deploy |
| `bun run beep infra setup --test-stage` | Benjamin's to run at his own terminal, never an agent's: what a first deploy needs (the Cloudflare account, an Alchemy profile, the state store), then a plan he reads and a deploy on his yes. `--staging` sets up what GitHub must hold, `--production` deploys production. An agent may run it only with `--dry-run`, which prints the steps and starts nothing (`goals/infra/PLAN.md`) |
| `bun run alchemy:repin -- <commit>` | Moves the Alchemy packages kept as files in `vendor/alchemy` to another commit of the library's `main`: the files, the root `overrides`, the lockfile's hashes, the repository's patches to them carried to the new files (it stops on one that no longer applies, or is no longer needed), an install that is refused the library's registry, then `check:full` with nothing replayed from the cache (`vendor/alchemy/README.md`). Benjamin asks for it; it commits nothing. `bun run alchemy:check` checks the pin as it stands. Needs python3 |

| App command (`apps/inventory`) | What it does |
| --- | --- |
| `check` | Type-check with tsrs plus the Effect diagnostics (`typecheck` is the same) |
| `lint`, `lint:shadcn` | oxlint and the design-system lint; `lint:shadcn` alone. Fixes: `docs/kit.md` "The two design lints" |
| `test`, `test:slow`, `test:all` | The fast tests, the slow ones, both |
| `check:strict` | The stage C ceiling and the plugin-parity check (part of `check`); `-- --all` lists every ledgered finding |
| `dev:https` | Optional. The dev server over HTTPS with a local certificate (mkcert), so an `https:` origin, Secure cookies and HSTS behave as deployed |
| `build:report` | The browser's build, then each chunk's makeup by package, largest first (`-- index` for one chunk); the treemap is `.scratch/bundle/client.html` |
| `lighthouse` | Lighthouse on the production build, mobile and desktop. `-- /path` for another page. Prints the scores and every audit that scored below 100 |
| `auth:schema` | After a change to Better Auth's options, prints the migration it still needs |
| `grid:keys` | Types on every data grid editor in Chromium and reads what is stored (needs `CHROME_PATH`); by hand, after a change to the grid |

Hosting is Benjamin's alone. `bunx alchemy deploy --stage <name>` from the root runs the stack in `packages/infra`, and
`bun run beep infra setup` does what comes before a first deploy and then deploys on his yes. No agent runs either
for real, whatever it was asked to get done; an agent may run `bun run beep infra setup --dry-run`, which prints the
steps and starts no tool. None runs `bun run release` unless he asks for a release in that message
(`goals/infra/PLAN.md`, "What Benjamin does by hand"; `docs/releasing.md`).

If you add or remove a dependency, do it with `bun add` or `bun remove` in the workspace that uses it
(`bun add --cwd apps/inventory <name>`); `bun.lock` at the root is the only lockfile of the workspaces, and `bunfig.toml` keeps one
hoisted `node_modules`. A dependency more than one package uses has its version once, in the `catalog` of the root's
package.json, and each package.json says `"catalog:"` (`docs/sync-commands.md`, "One place for a shared version");
`bun run deps:lint` refuses one written as a version. The one other lockfile is the scratchpad's (`scratchpad/bun.lock`, committed), for the
libraries an experiment added: the scratchpad is no workspace, and a library the root already has never goes there.

**A second dev server.** Benjamin usually runs the dev server in his own terminal on port 5173; ask before starting
another. Start one with `bun run dev -- --port 5174 --strictPort & echo $! > .dev.pid`, stop it with
`kill "$(cat .dev.pid)"`, and wait the 8 to 10 seconds it takes to answer:
`until curl -s -o /dev/null localhost:5174/api/v1/system/status; do sleep 1; done` (any answer counts, a 401 too).
Never `pkill -f` or `pgrep -f` a string that is also in the command you are typing (`pkill -f vite`): it matches your
shell. After a change to `migrations/0001_init.sql`, a copy that has run the dev server needs `bun run db:reset` once.

**Running with AI turned off**, without opening `apps/inventory/.dev.vars`: back it up, append the override (a later line
wins), run, and put the backup back. From `apps/inventory`:
`cp .dev.vars .dev.vars.backup && printf '\nAI_ENABLED=false\n' >> .dev.vars`, then
`bun run dev -- --port 5174 --strictPort`, and afterwards `mv -f .dev.vars.backup .dev.vars`. `/api/v1/system/status`
then reports `"available": false` and "AI_ENABLED is set to false". The shell does not reach the Worker while
`.dev.vars` exists: wrangler reads `CLOUDFLARE_INCLUDE_PROCESS_ENV` only when it falls back to `.env` files
(`getVarsForDev` in wrangler 4.161), so `CLOUDFLARE_INCLUDE_PROCESS_ENV=true AI_ENABLED=false` changes nothing here.

## Layout

```
apps/inventory/         The app: the Worker and the SPA, one Vite build. Its own package.json, tsconfigs, wrangler.jsonc.
  src/api/v1/           The assembled HTTP contract (Effect HttpApi), served at /api/v1: the contexts' groups, the
                        system group, the OpenAPI document. Shared by server and browser.
  src/server/           Cloudflare Worker: the composition (App.ts), the group Layers (handlers.ts), settings, the model
                        service's setup, telemetry, security headers, worker.ts entry.
  src/web/              React app: the shell, the Activity page, the composition of the contexts' screens. Calls the
                        API through a client derived from src/api. Never imports src/server.
  migrations/           D1 (SQLite) migrations, applied in filename order.
  test/                 Unit tests (`*.slow.test.ts` need workerd, D1 or sign-in).
  public/samples/       The sample files the Upload step offers.
  scripts/              The app's development scripts (local migrations, HTTPS, deploy setup, strict count).
packages/ui/             @inventory/ui: the vendored shadcn, Dice UI and tablecn components and hooks (as published, one
                        exact export each), the theme (`theme.css`, the Tailwind entry) and the shared screen pieces.
packages/review/         @inventory/review: the review region and its saved progress.
packages/client/         @inventory/client: the browser's seam to the API with no contract in it (the API's atoms: reads,
                        writes and optimistic writes bound to a client; who is signed in, as an atom; `sayError`; the
                        early requests).
packages/access/         The access context (who may do what), as four packages: contract/ (the session, people and
                        audit-trail schemas, their API groups, the model allowance's gateway), model/ (rules, ports,
                        in-memory twins, handlers: no SQL, no HTTP), host/ (the D1 adapters, sign-in, the session
                        identity, the endpoints) and web/ (the session controller, sign-in, People, the audit events).
                        `bun run beep laws boundaries` holds which of them may import which.
packages/catalog/        The catalog context (items and the imports that write them), as four packages: contract/ (the
                        schemas of items, staged files, decisions, changes, suggestions and results, and the imports,
                        items and assistant groups), model/ (the pure rules the screen and the server both run: the
                        review, suggestions, the table view's checks, sheet layout, upload pieces; the six ports, their
                        in-memory twins and what each endpoint does: no SQL, no HTTP; and the review as a model of
                        `@alchemy.run/domain`, in memory only: the `Import`, `Row` and `Group` aggregates, the four
                        decisions that record an act on two of them, their stories and their proofs, docs/verify.md), host/ (the D1 adapters, the
                        model and the allowance as the catalog asks them) and web/ (the import's steps, the Items page,
                        the editor, the assistant, the upload).
packages/kernel/, packages/drivers/   @inventory/kernel and the @beep drivers (d1, better-auth, openrouter).
packages/infra/          @beep/infra: what is deployed, per stage. The stage plan as a schema and a pure function
                        (`StagePlan.rules.ts`: what each stage gets, decided from its name), the app's Alchemy stack
                        (`Inventory.stack.ts`: one D1 database, one Worker) and the repository's (`GitHub.stack.ts`:
                        the deploy environments, their secrets, the rule on main). Nothing in the app imports it.
alchemy.run.ts          The app's stack, re-exported for `bunx alchemy deploy --stage <name>`. A deploy is Benjamin's:
                        no agent runs `alchemy deploy`, `plan`, `destroy`, `login` or `state`, nor
                        `bun run beep infra setup`, which runs them for him, except with `--dry-run`, which
                        starts nothing (goals/infra/PLAN.md).
vendor/alchemy/         The Alchemy packages as files, one commit of the library's main, with every sibling address
                        inside them rewritten so an install needs the library's registry for nothing. Its README says
                        why, and how the pin moves. Never edit a file there: `bun run alchemy:check`, part of `bun run check`, fails on a change.
packages/patches/        @inventory/patches: the repository's patches to its dependencies, applied by bun at every
                        install. One file a defect (alchemy-domain/01-computed-instance-id.patch) with a header that
                        says what it applies to, where the defect is reported, why we need it and when it goes; the
                        file bun reads beside each folder, built from it (`bun run beep patches build`), never edited;
                        and under test/ the test of each patch, which fails without it. Before making, changing or
                        dropping one, read docs/patches.md. Nothing imports it.
packages/foundation/     Product-neutral packages: this repository's own @beep/csv and @beep/xlsx (modeling/), which read
                        and write a CSV and an Excel workbook as Effect Schema codecs, and beep-effect's kit, vendored:
                        @beep/types (primitive/), @beep/identity, @beep/schema and @beep/utils (modeling/). Never edit
                        the kit: each vendor.json
                        records its beep-effect commit and file hashes, and `bun run vendor:check` fails on a change.
docs/                   Standards, the kit, patterns, the glossary and sign-in (`docs/index.md` lists them); qa/ is evidence.
explorations/           Questions being shaped: research, decisions, briefs.
goals/                  Work with a definition of done: SPEC.md and PLAN.md.
packages/tooling/tool/cli/  @beep/repo-cli: the repository's own rules as commands (`bun run beep <group> <command>`):
                        `laws` (boundaries: which package may import which; screens: every package with screens in
                        both stylesheet lists; ref-callbacks: no ref callback made on each draw; tags: no `_tag` compared or built by hand in any src or test folder; defaults: absence, starting values and clean-ups are a schema's, counted per file against a baseline that only falls; exports; keys; private-paths: no home path or private folder in the scratchpad; deprecated-apis: no deprecated API used, in any code file git would commit outside `.agents` and `scratchpad`; effect-imports: every Effect import from its own path
                        under its one name; and the six bans, each with a ledger in `ledgers/` of today's files whose
                        numbers only fall against the branch's base (where it left main; on a push, the last push whose
                        run passed): assertions, promises, diagnostics, dual,
                        readonly and fast-refresh), `quality` (strict, ceilings), `docs check` and `vendor` (check; sync,
                        which copies the kit from a beep-effect checkout); `deps update`, `version-sync` and
                        `config-sync`, which move dependencies and keep repeated versions and derived configuration in
                        step (`docs/sync-commands.md`); `patches` (check, installed, prove, build, and carry, which a
                        re-pin runs: `docs/patches.md`); and `scratch` (new, list, check, graduate, drop). Nothing
                        imports it.
scratchpad/             A folder beside the workspaces, not one of them, where an idea is tried in a folder of its own
                        (experiments/<name>/: a NOTE.md, code and a test), importing every package from the root's
                        install. Its package.json and its own bun.lock hold only libraries experiments added; its
                        configuration is the CLI's. The root's install, the build and a deploy never read it; `bun run
                        check` reads it only for an import of it (`laws boundaries`), a key and a home path. The laws on
                        how code is written apply when an experiment's code graduates into a package. LOG.md keeps one line for each experiment that ended
                        (`docs/scratchpad.md`).
tsconfig.json           References every package's tsconfig.test.json and tsconfig.config.json, so a linter that reads
                        types and an editor find a test's project. Nothing compiles it. `bun run config-sync` writes
                        its list from the packages' projects.
turbo.json              The task graph: twelve package tasks and the root tasks (the repository's own rules, one each).
.agents/                Skills (see above). Not application code; the check ignores it.
```

Paths in this file and in `docs/` that start `src/`, `test/`, `migrations/`, `public/` or `scripts/` are inside
`apps/inventory/`.

A package with screens is named in two lists, or its classes are missing from the stylesheet and only the look is
wrong: an `@source` line in `src/web/index.css` (development) and `screenPackages` in `vite.config.ts` (the build).
`bun run check` holds both (`bun run beep laws screens`).

Dependencies point one way: a context's `web -> model -> contract` and `host -> model -> contract`, and the app composes
them (`src/web -> src/api`, `src/server -> src/api`). `bun run check` holds it (`bun run beep laws boundaries`).

## Adding a feature: follow the Items example

Design in this order. Do not start from the UI.

1. **Schema** in the context's contract package (`packages/catalog/contract/src/Item/Item.read.ts`,
   `ItemQuery.command.ts`): the data and its rules, as Effect Schemas. Parse,
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
   progress instead. A screen's own state is an atom too ("UI" below, "State is atoms"). A new page is one line in
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
`Row/Row.aggregate.ts`, `Group/Group.aggregate.ts`, the four `Review/*.decision.ts`, `Catalog.model.ts`). Verify proves
its rules from the code of `decide` and `evolve`, so that code is written for two readers. Before changing one of
those files, read [docs/verify.md](docs/verify.md).

- **`new` only where a `decide` is**: files named `*.aggregate.ts` and `*.decision.ts` build events and rejections with
  `new`, since the prover does not read `X.make(...)` there. The `// @effect-diagnostics newSchemaClass:off` first line
  that lets them is refused in a new file (`diagnostics:check`): the model's decide files that hold it today are held
  in `packages/tooling/tool/cli/ledgers/diagnostics.json`, and a new decide file builds with `.make` once the prover
  reads it (Benjamin's later answer to decision 33, "Teach the prover .make", in progress), so it waits for that
  change. Everywhere else, tests included, `.make`.
- **A case is told with `effect/Match`**, in a guard written once beside the schema (`isOpen`, `isDecided`); the prover
  does not read a schema's `guards` or `match`. **A state is built by its case's own `make`, with the status written
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
- **Every check a `decide` makes has a mutant** (`packages/catalog/model/mutants/`): a change that removes it, and one
  for each field of a new event, which a proof or a story must notice. A new check without one is a gap the nightly
  cannot see; how to add one is in that folder's README.
- **The rules as written are locked** (`test/Catalog.lock.json`, written by Verify): a rule taken out or whose text
  changed fails `bun run --cwd packages/catalog/model verify`, and in CI so does a rule the file does not list. To
  change a rule on purpose, run that once with `UPDATE_VERIFY_LOCK=1` and commit the file. Never set it to make a
  failing run pass, and never edit the file by hand.
- **A model's task names what it reads** (`packages/catalog/model/turbo.json`): a file a block of the model imports
  from outside those inputs is added there, or its change replays an old proof.

### What the type-check enforces

One profile for the whole repository: the root `tsconfig.base.json`, beep-effect's compiler flags and Effect
language-service severities copied verbatim (the source commit is in its header comment). Every Effect diagnostic is
an error and suggestions fail the exit code too. Everything new starts on it with no exception. Two recorded
exceptions exist, and nothing else may:

- **Stage C, own code with screens** (the app's `src/web`; `@inventory/ui`'s own pieces; `@inventory/review`, its
  gallery fixtures included): `preferEffectArray`, `preferEffectString`, `preferEffectRecord` and
  `missingPipeableSignature` are off, in each package's `tsconfig.base.json`. Each package counts them against the
  ceiling in its `strict-ceiling.json` (`bun run beep quality strict`, part of its `check`), which fails when the count
  is above it, and when it is below it until the ceiling is lowered; `bun run beep quality ceilings` keeps the sum at
  most 678. The numbers only fall. Write new web code the Effect way anyway.
- **Stage D, the vendored components and hooks** (`packages/ui/src/components`, `packages/ui/src/hooks`): every rule
  off, permanently.

The same `check` fails if a package's plugin block drifts from the root's outside `overrides`. Server, api, domain and
test code have no exception at all, and neither have the packages under `packages/`: the vendored kit passes the full
profile, its copied tests included, with no override.

**What fails the check.** Write to these from the start:

- **Absence, starting values and clean-ups are a schema's, never the code's** (`docs/standards/schema-first.md`, SF-3
  to SF-5). A value that may be missing is an `Option`, decoded where it enters (`S.OptionFromOptionalKey`,
  `S.OptionFromNullOr`, `S.OptionFromNullishOr`); a starting value is on the field (`S.withConstructorDefault`,
  `S.withDecodingDefaultTypeKey`); a trim or a change of case is a transformation (`S.decodeTo` with
  `SchemaTransformation` or `SchemaGetter`). A handler gets the type it works with from one decode at its boundary
  and trusts it after that line. So our own code writes no `??`, no `||` before a value, no `getOrElse`, no comparison with `null` or `undefined`, no
  `O.getOrUndefined` or `O.getOrNull`, and no `.trim()`, `Str.trim`, `toLowerCase` or `toUpperCase` outside a schema.
  `bun run check` counts them in every src and test folder against `defaults-baseline.json` (`defaults:check`): a file
  may hold what the baseline names for it and no more, a file it does not name holds none, and the numbers only fall
  (`bun run beep laws defaults --write` lowers them, never raises): over the whole tree the baseline is compared with
  main's, as the bans' ledgers are, so a count raised or a file added in the same commit is refused. In a Claude Code session the same law reads each
  file as it is edited and names the new line and what to write (`.claude/hooks/defaults.sh`). An old place in a file
  you are changing is not yours to clean unless the task says so; a new one is refused.
- **Optional properties**: never pass `undefined` for an optional property. In our own types there is none: the field
  is an `Option`. Where another library's API has one, spread it from the Option:
  `...O.match(x, { onNone: () => ({}), onSome: (x) => ({ x }) })`.
- **Indexing can miss**: `rows[0]` is `T | undefined`. Take it as an Option: `A.head(rows)`, `A.get(rows, i)`.
- **Conditions are booleans**: `if (name !== "")`, `if (count > 0)`, `if (O.isSome(row))`. Not
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
  fills, or a `Record` or `A.dedupe`. `WeakMap` and `WeakSet` stay where an entry must go with its key. Only
  `packages/ui/src/components` (`@inventory/ui`) (vendored, as published) keeps its own.

**Also enforced, beyond the list above** (the full profile): the Effect modules for strings, arrays and records
(`A`, `Str` and `R`, imported as `docs/standards/effect-imports.md` says: `A.map(xs, f)`, `A.findFirst` (an Option),
`Str.includes("x")(name)`, `R.toEntries(r)`); `concurrency` stated on every `Effect.forEach` and `Effect.all`
(`{ concurrency: 1 }` keeps them sequential); no `yield*` inside a call's arguments (yield, then call); time from
`Clock` or `DateTime`, randomness from `Random`, ids from `effect/crypto/SecureRandom`, logs through `Effect.log`, never
`console`; service keys that follow the package and path (`"@inventory/app/server/Activities"`, as the
`deterministicKeys` rule derives it); a two-argument exported helper is dual (data-first and pipeable, `dual` from
`effect/Function`; see `hasRole`). Schema classes carry a brand and are built with `.make`.

**Not checked by the profile**, and still rules:

- **Look up file content with `R.get(table, key)`** (an Option; `import * as R from "effect/Record"`, so
  TypeScript's `Record<K, V>` stays usable). A plain `table[key]` finds `constructor` and `toString` when a cell
  says so: that is an HTTP 500 the type-check does not see.

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
([docs/auth.md](docs/auth.md)). `HeaderIdentity` in `@inventory/access-host/AccessTest` (a header names the member) is
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
  role, and is named in `Activity` ([docs/auth.md](docs/auth.md), "Agents act for a person").

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

## UI

The house style for screens of dense business tables: quiet chrome, a hairline grid, numbers that line up, and colour
only where it means something.

- Components are in `packages/ui/src/components` (`@inventory/ui`) (shadcn, all installed). Compose them. Do not add another UI library.
  `bun run check` holds this: a raw `button`, `input`, `select`, `textarea`, `label` or table outside `ui/` fails, and so
  does a colour, size or restyle that does not come from the theme (`docs/kit.md`, "The two design lints").
- Colour comes from tokens in `packages/ui/src/theme.css` (`bg-background`, `text-muted-foreground`, `bg-success
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
  here, Ready, Left out, All, Already there, …) in `defaultReviewWords` (`packages/review/src/ReviewWords.words.ts`), passed as
  `words` on the region, and the import's (Created, Already there, Not imported, Taken back, All) in `importWords`
  (`packages/catalog/web/src/internal/format.tsx`): change them there, and nowhere else.
- **An import reads as steps**, and the app's already does (`packages/catalog/web/src/ImportPage.screen.tsx`): Upload, Match (our field
  on the left, the file's column on the right, required fields marked; headers are matched by name, ignoring case,
  spaces and punctuation, and the step opens by itself only when a required field found no column; Review waits
  until every required field has a column and names the ones left), Review (the views "Needs you N · Can't fix here
  N (when there are any) · Ready N · All N"), Confirm, a result with counts. Say the duplicate policy before the
  person commits.
- **AI output is a proposal.** It lands as Draft or Needs a decision, shows its reason, and the person confirms it.
  Show what the model did as past-tense lines ("Mapped 12 columns", "Flagged 3 rows").
- Every async view has four states: loading (skeleton), empty (what to do next), error (what happened and what to
  try), and data. Skeletons in the real boxes are in `@inventory/ui/Skeletons` (`packages/ui/src/Skeletons.component.tsx`).
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
- **Decide a layout from the room the page has**, not the window: the atoms `isNarrow` and `contentBelow(px)` from
  `@inventory/ui/ContentWidth` (read with `useAtomValue`) already subtract the sidebar. A `md:` class or
  `useIsMobile()` in a page is wrong on a tablet with the sidebar open.
- **State is atoms** (`effect/reactivity`, read with `@effect/atom-react`; goals/atoms). A value a screen holds is
  `Atom.make`; one worked out from others is `Atom.readable` or `Atom.map`; state that belongs to one component on
  screen is a `ScopedAtom`; something outside (the window, a table's own store) is followed by an atom that
  subscribes and cleans up with `get.addFinalizer`; a value followed after the draw is `useAtomSubscribe` with one
  function for the component's life. `bun run check` refuses `useState`, `useReducer`, `useMemo`, `useCallback`,
  `useContext` and every effect hook in our own code, with no exception for effects, and refuses a `ref` that is not
  a DOM ref or a callback that stays the same across draws (`refs:check`). `useRef` is for a DOM node only. The
  vendored kit (`packages/ui/src/components`, `packages/ui/src/hooks`) keeps its own.
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
