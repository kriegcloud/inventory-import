---
name: intake
description: Bring the brief in from its page once Benjamin has started, read it and the sample files in brief/, write the findings into DECISIONS.md, and put the plan and the first decisions to Benjamin by question dialog while the work no decision blocks starts. Use before the hour to open the tab for the brief's page, then once when Benjamin says the hour has started. Writes no application code itself.
---

# Intake: understand before building

Your job is to make Benjamin's decision easy, not to make it for him. Write no application code yourself in this
step: the lanes in step 10 do. The rules this applies are `CLAUDE.md` "Rules for an import" and "Decisions by
dialog", and `docs/standards/proposals.md`.

0. **Bring the brief in.** Before the hour, open one empty tab in Claude's tab group (`tabs_context_mcp` with
   `createIfEmpty`) and tell Benjamin it is there for the brief's page (started by a lead: tell the lead, when it
   asks); he loads the page in it himself. Never open that page yourself, never read it before he says he has
   started, and never press anything on it: only the `uploader` presses its upload control. The page also shows a
   key section after Start. It is not ours: never read, copy or mention it, its words or the names of its parts.
   The project's own key is already in `.dev.vars`, put there before the hour; nothing in the hour reads, prints or
   writes that file. Once he says he has started, take the brief in word for word, once:
   - **One call:** `get_page_text` on that tab, the only call on it. Never `find`, `read_page` or any other element
     search there: `find` searches the whole page and lists the key section's parts back, and `read_page` cuts each
     element's text at 100 characters, so neither can bring a brief in whole.
   - **Cut before writing.** In what it returned, find the key section's heading. Keep the page's text from the
     brief's title down to the line before that heading, and, when the list of files comes after the key section,
     from the list's own heading to its end. Everything from the key section's heading to the next heading of the
     brief is dropped unread: not written, not quoted, not summarised, not named.
   - **Write it with the file tool** (`Write` to `brief/BRIEF.md`), never through a shell command, and never echo
     it into chat: the session record keeps every command's text, and the key section must not reach it.
   - **The fallback**, when the tab cannot be read or the cut is not clear: say so in one line and ask him to paste
     the brief and its list of files into `brief/BRIEF.md` himself; read it from there.

   Commit `brief/BRIEF.md` with any sample file already in `brief/` (that commit starts the clock) and begin step 1
   at once, without waiting for the samples. He saves the sample files into `brief/` himself: look in the folder
   between steps (`ls brief/`), never ask, fold each file into the steps as it lands and commit it. From that commit
   on, the brief stays as received: nobody edits a committed file under `brief/`, and nobody amends or rewrites the
   commit that started the clock (`bun run checkpoint` refuses both). When a check flags a line of the brief, stop
   and ask him; never remove the line. Check: `brief/BRIEF.md` holds the brief and its list of files and nothing from
   the key section, your one Chrome call on that tab came after his message, and no command, commit or message of
   the hour carries a word of the key section.

1. **Quote the brief's definitions first.** Read the brief twice. Then copy, word for word, every sentence that
   defines a kind of record, a rule, or an outcome for a row (the brief's own words for ready, needs a decision,
   cannot be loaded), into a short table:

   | The brief's words | What the app must therefore do |
   | --- | --- |
   | "<the sentence, exactly as written>" | <what it means for the data model, a rule or the screen, in one line> |

   Read them literally. Where the brief says what one row is, two rows that look alike are still two records. The
   outcome names in this table are the names the app, every count and the write-up use.
2. **Profile every sample file with a script**, not by eye: row and column counts, types per column, blanks,
   duplicates of anything that looks like a key, inconsistent formats (dates, numbers, units, casing, whitespace),
   values that cannot be right (negative quantities, dates far in the future), and encoding or delimiter surprises.
   Report counts and two or three example rows for each finding. Read a workbook (.xlsx) with the installed reader,
   `readSpreadsheet` in `src/web/lib/spreadsheet` on SheetJS (`xlsx`; pattern 7 in `docs/patterns.md`), never with a
   reader you write yourself.
3. **Classify the rows in a trap table**, one line per kind of row the profile found:

   | Kind of row | Rows, e.g. line | Outcome, in the brief's words | Why: the brief's sentence, or "my inference" |
   | --- | --- | --- | --- |

   Every rule names the sentence of the brief it comes from, quoted, or says "my inference". Each inference is a
   question for Benjamin before it is built (`CLAUDE.md` "Decisions by dialog"). Under the table, the count for each
   outcome in the brief's own names, adding up to the rows in the file. A row that cannot be loaded as written counts
   there even if the app will offer a fix.
4. **One decision where one settles a column.** When a single reading would explain a whole column or file (a date
   format, a unit spelling, a decimal separator), propose it once, with its evidence as counts ("40 dates can only be
   month first, 3 only day first, 12 either way: month first"). List the rows it does not explain (here the 3) for a
   look. Never ask the same question row by row before proposing the
   file's answer, and never let an ambiguous row, or one the proposal does not explain, load without a word.
5. **The standing calls of any import**, raised even when the brief says nothing of them, each with its rows from the
   profile and your recommendation. You put them to Benjamin; you do not decide them:
   - what a second load does to a record that changed in the file: keep what is stored, update it, or ask;
   - two rows in the file that may be the same record;
   - a value that cannot be stored exactly (a quantity finer than the unit holds, a price past the cent);
   - what counts as a row or a line: headings, empty rows, a row with only a note.

   Then **the two totals, before anything is built**: what Confirm alone stores, and what is stored when every
   question is answered, each in the brief's own records (recipes and lines), with the answer you assumed per kind.
   Check: the rounds hold all four calls, each with its count of rows (0 is a count), and the chat has both totals.
6. **The "if you have time" items.** For each, say whether a rule can do it without a model (a format read from
   counts, a unit table, a near match by spelling) and what a model would add. The app must be complete without a
   key (`CLAUDE.md` "AI features").
7. **Name the person** who uses this app and what they are trying to get done, in two sentences.
8. **What already exists, before any plan.** For each required behaviour, look in this order and write down what
   you find:
   - **In this project:** `CLAUDE.md` "What is already there" first: the frame, sign-in with roles and organizations,
     the import of a file in four steps (upload in pieces, match, review, result with take-back, a second load
     "already there"), the Records page with search and the table assistant, Activity and People. Then
     `docs/kit.md`, `docs/index.md`, `src/web/components` and `src/web/lib`. Most required behaviours of an import
     brief are here already on the example Record: the column says which file holds each, and the plan's work is to
     turn it to the brief's records and rules, not to build it again.
   - **In a reference repository:** the ones Benjamin has named in this session (`/references`). If he has named
     none, ask once, as the last question of round one: "Are there reference repositories I should read before I
     build?", with "None: build from what is here (Recommended)" and "Yes: I name them under Other".

   | Required behaviour | Already in this project | A named reference has it | Left to build |
   | --- | --- | --- | --- |

   A plan builds only what the last column holds. Writing a second reader, table, review screen or upload where one
   of the first two columns has an entry is a call for Benjamin, with the reason the existing one does not fit.
9. **Answer in two places.** The long form goes into `DECISIONS.md` under "What the data does", with counts, so the
   write-up starts from evidence and a brief to the `backend` agent can point there: the definitions (step 1), the
   trap table with its counts per outcome and the one-decision proposals (steps 3 and 4), the standing calls with
   their rows and the two totals (step 5), the "if you have time" items by rule or by model (step 6), and what
   already exists (step 8). In chat, at most twelve lines: the person and their job;
   the **required behaviours**, each sentence of the brief that says what the app must do ("a second import of the
   same file adds nothing"), quoted, one per line; the two totals; what already exists here. The required behaviours
   are gates: no plan leaves one out, and cutting one later is a decision for Benjamin (`CLAUDE.md` "Product
   decisions are Benjamin's").
10. **Start what no decision blocks**, in the background, before you ask (`CLAUDE.md` "Never ask with nothing
    running"): the first job, the example Record turned into the brief's thing (its name, fields, the sample in
    `public/samples/` and the rules the brief states outright; `CLAUDE.md` "Your first job"), the domain, contract
    and migration by `backend` and the screens by `frontend` once those are committed, each brief's Open line naming
    the rules and screens still waiting on a decision.
11. **Round one**, through `AskUserQuestion` (`CLAUDE.md` "Decisions by dialog" and "The four decision rounds";
    started by a lead, the same questions go to the lead as one message). First the plan: one question whose three
    options are **Safe**, **Balanced** and **Ambitious**, yours first, each description one line on what is built,
    what is cut, and the checkpoint its plain version must be in by (`bun run clock`), with no minute count. Every
    plan keeps every required behaviour and starts from what already exists: it builds only what is left. Every plan
    begins with the same first job (`CLAUDE.md` "Your first job: Record becomes the brief's thing"): the example
    Record turned into the brief's thing in one pass, and each screen the brief has no use for deleted, so say in
    each option which screens it keeps and which it deletes. Sign-in is already in (in development the app opens
    signed in as the first test account): when the brief has no people, teams or roles, say so and keep it as it
    is. Then the most consequential decisions,
    inferences and the four standing calls included. More than four open: a second round at once, and more until
    none is left (with a lead, it chooses which four go first). Each
    answer goes into `DECISIONS.md` at once, and every row that waited on it, the trap table's too, says what he
    chose: a "not decided" left beside his decision is wrong in the write-up. He may type `/in-your-own-words` to
    have the goal restated first; nothing here waits for it.
