---
name: qa
description: Test the running app in a real browser with the qa agent, write down what it saw, and bring the findings to Benjamin. Use after the baseline, after each addition, and on the last version when building stops.
---

# QA: look at it before saying it works

Tests and `curl` prove the rules. Only a browser proves the app. Skipping this ships defects that two minutes of
looking would catch.

1. Choose what to test. Right after a checkpoint, its frozen copy: the address and folder on the `Frozen copy:` line
   (`bun run checkpoint -- --status` prints it again). Start the `qa` agent in the background and keep working; it
   never waits on you and you never wait on it. Otherwise make sure `bun run dev` is running and note its URL.
   It has its own browser, so your look and its pass can overlap. On a frozen copy it marks the copy in use while it
   works, so no checkpoint removes it mid-pass; a production build opens on the sign-in page, and the `Frozen copy:`
   line names the test account to sign in with.
2. Start the `qa` agent with: the URL (and the frozen copy's folder and tag, when it tests one), what changed since
   the last QA pass (`git log --oneline` since then), who the user is and what they are trying to get done (from the
   task), and which sample file to use.
3. While it runs, do not sit idle: run `bun run check` (the loop check), and measure the screen:
   `node .agents/skills/design-taste-frontend/scripts/inspect.mjs <URL> --app --out .taste-skill/inspect`.
   It needs no browser tool (it drives the installed Chromium), takes about ten seconds, and writes screenshots at
   1440, 768 and 390 pixels plus a list of FAIL and WARN findings. Open the desktop screenshot yourself. A FAIL is
   a finding; a WARN is fixed or defended in one line.
4. Ask the newcomer question, about a minute: a fresh agent sees only the 1440 screenshot from step 3 and nothing
   of this repo. From an empty folder, for a second model family:
   `codex exec -s read-only --skip-git-repo-check -C <empty folder> -i <absolute image path> "What is this screen
   for, what would you do next, and what on it can you not explain?" </dev/null`. A wrong purpose or next step
   fails; each thing it cannot explain is a finding. The method: `docs/reviewing/screen-review.md`.
5. When it reports, fix at once only what blocks the person. Every other finding goes to Benjamin in the next
   decision round (`CLAUDE.md` "Decisions by dialog"), none dropped: an option each in a `multiSelect` "which go in
   now", most harmful first, each with what its fix gives up, the ones you would fix now marked "(Recommended)"; past
   four, the rest one line each in the question's text. Its last line ("Needs the person: …") goes into that round
   unchanged. A finding on a frozen copy is about that tag: check it against the current code before fixing it.
6. After fixes, run it again on what changed. A fix that was not looked at is not a fix.
7. Commit `docs/qa/QA.md` with the code it describes: what was seen is written there as text (what was read from
   the page, at what window size, on which version). Screenshots stay in `.scratch/shots/` and the inspector's in
   `.taste-skill/`, both git-ignored: every committed image is in the zip twice, as a file and in its history, for
   good. Before the write-up, pick at most six that `README.md` ("A look at it") or `DECISIONS.md` will show, make each
   small with `bun run shot -- .scratch/shots/<file>.png <name>` (a WebP in `docs/qa/`) and show it there.
   `bun run check` refuses a PNG or JPEG outside `public/`, a seventh image, and one neither file shows.

If there is no browser tool in this session, say so plainly and ask Benjamin to click through while you watch the
dev server's log. Never report a UI as checked when nobody looked at it.
