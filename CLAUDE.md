# Working in this repo

Standing context for any coding agent here (`AGENTS.md` points to it): what the app is, how we work and the rules
for an import. The rest of the standing rules live under `docs/`, one file a subject, each linked from "Where the
rest is" below; read the one a task touches before starting it.

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
  `refactor:`) that describes the change to the app. Run `bun run check:changed` before every commit and
  `bun run check` before every push, and
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
- **Finished work becomes a pull request, without being asked** (Benjamin, 2026-11-26). Work is done on a branch,
  never on `main`. When it is done and `bun run check` passes, push the branch (`git push -u origin <branch>`) and
  open a pull request into `main` with `gh pr create`: a title in the commit style, and a body that says what
  changed, what was checked and what was not. A branch that already has a pull request is pushed again, not given a
  second one. A branch built on another unmerged branch says so in its body. Say the pull request's address in the
  hand-back. Opening one starts CI and, by the deploy workflow, the pull request's preview (`docs/releasing.md`):
  that is the workflow's deploy, not the agent's. A sub-agent given a lane of a split commits and hands back; the
  agent that owns the branch pushes and opens the pull request.
- **Worktrees go under `.claude/worktrees/<lane>`**, where the Claude app puts them; the global rule that puts
  workstation apps' worktrees under `~/YeeBois/workstation-apps/worktrees/` does not cover this repository. Once a
  worktree's commit is in main and it is clean, remove it (`git worktree remove`, then `git worktree prune`); one
  with changes or an unmerged branch may be another session's, so it is listed for Benjamin, never removed.
- **Never** commit a secret. Never push to `main` or a `release/*` branch, force-push, push a tag, merge a pull
  request or deploy unless Benjamin asks in that message.
- **When Benjamin asks for a merge**, it is `gh pr merge <n> --merge --auto --match-head-commit <sha>`: the pull
  request merges itself once the required checks pass, and its branch is deleted. Nobody waits on the checks.

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

## UI, in short

The house style for screens of dense business tables: quiet chrome, a hairline grid, numbers that line up, and colour
only where it means something. Every rule of it is in [docs/ui.md](docs/ui.md): read it before building or
changing a screen. The ones a change breaks most often:

- Compose the installed components (`@inventory/ui`); colour comes from the theme's tokens only. `bun run check`
  refuses a raw `button` or `input`, a hex value and a palette colour.
- Status is words plus colour through `StatusPill`, and the words are set once (`defaultReviewWords`,
  `importWords`).
- One filled primary button per surface, last in the top-right action group.
- State is atoms: `bun run check` refuses `useState`, `useMemo`, `useEffect` and the other React state hooks in our
  own code.

## Where the rest is

Each section below moved out of this file word for word on 2026-11-26; its heading is unchanged, so a pointer to
`CLAUDE.md`, "<section>" finds it in the file named here.

| Section | File |
| --- | --- |
| What is there (the frame, sign-in, the import's four steps, Items, Activity, People, the model service) | [docs/architecture.md](docs/architecture.md) |
| Layout (every folder, and which package may import which) | [docs/architecture.md](docs/architecture.md) |
| Skills, Sub-agents | [docs/agents.md](docs/agents.md) |
| Commands (which runner, every root and app command, a second dev server, running with AI turned off) | [docs/commands.md](docs/commands.md) |
| Adding a feature: follow the Items example | [docs/building.md](docs/building.md) |
| Effect (version 4), The model's blocks: what Verify reads, Tests | [docs/building.md](docs/building.md) |
| What the type-check enforces | [docs/laws.md](docs/laws.md) |
| Platform: Cloudflare Workers and D1, Identity and permissions, AI features, Comments and documentation | [docs/building.md](docs/building.md) |
| UI | [docs/ui.md](docs/ui.md) |

Paths in this file and in `docs/` that start `src/`, `test/`, `migrations/`, `public/` or `scripts/` are inside
`apps/inventory/`.
