---
type: Goal
title: "Quality"
description: Seven things a review of the repository's architecture, organization and documentation found on 2026-11-25, from a check that fails in a JetBrains terminal to the review a person uses running on the model Verify proves, each with the command or screen that shows it done.
status: active
from: explorations/alchemy-domain
---

# Quality

On 2026-11-25 the repository was rated 8 of 10: architecture 8.5, organization 7.5, documentation 7. This goal is
what stands between that and a 9, in Benjamin's words: "lets make a goal packet & plan to have all of it done in it."
[PLAN.md](PLAN.md) has the steps, what was found for each, and what is his to decide.

**Where it comes from.** A goal is made when an exploration graduates. This one is an exception he asked for by name:
it comes from a review in a working session, not from a brief. Three of its steps (the prover's patch, the
transitions, the review on the model) rest on [the alchemy-domain exploration](../../explorations/alchemy-domain/README.md),
which is why `from` names it; the other four rest on no exploration, and each says in the plan what it was found from.

## Objective

1. `bun run check` passes from every terminal Benjamin works in, a JetBrains one included.
2. The prover reads the `status` a state's case gives by itself, so a `make` of a state no longer writes it out.
3. An aggregate's transitions say their claim as the model's invariants now do, if the prover reads a helper; if it
   does not, that is written down and the transitions stay.
4. No file of our own code is longer than 1,000 lines, starting with the five longest outside the repository's own
   CLI.
5. `CLAUDE.md` is a page an agent reads in one go: the long tables live under `docs/standards/`, and the two agent
   files name folders that exist.
6. The small loose ends are closed: the push rule, the two warnings of `docs:check`, the explorations that ended.
7. The review a person uses runs on the model Verify proves.

## Non-goals

- No change to what a person sees, to a count, a sentence or an outcome of a row, in steps 1 to 6. Step 7 changes
  what the model's decisions changed on purpose, and nothing else.
- No new rule of the import. A rule that turns up is a question for Benjamin.
- No rule of `CLAUDE.md` is changed, dropped or reworded by step 5: text moves, and a link takes its place.
- Step 7 is not planned again here. Its design, its order and its decisions are the exploration's
  ([BRIEF.md](../../explorations/alchemy-domain/BRIEF.md), "Order of moves"); this goal only holds it to be done.
- No deploy, no release, no push unless he asks in that message.

## Constraints

- The app works after every commit, and `bun run check` passes before each.
- A change to a file Verify reads follows [docs/verify.md](../../docs/verify.md) and `CLAUDE.md`, "The model's blocks".
  The lock is written again only for a rule changed on purpose, and never by hand.
- A patch to the library has its header, its test and its mutant ([docs/patches.md](../../docs/patches.md)).
- A file that is split keeps its package, its exports and its tests; a file a model's task reads is named in
  `packages/catalog/model/turbo.json`, or an old proof is replayed.
- The ledgers, the baselines and the strict ceilings only fall.
- Every document touched stays an Open Knowledge Format document (`bun run docs:check`).

## Acceptance

- [ ] `TERMINAL_EMULATOR=JetBrains-JediTerm bun run check` passes, and a test feeds each law that reads oxlint's
  report a finding whose file is a `file://` address.
- [ ] `bun run --cwd packages/catalog/model prove` passes with no `status:` written in any `make` of a state, the
  patch's own test fails without the patch (`bun run beep patches prove`), and `CLAUDE.md` no longer asks for the
  status to be written out.
- [ ] Either `Group`, `Row` and `Import` say their transitions through helpers and `bun run --cwd packages/catalog/model verify`
  passes on a lock written again on purpose, or `scratchpad/LOG.md` has the line that says the prover does not read
  one and why.
- [ ] `git ls-files '*.ts' '*.tsx' | grep -v -e '^vendor/' -e '^\.agents/' -e '^packages/ui/src/components/' -e '^packages/foundation/modeling/identity/' -e '^packages/foundation/modeling/schema/' -e '^packages/foundation/modeling/utils/' -e '^packages/foundation/primitive/types/' | xargs wc -l | awk '$1 > 1000 && $2 != "total"'`
  prints only test files, and none of the five named in the plan. What it leaves out is what is not ours to split:
  the Alchemy packages, the skills, the vendored components, and beep-effect's kit, which is the four packages under
  `packages/foundation/` that hold a `vendor.json`. `@beep/csv`, `@beep/xlsx` and `@beep/vocabulary` are ours and are
  counted.
- [ ] `wc -l CLAUDE.md` is under 400, `bun run docs:check` passes, and `grep -n "src/domain" .claude/agents/*.md`
  finds nothing.
- [ ] `bun run docs:check` prints no warning; `.claude/settings.json` on `main` asks before a push; the explorations'
  README says where each one stands.
- [ ] The alchemy-domain exploration has graduated into a goal of its own, that goal is `done`, and
  `docs/verify.md` no longer says "Nothing a person sees uses the model yet".
- [ ] After each step: `bun run check:full`. After a step that touches a screen or what the server stores: on a fresh
  database, `items_messy.csv` through Confirm with the three numbers read (200 rows, 155 imported, 155 stored).

## Decisions

None is answered for this goal yet. The open ones are in [PLAN.md](PLAN.md), "His to decide", and each is put to
Benjamin when its step opens. Step 7's are in the exploration's
[DECISIONS.md](../../explorations/alchemy-domain/DECISIONS.md): of decisions 1 to 40 only 21a is open, and 42 to 56
and 60 to 62 are asked each when its move opens. The one answer this session gave is there too: "a change number's 0
for none stays in the model's state" (2026-11-25).
