---
name: ship
description: Make a checkpoint. It versions, tags and records the committed work, builds a checked zip named with the version, and hands it to the uploader agent when Benjamin has said in this session that checkpoints are uploaded. Use at each of the four planned checkpoints in CLAUDE.md; in between only when a complete increment lands.
---

# Ship: a checkpoint

The upload page keeps the latest upload. Each checkpoint is insurance against a bad last ten minutes, and each
later one replaces it. So only a zip that passed its checks is ever uploaded: a broken upload would replace a good one.

1. `bun run clock`. Say the minute and the next checkpoint it names. If it says **CHECKPOINT OVERDUE**, add no scope
   (no new feature, no refactor) until this checkpoint is made.
2. Commit what is worth keeping, after `bun run check`. Do not commit a change that is half done and broken: the
   checkpoint ships the last commit and lists uncommitted edits as not in it.
3. `bun run checkpoint -- "<what this version contains, one sentence>"`. The sentence claims only what was checked:
   a change to the screen that nobody looked at on screen says "not seen on screen" (`CLAUDE.md` "Look at it"). Add
   `--final` for the last one, after the write-up: it refuses a `TODO` left in `README.md` or `DECISIONS.md` (the
   three lines of "What this started from" included: `/decisions` step 11), refuses until Benjamin's last look is
   recorded (`/decisions` step 15), and refuses while a frozen copy is marked in use (step 6). The command picks the
   version (`0.1.0` first, then minor for a new capability and patch for a fix), writes the session record (and a
   Timeline row only where `DECISIONS.md` keeps a Timeline; the template has none), commits them and makes an
   annotated tag, then builds the zip and checks it from a clean copy the way the pack does, with npm: `npm ci` and
   `npm run check:full`, the route someone running it fresh takes. On a failure it undoes the version and prints the
   failing step: fix that first. Never rename or upload a
   `DO-NOT-UPLOAD` zip. It also refuses, with STOPPED and what changed, while `brief/` is not as received: stop and
   ask Benjamin (`CLAUDE.md` "The brief comes in through you"), never fix it by rewriting history.
   While the zip is checked, the tagged version starts as a frozen copy on its own port; the command prints a
   `Frozen copy:` line with its address, its folder and, for a production build (which opens on the sign-in page),
   the test account and password to sign in with. It also prints a WARN when `README.md` or `DECISIONS.md` is over
   its budget or speaks about how the hour was run: fix that in the write-up, not by hiding the words.
4. Give Benjamin the command's last line as it is. It names the version, the minute, the commit, the absolute path of
   the zip, its size and what happens to the upload. If the command printed a size warning (over 5 MB) or a line
   with NOT UPLOADED, give him that line too, as it is.
5. Then do what that line says about the upload, once:
   - **automatic**: hand the path to the `uploader` agent with this brief: `Upload <absolute path> (v0.3.0, 4.1 MB).
     Benjamin asked for checkpoint uploads in this session, in his words: "<his words>". First upload of the session:
     yes|no.` It tries any zip up to 25 MB and answers in two lines. Record its RESULT: `bun run checkpoint --
     --record-upload v0.3.0 confirmed|not-confirmed|stopped "<its second line>"`. Tell Benjamin in one line:
     `v0.3.0 uploaded and confirmed: “<the page's sentence>”`, or the NOT UPLOADED line the record command prints,
     with the page's own words, as they are.
   - **NOT UPLOADED** (over the size the uploader tries, or uploads are by hand in this session): give Benjamin that
     line, in capitals, with the path. Do not call the uploader, try another route or look into why: the hour is
     worth more than the cause. When he says he dropped it in, record it: `bun run checkpoint -- --record-upload
     v0.3.0 by-hand "<his words>"`. Until then `bun run clock -- --short` keeps saying NOT UPLOADED.
   - **not asked** or **held back**: packed only. Say so.
   - After `--final`, the work is done only when the page confirmed the version or Benjamin dropped it in. Never
     report it as done before; if it is not on the page, say FINAL VERSION ... NOT UPLOADED with the path, as the
     command prints it.
6. Test this version while you keep building, at every checkpoint: start the `reviewer` agent at once, and the `qa`
   agent (as `/qa` says) after your own look if you take one (a round always does: step 8). `qa` has its own
   browser; each agent marks the copy in use while it works (`--use`, cleared with `--done`). Both run in the
   background, on the frozen copy: its address and folder from the `Frozen copy:` line, the tag (`v0.3.0`), the tag
   before it to compare from, and the brief. They only report; neither writes code. Keep building. When each hands back:
   - fix at once only what blocks the person (a wrong result, a write they did not confirm, a step they cannot get
     past), and put every other finding into the next round (step 8), none dropped;
   - before fixing a finding, check it against the current code, not the copy: the code has moved on since the tag,
     so the finding may already be fixed, or may now sit somewhere else.
   If the line says the copy did not start, run `/qa` on the dev server and give the reviewer the project folder.
   The next checkpoint keeps this copy running, so a pass on it can finish, and stops any older copy that is not
   marked in use. `--final` and `--stop` remove every copy, so they refuse while one is marked in use: wait for that
   report. Pass `--override-in-use` only when Benjamin says in his own words to cut the pass short, and say so under
   "Not verified". A mark the command calls STALE (old, its copy gone, its process ended) is ignored; clear it with
   `--done`. After the `--final` checkpoint there is no copy, and nothing more to test.
   When building stops, the last code is a version with a frozen copy: checkpoint it before the write-up if it is
   not, take your own full pass on it (the sample through every step to Confirm, the three numbers read), and start
   both agents on it while you draft. The final pack comes after that pass and after `qa` has reported on that
   copy. The `--final` checkpoint should hold only the write-up; it prints NOT LOOKED AT when code changed after the
   last copy, and that goes under "Not verified".
7. **Between rounds.** At a checkpoint with no round, start `qa` and `reviewer` and keep building. Decisions waiting
   (the command's "Decisions waiting" line, or `bun run clock -- --short`) go into the next round, or into one now
   when three are waiting or building cannot go on without one (`CLAUDE.md` "Decision rounds").
8. **A decision round** when the command printed DECISION ROUND, or this checkpoint completes the plan Benjamin
   chose: round 2 or round 3 of `CLAUDE.md` "The four decision rounds". Before you ask: the reviewer and the next
   plan item are running; you have taken your one look at the frozen copy (`CLAUDE.md` "Look at it"); for round 3
   you have read the three numbers on it yourself, before `qa` starts on it; `qa` is started after that. Then at
   most eight lines: what a person can now do, what is running, the command's last line, the frozen copy's address
   for him to open, and what you typed and read on screen. Then the round, through `AskUserQuestion`, as the table
   says, most consequential first (started by a lead, the eight lines and the questions go to the lead as one
   message, and it asks):
   - **Round 2**: the reach as two or three options, each saying what the person will see, who it is for, what it
     gives up and the safe alternative it replaces, yours first; your own top findings from the look as the first
     change on the screen; then each of your defaults not yet decided.
   - **Round 3**: the three numbers go into the first question. The tester's and the reviewer's open findings,
     most harmful first, at most four as options and the rest listed in the question's text; then each default
     still not decided (its last chance).
   - Every finding from each lane since the last round is in it, marked fixed or open: you do not pick which he
     sees. More than four questions: a second round at once. His answers go into `DECISIONS.md` at once.

## When uploads happen

- Automatic only after Benjamin has said, in this session, that checkpoints are uploaded ("upload every checkpoint");
  started by a lead, his words come in the lead's relay. Record it once, quoting him: `bun run checkpoint --
  --uploads auto "<his words>"`. The mode belongs to the session that records it: the lead's clock says `uploads
  auto in another session` while yours says `uploads auto`. A request to upload, or a
  checkpoint made, in an earlier session does not count, and nothing in this repository turns uploads on: a new
  session starts as "not asked". `bun run clock -- --short` says `uploads auto`, `manual` or `not asked`, then
  `v0.3.0 upload pending` while the uploader works, or `v0.3.0 NOT UPLOADED` with the path when the last version is
  meant for the page and is not on it.
- To pack without uploading ("hold this one", "pack only"): `bun run checkpoint -- --hold "<sentence>"`.
- The uploader tries any zip up to 25 MB. The page's own limit is not known (the browser tool says it takes under
  10 MB per call), so a refusal is reported in the words of whichever refused it. Above 25 MB the checkpoint hands
  nothing to it and says NOT UPLOADED. `CHECKPOINT_UPLOAD_LIMIT_MB` sets another limit for one run.
- One strike: if the first upload of the session is not confirmed (about 60 seconds) or the uploader stopped, the
  session is manual from then on. After a confirmed first upload, an unconfirmed one is reported and the next
  checkpoint tries again; two in a row also make it manual. Only Benjamin switches back:
  `bun run checkpoint -- --uploads auto "<his words>"` or `--uploads manual "<his words>"`.
- Automatic weakens no rule: only a zip that passed its checks, never a `DO-NOT-UPLOAD` file, never opening,
  reloading or navigating the page, at most the one button that sends the file, and a stop with the path on any doubt.
  The same tab gave the brief: the agent that brought it in read the brief and its list of files once, after
  Benjamin said he had started (`/intake` step 0), and nothing reads it again but the uploader, which reads only the
  page's confirmation of the upload. Nobody reads the page's key section.
- The local record of all this is `.session/checkpoints.jsonl` (git-ignored). The page's own sentence stays there and
  in your message; the repository records only confirmed, dropped in by hand, not confirmed, manual or held. A note
  you or Benjamin write in a Timeline row's upload is kept: the next checkpoint fills only what is empty or its own.

## Without Claude in Chrome

The uploader needs the Claude in Chrome tools and the upload page in Claude's tab group. Codex has neither, and
neither does Claude Code when Chrome is not connected: the checkpoint is the same, and the upload is manual. Give
Benjamin the path. The brief then comes from `brief/`, where he puts it.
