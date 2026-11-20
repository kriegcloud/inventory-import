---
type: Exploration
title: Ideal architecture
description: What inventory-import becomes as a model-first Turborepo of deep packages, shipped with Alchemy.
status: active
stage: shape
next: step 8, `@beep/xlsx`; goals ui-packages and contexts are built
goals: [workspace-and-strictness, beep-csv, kernel-drivers, ui-packages, contexts]
---

# Ideal architecture

Four research reports are in `research/`. This page brings them together. Nothing in it was compiled or deployed;
each report lists what it could not verify.

| Report | Headline |
| --- | --- |
| [01 Alchemy domain layer](research/01-alchemy-domain.md) | An event-sourced engine on Durable Objects, still a fast-moving beta. Borrow its ideas; keep the Effect HttpApi and the D1 core. Its recommendation was reversed on 2026-11-19: see [alchemy-domain](../alchemy-domain/README.md). |
| [02 Alchemy infrastructure](research/02-alchemy-infra.md) | Alchemy can declare, test and ship the app end to end. Keep D1 with raw SQL. No cluster, Drizzle or R2 yet. |
| [03 Effect v4 modules](research/03-effect-modules.md) | `Model.Class` for stored rows and `@effect/ai-openrouter` are clear wins. Atoms are possible but costly. GraphQL adds nothing. |
| [04 beep-effect direction](research/04-beep-direction.md) | Two contexts in the model-first shape, nineteen packages and one app. `@beep/csv` first, `@beep/xlsx` last. |

The brief for `beep-csv` (step 4) is [BRIEF.md](BRIEF.md); Benjamin said it matches, and the goal is open at
[goals/beep-csv](../../goals/beep-csv/SPEC.md). Each later goal's brief is its own file, `BRIEF-<goal>.md`; the first
brief keeps its name. Step 5's is [BRIEF-kernel-drivers.md](BRIEF-kernel-drivers.md); Benjamin said it matches, and the goal is done at
[goals/kernel-drivers](../../goals/kernel-drivers/SPEC.md). Step 6's is [BRIEF-ui-packages.md](BRIEF-ui-packages.md)
and step 7's [BRIEF-contexts.md](BRIEF-contexts.md); Benjamin said both match, and the goals are open at
[goals/ui-packages](../../goals/ui-packages/SPEC.md) and [goals/contexts](../../goals/contexts/SPEC.md). Step 8's is
[BRIEF-xlsx.md](BRIEF-xlsx.md), which Benjamin said matches; the goal is done at
[goals/beep-xlsx](../../goals/beep-xlsx/SPEC.md). Step 9's is [BRIEF-infra.md](BRIEF-infra.md), which Benjamin
said matches; its goal is opened after the Effect-imports migration is merged. [BRIEF-atoms.md](BRIEF-atoms.md)
follows infra; Benjamin said it matches too.

## Where the research disagrees with the request

The request listed many technologies. The research recommended against using several of them. On 2026-11-19 Benjamin
reversed that for the Alchemy domain and for the extras he named ("Not borrow use."; DECISIONS.md, "core, reversed");
the rows it changes say so, and how each is used is in the [alchemy-domain](../alchemy-domain/README.md) packet. The
recommendation column is kept as it was written, for the record.

| Asked for | What the research found | Recommendation |
| --- | --- | --- |
| Alchemy domain as the core | It does not build on Effect's `schema/Model`. The documented API (npm `2.0.0-beta.87`) already differs from GitHub `main`. Confirm and take-back would stop being one atomic write. | Model-first package shape now, over D1 state tables behind ports. Move the import lifecycle onto an aggregate later, once a release with `Decision` is published. **Reversed 2026-11-19: used, all of it.** |
| Effect Cluster, workflows, singletons | The SQL storage needs transactions, which the D1 driver cannot do. The only Workers path keeps state in Durable Objects and is experimental. No step of an import needs them today. | Not now. Revisit if a model pass outgrows one request. **Reversed 2026-11-19: Cluster as a host and workflows are used; singletons and crons cannot be yet, and the packet says what is in the way.** |
| Drizzle v1 in Durable Objects | A second schema language beside Effect Schema, and no help for the hard SQL (full-text search, triggers, composite keys). | Keep D1 with raw SQL and `Model.Class` row schemas. **Reversed 2026-11-19 for tables inside one object (the model-call allowance); D1 keeps raw SQL.** |
| `@effect/atom-react` and reactivity | Works, but undo per change, invalidate-after-last-write and keep-previous-data paging must be rebuilt by hand. | Keep TanStack Query for the first version; atoms as a later, separate change. **Reversed 2026-11-19 by "client state, reversed": the atoms goal.** |
| `effect/graphql` | A client only. There is no server to call. | Leave out. **Reversed 2026-11-19: used as a client; serving cannot be yet.** |
| `@effect/ai-typesafe` for confidence scores | It does not score another model's answer; a score costs a second call to a second vendor. | No second vendor until a labelled calibration run shows a gain. **Reversed 2026-11-19: used, to decide closed questions with a calibrated probability.** |
| Alchemy Git for CI/CD | `alchemy.run/git` is a self-hosted git server. The GitHub provider declares environments, secrets and rules, but not workflow files. | Declare repository settings in a workstation-only stack; keep the workflow file hand-written. **Added to on 2026-11-19: Alchemy Git is used as a history of confirmed imports and a mirror; CI on it cannot be yet. The stack and the workflow file stand.** |
| distilled 1Password package | It wraps the Connect REST API and cannot resolve `op://` references. | Run deploys under `op run`. **Added to on 2026-11-19: the distilled clients are used where each has an honest job; `@alchemy.run/1password`, on the library's main, does resolve references at a deploy.** |
| R2 presigned uploads | Rows arrive as JSON; a bucket adds cross-origin setup for nothing. | Leave out. Stands: not among what he asked for on 2026-11-19. |
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

- 2026-11-19: [goals/infra](../../goals/infra/SPEC.md) built as far as this machine allows: the seeds out of the
  migration, closed sign-up, `@beep/infra` with the stage plan and the two stacks, `deploy.yml`. Nothing deployed;
  the next step is Benjamin's login and `alchemy state bootstrap` ([PLAN](../../goals/infra/PLAN.md)).
- 2026-11-19: Benjamin answered BRIEF-atoms.md (A1 to A5) and said it matches; its goal opens after infra.
- 2026-11-19: Benjamin answered BRIEF-infra.md (I1 to I9) and said it matches; order of work: the Effect-imports
  migration, then infra, then atoms.
- 2026-11-19: BRIEF-atoms.md written after Benjamin's rule "useEffect banned with no exceptions"; the decision
  "client state" is reversed; nothing built.
- 2026-11-19: BRIEF-infra.md written for the goal `infra` (step 9); nothing built or deployed; awaiting "the brief
  matches" and nine decisions.
- 2026-11-19: goal `beep-xlsx` done: the app reads workbooks through `@beep/xlsx`; the SheetJS reader removed, and
  SheetJS kept only as the package's test oracle.
- 2026-11-19: goal `beep-xlsx` opened from BRIEF-xlsx.md after "The brief matches", X1 to X6 answered.
- 2026-11-19: Benjamin answered X1, X2, X4, X5 and X6 of BRIEF-xlsx.md; X3 is open and the brief is not yet said
  to match.
- 2026-11-19: BRIEF-xlsx.md written for the goal `beep-xlsx` (step 8); awaiting "the brief matches" and its six
  decisions.
- 2026-11-18: goal `contexts` built: `access` and `catalog` each as `contract`, `model`, `host` and `web`, with
  `@inventory/client` between the screens and the API; the app composes them. Its PLAN's closing note says what
  still differs from the brief, and what `@beep/xlsx` and `@beep/infra` should know.
- 2026-11-18: goal `ui-packages` built: `@inventory/ui` and `@inventory/review`.
- 2026-11-18: goals `ui-packages` and `contexts` opened after "the brief matches" for both.
- 2026-11-18: BRIEF-ui-packages.md and BRIEF-contexts.md written for the goals `ui-packages` (step 6) and
  `contexts` (step 7); awaiting "the brief matches".
- 2026-11-18: goal `kernel-drivers` done: the app runs on `@inventory/kernel`, `@beep/d1`, `@beep/better-auth` and
  `@beep/openrouter`; the Vercel AI SDK and Drizzle are removed.
- 2026-11-18: goal `kernel-drivers` opened from BRIEF-kernel-drivers.md after "the brief matches".
- 2026-11-18: BRIEF-kernel-drivers.md written for the goal `kernel-drivers` (step 5); awaiting "the brief matches".
- 2026-11-18: goal `beep-csv` done: the app reads CSV through `@beep/csv`; papaparse removed.
- 2026-11-18: goal `beep-csv` opened from BRIEF.md after "the brief matches".
- 2026-11-18: BRIEF.md written for the goal `beep-csv` (step 4); awaiting "the brief matches".
- 2026-11-18: goal `workspace-and-strictness` opened for steps 0 to 2 of the order of work.
- 2026-11-18: four research reports written; decisions put to Benjamin.
- 2026-11-19: BRIEF-tooling-cli.md written for a goal `tooling-cli`: a CLI package at `packages/tooling/tool/cli`
  as beep-effect has, and the ten scripts under `scripts/` ported to commands on it. Outside the nine steps; nothing
  built; awaiting "the brief matches" and answers T1 to T8.
- 2026-11-19: Benjamin signed the tooling CLI brief (T1 to T8); goal `tooling-cli` opened.
- 2026-11-19: goal `tooling-cli` done: the ten scripts are commands of `@beep/repo-cli` and `scripts/` is gone.
- 2026-11-19: Benjamin reversed "core": the app uses `@alchemy.run/domain`, all of it, with the extras he named. The
  reading, two trials and the brief are the packet [alchemy-domain](../alchemy-domain/README.md); nothing of it is
  built, and its build starts after he signs that brief and the atoms goal is merged.
