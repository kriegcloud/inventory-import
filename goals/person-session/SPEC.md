---
type: Goal
title: The person's session
description: A person who did not build the import uses it on a spreadsheet of their own, with Benjamin beside them, and what they did, where they stopped and the counts the screen showed are written down, with no value or name from their file. Moved out of focus-and-friction on 2026-11-27 so that goal could close.
status: active
from: explorations/ideal-architecture
---

# The person's session

Step 3 of [focus-and-friction](../focus-and-friction/SPEC.md) was prepared there and moved here on 2026-11-27, on
Benjamin's answer, so the rest of that goal could close. Everything else in it is done. Like that goal, this one is an
exception he asked for: it comes from a working session, not from an exploration's brief. `from` names
`ideal-architecture` because the hold in step 2 of that goal, recorded in the exploration's decisions, ends here.

## Objective

1. **A person who did not build the import uses it on a file of their own**, and what they did and where they stopped
   is written down as observations and counts. Each thing that went wrong becomes a question for Benjamin or a fix.
2. **Machinery still waits for that person.** New ontology slices, new laws and new vendored libraries wait until
   objective 1 is recorded (the exploration's decisions, "2026-11-26 — focus and friction", answer 1). Fixes to what
   exists go on.

## Non-goals

- No rule of the import changes. A rule the person shows to be wrong is a question for Benjamin, with what they did.
- No file of the person, no part of it and no name of theirs is committed, pasted into a transcript, or stored outside
  their own copy.
- No deploy by an agent. The session runs on `bun run dev` on Benjamin's machine.

## Constraints

- Benjamin runs the session with the person he brings. The agent prepared it ([SESSION.md](SESSION.md)) and takes no
  part in it.
- The record holds counts and observations only: no value, column heading, item name, file name or person's name.
- Every document touched stays an Open Knowledge Format document (`bun run docs:check`).

## Acceptance

- [ ] [PLAN.md](PLAN.md), step 1, holds at least one session with someone who did not build the import, on a file of
      their own. It records what they did, where they stopped, and the counts the screen showed, and holds no file
      content and no name.
- [ ] Each problem it found is a fix merged or a question answered in the root `DECISIONS.md`, linked from the
      record's line.
- [ ] A dated line in the exploration's `DECISIONS.md` ends the hold on new machinery.

## Decisions

Who, where and what waits were decided on 2026-11-26, and the move here on 2026-11-27:
[the exploration's decisions](../../explorations/ideal-architecture/DECISIONS.md), "2026-11-26 — focus and friction"
and "2026-11-27 — focus and friction closes; the person's session is its own goal".
