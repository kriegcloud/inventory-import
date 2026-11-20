---
type: Exploration
title: Alchemy domain
description: Everything @alchemy.run/domain and what plugs into it offers, concept by concept, with how inventory-import would use each. The reference the brief is built on, written so its pages can later become agent skills.
status: active
stage: shape
next: Benjamin answers the brief's decisions, 1 to 22 first, and says whether it matches; the build starts after that and after the atoms goal is merged
goals: []
---

# Alchemy domain

inventory-import is in the package shape of beep-effect, and nothing in it imports `@alchemy.run/domain`. Benjamin's
answer to that, on 2026-11-19, was "Not borrow use.": the app is where he explores the library in full and settles
its designs before porting beep-effect to it. His words are in [CAPTURE.md](CAPTURE.md).

This packet is the reading that comes before the design. It holds one page for every concept of the library and of
what he asked to have used beside it, each saying what the thing is, how it is declared, what to avoid, what it
would be in this app, how to check it, and where it was read. Nothing here is built. The design, with the decisions
only he can make, is [the brief](BRIEF.md).

## How to read it

Start with [the brief](BRIEF.md): the design, the saving of review decisions modelled first, one table of every
concept with its instance, its move and its check, and the decisions in the order they must be asked. The research
under it:

1. [The map](research/00-map.md): every concept on one page, with its verdict. Fifty-four pages give 59 verdicts:
   46 "use" on the published release, 8 "use, from main", and 5 "cannot yet", each with what is in the way.
2. [The pull request he pointed at](research/01-pr-3260-verify.md): `Verify`, which proves a model's rules.
3. [This app's rules under Verify](research/03-this-apps-rules-under-verify.md): the app's own rules, declared and
   proved, and [the trial](research/04-trial.md) that ran them. Then
   [the trial on saving review decisions](research/07-review-decisions-trial.md): two rounds, every source and every
   report of Verify. Read its second round's table first.
4. [What was merged since the published release](research/02-merged-since-beta-87.md): what `main` has that npm
   does not.
5. The concept pages, in [research/concepts/](research/concepts/), one file per concept under a stable name.
6. [The coverage ledger](research/05-coverage-ledger.md) and [the export index](research/06-export-index.md): proof
   of what was read, and where every exported name is covered.

## What was read

| Source | Pinned at | How much |
| --- | --- | --- |
| The live site, `https://alchemy.run/domain/` | what it served on 2026-11-19; it documents the published release | 44 pages, the same 44 files as the docs folder at the release tag |
| `@alchemy.run/domain`, the published release | tag `v2.0.0-beta.87` (2026-11-12), npm `latest` | 44 source files, 24,361 lines, every one read in full |
| `@alchemy.run/domain`, unreleased | `main` at `dbfd0ddb` (2026-11-19), 45 commits after the tag | 64 source files, 41,111 lines; 47 docs pages |
| What it plugs into | the same two refs | `effect-cluster`, the Cloudflare host, `rivet`, `better-auth`, `drizzle`, `git`, `github`, `1password`, the test tooling: 306 source files read in full, with their docs sections |
| What he asked for beside it | Effect 4.1.4 and the distilled repository | `effect/cluster`, `effect/workflow`, `effect/graphql`, the `typesafe` AI package, six distilled clients |
| This app | `main` of this repository | the ports, tables, handlers and tests each page places its concept against |

The ledger lists every page and file with how it was read. Two releases are named on every page, because they
differ: the site and npm are beta.87, and `Decision`, `Relation`, invariants, transitions and `Verify` exist only on
`main`. Each page says which it is talking about, and its last section gives the path and the ref, so a later pass
can tell what has moved.

## What was run

A model of this app, outside the repository ([the trial](research/04-trial.md)):

- On the published release, with the app's exact Effect: one aggregate in memory, type-checked with this
  repository's own flags and diagnostics, with stories.
- On `main`: four aggregates (an import, an item, the model-call allowance, an organization) with stories and
  `Verify`. Nineteen of the app's rules were proved for every state and every input, and one was checked over 5,173
  sequences of commands. A rule broken on purpose came back with the state, the command and the shortest sequence
  that breaks it.
- On `main`, the saving of review decisions, in two rounds ([07](research/07-review-decisions-trial.md)). The first
  showed that a command of rows to set and rows to clear cannot hold "no command clears a decision its sender did not
  make". The second, run after a review of the brief, found the shape under which the review's rules are proved: the
  import's lifecycle as its own instance, one instance per decided row, and every act a decision across both. Verify
  verified that model with 27 rules proved and 1 checked. One instance per import proves nothing, by the prover's
  design.
- The same round stored values in a local Durable Object through the domain host (about 8 MiB is the limit), and
  ran a decision, a relation, a model invariant, an `eventually` rule and a broken rule kept as a story.

## What the reading found

Each line is argued on the page it links to. These are findings, not decisions.

**The library as published and as it is on main**

- `Verify` runs on this app's rules today, from `main`. It is not on npm, and neither is `Decision`. Forty-five
  commits have merged since the release. Of the 34 that touch the library or what it plugs into, six break code
  written for the release and four more change behaviour or widen a type
  ([02](research/02-merged-since-beta-87.md)).
- On the published release, a command's middleware list runs in the reverse of the documented order, and three
  reads can answer or wait before a view's `validate` has judged the caller. `main` fixes both
  ([command](research/concepts/command.md), [view security](research/concepts/view-security.md)).
- A rejected command is not kept under its command id, so sending it again decides it again
  ([command](research/concepts/command.md)).
- The library publishes a build of every `main` commit to its own preview registry. It installs beside Effect 4.1.4
  and `Verify` runs from it; every build still calls itself `2.0.0-beta.87`, and its peers are that commit's own
  builds ([07](research/07-review-decisions-trial.md), "How it was run").

**How review decisions are saved**

- The request that saves decisions does not say which picture of the draft it was worked out from, so no check on
  the server can tell a decision its maker took back from one a stale screen cleared
  ([07](research/07-review-decisions-trial.md)).
- An aggregate's state is one stored value, written again at every accepted command. In local workerd, through the
  domain host, 8.3 MB was stored and 8.5 MB was refused. The 2 MiB in the library's source is a guard of its cluster
  package. One instance per import passes 8 MiB at about 42,800 decided rows; one instance per row is a few hundred
  bytes ([07](research/07-review-decisions-trial.md), trials 1 and 5).
- The prover cannot prove a rule over the app's real decision shape, or over a list. A row's decision is held as
  text, and no state in the recommended shape holds a list.
- A handler named `Effect.fn("name")(…)` and a schema imported from another package are read by the prover; a
  request context imported from another package is not.

**What the prover asks of this repository's code**

- It reads `new Event(...)` and not `Event.make(...)`, so domain blocks need an exception to the house rule that
  schema classes are built with `.make` ([prove](research/concepts/prove.md)).
- It follows relative imports only. An aggregate whose commands, events and rejections sit in another workspace
  package, as the `contract` and `model` split would have them, cannot be proved
  ([project layout](research/concepts/project-layout.md)).

**Where the model runs, and what a confirm becomes**

- The Cloudflare host needs an Effect-native Worker, and the app's Worker is a plain module built with the screens.
  Two arrangements work: a second, Effect-native Worker beside it behind a service binding, or one Effect-native
  Worker that hosts the model, serves the API and serves the built screens as assets
  ([host on Cloudflare](research/concepts/host-cloudflare.md)).
- An aggregate's commit and a D1 batch cannot be one transaction. With the import as an aggregate and items written
  into D1 by a projection, the fact is one commit and the items land in one batch, but they are two writes with a
  moment between them. A batch that fails is retried and never dropped, so today's confirm and take-back batches
  need a marker that makes a second delivery write nothing ([projection](research/concepts/projection.md)).
- What a confirm costs depends on where its rows travel. For a 50,000-row file that creates 38,750 items: the
  import as one aggregate whose event names a plan staged in D1, 4 Durable Object requests; the rows carried in the
  import's own events in chunks of 1,000, 104 to 204; every item as its own aggregate, 193,750, and at least 271,250
  counting each object's first delivery ([host on Cloudflare](research/concepts/host-cloudflare.md); arithmetic,
  not measured).
- A paged query answers entries and a cursor, with no total and no page number, which the Items page shows today
  ([query](research/concepts/query.md)).
- beep-effect does not host on Durable Objects: it wrote its own Postgres host against the library's platform
  contract, and names Effect Cluster on Postgres as the host it is moving to
  ([platform contract](research/concepts/platform-contract.md)).

**The extras he asked for**

- Effect's GraphQL module is a client; nothing in it serves a schema ([graphql](research/concepts/graphql.md)).
- The `typesafe` package does not score another model's answer; its own model answers closed questions with a
  calibrated probability ([confidence scores](research/concepts/confidence-scores.md)).
- Effect Cluster runs on Cloudflare as a pool of Durable Objects with a Worker of its own, and cannot use D1 as its
  database ([cluster](research/concepts/cluster.md)).
- Drizzle on a Durable Object pins a release candidate of Drizzle 1.0, and inside an object it has the real
  transactions it lacks on D1 ([Drizzle on Durable Objects](research/concepts/drizzle-durable-objects.md)).
- Alchemy Git is a git server to host, needing a bucket; it runs no CI
  ([Alchemy Git](research/concepts/alchemy-git.md)).
- The distilled Resend client sends mail from a Worker ([Resend](research/concepts/resend.md)); signing in with
  Discord is Better Auth's own provider, not the distilled Discord client
  ([Discord sign-in](research/concepts/discord-sign-in.md)).

## The upstream skill, and these pages

The library ships an agent skill, `alchemy-domain` (`skills add alchemy-run/alchemy --skill alchemy-domain`; its
files are in the repository at `packages/domain/skills/alchemy-domain`). It is a short guide to building with the
library: a workflow from requirements to building blocks, conventions for files, the rules that keep a model
correct, and six reference files (modelling, layout, building blocks, testing, hosting, frontend), all in the terms
of its example, a bank. On `main` it has been brought up to date with `Decision` and `Verify`.

These pages do not replace it. They add what it does not have:

- every concept in this app's terms (an import and its rows, items, people and roles, the allowance), with the
  port, table, screen or test it would replace;
- what differs between the published release and `main`, page by page;
- what was checked in source and what was run, with the path and the ref for each;
- what the library asks of this repository's own code rules, found by running;
- the extras that are not part of the library.

Each concept page keeps one form (when to reach for it; how it is declared; rules and mistakes; in this app; how to
check it; what it needs; verdict; where it was read) so that it can be moved into a skill's `references/` folder
without rewriting. The pages that are candidates to become skills here, once the brief is signed and the first
blocks exist: the blocks themselves ([aggregate](research/concepts/aggregate.md),
[command](research/concepts/command.md), [event](research/concepts/event.md),
[rejection](research/concepts/rejection.md), [project layout](research/concepts/project-layout.md)); checking a model
([story](research/concepts/story.md), [invariants and transitions](research/concepts/invariants-and-transitions.md),
[verify](research/concepts/verify.md), [prove](research/concepts/prove.md),
[this app's rules](research/03-this-apps-rules-under-verify.md)); and reads and writes outside the model
([projection](research/concepts/projection.md), [query](research/concepts/query.md),
[view](research/concepts/view.md)). No skill has been created or installed.

## Licence

`@alchemy.run/domain` is published under Apache-2.0 (its `package.json`; author Sam Goodwin). These pages are
written in this repository's own words, with short quoted definitions and a pointer to the source for each; no page
or file of the upstream repository is copied here.

## Keeping it current

The two refs are the tag `v2.0.0-beta.87` and `main` at `dbfd0ddb`. When a release is published, or `main` moves:
re-run the two commands at the foot of [02](research/02-merged-since-beta-87.md) for what merged, then re-read the
pages whose "Where this was read" names a file that changed.

## Trail

- 2026-11-19: packet opened. Every docs page and source file read at both refs; one page per concept written,
  checked against the source in a second pass, then extended by a third pass over what the first had only
  outlined; the trial run on the published release and on `main`. Awaiting Benjamin's reading, then the brief.
- 2026-11-20: the brief written, with the saving of review decisions modelled first from a second trial under
  Verify ([07](research/07-review-decisions-trial.md)); the open questions renumbered to the brief's sixteen.
  Benjamin's reversal of "core" recorded in ideal-architecture. Nothing built; awaiting his answers and "the brief
  matches".
- 2026-11-20: a review of the brief found sixty points, four of them blocking: its recommended answers left almost
  no rule proved, its check of what an act's sender saw could not work, and the limit on a stored value was in
  doubt. A second round of trials was run and added to [07](research/07-review-decisions-trial.md); the brief was
  rewritten on it, with thirty-five decisions in the order they must be asked. His five answers on today's review
  saving are under "Answered". Nothing built.
