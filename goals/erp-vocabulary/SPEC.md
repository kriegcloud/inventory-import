---
type: Goal
title: "erp-vocabulary"
description: The thin thread of the ERP vocabulary. One TypeScript module holds 18 accepted terms, the real member and audit records point at them, a projector writes OWL and SKOS, two questions are answered over a lifted two-tenant fixture, and nine gates each refuse one planted mistake.
status: done
from: explorations/erp-ontology
---

# `erp-vocabulary`

The first deliverable of [the erp-ontology exploration](../../explorations/erp-ontology/README.md), which graduated
on 2026-11-23 (decision 119). The design is [report 14](../../explorations/erp-ontology/research/14-thin-thread.md),
the one specification of the thin thread; the appetite, no-gos and the slices after it are in
[BRIEF.md](../../explorations/erp-ontology/BRIEF.md). This file says what done means and where the goal differs from
report 14 and the brief. It copies neither.

## Objective

Answer one sentence from the repository's own records, end to end: who belongs to which organization, with which
role, at which scope. A vocabulary module in the kernel holds the thread's seven classes, nine properties, two
schemes and four concepts. The five enrolled records of report 14 section 3.7 point at those terms: the kernel's
`Member`, `Role` and `Activity` carry typed marks, the access contract's `Person` points at `inv:Member` (never at
`inv:Person`), and `AuditTrail` is a collection that carries no mark of its own and is checked through its element. A projector writes the OWL and SKOS files, a lift turns two
decoded `Member` values into a graph, and two questions (CQ-P06 and CQ-P11) return their expected rows over it.
Nine gates hold it, each with a committed test that plants one mistake and sees it refused.

It is a thin thread on purpose: every station of the design is built once, small, so that the slices after it add
terms and records to something that already runs.

## Non-goals

- Every term outside report 14 section 2, and everything report 14 section 1.3 lists as out: SHACL, alignments and
  SSSOM, gates 10 to 12, any stored row, the lift of `Activity`, deprecation, a published namespace.
- Any change to the app: no screen, endpoint, stored value, decoded value or wire format changes. A mark is an
  annotation on a schema.
- Slice 1 and every later part of the brief's Map. Each is specified only after its open decisions are answered.
- Hand-written Turtle that states a fact about a term (a definition, a parent, a disjointness). The hand-written
  files the thread does commit are instance data and fixtures: `fixtures/cq/CQ-P06.fixture.ttl`, the files under
  `fixtures/negative/` (report 14 sections 6.2 and 6.3) and the files under `fixtures/reason/`, ban 2's near miss
  included (section 6.9; decision 121).
- The foundational auditor and `rat-` records (decision 107).

## Constraints

- The app keeps working at every commit: `items_messy.csv` (200 rows) imports to 155 stored, and `bun run check`
  passes before each commit.
- Design order for every package: schema, then the service contract, then the implementation. Effect 4.1, every
  module imported whole from its own path ([effect-imports](../../docs/standards/effect-imports.md)); the schema
  standard ([schema-first](../../docs/standards/schema-first.md)); the full strictness profile for the two new
  packages, with no exception.
- The module is the only source of a term. Every `.ttl` under `generated/` is written by the projector and never by
  hand (decisions 2 and 5).
- The 18 terms are section 2 of report 14 as decision 111 accepted them. A change to a term's label, definition,
  parent, tag or identity criterion needs a decision first; no gate detects one made without it.
- The ontology's tasks in `bun run check` need no Java, no Python and no network. Only gate 9 needs Java 17 and the ROBOT v1.9.11 jar
  (decisions 112 and 113); its script checks the jar's sha256 and keeps the jar outside the repository.
- IRIs are under `example.org` (decision 7). Every fixture individual is named `test_`.
- The expected rows are the lock on an answer (decision 118). Report 14 section 5.3 writes them in
  `Questions.test.ts`, built from the module's base, with no lock file; CQ-P11's go beside CQ-P06's. A commit that
  changes a question's expected rows says so, and the release notes name the question with its old and its new
  answer.
- bun only. Nothing pushed, and no deploy.

## Where the goal differs from report 14 and the brief

Two decisions came after the report's last edit. Where they and the report or the brief disagree, they win.

- **Two questions, not one (decision 120).** Gate 8 runs CQ-P11 beside CQ-P06 on the same fixture graph. Its query
  is drafted in
  [competency-questions.yaml](../../explorations/erp-ontology/assets/requirements/competency-questions.yaml) and is
  copied into the package as `packages/ontology/fixtures/cq/CQ-P11.rq`: the thread keeps no question file under
  `explorations/` (report 14 section 6.10), so the test's inputs hold it. Its expected rows are the two grants at
  `inv:GrantScopeKindScheme-organization`. Its must-fail case removes the two `grantScope` triples and expects no
  row. This replaces the brief's no-go "no second question" and its Map's "one question", and in report 14: done
  line item 4, the Questions count of section 1.2, section 5.5's "until it is added to the suite with a fixture
  file of its own", and gate 8's row in the gate table, which reads `CQ-P06.rq` only.
- **Five forbidden conclusions (decisions 117 and 121).** Below. Bans 1, 3 and 4 are tests report 14 already has,
  now named. Ban 2 adds three hand-written files under `packages/ontology/fixtures/reason/`: two that must be
  reported inconsistent and one that must pass. Ban 5 adds two files under `fixtures/negative/`. This replaces, in
  report 14: section 1.3's "the only data is the fixture of section 5"; section 6.8's "none is drafted yet";
  section 6.9's two runs (gate 9 now has two positive runs and three negative); section 6.10's "the negative
  fixture"; and row 9 as the only reasoner row of section 6.11.

## Forbidden conclusions

Signed by Benjamin on 2026-11-23, one question a ban (decision 121). Each names the gate that holds it, what must be
refused and the near miss that must pass.

| # | The vocabulary must never let anyone conclude that | Held by | Refused | Near miss that passes |
| --- | --- | --- | --- | --- |
| 1 | a person is an organization, or a tenant | Gate 9 | The fixture's person also typed `inv:Tenant`: inconsistent (report 14, 6.9) | The same person as a member of two tenants |
| 2 | an audit entry is the person or the organization it is about | Gate 9 | A node typed `inv:AuditEntry` and `inv:Person`; a node typed `inv:AuditEntry` and `inv:Tenant`: each inconsistent | An audit entry whose `recordedActor` is a member of that person, `inTenant` that tenant |
| 3 | a role held in one tenant is a role in another | Gate 8 | The question asked through the person, not the member: four rows (must-fail case M5) | CQ-P06 as written: two rows |
| 4 | a member has a role without a grant | Gate 8 | A graph with the role written on the member: no row (must-fail case M3) | The lifted graph |
| 5 | two tenants are one organization because they share a member, a person or a name | Gate 3 | A vocabulary file that makes `inv:membershipOf` an `owl:InverseFunctionalProperty` (`gate3-inverseFunctional.ttl`); one that gives `inv:Tenant` an `owl:hasKey` (`gate3-hasKey.ttl`); and gate 3's own planted mistake, `gate3-sameAs.ttl` | `inv:Tenant` as a subclass of `inv:Organization` |

Ban 5's first two refused files were added by the review of this goal: they are the constructs by which a reasoner
could merge two tenants that share a member, where `gate3-sameAs.ttl` merges two classes. Benjamin's question named
them ("no sameAs, no key, no functional property").

Two limits, as signed. Ban 2 does not say "never the member it names": gist states no disjointness that would show
it and the thread adds no local pair. Ban 5 shows that the vocabulary gives a reasoner nothing to merge two tenants
with; it does not show a reasoner refusing data that says they are one.

## Acceptance

Each line names what proves it. All eleven hold on the branch as of the closing review (2026-11-23), which read each
against the code; [PLAN](PLAN.md)'s closing note says what was run.

- [x] `bun run ontology:write` writes `packages/ontology/generated/inventory.owl.ttl`,
      `packages/ontology/generated/inventory.skos.ttl` and `packages/ontology/generated/fixtures/CQ-P06.graph.ttl`.
      With the three committed, a second run changes no byte: `git diff --exit-code packages/ontology/generated`.
- [x] `packages/ontology/RELEASES.md` holds the line "0.1.0: the thin thread" (report 14 sections 1.3 and 8).
- [x] The vocabulary module holds the 7 classes, 9 properties, 2 schemes and 4 concepts of report 14 section 2.
      Gate 4 passes in `bun run check`. Since rule C12 accepts any decision number that has a heading, a test in
      `Coherence.test.ts` also asserts that all 22 name decision 111 and that `Role`'s exception entry names 97.
- [x] The five enrolled records are placed field by field as report 14 section 3 says: gate 5 with rule P13, in
      `bun run check`.
- [x] CQ-P06 returns its two expected rows and CQ-P11 its two; must-fail cases M1 to M7 and CQ-P11's each change the
      answer as stated; and the three guards of report 14 section 4.4 hold, the second keeping the graph equal to
      what `lift` returns: `Questions.test.ts`, in `bun run check`.
- [x] Gates 1 to 8 pass in `bun run check`, each with one committed test that plants its mistake and asserts the gate
      reports it, and the further negatives report 14 section 6 names for gates 2, 3, 4, 5 and 7. Gate 7's root
      task is in `check`, `check:full` and `check:ci`.
- [x] Gate 9 passes in `bun run check:full` on a run that started the reasoner: both positive runs are DL-valid and
      consistent, and the three negative runs are each reported inconsistent. The `reason` task has `cache: false`.
      The script fails, never skips, when Java is missing, when Java is not 17, when the jar cannot be fetched, and
      when the jar does not hash to the approved value; a test of the script's checks holds each of the four.
- [x] Each forbidden conclusion has its refused case and its near miss committed. Bans 3 and 4 are named tests in
      `Questions.test.ts` and ban 5's in `Generated.test.ts`, in `bun run check`. Bans 1 and 2 are named runs of
      `scripts/reason.ts`, whose output names the ban, in `bun run check:full`.
- [x] `laws boundaries` has the ontology family's two rows and nothing imports `@inventory/ontology`:
      `bun run beep laws boundaries`.
- [x] The CI job for gate 9 is a committed workflow file with the jar restored from a cache keyed by its sha256
      (decision 114), read by the closing review. Whether it has run on GitHub is said in PLAN: nothing is pushed
      without Benjamin asking.
- [x] PLAN's table of what the design left unchecked has an outcome in every row, read by the closing review.

## Where it stands

Built, on branch `docs/erp-ontology-packet`, not pushed and not merged. The vocabulary is
`packages/kernel/src/Terms.vocab.ts`, its helpers `@beep/vocabulary` (`packages/foundation/modeling/vocabulary`), and
the projector, the fixtures and gates 1 to 5, 8 and 9 are `@inventory/ontology` (`packages/ontology`). Gate 6 is the
type-check and gate 7 the law `bun run beep laws ontology-terms`. `bun run check` runs gates 1 to 8 and
`bun run check:full` gate 9 as well, with ROBOT v1.9.11 and HermiT under Java 17. The CI job for gate 9 is written
and has not run on GitHub. [PLAN](PLAN.md) has the steps, the choices made along the way, the walk of each planted
mistake through the gates and the closing note.

## Decisions

In [the exploration's DECISIONS.md](../../explorations/erp-ontology/DECISIONS.md): 8 (the thin thread first); 2, 5,
7 and 9 (one module, a local projector, `example.org`, three homes); 10 and 11 (the IRIs of data; labels and
definitions); 13 to 16 and 97 (gist names, disjointness, the
exception list); 20 to 26 (marks, the lift, versioning, the engines, the reasoner); 32 and 34 (what records an acceptance, amended by
107; what makes a person or an organization one); 38 to 41, 46, 93 to 104, 106 and 108 to 110 (the terms' shapes); 107 and 111 (the audit advisory, the 18 terms accepted); 112 to 114 (the reasoner's
release, Java and CI); 117, 118, 120 and 121 (the bans, the answer lock, CQ-P11); 115 (the seat's notes, outside the thread); 119 (the brief matches). Sixty-three decisions are open and the thread
waits on none of them; the nearest is open decision 116.
