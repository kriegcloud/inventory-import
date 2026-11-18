# Working in this repo

Standing context for any coding agent here (`AGENTS.md` points to it), in the order you need it: how we work and the
skills, then the import rules that shape the plan, then the code rules.

## What this is

A project built in one timed hour from the brief in `brief/`. The scaffold is already a working app of the kind a
brief like this asks for, built around a neutral example record: see "What is already there" below.

**The person's experience comes first.** The more the app does for the person using it, and the less effort it asks
of them, the better. Every other rule here serves that, or stays out of its way.

**The brief decides what gets built. Benjamin decides priorities.** When the brief and this file disagree, the brief
wins. When you are unsure what Benjamin wants, ask him ("Decisions by dialog" below) instead of guessing on anything
that costs more than five minutes to undo.

**Before building, read `docs/index.md` and the standards under "Read before building" in `docs/standards/`**:
Benjamin's rules, each with its check; the ones the person feels come first. Look up the rest, and `docs/reviewing/`
before calling a screen done.

## What is already there

The app runs before the brief arrives. `bun install && bun run dev` is the whole setup: no key and no secret to make
by hand (`bun run dev` writes the sign-in secret into `.dev.vars` the first time). What a builder starts from:

- **The frame**: a sidebar with the organization (a picker when there are two), the pages and the signed-in person's
  menu (theme, sign-out, the test accounts), a breadcrumb in the bar beside it, and `PageHeader` for each page's
  title row (`src/web/components/app/AppShell.tsx`, `AppSidebar.tsx`, `PageHeader.tsx`, `src/web/Workspace.tsx`).
  **The sidebar lists only screens that exist**: each is one line in `appPages` (`AppSidebar.tsx`) and one branch in
  `Workspace.tsx`.
- **Sign-in** (Better Auth: accounts, organizations, roles, sessions; [docs/auth.md](docs/auth.md)). In development
  the app opens already signed in as the first test account, Dana Whitfield, admin of Example Works (test),
  through a real session (`useDevelopmentSignIn` in `src/web/components/app/SignedIn.tsx`); the other test accounts are
  one click away in the user menu ("Sign in as a test account"). After a sign-out that tab shows the sign-in page. A
  production build always shows the sign-in page, and offers no test accounts.
- **The import of a file of Records**, in four steps, each its own file under `src/web/pages/import/`, on the page
  `src/web/pages/ImportPage.tsx` (the import and its step are in the address, so a refresh lands on the same step):

  | Step | File | What it does |
  | --- | --- | --- |
  | Upload | `UploadStep.tsx` | A .csv or .xlsx read in a worker and sent up in pieces, with progress and Cancel (`useUpload`, `@/lib/upload`); "Use items_messy.csv" (each sample its own button) and a download link; the open imports with Continue and Remove |
  | Match | `MatchStep.tsx` | Which file column fills which field, by heading, changed by hand; shown when a required field found no column. Review waits until every required field has a column and names the ones left |
  | Review | `ReviewStep.tsx`, `reviewAdapter.ts` | The review region (`src/web/components/review/`) on the rows: accept a proposal for a row or a group, pick one of two readings, type a value, keep one of two rows, leave a row out, undo and redo; the confirm button says what it will import |
  | Result | `ResultStep.tsx` | What the confirm did, counted from what is stored, the rows not imported downloadable with their reasons, and the take-back (a changed record is kept and named) |

  The server stages the file and runs the same pure `review` (`src/domain/ItemImport.ts`) at the confirm
  (`src/server/Imports.ts`, `ImportHandlers.ts`). Loading the same file again creates nothing: its rows are "Already
  there", counted from the stored code keys.
- **The Records page** (`src/web/pages/ItemsPage.tsx`): the data table paged, sorted and filtered by the server
  (`src/server/Items.ts`), one search box that finds every word in any order and forgives one wrong letter (a
  full-text index in the migration, `src/domain/ItemSearch.ts`), the table assistant (a request in words becomes a
  checked change to the view: `src/web/components/app/TableAssistant.tsx`, `src/server/TableAssistant.ts`), and an
  editor for one record (`ItemEditor.tsx`, editors and admins). With no key the assistant's fixed rules answer and
  it says so.
- **Activity** (`src/web/pages/ActivityPage.tsx`): every value an import wrote that differs from its file, who decided
  it, and the audit trail of uploads, imports, take-backs and changes of role.
- **People** (`src/web/pages/PeoplePage.tsx`): who is in the organization; an admin adds a person by the email they
  signed up with, changes a role or removes someone, and the organization always keeps an admin.
- **One model service** (`src/server/Ai.ts`) with **one daily allowance** (`src/server/ModelCalls.ts`, 40 calls a
  day per organization, taken before each call): every model feature draws on it, and when it is used up the feature
  says so in plain words and its rules answer. `GET /api/v1/system/status` says whether a model is on.

### Your first job: Record becomes the brief's thing

Right after the brief is committed and intake is done, turn the example **Record** (code, name, quantity, unit,
price, date, note) into the brief's own thing in one pass, before building anything else: the rename, its fields and
its rules, all at once, so nothing is left half on the example.

- **Rename** Record, `StoredRecord`, `RecordFields`, the Records page and the words on screen to the brief's noun.
- **Fields and rules**: `src/domain/Item.ts` (the fields, the `units` list, the readers for money, quantity and
  dates, the edit form); `src/domain/ItemImport.ts` (`fields`, `fieldLabels`, `requiredFields`, `headingWords`,
  `unitWords`, and each rule: `fault`, `proposeFor`, `ruleFor`, `toRecord`, the sums); `src/domain/ItemQuery.ts` (the
  columns that sort and filter) and `ItemSearch.ts` (what the search box looks in).
- **Storage**: the `record` table and the `recordSearch` index with its three triggers in `migrations/0001_init.sql`
  (edit that one file, then `bun run db:reset` once); `src/server/Items.ts` and `src/server/Imports.ts` (their
  column lists and statements).
- **Screens**: `ItemsPage.tsx` (its columns and the assistant's catalog), `ItemEditor.tsx`,
  `pages/import/format.tsx` and `reviewAdapter.ts` (the review's columns and problem kinds).
- **The sample** in `public/samples/` (`items_messy.csv`, `records.xlsx`): replace it with the brief's files.
- **The tests** that name the example (`test/domain/ItemImport.test.ts`, `ItemSearch.test.ts`, `TableView.test.ts`,
  `test/server/Imports.slow.test.ts`, `Items.slow.test.ts`, `Assistant.slow.test.ts`, `test/web/reviewParity.test.ts`,
  `tableView.test.ts`): change them with the rules, so they test the brief's rules.
- **What the rename left behind**, right after it lands. The standing documents still name the example's files, so
  find and correct each hit in `CLAUDE.md`, `README.md`, `docs/` and `.claude/agents/` (`RecordsTable`, a vendored
  component, keeps its name):
  `git grep -nE 'Record(s|Import|Query|Search|Editor|sPage)?\.(ts|tsx)|records\.(csv|xlsx)|recordsCatalog|readRecordForm|api\.records|queryKeys\.records|/records/' -- CLAUDE.md README.md docs .claude/agents`.
  Then search `src/` for sentences the example left on screen that are now false: `git grep -niw model -- src/web`
  (a sentence that says a model did what rules did) and the example's status words (`git grep -nE 'Needs you|Left
  out|Already there|Not imported|Taken back|Created' -- src/web`), and change each to the brief's words or remove it.

**A screen the brief has no use for is deleted, not hidden**: its page file, its branch in `Workspace.tsx` and its line
in `appPages` (so the sidebar never lists a screen that does not exist), its endpoints and service if nothing else uses
them, and its tests. Ask Benjamin before deleting one the brief does not mention.

### What the README says this started from

`README.md` has a section "What this started from" with a TODO in it. During the hour you replace the TODO with three
plain lines, in Benjamin's voice (the first person, "my own project starter"): that the app is built on his own
project starter, and what that starter held (name its parts); that a reference app he names is his own, if one was
used (say so by its repository's name); and that everything after the brief's commit is the hour's work. Nothing
else goes there. The final pack (and so `bun run checkpoint -- --final`) refuses a README that still has a TODO.

**The write-up comes last, and short** (`/decisions`). `README.md` opens with three parts, what the app is and for
whom, how to run it and what to try first, then the required sections; `DECISIONS.md` stays within its budget
(about 1,500 words) and speaks about the app and its choices: what the person gets, the rules, what was decided and
cut, what is known wrong or not verified. Never about how the hour was run: no sessions, roles, rounds, relays,
minute stamps, tooling incidents or branches that are not in the zip; say those in chat. Each checkpoint warns past
the budget or on those words. Before the last pack, walk the README's "What to try first" steps on the last
version, exactly as written, in the browser, and correct any step that does not behave as it says.

## How we work

- **One session or two.** One session is the default: you talk with Benjamin and build. When he would rather talk
  with one session while another builds, he types `/lead` there: that session starts one builder in this folder and
  steers it by message. A session whose first message says a lead started it is that builder ("Started by a lead").
- **Know the time.** `bun run clock` prints the minute of the hour, the next checkpoint and whether uploads are
  automatic. Run it before proposing a plan, before starting anything that takes more than five minutes, and before
  any summary. Building stops at minute 52, the write-up is done by 57, and the final pack by 58. The hour starts at
  the first commit that adds a file under `brief/` other than its README; until then the clock says "timer not
  started", so a commit made before the brief arrives does not start it. The upload page's own timer starts when
  Benjamin presses Start, usually a minute before that commit, and it is the one that ends the hour: when he (or the
  lead) gives the time the page showed, record it once with `bun run clock -- --page-start 08:28:58`; from then the
  clock shows page minutes first and the commit's minute beside them.
- **The brief comes in through you** (`/intake`): never open its page, read it before Benjamin says he has started,
  or press anything on it but the `uploader`'s upload control. Then take the brief and its list of files from that
  tab word for word, as `/intake` step 0 says (the page's text once, cut at the key section's heading before anything
  is written, never an element search on that tab), into `BRIEF.md` in `brief/`, commit it and begin; he saves the
  sample files there, and you fold each one in as it lands. The page's key section is not ours: no agent reads,
  copies or mentions it, its words or the names of its parts, in a file, a command, a commit or a message. The
  project's own key is already in `.dev.vars`, put there before the hour, and no agent reads or prints that file.
  **The brief stays as received**: once a file under `brief/` is committed nobody edits it, and nobody amends or
  rewrites the commit that starts the clock (`bun run checkpoint` refuses both). When any check flags the brief,
  stop and ask Benjamin.
- **Plan before code.** For anything larger than a small fix, say what you will build, what you will leave out, and
  how you will check it. Ask for a go when the plan changes scope, and keep building what the change does not touch.
- **Smallest thing that is true.** A working plain version first, then improve it. Never leave the app broken between
  commits.
- **Use what exists before building.** Before writing a reader, a table, a review screen, an upload or a service,
  look for one: in this project (`docs/kit.md`, `docs/index.md`), and in a reference repository Benjamin has named.
  Where one does the job, wire it, or copy it whole and edit it in place.
  For a screen behaviour, use the template's own helper first: `useUpload` (a file read in a worker and sent up in
  pieces, with progress and Cancel),
  `useSavedProgress` (a refresh loses nothing), the review region's undo, `sayError` (words for any failure).
  Building a second one is a decision for him, with the reason the first does not fit. A brief to `frontend` or
  `backend` names the files to start from.
- **Commit at each working step** with a conventional message (`feat:`, `fix:`, `test:`, `docs:`, `chore:`) that
  describes the change to the app only ("feat: the review says why on every row"), never how the hour is run: no
  rounds, relays, sessions, the lead, minutes or agents (the history ships in the zip). Run
  `bun run check` before every commit, and `bun run format -- <your files>` if the format check fails. No git hook
  stops a commit while the check fails: if you make one, with `--no-verify` or without, say so with the reason in its
  commit message, in your message and in the write-up.
- **Prove it, then say it.** Check a change in the running app or with a test before calling it done. Report what you
  checked and what you did not. "Not verified" is an acceptable sentence. A claim you did not check is not.
- **Look at it.** A change to what the person sees is done only when it was seen on screen, on a named version, and
  your message says what you typed and what you read ("v0.3.1, row 12: typed 8 in Quantity, it reads 8 pcs, Ready").
  A test or an API call alone is not enough: it can pass on a field the screen does not use. Where nobody looked,
  the message says "not seen on screen". Never change stored rows by hand to reach a case: a look on a row you edited
  or seeded is not seen. Show the case from a real import on a fresh copy, or write "seen on a row edited by hand".
  On the first look at each version, read the reason text of every kind of row the review shows, not only the
  counts: a count can be right beside a sentence that is false.
  Look in the headless browser (`mcp__playwright__*`), never with the Claude in Chrome tools:
  Chrome is kept for the one upload tab, its brief and its uploads. `qa` starts its own headless browser
  (`playwright-qa`, in its agent file), so you can look while it runs; when its report says it had to use yours, look
  only after it reports. A frozen copy that is a production build opens on the sign-in page: its `Frozen copy:` line
  names the test account and password to sign in with. Run `/qa` after the baseline and after each addition.
  Screenshots go to `.scratch/shots/` (git-ignored) and stay there; what they showed is written down as text. At most
  six images are committed, only ones `README.md` or `DECISIONS.md` shows, each made small with `bun run shot`.
  `bun run check` refuses a PNG or JPEG outside `public/`, a seventh image, and one neither file shows.
- **Four planned checkpoints.** `/ship` makes one: a version, an annotated tag, its row in the session record's
  summary and a checked zip, whose absolute path you give Benjamin. Each has a latest minute; `bun run clock` names
  the next:
  1. by 5: the scaffold as it is, right after the brief is committed, before intake: `0.1.0`, proving the zip and the
     upload early;
  2. by 25: the first version a person can use end to end;
  3. by 45: a safe version to fall back on, not the end of building: building goes on to minute 50;
  4. by 58: the final one, after the write-up (`--final`).

  You may make one in between when a complete increment lands. On CHECKPOINT OVERDUE, checkpoint the last working
  commit before adding any scope. A version meant for the upload page that is not on it is printed in capitals with
  its path (the checkpoint, `bun run clock -- --short`): tell Benjamin at once; it is not done until the page has it.

  Plan the last version with code in it for minute 50, and never later than 52; a choice Benjamin made is not cut
  because minute 45 has passed. Keep one full pass on screen of that last code version for yourself, on its own
  frozen copy: the sample through every step to Confirm, the three numbers read (rows in the file, what the result
  says, what is stored), and what you typed and read said. The final checkpoint then holds only the write-up, and it
  comes after that pass. Never make it while `qa` has that copy marked in use: `--final` removes every frozen copy,
  so it refuses then, and you do not pass `--override-in-use` unless Benjamin says so in his own words.
- **Decisions by dialog.** A decision reaches Benjamin through the `AskUserQuestion` tool, never as a page to read
  followed by waiting. A round is at most four questions (the tool's limit), most consequential first; when more are
  open, a second round follows at once. A question on the data is one rule about one kind of record, in a sentence
  someone who is not an engineer can check against the task, with the task's sentence it rests on or "my inference",
  the count of rows it touches and one example. Two cases never share a question. Look in the files before any question
  on how records match or what a document means: a document often prints the number that links it to another. Two
  to four options, each a complete choice whose description says what happens to the person's data; yours first,
  its label ending "(Recommended)" and its description giving the reason. No option carries a minute count: it says
  what is gained, what is given up, and the checkpoint it must be in by. The tool adds "Other": what he types there
  is the decision. `header` at most 12 characters; `multiSelect` for "which of these go in". A message he types
  instead of answering is his decision in his words: record it, and do not ask it again. For example, "Comma qty":
  "What is "1,250" in a whole-number column? 14 rows, e.g. line 31, BOLT-M8." with "1,250 each (Recommended)": "the
  14 rows load as 1,250; the header says Qty (each)", and "Ask per row": "the 14 rows wait under Needs a decision".
  Without the tool (a run that is not interactive, or another agent program): the same round as numbered text, each
  with your recommendation worded so "yes" accepts it, then end the turn.
- **Never ask with nothing running.** Before a round, start in the background everything no open decision blocks:
  builder lanes, `qa` and `reviewer`, the next work item; one line before the dialog names them, and they keep
  working while it is open. A decision that changes what the person's data becomes is not built before he answers:
  the work it blocks waits, the rest goes on. A default built anyway is named as built in the question itself.
- **Write each answer down at once** in `DECISIONS.md`: question, options, your recommendation, his choice, his own
  words if any. `DECISIONS.md` is written in his voice and about the app, so no minute stamps there. "Who decided"
  says "I chose; the agent recommended the same", "I chose against the recommendation" or "Mine, in my words:
  "…"", never just "mine"; every row that waited on it, the trap table's too, says what he chose. One not answered
  stays "not decided" with your default named, is asked again every round, and is never written up as his. With a
  lead, his answer comes in its relay with his words quoted, and a data question the lead settled itself and told
  him of reads "the agent's default; I was told". Log what was built and cut, and why.
- **Product decisions are Benjamin's.** What a rule means, which outcome a kind of row gets, who may do what, what to
  cut, a threshold, how an ambiguous value is read, what a second load does to a changed record: each is his, not a
  default, even one that only holds rows back. Each goes into `DECISIONS.md` as "not decided" when it comes up;
  `bun run clock -- --short` counts the ones waiting, and no sentence says he decided them all while one is open.
  The brief's required behaviours are gates (the intake lists them): a plan, a work order or a cut that would drop
  one is a decision for him, with the brief's sentence, even when the cut is his. Never a silent cut.
- **Decision rounds** come at four moments, listed once under "The four decision rounds" below, and whenever three
  wait or building cannot go on without one. At a checkpoint: start `reviewer` and the next item, take your one
  look, start `qa`, then at most eight lines and the round. A finding from `qa`, `reviewer` or a
  lane: fix at once only what blocks the person; each other one is an option in the next round, most harmful first,
  those past four listed in its text, marked fixed or open. You do not pick which he sees.
- **Late notes.** After minute 35, notes about the screen that do not fix a wrong result go to the screen lane as one
  brief, capped: the notes in order of value, one commit per item, and whatever is not committed by minute 50 goes
  into the write-up ("With another hour"). Say so to Benjamin when a note arrives. The hour's last minutes are for
  what the person cannot do or is told wrong.
- **Finishing early is not finishing.** A plain version can be done in a quarter of the hour. When the plan is
  done, say so and run `/next`. Do not write the final summary until Benjamin says the building is over. The final
  message always says what nobody verified on the final version, and each place you were wrong in the hour, with its
  minute and who caught it.
- **Started by a lead.** When your first message says a lead started you, you are its builder: this file applies
  unchanged, with these differences.
  - Your first act is one message to the lead, "builder ready". Address it with `SendMessage` by the `local_…`
    session id of the session that started you (the brief or the app gives it), never by `parent` or a name.
    Without `SendMessage`, say so in one line here, where Benjamin can open this session, and work as one session.
  - You never ask Benjamin by dialog (`AskUserQuestion`), even when he writes to you and asks you to: the lead puts
    every round to him, in its own session, so each question is asked once and answered once. A decision goes to the
    lead as one message: the question; the options, yours first with its reason; the evidence (row numbers, counts);
    and what is blocked until it is answered. Keep everything else moving. Its relay quotes his words: write those
    into `DECISIONS.md`.
  - **Short turns.** A message from the lead reaches you only between your turns, so end your turn as soon as you
    have started lanes, sent a report or made a commit, and never stay in one turn longer than five minutes of the
    clock: a lane's hand-back starts your next one. Before any wait (a lane, a check, a server starting) and at
    minutes 10, 20, 30, 40, 45, 50 and 55, end the turn so the queued messages are read, then act on them first.
  - Report to the lead when intake is done (round one's questions), when the plain requirements work end to end, at
    minute 44 with the three numbers, at minute 54 with what nobody has verified and the three numbers read on the
    last code version's own copy, and at once whenever something you told it turns out wrong.
  - The browser tab for the upload page is yours: when the lead asks, open one empty tab (`/intake` step 0) and say
    so; Benjamin loads the page there, and after the brief only the `uploader` touches it.
  - When Benjamin writes to you directly, answer him there in a few lines and act on what he decided; then tell the
    lead at once, in one message, what was decided, in his words. A request to put questions to him is passed to the
    lead the same way, as one round: say so to him in one line, and ask nothing yourself.
- **Never** commit a secret, push or deploy unless Benjamin asks in that message. Upload only as `/ship` says: once
  Benjamin has said in this session that checkpoints are uploaded, and only a zip that passed its checks.

## The four decision rounds

The one list of them. In one session you ask each (`/intake`, `/ship`, `/decisions`); with a lead, the builder sends
the lead what comes in first, and the lead asks (`/lead`). Each round is one `AskUserQuestion` dialog of at most four
questions, most consequential first, as "Decisions by dialog" says. Before it, what no open decision blocks is
running, and someone has looked at the app on screen.

| Round | When | What comes in first | The questions, the recommendation first in each |
| --- | --- | --- | --- |
| 1. The plan | When `/intake` is done | The required behaviours, the two totals, what already exists | Safe, Balanced or Ambitious; then the standing calls and the inferences |
| 2. The reach | When the plain requirements work end to end, by the checkpoint due by 25 | The frozen copy's address; what was typed and read on it | The reach (what the person will see, who it is for, the safe alternative it replaces); the first change on the screen (`multiSelect`, Other for what he saw); each default not yet decided |
| 3. The last ten minutes | Page minute 45, the checkpoint due by 45 | The three numbers, read on the frozen copy before `qa` starts on it: rows in the file, what the result screen says, what is stored | "Close the difference only" (when they differ), "Finish the reach" or "Stop and write up"; the open findings (`multiSelect`, "which go in now"); each default still not decided, its last chance |
| 4. Anything to write down | Page minute 55, never earlier, once the last version with code has its frozen copy and `qa` and `reviewer` are on it | What nobody has verified on that version; the three numbers read on its own copy | "Is there anything you saw on the final version that should be written down?" Never skipped: `bun run checkpoint -- --final` refuses until his answer is recorded (`--last-look`) |

## Session record

Hooks in `.claude/settings.json` run `scripts/session-log.mjs` for every agent. It records Benjamin's prompts in
full, his dialog answers (headers, the options he chose, his words), delegations, skills, commands with pass or fail
and edited paths; never other tool output, file contents or environment variables, and it redacts as it writes:
private markers (written `[private]`), paths outside the project, network names, keys and emails. A report the
harness relays is never counted as his prompt. `bun run session` (run by each checkpoint) renders it to
`docs/session/`, evidence written by the hooks: never edit `.session/` or `docs/session/` by hand, and never write a
claim into them. When the private-marker check stops a checkpoint, it names the file, the line and the kind of event
that matched, never the text: run `bun run session` again (it writes markers as `[private]`), and for any other place
tell Benjamin. Run checks unpiped (no `| tail`): a pipe hides their exit code.

## Skills

Skills are in `.agents/skills/`, linked into `.claude/skills/` and `.codex/skills/`. Some are ours; the rest are other
people's, vendored with only their commands written for bun (`.agents/skills/README.md` credits them), so this table
says how each is used here.

**Three skills only Benjamin can start**: `/in-your-own-words`, `/grill-me` and `/unslop` are set so no agent can run
them (`disable-model-invocation`). He types them at the start of a message. No step here waits for one: where the
table names one, mention it to him once as optional and go on. `grilling` is the one you can run yourself, to put
open decisions to him as questions ("Decisions by dialog"). `/lead` is his to type as well, in the session he will
talk to; no agent starts it, a builder least of all.

| When | Skill | In this hour |
| --- | --- | --- |
| Before the hour, when Benjamin wants to talk with one session while another builds | `/lead` (his to type) | That session starts one builder in this folder and steers it by message: it keeps the clock, looks at the app, relays his notes and puts the four rounds to him; the builder does the rest of this table. Without the tool that starts a session, one session, as here |
| The brief arrives | `/intake` (Benjamin may type `/in-your-own-words` after it) | The brief's definitions quoted word for word, every row rule traced to one or marked as an inference, counts in the brief's own outcome names, what already exists for each required behaviour (this project, a module, a named reference), three plans that build only what is left, asked as round one while the work no decision blocks starts |
| Benjamin names reference repositories | `/references` | One read-only agent per repository he lists; one table mapping each requirement to files worth reading; then what to use, asked by dialog. Where a file already does the job, copy it whole and edit it in place. Keep a ledger as you go: one line per reference file the moment you use it (copied whole, functions taken by name, or the pattern only), in the same message as the work, unasked. The write-up names a reference by its repository's name and, for someone else's, its licence, never by a path on this machine, and never calls copied code written from scratch. Check the licence of anything that is not his first |
| Before building, when a real decision is still open | `grilling` (or Benjamin types `/grill-me`) | Here a grilling round is asked through `AskUserQuestion`, not as text: one question per frontier decision, recommended answer first, at most four per call. Each answer goes into `DECISIONS.md` at once |
| After the baseline and each addition | `/qa`, `/verify` | Browser and inspector; then the API attacked by the verifier |
| Each of the four planned checkpoints | `/ship` | `bun run checkpoint`, then the `uploader` agent puts the zip on the upload page if Benjamin said so in this session; otherwise he gets the path |
| A bug survives one fix | `/diagnosing-bugs` | Reproduce first; no second guess without evidence |
| A screen looks generic | `design-taste-frontend` | App screens only: read its `references/app-screens.md` and run `inspect.mjs --app`. Never its page build (pictures and fonts from the network; our policy blocks them). Where it and "UI" below disagree, "UI" below wins |
| Before hand-building a component | `shadcn`, with the `shadcn` MCP server | Look it up in `@shadcn`, `@diceui` and `@tablecn` first (the MCP tools, or `bunx shadcn@latest search`). Add it with the CLI, `yes n \| bunx shadcn@latest add <item>`, then `bun install --lockfile-only`. Never `--overwrite`. Steps in `docs/kit.md` "Finding and adding a component". Where it and "UI" below disagree (`cn` comes from `"cn"`, status is `StatusPill`), "UI" below wins |
| Sign-in, sessions, organisations or roles | The six Better Auth skills, with the `better-auth` MCP server for its docs | Sign-in is installed: read [docs/auth.md](docs/auth.md) first; where a skill disagrees with it, it wins (the skills assume a framework and a database the CLI can reach). After adding a plugin or field, `bun run auth:schema` prints the migration to add |
| The plan is done early | `/next` | |
| Before the write-up | `/quality-review-fix-loop` | Seven read-only reviewers in parallel, then fixes by file ownership. One round inside the hour. Product findings come to Benjamin, not to a fixer |
| The write-up | `/decisions` | On `README.md` and `DECISIONS.md` only. It needs nothing only Benjamin can start; `/unslop` is his to type if he wants it |
| Adding or changing anything under `docs/` | `okf-open-knowledge-format` | Frontmatter with `type`, `title`, `description` and an honest `generated`; list the file in its folder's `index.md`, then `bun run docs:check`. Links inside `docs/` are relative (`../kit.md`), never `/`-rooted: the bundle is not the repository root. Its validator runs through that script: do not install okflint in the hour |

## Sub-agents

The agents in `.claude/agents/` each read their own rules: a brief never restates them.

- **`backend`** builds everything outside the browser: `src/domain`, `src/api`, `src/server`, `migrations` and their
  tests. **`frontend`** builds screens in `src/web` from the installed components.
- **Who writes what.** Write the Schemas and the contract in `src/api/` yourself and commit them first (while a round
  is open, `backend` writes them in the background); then screens and server can be built at once. Hand the server
  work to `backend` when it pays: more than one service, more than about ten minutes of work, or whenever `frontend`
  is building screens at the same time. A single service with a few queries, or a rule you can write in less time
  than a brief takes, write yourself. Screens go to `frontend` once the contract is committed; before it, only a
  skeleton on the installed components.
- **A brief is three lines.** No standards, no rules from this file, no code: the agent file holds them.
  ```
  Build: <what, for whom, and the one rule that must not break, in the task's words>.
  From: <committed Schemas and contract; DECISIONS.md "What the data does" for row rules>. Done: <the test or check>.
  Decided: <what Benjamin decided, quoted>. Open: <not decided: not built; name any the work could not avoid>.
  ```
- **A split has owners and a hand-back.** Every work item has exactly one owner: it is in that agent's Build line,
  or it is yours. Never edit a running agent's files: its check breaks, and its work gets committed half done. A
  change it needs goes in its next brief, or waits for its hand-back. Each lane, yours too, formats only its own
  files (`bun run format -- <files>`), never the whole tree. A lane that adds, changes or relies on a
  contract field names it in its hand-back, with what the other lane must read or write there. The other lane
  confirms that it uses that field. If it has already handed back, give it the field in a one-line brief, or make the
  change yourself now that it has stopped. Before you call work both lanes built done, hold their hand-backs side by
  side: a field only one of them names is not done.
- **`reviewer`** reads what changed between two checkpoints and reports at most ten defects, ranked by harm.
- **Test each checkpoint while you keep building.** A checkpoint leaves its tagged version running as a frozen copy
  and prints its address and folder. Start **`reviewer`** on it in the background at once, and **`qa`** (through `/qa`)
  after your own look if you take one (it has its own browser), each with the address, the folder, the tag, the tag
  before it and the brief. They only report; neither writes code. Each marks the copy in use while it works
  (`bun run checkpoint -- --use v0.3.0 qa`, cleared with `--done`), so no checkpoint removes it under them. Keep
  building. When one hands back: fix at once
  only what blocks the person, put the rest in the next round, and check each finding against the current code
  before fixing it, because the code has moved on since that tag. When building stops, the last code must have been
  looked at: checkpoint it if it is not a version already, start both on that copy, and draft the write-up
  meanwhile. "Not verified" is written after they report.
- **`qa`** and **`verifier`** run through `/qa` and `/verify`; **`uploader`** only through `/ship`.
- Each hand-back ends with one line, "Needs the person: …" or "Needs the person: nothing". Pass it on unchanged.

## Rules for an import

An import is judged on being coherent for the person importing the file. These rules cover where an import usually
goes wrong.

- **The task's words are the data model.** Where the task says what one record is ("each row is one ..."), tables
  and keys follow it literally: two rows that look alike are still two records, never merged, summed or dropped
  unless the task says so. A row rule that rests on your inference, not on a sentence of the task, is a question for
  Benjamin before it is built.
- **The person decides; the app proposes.** Never change a value silently. Every normalisation (a unit spelling, a
  date format, a trimmed code, a guessed match) is shown as before and after, can be accepted for all similar rows
  at once, and can be rejected. If two readings are possible (03/04 as a date, the newer of two revisions, which of
  two duplicates wins), it is a question for the person, not a default. A question with no default may still carry a
  suggestion, said in words with its reason ("40 L, as 6 of 7 lines say (suggested)"), never preselected.
- **One decision where one settles a column.** When one reading explains a whole column or file (a date format, a
  unit spelling), propose it once with its evidence as counts from the file, before any question row by row, and list
  the rows it does not explain for a look. A row the proposal does not explain is never loaded without a word.
- **The task's outcomes, and they add up.** Use the task's own names for what happens to a row when it gives them;
  otherwise Ready, Needs a decision, Cannot import. Its sentences decide which rows go where, and every count on
  screen and in the write-up uses those names. They add up to the rows in the file, shown on screen. Offering a fix
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
  or asks is Benjamin's decision, asked at intake with the other standing calls (`/intake`), and said before Confirm.
- **Money is whole cents read from the digits**, never `Math.round(Number(x) * 100)`: "1.005" becomes 100.
- **Check the domain rule, not just the type.** A quantity of 21.5 is a number and still wrong for an item counted
  in Each. Ask what each column means for this business before accepting it.
- **The sample file is one click away.** Copy each sample from `brief/` to `public/samples/`. The first screen offers
  "Use the sample file", which loads it through the same code path as a chosen file, and a plain download link beside
  it. Whoever opens the app should reach the review without hunting for a file.
- **Read everything in the file**: notes sheets, remarks, header blocks and footers often hold the rule that
  decides a case.
- **What the brief says already exists** (reference data such as a catalogue) is a seed migration for
  `org_prairie` only, so `org_northline` proves tenancy. Generate the `INSERT` migration from the brief's file with
  a short throwaway script; do not type rows by hand. If the brief names the person, rename the seeded member in
  that migration.
- **Say only what you checked.** A claim in `DECISIONS.md` that the server re-validates is checked by sending the
  server a bad row.

## Commands

**Which runner.** Run scripts with `bun run <script>`, install with `bun install`, and one-off tools with `bunx`. The
README leads with bun and says npm works too; the clean copy of every pack and checkpoint proves that npm path.
Vitest, the dev server and Wrangler always run on Node, never under Bun's runtime: no `bunx --bun`, and never
`bun test`, Bun's own runner (`bun run test` runs Vitest on Node, where the sign-in, database and Worker tests pass).

| Command | What it does |
| --- | --- |
| `bun run dev` | Applies local migrations and the test accounts, then serves the app and API on http://localhost:5173, signed in by itself as the first test account |
| `bun run check` | The loop check: type-check with Effect diagnostics (the hour profile), lint (with the two design lints), format check, the images rule and the fast tests, in a few seconds. Before every commit |
| `bun run check:full` | Everything: the type-check, lint (with the two design lints), format check, every test including the slow ones (`*.slow.test.ts`) and `docs:check`. The clean copy of every pack and checkpoint runs it |
| `bun run check:strict` | The Effect diagnostics at production severity, grouped by rule with a total. A measurement in seconds: it never fails. `-- --all` lists every finding |
| `bun run shot -- <png> [name]` | One screenshot made small enough to commit: a WebP in `docs/qa/`, at most 1440 px wide and 150 kB. At most six in a project, each shown in `README.md` or `DECISIONS.md` |
| `bun run lint:shadcn` | The design-system lint alone. `bunx oxlint --disable-nested-config --deny-warnings -c .oxlintrc.shadcn.json <folder>` for one folder. Fixes: `docs/kit.md` "The two design lints" |
| `bun run docs:check` | Checks that `docs/` is an Open Knowledge Format bundle (the OKF skill's validator). Needs bash |
| `bun run typecheck` | Type-check with tsrs plus the Effect diagnostics (under a second) |
| `bun run format` | oxfmt, writes files: `bun run format -- <files>` for only yours, since a bare run rewrites every lane's files. `format:check` only reports. `bun run lint` is oxlint |
| `bun run test` | Every test, fast and slow (Vitest, Node). `bun run test -- --project fast` for the fast ones only |
| `bun run build` | Type-check with `tsc -b` (patched with the same Effect diagnostics), then the production build |
| `bun run dev:https` | Optional. The dev server over HTTPS with a local certificate (mkcert), so an `https:` origin, Secure cookies and HSTS behave as deployed. `bun run dev` needs none of it |
| `bun run build:report` | The browser's build, then each chunk's makeup by package, largest first (`-- index` for one chunk); the treemap is `.scratch/bundle/client.html`. Read it before moving code between chunks |
| `bun run preview` | Builds and serves the production build on http://localhost:4173, with security headers, compressed (brotli, else gzip) as Cloudflare serves it; `PREVIEW_COMPRESSION=off` for the raw bytes |
| `bun run lighthouse` | Lighthouse on the production build, mobile and desktop, in under a minute. `-- /path` for another page. Prints the scores and every audit that scored below 100 |
| `bun run telemetry` | Optional, Benjamin's to start (needs Docker): Grafana's LGTM stack, then `OTEL_EXPORTER_OTLP_ENDPOINT` in `.dev.vars` sends the Worker's and the browser's traces, metrics and logs to it. Never part of `bun run dev`; `telemetry:down` stops it |
| `bun run db:reset` | Deletes the local database and re-applies migrations. **Restart `bun run dev` afterwards.** |
| `bun run checkpoint -- "<sentence>"` | A checkpoint: bumps the version in `package.json`, writes the session record (and a Timeline row, only where `DECISIONS.md` keeps a Timeline), commits and tags `v<version>`, then packs `submit/<folder>-v<version>.zip` and prints one line with its absolute path. `--final` for the last one, `--hold` to pack without uploading, `--status` for the list. Undone if the zip fails its checks. Meanwhile the tagged version starts as a frozen copy in `.frozen/` on its own port (its address and folder are printed) for `qa` and `reviewer`; the next checkpoint keeps it running and stops any older copy not marked in use, `--final` and `--stop` remove them all and so refuse while one is marked in use (`--use v0.3.0 qa` marks, `--done v0.3.0 qa` clears, `--in-use` lists them with any stale ones; `--override-in-use` only on Benjamin's word). It warns when the write-up is over its budget or speaks about how the hour was run |
| `bun run pack` | Builds a zip (with `.git`) in `submit/` from committed work only, and checks it from a clean copy. `-- --early` allows an unfinished write-up. Untracked files are listed, not packed. If the clean-copy check fails it prints the failing step's output |

If you add or remove a dependency, do it with `bun add` or `bun remove`, then run
`bunx npm@11.19.1 install --package-lock-only`, so `bun.lock` and `package-lock.json` both stay true: the README's
npm path installs from the second.

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
public/samples/  The sample files the Upload step offers (the example's items_messy.csv until the brief's replace it).
brief/        The brief and sample files exactly as received.
docs/         Standards, the kit, patterns, the glossary and sign-in (`docs/index.md` lists them); qa/ and session/ are evidence.
.agents/      Skills (see above). Not application code; the check ignores it.
```

Dependencies point one way: `web -> api -> domain` and `server -> api -> domain`.

## Adding a feature: follow the Records example

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

- Services: `class X extends Context.Service<X, Shape>()("takehome/server/X") { static readonly layer =
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
spelling, API preference or naming is only a suggestion in the hour, and `bun run check:strict` counts it.

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

**What production would enforce, and the hour does not.** Follow these when it costs nothing; never stop to fix one.
`bun run check:strict` measures the code ones:

- The Effect modules for strings, arrays and records (`import { Array as Arr, String as Str } from "effect"`):
  `Arr.map(xs, f)`, `Arr.findFirst` (an Option), `Str.trim(x)`, `Record.toEntries(r)`.
- `Effect.fn("Name")(function*(...) { ... })` for every Effect-returning function, so each is a span. Yield, then
  call: `const now = yield* DateTime.now`, then `DateTime.formatIso(now)`.
- Time from `Clock` or `DateTime`, randomness from `Random`, ids from `SecureRandom` (`effect/crypto`), logs through
  `Effect.log`, never `console`.
- Schema classes carry a brand (`Schema.Class<X, { readonly brand: unique symbol }>("X")(...)`), and are built with
  `.make`, not `new`.
- Service keys follow the file path (`"takehome/server/Activities"`); a two-argument exported helper is dual
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

- **In the hour, write three to six tests**, only for rules where a wrong result hurts the person: a count, a total,
  a match, a unit, a permission that guards a write. None for plumbing or screens. Many inputs: one `it.prop` from
  the Schema; anything timed: the `TestClock`; HTTP: the Worker's own `fetch` (`send`, `test/server/support/app.ts`).
- **Fast by default.** A test that needs sign-in or a real database is slow: name it `*.slow.test.ts`, and write it
  only when the rule cannot be shown another way. `bun run check` runs the fast tests; `bun run check:full` runs all.
- **Tests run in Node under the same Effect rules.** Read a sample file with
  `import text from "../../brief/items.csv?raw"`. `node:fs` fails `bun run check`; for a binary file (a PDF) make the
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

- **The app must be complete without a key.** The provided key stops working shortly after the hour, and whoever
  runs this later will not have one. Every AI feature has a non-AI path that is good on its own, and the UI says
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
  `warning`, Cannot import `danger`, Imported `success`, Already there `neutral`, Draft `outline`. Use the brief's
  word when it has one. The example's words are each set once: the review region's defaults (Needs you, Can't fix
  here, Ready, Left out, All, Already there, …) in `defaultReviewWords` (`components/review/words.ts`), passed as
  `words` on the region, and the import's (Created, Already there, Not imported, Taken back, All) in `importWords`
  (`pages/import/format.tsx`): change them to the brief's there, and nowhere else.
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
- **Rename the shell first**: `AppShell` `title` (in `App.tsx` and `Workspace.tsx`) and `<title>` in `index.html`
  name the job, not "Takehome". **The `h1` is the job** ("Review records"); the file name, row count and duplicate
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
  document's and the model's. In the hour these two are required only on new domain schemas; the rest has them.
- **`@example` on exported pure helpers** whose use is not obvious, showing a real value from the sample data.
- **A file that holds a decision opens with it**: two or three lines on the file's role and the one thing a reader
  must not break (see `src/server/Identity.ts`).
- **React components**: one line on what the person does with it. Document a prop only when its name is not enough.
- Explain *why*, and what was rejected. No commented-out code, no `TODO` without a name and a reason, no
  `@since`, `@category` or `@author` tags: there is no doc pipeline here to read them.
