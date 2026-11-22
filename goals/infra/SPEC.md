---
type: Goal
title: "Infra"
description: "@beep/infra declares the app's Cloudflare resources and the repository's GitHub settings as Alchemy stacks; sign-up is closed with a first-admin path; the seed rows leave the migration. Built and checked on this machine only: it stops before the first step that touches anything outside it."
status: active
from: explorations/ideal-architecture
---

# Infra

Step 9 of the order of work in [the ideal-architecture exploration](../../explorations/ideal-architecture/README.md).
The design is [BRIEF-infra.md](../../explorations/ideal-architecture/BRIEF-infra.md), with decisions I1 to I9 as
Benjamin answered them.

## Objective

Everything a first deploy to `inventory.beep-effect.com` needs is in the repository, type-checked and tested without
a cloud: the stage plan, the two stacks, the deploy workflow, a database that starts empty in production, and a
sign-in that nobody can open an account on without Benjamin. The deploy itself is his.

## Non-goals

From the brief's No-gos: no Effect Cluster, workflows, Drizzle, Durable Objects of the app's own, R2 or queues; no
email; no `Zone` resource; no `alchemy dev` in place of `bun run dev`; no change to an import rule or count.

This goal's own limit: **nothing outside this machine**. No login command, no token, no account, DNS record, GitHub
setting or secret is touched, nothing is deployed or planned against a real account, and
the 1Password reference for `TYPESAFE_AI_API_KEY` is never resolved and is given to no stage.

## Constraints

- The app keeps working at every commit: `items_messy.csv` (200 rows) imports to 155 stored; development still
  opens signed in as the first test account.
- Effect 4.1.4, every module imported whole from its own path under its fixed name
  ([docs/standards/effect-imports.md](../../docs/standards/effect-imports.md)); the schema standard; a role suffix in
  every filename; exact exports; the full strictness profile for the new package; the override sum no higher.
- Every `@alchemy.run/*` package at one exact version.
- No secret value in the repository; a reference stays a reference.
- bun only; nothing pushed.

## Acceptance

- [x] `apps/inventory/migrations/0001_init.sql` inserts no organization and no member; the seeds are in
      `apps/inventory/seeds/`; development and the tests still have their two organizations and five accounts.
- [x] Sign-up is closed (I8): the public sign-up endpoint refuses, the sign-in page offers no sign-up, and the first
      admin of an organization is made the way PLAN describes; a test holds each, and each was seen in the browser.
- [x] `packages/infra` exists with the stage schema, `planFor` and its test: every stage kind maps to its plan,
      production has no seed and no `workers.dev` address, a name outside the four kinds is refused.
- [x] The app's stack and the GitHub stack are written against Alchemy at one exact version and type-check.
- [x] `.github/workflows/deploy.yml` exists and cannot destroy any stage but `pr-<number>`.
- [x] `bun run check:full` passes on the last commit.
- [x] PLAN lists what was proved without a cloud, what cannot be known until the first apply, and what Benjamin
      does by hand, in order.

## Where it stands

Every acceptance line holds on this machine. The goal stays active: the deploy and what it settles are in
[PLAN](PLAN.md), "What cannot be known until the first apply" and "What Benjamin does by hand".

## Decisions

In [the exploration's DECISIONS.md](../../explorations/ideal-architecture/DECISIONS.md): "infra I1" to "infra I9",
"infra brief", "order of work after xlsx".
