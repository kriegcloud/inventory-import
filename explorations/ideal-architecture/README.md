---
type: Exploration
title: Ideal architecture
description: What inventory-import becomes as a model-first Turborepo of deep packages, shipped with Alchemy.
status: active
stage: shape
next: goal beep-csv (step 4) is open; step 5, kernel and drivers, is next to shape
goals: [workspace-and-strictness, beep-csv]
---

# Ideal architecture

Four research reports are in `research/`. This page brings them together. Nothing in it was compiled or deployed;
each report lists what it could not verify.

| Report | Headline |
| --- | --- |
| [01 Alchemy domain layer](research/01-alchemy-domain.md) | An event-sourced engine on Durable Objects, still a fast-moving beta. Borrow its ideas; keep the Effect HttpApi and the D1 core. |
| [02 Alchemy infrastructure](research/02-alchemy-infra.md) | Alchemy can declare, test and ship the app end to end. Keep D1 with raw SQL. No cluster, Drizzle or R2 yet. |
| [03 Effect v4 modules](research/03-effect-modules.md) | `Model.Class` for stored rows and `@effect/ai-openrouter` are clear wins. Atoms are possible but costly. GraphQL adds nothing. |
| [04 beep-effect direction](research/04-beep-direction.md) | Two contexts in the model-first shape, nineteen packages and one app. `@beep/csv` first, `@beep/xlsx` last. |

The brief for `beep-csv` (step 4) is [BRIEF.md](BRIEF.md); Benjamin said it matches, and the goal is open at
[goals/beep-csv](../../goals/beep-csv/SPEC.md).

## Where the research disagrees with the request

The request listed many technologies. The research recommends against using several of them now. These are the
points to settle before any code moves.

| Asked for | What the research found | Recommendation |
| --- | --- | --- |
| Alchemy domain as the core | It does not build on Effect's `schema/Model`. The documented API (npm `2.0.0-beta.87`) already differs from GitHub `main`. Confirm and take-back would stop being one atomic write. | Model-first package shape now, over D1 state tables behind ports. Move the import lifecycle onto an aggregate later, once a release with `Decision` is published. |
| Effect Cluster, workflows, singletons | The SQL storage needs transactions, which the D1 driver cannot do. The only Workers path keeps state in Durable Objects and is experimental. No step of an import needs them today. | Not now. Revisit if a model pass outgrows one request. |
| Drizzle v1 in Durable Objects | A second schema language beside Effect Schema, and no help for the hard SQL (full-text search, triggers, composite keys). | Keep D1 with raw SQL and `Model.Class` row schemas. |
| `@effect/atom-react` and reactivity | Works, but undo per change, invalidate-after-last-write and keep-previous-data paging must be rebuilt by hand. | Keep TanStack Query for the first version; atoms as a later, separate change. |
| `effect/graphql` | A client only. There is no server to call. | Leave out. |
| `@effect/ai-typesafe` for confidence scores | It does not score another model's answer; a score costs a second call to a second vendor. | No second vendor until a labelled calibration run shows a gain. |
| Alchemy Git for CI/CD | `alchemy.run/git` is a self-hosted git server. The GitHub provider declares environments, secrets and rules, but not workflow files. | Declare repository settings in a workstation-only stack; keep the workflow file hand-written. |
| distilled 1Password package | It wraps the Connect REST API and cannot resolve `op://` references. | Run deploys under `op run`. |
| R2 presigned uploads | Rows arrive as JSON; a bucket adds cross-origin setup for nothing. | Leave out. |
| The four codec packages as a template | They have no filename postfixes, export `./internal/*`, and depend on three packages that are private in beep-effect. | Postfix in every filename, exact exports, and vendor the needed subset of `@beep/identity`, `@beep/schema`, `@beep/utils`. |
| Lift the current reader into `@beep/csv` and `@beep/xlsx` | The reader wraps papaparse and SheetJS. Effect ships `effect/encoding` `Csv`, `Zip` and `Xml`. | Write both engines; use the old reader as the parity test. |
| tsgo strictness from beep-effect | The compiler flags already match. The gap is Effect diagnostic severities: 2,167 errors, 744 in own code. | Strict for new packages; fix on move for the rest; vendored ui excluded. |

## The proposed repository

```
inventory-import/
├─ apps/inventory/                 Worker + SPA, one Vite build, migrations, integration tests
├─ packages/
│  ├─ kernel/                      ids, sign-in middleware, activity line
│  ├─ access/   contract model host web     who may do what: people, roles, activity, model allowance
│  ├─ catalog/  contract model host web     items and imports (they share one atomic write)
│  ├─ ui/  review/                 design system; the review region
│  ├─ drivers/  d1  better-auth  ai
│  ├─ infra/                       @beep/infra: Alchemy stacks, stage config, GitHub settings
│  └─ foundation/modeling/  identity schema utils csv xlsx
├─ explorations/  goals/           simplified packets
└─ turbo.json  tsconfig.base.json
```

## Order of work

Each step ends with the full check and an import of the messy sample in a browser, three numbers agreeing.

0. Remove the timed-build tooling and rename the starter's placeholder names.
1. Workspace and Turborepo; the app moves unchanged to `apps/inventory`.
2. tsgo profile from beep-effect, staged.
3. Vendored `@beep/identity`, `@beep/schema`, `@beep/utils`.
4. `@beep/csv`, proved against today's reader, which is then removed.
5. Kernel and drivers.
6. UI packages.
7. Contexts: `access`, then `catalog`.
8. `@beep/xlsx`.
9. `@beep/infra` and the first deploy to inventory.beep-effect.com.

## Trail

- 2026-11-18: goal `beep-csv` opened from BRIEF.md after "the brief matches".
- 2026-11-18: BRIEF.md written for the goal `beep-csv` (step 4); awaiting "the brief matches".
- 2026-11-18: goal `workspace-and-strictness` opened for steps 0 to 2 of the order of work.
- 2026-11-18: four research reports written; decisions put to Benjamin.
