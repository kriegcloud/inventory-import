---
type: Standard
title: Complete without an AI key
description: The whole job works with no AI key, someone without a key still sees the AI path, a provider's outage falls back in order, and keys stay secret.
tags: [ai]
status: stable
---

- **The app works with no AI key.** Each AI feature has a rules path that does the job alone, and the screen says
  which path produced a result. Check: run without the key (`CLAUDE.md` "Running without the AI key"); the sample
  import still finishes correctly.
- **Someone without a key still sees the AI path**: one real model run (input and structured output) saved as a
  file and replayed when there is no key, labelled with its date, model id and "recorded, not live". Check: with
  no key, the replay is one click away and the label is on screen. Not built in the starter: with no key the table
  assistant's rules answer and say so, and nothing saves or replays a run, so build the replay when the plan has it.
- **Keys stay secret**: never in logs, reports or commits. Check: `bun run check` passes the pack's key scan
  (`test/scripts/KeyScan.test.ts`), and so does `bun run pack`.
- **A missing key turns the AI features off**, through their settings ([settings](config-and-logs.md)), and the
  screen says so, and so does `AI_ENABLED=false` with a key. Check: `/api/v1/system/status` reports the provider as
  none and why.
- **One retry policy, not two**: `Effect.retry` with `Schedule.exponential` and `Schedule.jittered`, a bounded
  number of times, only for errors marked retryable, with the SDK's own retries off. Check: the SDK call sets
  `maxRetries: 0`, and a test of a retryable failure sees the bounded number of attempts.
- **Then fallbacks, in order**: a second model through OpenRouter's `models` list, a second provider through
  `ExecutionPlan`, and the rules path last. The screen says which one answered. Check: with the first model
  failing, the answer names the one that replied.
- **A provider's outage reads as a sentence** ([errors](errors.md)), never as the provider's own text. Check: with
  an invalid key, the screen says what happened and what the app did instead.
