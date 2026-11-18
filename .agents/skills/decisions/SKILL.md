---
name: decisions
description: Bring DECISIONS.md in line with what actually happened, from git history and the running app. Use once, for the write-up, after Benjamin says the building is over and before the final pack.
---

# Decisions: make the write-up true

`DECISIONS.md` is read before the code is. It must match the repo exactly, and it is about the app: what the person
gets, the rules, what was decided and cut, what is known wrong. Write it last and short: about 1,500 words in all,
and `README.md`'s own part (before its reference sections) about 900. Never about how the hour was run: no sessions,
roles, rounds, relays, minute stamps, tooling incidents, or branches and worktrees that are not in the zip; tell
Benjamin those in chat. Each checkpoint prints a WARN past the budget or on those words: rewrite the sentence about
the app, or cut it. This step needs nothing only Benjamin can start: run it yourself. He may type `/unslop` on
`README.md` and `DECISIONS.md` afterwards; mention that once, as his option, and do not wait for it.

1. Read `git log --stat`, the current `DECISIONS.md`, and `docs/session/SUMMARY.md` after `bun run session`. Make sure
   `qa` and `reviewer` are running on the frozen copy of the last version of the code (`CLAUDE.md` "Sub-agents"); if
   the last code is not a version yet, checkpoint it first.
2. For every claim under "Where it stands", check it: run it, test it, or find the code. Move anything you could not
   confirm to "Not verified". Remove anything that is not true.
3. **Every figure is read again before it is written**: a count, a total, an amount of money, a number of rows,
   accounts, people or tests. Read it from the running app (the screen or the API), the seed or a check's output,
   now, not from memory or an earlier message. Write where it came from next to it. A figure you could not read again
   is left out. The `--final` checkpoint warns where a count of tests or people differs from its check or the seed.
4. For every commit that made a real choice, make sure the choice and its cost are written down. "How I worked with
   my agent" is at most five lines, each pointing at the commit it shows in; no minutes, no roles, nothing copied
   from the session record.
5. Fill gaps in "What I cut, and why" from the plan Benjamin chose at intake. In the "Who decided" table, each answer
   reads as `CLAUDE.md` "Write each answer down at once" says ("I chose; the agent recommended the same", "I chose
   against the recommendation", "Mine, in my words: "…""), never just "mine". Bring in the lead's list of what was
   promised for the write-up, when the hour ran with one, and check each item is there. One he never
   answered stays "not decided" with the agent's default named, never his, and while one is open no sentence says he
   decided them all. A row anywhere in `DECISIONS.md`, the trap table in "What the data does" too, that says "not
   decided" for one he answered now says his decision.
6. Code copied or adapted from a reference is never described as written from scratch. The reuse table is the
   ledger `/references` kept: one row per file used, and after its name exactly three columns, "Copied whole (what
   changed here)", "Functions taken" and "Pattern only", so no heading can claim more than came. It names each
   reference by its repository's name and, for someone else's, its licence, never by a path on this machine.
7. Keep his wording where he wrote it. Propose edits to his sentences; do not rewrite his reasons.
8. **Checks, as they ran**: under "Where it stands", say which tier ran when (`bun run check` in the loop,
   `npm run check:full` in each checkpoint's clean copy) and quote the final `check:full` result as printed. Name
   every commit made while the check failed, with `--no-verify` or without (no git hook stops one), and why:
   `docs/session/SUMMARY.md` counts the `--no-verify` ones, and the session record has each check's pass or fail.
9. **Production hardening, measured**: run `bun run check:strict` once. Under "To make this production-ready", write
   its total and the rule names it lists. Make no claim about strictness without that number. That section and "With
   another hour" each open with what the app's user would get next, one line per item, before the engineering list.
10. **"Not verified" comes last**, after `qa` and `reviewer` have reported on the last version: their findings that
    were not fixed go under "Known wrong or missing", and what they did not test goes under "Not verified".
    **"Where my agent was wrong"** beside it: every claim about the app made in the hour that proved false or was
    taken back (a count, "fixed", "seen", "works"), and how it was caught (a test, the browser, Benjamin's look). Your
    messages and `docs/session/TIMELINE.md` are the source; the minutes and who caught it go in your final message,
    not the file. None found is written as "none found", never left out. No minute estimates anywhere in the
    write-up, and no minute stamps.
11. **Every sentence that names something is checked against the project.** In `README.md` and `DECISIONS.md`, each
    sentence that names a screen, a control (a button, a switcher, a filter), a file, a test or a number is held
    against the tree (`git ls-files`, `rg`) and the running app or a test's output. A control nobody can reach from a
    page, a file that does not exist, a test that does not check what the sentence says, or a number the data does
    not give: correct the sentence, or remove it. Read `README.md` whole, the parts the starter wrote too: a sentence
    about the starter as it was (the example Record, its sample file, a screen that was deleted) is rewritten for
    this app or removed.
    **"What this started from"** in `README.md` holds exactly three plain lines, written by you in the hour, and its
    TODO is gone: that the app is built on Benjamin's own project starter and what that starter held (the frame,
    sign-in, the four-step import, the Records page, Activity, People, the model service: name what it had, true of
    the commit before the brief); that a reference app Benjamin named is his own, by its repository's name, when one
    was used (leave the line out when none was); and that everything after the commit that added the brief is the
    hour's work. Check: `git log --oneline` shows that commit, and nothing in the three lines claims a part the
    starter did not have.
12. **The README is for the person running the app.** Its first screen says what the app does for its user, how to
    run it (`bun install` and `bun run dev` first, then one line that npm works too), and what to try first on the
    sample. The starter's kit is a short pointer to `docs/kit.md` below that, never the bulk of the page. Check:
    "What is in the repository" comes after "Run it" and its list is under 20 lines. Then walk "What to try first" on
    the last version in the browser, step by step exactly as written, and correct each step that does not do what
    it says (a control that is not there, a query its rules refuse).
13. **The last pass**, once the rest is written:
    - a number that appears twice is the same both times;
    - no minute stamp is left in `DECISIONS.md`, and no word about sessions, rounds or relays (the checkpoint's WARN);
    - "Works, and I checked it" lists nothing the tester reported wrong that nobody fixed;
    - coverage is said by version ("`qa` ran on 0.2 and 0.3, `reviewer` on 0.2"), never "every checkpoint";
    - every "seen on screen" names the version it was seen on.
14. Plain language, short sentences, no selling. Each line should be checkable in under a minute.
15. **The last look, at page minute 55**: round 4 of `CLAUDE.md` "The four decision rounds", never skipped, however
    late. Nothing that starts work. Once the last version with code has its frozen copy and `qa` and `reviewer` are
    on it, ask one question through `AskUserQuestion` (`CLAUDE.md` "Decisions by dialog"): "Is there anything you
    saw on the final version that should be written down?", with "Nothing more: write it as it stands
    (Recommended)" and "A known problem" (its description: describe it under Other); the question's text names what
    nobody has verified on that version. Started by a lead: send the lead that list, with the three numbers read on
    that version's own copy, at minute 54 instead; it asks, and its relay carries his answer. What he describes goes
    under "Known wrong or missing" in his words. Record his answer at once:
    `bun run checkpoint -- --last-look "<the option he chose, or his words>"`. The `--final` checkpoint refuses until
    an answer is recorded after the last checkpoint before it.

Spend at most five minutes on steps 2, 3, 11 and 13 (`bun run clock`): a claim not checked by then moves to "Not
verified". Then the final checkpoint (`/ship`, `--final`), and the final state in at most ten lines: the version and
what the page said, what a person can do, what is known wrong, what nobody verified on the final version, and each
place you were wrong in the hour, with its minute and who caught it. The last two are never left out: they are the
part he can least check for himself. No diff for him to read. Started by a lead, the same lines go to the lead.
