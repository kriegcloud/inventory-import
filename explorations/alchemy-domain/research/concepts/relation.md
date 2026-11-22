---
type: Reference
title: Relation
description: Domain.Relation({ over, holds }), a model rule about one instance of each of a few named aggregates that Verify proves where one step changes both sides; this app would use it to say a claimed email belongs to a member of its organization, and an item a confirm created belongs to that import's organization.
tags: [alchemy-domain, declaration]
---

# Relation

A relation is a rule a model states about a fixed few instances: one instance for each name in `over`, each given as
its id and its state. Where a model's `invariants` are given every instance at once and can only be searched, a
relation is small enough to prove: Verify shows that every command and every decision that records on one of its
aggregates keeps it, starting from any states the rules allow. The docs: "A rule about a fixed few can be proved.
That is a relation" [`website/src/content/docs/domain/verifying-models.mdx` line 157 at `main@dbfd0ddb`; not on the
live site]. It is the proof-friendly way to say how two aggregates agree, such as a claim and the record that holds it.

## When to reach for it

- Two aggregates each hold half of a fact and must agree: a claim names its holder and the holder names the claim
  (the bank's `UsernameClaim` and `Customer`). This is the [unique values](./unique-values.md) pattern made checkable.
- The rule is about pairs (or a few named instances), not about totals or "every instance". A sum, a count or "at
  least one" across all instances is a model `invariants` entry ([invariants and
  transitions](./invariants-and-transitions.md)), which is only searched.
- **It is proved only where one step changes both sides: a [decision](./decision.md).** That is the source's own
  statement of what can be proved (`packages/domain/src/Relation.ts` main lines 69-73). If a
  [policy](./policy.md) keeps the two sides in step, the relation is broken between the event and the policy's
  command, so it is not proved and is only checked, like a model invariant, once nothing is left to react.

## How it is declared

```typescript
// SKETCH: not compiled (main only)
import * as Domain from "@alchemy.run/domain"
import { Member } from "./People/Member.aggregate.ts"
import { MemberEmail } from "./People/MemberEmail.aggregate.ts"
import { Membership } from "./People/Membership.decision.ts"
import { Organization } from "./People/Organization.aggregate.ts"

export class Access extends Domain.Model("Access", {
  aggregates: [Organization, Member, MemberEmail],
  decisions: [Membership],
  relations: {
    /** An email claimed in an organization belongs to a member of that organization. */
    AClaimedEmailBelongsToAMember: Domain.Relation({
      over: { member: Member, claim: MemberEmail },
      holds: ({ member, claim }) =>
        claim.state._tag !== "Claimed" ||
        claim.state.memberId !== member.id ||
        (member.state._tag === "Member" && member.state.organizationId === claim.state.organizationId)
    })
  }
}) {}
```

The shapes, all on `main@dbfd0ddb`:

- `Domain.Relation` is `Relation.make` (`packages/domain/src/index.ts` lines 219-220):
  `make<const Over>(definition: Definition<Over>): Relation<Over>` returns `{ kind: "Relation", ...definition }`
  (`packages/domain/src/Relation.ts` lines 77-79). There are exactly two fields:
  - `over: Over`, a record of names to aggregate classes; one aggregate may appear under two names (`Relation.ts`
    lines 15-17).
  - `holds: (on: Instances<Over>) => boolean` (`Relation.ts` line 24), where each name is given
    `Instance<A> = { readonly id: Aggregate.IdOf<A>; readonly state: Aggregate.StateOf<A> }` (`Relation.ts` lines
    3-12). No events, no command, no request context, no `Effect`: a plain function returning a boolean.
- On the model: `relations?: { readonly [name: string]: Relation.Any }` (`packages/domain/src/Model.ts` line 158),
  and the class exposes them as the static `relations` (`Model.ts` lines 238, 515).

What `over` may name: aggregates listed in the same model's `aggregates`. If a name points at a class the model does
not host, or the relation is not written where the prover can read it, it is put on the list of rules the explorer
cannot read and verification stops with an `ExploreError` (`packages/domain/src/Explore/internal/ModelSearch.ts`
lines 946-957, `packages/domain/src/Explore.ts` lines 236-239).

How instances are paired: a relation is claimed of every choice of instances, one per name, and two names of one
aggregate always stand for two different instances (`Relation.ts` lines 18-23). When the explorer checks it on a real
model
it tries every choice of distinct instances (`ModelSearch.ts` lines 966-982). So `holds` must start by saying which
choices it is about (`claim.state.memberId !== member.id || ...`); for every other choice it returns `true`.

How the source is found: the relation must be written in the model's file, either inline in `relations` or as a
constant in that same file listed by name, as a `Domain.Relation({ ... })` call whose `holds` is a property
(`packages/domain/src/Prove/internal/Paths.ts` lines 551-590; the `Careless` model in
`examples/cloudflare-domain/packages/domain/test/fixtures/Club.model.ts` lines 81-88 and 162-166). As for every rule
the prover reads, the aggregates and decisions it names must be reachable from that file by relative imports (the
prover resolves only specifiers that start with `.`, `Prove/internal/Source.ts` main line 229).

Checked in: not at `v2.0.0-beta.87` (`Relation.ts` does not exist there). Read at `main@dbfd0ddb`:
`packages/domain/src/Relation.ts` lines 1-79, `Model.ts` lines 158, 238, 515, `index.ts` lines 213-220.

### Types and helpers

| Name | What it is | Where (main) |
| --- | --- | --- |
| `Relation.make` (`Domain.Relation`) | Builds a relation from `{ over, holds }` | `Relation.ts` 77-79 |
| `Instance<A>` (`Domain.Relation.Instance`) | `{ id, state }` of one instance | `Relation.ts` 4-7 |
| `Instances<Over>` | One `Instance` per name in `over`: what `holds` is given | `Relation.ts` 10-12 |
| `Definition<Over>` | `{ over, holds }` | `Relation.ts` 15-25 |
| `Relation<Over>` | A `Definition` plus `kind: "Relation"`, what `make` returns | `Relation.ts` 28-32 |
| `Any` (`Domain.Relation.Any`) | Any relation, the type of a model's `relations` entries | `Relation.ts` 35-39 |

`Domain.Relation.Any` and `Domain.Relation.Instance` are re-exported from the package root (`index.ts` lines
213-218); `Definition`, `Instances` and `Relation` are reachable through the `@alchemy.run/domain/Relation` subpath
(the `"./*"` export, `packages/domain/package.json` main line 34; not tried).

### What main changes

All new on main: `packages/domain/src/Relation.ts` (79 lines), the model's `relations` member and static, and the
`Domain.Relation` export with its type namespace. It belongs with Verify (commit `e4adb720c`, #3260); that
`Relation.ts` arrived in that same commit is not verified from history. Verify reading `effect/Match` (`d123c318d`,
#3503) and the bank verified in the tutorial (`852675fdd`, #3504) did not change `Relation.ts`.

## Rules, and the mistakes to avoid

- **Proved only when every step that touches it keeps it.** The proof takes each command of each aggregate in
  `over` and each decision that records on any of them, starts from any states the rules allow with every standing
  relation assumed to hold, and shows the relation still holds after (`Relation.ts` lines 46-49, 69-73;
  `verifying-models.mdx` main line 177).
- **A policy that keeps both sides in step leaves it Checked, not Proved.** No single command keeps it, so it is
  checked once nothing is left to react, in every sequence the search runs (`Relation.ts` lines 69-73;
  `ModelSearch.ts` lines 990-993 add it to the rules looked at; `verifying-models.mdx` main line 179).
- **Proved together, and a failure is taken out.** Each proof assumes every relation still standing; one that fails
  is removed and the rest are proved again without it, so no proof rests on an unproved rule
  (`verifying-models.mdx` main line 682, `packages/domain/src/Prove/internal/Relations.ts` lines 575-592).
- **It also needs the aggregates' own rules proved.** A relation counts as proved only where every aggregate it, or
  a decision on its aggregates, touches stays closed and has every invariant proved (`ModelSearch.ts` lines
  1155-1182). One unproved invariant on `Member` drops the relation to Checked.
- **Too weak to prove itself.** A relation that is true of every reachable model can still fail the proof from an
  unreachable pair of states. The report's line then names the command that breaks it and the states it starts
  from, as states the rules allow (`Verify.ts` lines 684-690). Write the stronger rule, often a second relation from
  the other side, as the
  bank does with `AClaimedNameBelongsToItsCustomer` and `ARegisteredCustomerHoldsTheirName`
  (`examples/cloudflare-domain/packages/domain/src/Bank.model.ts` main lines 56-73; the `Vague` fixture's one
  relation stays checked, `test/Relation.test.ts` lines 42-70).
- **An aggregate's own command can break it.** If a command on one side changes it without the other (`Bench.Vacate`
  in the `Park` fixture), the proof names it in `unproved.by` and the search finds the sequence
  (`test/Relation.test.ts` lines 97-117). In this app: removing a member must release the email claim in the same
  step (a decision), or `AClaimedEmailBelongsToAMember` is broken by `RemoveMember`.
- **What it cannot say:** anything about events, views, projections or time; anything that needs every instance (a
  total, a count, "some admin exists"); anything that reads the request context. Those are model `invariants`
  (searched) or aggregate transitions.

## In this app

Two candidates. Both are sketches; neither was run.

**1. A claimed email belongs to a member of its organization** (the sketch above). When an admin adds a person by
email, a `Membership` decision reads the `Organization`, the `MemberEmail` claim keyed by
`${organizationId}:${lower-cased email}` and the new `Member`, and records on all of them in one step, so the
relation can be proved. Removing a person has to be a decision too (release the claim and end the membership
together); as a policy it would leave the relation Checked.

**2. An item created by a confirm belongs to that import's organization** (app rule 6):

```typescript
// SKETCH: not compiled (main only)
AnItemBelongsToItsImportsOrganization: Domain.Relation({
  over: { item: Item, draft: ImportDraft },
  holds: ({ item, draft }) =>
    item.state._tag !== "InForce" ||
    item.state.createdBy !== draft.id ||
    (draft.state._tag !== "Unstaged" && item.state.organizationId === draft.state.organizationId)
})
```

It is provable only if the confirm is a decision that reads the import and records `ItemCreated` on each item in the
same step (see [Decision](./decision.md), and its cost for large files). If items are created by a policy reacting to
`ImportConfirmed`, the relation is only checked. In a trial on 2026-11-19 on main, the `ImportDraft` transitions
`AnImportNeverChangesOrganization` and `OnlyItsOwnOrganizationChangesAnImport` were proved per aggregate; that is the
half of this rule one aggregate can hold, and the relation is the other half. The trial ran no relation and no
decision.

- **Used today:** no. Rule 6 is held by every query filtering on `organizationId` and child rows referencing parents
  by `(organizationId, id)` (`apps/inventory/migrations/0001_init.sql`); one membership per person per organization
  is the unique index `member (organizationId, userId)` (same file, line 79), and the add is a read then a write in
  `packages/access/model/src/People/People.handler.ts`.
- **Where it goes:** a `relations` entry on an access model in `packages/access/model/src/` and on a catalog model in
  `packages/catalog/model/src/`, each checked by `Verify.model` in that package's `test` folder.
- **What the person gets:** nothing they can see; a proof that no sequence of adds and removals leaves an email
  claimed by nobody in its organization, and no confirm puts an item in another organization.

## How to check it

```typescript
// SKETCH: not compiled (main only)
Verify.model(Access, { apis: [AccessApi], story, require: { proved: ["Access.AClaimedEmailBelongsToAMember"] } })
```

A broken relation reports `standing: "broken"` with the sequence and a story to paste; an unproved one reports
`standing: "checked"` with `unproved: { by, verdict }` (`packages/domain/src/Verify.ts` lines 127-133, 246-259).
`require.proved` turns "only checked" into a failure (`Verify.ts` lines 89-101). Not run: the trial on 2026-11-19
verified four aggregates and one model invariant on main, with no relation.

## What it needs

`main@dbfd0ddb`. Proving it runs at test time under Node with the solver (`z3-solver`); nothing runs it on a host.
A decision for every step that changes both sides. See [Verify](./verify.md).

## Verdict

**Use, from main:** state `AClaimedEmailBelongsToAMember` on an access model and `AnItemBelongsToItsImportsOrganization`
on a catalog model, make every step that changes both sides a decision, and pin each with `require.proved` in
`Verify.model`. Taking it needs the app to depend on `@alchemy.run/domain` at `main@dbfd0ddb` or later (no npm release
has `Domain.Relation`; how is the brief's decision) and, for a proof rather than a check, `Domain.Decision` from the
same ref.

The brief, as answered on 2026-11-22, states neither relation: its decision 20 makes members their own instances, with
the relation of trial 10's model, and its decision 17 makes each item its own aggregate, created by a saga.

## Where this was read

- `website/src/content/docs/domain/verifying-models.mdx` (155-179, 278, 632, 652-682): not at `v2.0.0-beta.87`; on
  `main@dbfd0ddb` new (https://alchemy.run/domain/verifying-models answers 404 on the live site, which documents
  beta.87)
- `packages/domain/src/Relation.ts`: not at `v2.0.0-beta.87`; on `main@dbfd0ddb` new
- `packages/domain/src/Model.ts`, `packages/domain/src/index.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb` changed
- `packages/domain/src/Verify.ts`, `Explore.ts`, `Explore/internal/ModelSearch.ts`, `Prove/internal/Paths.ts`,
  `Prove/internal/Relations.ts`, `Prove/internal/Source.ts`: on `main@dbfd0ddb` new
- `examples/cloudflare-domain/packages/domain/src/Bank.model.ts` (56-73): on `main@dbfd0ddb` changed
- `examples/cloudflare-domain/packages/domain/test/Relation.test.ts`, `test/fixtures/Club.model.ts`: on
  `main@dbfd0ddb` new
