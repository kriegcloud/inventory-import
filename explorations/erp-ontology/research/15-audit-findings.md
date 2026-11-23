---
type: Research
title: What the foundational audit of the thread found
description: The two runs of the foundational auditor over the thin thread's 18 terms, what its adversary landed in each, which findings are about the design and which are about the audit's own limits, and the design points still to rule on. Advisory by decision 107.
---

# What the foundational audit of the thread found

The foundational auditor (`ontology-foundational-auditor`) ran twice on 2026-11-22 over the terms of
[report 14](14-thin-thread.md), section 2. Its adversary failed every proposal in both runs. Decision 107 makes the
audit advisory: this report keeps what it found, and the terms are settled by rulings in `DECISIONS.md`.

Nothing here was compiled or run against an ontology: the vocabulary module, the generated Turtle and the question
suite are not built. What ran is a parser script over eight schema files, five model seats and a validator.

## 1. What ran

| | First run | Second run |
| --- | --- | --- |
| Run id | `orun-2026-11-22T21:00:00Z` | `orun-2026-11-22T23:30:00Z` |
| Pinned commit | `7f7c2b3` | `a645f59` |
| Competency questions | 3 (CQ-P06, CQ-P09, CQ-P10) | 4 (CQ-P10 reworded, CQ-P11 added) |
| Parsed observations (adapter-typescript 1.0.0, 8 files) | 73, a rerun identical | 73 |
| Quotations | 18 (the term definitions) | 48 (definitions, identity criteria, 12 decisions, 5 rules from `CLAUDE.md`) |
| Hypotheses, surviving | 72, 19 | 70, 11 |
| Proposals | 18 | 15 (none for `recordedAt`, `MemberRoleScheme`, `GrantScopeKindScheme`) |
| Adversary verdicts | 18 FAIL | 15 FAIL |
| Validator on the records | valid | valid until the branch moved (section 4) |

Seats: denotation, analysis and synthesis on `gpt-6.1-sol` medium (Codex); the adversary on `grok-4.7` xhigh; the
blinded alternative on `claude-opus-5-5` medium. Each ran in a directory holding only its inputs.

The records are in `assets/audit/archives/thread/`, one folder pair per run, with the manifests and indexes in
`assets/audit/thread/runs/`.

## 2. What the adversary landed

| Attack | First run (of 18) | Second run (of 15) | About |
| --- | --- | --- | --- |
| The fact that rejects "implementation only" is also true of a plain data shape | 18 | 13 | The audit's limit (section 3) |
| The identity criterion does not decide a hard case | 16 | 2 | The design; mostly answered by decisions 103, 104, 106 |
| The cited question does not need the term | 11 | 6 | The design (section 5, points 1 and 2) |
| The parent is not shown to fit, or no ancestor supplies identity | 10 | 4 | The design (section 5, point 4) |
| Two statements of identity disagree | 6 | 0 | Answered between the runs |
| An identifier is taken for identity | 3 | 0 | Answered between the runs |
| A role is classed as a kind | 0 | 1 | The design (section 5, point 3) |

Between the runs Benjamin answered five things (decisions 102 to 106): a scope question warrants Grant, an
organization is its legal entity, a person is the human being, CQ-P10 asks what an audit entry says, and the parked
observations are waived. Those answers removed most identity attacks. They did not touch the first row.

## 3. The finding about the audit itself

To pass, a term needs one quoted fact that would be false if the term were only a data shape. For this application no
such fact exists for the thread's terms: a member, a grant, a tenant link and an audit entry are each one stored row
or one field, and every rule the application enforces about them (a write needs a role, an organization keeps an
admin, every query filters on the organization) is also true of that row with a good comment on it. The adversary
said so in the same words for 13 proposals.

So the audit cannot certify these terms, and a third run with the same evidence would end the same way. The terms
are Benjamin's commitments about what the application means. That is what decision 107 records.

## 4. What was not finished

- The second run's gate was read after the branch had moved: main was merged into the branch while the adversary
  ran, so the pinned commit no longer equals HEAD and four quotations from `CLAUDE.md` no longer sit on the lines
  they name. The verdicts above were written before that and stand; the gate's own summary of the second run was not
  obtained on a clean pin.
- Seven second-run proposals state a category their analysis does not (`none` or `unresolved` where the identity
  card says relator, kind or information object). The validator's gate names each. Not repaired: no further run.
- In the first run 37 of 57 observations that matter were parked as unresolved (decision 105 waives the limit). In
  the second, 44 of 88; the waiver was declared and not needed.
- One proposal was edited by hand: the Person proposal's parent, from the full gist IRI to `gist:Person`, which the
  validator requires. No other seat output was changed.
- The blinded seat wrote three second-run records without a counterexample; those three were redone by the same
  seat.

## 5. Design points the adversary raised that are still worth a ruling

Each is a finding about the design, not about the audit. Benjamin ruled on points 2, 3 and 4 the same day
(decisions 110, 108 and 109) and accepted the 18 terms as a set (decision 111); point 1 stands as decisions 40 and 102
set it. On 2026-11-23 he ruled on point 5 (decision 115): all three notes land outside the thread, and how a
grant names the location or field it covers is open decision 116.

1. **Whether Grant is its own thing.** CQ-P11 (at which scope does each member hold which role) can be answered by
   one statement on the member naming a role and a scope, with no grant. The adversary's rival: no `Grant` class,
   `grantedTo`, `grantsRole` or `grantScope`. Decisions 40 and 102 keep Grant; what a grant gains over that statement
   is its own lifetime (who gave it, when it ended), which no thread question asks.
2. **Whether the thread needs Organization.** CQ-P06, CQ-P09 and CQ-P11 are answered with Tenant alone. The other
   organizations (suppliers, customers, carriers) are asked about only in the party slice. Organization could wait
   for it, with Tenant standing without a local parent until then.
3. **Person's definition makes it a role.** "A human being that a tenant deals with" stops being true of someone
   removed from every workspace, who is still the same human (decision 104). The definition should say "A human
   being" and leave "that a tenant deals with" to the member and contact terms.
4. **Role's identity across changes of what it permits.** Decision 41 identifies a role by its scheme and notation,
   so "editor" stays one role when its permissions change. The adversary's counter-case: an answer about what an
   editor could do last year. Either say that a role is the named level and not its permissions, or version it.
5. **The blinded seat's notes** (first run): `Member.id` is described as telling people apart, though it identifies a
   membership; `GrantScopeKindScheme` records only the kind of scope, so two grants at two sites would look the same;
   nothing in the thread covers Account, Session, the agent named on an audit entry, or the rule that an organization
   keeps an admin.
