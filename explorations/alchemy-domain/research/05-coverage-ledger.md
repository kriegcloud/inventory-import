---
type: Research
title: Coverage ledger
description: Every docs page and every source file the packet rests on, each marked with how it was read and at which release, with the counts, and a check of the list against the folders so that nothing is unlisted.
---

# Coverage ledger

What was read, so that a claim on any page can be traced, and so that a later pass can see what was not. A ledger was kept during each reading pass; this page is generated from those ledgers and checked against the folders themselves.

Three marks. **Read in full**: every line. **Outline**: exports, signatures and the parts a page needed; said honestly, because some packages are large and only plug into the library. **Not read**: listed so that it is not mistaken for covered.

Two releases of the Alchemy repository: the tag `v2.0.0-beta.87` (what npm and the live site have) and `main` at `dbfd0ddb`.

## 1. The library's docs pages

The docs folder `website/src/content/docs/domain` has 44 pages at the release tag and 47 on `main`. The live site's own index (`https://alchemy.run/llms.txt`) lists 44 addresses under `/domain`, the same 44 names as the folder at the tag. Each live page was fetched on 2026-11-19 and compared with the file at the tag; the column says how much of the file's text was found on the live page.

| Page | Address | On the live site | Read at beta.87 | Read on main | Fed |
| --- | --- | --- | --- | --- | --- |
| `aggregate` | https://alchemy.run/domain/aggregate | fetched; 100% of the file's text found | read in full | read in full | 01-pr-3260-verify, aggregate, invariants-and-transitions |
| `annotations` | https://alchemy.run/domain/annotations | fetched; 100% of the file's text found | read in full | read in full | annotations |
| `api` | https://alchemy.run/domain/api | fetched; 100% of the file's text found | read in full | read in full | api |
| `backfill` | https://alchemy.run/domain/backfill | fetched; 100% of the file's text found | read in full | read in full | backfill |
| `better-auth` | https://alchemy.run/domain/better-auth | fetched; 100% of the file's text found | read in full | read in full | better-auth, discord-sign-in |
| `cli` | https://alchemy.run/domain/cli | fetched; 100% of the file's text found | read in full | read in full | cli |
| `cloudflare` | https://alchemy.run/domain/cloudflare | fetched; 99% of the file's text found | read in full | read in full | host-cloudflare |
| `command` | https://alchemy.run/domain/command | fetched; 100% of the file's text found | read in full | read in full | command, rejection |
| `deadlines` | https://alchemy.run/domain/deadlines | fetched; 100% of the file's text found | read in full | read in full | deadlines |
| `decision` | https://alchemy.run/domain/decision | not on the site (404): `main` only | not in this release | read in full | 01-pr-3260-verify, decision, invariants-and-transitions |
| `effect-cluster` | https://alchemy.run/domain/effect-cluster | fetched; 100% of the file's text found | read in full | read in full | host-effect-cluster |
| `event` | https://alchemy.run/domain/event | fetched; 100% of the file's text found | read in full | read in full | event |
| `external-system` | https://alchemy.run/domain/external-system | fetched; 100% of the file's text found | read in full | read in full | external-system, resend |
| `foldkit` | https://alchemy.run/domain/foldkit | fetched; 100% of the file's text found | read in full | read in full | foldkit |
| `http-api` | https://alchemy.run/domain/http-api | fetched; 100% of the file's text found | read in full | read in full | http-api |
| `in-memory` | https://alchemy.run/domain/in-memory | fetched; 100% of the file's text found | read in full | read in full | host-in-memory, platform-contract |
| `index` | https://alchemy.run/domain/ | fetched; 100% of the file's text found | read in full | read in full | model |
| `local-first` | https://alchemy.run/domain/local-first | fetched; 100% of the file's text found | read in full | read in full | local-first |
| `mcp` | https://alchemy.run/domain/mcp | fetched; 100% of the file's text found | read in full | read in full | ai-and-mcp |
| `model` | https://alchemy.run/domain/model | fetched; 100% of the file's text found | read in full | read in full | 01-pr-3260-verify, backfill, model, verify, view |
| `observability` | https://alchemy.run/domain/observability | fetched; 100% of the file's text found | read in full | read in full | observability |
| `optimistic-updates` | https://alchemy.run/domain/optimistic-updates | fetched; 100% of the file's text found | read in full | read in full | local-first |
| `policy` | https://alchemy.run/domain/policy | fetched; 100% of the file's text found | read in full | read in full | policy |
| `project-layout` | https://alchemy.run/domain/project-layout | fetched; 100% of the file's text found | read in full | read in full | project-layout |
| `projection` | https://alchemy.run/domain/projection | fetched; 100% of the file's text found | read in full | read in full | backfill, projection |
| `query` | https://alchemy.run/domain/query | fetched; 100% of the file's text found | read in full | read in full | query, reads-and-consistency |
| `rivet` | https://alchemy.run/domain/rivet | fetched; 100% of the file's text found | read in full | read in full | host-rivet |
| `saga` | https://alchemy.run/domain/saga | fetched; 100% of the file's text found | read in full | read in full | saga |
| `sessions` | https://alchemy.run/domain/sessions | fetched; 100% of the file's text found | read in full | read in full | sessions |
| `story` | https://alchemy.run/domain/story | fetched; 100% of the file's text found | read in full | read in full | 01-pr-3260-verify, story, verify |
| `stream` | https://alchemy.run/domain/stream | fetched; 100% of the file's text found | read in full | read in full | stream |
| `testing-apis` | https://alchemy.run/domain/testing-apis | fetched; 100% of the file's text found | read in full | read in full | test-tooling |
| `testing-models` | https://alchemy.run/domain/testing-models | fetched; 100% of the file's text found | read in full | read in full | story, test-tooling |
| `tutorial/part-1` | https://alchemy.run/domain/tutorial/part-1 | fetched; 100% of the file's text found | read in full | read in full | tutorial |
| `tutorial/part-2` | https://alchemy.run/domain/tutorial/part-2 | fetched; 100% of the file's text found | read in full | read in full | tutorial |
| `tutorial/part-3` | https://alchemy.run/domain/tutorial/part-3 | fetched; 100% of the file's text found | read in full | read in full | tutorial |
| `tutorial/part-4` | https://alchemy.run/domain/tutorial/part-4 | fetched; 100% of the file's text found | read in full | read in full | tutorial |
| `tutorial/part-5` | https://alchemy.run/domain/tutorial/part-5 | fetched; 100% of the file's text found | read in full | read in full | tutorial |
| `tutorial/part-6` | https://alchemy.run/domain/tutorial/part-6 | fetched; 100% of the file's text found | read in full | read in full | tutorial |
| `tutorial/part-7` | https://alchemy.run/domain/tutorial/part-7 | fetched; 100% of the file's text found | read in full | read in full | tutorial |
| `tutorial/part-8` | https://alchemy.run/domain/tutorial/part-8 | fetched; 100% of the file's text found | read in full | read in full | tutorial |
| `unique-values` | https://alchemy.run/domain/unique-values | fetched; 100% of the file's text found | read in full | read in full | unique-values |
| `verifiable-code` | https://alchemy.run/domain/verifiable-code | not on the site (404): `main` only | not in this release | read in full | 01-pr-3260-verify, invariants-and-transitions, prove, verify |
| `verifying-models` | https://alchemy.run/domain/verifying-models | not on the site (404): `main` only | not in this release | read in full | 01-pr-3260-verify, explore, invariants-and-transitions, prove, relation, verify |
| `view-security` | https://alchemy.run/domain/view-security | fetched; 100% of the file's text found | read in full | read in full | view-security |
| `view` | https://alchemy.run/domain/view | fetched; 100% of the file's text found | read in full | read in full | reads-and-consistency, view |
| `what-is-ddd` | https://alchemy.run/domain/what-is-ddd | fetched; 100% of the file's text found | read in full | read in full | model |

## 2. The library's source

`packages/domain/src`: 44 files and 24,361 lines at the release tag; 64 files and 41,111 lines on `main`.

| File | Lines at beta.87 | Lines on main | Read at beta.87 | Read on main | Fed |
| --- | --- | --- | --- | --- | --- |
| `Aggregate.ts` | 832 | 917 | read in full | read in full | 02-merged-since-beta-87, aggregate, command, deadlines, event, external-system, invariants-and-transitions, local-first, model, platform-contract, policy, prove, saga, sessions, story, tutorial |
| `Ai.ts` | 343 | 334 | read in full | read in full | ai-and-mcp, annotations |
| `Annotations.ts` | 54 | 53 | read in full | read in full | annotations, command, http-api |
| `Api.ts` | 1477 | 1670 | read in full | read in full | ai-and-mcp, api, command, foldkit, http-api, observability, query, reads-and-consistency, sessions, stream, test-tooling, tutorial, view, view-security |
| `Backfill.ts` | 2230 | 2252 | read in full | read in full | backfill, host-cloudflare, platform-contract |
| `CatchUp.ts` | 68 | 68 | read in full | read in full | backfill, reads-and-consistency |
| `Cli.ts` | 548 | 543 | read in full | read in full | annotations, cli |
| `Cloudflare/Backfill.ts` | 396 | 419 | read in full | read in full | backfill, distilled-clients, host-cloudflare |
| `Cloudflare/Providers.ts` | 45 | 45 | read in full | read in full | host-cloudflare |
| `Cloudflare/Version.ts` | 21 | 21 | read in full | read in full | host-cloudflare |
| `Cloudflare/index.ts` | 646 | 656 | read in full | read in full | backfill, host-cloudflare, model, platform-contract, saga, tutorial |
| `Command.ts` | 277 | 344 | read in full | read in full | 02-merged-since-beta-87, annotations, api, command, model, reads-and-consistency, rejection, sessions, story, tutorial |
| `Decision.ts` | — | 407 | new on main | read in full | annotations, deadlines, decision, invariants-and-transitions |
| `DefinitionError.ts` | 425 | 469 | read in full | read in full | aggregate, command, decision, event, external-system, model, projection, query, sessions, stream, view, view-security |
| `DurableObjects.ts` | 2343 | 2838 | read in full | read in full | backfill, command, deadlines, decision, drizzle-durable-objects, host-cloudflare, host-effect-cluster, host-rivet, policy, projection, rejection, saga |
| `EffectCluster/index.ts` | 841 | 838 | read in full | read in full | cluster-workflows, host-effect-cluster, model |
| `Event.ts` | 104 | 113 | read in full | read in full | 02-merged-since-beta-87, annotations, event, rejection |
| `Explore.ts` | — | 788 | new on main | read in full | 01-pr-3260-verify, explore, verify |
| `Explore/internal/ModelSearch.ts` | — | 3786 | new on main | read in full | explore, relation, verify |
| `Explore/internal/Script.ts` | — | 174 | new on main | read in full | explore |
| `Explore/internal/Search.ts` | — | 572 | new on main | read in full | explore |
| `ExternalSystem.ts` | 422 | 422 | read in full | read in full | annotations, distilled-clients, external-system, observability, resend |
| `Filter.ts` | 315 | 315 | read in full | read in full | reads-and-consistency |
| `Foldkit.ts` | 610 | 609 | read in full | read in full | foldkit |
| `Http.ts` | 476 | 467 | read in full | read in full | annotations, http-api |
| `InMemory.ts` | 1387 | 1552 | read in full | read in full | 02-merged-since-beta-87, aggregate, command, deadlines, decision, host-in-memory, model, platform-contract, policy, projection, rejection, story |
| `InMemoryWorkflows.ts` | 252 | 252 | read in full | read in full | cluster-workflows, host-in-memory, saga |
| `Kernel.ts` | 1640 | 2033 | read in full | read in full | aggregate, backfill, decision, event, model, observability, platform-contract, policy, projection, rejection, sessions |
| `Key.ts` | 45 | 45 | read in full | read in full | aggregate, view |
| `Middleware.ts` | 38 | 43 | read in full | read in full | 02-merged-since-beta-87, api, command, sessions |
| `Model.ts` | 1260 | 1845 | read in full | read in full | 02-merged-since-beta-87, deadlines, decision, invariants-and-transitions, model, observability, platform-contract, policy, projection, reads-and-consistency, relation, saga, sessions, tutorial, view, view-security |
| `Platform.ts` | 722 | 881 | read in full | read in full | decision, host-in-memory, model, platform-contract, policy, projection |
| `Policy.ts` | 279 | 279 | read in full | read in full | distilled-clients, policy, resend |
| `Projection.ts` | 334 | 336 | read in full | read in full | backfill, projection, query, stream |
| `Prove.ts` | — | 594 | new on main | read in full | 01-pr-3260-verify, 02-merged-since-beta-87, prove, tutorial, verify |
| `Prove/internal/Check.ts` | — | 569 | new on main | read in full | explore, prove |
| `Prove/internal/Decide.ts` | — | 170 | new on main | read in full | prove |
| `Prove/internal/Induction.ts` | — | 417 | new on main | read in full | explore, prove |
| `Prove/internal/Interpreter.ts` | — | 1400 | new on main | read in full | explore, prove |
| `Prove/internal/Library.ts` | — | 1052 | new on main | read in full | prove |
| `Prove/internal/Paths.ts` | — | 1046 | new on main | read in full | explore, invariants-and-transitions, prove, relation |
| `Prove/internal/Relations.ts` | — | 600 | new on main | read in full | explore, prove |
| `Prove/internal/Smt.ts` | — | 330 | new on main | read in full | prove, verify |
| `Prove/internal/Source.ts` | — | 246 | new on main | read in full | explore, prove, verify |
| `Prove/internal/Symbolic.ts` | — | 596 | new on main | read in full | explore, prove, verify |
| `Prove/internal/Value.ts` | — | 328 | new on main | read in full | prove |
| `Query.ts` | 495 | 502 | read in full | read in full | observability, query, reads-and-consistency |
| `Read.ts` | 153 | 153 | read in full | read in full | local-first, reads-and-consistency, view-security |
| `ReadRpcs.ts` | 349 | 343 | read in full | read in full | ai-and-mcp, annotations, cli, foldkit, http-api, reads-and-consistency, stream, view |
| `Rejection.ts` | 94 | 103 | read in full | read in full | annotations, http-api, project-layout, rejection, sessions |
| `Relation.ts` | — | 79 | new on main | read in full | 01-pr-3260-verify, relation, tutorial |
| `RequestContext.ts` | 116 | 116 | read in full | read in full | better-auth, sessions, tutorial |
| `Rivet/index.ts` | 402 | 402 | read in full | read in full | host-rivet, model |
| `Saga.ts` | 489 | 489 | read in full | read in full | cluster-workflows, observability, saga, story |
| `Story.ts` | 1954 | 1992 | read in full | read in full | aggregate, command, deadlines, decision, distilled-clients, event, external-system, host-in-memory, policy, query, rejection, resend, saga, story, stream, tutorial, verify, view, view-security |
| `Stream.ts` | 292 | 292 | read in full | read in full | stream |
| `Telemetry.ts` | 126 | 126 | read in full | read in full | model, observability |
| `TwoPhase.ts` | — | 403 | new on main | read in full | 02-merged-since-beta-87, decision |
| `Verify.ts` | — | 784 | new on main | read in full | 01-pr-3260-verify, 02-merged-since-beta-87, explore, prove, tutorial, verify |
| `View.ts` | 652 | 657 | read in full | read in full | backfill, command, local-first, reads-and-consistency, tutorial, view, view-security |
| `Watch.ts` | 301 | 336 | read in full | read in full | reads-and-consistency, sessions, view-security |
| `globals.d.ts` | 2 | 2 | read in full | read in full | model |
| `index.ts` | 299 | 327 | read in full | read in full | 02-merged-since-beta-87, aggregate, api, command, decision, host-in-memory, local-first, model, policy, projection, reads-and-consistency, relation, resend, saga, sessions, story, test-tooling, tutorial, view |
| `internal.ts` | 207 | 271 | read in full | read in full | aggregate, ai-and-mcp, cli, command, foldkit, http-api, model, rejection |

Beside the source, in the same package on `main`:

| File | Read |
| --- | --- |
| `packages/domain/docs/consistency-latency.md` | read in full |
| `packages/domain/docs/decision-design.md` | read in full |
| `packages/domain/docs/query-design.md` | read in full |
| `packages/domain/skills/alchemy-domain/SKILL.md` | read in full |
| `packages/domain/skills/alchemy-domain/references/building-blocks.md` | read in full |
| `packages/domain/skills/alchemy-domain/references/frontend.md` | read in full |
| `packages/domain/skills/alchemy-domain/references/hosting.md` | read in full |
| `packages/domain/skills/alchemy-domain/references/layout.md` | read in full |
| `packages/domain/skills/alchemy-domain/references/modeling.md` | read in full |
| `packages/domain/skills/alchemy-domain/references/testing.md` | read in full |
| `packages/domain/test/types/Decision.ts` | read in full |
| `packages/domain/test/types/Model.ts` | read in full |
| `packages/domain/test/types/Story.ts` | read in full |

## 3. Other docs sections

Sections of the same site that the library plugs into, or that Benjamin named. Paths are under `website/src/content/docs`; the address of a page is `https://alchemy.run/` and its path without `.mdx`.

### Cluster

`/cluster/`. 23 files: 23 read in full, 0 as a diff, 0 in outline, 0 not read.

- **Read in full** (23): `cluster/aws.mdx`, `cluster/calling.mdx`, `cluster/cloudflare.mdx`, `cluster/crons.mdx`, `cluster/databases.mdx`, `cluster/docker.mdx`, `cluster/entities.mdx`, `cluster/existing-programs.mdx`, `cluster/fly.mdx`, `cluster/gcp.mdx`, `cluster/hetzner.mdx`, `cluster/index.mdx`, `cluster/kubernetes.mdx`, `cluster/middleware.mdx`, `cluster/pools.mdx`, `cluster/setup.mdx`, `cluster/singletons.mdx`, `cluster/tutorial/part-1.mdx`, `cluster/tutorial/part-2.mdx`, `cluster/tutorial/part-3.mdx`, `cluster/tutorial/part-4.mdx`, `cluster/what-is-effect-cluster.mdx`, `cluster/workflows.mdx`

### Better Auth

`/better-auth/`. 29 files: 29 read in full, 0 as a diff, 0 in outline, 0 not read.

- **Read in full** (29): `better-auth/databases/aurora-data-api.mdx`, `better-auth/databases/cloudflare-d1.mdx`, `better-auth/databases/cloudflare-hyperdrive.mdx`, `better-auth/databases/drizzle.mdx`, `better-auth/databases/index.mdx`, `better-auth/databases/memory.mdx`, `better-auth/databases/mysql.mdx`, `better-auth/databases/neon.mdx`, `better-auth/databases/postgres.mdx`, `better-auth/databases/sqlite.mdx`, `better-auth/guides/configuration.mdx`, `better-auth/guides/http-api-middleware.mdx`, `better-auth/guides/migrations.mdx`, `better-auth/guides/secondary-storage.mdx`, `better-auth/index.mdx`, `better-auth/sign-in-providers/custom-oauth.mdx`, `better-auth/sign-in-providers/email-password.mdx`, `better-auth/sign-in-providers/github.mdx`, `better-auth/sign-in-providers/google.mdx`, `better-auth/sign-in-providers/index.mdx`, `better-auth/sign-in-providers/microsoft.mdx`, `better-auth/tutorial/part-1.mdx`, `better-auth/tutorial/part-2.mdx`, `better-auth/tutorial/part-3.mdx`, `better-auth/tutorial/part-4.mdx`, `better-auth/tutorial/part-5.mdx`, `better-auth/tutorial/part-6.mdx`, `better-auth/upgrades/from-1-6-to-1-7.mdx`, `better-auth/what-is-better-auth.mdx`

### Git

`/git/`. 26 files: 26 read in full, 0 as a diff, 0 in outline, 0 not read.

- **Read in full** (26): `git/blocks/auth.mdx`, `git/blocks/blob-store.mdx`, `git/blocks/engine.mdx`, `git/blocks/hasher.mdx`, `git/blocks/index.mdx`, `git/blocks/registry.mdx`, `git/blocks/repositories.mdx`, `git/blocks/server.mdx`, `git/clone-and-push.mdx`, `git/getting-started.mdx`, `git/github-api.mdx`, `git/index.mdx`, `git/pull-requests.mdx`, `git/recipes/cloudflare-aws.mdx`, `git/recipes/cloudflare.mdx`, `git/recipes/index.mdx`, `git/recipes/scaling.mdx`, `git/recipes/your-own-store.mdx`, `git/repositories.mdx`, `git/tutorial/part-1.mdx`, `git/tutorial/part-2.mdx`, `git/tutorial/part-3.mdx`, `git/tutorial/part-4.mdx`, `git/tutorial/part-5.mdx`, `git/tutorial/part-6.mdx`, `git/what-is-git.mdx`

### GitHub

`/github/`. 7 files: 7 read in full, 0 as a diff, 0 in outline, 0 not read.

- **Read in full** (7): `github/accounts-and-tokens.mdx`, `github/actions-config.mdx`, `github/events.mdx`, `github/index.mdx`, `github/repository.mdx`, `github/setup.mdx`, `github/what-is-github.mdx`

### Testing

`/testing/`. 5 files: 5 read in full, 0 as a diff, 0 in outline, 0 not read.

- **Read in full** (5): `testing/index.mdx`, `testing/observability.mdx`, `testing/test-harness.mdx`, `testing/testing-a-stack.mdx`, `testing/testing-providers.mdx`

### Cloudflare (the pages named)

The Durable Object, workflow and Drizzle pages, and the tutorial. 13 files: 10 read in full, 0 as a diff, 3 in outline, 0 not read.

- **Read in full** (10): `cloudflare/compute/durable-objects.mdx`, `cloudflare/compute/effect-workflows.mdx`, `cloudflare/compute/workflows.mdx`, `cloudflare/compute/add-a-workflow.mdx`, `cloudflare/compute/cross-worker-durable-object.mdx`, `cloudflare/data/drizzle.mdx`, `cloudflare/data/d1-drizzle.mdx`, `cloudflare/tutorial/part-3.mdx`, `cloudflare/tutorial/part-4.mdx`, `cloudflare/tutorial/part-5.mdx`

- **Outline (exports and signatures)** (3): `cloudflare/tutorial/part-1.mdx`, `cloudflare/tutorial/part-2.mdx`, `cloudflare/tutorial/part-6.mdx`

### Addresses fetched from the web

110 addresses, each fetched on 2026-11-19: the site's generated reference pages (which are not in the docs folder), pull requests, the package registry, Cloudflare's and TypeSafe's documentation.

- https://alchemy.run (33): https://alchemy.run/cluster/cloudflare.md, https://alchemy.run/cluster/crons, https://alchemy.run/cluster/singletons, https://alchemy.run/cluster/workflows, https://alchemy.run/domain/api, https://alchemy.run/domain/better-auth, https://alchemy.run/domain/cli, https://alchemy.run/domain/command,, https://alchemy.run/domain/foldkit, https://alchemy.run/domain/http-api, https://alchemy.run/domain/local-first, https://alchemy.run/domain/mcp, https://alchemy.run/domain/optimistic-updates, https://alchemy.run/domain/sessions, https://alchemy.run/domain/tutorial/part-1, https://alchemy.run/domain/unique-values;, https://alchemy.run/domain/verifiable-code, https://alchemy.run/domain/verifying-models, https://alchemy.run/domain/view, https://alchemy.run/environments/secret-providers, https://alchemy.run/llms.txt, https://alchemy.run/providers/betterauth/reference/d1/, https://alchemy.run/providers/domain/story.md, https://alchemy.run/providers/domain/story/, https://alchemy.run/providers/domain/story/index.md, https://alchemy.run/providers/drizzle/d1.md, https://alchemy.run/providers/drizzle/durableobject, https://alchemy.run/providers/drizzle/durableobject.md, https://alchemy.run/providers/drizzle/durableobject/, https://alchemy.run/providers/drizzle/libsql.md, https://alchemy.run/providers/drizzle/mysql.md, https://alchemy.run/providers/drizzle/postgres.md, https://alchemy.run/providers/drizzle/schema.md

- https://api.github.com (3): https://api.github.com/repos/alchemy-run/alchemy/commits/8bc4c1975, https://api.github.com/repos/alchemy-run/alchemy/commits/cd178852d, https://api.github.com/repos/alchemy-run/alchemy/compare/v2.0.0-beta.87...dbfd0ddb9cdedb38a3f7618829ab08c381d404bb

- https://developers.cloudflare.com (2): https://developers.cloudflare.com/analytics/graphql-api/index.md, https://developers.cloudflare.com/d1/observability/metrics-analytics/index.md

- https://docs.typesafe.ai (19): https://docs.typesafe.ai/api/errors.md, https://docs.typesafe.ai/api/system-one.md, https://docs.typesafe.ai/changelog.md, https://docs.typesafe.ai/concepts/how-to-build-with-system-one.md, https://docs.typesafe.ai/confidence.md, https://docs.typesafe.ai/cookbooks/sde_cascade.md, https://docs.typesafe.ai/cookbooks/verify_llm_outputs.md, https://docs.typesafe.ai/introduction.md, https://docs.typesafe.ai/introduction/machine-learning-primer.md, https://docs.typesafe.ai/legal.md, https://docs.typesafe.ai/llms.txt, https://docs.typesafe.ai/model-jaggedness.md, https://docs.typesafe.ai/models.md, https://docs.typesafe.ai/patterns/companion-noul.md, https://docs.typesafe.ai/patterns/confidence-routing.md, https://docs.typesafe.ai/patterns/probability-routing.md, https://docs.typesafe.ai/primitives/choice.md, https://docs.typesafe.ai/primitives/noul.md, https://docs.typesafe.ai/primitives/score.md

- https://github.com (45): https://github.com/alchemy-run/alchemy/pull/2034, https://github.com/alchemy-run/alchemy/pull/2749, https://github.com/alchemy-run/alchemy/pull/3095, https://github.com/alchemy-run/alchemy/pull/3159, https://github.com/alchemy-run/alchemy/pull/3215, https://github.com/alchemy-run/alchemy/pull/3222, https://github.com/alchemy-run/alchemy/pull/3225, https://github.com/alchemy-run/alchemy/pull/3229, https://github.com/alchemy-run/alchemy/pull/3249, https://github.com/alchemy-run/alchemy/pull/3250, https://github.com/alchemy-run/alchemy/pull/3253, https://github.com/alchemy-run/alchemy/pull/3260, https://github.com/alchemy-run/alchemy/pull/3268, https://github.com/alchemy-run/alchemy/pull/3302, https://github.com/alchemy-run/alchemy/pull/3306, https://github.com/alchemy-run/alchemy/pull/3325, https://github.com/alchemy-run/alchemy/pull/3326, https://github.com/alchemy-run/alchemy/pull/3328, https://github.com/alchemy-run/alchemy/pull/3339, https://github.com/alchemy-run/alchemy/pull/3341, https://github.com/alchemy-run/alchemy/pull/3354, https://github.com/alchemy-run/alchemy/pull/3357, https://github.com/alchemy-run/alchemy/pull/3373, https://github.com/alchemy-run/alchemy/pull/3376, https://github.com/alchemy-run/alchemy/pull/3377, https://github.com/alchemy-run/alchemy/pull/3379, https://github.com/alchemy-run/alchemy/pull/3380, https://github.com/alchemy-run/alchemy/pull/3412, https://github.com/alchemy-run/alchemy/pull/3413, https://github.com/alchemy-run/alchemy/pull/3414, https://github.com/alchemy-run/alchemy/pull/3415, https://github.com/alchemy-run/alchemy/pull/3416, https://github.com/alchemy-run/alchemy/pull/3418, https://github.com/alchemy-run/alchemy/pull/3420, https://github.com/alchemy-run/alchemy/pull/3446, https://github.com/alchemy-run/alchemy/pull/3462, https://github.com/alchemy-run/alchemy/pull/3469, https://github.com/alchemy-run/alchemy/pull/3481, https://github.com/alchemy-run/alchemy/pull/3484, https://github.com/alchemy-run/alchemy/pull/3493, https://github.com/alchemy-run/alchemy/pull/3501, https://github.com/alchemy-run/alchemy/pull/3503, https://github.com/alchemy-run/alchemy/pull/3504, https://github.com/alchemy-run/alchemy/pull/3505, https://github.com/alchemy-run/alchemy/pull/3518

- https://registry.npmjs.org (5): https://registry.npmjs.org, https://registry.npmjs.org/@alchemy.run/domain, https://registry.npmjs.org/@alchemy.run/effect-cluster, https://registry.npmjs.org/@effect%2fai-typesafe, https://registry.npmjs.org/@effect%2fgraphql-generator

- https://typesafe.ai (1): https://typesafe.ai/legal/data-processing

- https://unpkg.com (2): https://unpkg.com/@alchemy.run/cloudflare@2.0.0-beta.87/src/Workers/SqlMigrations.ts, https://unpkg.com/@alchemy.run/drizzle@2.0.0-beta.87/src/Cloudflare.ts

## 4. What the library plugs into

Source of the packages around the library, on `main` (and at the tag where the export has them).

### `packages/effect-cluster`

 46 files: 46 read in full, 0 as a diff, 0 in outline, 0 not read.

- **Read in full** (46): `packages/effect-cluster/src/AWS/Database.ts`, `packages/effect-cluster/src/AWS/EcsPool.ts`, `packages/effect-cluster/src/AWS/index.ts`, `packages/effect-cluster/src/AWS/internal/Gateway.ts`, `packages/effect-cluster/src/Cloudflare/DurableObjectPool.ts`, `packages/effect-cluster/src/Cloudflare/PoolWorker.ts`, `packages/effect-cluster/src/Cloudflare/index.ts`, `packages/effect-cluster/src/Cloudflare/internal/Objects.ts`, `packages/effect-cluster/src/Cron.ts`, `packages/effect-cluster/src/Database.ts`, `packages/effect-cluster/src/Docker/Database.ts`, `packages/effect-cluster/src/Docker/SwarmPool.ts`, `packages/effect-cluster/src/Docker/index.ts`, `packages/effect-cluster/src/Entity.ts`, `packages/effect-cluster/src/Fly/Database.ts`, `packages/effect-cluster/src/Fly/MachinePool.ts`, `packages/effect-cluster/src/Fly/index.ts`, `packages/effect-cluster/src/GCP/ComputeEnginePool.ts`, `packages/effect-cluster/src/GCP/Database.ts`, `packages/effect-cluster/src/GCP/index.ts`, `packages/effect-cluster/src/Hetzner/Database.ts`, `packages/effect-cluster/src/Hetzner/ServerPool.ts`, `packages/effect-cluster/src/Hetzner/index.ts`, `packages/effect-cluster/src/Host.ts`, `packages/effect-cluster/src/Kubernetes/Database.ts`, `packages/effect-cluster/src/Kubernetes/DeploymentPool.ts`, `packages/effect-cluster/src/Kubernetes/index.ts`, `packages/effect-cluster/src/Pool.ts`, `packages/effect-cluster/src/Providers.ts`, `packages/effect-cluster/src/ShardGroups.ts`, `packages/effect-cluster/src/Singleton.ts`, `packages/effect-cluster/src/Workflow.ts`, `packages/effect-cluster/src/index.ts`, `packages/effect-cluster/src/internal/Bootstrap.ts`, `packages/effect-cluster/src/internal/EntityRuntime.ts`, `packages/effect-cluster/src/internal/Gateway.ts`, `packages/effect-cluster/src/internal/HostedPlatform.ts`, `packages/effect-cluster/src/internal/HostedRuntime.ts`, `packages/effect-cluster/src/internal/Naming.ts`, `packages/effect-cluster/src/internal/ObjectSharding.ts`, `packages/effect-cluster/src/internal/PoolHost.ts`, `packages/effect-cluster/src/internal/PoolHostService.ts`, `packages/effect-cluster/src/internal/Wire.ts`, `packages/effect-cluster/src/internal/WorkflowGateway.ts`, `packages/effect-cluster/src/internal/external-runner.ts`, `packages/effect-cluster/src/internal/runner.ts`

### `packages/better-auth`

 16 files: 16 read in full, 0 as a diff, 0 in outline, 0 not read.

- **Read in full** (16): `packages/better-auth/src/ApiProxy.ts`, `packages/better-auth/src/AuroraDataApi.ts`, `packages/better-auth/src/BetterAuth.ts`, `packages/better-auth/src/CloudflareD1.ts`, `packages/better-auth/src/CloudflareHyperdrive.ts`, `packages/better-auth/src/Database.ts`, `packages/better-auth/src/Drizzle.ts`, `packages/better-auth/src/Errors.ts`, `packages/better-auth/src/Memory.ts`, `packages/better-auth/src/Migrate.ts`, `packages/better-auth/src/MySQL.ts`, `packages/better-auth/src/Neon.ts`, `packages/better-auth/src/Postgres.ts`, `packages/better-auth/src/SQLite.ts`, `packages/better-auth/src/SecondaryStorage.ts`, `packages/better-auth/src/index.ts`

### `packages/drizzle`

 8 files: 8 read in full, 0 as a diff, 0 in outline, 0 not read.

- **Read in full** (8): `packages/drizzle/src/Cloudflare.ts`, `packages/drizzle/src/D1.ts`, `packages/drizzle/src/LibSQL.ts`, `packages/drizzle/src/MySQL.ts`, `packages/drizzle/src/Postgres.ts`, `packages/drizzle/src/Providers.ts`, `packages/drizzle/src/Schema.ts`, `packages/drizzle/src/index.ts`

### `packages/git`

 61 files: 61 read in full, 0 as a diff, 0 in outline, 0 not read.

- **Read in full** (61): `packages/git/src/Api.ts`, `packages/git/src/Api/GitHub.ts`, `packages/git/src/Api/Internal.ts`, `packages/git/src/Api/Objects.ts`, `packages/git/src/Api/Protocol.ts`, `packages/git/src/Api/Pulls.ts`, `packages/git/src/Api/Refs.ts`, `packages/git/src/Api/Repos.ts`, `packages/git/src/Api/Schema.ts`, `packages/git/src/BlobStore.ts`, `packages/git/src/BlobStoreR2.ts`, `packages/git/src/BlobStoreS3.ts`, `packages/git/src/Engine.ts`, `packages/git/src/GitHubCompat.ts`, `packages/git/src/Hasher/Hasher.ts`, `packages/git/src/Hasher/Lambda.ts`, `packages/git/src/Hasher/LambdaEvent.ts`, `packages/git/src/Hasher/LambdaFunction.ts`, `packages/git/src/Hasher/Protocol.ts`, `packages/git/src/Hasher/WorkerLoader.ts`, `packages/git/src/Hasher/WorkerLoaderModule.ts`, `packages/git/src/Hasher/index.ts`, `packages/git/src/Http.ts`, `packages/git/src/Http/ReceivePack.ts`, `packages/git/src/Jobs/Bundle.ts`, `packages/git/src/Jobs/Compact.ts`, `packages/git/src/Jobs/Fork.ts`, `packages/git/src/Jobs/Import.ts`, `packages/git/src/Jobs/Purge.ts`, `packages/git/src/Operations.ts`, `packages/git/src/Protocol/Advertise.ts`, `packages/git/src/Protocol/Delta.ts`, `packages/git/src/Protocol/GzipBody.ts`, `packages/git/src/Protocol/ObjectCodec.ts`, `packages/git/src/Protocol/PackParser.ts`, `packages/git/src/Protocol/PackWriter.ts`, `packages/git/src/Protocol/PartialScan.ts`, `packages/git/src/Protocol/Pkt.ts`, `packages/git/src/Protocol/ReceivePack.ts`, `packages/git/src/Protocol/Sideband.ts`, `packages/git/src/Protocol/Store.ts`, `packages/git/src/Protocol/TreeDiff.ts`, `packages/git/src/Protocol/UploadPack.ts`, `packages/git/src/Protocol/Zlib.ts`, `packages/git/src/Push.ts`, `packages/git/src/PushInput.ts`, `packages/git/src/PushWire.ts`, `packages/git/src/RegistryD1.ts`, `packages/git/src/RegistryObject.ts`, `packages/git/src/RepoObject.ts`, `packages/git/src/Server.ts`, `packages/git/src/Store/Closure.ts`, `packages/git/src/Store/HeadSnapshot.ts`, `packages/git/src/Store/IncomingBody.ts`, `packages/git/src/Store/Keys.ts`, `packages/git/src/Store/ObjectStore.ts`, `packages/git/src/Store/PackSource.ts`, `packages/git/src/Store/Sql.ts`, `packages/git/src/Store/StreamingSource.ts`, `packages/git/src/index.ts`, `packages/git/src/worker-module.d.ts`

### `packages/github`

 77 files: 77 read in full, 0 as a diff, 0 in outline, 0 not read.

- **Read in full** (77): `packages/github/src/AuthProvider.ts`, `packages/github/src/BaseUrl.ts`, `packages/github/src/BindingHttp.ts`, `packages/github/src/BindingLocal.ts`, `packages/github/src/BranchProtection.ts`, `packages/github/src/Collaborator.ts`, `packages/github/src/Comment.ts`, `packages/github/src/Contributions.ts`, `packages/github/src/CreateIssue.ts`, `packages/github/src/CreateIssueComment.ts`, `packages/github/src/CreateIssueCommentHttp.ts`, `packages/github/src/CreateIssueCommentLocal.ts`, `packages/github/src/CreateIssueHttp.ts`, `packages/github/src/CreateIssueLocal.ts`, `packages/github/src/CreatePullRequest.ts`, `packages/github/src/CreatePullRequestHttp.ts`, `packages/github/src/CreatePullRequestLocal.ts`, `packages/github/src/CreatePullRequestReview.ts`, `packages/github/src/CreatePullRequestReviewHttp.ts`, `packages/github/src/CreatePullRequestReviewLocal.ts`, `packages/github/src/Credentials.ts`, `packages/github/src/Env.ts`, `packages/github/src/Environment.ts`, `packages/github/src/Errors.ts`, `packages/github/src/GetIssue.ts`, `packages/github/src/GetIssueHttp.ts`, `packages/github/src/GetIssueLocal.ts`, `packages/github/src/GetPullRequest.ts`, `packages/github/src/GetPullRequestHttp.ts`, `packages/github/src/GetPullRequestLocal.ts`, `packages/github/src/Issue.ts`, `packages/github/src/Label.ts`, `packages/github/src/ListIssueComments.ts`, `packages/github/src/ListIssueCommentsHttp.ts`, `packages/github/src/ListIssueCommentsLocal.ts`, `packages/github/src/ListIssues.ts`, `packages/github/src/ListIssuesHttp.ts`, `packages/github/src/ListIssuesLocal.ts`, `packages/github/src/ListPullRequestFiles.ts`, `packages/github/src/ListPullRequestFilesHttp.ts`, `packages/github/src/ListPullRequestFilesLocal.ts`, `packages/github/src/ListPullRequestReviewComments.ts`, `packages/github/src/ListPullRequestReviewCommentsHttp.ts`, `packages/github/src/ListPullRequestReviewCommentsLocal.ts`, `packages/github/src/ListPullRequestReviews.ts`, `packages/github/src/ListPullRequestReviewsHttp.ts`, `packages/github/src/ListPullRequestReviewsLocal.ts`, `packages/github/src/ListPullRequests.ts`, `packages/github/src/ListPullRequestsHttp.ts`, `packages/github/src/ListPullRequestsLocal.ts`, `packages/github/src/MergePullRequest.ts`, `packages/github/src/MergePullRequestHttp.ts`, `packages/github/src/MergePullRequestLocal.ts`, `packages/github/src/Milestone.ts`, `packages/github/src/PersonalAccessToken.ts`, `packages/github/src/Providers.ts`, `packages/github/src/PullRequest.ts`, `packages/github/src/Release.ts`, `packages/github/src/Repository.ts`, `packages/github/src/RepositoryEventSource.ts`, `packages/github/src/RepositoryEventSourceLive.ts`, `packages/github/src/Ruleset.ts`, `packages/github/src/SearchIssues.ts`, `packages/github/src/SearchIssuesHttp.ts`, `packages/github/src/SearchIssuesLocal.ts`, `packages/github/src/Secret.ts`, `packages/github/src/Secrets.ts`, `packages/github/src/TeamAccess.ts`, `packages/github/src/UpdateIssue.ts`, `packages/github/src/UpdateIssueHttp.ts`, `packages/github/src/UpdateIssueLocal.ts`, `packages/github/src/Variable.ts`, `packages/github/src/Variables.ts`, `packages/github/src/Webhook.ts`, `packages/github/src/WikiPage.ts`, `packages/github/src/globals.d.ts`, `packages/github/src/index.ts`

### `packages/alchemy-test`

 23 files: 23 read in full, 0 as a diff, 0 in outline, 0 not read.

- **Read in full** (23): `packages/alchemy-test/src/Alchemy.ts`, `packages/alchemy-test/src/Api.ts`, `packages/alchemy-test/src/Bun.ts`, `packages/alchemy-test/src/Capture.ts`, `packages/alchemy-test/src/Core.ts`, `packages/alchemy-test/src/DevCli.ts`, `packages/alchemy-test/src/Expect.ts`, `packages/alchemy-test/src/FileLog.ts`, `packages/alchemy-test/src/Http.ts`, `packages/alchemy-test/src/Model.ts`, `packages/alchemy-test/src/PlainReporter.ts`, `packages/alchemy-test/src/Plan.ts`, `packages/alchemy-test/src/Registry.ts`, `packages/alchemy-test/src/Reporter.ts`, `packages/alchemy-test/src/Runner.ts`, `packages/alchemy-test/src/StrayOutput.ts`, `packages/alchemy-test/src/Tags.ts`, `packages/alchemy-test/src/TestState.ts`, `packages/alchemy-test/src/Tui.ts`, `packages/alchemy-test/src/Vitest.ts`, `packages/alchemy-test/src/WorktreeStage.ts`, `packages/alchemy-test/src/cli.ts`, `packages/alchemy-test/src/index.ts`

### `packages/rivet`

 69 files: 69 read in full, 0 as a diff, 0 in outline, 0 not read.

- **Read in full** (69): `packages/rivet/src/AWS/Ec2ControlPlane.ts`, `packages/rivet/src/AWS/Ec2Pool.ts`, `packages/rivet/src/AWS/EcsControlPlane.ts`, `packages/rivet/src/AWS/EcsPool.ts`, `packages/rivet/src/AWS/ServicesPool.ts`, `packages/rivet/src/AWS/index.ts`, `packages/rivet/src/AWS/internal/ControlPlane.ts`, `packages/rivet/src/AWS/internal/Pool.ts`, `packages/rivet/src/Cloud/Api.ts`, `packages/rivet/src/Cloud/AuthProvider.ts`, `packages/rivet/src/Cloud/Cluster.ts`, `packages/rivet/src/Cloud/ControlPlane.ts`, `packages/rivet/src/Cloud/Credentials.ts`, `packages/rivet/src/Cloud/CredentialsLive.ts`, `packages/rivet/src/Cloud/Pool.ts`, `packages/rivet/src/Cloud/RunnerPool.ts`, `packages/rivet/src/Cloud/index.ts`, `packages/rivet/src/Cluster.ts`, `packages/rivet/src/Contributions.ts`, `packages/rivet/src/Docker/ServicesPool.ts`, `packages/rivet/src/Docker/SwarmControlPlane.ts`, `packages/rivet/src/Docker/SwarmPool.ts`, `packages/rivet/src/Docker/index.ts`, `packages/rivet/src/DurableObject.ts`, `packages/rivet/src/DurableObjectState.ts`, `packages/rivet/src/DurableStream.ts`, `packages/rivet/src/Fly/MachineControlPlane.ts`, `packages/rivet/src/Fly/MachinePool.ts`, `packages/rivet/src/Fly/ServicesPool.ts`, `packages/rivet/src/Fly/index.ts`, `packages/rivet/src/GCP/CloudRunPool.ts`, `packages/rivet/src/GCP/ComputeEngineControlPlane.ts`, `packages/rivet/src/GCP/ComputeEnginePool.ts`, `packages/rivet/src/GCP/ServicesPool.ts`, `packages/rivet/src/GCP/index.ts`, `packages/rivet/src/Hetzner/ServerControlPlane.ts`, `packages/rivet/src/Hetzner/ServerPool.ts`, `packages/rivet/src/Hetzner/ServicesPool.ts`, `packages/rivet/src/Hetzner/index.ts`, `packages/rivet/src/Host.ts`, `packages/rivet/src/Kubernetes/DeploymentPool.ts`, `packages/rivet/src/Kubernetes/ServicesPool.ts`, `packages/rivet/src/Kubernetes/StatefulSetControlPlane.ts`, `packages/rivet/src/Kubernetes/index.ts`, `packages/rivet/src/Namespace.ts`, `packages/rivet/src/Pool.ts`, `packages/rivet/src/Providers.ts`, `packages/rivet/src/Railway/ServicePool.ts`, `packages/rivet/src/Railway/ServicesPool.ts`, `packages/rivet/src/Railway/index.ts`, `packages/rivet/src/Services.ts`, `packages/rivet/src/StreamFormat.ts`, `packages/rivet/src/WebSocket.ts`, `packages/rivet/src/globals.d.ts`, `packages/rivet/src/index.ts`, `packages/rivet/src/internal/AdminToken.ts`, `packages/rivet/src/internal/Bootstrap.ts`, `packages/rivet/src/internal/Calls.ts`, `packages/rivet/src/internal/Connection.ts`, `packages/rivet/src/internal/Fetcher.ts`, `packages/rivet/src/internal/Gateway.ts`, `packages/rivet/src/internal/NodeImage.ts`, `packages/rivet/src/internal/ObjectStorage.ts`, `packages/rivet/src/internal/PoolHost.ts`, `packages/rivet/src/internal/Runtime.ts`, `packages/rivet/src/internal/RustProgram.ts`, `packages/rivet/src/internal/ServicesHost.ts`, `packages/rivet/src/internal/Sockets.ts`, `packages/rivet/src/internal/node.ts`

### `packages/1password`

 6 files: 6 read in full, 0 as a diff, 0 in outline, 0 not read.

- **Read in full** (6): `packages/1password/src/AuthProvider.ts`, `packages/1password/src/Contributions.ts`, `packages/1password/src/Errors.ts`, `packages/1password/src/SecretsProvider.ts`, `packages/1password/src/index.ts`, `packages/1password/src/internal/sdk.ts`

### Other packages of the repository (the files a page needed)

69 files of `packages/alchemy`, `packages/cloudflare`, `packages/integration-tests` and others were opened where a page depended on them; the rest of those packages was not read.

- **Read in full** (36): `packages/alchemy/src/Callback.ts`, `packages/alchemy/src/Http.ts`, `packages/alchemy/src/Runtime/Bootstrap.ts`, `packages/alchemy/src/RuntimeContext.ts`, `packages/alchemy/src/Workers/DurableObjectEngine.ts`, `packages/alchemy/src/Workers/InputGate.ts`, `packages/alchemy/src/WorkflowEncoding.ts`, `packages/alchemy/src/Workflows.ts`, `packages/cloudflare/src/Website/FrameworkWebsite.ts`, `packages/cloudflare/src/Website/StaticSite.ts`, `packages/cloudflare/src/Website/Vite.ts`, `packages/cloudflare/src/Website/index.ts`, `packages/cloudflare/src/Workers/AlarmCallback.ts`, `packages/cloudflare/src/Workers/DurableObject.ts`, `packages/cloudflare/src/Workers/DurableObjectState.ts`, `packages/cloudflare/src/Workers/DurableObjectStorage.ts`, `packages/cloudflare/src/Workers/Rpc.ts`, `packages/cloudflare/src/Workers/Source.ts`, `packages/cloudflare/src/Workers/Sources/Rolldown.ts`, `packages/cloudflare/src/Workers/Sources/Vite.ts`, `packages/cloudflare/src/Workers/SqlMigrations.ts`, `packages/cloudflare/src/Workers/SqlMigrationsApply.ts`, `packages/cloudflare/src/Workers/SqlMigrationsRuntime.ts`, `packages/cloudflare/src/Workers/WebSocket.ts`, `packages/cloudflare/src/Workers/Worker.ts`, `packages/cloudflare/src/Workers/WorkerRuntime.ts`, `packages/cloudflare/src/Workflows/DurableObjectEngine.ts`, `packages/cloudflare/src/Workflows/NativeEngine.ts`, `packages/cloudflare/src/Workflows/Workflow.ts`, `packages/cloudflare/src/Workflows/WorkflowBridge.ts`, `packages/cloudflare/src/Workflows/WorkflowName.ts`, `packages/cloudflare/src/Workflows/WorkflowRuntime.ts`, `packages/cloudflare/src/Workflows/index.ts`, `packages/docker/src/index.ts`, `packages/sql/src/Migrations/Detect.ts`, `packages/sql/src/Migrations/Embedded.ts`

- **Outline (exports and signatures)** (33): `packages/alchemy/src/Auth/Env.ts`, `packages/alchemy/src/Local/RpcSpawner.ts`, `packages/alchemy/src/Platform.ts`, `packages/alchemy/src/Runtime.ts`, `packages/alchemy/src/Secrets/Provider.ts`, `packages/alchemy/src/Telemetry.ts`, `packages/alchemy/src/Util/PlatformServices.ts`, `packages/alchemy/src/Workers/Workerd/AlarmCallback.ts`, `packages/alchemy/src/Workers/Workerd/DurableObjectState.ts`, `packages/alchemy/src/Workers/Workerd/DurableObjectStorage.ts`, `packages/axiom/src/Telemetry.ts`, `packages/cloudflare-runtime/src/core/bindings/queue/Queue.ts`, `packages/cloudflare/src/Artifacts/Namespace.ts`, `packages/cloudflare/src/Artifacts/ReadWriteNamespace.ts`, `packages/cloudflare/src/D1/Database.ts`, `packages/cloudflare/src/D1/QueryDatabase.ts`, `packages/cloudflare/src/D1/QueryDatabaseBinding.ts`, `packages/cloudflare/src/D1/QueryDatabaseHttpClient.ts`, `packages/cloudflare/src/StateStore/State.ts`, `packages/cloudflare/src/Website/Foldkit.ts`, `packages/cloudflare/src/Workers/CronEventSource.ts`, `packages/docker/src`, `packages/integration-tests/test/AWS/Lambda/WorkflowFunction.test.ts`, `packages/integration-tests/test/Cloudflare/Domain/Conformance.local.test.ts`, `packages/integration-tests/test/Cloudflare/Domain/Conformance.test.ts`, `packages/integration-tests/test/Cloudflare/Workers/WorkflowEngines.test.ts`, `packages/integration-tests/test/Cluster/Domain.test.ts`, `packages/integration-tests/test/Domain/Story.test.ts`, `packages/integration-tests/test/Domain/StoryOrder.test.ts`, `packages/integration-tests/test/Domain/conformance/app.ts`, `packages/integration-tests/test/Domain/conformance/conformance.ts`, `packages/integration-tests/test/Domain/conformance/model.ts`, `packages/integration-tests/test/Rivet/Domain.test.ts`

### Examples

Entries by example, from the ledgers: `examples/cloudflare-better-auth` (17), `examples/cloudflare-d1-drizzle` (3), `examples/cloudflare-domain` (140), `examples/cloudflare-domain-better-auth` (28), `examples/cloudflare-durable-object-sql` (8), `examples/cloudflare-foldkit-hybrid` (1), `examples/cloudflare-foldkit-spa` (1), `examples/cloudflare-foldkit-ssg` (1), `examples/cloudflare-foldkit-ssr` (1), `examples/cloudflare-git-artifacts` (8), `examples/cloudflare-git-service` (35), `examples/cloudflare-tanstack-rpc-drizzle` (1), `examples/cluster-domain` (1), `examples/effect-cluster-rooms` (1).

## 5. Effect and the distilled clients

Effect's source at 4.1.4, as the app installs it (paths are under the installed package's `src`).

### `effect/cluster`

51 files: 51 read in full, 0 in outline, 0 not read.

- **Read in full** (51): `src/cluster/ClusterCron.ts`, `src/cluster/ClusterError.ts`, `src/cluster/ClusterMetrics.ts`, `src/cluster/ClusterSchema.ts`, `src/cluster/ClusterWorkflowEngine.ts`, `src/cluster/DeliverAt.ts`, `src/cluster/Entity.ts`, `src/cluster/EntityAddress.ts`, `src/cluster/EntityId.ts`, `src/cluster/EntityProxy.ts`, `src/cluster/EntityProxyServer.ts`, `src/cluster/EntityResource.ts`, `src/cluster/EntityType.ts`, `src/cluster/Envelope.ts`, `src/cluster/HttpRunner.ts`, `src/cluster/K8sHttpClient.ts`, `src/cluster/K8sTypes.ts`, `src/cluster/MachineId.ts`, `src/cluster/Message.ts`, `src/cluster/MessageRetention.ts`, `src/cluster/MessageStorage.ts`, `src/cluster/Reply.ts`, `src/cluster/Runner.ts`, `src/cluster/RunnerAddress.ts`, `src/cluster/RunnerHealth.ts`, `src/cluster/RunnerServer.ts`, `src/cluster/RunnerStorage.ts`, `src/cluster/Runners.ts`, `src/cluster/ShardId.ts`, `src/cluster/Sharding.ts`, `src/cluster/ShardingConfig.ts`, `src/cluster/ShardingRegistrationEvent.ts`, `src/cluster/SingleRunner.ts`, `src/cluster/Singleton.ts`, `src/cluster/SingletonAddress.ts`, `src/cluster/Snowflake.ts`, `src/cluster/SocketRunner.ts`, `src/cluster/SqlMessageStorage.ts`, `src/cluster/SqlRunnerStorage.ts`, `src/cluster/TestRunner.ts`, `src/cluster/index.ts`, `src/cluster/internal/clusterAbandon.ts`, `src/cluster/internal/entityActivation.ts`, `src/cluster/internal/entityManager.ts`, `src/cluster/internal/entityReaper.ts`, `src/cluster/internal/hash.ts`, `src/cluster/internal/interruptors.ts`, `src/cluster/internal/resourceMap.ts`, `src/cluster/internal/resourceRef.ts`, `src/cluster/internal/shardLock.ts`, `src/cluster/internal/transactionNotifications.ts`

### `effect/workflow`

10 files: 10 read in full, 0 in outline, 0 not read.

- **Read in full** (10): `src/workflow/Activity.ts`, `src/workflow/DurableClock.ts`, `src/workflow/DurableDeferred.ts`, `src/workflow/DurableQueue.ts`, `src/workflow/Workflow.ts`, `src/workflow/WorkflowEngine.ts`, `src/workflow/WorkflowProxy.ts`, `src/workflow/WorkflowProxyServer.ts`, `src/workflow/index.ts`, `src/workflow/internal/crypto.ts`

### `effect/graphql`

8 files: 8 read in full, 0 in outline, 0 not read.

- **Read in full** (8): `src/graphql/GraphQL.ts`, `src/graphql/GraphQLClient.ts`, `src/graphql/GraphQLClientError.ts`, `src/graphql/GraphQLGroup.ts`, `src/graphql/GraphQLMiddleware.ts`, `src/graphql/GraphQLProtocol.ts`, `src/graphql/GraphQLResolver.ts`, `src/graphql/index.ts`

### `@effect/ai-typesafe`

6 files: 6 read in full, 0 in outline, 0 not read.

- **Read in full** (6): `packages/ai/typesafe/src/TypeSafeClient.ts`, `packages/ai/typesafe/src/TypeSafeConfig.ts`, `packages/ai/typesafe/src/TypeSafeDecisionModel.ts`, `packages/ai/typesafe/src/TypeSafeSchema.ts`, `packages/ai/typesafe/src/index.ts`, `packages/ai/typesafe/src/internal/errors.ts`

### distilled `resend`

11 files: 10 read in full, 1 in outline, 0 not read.

- **Read in full** (10): `packages/resend/src/credentials.ts`, `packages/resend/src/errors.ts`, `packages/resend/src/index.ts`, `packages/resend/src/pagination.ts`, `packages/resend/src/protocol.ts`, `packages/resend/src/retry.ts`, `packages/resend/src/services/index.ts`, `packages/resend/src/services/webhook_events.ts`, `packages/resend/src/traits.ts`, `packages/resend/src/webhooks.ts`

- **Outline (exports and signatures)** (1): `packages/resend/src/services/resend.ts`

### distilled `discord`

8 files: 7 read in full, 1 in outline, 0 not read.

- **Read in full** (7): `packages/discord/src/credentials.ts`, `packages/discord/src/errors.ts`, `packages/discord/src/index.ts`, `packages/discord/src/protocol.ts`, `packages/discord/src/retry.ts`, `packages/discord/src/services/index.ts`, `packages/discord/src/traits.ts`

- **Outline (exports and signatures)** (1): `packages/discord/src/services/discord.ts`

### distilled `grafana`

9 files: 8 read in full, 1 in outline, 0 not read.

- **Read in full** (8): `packages/grafana/src/credentials.ts`, `packages/grafana/src/errors.ts`, `packages/grafana/src/index.ts`, `packages/grafana/src/pagination.ts`, `packages/grafana/src/protocol.ts`, `packages/grafana/src/retry.ts`, `packages/grafana/src/services/index.ts`, `packages/grafana/src/traits.ts`

- **Outline (exports and signatures)** (1): `packages/grafana/src/services/grafana.ts`

### distilled `github`

60 files: 13 read in full, 47 in outline, 0 not read.

- **Read in full** (13): `packages/github/src/app.ts`, `packages/github/src/credentials.ts`, `packages/github/src/errors.ts`, `packages/github/src/graphql-index.ts`, `packages/github/src/graphql-telemetry.ts`, `packages/github/src/graphql-transport.ts`, `packages/github/src/index.ts`, `packages/github/src/oauth.ts`, `packages/github/src/pagination.ts`, `packages/github/src/protocol.ts`, `packages/github/src/retry.ts`, `packages/github/src/services/index.ts`, `packages/github/src/traits.ts`

### distilled `docker`

9 files: 8 read in full, 1 in outline, 0 not read.

- **Read in full** (8): `packages/docker/src/credentials.ts`, `packages/docker/src/errors.ts`, `packages/docker/src/index.ts`, `packages/docker/src/pagination.ts`, `packages/docker/src/protocol.ts`, `packages/docker/src/retry.ts`, `packages/docker/src/services/index.ts`, `packages/docker/src/traits.ts`

- **Outline (exports and signatures)** (1): `packages/docker/src/services/docker.ts`

### distilled `onepassword`

13 files: 8 read in full, 5 in outline, 0 not read.

- **Read in full** (8): `packages/onepassword/src/credentials.ts`, `packages/onepassword/src/errors.ts`, `packages/onepassword/src/index.ts`, `packages/onepassword/src/pagination.ts`, `packages/onepassword/src/protocol.ts`, `packages/onepassword/src/retry.ts`, `packages/onepassword/src/services/index.ts`, `packages/onepassword/src/traits.ts`

- **Outline (exports and signatures)** (5): `packages/onepassword/src/services/connect.ts`, `packages/onepassword/src/services/events.ts`, `packages/onepassword/src/services/oauth.ts`, `packages/onepassword/src/services/partnership.ts`, `packages/onepassword/src/services/users.ts`

## 6. Pull requests, and this app

45 pull requests of `alchemy-run/alchemy` were read (each is a row of [02](02-merged-since-beta-87.md)): #2034, #2749, #3095, #3159, #3215, #3222, #3225, #3229, #3249, #3250, #3253, #3260, #3268, #3302, #3306, #3325, #3326, #3328, #3339, #3341, #3354, #3357, #3373, #3376, #3377, #3379, #3380, #3412, #3413, #3414, #3415, #3416, #3418, #3420, #3446, #3462, #3469, #3481, #3484, #3493, #3501, #3503, #3504, #3505, #3518.

178 files of this app were opened to place the concepts (the ports, the D1 adapters, the handlers, the contract, the migration, the stack, the tests); they are cited by path on the pages that use them.

## 7. The check

Each row compares a folder's own listing with the ledger. "Listed" is how many of the folder's files appear in some pass's ledger; a file that is in the folder and in no ledger counts as not read above.

| What | In the folder | Listed in a ledger | Read in full |
| --- | --- | --- | --- |
| docs pages on main | 47 | 47 | 47 |
| docs pages at beta.87 | 44 | 44 | 44 |
| live addresses under /domain | 44 | 44 | 44 |
| source files on main | 64 | 64 | 64 |
| source files at beta.87 | 44 | 44 | 44 |
| Cluster | 23 | 23 | 23 |
| Better Auth | 29 | 29 | 29 |
| Git | 26 | 26 | 26 |
| GitHub | 7 | 7 | 7 |
| Testing | 5 | 5 | 5 |
| Cloudflare (the pages named) | 13 | 13 | 10 |
| `packages/effect-cluster` | 46 | 46 | 46 |
| `packages/better-auth` | 16 | 16 | 16 |
| `packages/drizzle` | 8 | 8 | 8 |
| `packages/git` | 61 | 61 | 61 |
| `packages/github` | 77 | 77 | 77 |
| `packages/alchemy-test` | 23 | 23 | 23 |
| `packages/rivet` | 69 | 69 | 69 |
| `packages/1password` | 6 | 6 | 6 |
| `effect/cluster` | 51 | 51 | 51 |
| `effect/workflow` | 10 | 10 | 10 |
| `effect/graphql` | 8 | 8 | 8 |
| `@effect/ai-typesafe` | 6 | 6 | 6 |
| distilled `resend` | 11 | 11 | 10 |
| distilled `discord` | 8 | 8 | 7 |
| distilled `grafana` | 9 | 9 | 8 |
| distilled `github` | 60 | 60 | 13 |
| distilled `docker` | 9 | 9 | 8 |
| distilled `onepassword` | 13 | 13 | 8 |

The ledgers hold 3,093 entries from 37 reading passes.
