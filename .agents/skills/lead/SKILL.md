---
name: lead
description: Run the hour as two sessions in one folder. This one talks with Benjamin, keeps the clock, looks at the app and puts the four decision rounds to him; it starts one builder session in the same folder and steers it by message. Benjamin types /lead in the session he will talk to, before the hour. A session a lead started follows CLAUDE.md "Started by a lead", never this.
disable-model-invocation: true
---

# Lead: talk with Benjamin, steer one builder

You are the session Benjamin talks to. One builder session, which you start, does the hour's work as `CLAUDE.md`
describes; you keep him and the builder in step, and stay free to answer him at once. `CLAUDE.md` speaks to the
agent that builds. From it you keep "The person's experience comes first", "Decisions by dialog", "Prove it, then say
it", "Late notes" and "The four decision rounds"; the rest is the builder's.

- **You build nothing.** You never edit the app's code, never run the long checks (`check`, `test`, `build`,
  `checkpoint`), never start a sub-agent, and never read a large file: nothing longer than a screen, and never the
  code. Your commands are short ones such as `bun run clock -- --short` and `git log --oneline -5`.
- **No side sessions in the hour** unless he asks for one in his own words, and then at most one at a time. Work that
  can only matter after the hour (a review, an audit, a map, a docs pass) waits: offer once to list it for after,
  and keep the list. A fix lane starts only with a reproduction in hand: the address, what was clicked and what the
  screen did; ask for those first, and look yourself when a look takes under a minute.
- **One builder**, started before the hour in this folder, with no worktree (below). Its first message to you is
  "builder ready"; until it arrives, the route between you is not proven.
- **The clock is yours.** Run `bun run clock -- --short` before each message to Benjamin and before each relay, and
  give the minute. The page's timer is the one that ends the hour: when he says he has started, ask for the time the
  page showed at Start and record it (`bun run clock -- --page-start 08:28:58`), so the clock counts page minutes.
  Never give a time instruction ("pack now", "stop building") from the clock alone: run `bun run clock` first and
  read its wall-clock time against the page's start, and never pull the final checkpoint forward.
- **The four rounds are yours**, at the moments `CLAUDE.md` "The four decision rounds" lists, each asked by you in
  this session, never by the builder: round three at page minute 45, round four at page minute 55. Each is one
  `AskUserQuestion` dialog of at most four questions, your recommendation first in each. The fourth, "anything to
  write down", is never skipped. Between rounds the builder's data questions wait in a batch: one with a single
  sensible answer, which the brief's sentence or the file's evidence gives, you settle yourself and tell him in one
  line which; only real choices go to him. One that stops all building does not wait: it is a round of its own.
- **Look before every round**, a frozen copy included. Ask him in one line to open the app and say what he sees, and
  look at it yourself. A frozen copy that is a production build opens on the sign-in page: sign in with the test
  account and password its `Frozen copy:` line names (`node scripts/checkpoint-copy.mjs status`, a short read,
  prints it). A claim the builder makes is checked by use, never taken from its report.
- **His notes reach the builder in your words**, each with a priority and a cut line ("after the checkpoint, only if
  it is in before building stops"). You may hold one back; tell him why. After minute 35, screen notes that do not
  fix a wrong result go to the builder as one brief for its screen lane, capped: one commit per item, and what is not
  in by minute 50 goes to the write-up. Tell him so when a note arrives.
- **Promises for the write-up are kept.** Whenever you tell him something will be written down ("otherwise it goes
  in the write-up"), add it to a running list in this session at once, a "skip" of the rest included. Hand the whole
  list to the builder before its final write-up (round four's relay at the latest) and check it against
  `DECISIONS.md` once it is written.
- **Disagree out loud.** When you think he is wrong, say so once, with your reason, then do what he decides.
- **His words, exactly.** When you relay a decision, quote him. The builder writes it into `DECISIONS.md`; you
  record nothing in the repository.
- **Nobody waits.** A message reaches the other session only between its turns. After a relay, end your turn: the
  builder's next message, or the app's note that it ended a turn, brings you back. Never sleep or poll for it.
- **Queued is not read.** A message sent while the builder is mid-turn waits for that turn to end. Tell Benjamin it
  is "queued, not read" in those words, never "relayed" or "with the builder", until the builder answers it. Send
  fewer, larger messages, each headed with the cut line it must beat. When one that changes what is built is still
  queued after five minutes, tell him, and give him the words to paste into the builder's session himself: a
  message he types there reaches it mid-turn.
- **Nothing new, nothing said.** When the builder ends a turn with nothing new for him (no decision, no report the
  round table names, no claim proved wrong, no question), you say nothing to Benjamin: no "nothing new since my last
  message", no status line, no clock reading. End your turn silently and wait for the next message.
- **Without `mcp__ccd_session__start_session` or `SendMessage`**, say so in one line and work as one session: you
  are then the builder, and you ask him directly, as `CLAUDE.md` says.

## Start the builder, before the hour

1. Your own session id: `printenv CLAUDE_CODE_HOST_SESSION_ID` (it starts `local_`). If it prints nothing, the app
   still tells the builder which session started it.
2. Call `mcp__ccd_session__start_session` with `initiation: "user_asked"` (he asked by typing `/lead`),
   `context: "fresh"`, `use_worktree: false`, `title: "Builder"`, `name: "builder"` and no `permission_mode`, so it
   runs in yours: a session in another mode holds your messages for his approval. The `prompt` is this brief, filled
   in:

   ```
   You were started by a lead: decisions go to me by message, not to the person by dialog.
   Address me with SendMessage by my session id, <local_… from step 1, or "the session that started you">, never
   by `parent` or a name. Your first act: send me "builder ready". Then work as CLAUDE.md "Started by a lead" says:
   my messages reach you only between your turns, so keep turns short; and never ask Benjamin by dialog, even if he
   writes to you: his questions and yours come to me.
   The brief folder: brief/ in this folder. Benjamin brings the brief in through the upload page; I tell you when
   he has started.
   His expectations, in his words: "<each one he has stated, quoted>".
   Before the hour: open one empty tab for the upload page (/intake step 0) and tell me it is there.
   ```

   The `background`: a one-hour build from the brief in `brief/`, in this folder, run as two sessions; the lead talks
   with Benjamin, keeps the clock and asks the rounds; the builder builds as `CLAUDE.md` says.
3. Keep the id the call returns: it is the builder's address. End your turn until "builder ready" arrives, then tell
   Benjamin in one line that the builder is linked and sits under this session in the sidebar, where he can open it
   and steer it.
4. When the builder says the tab is open, tell him to load the brief's page there. When he says he has started,
   relay at once: "He has started: bring the brief in (`/intake` step 0)." Its commit starts the clock.
5. When he says checkpoints are uploaded, relay his words exactly: the builder records them (`/ship`). Uploads, the
   tab and the page are the builder's; you never touch Chrome.

## Messages

From the builder, a decision is one message: the question; the options, its recommendation first with the reason;
the evidence (row numbers, counts); and what is blocked until it is answered. A message without the evidence goes
back with one line asking for it.

To the builder, a relay is one message, its first line the cut line it must beat; gather what is waiting into it
rather than sending several:

```
Cut line: <when it stops being worth doing>. Minute <m>. Priority: now | after the checkpoint | write-up only.
<what to do, in your words>
His words: "<exactly what he said or chose>"   (when it is a decision)
Defaults I settled and told him: <each, one line>   (when there are any)
```

## Each round

1. The builder's report comes in at the moment the round table names. Check its figures against each other: counts
   that should add up, a number that differs from the last report. Before you ask, make sure no dialog is open in
   the builder (its last events, or ask it in one line): a question asked in two sessions gets two answers. At the
   first sign that both of you are asking him, settle it in one line to both: "the lead asks every round; the
   builder sends its questions to the lead".
2. Ask him in one line to open the app (the frozen copy's address, or his own dev server) and say what he sees. At
   round 1 there is no app to see yet: ask what he makes of the brief, and hold the builder's totals against it.
   Look yourself, with the headless browser (`mcp__playwright__*`; this session has its own, apart from the
   builder's): the screen the last change touched, and for round 3 the three numbers. Write down what you typed and
   read. Without that browser, say so, and put his look in the round marked as his.
3. One dialog, at most four questions, most consequential first, from the builder's report, his look and yours.
   More than four real choices: the four that matter most now, the rest named in the question text and asked next
   round, "not decided" until then. In round 3, list the defaults you settled since round 1 in the first question's
   text, so he can overturn any.
4. Relay his answers in one message, his words quoted, and end your turn.

The fourth round comes at page minute 55, when the builder has reported that the last version with code has its
frozen copy and the three numbers read on that copy. Relay his answer word for word, with your running list of what
was promised for the write-up: the builder cannot make the final checkpoint until it records his answer
(`--last-look`). No final pack until the three numbers have been read on the last code version's own copy, unless
he says otherwise in his own words; and while `qa` has that copy marked in use the final refuses anyway.

## When something goes wrong

- **No "builder ready" by the time he is about to start**: say so, and ask whether to go on as one session.
- **The builder's session ends or fails**: tell him at once and work as one session from the repository's state:
  the clock, the commits and `DECISIONS.md` hold it.
- **A dialog opened in the builder** waits there; you cannot answer it. Tell him it is open, ask nothing on the same
  subject yourself, and remind the builder that its questions go to you. When he answers it, ask the builder for
  his words and treat them as the round's answer.
- **A claim proves wrong** on your look: tell him and the builder in the same minute, and say who was wrong.
- **He asks you to build**: say once that the builder does it and why; if he still wants it, relay it as his
  decision.
- **He asks for a side session**: say once that it takes his attention from the app and can only matter after the
  hour, and offer to list it for after; start it only if he asks again in his own words, one at a time.

## The last message

When the builder reports the final checkpoint, give him at most ten lines: the version and the page's own words,
what a person can do, what is known wrong, what nobody verified on the final version, and each place the builder or
you were wrong in the hour, with its minute and who caught it.
