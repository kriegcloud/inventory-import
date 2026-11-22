---
type: Reference
title: Unique values
description: Keeping a value unique across many instances by giving the value an instance of its own; for this app, a SKU per organization (the item's own id) and the email an admin adds a person by.
tags: [alchemy-domain, pattern]
---

# Unique values

Read at the library's release `2.0.0-beta.87` and its `main@dbfd0dd`, not at the pin `734c27a` the repository
builds on. What changed between that touches what this page recommends is listed once in [the map](../00-map.md),
"From `dbfd0dd` to the pin".

An [aggregate](./aggregate.md) instance sees only its own state, so no item can know whether another item already
has its SKU. The pattern is to give the value itself an instance, keyed by the value: every attempt to take the value
goes to that one instance, which handles one command at a time, so exactly one attempt wins. At beta.87 the claim is
its own command and a [policy](./policy.md) confirms or rejects the thing that wanted the value afterwards; on main a
[decision](./decision.md) records the claim and the thing together, or rejects both at once. The beta.87 docs say:
"Make the rule its own aggregate, keyed by the value it protects" [https://alchemy.run/domain/unique-values, from
`website/src/content/docs/domain/unique-values.mdx` line 6 at `v2.0.0-beta.87`].

## When to reach for it

- A value must be unique across instances of another aggregate: a SKU across items, an email across members, a
  username across customers.
- The value can be computed from the command (normalised: upper-cased, spaces removed, lower-cased email), so the
  claim instance can be named before anything is read.
- Not needed when the value already *is* the instance's id. If the item's id is `${organizationId}:${skuKey}` and the
  SKU never changes (the app's edit never changes it), uniqueness is free: a second item with that key is the same
  instance. Reach for a separate claim only when the unique value can change, or the instance is keyed by something
  else.

## How it is declared

**At beta.87** (claim, then confirm or reject, as the bank example does): a claim aggregate whose id is the value, a
claim command that rejects when someone else holds it and records nothing when the same holder claims again, and a
policy on the requesting event that sends the claim, then a confirm or a reject to the requester.

```typescript
// SKETCH: not compiled (beta.87)
export class SkuClaim extends Domain.Aggregate("SkuClaim", {
  id: SkuClaimKey, // `${organizationId}:${skuKey}`
  state: S.Union([S.TaggedStruct("Free", {}), S.TaggedStruct("Held", { importId: ImportId })]),
  initial: { _tag: "Free" },
  commands: [ClaimSku],
  decide: {
    ClaimSku: (claim, cmd) =>
      claim._tag === "Free"
        ? [new SkuClaimed({ importId: cmd.importId })]
        : claim.importId === cmd.importId ? [] : new SkuTaken()
  },
  evolve: { SkuClaimed: (_, e) => ({ _tag: "Held" as const, importId: e.importId }) }
}) {}
// ClaimSku: Domain.Command("ClaimSku", { target: SkuClaimKey, input: { importId: ImportId },
//   events: [SkuClaimed], rejects: [SkuTaken] })
```

The requester gains a pending state between its request and the policy's answer, and the caller learns of a taken
value later, as an event, not as the command's failure.

Inside `decide`, events and rejections are built with `new`, as the docs do: in a trial on 2026-11-19 on main the
prover did not read an event built with `.make` there. The app's diagnostic `newSchemaClass` reports every `new`, so
domain blocks need an exception to it.

**On main** (decide both at once): the claim aggregate has no commands, only `events` it folds; the command's
`input` names both instances; a decision reads both and records on each, or rejects.

```typescript
// SKETCH: not compiled (main only)
export class MemberEmail extends Domain.Aggregate("MemberEmail", {
  id: MemberEmailKey, // `${organizationId}:${lower-cased email}`
  state: S.Union([S.TaggedStruct("Free", {}), S.TaggedStruct("Claimed", { memberId: MemberId, role: Role })]),
  initial: { _tag: "Free" },
  events: [EmailClaimed],
  evolve: { EmailClaimed: (_, e) => ({ _tag: "Claimed" as const, memberId: e.memberId, role: e.role }) }
}) {}

export class Membership extends Domain.Decision(AddPerson, {
  reads: { organization: Organization, claim: MemberEmail },
  keyOf: (cmd) => ({ organization: cmd.organizationId, claim: cmd.emailKey }),
  decide: ({ organization, claim }, cmd) =>
    claim.state._tag === "Claimed"
      ? new AlreadyMember({ role: claim.state.role })
      : [
          organization.record(new MemberAdded({ memberId: cmd.memberId, role: cmd.role })),
          claim.record(new EmailClaimed({ memberId: cmd.memberId, role: cmd.role }))
        ]
}) {}
```

Two requests for the same value read the same claim instance; one commits first, the other finds the version moved,
decides again, and is refused.

Checked in: `website/src/content/docs/domain/unique-values.mdx` at `v2.0.0-beta.87` lines 6-115;
`examples/cloudflare-domain/packages/domain/src/Customer/UsernameClaim.aggregate.ts` lines 12-31,
`ClaimUsername.command.ts` lines 6-19 (a command with `target: Username`), `UsernameReservation.policy.ts` lines
15-33 and `Customer.aggregate.ts` lines 23-61 (the `Pending` state and `RegistrationRejected` resetting to `New`) at
`v2.0.0-beta.87`. The main form: `packages/domain/src/Decision.ts` at `main@dbfd0ddb` (see [Decision](./decision.md)).

### What main changes

- The docs page is rewritten around a decision (`website/src/content/docs/domain/unique-values.mdx` main lines
  6-124), alongside `Domain.Decision` (commit `dbda8cc16`, #3420; that the docs and example changed in that same
  commit is not verified): `UsernameClaim` has no `commands`, only `events: [UsernameClaimed]` and `evolve`
  (`examples/cloudflare-domain/packages/domain/src/Customer/UsernameClaim.aggregate.ts` main lines 12-29).
- `ClaimUsername.command.ts`, `ConfirmRegistration.command.ts`, `RejectRegistration.command.ts` and
  `UsernameReservation.policy.ts` are gone; `Registration.decision.ts` (new, lines 15-45) reads `{ customer, claim }`,
  rejects with `NotTheCustomer`, `AlreadyRegistered` or `UsernameTaken`, and otherwise records `CustomerRegistered`
  and `UsernameClaimed` together. It also states two `transitions` (the name goes to who registered; only a free name
  is claimed), and `UsernameClaim` states one (a claimed name stays with its holder).
- `Customer` loses its `Pending` state and every command (`Customer.aggregate.ts` main lines 11-26); it only folds
  `CustomerRegistered`.
- The main docs page's test is wrong as written: `new RegisterCustomer({ customerId: Registration.id, customerId: c1,
  ... })` names `customerId` twice and a `Registration.id` that does not exist (main lines 164 and 175). Pass
  `customerId: c1` only.
- `Domain.Decision` is main only (see [Decision](./decision.md)).

## Rules, and the mistakes to avoid

- **Normalise before keying.** The claim's id is the normalised value; the app's `skuKey` (upper-cased, spaces
  removed) and the lower-cased email already are.
- **Scope the key to the tenant.** `${organizationId}:${skuKey}`, never the bare SKU: two organizations may use one SKU.
- **A repeated claim by the same holder records nothing** (beta.87): policies run at least once, so the claim must be
  idempotent.
- **At beta.87 the claim is taken first and is not released on its own.** In the bank example a rejected
  registration resets the customer to `New`, but nothing frees a claim that was taken for a request that later failed
  for another reason. Decide who releases a claim (a take-back, a removal) before relying on it.
- **On main the value's instance becomes hot** only for that one value; that is the point and costs nothing extra.
- **Key by a value that does not change under you.** A claim keyed by an email goes stale if the person changes that
  email in Better Auth; the claim should hold the member id the email resolved to, so the membership itself does not
  depend on the address staying the same.
- **Many values in one command** (a whole file of SKUs) means many claim instances in one decision; see the cost table
  on [Decision](./decision.md).

## In this app

Today the app's rule 3 ("a second import of the same file adds nothing") rests on one D1 unique index and one clause:
`UNIQUE (organizationId, skuKey)` on `item` (`apps/inventory/migrations/0001_init.sql` line 297) and
`INSERT ... ON CONFLICT (organizationId, skuKey) DO NOTHING` in the confirm's batch
(`packages/catalog/host/src/ImportStore.adapter.ts`, `commit`). What that gives, and what any replacement must still
give:

1. Two confirms racing for one SKU cannot both create it; the loser's row lands as `already`, not as an error.
2. The count of "already there" is **counted from what landed** (the rows the insert did not write), not from what
   the preview guessed, so the result's three numbers agree.
3. It holds per organization: the same SKU in `org_prairie` and `org_northline` is two items.
4. It is part of the same atomic write as the rest of the confirm.

The simplest model that keeps all four: key the `Item` aggregate by `${organizationId}:${skuKey}`. The confirm (a
[decision](./decision.md) on main) reads each named item; version 0 means free, so it records `ItemCreated`;
version above 0 means already there, so it records nothing on it and counts the row as `already`. No separate claim.
This keying was run in a trial on 2026-11-19 on main: an `Item` aggregate keyed by organization and SKU key, whose
`CreateFromImport` answers `[]` when the item is there, had `ARevisionStartsAtOne` and `ASecondCreateChangesNothing`
proved by `Verify.aggregate`. The trial did not run a decision, so the confirm across items was not run.

The email a person is added by is the case that needs a claim. `user.email` is unique in Better Auth's own table, the
lookup is `lower(email)` (`apps/inventory/migrations/0001_init.sql` line 428,
`packages/access/host/src/PeopleStore.adapter.ts` line 57), and one membership per person per organization is the index `member (organizationId, userId)` (migration
line 79). On main the add becomes a decision over the `Organization` (its membership and roles) and a `MemberEmail`
claim keyed by `${organizationId}:${lower-cased email}`: the app's nearest match to the upstream `Registration`,
which reads `Customer` and `UsernameClaim` (see [Decision](./decision.md)). The handler already resolves the email to
an account before writing (`packages/access/model/src/People/People.handler.ts` line 64), so the command can carry
both the email key and the member id. The email-to-account lookup stays in Better Auth (see
[Better Auth](./better-auth.md)).

- **Used today:** no. The D1 unique index `(organizationId, skuKey)` with `ON CONFLICT DO NOTHING`, and Better Auth's
  unique `user.email` with the `member (organizationId, userId)` index.
- **Where it goes:** the item's id in a catalog model (`packages/catalog/model/src/`), replacing the unique index's
  role in `ImportStore.commit`; a `MemberEmail` claim beside an `Organization` aggregate in the access model
  (`packages/access/model/src/`), replacing `PeopleStore.add`'s reliance on the member index.
- **What the person gets:** loading the same file twice still says every row is already there, counted from what is
  stored; an admin who adds an email already in the organization is told so at once.

## How to check it

- A [story](./story.md): `Story.given` an `ItemCreated` on `Item.ref("org_prairie:BOLT-M8")`, confirm an import
  naming the same key, then `Story.then` on that item with no events, and on the import with `already: 1`.
- The same key in `org_northline` creates a new item (rule 6).
- On main, `Verify.aggregate(Item)` on the item keyed by `${organizationId}:${skuKey}`, with a transition such as
  `ASecondCreateChangesNothing` (run in the trial, above); and a decision transition such as
  `OnlyAFreeEmailIsClaimed` (`({ before }) => before.claim._tag === "Free"`, the shape of the upstream
  `OnlyAFreeNameIsClaimed`) proved by `Verify.model` or [Prove](./prove.md) (not run).
- At beta.87, a story where two claims for one key arrive: the second ends in `Story.rejected(new SkuTaken())`.

## What it needs

Beta.87: any host (it is plain aggregates, commands and a policy). Main: a host that hosts decisions (in memory or
any Durable Object host).

## Verdict

**Use:** key the `Item` aggregate by `${organizationId}:${skuKey}` so the id is the unique value (works on beta.87),
and keep the "already there" count read from what committed. Where a value is claimed together with something else
(the email a person is added by), use the claim aggregate with a [decision](./decision.md), which needs `main@dbfd0ddb`;
on beta.87 the same claim is a command plus a policy, and the caller learns of a taken value later, as an event.

## Where this was read

- https://alchemy.run/domain/unique-values (the live site documents beta.87)
- `website/src/content/docs/domain/unique-values.mdx` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed
- `examples/cloudflare-domain/packages/domain/src/Customer/UsernameClaim.aggregate.ts` at `v2.0.0-beta.87`; on
  `main@dbfd0ddb`: changed
- `examples/cloudflare-domain/packages/domain/src/Customer/UsernameReservation.policy.ts`, `ClaimUsername.command.ts`
  at `v2.0.0-beta.87`; on `main@dbfd0ddb`: removed
- `examples/cloudflare-domain/packages/domain/src/Customer/Customer.aggregate.ts` at `v2.0.0-beta.87`; on
  `main@dbfd0ddb`: changed
- `examples/cloudflare-domain/packages/domain/src/Customer/Registration.decision.ts`: on `main@dbfd0ddb` new
- `packages/domain/src/Decision.ts`: not at `v2.0.0-beta.87`; on `main@dbfd0ddb` new
