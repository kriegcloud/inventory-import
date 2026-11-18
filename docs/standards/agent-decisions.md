---
type: Standard
title: Agent decisions are structured and attributed
description: Agent decisions are structured outputs with a confidence level and its basis, and who decided is recorded.
tags: [ai, evidence]
status: draft
---

- **Every agent decision is a structured output**, never read from free text ([pattern 3](../patterns.md)). Check:
  every model answer the app acts on is decoded by an Effect Schema (`ai.generateObject`, or a tool's input Schema).
- **With a confidence level and its basis**: `confidence` is `"high" | "medium" | "low"` and `basis` one sentence
  of evidence, both shown beside the proposal. Code sets the level where it can; a model's guess with no exact match
  is never high. Check: the Schema has both fields; a test covers the level.
- **Who decided each thing is recorded**: rules, the model (with its id) or a person, in an `Activity` row. Check:
  after an accepted proposal, the activity list names who proposed and who accepted.
- **An agent has a person's permissions**: its proposals pass the same validation and role check (`CLAUDE.md` "AI
  features"). Check: as a viewer, accepting is refused by the server.

## Also

- **A guess states its basis from the file's own rows** ("30 other Bar rows in this file use m; 0 use pcs"), not a
  general belief, and says what changes and what does not ("only the unit changes; quantities stay"). Check: its
  reason cites rows or counts from this file.
- **A guess gets no one-click bulk accept** (my coding agent's decision; I have not objected), and its rows arrive
  unticked. Check: no "accept all" covers a guess.
- **"Guess" is said in words.** An icon alone (a sparkle) goes unexplained. Check: the newcomer question lists no
  unexplained mark.
