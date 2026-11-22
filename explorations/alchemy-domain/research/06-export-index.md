---
type: Research
title: Export index
description: Every exported name of @alchemy.run/domain's source on main, file by file, with its kind, whether the published release has it, and the pages that cover it; generated from the source and checked against the pages.
---

# Export index

Read at `main@dbfd0dd`, not at the pin `734c27a` the repository builds on: the names the pin adds or removes are not
listed here, and what changed between that touches the pages is in [the map](00-map.md), "From `dbfd0dd` to the pin".

Generated from `packages/domain/src` on `main@dbfd0ddb` and compared with the same file at `v2.0.0-beta.87`. A name is "covered" when a page of this packet mentions it; the pages named are where to read about it. "internal" means the source marks it `@internal` or it lives under an `internal/` folder: it is listed so that nothing is unlisted, and it is not part of what an app uses.

893 exported declarations in 64 files; 887 are covered by a page, 6 are not.

## `Aggregate.ts`

| Name | Kind | In beta.87 | Covered in |
| --- | --- | --- | --- |
| `InstanceOf` | type | yes | [aggregate](concepts/aggregate.md), [invariants-and-transitions](concepts/invariants-and-transitions.md), [model](concepts/model.md) |
| `DecideContext` | interface | yes | [aggregate](concepts/aggregate.md), [deadlines](concepts/deadlines.md), [decision](concepts/decision.md), [local-first](concepts/local-first.md) |
| `Envelope` | const | yes | [aggregate](concepts/aggregate.md), [cluster](concepts/cluster.md), [event](concepts/event.md), [model](concepts/model.md) and 1 more |
| `Receipt` | interface | yes | [aggregate](concepts/aggregate.md), [command](concepts/command.md), [decision](concepts/decision.md), [model](concepts/model.md) |
| `ScheduleReceipt` | interface | yes | [aggregate](concepts/aggregate.md), [deadlines](concepts/deadlines.md), [model](concepts/model.md) |
| `Decision` | type | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [02-merged-since-beta-87](02-merged-since-beta-87.md), [04-trial](04-trial.md), [aggregate](concepts/aggregate.md) and 21 more |
| `Transition` | interface | no | [aggregate](concepts/aggregate.md), [decision](concepts/decision.md), [invariants-and-transitions](concepts/invariants-and-transitions.md) |
| `EventsOf` | type | yes | [aggregate](concepts/aggregate.md), [invariants-and-transitions](concepts/invariants-and-transitions.md) |
| `Definition` | interface | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [aggregate](concepts/aggregate.md), [confidence-scores](concepts/confidence-scores.md), [decision](concepts/decision.md) and 8 more |
| `Key` | interface | yes | [aggregate](concepts/aggregate.md), [alchemy-git](concepts/alchemy-git.md), [annotations](concepts/annotations.md), [backfill](concepts/backfill.md) and 11 more |
| `SendOptions` | interface | yes | [aggregate](concepts/aggregate.md), [command](concepts/command.md), [model](concepts/model.md) |
| `AlreadyExecuted` | class | yes | [aggregate](concepts/aggregate.md), [deadlines](concepts/deadlines.md), [model](concepts/model.md), [platform-contract](concepts/platform-contract.md) |
| `AlreadyCancelled` | class | yes | [aggregate](concepts/aggregate.md), [deadlines](concepts/deadlines.md), [model](concepts/model.md), [platform-contract](concepts/platform-contract.md) |
| `NotScheduled` | class | yes | [aggregate](concepts/aggregate.md), [deadlines](concepts/deadlines.md), [model](concepts/model.md), [platform-contract](concepts/platform-contract.md) |
| `ScheduleOptions` | type | yes | [aggregate](concepts/aggregate.md), [deadlines](concepts/deadlines.md), [model](concepts/model.md) |
| `Due` | type | yes | [aggregate](concepts/aggregate.md), [deadlines](concepts/deadlines.md) |
| `SendMeta` | interface | yes | [aggregate](concepts/aggregate.md), [platform-contract](concepts/platform-contract.md) |
| `AnyDefinition` | interface | yes | [aggregate](concepts/aggregate.md), [decision](concepts/decision.md), [invariants-and-transitions](concepts/invariants-and-transitions.md) |
| `Target` | type | yes | [aggregate](concepts/aggregate.md), [command](concepts/command.md) |
| `Client` | interface | yes | [aggregate](concepts/aggregate.md), [api](concepts/api.md), [deadlines](concepts/deadlines.md), [decision](concepts/decision.md) and 7 more |
| `Schedulable` | type | yes | [aggregate](concepts/aggregate.md), [deadlines](concepts/deadlines.md) |
| `ClientImpl` (internal) | interface | yes | [aggregate](concepts/aggregate.md), [decision](concepts/decision.md) |
| `Any` | interface | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [04-trial](04-trial.md), [aggregate](concepts/aggregate.md), [ai-and-mcp](concepts/ai-and-mcp.md) and 30 more |
| `IdOf` | type | yes | [aggregate](concepts/aggregate.md), [model](concepts/model.md), [relation](concepts/relation.md) |
| `StateOf` | type | yes | [aggregate](concepts/aggregate.md), [model](concepts/model.md), [relation](concepts/relation.md) |
| `EventOf` | type | yes | [aggregate](concepts/aggregate.md), [model](concepts/model.md) |
| `CommandOf` | type | yes | [aggregate](concepts/aggregate.md), [model](concepts/model.md) |
| `Identifier` | type | yes | [aggregate](concepts/aggregate.md), [external-system](concepts/external-system.md), [foldkit](concepts/foldkit.md), [graphql](concepts/graphql.md) and 3 more |
| `PredictOptions` | type | yes | [aggregate](concepts/aggregate.md), [local-first](concepts/local-first.md), [model](concepts/model.md) |
| `Prediction` | type | yes | [aggregate](concepts/aggregate.md), [local-first](concepts/local-first.md), [model](concepts/model.md) |
| `decisionOf` (internal) | const | yes | [aggregate](concepts/aggregate.md) |
| `predict` | const | yes | [02-merged-since-beta-87](02-merged-since-beta-87.md), [aggregate](concepts/aggregate.md), [decision](concepts/decision.md), [event](concepts/event.md) and 5 more |
| `Ref` | interface | yes | [aggregate](concepts/aggregate.md), [model](concepts/model.md) |
| `refClass` (internal) | const | yes | [aggregate](concepts/aggregate.md) |
| `makeRef` | const | yes | [aggregate](concepts/aggregate.md) |
| `streamOf` | const | yes | [aggregate](concepts/aggregate.md) |
| `targetId` (internal) | const | yes | [aggregate](concepts/aggregate.md), [model](concepts/model.md), [platform-contract](concepts/platform-contract.md), [reads-and-consistency](concepts/reads-and-consistency.md) |
| `PolicyRun` (internal) | class | yes | [aggregate](concepts/aggregate.md), [policy](concepts/policy.md) |
| `commandIdFor` (internal) | const | yes | [aggregate](concepts/aggregate.md), [command](concepts/command.md), [deadlines](concepts/deadlines.md), [policy](concepts/policy.md) |
| `make` | const | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [02-merged-since-beta-87](02-merged-since-beta-87.md), [03-this-apps-rules-under-verify](03-this-apps-rules-under-verify.md), [04-trial](04-trial.md) and 46 more |
| `Decides` | type | no | [aggregate](concepts/aggregate.md) |
| `targetOf` (internal) | const | no | [aggregate](concepts/aggregate.md), [local-first](concepts/local-first.md) |
| `Resolved` | type | yes | [aggregate](concepts/aggregate.md), [observability](concepts/observability.md) |
| `AggregateClass` | interface | yes | [aggregate](concepts/aggregate.md) |

## `Ai.ts`

| Name | Kind | In beta.87 | Covered in |
| --- | --- | --- | --- |
| `Toolable` | interface | yes | [ai-and-mcp](concepts/ai-and-mcp.md) |
| `Services` | type | yes | [ai-and-mcp](concepts/ai-and-mcp.md), [distilled-clients](concepts/distilled-clients.md), [graphql](concepts/graphql.md), [host-rivet](concepts/host-rivet.md) |
| `Exposable` | type | yes | [ai-and-mcp](concepts/ai-and-mcp.md), [cli](concepts/cli.md), [http-api](concepts/http-api.md) |
| `ToolkitOptions` | interface | yes | [ai-and-mcp](concepts/ai-and-mcp.md) |
| `ApiToolkit` | interface | yes | [ai-and-mcp](concepts/ai-and-mcp.md) |
| `toolName` | const | yes | [ai-and-mcp](concepts/ai-and-mcp.md) |
| `toToolkit` | const | yes | [ai-and-mcp](concepts/ai-and-mcp.md), [api](concepts/api.md) |
| `toMcp` | const | yes | [ai-and-mcp](concepts/ai-and-mcp.md) |

## `Annotations.ts`

| Name | Kind | In beta.87 | Covered in |
| --- | --- | --- | --- |
| `Annotations` | interface | yes | [aggregate](concepts/aggregate.md), [annotations](concepts/annotations.md), [command](concepts/command.md), [event](concepts/event.md) and 3 more |

## `Api.ts`

| Name | Kind | In beta.87 | Covered in |
| --- | --- | --- | --- |
| `Servable` | type | yes | [ai-and-mcp](concepts/ai-and-mcp.md), [api](concepts/api.md), [cli](concepts/cli.md), [http-api](concepts/http-api.md) and 1 more |
| `CommandName` | type | yes | [api](concepts/api.md), [model](concepts/model.md) |
| `ViewName` | type | yes | [api](concepts/api.md), [model](concepts/model.md) |
| `StreamName` | type | yes | [api](concepts/api.md), [model](concepts/model.md) |
| `QueryName` | type | yes | [api](concepts/api.md), [model](concepts/model.md) |
| `Options` | interface | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [aggregate](concepts/aggregate.md), [api](concepts/api.md), [backfill](concepts/backfill.md) and 14 more |
| `ServedBy` | type | yes | [api](concepts/api.md) |
| `ReadError` | type | yes | [api](concepts/api.md), [model](concepts/model.md) |
| `ViewClient` | interface | yes | [api](concepts/api.md), [local-first](concepts/local-first.md), [model](concepts/model.md), [view](concepts/view.md) |
| `StreamClient` | interface | yes | [api](concepts/api.md), [model](concepts/model.md), [stream](concepts/stream.md) |
| `Recorded` | interface | yes | [api](concepts/api.md), [cluster-workflows](concepts/cluster-workflows.md), [decision](concepts/decision.md), [model](concepts/model.md) |
| `CommandOptions` | interface | yes | [api](concepts/api.md), [command](concepts/command.md), [local-first](concepts/local-first.md), [model](concepts/model.md) |
| `CommandClient` | type | yes | [api](concepts/api.md), [command](concepts/command.md), [model](concepts/model.md) |
| `QueryError` | type | yes | [api](concepts/api.md), [model](concepts/model.md) |
| `QueryOptions` | interface | yes | [api](concepts/api.md), [model](concepts/model.md), [query](concepts/query.md) |
| `EntryOf` | type | yes | [api](concepts/api.md) |
| `QueryClient` | type | yes | [api](concepts/api.md), [model](concepts/model.md), [query](concepts/query.md) |
| `PagedQueryClient` | interface | yes | [api](concepts/api.md), [model](concepts/model.md) |
| `ApiClient` | type | yes | [api](concepts/api.md) |
| `ClientKey` | interface | yes | [api](concepts/api.md), [model](concepts/model.md), [tutorial](concepts/tutorial.md) |
| `ApiServer` | interface | yes | [api](concepts/api.md) |
| `ApiClass` | interface | yes | [api](concepts/api.md) |
| `make` | const | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [02-merged-since-beta-87](02-merged-since-beta-87.md), [03-this-apps-rules-under-verify](03-this-apps-rules-under-verify.md), [04-trial](04-trial.md) and 46 more |
| `protocolHttp` | const | yes | [api](concepts/api.md), [cli](concepts/cli.md), [foldkit](concepts/foldkit.md), [host-effect-cluster](concepts/host-effect-cluster.md) and 5 more |
| `protocolInProcess` | const | yes | [api](concepts/api.md), [foldkit](concepts/foldkit.md), [model](concepts/model.md) |
| `protocolWebSocket` | const | yes | [api](concepts/api.md), [foldkit](concepts/foldkit.md), [host-cloudflare](concepts/host-cloudflare.md), [host-rivet](concepts/host-rivet.md) and 6 more |
| `Any` | interface | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [04-trial](04-trial.md), [aggregate](concepts/aggregate.md), [ai-and-mcp](concepts/ai-and-mcp.md) and 30 more |
| `CommandsOf` | type | yes | [api](concepts/api.md), [model](concepts/model.md) |
| `QueriesOf` | type | yes | [api](concepts/api.md) |
| `RejectionsOf` | type | yes | [api](concepts/api.md), [model](concepts/model.md) |
| `ClientOf` | type | yes | [api](concepts/api.md), [foldkit](concepts/foldkit.md), [model](concepts/model.md) |

## `Backfill.ts`

| Name | Kind | In beta.87 | Covered in |
| --- | --- | --- | --- |
| `Storage` | interface | yes | [cluster](concepts/cluster.md), [host-cloudflare](concepts/host-cloudflare.md), [host-effect-cluster](concepts/host-effect-cluster.md), [host-rivet](concepts/host-rivet.md) and 1 more |
| `Jobs` | interface | yes | [alchemy-git](concepts/alchemy-git.md), [cluster-singletons](concepts/cluster-singletons.md), [platform-contract](concepts/platform-contract.md) |
| `SourceRef` | interface | yes | [backfill](concepts/backfill.md) |
| `Plan` | interface | yes | [02-merged-since-beta-87](02-merged-since-beta-87.md), [backfill](concepts/backfill.md), [decision](concepts/decision.md), [github](concepts/github.md) and 1 more |
| `withGeneration` | const | yes | [backfill](concepts/backfill.md) |
| `NodeRpc` | interface | yes | [backfill](concepts/backfill.md) |
| `Listing` | interface | yes | [backfill](concepts/backfill.md) |
| `SourceRpc` | interface | yes | [backfill](concepts/backfill.md) |
| `Handoff` | type | yes | [backfill](concepts/backfill.md) |
| `Read` | interface | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [04-trial](04-trial.md), [aggregate](concepts/aggregate.md), [ai-and-mcp](concepts/ai-and-mcp.md) and 28 more |
| `Pulled` | interface | yes | [backfill](concepts/backfill.md) |
| `ConsumerRpc` | interface | yes | [backfill](concepts/backfill.md) |
| `ScannerRpc` | interface | yes | [backfill](concepts/backfill.md) |
| `RelayItem` | type | yes | [backfill](concepts/backfill.md) |
| `RelayRun` | interface | yes | [backfill](concepts/backfill.md) |
| `RelayRpc` | interface | yes | [backfill](concepts/backfill.md) |
| `RelayResult` | interface | yes | [backfill](concepts/backfill.md) |
| `Phase` | type | yes | [02-merged-since-beta-87](02-merged-since-beta-87.md), [model](concepts/model.md) |
| `RunRpc` | interface | yes | [backfill](concepts/backfill.md) |
| `Begin` | type | yes | [backfill](concepts/backfill.md) |
| `samePlan` | const | yes | [backfill](concepts/backfill.md) |
| `planChanged` | const | yes | [backfill](concepts/backfill.md) |
| `PlanChanged` | class | yes | [backfill](concepts/backfill.md) |
| `Progress` | interface | yes | [backfill](concepts/backfill.md), [model](concepts/model.md), [projection](concepts/projection.md), [reads-and-consistency](concepts/reads-and-consistency.md) |
| `Network` | interface | yes | [backfill](concepts/backfill.md) |
| `Limits` | interface | yes | [alchemy-git](concepts/alchemy-git.md), [backfill](concepts/backfill.md), [confidence-scores](concepts/confidence-scores.md), [host-cloudflare](concepts/host-cloudflare.md) and 2 more |
| `DEPTH` | const | yes | [backfill](concepts/backfill.md), [host-cloudflare](concepts/host-cloudflare.md) |
| `defaultLimits` | const | yes | [backfill](concepts/backfill.md) |
| `leafOf` | const | yes | [host-cloudflare](concepts/host-cloudflare.md) |
| `sourceOfPath` | const | yes | [backfill](concepts/backfill.md) |
| `orderKey` | const | yes | [backfill](concepts/backfill.md) |
| `overloaded` | const | yes | [backfill](concepts/backfill.md), [cluster](concepts/cluster.md) |
| `SourceHost` | interface | yes | [backfill](concepts/backfill.md) |
| `makeSource` | const | yes | [backfill](concepts/backfill.md), [platform-contract](concepts/platform-contract.md) |
| `Source` | type | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [04-trial](04-trial.md), [aggregate](concepts/aggregate.md), [cluster](concepts/cluster.md) and 13 more |
| `ScannerHost` | interface | yes | [backfill](concepts/backfill.md) |
| `makeScanner` | const | yes | [backfill](concepts/backfill.md), [platform-contract](concepts/platform-contract.md) |
| `Scanner` | type | yes | [backfill](concepts/backfill.md) |
| `ConsumerHost` | interface | yes | [backfill](concepts/backfill.md) |
| `makeConsumer` | const | yes | [backfill](concepts/backfill.md), [platform-contract](concepts/platform-contract.md) |
| `Consumer` | type | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [explore](concepts/explore.md), [prove](concepts/prove.md), [tutorial](concepts/tutorial.md) and 1 more |
| `makeNode` | const | yes | [backfill](concepts/backfill.md), [platform-contract](concepts/platform-contract.md) |
| `Node` | type | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [04-trial](04-trial.md), [aggregate](concepts/aggregate.md), [cloudflare-tutorial](concepts/cloudflare-tutorial.md) and 18 more |
| `RELAY_FANOUT` | const | yes | [backfill](concepts/backfill.md) |
| `makeRelay` | const | yes | [backfill](concepts/backfill.md), [platform-contract](concepts/platform-contract.md) |
| `Relay` | type | yes | [backfill](concepts/backfill.md) |
| `makeRun` | const | yes | [backfill](concepts/backfill.md), [cluster-workflows](concepts/cluster-workflows.md), [platform-contract](concepts/platform-contract.md), [saga](concepts/saga.md) |
| `Run` | type | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [04-trial](04-trial.md), [cli](concepts/cli.md), [cluster-singletons](concepts/cluster-singletons.md) and 13 more |
| `routeCommit` | const | yes | [backfill](concepts/backfill.md), [platform-contract](concepts/platform-contract.md) |
| `routeRows` | const | yes | [backfill](concepts/backfill.md) |
| `consumerOf` | const | yes | [backfill](concepts/backfill.md) |

## `CatchUp.ts`

| Name | Kind | In beta.87 | Covered in |
| --- | --- | --- | --- |
| `Routed` | type | yes | [model](concepts/model.md), [reads-and-consistency](concepts/reads-and-consistency.md) |
| `targetId` | const | yes | [aggregate](concepts/aggregate.md), [model](concepts/model.md), [platform-contract](concepts/platform-contract.md), [reads-and-consistency](concepts/reads-and-consistency.md) |
| `routeLive` | const | yes | [reads-and-consistency](concepts/reads-and-consistency.md) |
| `ReplayInput` | interface | yes | [reads-and-consistency](concepts/reads-and-consistency.md) |
| `ReplayResult` | interface | yes | [reads-and-consistency](concepts/reads-and-consistency.md) |

## `Cli.ts`

| Name | Kind | In beta.87 | Covered in |
| --- | --- | --- | --- |
| `Cliable` | interface | yes | [cli](concepts/cli.md) |
| `ClientServices` | type | yes | [cli](concepts/cli.md) |
| `CallRejected` | class | yes | [cli](concepts/cli.md) |
| `Exposable` | type | yes | [ai-and-mcp](concepts/ai-and-mcp.md), [cli](concepts/cli.md), [http-api](concepts/http-api.md) |
| `Options` | interface | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [aggregate](concepts/aggregate.md), [api](concepts/api.md), [backfill](concepts/backfill.md) and 14 more |
| `Failure` | type | yes | [04-trial](04-trial.md), [cli](concepts/cli.md), [distilled-clients](concepts/distilled-clients.md), [foldkit](concepts/foldkit.md) |
| `kebab` | const | yes | [cli](concepts/cli.md) |
| `toCli` | const | yes | [annotations](concepts/annotations.md), [api](concepts/api.md), [cli](concepts/cli.md) |

## `Cloudflare/Backfill.ts`

| Name | Kind | In beta.87 | Covered in |
| --- | --- | --- | --- |
| `BackfillProps` | interface | yes | [backfill](concepts/backfill.md) |
| `BackfillAttrs` | interface | yes | [backfill](concepts/backfill.md) |
| `Backfill` | interface | yes | [02-merged-since-beta-87](02-merged-since-beta-87.md), [backfill](concepts/backfill.md), [distilled-clients](concepts/distilled-clients.md), [host-cloudflare](concepts/host-cloudflare.md) and 5 more |
| `BackfillStillRunning` | class | yes | [backfill](concepts/backfill.md), [host-cloudflare](concepts/host-cloudflare.md), [model](concepts/model.md) |
| `BackfillFailed` | class | yes | [backfill](concepts/backfill.md), [host-cloudflare](concepts/host-cloudflare.md), [model](concepts/model.md) |
| `progressOf` | const | yes | [backfill](concepts/backfill.md) |
| `describeProgress` | const | yes | [backfill](concepts/backfill.md) |
| `BackfillProvider` | const | yes | [backfill](concepts/backfill.md) |

## `Cloudflare/Providers.ts`

| Name | Kind | In beta.87 | Covered in |
| --- | --- | --- | --- |
| `Providers` | class | yes | [backfill](concepts/backfill.md), [cluster](concepts/cluster.md), [drizzle-durable-objects](concepts/drizzle-durable-objects.md), [github](concepts/github.md) and 5 more |
| `ProviderRequirements` | type | yes | [cluster](concepts/cluster.md), [host-cloudflare](concepts/host-cloudflare.md), [model](concepts/model.md) |
| `providers` | const | yes | [02-merged-since-beta-87](02-merged-since-beta-87.md), [better-auth](concepts/better-auth.md), [cloudflare-tutorial](concepts/cloudflare-tutorial.md), [cluster](concepts/cluster.md) and 11 more |

## `Cloudflare/Version.ts`

| Name | Kind | In beta.87 | Covered in |
| --- | --- | --- | --- |
| `DOMAIN_VERSION` | const | yes | [host-cloudflare](concepts/host-cloudflare.md) |
| `DeployVersion` (internal) | const | yes | [host-cloudflare](concepts/host-cloudflare.md) |

## `Cloudflare/index.ts`

| Name | Kind | In beta.87 | Covered in |
| --- | --- | --- | --- |
| `layerDurableObjects` | function | yes | [backfill](concepts/backfill.md), [cluster-workflows](concepts/cluster-workflows.md), [host-cloudflare](concepts/host-cloudflare.md), [host-effect-cluster](concepts/host-effect-cluster.md) and 5 more |
| `DurableObjectsOptions` | interface | yes | [host-cloudflare](concepts/host-cloudflare.md), [host-rivet](concepts/host-rivet.md), [model](concepts/model.md) |

## `Command.ts`

| Name | Kind | In beta.87 | Covered in |
| --- | --- | --- | --- |
| `Instance` | type | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [cluster-workflows](concepts/cluster-workflows.md), [command](concepts/command.md), [event](concepts/event.md) and 5 more |
| `Any` | interface | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [04-trial](04-trial.md), [aggregate](concepts/aggregate.md), [ai-and-mcp](concepts/ai-and-mcp.md) and 30 more |
| `ContextOf` | type | yes | [aggregate](concepts/aggregate.md), [command](concepts/command.md), [external-system](concepts/external-system.md), [invariants-and-transitions](concepts/invariants-and-transitions.md) and 3 more |
| `ReplySchema` | type | yes | [command](concepts/command.md) |
| `Consistency` | const | no | [command](concepts/command.md), [reads-and-consistency](concepts/reads-and-consistency.md) |
| `DefaultConsistency` | const | no | [02-merged-since-beta-87](02-merged-since-beta-87.md), [ai-and-mcp](concepts/ai-and-mcp.md), [api](concepts/api.md), [command](concepts/command.md) and 2 more |
| `PayloadFields` | type | yes | [command](concepts/command.md) |
| `Commit` | const | no | [02-merged-since-beta-87](02-merged-since-beta-87.md), [ai-and-mcp](concepts/ai-and-mcp.md), [annotations](concepts/annotations.md), [api](concepts/api.md) and 11 more |
| `SuccessFields` | type | yes | [command](concepts/command.md) |
| `CommandRpc` | type | yes | [command](concepts/command.md) |
| `CommandClass` | interface | yes | [command](concepts/command.md), [prove](concepts/prove.md) |
| `make` | const | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [02-merged-since-beta-87](02-merged-since-beta-87.md), [03-this-apps-rules-under-verify](03-this-apps-rules-under-verify.md), [04-trial](04-trial.md) and 46 more |

## `Decision.ts` (new on main)

| Name | Kind | In beta.87 | Covered in |
| --- | --- | --- | --- |
| `Recorded` | interface | no | [api](concepts/api.md), [cluster-workflows](concepts/cluster-workflows.md), [decision](concepts/decision.md), [model](concepts/model.md) |
| `recorded` (internal) | const | no | [02-merged-since-beta-87](02-merged-since-beta-87.md), [04-trial](04-trial.md), [alchemy-git](concepts/alchemy-git.md), [backfill](concepts/backfill.md) and 19 more |
| `recordedOn` (internal) | const | no | [decision](concepts/decision.md) |
| `Read` | interface | no | [01-pr-3260-verify](01-pr-3260-verify.md), [04-trial](04-trial.md), [aggregate](concepts/aggregate.md), [ai-and-mcp](concepts/ai-and-mcp.md) and 28 more |
| `Reads` | type | no | [alchemy-git](concepts/alchemy-git.md), [cluster-workflows](concepts/cluster-workflows.md), [command](concepts/command.md), [decision](concepts/decision.md) and 4 more |
| `KeysOf` | type | no | [decision](concepts/decision.md) |
| `ReadsOf` | type | no | [decision](concepts/decision.md) |
| `StatesOf` | type | no | [decision](concepts/decision.md), [invariants-and-transitions](concepts/invariants-and-transitions.md) |
| `Transition` | interface | no | [aggregate](concepts/aggregate.md), [decision](concepts/decision.md), [invariants-and-transitions](concepts/invariants-and-transitions.md) |
| `DecideContext` | interface | no | [aggregate](concepts/aggregate.md), [deadlines](concepts/deadlines.md), [decision](concepts/decision.md), [local-first](concepts/local-first.md) |
| `Outcome` | type | no | [cli](concepts/cli.md), [confidence-scores](concepts/confidence-scores.md), [decision](concepts/decision.md), [explore](concepts/explore.md) and 2 more |
| `Definition` | type | no | [01-pr-3260-verify](01-pr-3260-verify.md), [aggregate](concepts/aggregate.md), [confidence-scores](concepts/confidence-scores.md), [decision](concepts/decision.md) and 8 more |
| `AnyDefinition` | interface | no | [aggregate](concepts/aggregate.md), [decision](concepts/decision.md), [invariants-and-transitions](concepts/invariants-and-transitions.md) |
| `Commit` | interface | no | [02-merged-since-beta-87](02-merged-since-beta-87.md), [ai-and-mcp](concepts/ai-and-mcp.md), [annotations](concepts/annotations.md), [api](concepts/api.md) and 11 more |
| `Receipt` | interface | no | [aggregate](concepts/aggregate.md), [command](concepts/command.md), [decision](concepts/decision.md), [model](concepts/model.md) |
| `Client` | interface | no | [aggregate](concepts/aggregate.md), [api](concepts/api.md), [deadlines](concepts/deadlines.md), [decision](concepts/decision.md) and 7 more |
| `ClientImpl` (internal) | interface | no | [aggregate](concepts/aggregate.md), [decision](concepts/decision.md) |
| `Key` | interface | no | [aggregate](concepts/aggregate.md), [alchemy-git](concepts/alchemy-git.md), [annotations](concepts/annotations.md), [backfill](concepts/backfill.md) and 11 more |
| `Any` | interface | no | [01-pr-3260-verify](01-pr-3260-verify.md), [04-trial](04-trial.md), [aggregate](concepts/aggregate.md), [ai-and-mcp](concepts/ai-and-mcp.md) and 30 more |
| `DecisionClass` | interface | no | [decision](concepts/decision.md) |
| `make` | const | no | [01-pr-3260-verify](01-pr-3260-verify.md), [02-merged-since-beta-87](02-merged-since-beta-87.md), [03-this-apps-rules-under-verify](03-this-apps-rules-under-verify.md), [04-trial](04-trial.md) and 46 more |

## `DefinitionError.ts`

| Name | Kind | In beta.87 | Covered in |
| --- | --- | --- | --- |
| `DuplicateEventTag` | class | yes | [aggregate](concepts/aggregate.md), [command](concepts/command.md), [event](concepts/event.md), [model](concepts/model.md) |
| `DuplicateName` | class | yes | [model](concepts/model.md) |
| `DuplicateDefinition` | class | yes | [aggregate](concepts/aggregate.md), [model](concepts/model.md), [policy](concepts/policy.md), [projection](concepts/projection.md) |
| `InvalidInitial` | class | yes | [aggregate](concepts/aggregate.md), [model](concepts/model.md), [view](concepts/view.md) |
| `MissingInitial` | class | yes | [model](concepts/model.md) |
| `UnknownSource` | class | yes | [model](concepts/model.md) |
| `ConsumesItself` | class | yes | [model](concepts/model.md) |
| `MissingKeyOf` | class | yes | [model](concepts/model.md) |
| `UnmatchedRoute` | class | yes | [model](concepts/model.md), [view](concepts/view.md) |
| `NoEmitter` | class | yes | [model](concepts/model.md), [policy](concepts/policy.md), [projection](concepts/projection.md), [view](concepts/view.md) |
| `UnknownStream` | class | yes | [model](concepts/model.md), [projection](concepts/projection.md), [stream](concepts/stream.md) |
| `TwoWriters` | class | yes | [model](concepts/model.md), [projection](concepts/projection.md), [stream](concepts/stream.md) |
| `WriterKeyMismatch` | class | yes | [model](concepts/model.md), [projection](concepts/projection.md), [stream](concepts/stream.md) |
| `UnhandledCommand` | class | yes | [aggregate](concepts/aggregate.md), [local-first](concepts/local-first.md), [model](concepts/model.md) |
| `UnroutedCommand` | class | yes | [api](concepts/api.md), [command](concepts/command.md), [model](concepts/model.md) |
| `ImplementedTwice` | class | no | [02-merged-since-beta-87](02-merged-since-beta-87.md), [decision](concepts/decision.md), [model](concepts/model.md) |
| `UnknownRead` | class | no | [02-merged-since-beta-87](02-merged-since-beta-87.md), [decision](concepts/decision.md), [model](concepts/model.md) |
| `UnreadRecord` | class | no | [decision](concepts/decision.md), [model](concepts/model.md) |
| `DecisionsUnsupported` | class | no | [decision](concepts/decision.md), [model](concepts/model.md), [platform-contract](concepts/platform-contract.md) |
| `UndeclaredDecision` | class | yes | [aggregate](concepts/aggregate.md), [command](concepts/command.md), [decision](concepts/decision.md), [event](concepts/event.md) and 3 more |
| `UndeclaredEvent` | class | yes | [decision](concepts/decision.md), [model](concepts/model.md) |
| `UndeclaredEmit` | class | yes | [model](concepts/model.md) |
| `UnknownEvent` | class | yes | [model](concepts/model.md) |
| `UnknownRequestContext` | class | yes | [model](concepts/model.md), [sessions](concepts/sessions.md) |
| `ReservedOperation` | class | yes | [annotations](concepts/annotations.md), [external-system](concepts/external-system.md), [model](concepts/model.md) |
| `MissingWorkflowEngine` | class | yes | [model](concepts/model.md), [saga](concepts/saga.md) |
| `UnvalidatedRead` | class | yes | [model](concepts/model.md), [view-security](concepts/view-security.md) |
| `ForeignAppend` | class | yes | [model](concepts/model.md), [stream](concepts/stream.md) |
| `NotInModel` | class | yes | [api](concepts/api.md), [model](concepts/model.md) |
| `ToolNameTooLong` | class | yes | [ai-and-mcp](concepts/ai-and-mcp.md), [model](concepts/model.md) |
| `DuplicateTool` | class | yes | [ai-and-mcp](concepts/ai-and-mcp.md), [model](concepts/model.md) |
| `ReservedFlag` | class | yes | [cli](concepts/cli.md), [model](concepts/model.md) |
| `DuplicateFlag` | class | yes | [cli](concepts/cli.md), [model](concepts/model.md) |
| `DuplicateCommand` | class | yes | [cli](concepts/cli.md), [command](concepts/command.md), [model](concepts/model.md) |
| `MissingGroup` | class | yes | [http-api](concepts/http-api.md), [model](concepts/model.md) |
| `NewerGeneration` | class | yes | [model](concepts/model.md) |
| `ModelHostedTwice` | class | yes | [model](concepts/model.md), [platform-contract](concepts/platform-contract.md) |
| `LazyViewNeedsOneSource` | class | yes | [model](concepts/model.md), [view](concepts/view.md) |
| `PagedWithoutSuccess` | class | yes | [model](concepts/model.md), [query](concepts/query.md) |
| `UnknownWait` | class | yes | [model](concepts/model.md), [query](concepts/query.md) |
| `Reason` | type | yes | [graphql](concepts/graphql.md), [model](concepts/model.md) |
| `DefinitionError` | class | yes | [aggregate](concepts/aggregate.md), [ai-and-mcp](concepts/ai-and-mcp.md), [api](concepts/api.md), [cli](concepts/cli.md) and 13 more |

## `DurableObjects.ts`

| Name | Kind | In beta.87 | Covered in |
| --- | --- | --- | --- |
| `ListOptions` | interface | yes | [host-cloudflare](concepts/host-cloudflare.md) |
| `ObjectStorage` | interface | yes | [host-cloudflare](concepts/host-cloudflare.md) |
| `ObjectSocket` | interface | yes | [host-cloudflare](concepts/host-cloudflare.md) |
| `ObjectStateShape` | interface | yes | [host-cloudflare](concepts/host-cloudflare.md) |
| `ObjectState` | class | yes | [host-cloudflare](concepts/host-cloudflare.md) |
| `Stub` | interface | yes | [host-cloudflare](concepts/host-cloudflare.md) |
| `Namespace` | interface | yes | [alchemy-git](concepts/alchemy-git.md), [cluster-workflows](concepts/cluster-workflows.md), [host-cloudflare](concepts/host-cloudflare.md) |
| `InstanceServices` | type | yes | [cluster](concepts/cluster.md), [host-cloudflare](concepts/host-cloudflare.md) |
| `ObjectImpl` | type | yes | [cluster-workflows](concepts/cluster-workflows.md), [host-cloudflare](concepts/host-cloudflare.md) |
| `Host` | interface | yes | [alchemy-git](concepts/alchemy-git.md), [backfill](concepts/backfill.md), [cluster](concepts/cluster.md), [cluster-workflows](concepts/cluster-workflows.md) and 13 more |
| `TRANSIT_RETRY` | const | yes | [host-cloudflare](concepts/host-cloudflare.md) |
| `unwrapDefects` | const | yes | [host-cloudflare](concepts/host-cloudflare.md) |
| `consumerClass` | const | yes | [host-cloudflare](concepts/host-cloudflare.md), [projection](concepts/projection.md) |
| `runClass` | const | yes | [host-cloudflare](concepts/host-cloudflare.md) |
| `generationOfTarget` | const | yes | [host-cloudflare](concepts/host-cloudflare.md) |
| `runClassOfTarget` | const | yes | [host-cloudflare](concepts/host-cloudflare.md) |
| `Attachment` | const | yes | [host-cloudflare](concepts/host-cloudflare.md) |
| `SUBSCRIPTION_HEADER` | const | yes | [host-cloudflare](concepts/host-cloudflare.md) |
| `PlanOf` | type | yes | [host-cloudflare](concepts/host-cloudflare.md) |
| `plansOf` | const | yes | [host-cloudflare](concepts/host-cloudflare.md) |
| `RUN_ROOT` | const | yes | [host-cloudflare](concepts/host-cloudflare.md) |
| `makePlatform` | const | yes | [decision](concepts/decision.md), [host-cloudflare](concepts/host-cloudflare.md), [platform-contract](concepts/platform-contract.md) |
| `multiplexedName` | const | yes | [host-cloudflare](concepts/host-cloudflare.md) |
| `className` | const | yes | [cluster-singletons](concepts/cluster-singletons.md), [cluster-workflows](concepts/cluster-workflows.md), [host-cloudflare](concepts/host-cloudflare.md) |
| `parseMultiplexedName` | const | yes | [host-cloudflare](concepts/host-cloudflare.md) |
| `Alarm` | interface | yes | [cluster](concepts/cluster.md), [host-cloudflare](concepts/host-cloudflare.md) |
| `alarmCallbacks` | const | yes | [host-cloudflare](concepts/host-cloudflare.md), [policy](concepts/policy.md), [projection](concepts/projection.md) |

## `EffectCluster/index.ts`

| Name | Kind | In beta.87 | Covered in |
| --- | --- | --- | --- |
| `DomainClassNotHosted` | class | yes | [02-merged-since-beta-87](02-merged-since-beta-87.md), [host-effect-cluster](concepts/host-effect-cluster.md), [host-rivet](concepts/host-rivet.md), [model](concepts/model.md) |
| `DomainEngineNotStarted` | class | yes | [host-effect-cluster](concepts/host-effect-cluster.md), [model](concepts/model.md) |
| `EntitiesOptions` | interface | yes | [host-effect-cluster](concepts/host-effect-cluster.md), [model](concepts/model.md) |
| `layerEntities` | const | yes | [host-effect-cluster](concepts/host-effect-cluster.md), [model](concepts/model.md) |

## `Event.ts`

| Name | Kind | In beta.87 | Covered in |
| --- | --- | --- | --- |
| `Fields` | type | yes | [command](concepts/command.md), [event](concepts/event.md), [query](concepts/query.md) |
| `Data` | type | yes | [confidence-scores](concepts/confidence-scores.md), [event](concepts/event.md), [explore](concepts/explore.md), [model](concepts/model.md) and 2 more |
| `Instance` | type | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [cluster-workflows](concepts/cluster-workflows.md), [command](concepts/command.md), [event](concepts/event.md) and 5 more |
| `Any` | interface | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [04-trial](04-trial.md), [aggregate](concepts/aggregate.md), [ai-and-mcp](concepts/ai-and-mcp.md) and 30 more |
| `Annotations` | type | yes | [aggregate](concepts/aggregate.md), [annotations](concepts/annotations.md), [command](concepts/command.md), [event](concepts/event.md) and 3 more |
| `make` | const | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [02-merged-since-beta-87](02-merged-since-beta-87.md), [03-this-apps-rules-under-verify](03-this-apps-rules-under-verify.md), [04-trial](04-trial.md) and 46 more |
| `EventClass` | interface | yes | [event](concepts/event.md) |

## `Explore.ts` (new on main)

| Name | Kind | In beta.87 | Covered in |
| --- | --- | --- | --- |
| `Options` | interface | no | [01-pr-3260-verify](01-pr-3260-verify.md), [aggregate](concepts/aggregate.md), [api](concepts/api.md), [backfill](concepts/backfill.md) and 14 more |
| `ModelOptions` | interface | no | [explore](concepts/explore.md) |
| `ExploreError` | class | no | [01-pr-3260-verify](01-pr-3260-verify.md), [explore](concepts/explore.md), [invariants-and-transitions](concepts/invariants-and-transitions.md), [relation](concepts/relation.md) |
| `InvariantBroken` | class | no | [01-pr-3260-verify](01-pr-3260-verify.md), [explore](concepts/explore.md) |
| `Incomplete` | class | no | [01-pr-3260-verify](01-pr-3260-verify.md), [explore](concepts/explore.md), [prove](concepts/prove.md) |
| `Report` | interface | no | [01-pr-3260-verify](01-pr-3260-verify.md), [explore](concepts/explore.md), [prove](concepts/prove.md), [tutorial](concepts/tutorial.md) and 1 more |
| `ModelReport` | interface | no | [explore](concepts/explore.md) |
| `report` | function | no | [01-pr-3260-verify](01-pr-3260-verify.md), [02-merged-since-beta-87](02-merged-since-beta-87.md), [03-this-apps-rules-under-verify](03-this-apps-rules-under-verify.md), [04-trial](04-trial.md) and 19 more |
| `check` | function | no | [01-pr-3260-verify](01-pr-3260-verify.md), [02-merged-since-beta-87](02-merged-since-beta-87.md), [04-trial](04-trial.md), [aggregate](concepts/aggregate.md) and 53 more |
| `undone` | const | no | [01-pr-3260-verify](01-pr-3260-verify.md), [cluster-workflows](concepts/cluster-workflows.md), [explore](concepts/explore.md), [verify](concepts/verify.md) |
| `describe` | const | no | [01-pr-3260-verify](01-pr-3260-verify.md), [aggregate](concepts/aggregate.md), [ai-and-mcp](concepts/ai-and-mcp.md), [annotations](concepts/annotations.md) and 10 more |
| `script` | const | no | [01-pr-3260-verify](01-pr-3260-verify.md), [02-merged-since-beta-87](02-merged-since-beta-87.md), [api](concepts/api.md), [backfill](concepts/backfill.md) and 11 more |
| `render` | const | no | [01-pr-3260-verify](01-pr-3260-verify.md), [04-trial](04-trial.md), [explore](concepts/explore.md), [prove](concepts/prove.md) and 1 more |

## `Explore/internal/ModelSearch.ts` (new on main)

| Name | Kind | In beta.87 | Covered in |
| --- | --- | --- | --- |
| `Step` (internal) | interface | no | [explore](concepts/explore.md), [prove](concepts/prove.md), [story](concepts/story.md) |
| `Asked` (internal) | interface | no | [explore](concepts/explore.md) |
| `Story` (internal) | type | no | [01-pr-3260-verify](01-pr-3260-verify.md), [02-merged-since-beta-87](02-merged-since-beta-87.md), [04-trial](04-trial.md), [aggregate](concepts/aggregate.md) and 24 more |
| `Outcome` (internal) | interface | no | [cli](concepts/cli.md), [confidence-scores](concepts/confidence-scores.md), [decision](concepts/decision.md), [explore](concepts/explore.md) and 2 more |
| `Ending` (internal) | interface | no | [explore](concepts/explore.md) |
| `Skipped` (internal) | interface | no | [explore](concepts/explore.md) |
| `Aside` (internal) | interface | no | [01-pr-3260-verify](01-pr-3260-verify.md), [explore](concepts/explore.md), [invariants-and-transitions](concepts/invariants-and-transitions.md), [prove](concepts/prove.md) |
| `Found` (internal) | interface | no | [03-this-apps-rules-under-verify](03-this-apps-rules-under-verify.md), [distilled-clients](concepts/distilled-clients.md), [explore](concepts/explore.md), [model](concepts/model.md) |
| `Options` (internal) | interface | no | [01-pr-3260-verify](01-pr-3260-verify.md), [aggregate](concepts/aggregate.md), [api](concepts/api.md), [backfill](concepts/backfill.md) and 14 more |
| `ModelLike` (internal) | interface | no | [explore](concepts/explore.md) |
| `whole` (internal) | const | no | [01-pr-3260-verify](01-pr-3260-verify.md), [04-trial](04-trial.md), [alchemy-git](concepts/alchemy-git.md), [api](concepts/api.md) and 31 more |
| `locate` (internal) | const | no | [confidence-scores](concepts/confidence-scores.md), [explore](concepts/explore.md), [prove](concepts/prove.md) |
| `Located` (internal) | type | no | [explore](concepts/explore.md) |
| `search` (internal) | const | no | [01-pr-3260-verify](01-pr-3260-verify.md), [03-this-apps-rules-under-verify](03-this-apps-rules-under-verify.md), [explore](concepts/explore.md), [graphql](concepts/graphql.md) and 14 more |

## `Explore/internal/Script.ts` (new on main)

| Name | Kind | In beta.87 | Covered in |
| --- | --- | --- | --- |
| `Op` (internal) | type | no | [explore](concepts/explore.md), [external-system](concepts/external-system.md), [model](concepts/model.md) |
| `ops` (internal) | const | no | [cli](concepts/cli.md), [explore](concepts/explore.md), [external-system](concepts/external-system.md), [http-api](concepts/http-api.md) |
| `redelivers` (internal) | const | no | [explore](concepts/explore.md), [host-cloudflare](concepts/host-cloudflare.md) |
| `script` (internal) | const | no | [01-pr-3260-verify](01-pr-3260-verify.md), [02-merged-since-beta-87](02-merged-since-beta-87.md), [api](concepts/api.md), [backfill](concepts/backfill.md) and 11 more |

## `Explore/internal/Search.ts` (new on main)

| Name | Kind | In beta.87 | Covered in |
| --- | --- | --- | --- |
| `Move` (internal) | interface | no | [drizzle-durable-objects](concepts/drizzle-durable-objects.md), [explore](concepts/explore.md) |
| `Story` (internal) | type | no | [01-pr-3260-verify](01-pr-3260-verify.md), [02-merged-since-beta-87](02-merged-since-beta-87.md), [04-trial](04-trial.md), [aggregate](concepts/aggregate.md) and 24 more |
| `Outcome` (internal) | interface | no | [cli](concepts/cli.md), [confidence-scores](concepts/confidence-scores.md), [decision](concepts/decision.md), [explore](concepts/explore.md) and 2 more |
| `Found` (internal) | interface | no | [03-this-apps-rules-under-verify](03-this-apps-rules-under-verify.md), [distilled-clients](concepts/distilled-clients.md), [explore](concepts/explore.md), [model](concepts/model.md) |
| `tagOf` (internal) | const | no | [explore](concepts/explore.md) |
| `lift` (internal) | const | no | [explore](concepts/explore.md) |
| `stateTags` (internal) | const | no | [explore](concepts/explore.md), [prove](concepts/prove.md) |
| `Options` (internal) | interface | no | [01-pr-3260-verify](01-pr-3260-verify.md), [aggregate](concepts/aggregate.md), [api](concepts/api.md), [backfill](concepts/backfill.md) and 14 more |
| `search` (internal) | const | no | [01-pr-3260-verify](01-pr-3260-verify.md), [03-this-apps-rules-under-verify](03-this-apps-rules-under-verify.md), [explore](concepts/explore.md), [graphql](concepts/graphql.md) and 14 more |

## `ExternalSystem.ts`

| Name | Kind | In beta.87 | Covered in |
| --- | --- | --- | --- |
| `observeOps` (internal) | const | yes | [external-system](concepts/external-system.md) |
| `CallRecorder` (internal) | interface | yes | [external-system](concepts/external-system.md) |
| `ExternalSystemSchemaError` | class | yes | [external-system](concepts/external-system.md) |
| `compileChecks` (internal) | const | yes | [external-system](concepts/external-system.md) |
| `validateOps` (internal) | const | yes | [external-system](concepts/external-system.md), [resend](concepts/resend.md) |
| `ToLayerOptions` | interface | yes | [external-system](concepts/external-system.md) |
| `OpSpec` | interface | yes | [external-system](concepts/external-system.md), [resend](concepts/resend.md) |
| `Shape` | type | yes | [explore](concepts/explore.md), [external-system](concepts/external-system.md), [http-api](concepts/http-api.md), [prove](concepts/prove.md) and 2 more |
| `Op` | interface | yes | [explore](concepts/explore.md), [external-system](concepts/external-system.md), [model](concepts/model.md) |
| `Any` | interface | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [04-trial](04-trial.md), [aggregate](concepts/aggregate.md), [ai-and-mcp](concepts/ai-and-mcp.md) and 30 more |
| `Identifier` | type | yes | [aggregate](concepts/aggregate.md), [external-system](concepts/external-system.md), [foldkit](concepts/foldkit.md), [graphql](concepts/graphql.md) and 3 more |
| `ExternalSystemKey` | interface | yes | [external-system](concepts/external-system.md) |
| `make` | const | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [02-merged-since-beta-87](02-merged-since-beta-87.md), [03-this-apps-rules-under-verify](03-this-apps-rules-under-verify.md), [04-trial](04-trial.md) and 46 more |
| `ExternalSystemClass` | type | yes | [external-system](concepts/external-system.md) |
| `successSchema` (internal) | const | yes | [external-system](concepts/external-system.md) |
| `errorSchema` (internal) | const | yes | [external-system](concepts/external-system.md) |

## `Filter.ts`

| Name | Kind | In beta.87 | Covered in |
| --- | --- | --- | --- |
| `OrderedOps` | interface | yes | [query](concepts/query.md) |
| `StringOps` | interface | yes | [query](concepts/query.md) |
| `ArrayOps` | interface | yes | [query](concepts/query.md) |
| `FieldFilter` | type | yes | [query](concepts/query.md) |
| `Filter` | type | yes | [model](concepts/model.md), [query](concepts/query.md), [reads-and-consistency](concepts/reads-and-consistency.md), [view](concepts/view.md) |
| `OrderBy` | type | yes | [model](concepts/model.md), [query](concepts/query.md), [reads-and-consistency](concepts/reads-and-consistency.md) |
| `FilterJson` | const | yes | [query](concepts/query.md), [reads-and-consistency](concepts/reads-and-consistency.md) |
| `matches` | const | yes | [backfill](concepts/backfill.md), [cloudflare-tutorial](concepts/cloudflare-tutorial.md), [discord-sign-in](concepts/discord-sign-in.md), [foldkit](concepts/foldkit.md) and 6 more |
| `sort` | const | yes | [decision](concepts/decision.md), [graphql](concepts/graphql.md), [prove](concepts/prove.md), [query](concepts/query.md) and 1 more |

## `Foldkit.ts`

| Name | Kind | In beta.87 | Covered in |
| --- | --- | --- | --- |
| `CommandHeaders` | class | yes | [foldkit](concepts/foldkit.md), [local-first](concepts/local-first.md) |
| `CommandIds` | const | yes | [foldkit](concepts/foldkit.md) |
| `next` | const | yes | [02-merged-since-beta-87](02-merged-since-beta-87.md), [aggregate](concepts/aggregate.md), [annotations](concepts/annotations.md), [backfill](concepts/backfill.md) and 32 more |
| `Failure` | type | yes | [04-trial](04-trial.md), [cli](concepts/cli.md), [distilled-clients](concepts/distilled-clients.md), [foldkit](concepts/foldkit.md) |
| `QueryFailure` | type | yes | [foldkit](concepts/foldkit.md) |
| `ReadClientOf` | interface | yes | [foldkit](concepts/foldkit.md) |
| `ClientOf` | type | yes | [api](concepts/api.md), [foldkit](concepts/foldkit.md), [model](concepts/model.md) |
| `make` | function | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [02-merged-since-beta-87](02-merged-since-beta-87.md), [03-this-apps-rules-under-verify](03-this-apps-rules-under-verify.md), [04-trial](04-trial.md) and 46 more |
| `Snapshot` | type | yes | [foldkit](concepts/foldkit.md), [reads-and-consistency](concepts/reads-and-consistency.md) |
| `WatchOptions` | interface | yes | [foldkit](concepts/foldkit.md) |
| `EventsOptions` | interface | yes | [foldkit](concepts/foldkit.md) |

## `Http.ts`

| Name | Kind | In beta.87 | Covered in |
| --- | --- | --- | --- |
| `Publishable` | interface | yes | [http-api](concepts/http-api.md) |
| `Requirements` | type | yes | [http-api](concepts/http-api.md) |
| `Exposable` | type | yes | [ai-and-mcp](concepts/ai-and-mcp.md), [cli](concepts/cli.md), [http-api](concepts/http-api.md) |
| `HttpApiOptions` | interface | yes | [http-api](concepts/http-api.md) |
| `HttpApiSurface` | interface | yes | [http-api](concepts/http-api.md) |
| `toHttpApi` | const | yes | [annotations](concepts/annotations.md), [api](concepts/api.md), [http-api](concepts/http-api.md) |

## `InMemory.ts`

| Name | Kind | In beta.87 | Covered in |
| --- | --- | --- | --- |
| `Options` | interface | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [aggregate](concepts/aggregate.md), [api](concepts/api.md), [backfill](concepts/backfill.md) and 14 more |
| `Control` | interface | yes | [host-in-memory](concepts/host-in-memory.md), [host-rivet](concepts/host-rivet.md) |
| `make` | const | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [02-merged-since-beta-87](02-merged-since-beta-87.md), [03-this-apps-rules-under-verify](03-this-apps-rules-under-verify.md), [04-trial](04-trial.md) and 46 more |
| `InMemory` | const | yes | [02-merged-since-beta-87](02-merged-since-beta-87.md), [04-trial](04-trial.md), [aggregate](concepts/aggregate.md), [backfill](concepts/backfill.md) and 18 more |
| `isAfter` (internal) | const | yes | [host-in-memory](concepts/host-in-memory.md) |
| `mergeCheckpoints` (internal) | const | yes | [host-in-memory](concepts/host-in-memory.md) |

## `InMemoryWorkflows.ts`

| Name | Kind | In beta.87 | Covered in |
| --- | --- | --- | --- |
| `Host` | interface | yes | [alchemy-git](concepts/alchemy-git.md), [backfill](concepts/backfill.md), [cluster](concepts/cluster.md), [cluster-workflows](concepts/cluster-workflows.md) and 13 more |
| `make` | const | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [02-merged-since-beta-87](02-merged-since-beta-87.md), [03-this-apps-rules-under-verify](03-this-apps-rules-under-verify.md), [04-trial](04-trial.md) and 46 more |

## `Kernel.ts`

| Name | Kind | In beta.87 | Covered in |
| --- | --- | --- | --- |
| `Definitions` | interface | yes | [model](concepts/model.md) |
| `InputMeta` (internal) | const | yes | not covered |
| `InputMetaValue` (internal) | interface | yes | not covered |
| `encodeEnvelope` (internal) | const | yes | not covered |
| `decodeEnvelope` (internal) | const | yes | not covered |
| `Kernel` | interface | yes | [aggregate](concepts/aggregate.md), [backfill](concepts/backfill.md), [decision](concepts/decision.md), [event](concepts/event.md) and 8 more |
| `make` | const | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [02-merged-since-beta-87](02-merged-since-beta-87.md), [03-this-apps-rules-under-verify](03-this-apps-rules-under-verify.md), [04-trial](04-trial.md) and 46 more |
| `verify` | const | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [02-merged-since-beta-87](02-merged-since-beta-87.md), [03-this-apps-rules-under-verify](03-this-apps-rules-under-verify.md), [04-trial](04-trial.md) and 24 more |

## `Key.ts`

| Name | Kind | In beta.87 | Covered in |
| --- | --- | --- | --- |
| `Schema` | type | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [04-trial](04-trial.md), [aggregate](concepts/aggregate.md), [ai-and-mcp](concepts/ai-and-mcp.md) and 35 more |
| `Any` | type | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [04-trial](04-trial.md), [aggregate](concepts/aggregate.md), [ai-and-mcp](concepts/ai-and-mcp.md) and 30 more |
| `RefOf` | type | yes | [aggregate](concepts/aggregate.md), [model](concepts/model.md) |
| `IdOf` | type | yes | [aggregate](concepts/aggregate.md), [model](concepts/model.md), [relation](concepts/relation.md) |
| `isAggregate` (internal) | const | yes | [aggregate](concepts/aggregate.md) |
| `refOf` (internal) | const | yes | [aggregate](concepts/aggregate.md) |
| `idSchemaOf` (internal) | const | yes | [aggregate](concepts/aggregate.md) |
| `describe` (internal) | const | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [aggregate](concepts/aggregate.md), [ai-and-mcp](concepts/ai-and-mcp.md), [annotations](concepts/annotations.md) and 10 more |

## `Middleware.ts`

| Name | Kind | In beta.87 | Covered in |
| --- | --- | --- | --- |
| `List` | type | yes | [command](concepts/command.md), [http-api](concepts/http-api.md), [policy](concepts/policy.md), [projection](concepts/projection.md) and 2 more |
| `Provides` | type | yes | [command](concepts/command.md), [sessions](concepts/sessions.md), [story](concepts/story.md) |
| `Errors` | type | yes | [better-auth](concepts/better-auth.md), [cluster-workflows](concepts/cluster-workflows.md), [command](concepts/command.md), [confidence-scores](concepts/confidence-scores.md) and 4 more |
| `Apply` | type | yes | [alchemy-git](concepts/alchemy-git.md), [command](concepts/command.md), [confidence-scores](concepts/confidence-scores.md), [github](concepts/github.md) and 1 more |
| `apply` (internal) | const | yes | [02-merged-since-beta-87](02-merged-since-beta-87.md), [aggregate](concepts/aggregate.md), [api](concepts/api.md), [backfill](concepts/backfill.md) and 15 more |

## `Model.ts`

| Name | Kind | In beta.87 | Covered in |
| --- | --- | --- | --- |
| `Internals` (internal) | class | yes | [api](concepts/api.md), [model](concepts/model.md), [reads-and-consistency](concepts/reads-and-consistency.md) |
| `Members` | interface | yes | [model](concepts/model.md) |
| `Fed` | type | no | [invariants-and-transitions](concepts/invariants-and-transitions.md), [model](concepts/model.md) |
| `Keys` | type | no | [aggregate](concepts/aggregate.md), [alchemy-git](concepts/alchemy-git.md), [graphql](concepts/graphql.md), [invariants-and-transitions](concepts/invariants-and-transitions.md) and 2 more |
| `Instances` | type | no | [01-pr-3260-verify](01-pr-3260-verify.md), [aggregate](concepts/aggregate.md), [decision](concepts/decision.md), [invariants-and-transitions](concepts/invariants-and-transitions.md) and 2 more |
| `ModelClass` | interface | yes | [model](concepts/model.md) |
| `Any` | interface | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [04-trial](04-trial.md), [aggregate](concepts/aggregate.md), [ai-and-mcp](concepts/ai-and-mcp.md) and 30 more |
| `Servable` | interface | yes | [ai-and-mcp](concepts/ai-and-mcp.md), [api](concepts/api.md), [cli](concepts/cli.md), [http-api](concepts/http-api.md) and 1 more |
| `ImplementedOnce` | type | no | [model](concepts/model.md) |
| `ServableBy` | interface | yes | [api](concepts/api.md), [model](concepts/model.md) |
| `LayerOptions` | interface | yes | [model](concepts/model.md), [observability](concepts/observability.md), [query](concepts/query.md), [view](concepts/view.md) |
| `make` | const | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [02-merged-since-beta-87](02-merged-since-beta-87.md), [03-this-apps-rules-under-verify](03-this-apps-rules-under-verify.md), [04-trial](04-trial.md) and 46 more |
| `verify` | const | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [02-merged-since-beta-87](02-merged-since-beta-87.md), [03-this-apps-rules-under-verify](03-this-apps-rules-under-verify.md), [04-trial](04-trial.md) and 24 more |

## `Platform.ts`

| Name | Kind | In beta.87 | Covered in |
| --- | --- | --- | --- |
| `captureContext` | const | yes | [platform-contract](concepts/platform-contract.md) |
| `Json` | type | yes | [platform-contract](concepts/platform-contract.md), [sessions](concepts/sessions.md) |
| `EnvelopeJson` | const | yes | [platform-contract](concepts/platform-contract.md) |
| `StoredEvent` | interface | yes | [platform-contract](concepts/platform-contract.md) |
| `Delivery` | interface | yes | [platform-contract](concepts/platform-contract.md), [policy](concepts/policy.md) |
| `Subscription` | const | yes | [foldkit](concepts/foldkit.md), [platform-contract](concepts/platform-contract.md), [tutorial](concepts/tutorial.md) |
| `Push` | interface | yes | [alchemy-git](concepts/alchemy-git.md), [platform-contract](concepts/platform-contract.md) |
| `HandleInput` | interface | yes | [platform-contract](concepts/platform-contract.md) |
| `HandleResult` | type | yes | [platform-contract](concepts/platform-contract.md) |
| `ReceiptJson` | interface | yes | [platform-contract](concepts/platform-contract.md) |
| `SendResult` | type | yes | [platform-contract](concepts/platform-contract.md) |
| `AggregateKit` | interface | yes | [decision](concepts/decision.md), [platform-contract](concepts/platform-contract.md) |
| `SeedInput` | interface | yes | [platform-contract](concepts/platform-contract.md) |
| `SeedResult` | interface | yes | [platform-contract](concepts/platform-contract.md) |
| `RecordInput` | interface | no | [decision](concepts/decision.md), [platform-contract](concepts/platform-contract.md) |
| `DecisionRead` | interface | no | [decision](concepts/decision.md), [platform-contract](concepts/platform-contract.md) |
| `DecisionState` | interface | no | [decision](concepts/decision.md), [platform-contract](concepts/platform-contract.md) |
| `DecisionWrite` | interface | no | [decision](concepts/decision.md), [platform-contract](concepts/platform-contract.md) |
| `DecisionReceiptJson` | interface | no | [decision](concepts/decision.md), [platform-contract](concepts/platform-contract.md) |
| `DecideInput` | interface | no | [decision](concepts/decision.md), [platform-contract](concepts/platform-contract.md) |
| `DecideResult` | type | no | [decision](concepts/decision.md), [platform-contract](concepts/platform-contract.md) |
| `DecisionResult` | type | no | [decision](concepts/decision.md), [platform-contract](concepts/platform-contract.md) |
| `DecisionKit` | interface | no | [decision](concepts/decision.md), [platform-contract](concepts/platform-contract.md) |
| `DecisionStore` | interface | no | [decision](concepts/decision.md), [platform-contract](concepts/platform-contract.md) |
| `AggregateStore` | interface | yes | [model](concepts/model.md), [platform-contract](concepts/platform-contract.md) |
| `HistoryJson` | interface | yes | [platform-contract](concepts/platform-contract.md) |
| `ViewSnapshot` | interface | yes | [platform-contract](concepts/platform-contract.md) |
| `EmittedRange` | interface | no | [platform-contract](concepts/platform-contract.md) |
| `emptySnapshot` | const | yes | [platform-contract](concepts/platform-contract.md) |
| `ViewEntry` | interface | yes | [platform-contract](concepts/platform-contract.md) |
| `ViewKit` | interface | yes | [platform-contract](concepts/platform-contract.md) |
| `ListRange` | interface | yes | [platform-contract](concepts/platform-contract.md) |
| `inRange` | const | yes | [platform-contract](concepts/platform-contract.md) |
| `ViewStore` | interface | yes | [platform-contract](concepts/platform-contract.md) |
| `PolicyKit` | interface | yes | [platform-contract](concepts/platform-contract.md) |
| `PolicyStore` | interface | yes | [platform-contract](concepts/platform-contract.md) |
| `Accepted` | interface | yes | [aggregate](concepts/aggregate.md), [local-first](concepts/local-first.md), [platform-contract](concepts/platform-contract.md) |
| `ProjectionOptions` | interface | yes | [platform-contract](concepts/platform-contract.md) |
| `ProjectionKit` | interface | yes | [platform-contract](concepts/platform-contract.md) |
| `ProjectionStore` | interface | yes | [platform-contract](concepts/platform-contract.md) |
| `StreamEntry` | interface | yes | [platform-contract](concepts/platform-contract.md) |
| `StreamMeta` | interface | yes | [platform-contract](concepts/platform-contract.md) |
| `emptyStreamMeta` | const | yes | [platform-contract](concepts/platform-contract.md) |
| `StreamWrite` | interface | yes | [platform-contract](concepts/platform-contract.md) |
| `StreamKit` | interface | yes | [platform-contract](concepts/platform-contract.md) |
| `StreamStore` | interface | yes | [platform-contract](concepts/platform-contract.md) |
| `ModelHost` | interface | yes | [platform-contract](concepts/platform-contract.md) |
| `HostedModel` | interface | yes | [platform-contract](concepts/platform-contract.md) |
| `Platform` | class | yes | [02-merged-since-beta-87](02-merged-since-beta-87.md), [alchemy-git](concepts/alchemy-git.md), [cluster](concepts/cluster.md), [cluster-singletons](concepts/cluster-singletons.md) and 11 more |
| `hostedModels` (internal) | const | yes | [host-in-memory](concepts/host-in-memory.md), [platform-contract](concepts/platform-contract.md) |
| `RunWait` (internal) | const | no | [host-in-memory](concepts/host-in-memory.md), [platform-contract](concepts/platform-contract.md), [reads-and-consistency](concepts/reads-and-consistency.md) |
| `runDirectly` (internal) | const | no | [platform-contract](concepts/platform-contract.md) |

## `Policy.ts`

| Name | Kind | In beta.87 | Covered in |
| --- | --- | --- | --- |
| `From` | type | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [cluster-singletons](concepts/cluster-singletons.md), [command](concepts/command.md), [decision](concepts/decision.md) and 10 more |
| `SourcesOf` | type | yes | [policy](concepts/policy.md) |
| `Trigger` | interface | yes | [cluster](concepts/cluster.md), [cluster-singletons](concepts/cluster-singletons.md), [drizzle-durable-objects](concepts/drizzle-durable-objects.md), [model](concepts/model.md) and 1 more |
| `Options` | interface | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [aggregate](concepts/aggregate.md), [api](concepts/api.md), [backfill](concepts/backfill.md) and 14 more |
| `Handler` | type | yes | [policy](concepts/policy.md), [projection](concepts/projection.md), [query](concepts/query.md), [saga](concepts/saga.md) |
| `Any` | interface | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [04-trial](04-trial.md), [aggregate](concepts/aggregate.md), [ai-and-mcp](concepts/ai-and-mcp.md) and 30 more |
| `TriggerOf` | type | yes | [policy](concepts/policy.md) |
| `Definition` | interface | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [aggregate](concepts/aggregate.md), [confidence-scores](concepts/confidence-scores.md), [decision](concepts/decision.md) and 8 more |
| `Identifier` | type | yes | [aggregate](concepts/aggregate.md), [external-system](concepts/external-system.md), [foldkit](concepts/foldkit.md), [graphql](concepts/graphql.md) and 3 more |
| `PolicyKey` | interface | yes | [policy](concepts/policy.md) |
| `make` | const | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [02-merged-since-beta-87](02-merged-since-beta-87.md), [03-this-apps-rules-under-verify](03-this-apps-rules-under-verify.md), [04-trial](04-trial.md) and 46 more |
| `PolicyClass` | interface | yes | [policy](concepts/policy.md) |

## `Projection.ts`

| Name | Kind | In beta.87 | Covered in |
| --- | --- | --- | --- |
| `Input` | interface | yes | [ai-and-mcp](concepts/ai-and-mcp.md), [api](concepts/api.md), [backfill](concepts/backfill.md), [command](concepts/command.md) and 8 more |
| `Handler` | type | yes | [policy](concepts/policy.md), [projection](concepts/projection.md), [query](concepts/query.md), [saga](concepts/saga.md) |
| `Options` | interface | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [aggregate](concepts/aggregate.md), [api](concepts/api.md), [backfill](concepts/backfill.md) and 14 more |
| `Implementation` (internal) | interface | yes | [cluster-workflows](concepts/cluster-workflows.md), [graphql](concepts/graphql.md), [projection](concepts/projection.md), [saga](concepts/saga.md) |
| `Any` | interface | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [04-trial](04-trial.md), [aggregate](concepts/aggregate.md), [ai-and-mcp](concepts/ai-and-mcp.md) and 30 more |
| `InputOf` | type | yes | [model](concepts/model.md), [projection](concepts/projection.md) |
| `Identifier` | type | yes | [aggregate](concepts/aggregate.md), [external-system](concepts/external-system.md), [foldkit](concepts/foldkit.md), [graphql](concepts/graphql.md) and 3 more |
| `ProgressIdentifier` | type | yes | [projection](concepts/projection.md) |
| `Progress` | interface | yes | [backfill](concepts/backfill.md), [model](concepts/model.md), [projection](concepts/projection.md), [reads-and-consistency](concepts/reads-and-consistency.md) |
| `ProjectionKey` | interface | yes | [projection](concepts/projection.md) |
| `ProgressKey` | interface | yes | [projection](concepts/projection.md) |
| `Definition` | interface | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [aggregate](concepts/aggregate.md), [confidence-scores](concepts/confidence-scores.md), [decision](concepts/decision.md) and 8 more |
| `make` | const | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [02-merged-since-beta-87](02-merged-since-beta-87.md), [03-this-apps-rules-under-verify](03-this-apps-rules-under-verify.md), [04-trial](04-trial.md) and 46 more |
| `ProjectionClass` | interface | yes | [projection](concepts/projection.md) |
| `batchMillis` (internal) | const | yes | [projection](concepts/projection.md) |

## `Prove.ts` (new on main)

| Name | Kind | In beta.87 | Covered in |
| --- | --- | --- | --- |
| `Options` | interface | no | [01-pr-3260-verify](01-pr-3260-verify.md), [aggregate](concepts/aggregate.md), [api](concepts/api.md), [backfill](concepts/backfill.md) and 14 more |
| `DecisionOptions` | interface | no | [prove](concepts/prove.md) |
| `DecisionNotProved` | class | no | [01-pr-3260-verify](01-pr-3260-verify.md), [prove](concepts/prove.md) |
| `DecisionReport` | interface | no | [prove](concepts/prove.md) |
| `ProveError` | class | no | [01-pr-3260-verify](01-pr-3260-verify.md), [invariants-and-transitions](concepts/invariants-and-transitions.md), [prove](concepts/prove.md) |
| `InvariantsNotProved` | class | no | [01-pr-3260-verify](01-pr-3260-verify.md), [invariants-and-transitions](concepts/invariants-and-transitions.md), [prove](concepts/prove.md) |
| `Report` | interface | no | [01-pr-3260-verify](01-pr-3260-verify.md), [explore](concepts/explore.md), [prove](concepts/prove.md), [tutorial](concepts/tutorial.md) and 1 more |
| `ATOMIC` | const | no | [01-pr-3260-verify](01-pr-3260-verify.md), [prove](concepts/prove.md) |
| `report` | const | no | [01-pr-3260-verify](01-pr-3260-verify.md), [02-merged-since-beta-87](02-merged-since-beta-87.md), [03-this-apps-rules-under-verify](03-this-apps-rules-under-verify.md), [04-trial](04-trial.md) and 19 more |
| `proved` | const | no | [01-pr-3260-verify](01-pr-3260-verify.md), [02-merged-since-beta-87](02-merged-since-beta-87.md), [03-this-apps-rules-under-verify](03-this-apps-rules-under-verify.md), [04-trial](04-trial.md) and 18 more |
| `invariants` | const | no | [01-pr-3260-verify](01-pr-3260-verify.md), [02-merged-since-beta-87](02-merged-since-beta-87.md), [03-this-apps-rules-under-verify](03-this-apps-rules-under-verify.md), [04-trial](04-trial.md) and 12 more |
| `render` | const | no | [01-pr-3260-verify](01-pr-3260-verify.md), [04-trial](04-trial.md), [explore](concepts/explore.md), [prove](concepts/prove.md) and 1 more |
| `decisionReport` | const | no | [01-pr-3260-verify](01-pr-3260-verify.md), [prove](concepts/prove.md) |
| `decisionProved` | const | no | [01-pr-3260-verify](01-pr-3260-verify.md), [prove](concepts/prove.md) |
| `decision` | const | no | [01-pr-3260-verify](01-pr-3260-verify.md), [02-merged-since-beta-87](02-merged-since-beta-87.md), [03-this-apps-rules-under-verify](03-this-apps-rules-under-verify.md), [aggregate](concepts/aggregate.md) and 42 more |
| `renderDecision` | const | no | [01-pr-3260-verify](01-pr-3260-verify.md), [prove](concepts/prove.md) |

## `Prove/internal/Check.ts` (new on main)

| Name | Kind | In beta.87 | Covered in |
| --- | --- | --- | --- |
| `Counterexample` (internal) | interface | no | [prove](concepts/prove.md) |
| `Verdict` (internal) | type | no | [01-pr-3260-verify](01-pr-3260-verify.md), [aggregate](concepts/aggregate.md), [ai-and-mcp](concepts/ai-and-mcp.md), [alchemy-git](concepts/alchemy-git.md) and 51 more |
| `Model` (internal) | type | no | [01-pr-3260-verify](01-pr-3260-verify.md), [02-merged-since-beta-87](02-merged-since-beta-87.md), [04-trial](04-trial.md), [aggregate](concepts/aggregate.md) and 31 more |
| `solve` (internal) | const | no | [prove](concepts/prove.md) |
| `Moved` (internal) | interface | no | [prove](concepts/prove.md) |
| `Kept` (internal) | interface | no | [prove](concepts/prove.md) |
| `Build` (internal) | type | no | [02-merged-since-beta-87](02-merged-since-beta-87.md), [aggregate](concepts/aggregate.md), [api](concepts/api.md), [cluster](concepts/cluster.md) and 11 more |
| `Keeping` (internal) | type | no | [distilled-clients](concepts/distilled-clients.md), [prove](concepts/prove.md), [unique-values](concepts/unique-values.md) |
| `notConfirmed` (internal) | const | no | [prove](concepts/prove.md) |
| `rules` (internal) | const | no | [01-pr-3260-verify](01-pr-3260-verify.md), [02-merged-since-beta-87](02-merged-since-beta-87.md), [03-this-apps-rules-under-verify](03-this-apps-rules-under-verify.md), [04-trial](04-trial.md) and 34 more |
| `invariant` (internal) | const | no | [01-pr-3260-verify](01-pr-3260-verify.md), [03-this-apps-rules-under-verify](03-this-apps-rules-under-verify.md), [aggregate](concepts/aggregate.md), [decision](concepts/decision.md) and 10 more |
| `schema` (internal) | const | no | [01-pr-3260-verify](01-pr-3260-verify.md), [04-trial](04-trial.md), [aggregate](concepts/aggregate.md), [alchemy-git](concepts/alchemy-git.md) and 29 more |
| `check` (internal) | const | no | [01-pr-3260-verify](01-pr-3260-verify.md), [02-merged-since-beta-87](02-merged-since-beta-87.md), [04-trial](04-trial.md), [aggregate](concepts/aggregate.md) and 53 more |
| `checkAt` (internal) | const | no | [prove](concepts/prove.md) |
| `DecisionMoved` (internal) | interface | no | [prove](concepts/prove.md) |
| `DecisionKept` (internal) | interface | no | [prove](concepts/prove.md) |
| `onInstance` (internal) | const | no | [prove](concepts/prove.md) |
| `schemas` (internal) | const | no | [01-pr-3260-verify](01-pr-3260-verify.md), [ai-and-mcp](concepts/ai-and-mcp.md), [annotations](concepts/annotations.md), [cluster-workflows](concepts/cluster-workflows.md) and 9 more |
| `transition` (internal) | const | no | [01-pr-3260-verify](01-pr-3260-verify.md), [02-merged-since-beta-87](02-merged-since-beta-87.md), [03-this-apps-rules-under-verify](03-this-apps-rules-under-verify.md), [aggregate](concepts/aggregate.md) and 7 more |
| `checkDecision` (internal) | const | no | [prove](concepts/prove.md) |

## `Prove/internal/Decide.ts` (new on main)

| Name | Kind | In beta.87 | Covered in |
| --- | --- | --- | --- |
| `Wrote` (internal) | interface | no | [prove](concepts/prove.md) |
| `Ran` (internal) | type | no | [prove](concepts/prove.md) |
| `States` (internal) | type | no | [invariants-and-transitions](concepts/invariants-and-transitions.md), [prove](concepts/prove.md) |
| `run` (internal) | const | no | [01-pr-3260-verify](01-pr-3260-verify.md), [02-merged-since-beta-87](02-merged-since-beta-87.md), [03-this-apps-rules-under-verify](03-this-apps-rules-under-verify.md), [04-trial](04-trial.md) and 54 more |
| `byName` (internal) | const | no | [prove](concepts/prove.md) |

## `Prove/internal/Induction.ts` (new on main)

| Name | Kind | In beta.87 | Covered in |
| --- | --- | --- | --- |
| `Row` (internal) | interface | no | [prove](concepts/prove.md) |
| `unkept` (internal) | const | no | [explore](concepts/explore.md), [prove](concepts/prove.md) |
| `closed` (internal) | const | no | [01-pr-3260-verify](01-pr-3260-verify.md), [03-this-apps-rules-under-verify](03-this-apps-rules-under-verify.md), [alchemy-git](concepts/alchemy-git.md), [api](concepts/api.md) and 17 more |
| `within` (internal) | const | no | [01-pr-3260-verify](01-pr-3260-verify.md), [04-trial](04-trial.md), [ai-and-mcp](concepts/ai-and-mcp.md), [cluster](concepts/cluster.md) and 11 more |
| `worse` (internal) | const | no | [prove](concepts/prove.md) |
| `notRead` (internal) | const | no | [prove](concepts/prove.md) |
| `MAX_PATHS` (internal) | const | no | [prove](concepts/prove.md) |
| `rows` (internal) | const | no | [01-pr-3260-verify](01-pr-3260-verify.md), [02-merged-since-beta-87](02-merged-since-beta-87.md), [03-this-apps-rules-under-verify](03-this-apps-rules-under-verify.md), [04-trial](04-trial.md) and 41 more |
| `DecisionImpl` (internal) | interface | no | [prove](concepts/prove.md) |
| `ruleOf` (internal) | const | no | [prove](concepts/prove.md) |
| `DecisionRow` (internal) | interface | no | [prove](concepts/prove.md) |
| `reader` (internal) | const | no | [02-merged-since-beta-87](02-merged-since-beta-87.md), [backfill](concepts/backfill.md), [platform-contract](concepts/platform-contract.md), [prove](concepts/prove.md) and 1 more |
| `decisionRow` (internal) | const | no | [prove](concepts/prove.md) |
| `locate` (internal) | const | no | [confidence-scores](concepts/confidence-scores.md), [explore](concepts/explore.md), [prove](concepts/prove.md) |

## `Prove/internal/Interpreter.ts` (new on main)

| Name | Kind | In beta.87 | Covered in |
| --- | --- | --- | --- |
| `Interpreter` (internal) | interface | no | [01-pr-3260-verify](01-pr-3260-verify.md), [event](concepts/event.md), [prove](concepts/prove.md), [rejection](concepts/rejection.md) |
| `Hooks` (internal) | interface | no | [prove](concepts/prove.md), [test-tooling](concepts/test-tooling.md) |
| `make` (internal) | const | no | [01-pr-3260-verify](01-pr-3260-verify.md), [02-merged-since-beta-87](02-merged-since-beta-87.md), [03-this-apps-rules-under-verify](03-this-apps-rules-under-verify.md), [04-trial](04-trial.md) and 46 more |

## `Prove/internal/Library.ts` (new on main)

| Name | Kind | In beta.87 | Covered in |
| --- | --- | --- | --- |
| `Host` (internal) | interface | no | [alchemy-git](concepts/alchemy-git.md), [backfill](concepts/backfill.md), [cluster](concepts/cluster.md), [cluster-workflows](concepts/cluster-workflows.md) and 13 more |
| `Model` (internal) | type | no | [01-pr-3260-verify](01-pr-3260-verify.md), [02-merged-since-beta-87](02-merged-since-beta-87.md), [04-trial](04-trial.md), [aggregate](concepts/aggregate.md) and 31 more |
| `make` (internal) | const | no | [01-pr-3260-verify](01-pr-3260-verify.md), [02-merged-since-beta-87](02-merged-since-beta-87.md), [03-this-apps-rules-under-verify](03-this-apps-rules-under-verify.md), [04-trial](04-trial.md) and 46 more |
| `numeric` (internal) | const | no | [better-auth](concepts/better-auth.md), [discord-sign-in](concepts/discord-sign-in.md), [distilled-clients](concepts/distilled-clients.md), [prove](concepts/prove.md) |
| `promote` (internal) | const | no | [prove](concepts/prove.md) |

## `Prove/internal/Paths.ts` (new on main)

| Name | Kind | In beta.87 | Covered in |
| --- | --- | --- | --- |
| `CommandClass` (internal) | interface | no | [command](concepts/command.md), [prove](concepts/prove.md) |
| `Definition` (internal) | interface | no | [01-pr-3260-verify](01-pr-3260-verify.md), [aggregate](concepts/aggregate.md), [confidence-scores](concepts/confidence-scores.md), [decision](concepts/decision.md) and 8 more |
| `Inputs` (internal) | interface | no | [host-cloudflare](concepts/host-cloudflare.md), [projection](concepts/projection.md), [prove](concepts/prove.md) |
| `Outcome` (internal) | type | no | [cli](concepts/cli.md), [confidence-scores](concepts/confidence-scores.md), [decision](concepts/decision.md), [explore](concepts/explore.md) and 2 more |
| `Path` (internal) | interface | no | [explore](concepts/explore.md), [host-cloudflare](concepts/host-cloudflare.md), [prove](concepts/prove.md), [tutorial](concepts/tutorial.md) and 1 more |
| `handlers` (internal) | const | no | [aggregate](concepts/aggregate.md), [ai-and-mcp](concepts/ai-and-mcp.md), [alchemy-git](concepts/alchemy-git.md), [api](concepts/api.md) and 21 more |
| `addressOf` (internal) | const | no | [prove](concepts/prove.md), [resend](concepts/resend.md) |
| `keyOf` (internal) | const | no | [02-merged-since-beta-87](02-merged-since-beta-87.md), [04-trial](04-trial.md), [aggregate](concepts/aggregate.md), [better-auth](concepts/better-auth.md) and 21 more |
| `Applied` (internal) | type | no | [prove](concepts/prove.md) |
| `Step` (internal) | interface | no | [explore](concepts/explore.md), [prove](concepts/prove.md), [story](concepts/story.md) |
| `step` (internal) | const | no | [01-pr-3260-verify](01-pr-3260-verify.md), [02-merged-since-beta-87](02-merged-since-beta-87.md), [03-this-apps-rules-under-verify](03-this-apps-rules-under-verify.md), [04-trial](04-trial.md) and 40 more |
| `DecisionDefinition` (internal) | interface | no | [prove](concepts/prove.md) |
| `Slot` (internal) | interface | no | [prove](concepts/prove.md) |
| `Part` (internal) | interface | no | [alchemy-git](concepts/alchemy-git.md), [cloudflare-tutorial](concepts/cloudflare-tutorial.md), [decision](concepts/decision.md), [prove](concepts/prove.md) and 2 more |
| `Decided` (internal) | type | no | [model](concepts/model.md), [prove](concepts/prove.md) |
| `DecisionStep` (internal) | interface | no | [prove](concepts/prove.md) |
| `decided` (internal) | const | no | [02-merged-since-beta-87](02-merged-since-beta-87.md), [aggregate](concepts/aggregate.md), [cli](concepts/cli.md), [command](concepts/command.md) and 13 more |
| `decisionChecks` (internal) | const | no | [prove](concepts/prove.md) |
| `decisionRuleNames` (internal) | const | no | [prove](concepts/prove.md) |
| `relationNames` (internal) | const | no | [prove](concepts/prove.md) |
| `relationHolds` (internal) | const | no | [prove](concepts/prove.md) |
| `assumed` (internal) | const | no | [01-pr-3260-verify](01-pr-3260-verify.md), [03-this-apps-rules-under-verify](03-this-apps-rules-under-verify.md), [api](concepts/api.md), [invariants-and-transitions](concepts/invariants-and-transitions.md) and 3 more |
| `reach` (internal) | const | no | [01-pr-3260-verify](01-pr-3260-verify.md), [02-merged-since-beta-87](02-merged-since-beta-87.md), [aggregate](concepts/aggregate.md), [ai-and-mcp](concepts/ai-and-mcp.md) and 52 more |
| `aggregateIn` (internal) | const | no | [prove](concepts/prove.md) |
| `decisionIn` (internal) | const | no | [prove](concepts/prove.md) |
| `Check` (internal) | interface | no | [01-pr-3260-verify](01-pr-3260-verify.md), [alchemy-git](concepts/alchemy-git.md), [github](concepts/github.md), [host-in-memory](concepts/host-in-memory.md) and 3 more |
| `Taken` (internal) | interface | no | [github](concepts/github.md), [prove](concepts/prove.md) |
| `checks` (internal) | const | no | [01-pr-3260-verify](01-pr-3260-verify.md), [02-merged-since-beta-87](02-merged-since-beta-87.md), [aggregate](concepts/aggregate.md), [ai-and-mcp](concepts/ai-and-mcp.md) and 32 more |
| `path` (internal) | const | no | [02-merged-since-beta-87](02-merged-since-beta-87.md), [04-trial](04-trial.md), [aggregate](concepts/aggregate.md), [ai-and-mcp](concepts/ai-and-mcp.md) and 28 more |
| `at` (internal) | const | no | [01-pr-3260-verify](01-pr-3260-verify.md), [02-merged-since-beta-87](02-merged-since-beta-87.md), [03-this-apps-rules-under-verify](03-this-apps-rules-under-verify.md), [04-trial](04-trial.md) and 54 more |
| `same` (internal) | const | no | [01-pr-3260-verify](01-pr-3260-verify.md), [02-merged-since-beta-87](02-merged-since-beta-87.md), [03-this-apps-rules-under-verify](03-this-apps-rules-under-verify.md), [04-trial](04-trial.md) and 54 more |
| `namesOf` (internal) | const | no | [prove](concepts/prove.md) |
| `invariantNames` (internal) | const | no | [prove](concepts/prove.md) |
| `transitionNames` (internal) | const | no | [prove](concepts/prove.md) |
| `ruleNames` (internal) | const | no | [prove](concepts/prove.md) |
| `unread` (internal) | const | no | [01-pr-3260-verify](01-pr-3260-verify.md), [explore](concepts/explore.md), [invariants-and-transitions](concepts/invariants-and-transitions.md), [prove](concepts/prove.md) and 2 more |
| `find` (internal) | const | no | [01-pr-3260-verify](01-pr-3260-verify.md), [explore](concepts/explore.md), [model](concepts/model.md), [observability](concepts/observability.md) and 3 more |
| `load` (internal) | const | no | [01-pr-3260-verify](01-pr-3260-verify.md), [backfill](concepts/backfill.md), [cluster](concepts/cluster.md), [distilled-clients](concepts/distilled-clients.md) and 9 more |

## `Prove/internal/Relations.ts` (new on main)

| Name | Kind | In beta.87 | Covered in |
| --- | --- | --- | --- |
| `Over` (internal) | interface | no | [api](concepts/api.md), [decision](concepts/decision.md), [host-effect-cluster](concepts/host-effect-cluster.md), [prove](concepts/prove.md) and 4 more |
| `Relation` (internal) | interface | no | [01-pr-3260-verify](01-pr-3260-verify.md), [02-merged-since-beta-87](02-merged-since-beta-87.md), [04-trial](04-trial.md), [annotations](concepts/annotations.md) and 7 more |
| `Real` (internal) | interface | no | [prove](concepts/prove.md) |
| `Subject` (internal) | interface | no | [prove](concepts/prove.md) |
| `Row` (internal) | interface | no | [prove](concepts/prove.md) |
| `rows` (internal) | const | no | [01-pr-3260-verify](01-pr-3260-verify.md), [02-merged-since-beta-87](02-merged-since-beta-87.md), [03-this-apps-rules-under-verify](03-this-apps-rules-under-verify.md), [04-trial](04-trial.md) and 41 more |

## `Prove/internal/Smt.ts` (new on main)

| Name | Kind | In beta.87 | Covered in |
| --- | --- | --- | --- |
| `Sort` (internal) | type | no | [prove](concepts/prove.md) |
| `Term` (internal) | interface | no | [prove](concepts/prove.md) |
| `symbol` (internal) | const | no | [cluster-singletons](concepts/cluster-singletons.md), [prove](concepts/prove.md) |
| `int` (internal) | const | no | [prove](concepts/prove.md) |
| `big` (internal) | const | no | [distilled-clients](concepts/distilled-clients.md), [prove](concepts/prove.md) |
| `real` (internal) | const | no | [01-pr-3260-verify](01-pr-3260-verify.md), [02-merged-since-beta-87](02-merged-since-beta-87.md), [03-this-apps-rules-under-verify](03-this-apps-rules-under-verify.md), [04-trial](04-trial.md) and 25 more |
| `string` (internal) | const | no | [01-pr-3260-verify](01-pr-3260-verify.md), [02-merged-since-beta-87](02-merged-since-beta-87.md), [03-this-apps-rules-under-verify](03-this-apps-rules-under-verify.md), [04-trial](04-trial.md) and 38 more |
| `bool` (internal) | const | no | [prove](concepts/prove.md) |
| `not` (internal) | const | no | [01-pr-3260-verify](01-pr-3260-verify.md), [02-merged-since-beta-87](02-merged-since-beta-87.md), [03-this-apps-rules-under-verify](03-this-apps-rules-under-verify.md), [04-trial](04-trial.md) and 54 more |
| `SolverError` (internal) | class | no | [prove](concepts/prove.md) |
| `Sexp` (internal) | type | no | [prove](concepts/prove.md) |
| `parse` (internal) | const | no | [cli](concepts/cli.md), [cluster-singletons](concepts/cluster-singletons.md), [prove](concepts/prove.md) |
| `valueOf` (internal) | const | no | [prove](concepts/prove.md) |
| `Query` (internal) | interface | no | [02-merged-since-beta-87](02-merged-since-beta-87.md), [annotations](concepts/annotations.md), [api](concepts/api.md), [graphql](concepts/graphql.md) and 11 more |
| `Answer` (internal) | type | no | [ai-and-mcp](concepts/ai-and-mcp.md), [confidence-scores](concepts/confidence-scores.md), [external-system](concepts/external-system.md), [host-in-memory](concepts/host-in-memory.md) and 4 more |
| `Solver` (internal) | interface | no | [prove](concepts/prove.md) |
| `solver` (internal) | const | no | [01-pr-3260-verify](01-pr-3260-verify.md), [02-merged-since-beta-87](02-merged-since-beta-87.md), [04-trial](04-trial.md), [aggregate](concepts/aggregate.md) and 8 more |

## `Prove/internal/Source.ts` (new on main)

| Name | Kind | In beta.87 | Covered in |
| --- | --- | --- | --- |
| `LoadError` (internal) | class | no | [prove](concepts/prove.md) |
| `Loader` (internal) | interface | no | [prove](concepts/prove.md) |
| `loader` (internal) | const | no | [01-pr-3260-verify](01-pr-3260-verify.md), [prove](concepts/prove.md) |

## `Prove/internal/Symbolic.ts` (new on main)

| Name | Kind | In beta.87 | Covered in |
| --- | --- | --- | --- |
| `Unread` (internal) | interface | no | [prove](concepts/prove.md) |
| `unread` (internal) | const | no | [01-pr-3260-verify](01-pr-3260-verify.md), [explore](concepts/explore.md), [invariants-and-transitions](concepts/invariants-and-transitions.md), [prove](concepts/prove.md) and 2 more |
| `MAX_ITEMS` (internal) | const | no | [prove](concepts/prove.md) |
| `force` (internal) | const | no | [alchemy-git](concepts/alchemy-git.md), [github](concepts/github.md), [host-in-memory](concepts/host-in-memory.md), [prove](concepts/prove.md) and 1 more |
| `typeOf` (internal) | const | no | [prove](concepts/prove.md) |
| `symbolic` (internal) | const | no | [prove](concepts/prove.md) |
| `assumeFits` (internal) | const | no | [prove](concepts/prove.md) |
| `fits` (internal) | const | no | [better-auth](concepts/better-auth.md), [cluster-workflows](concepts/cluster-workflows.md), [confidence-scores](concepts/confidence-scores.md), [deadlines](concepts/deadlines.md) and 5 more |
| `Unbuildable` (internal) | interface | no | [prove](concepts/prove.md) |
| `concretize` (internal) | const | no | [prove](concepts/prove.md) |
| `show` (internal) | const | no | [02-merged-since-beta-87](02-merged-since-beta-87.md), [aggregate](concepts/aggregate.md), [alchemy-git](concepts/alchemy-git.md), [annotations](concepts/annotations.md) and 13 more |

## `Prove/internal/Value.ts` (new on main)

| Name | Kind | In beta.87 | Covered in |
| --- | --- | --- | --- |
| `Node` (internal) | interface | no | [01-pr-3260-verify](01-pr-3260-verify.md), [04-trial](04-trial.md), [aggregate](concepts/aggregate.md), [cloudflare-tutorial](concepts/cloudflare-tutorial.md) and 18 more |
| `Module` (internal) | interface | no | [01-pr-3260-verify](01-pr-3260-verify.md), [host-cloudflare](concepts/host-cloudflare.md), [prove](concepts/prove.md) |
| `Declaration` (internal) | type | no | [annotations](concepts/annotations.md), [prove](concepts/prove.md) |
| `Import` (internal) | interface | no | [04-trial](04-trial.md), [aggregate](concepts/aggregate.md), [alchemy-git](concepts/alchemy-git.md), [annotations](concepts/annotations.md) and 34 more |
| `Scope` (internal) | interface | no | [ai-and-mcp](concepts/ai-and-mcp.md), [api](concepts/api.md), [cli](concepts/cli.md), [cluster](concepts/cluster.md) and 6 more |
| `Env` (internal) | interface | no | [02-merged-since-beta-87](02-merged-since-beta-87.md), [cluster-singletons](concepts/cluster-singletons.md), [distilled-clients](concepts/distilled-clients.md), [github](concepts/github.md) and 1 more |
| `Brand` (internal) | interface | no | [prove](concepts/prove.md), [view](concepts/view.md) |
| `OpticStep` (internal) | type | no | [prove](concepts/prove.md) |
| `V` (internal) | type | no | [api](concepts/api.md), [foldkit](concepts/foldkit.md), [host-cloudflare](concepts/host-cloudflare.md), [invariants-and-transitions](concepts/invariants-and-transitions.md) and 3 more |
| `num` (internal) | const | no | [prove](concepts/prove.md) |
| `str` (internal) | const | no | [prove](concepts/prove.md) |
| `bool` (internal) | const | no | [prove](concepts/prove.md) |
| `nil` (internal) | const | no | [prove](concepts/prove.md) |
| `undef` (internal) | const | no | [prove](concepts/prove.md) |
| `term` (internal) | const | no | [prove](concepts/prove.md) |
| `obj` (internal) | const | no | [prove](concepts/prove.md) |
| `none` (internal) | const | no | [02-merged-since-beta-87](02-merged-since-beta-87.md), [03-this-apps-rules-under-verify](03-this-apps-rules-under-verify.md), [04-trial](04-trial.md), [aggregate](concepts/aggregate.md) and 34 more |
| `some` (internal) | const | no | [02-merged-since-beta-87](02-merged-since-beta-87.md), [cluster](concepts/cluster.md), [distilled-clients](concepts/distilled-clients.md), [host-in-memory](concepts/host-in-memory.md) and 9 more |
| `optionOf` (internal) | const | no | [prove](concepts/prove.md) |
| `isBig` (internal) | const | no | [prove](concepts/prove.md) |
| `Site` (internal) | interface | no | [prove](concepts/prove.md) |
| `Rejected` (internal) | class | no | [aggregate](concepts/aggregate.md), [command](concepts/command.md), [foldkit](concepts/foldkit.md), [local-first](concepts/local-first.md) and 5 more |
| `NotTranslated` (internal) | class | no | [01-pr-3260-verify](01-pr-3260-verify.md), [prove](concepts/prove.md), [verify](concepts/verify.md) |
| `Infeasible` (internal) | class | no | [prove](concepts/prove.md) |
| `Stop` (internal) | type | no | [cluster-workflows](concepts/cluster-workflows.md), [prove](concepts/prove.md), [saga](concepts/saga.md) |
| `Eval` (internal) | type | no | [prove](concepts/prove.md) |
| `lineOf` (internal) | const | no | [decision](concepts/decision.md), [prove](concepts/prove.md) |
| `notTranslated` (internal) | const | no | [prove](concepts/prove.md) |
| `Application` (internal) | interface | no | [platform-contract](concepts/platform-contract.md), [prove](concepts/prove.md) |
| `Run` (internal) | class | no | [01-pr-3260-verify](01-pr-3260-verify.md), [04-trial](04-trial.md), [cli](concepts/cli.md), [cluster-singletons](concepts/cluster-singletons.md) and 13 more |
| `nextPrefix` (internal) | const | no | [prove](concepts/prove.md) |

## `Query.ts`

| Name | Kind | In beta.87 | Covered in |
| --- | --- | --- | --- |
| `AtLeast` | interface | yes | [query](concepts/query.md), [reads-and-consistency](concepts/reads-and-consistency.md) |
| `AtLeastJson` (internal) | const | no | [http-api](concepts/http-api.md), [query](concepts/query.md), [stream](concepts/stream.md), [view](concepts/view.md) and 1 more |
| `AtLeastInput` | type | yes | [api](concepts/api.md) |
| `receiptsOf` (internal) | const | yes | [api](concepts/api.md), [query](concepts/query.md) |
| `PageRequest` | interface | yes | [model](concepts/model.md), [query](concepts/query.md) |
| `Page` | interface | yes | [model](concepts/model.md), [query](concepts/query.md), [view](concepts/view.md) |
| `Take` | interface | yes | [cluster](concepts/cluster.md), [cluster-singletons](concepts/cluster-singletons.md), [query](concepts/query.md), [story](concepts/story.md) and 1 more |
| `ResultType` | type | yes | [query](concepts/query.md) |
| `PageOf` | type | yes | [query](concepts/query.md) |
| `Handler` | type | yes | [policy](concepts/policy.md), [projection](concepts/projection.md), [query](concepts/query.md), [saga](concepts/saga.md) |
| `LayerOptions` | interface | yes | [model](concepts/model.md), [observability](concepts/observability.md), [query](concepts/query.md), [view](concepts/view.md) |
| `Implementation` (internal) | interface | yes | [cluster-workflows](concepts/cluster-workflows.md), [graphql](concepts/graphql.md), [projection](concepts/projection.md), [saga](concepts/saga.md) |
| `AnyDefinition` (internal) | interface | yes | [aggregate](concepts/aggregate.md), [decision](concepts/decision.md), [invariants-and-transitions](concepts/invariants-and-transitions.md) |
| `Any` | interface | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [04-trial](04-trial.md), [aggregate](concepts/aggregate.md), [ai-and-mcp](concepts/ai-and-mcp.md) and 30 more |
| `Identifier` | type | yes | [aggregate](concepts/aggregate.md), [external-system](concepts/external-system.md), [foldkit](concepts/foldkit.md), [graphql](concepts/graphql.md) and 3 more |
| `InputOf` | type | yes | [model](concepts/model.md), [projection](concepts/projection.md) |
| `ResultOf` | type | yes | [model](concepts/model.md) |
| `FailureOf` | type | yes | [query](concepts/query.md) |
| `QueryKey` | interface | yes | [query](concepts/query.md) |
| `Definition` | interface | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [aggregate](concepts/aggregate.md), [confidence-scores](concepts/confidence-scores.md), [decision](concepts/decision.md) and 8 more |
| `make` | const | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [02-merged-since-beta-87](02-merged-since-beta-87.md), [03-this-apps-rules-under-verify](03-this-apps-rules-under-verify.md), [04-trial](04-trial.md) and 46 more |
| `QueryClass` | interface | yes | [query](concepts/query.md) |
| `RunOptions` (internal) | interface | yes | [test-tooling](concepts/test-tooling.md) |
| `CaughtUp` (internal) | type | yes | [api](concepts/api.md), [foldkit](concepts/foldkit.md), [http-api](concepts/http-api.md), [local-first](concepts/local-first.md) and 5 more |
| `Waitable` | type | yes | [query](concepts/query.md) |
| `Host` (internal) | interface | yes | [alchemy-git](concepts/alchemy-git.md), [backfill](concepts/backfill.md), [cluster](concepts/cluster.md), [cluster-workflows](concepts/cluster-workflows.md) and 13 more |
| `host` (internal) | const | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [02-merged-since-beta-87](02-merged-since-beta-87.md), [03-this-apps-rules-under-verify](03-this-apps-rules-under-verify.md), [04-trial](04-trial.md) and 54 more |

## `Read.ts`

| Name | Kind | In beta.87 | Covered in |
| --- | --- | --- | --- |
| `Mode` | type | yes | [test-tooling](concepts/test-tooling.md), [view-security](concepts/view-security.md) |
| `Snapshot` | interface | yes | [foldkit](concepts/foldkit.md), [reads-and-consistency](concepts/reads-and-consistency.md) |
| `CaughtUp` | const | yes | [api](concepts/api.md), [foldkit](concepts/foldkit.md), [http-api](concepts/http-api.md), [local-first](concepts/local-first.md) and 5 more |
| `isCaughtUp` | const | yes | [reads-and-consistency](concepts/reads-and-consistency.md) |
| `isEvent` | const | yes | [local-first](concepts/local-first.md), [reads-and-consistency](concepts/reads-and-consistency.md) |
| `Request` | interface | yes | [prove](concepts/prove.md), [view-security](concepts/view-security.md) |
| `Contract` | interface | yes | [platform-contract](concepts/platform-contract.md), [view-security](concepts/view-security.md) |
| `AnyContract` (internal) | interface | yes | not covered |
| `Validate` | type | yes | [view-security](concepts/view-security.md) |
| `Implementation` (internal) | interface | yes | [cluster-workflows](concepts/cluster-workflows.md), [graphql](concepts/graphql.md), [projection](concepts/projection.md), [saga](concepts/saga.md) |
| `ValidatorKey` | interface | yes | [view-security](concepts/view-security.md) |
| `MiddlewareOf` | type | yes | [view-security](concepts/view-security.md) |
| `RejectsOf` | type | yes | [view-security](concepts/view-security.md) |
| `AnyValidate` (internal) | type | yes | not covered |
| `Guarded` | type | yes | [platform-contract](concepts/platform-contract.md), [view-security](concepts/view-security.md) |
| `isGuarded` (internal) | const | yes | [view-security](concepts/view-security.md) |

## `ReadRpcs.ts`

| Name | Kind | In beta.87 | Covered in |
| --- | --- | --- | --- |
| `Readable` | type | yes | [stream](concepts/stream.md) |
| `nameOf` | const | yes | [stream](concepts/stream.md) |
| `union` | const | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [02-merged-since-beta-87](02-merged-since-beta-87.md), [aggregate](concepts/aggregate.md), [api](concepts/api.md) and 15 more |
| `outputEvents` | const | yes | [stream](concepts/stream.md) |
| `ReadRpcs` | interface | yes | [ai-and-mcp](concepts/ai-and-mcp.md), [annotations](concepts/annotations.md), [api](concepts/api.md), [cli](concepts/cli.md) and 7 more |
| `contractOf` | const | yes | [stream](concepts/stream.md) |
| `readRpcs` | const | yes | [stream](concepts/stream.md) |
| `Operation` | interface | yes | [external-system](concepts/external-system.md), [graphql](concepts/graphql.md), [http-api](concepts/http-api.md) |
| `operationsOf` | const | yes | [http-api](concepts/http-api.md), [reads-and-consistency](concepts/reads-and-consistency.md) |
| `CallName` | type | yes | [http-api](concepts/http-api.md), [stream](concepts/stream.md) |
| `OnceCallName` | type | yes | [ai-and-mcp](concepts/ai-and-mcp.md), [cli](concepts/cli.md) |
| `ClientOf` | type | yes | [api](concepts/api.md), [foldkit](concepts/foldkit.md), [model](concepts/model.md) |
| `isMethod` | const | yes | [stream](concepts/stream.md) |
| `callName` | const | yes | [stream](concepts/stream.md) |
| `exposedOf` | const | yes | [http-api](concepts/http-api.md), [reads-and-consistency](concepts/reads-and-consistency.md) |
| `outsideClient` | const | yes | [api](concepts/api.md), [http-api](concepts/http-api.md), [reads-and-consistency](concepts/reads-and-consistency.md) |

## `Rejection.ts`

| Name | Kind | In beta.87 | Covered in |
| --- | --- | --- | --- |
| `Instance` | type | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [cluster-workflows](concepts/cluster-workflows.md), [command](concepts/command.md), [event](concepts/event.md) and 5 more |
| `Any` | interface | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [04-trial](04-trial.md), [aggregate](concepts/aggregate.md), [ai-and-mcp](concepts/ai-and-mcp.md) and 30 more |
| `Annotations` | type | yes | [aggregate](concepts/aggregate.md), [annotations](concepts/annotations.md), [command](concepts/command.md), [event](concepts/event.md) and 3 more |
| `make` | const | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [02-merged-since-beta-87](02-merged-since-beta-87.md), [03-this-apps-rules-under-verify](03-this-apps-rules-under-verify.md), [04-trial](04-trial.md) and 46 more |
| `RejectionClass` | interface | yes | [rejection](concepts/rejection.md) |

## `Relation.ts` (new on main)

| Name | Kind | In beta.87 | Covered in |
| --- | --- | --- | --- |
| `Instance` | interface | no | [01-pr-3260-verify](01-pr-3260-verify.md), [cluster-workflows](concepts/cluster-workflows.md), [command](concepts/command.md), [event](concepts/event.md) and 5 more |
| `Instances` | type | no | [01-pr-3260-verify](01-pr-3260-verify.md), [aggregate](concepts/aggregate.md), [decision](concepts/decision.md), [invariants-and-transitions](concepts/invariants-and-transitions.md) and 2 more |
| `Definition` | interface | no | [01-pr-3260-verify](01-pr-3260-verify.md), [aggregate](concepts/aggregate.md), [confidence-scores](concepts/confidence-scores.md), [decision](concepts/decision.md) and 8 more |
| `Relation` | interface | no | [01-pr-3260-verify](01-pr-3260-verify.md), [02-merged-since-beta-87](02-merged-since-beta-87.md), [04-trial](04-trial.md), [annotations](concepts/annotations.md) and 7 more |
| `Any` | interface | no | [01-pr-3260-verify](01-pr-3260-verify.md), [04-trial](04-trial.md), [aggregate](concepts/aggregate.md), [ai-and-mcp](concepts/ai-and-mcp.md) and 30 more |
| `make` | const | no | [01-pr-3260-verify](01-pr-3260-verify.md), [02-merged-since-beta-87](02-merged-since-beta-87.md), [03-this-apps-rules-under-verify](03-this-apps-rules-under-verify.md), [04-trial](04-trial.md) and 46 more |

## `RequestContext.ts`

| Name | Kind | In beta.87 | Covered in |
| --- | --- | --- | --- |
| `Json` | type | yes | [platform-contract](concepts/platform-contract.md), [sessions](concepts/sessions.md) |
| `RequestContextClass` | interface | yes | [sessions](concepts/sessions.md) |
| `make` | const | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [02-merged-since-beta-87](02-merged-since-beta-87.md), [03-this-apps-rules-under-verify](03-this-apps-rules-under-verify.md), [04-trial](04-trial.md) and 46 more |
| `capture` (internal) | const | yes | [drizzle-durable-objects](concepts/drizzle-durable-objects.md), [sessions](concepts/sessions.md), [test-tooling](concepts/test-tooling.md) |
| `restore` (internal) | const | yes | [backfill](concepts/backfill.md), [projection](concepts/projection.md), [sessions](concepts/sessions.md) |

## `Rivet/index.ts`

| Name | Kind | In beta.87 | Covered in |
| --- | --- | --- | --- |
| `DomainShape` | interface | yes | [host-rivet](concepts/host-rivet.md), [model](concepts/model.md) |
| `DomainClassNotHosted` | class | yes | [02-merged-since-beta-87](02-merged-since-beta-87.md), [host-effect-cluster](concepts/host-effect-cluster.md), [host-rivet](concepts/host-rivet.md), [model](concepts/model.md) |
| `DurableObjectsOptions` | interface | yes | [host-cloudflare](concepts/host-cloudflare.md), [host-rivet](concepts/host-rivet.md), [model](concepts/model.md) |
| `layerDurableObjects` | const | yes | [backfill](concepts/backfill.md), [cluster-workflows](concepts/cluster-workflows.md), [host-cloudflare](concepts/host-cloudflare.md), [host-effect-cluster](concepts/host-effect-cluster.md) and 5 more |

## `Saga.ts`

| Name | Kind | In beta.87 | Covered in |
| --- | --- | --- | --- |
| `KeySchema` | type | yes | [saga](concepts/saga.md) |
| `Definition` | interface | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [aggregate](concepts/aggregate.md), [confidence-scores](concepts/confidence-scores.md), [decision](concepts/decision.md) and 8 more |
| `Status` | type | yes | [cluster-workflows](concepts/cluster-workflows.md), [foldkit](concepts/foldkit.md), [http-api](concepts/http-api.md), [model](concepts/model.md) and 2 more |
| `Run` | interface | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [04-trial](04-trial.md), [cli](concepts/cli.md), [cluster-singletons](concepts/cluster-singletons.md) and 13 more |
| `Client` | interface | yes | [aggregate](concepts/aggregate.md), [api](concepts/api.md), [deadlines](concepts/deadlines.md), [decision](concepts/decision.md) and 7 more |
| `Any` | interface | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [04-trial](04-trial.md), [aggregate](concepts/aggregate.md), [ai-and-mcp](concepts/ai-and-mcp.md) and 30 more |
| `Identifier` | type | yes | [aggregate](concepts/aggregate.md), [external-system](concepts/external-system.md), [foldkit](concepts/foldkit.md), [graphql](concepts/graphql.md) and 3 more |
| `ImplementationIdentifier` | type | yes | [saga](concepts/saga.md) |
| `SagaKey` | interface | yes | [saga](concepts/saga.md) |
| `ImplementationKey` | interface | yes | [saga](concepts/saga.md) |
| `make` | const | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [02-merged-since-beta-87](02-merged-since-beta-87.md), [03-this-apps-rules-under-verify](03-this-apps-rules-under-verify.md), [04-trial](04-trial.md) and 46 more |
| `Handler` | type | yes | [policy](concepts/policy.md), [projection](concepts/projection.md), [query](concepts/query.md), [saga](concepts/saga.md) |
| `SagaClass` | interface | yes | [saga](concepts/saga.md) |
| `engineFor` (internal) | const | yes | [cluster-workflows](concepts/cluster-workflows.md), [saga](concepts/saga.md) |
| `client` (internal) | const | yes | [02-merged-since-beta-87](02-merged-since-beta-87.md), [aggregate](concepts/aggregate.md), [ai-and-mcp](concepts/ai-and-mcp.md), [alchemy-git](concepts/alchemy-git.md) and 36 more |

## `Story.ts`

| Name | Kind | In beta.87 | Covered in |
| --- | --- | --- | --- |
| `StepReport` | interface | yes | [story](concepts/story.md) |
| `StoryFailure` | class | yes | [04-trial](04-trial.md), [story](concepts/story.md) |
| `Step` | type | yes | [explore](concepts/explore.md), [prove](concepts/prove.md), [story](concepts/story.md) |
| `StepOf` | type | yes | [story](concepts/story.md) |
| `WhenStep` | interface | yes | [story](concepts/story.md) |
| `RejectedStep` | interface | yes | [story](concepts/story.md) |
| `RepliedStep` | interface | yes | [story](concepts/story.md) |
| `ProvideStep` | interface | yes | [story](concepts/story.md) |
| `Checked` | type | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [04-trial](04-trial.md), [aggregate](concepts/aggregate.md), [ai-and-mcp](concepts/ai-and-mcp.md) and 50 more |
| `Order` | interface | yes | [platform-contract](concepts/platform-contract.md), [projection](concepts/projection.md), [story](concepts/story.md) |
| `Expected` | type | yes | [story](concepts/story.md) |
| `Story` | const | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [02-merged-since-beta-87](02-merged-since-beta-87.md), [04-trial](04-trial.md), [aggregate](concepts/aggregate.md) and 24 more |

## `Stream.ts`

| Name | Kind | In beta.87 | Covered in |
| --- | --- | --- | --- |
| `Entry` | interface | yes | [04-trial](04-trial.md), [model](concepts/model.md), [stream](concepts/stream.md), [view](concepts/view.md) |
| `Any` | interface | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [04-trial](04-trial.md), [aggregate](concepts/aggregate.md), [ai-and-mcp](concepts/ai-and-mcp.md) and 30 more |
| `EventOf` | type | yes | [aggregate](concepts/aggregate.md), [model](concepts/model.md) |
| `KeyOf` | type | yes | [model](concepts/model.md) |
| `Definition` | interface | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [aggregate](concepts/aggregate.md), [confidence-scores](concepts/confidence-scores.md), [decision](concepts/decision.md) and 8 more |
| `Origin` | interface | yes | [stream](concepts/stream.md) |
| `Host` | interface | yes | [alchemy-git](concepts/alchemy-git.md), [backfill](concepts/backfill.md), [cluster](concepts/cluster.md), [cluster-workflows](concepts/cluster-workflows.md) and 13 more |
| `StreamKey` | interface | yes | [stream](concepts/stream.md) |
| `make` | const | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [02-merged-since-beta-87](02-merged-since-beta-87.md), [03-this-apps-rules-under-verify](03-this-apps-rules-under-verify.md), [04-trial](04-trial.md) and 46 more |
| `StreamClass` | interface | yes | [stream](concepts/stream.md) |

## `Telemetry.ts`

| Name | Kind | In beta.87 | Covered in |
| --- | --- | --- | --- |
| `Options` | interface | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [aggregate](concepts/aggregate.md), [api](concepts/api.md), [backfill](concepts/backfill.md) and 14 more |
| `Resolved` (internal) | interface | yes | [aggregate](concepts/aggregate.md), [observability](concepts/observability.md) |
| `resolve` (internal) | const | yes | [02-merged-since-beta-87](02-merged-since-beta-87.md), [alchemy-git](concepts/alchemy-git.md), [cluster](concepts/cluster.md), [distilled-clients](concepts/distilled-clients.md) and 3 more |
| `TraceJson` (internal) | const | yes | [observability](concepts/observability.md) |
| `currentTrace` (internal) | const | yes | [observability](concepts/observability.md) |
| `spanOf` (internal) | const | yes | [observability](concepts/observability.md) |
| `Correlation` (internal) | class | yes | [observability](concepts/observability.md), [policy](concepts/policy.md) |
| `correlationFor` (internal) | const | yes | [observability](concepts/observability.md) |
| `commands` | const | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [02-merged-since-beta-87](02-merged-since-beta-87.md), [03-this-apps-rules-under-verify](03-this-apps-rules-under-verify.md), [04-trial](04-trial.md) and 43 more |
| `commandDuration` | const | yes | [observability](concepts/observability.md) |
| `events` | const | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [02-merged-since-beta-87](02-merged-since-beta-87.md), [03-this-apps-rules-under-verify](03-this-apps-rules-under-verify.md), [04-trial](04-trial.md) and 44 more |
| `lag` | const | yes | [distilled-clients](concepts/distilled-clients.md), [host-in-memory](concepts/host-in-memory.md), [model](concepts/model.md), [observability](concepts/observability.md) and 2 more |
| `runs` | const | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [02-merged-since-beta-87](02-merged-since-beta-87.md), [03-this-apps-rules-under-verify](03-this-apps-rules-under-verify.md), [04-trial](04-trial.md) and 49 more |
| `batchSize` | const | yes | [observability](concepts/observability.md) |
| `queries` | const | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [04-trial](04-trial.md), [ai-and-mcp](concepts/ai-and-mcp.md), [annotations](concepts/annotations.md) and 12 more |
| `externalCalls` | const | yes | [observability](concepts/observability.md) |
| `record` (internal) | const | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [02-merged-since-beta-87](02-merged-since-beta-87.md), [aggregate](concepts/aggregate.md), [cluster](concepts/cluster.md) and 22 more |
| `outcomeOf` (internal) | const | yes | [observability](concepts/observability.md) |

## `TwoPhase.ts` (new on main)

| Name | Kind | In beta.87 | Covered in |
| --- | --- | --- | --- |
| `Address` | interface | no | [decision](concepts/decision.md), [host-rivet](concepts/host-rivet.md) |
| `Prepare` | interface | no | [decision](concepts/decision.md) |
| `Part` | interface | no | [alchemy-git](concepts/alchemy-git.md), [cloudflare-tutorial](concepts/cloudflare-tutorial.md), [decision](concepts/decision.md), [prove](concepts/prove.md) and 2 more |
| `Plan` | interface | no | [02-merged-since-beta-87](02-merged-since-beta-87.md), [backfill](concepts/backfill.md), [decision](concepts/decision.md), [github](concepts/github.md) and 1 more |
| `Outcome` | type | no | [cli](concepts/cli.md), [confidence-scores](concepts/confidence-scores.md), [decision](concepts/decision.md), [explore](concepts/explore.md) and 2 more |
| `Unreachable` | class | no | [decision](concepts/decision.md) |
| `ReadResult` | type | no | [decision](concepts/decision.md) |
| `PrepareResult` | type | no | [decision](concepts/decision.md) |
| `Participant` | interface | no | [decision](concepts/decision.md) |
| `Primary` | interface | no | [decision](concepts/decision.md) |
| `Drive` | interface | no | [decision](concepts/decision.md) |
| `deliver` | const | no | [02-merged-since-beta-87](02-merged-since-beta-87.md), [cluster-singletons](concepts/cluster-singletons.md), [decision](concepts/decision.md), [host-cloudflare](concepts/host-cloudflare.md) and 2 more |
| `finish` | const | no | [deadlines](concepts/deadlines.md), [decision](concepts/decision.md) |
| `DecideInput` | interface | no | [decision](concepts/decision.md), [platform-contract](concepts/platform-contract.md) |
| `decide` | const | no | [01-pr-3260-verify](01-pr-3260-verify.md), [02-merged-since-beta-87](02-merged-since-beta-87.md), [03-this-apps-rules-under-verify](03-this-apps-rules-under-verify.md), [04-trial](04-trial.md) and 34 more |
| `CommitInput` | interface | no | [decision](concepts/decision.md) |
| `CommitStrategy` | type | no | [decision](concepts/decision.md) |
| `twoPhase` | const | no | [decision](concepts/decision.md) |
| `DecisionCommit` | const | no | [02-merged-since-beta-87](02-merged-since-beta-87.md), [decision](concepts/decision.md) |

## `Verify.ts` (new on main)

| Name | Kind | In beta.87 | Covered in |
| --- | --- | --- | --- |
| `Options` | interface | no | [01-pr-3260-verify](01-pr-3260-verify.md), [aggregate](concepts/aggregate.md), [api](concepts/api.md), [backfill](concepts/backfill.md) and 14 more |
| `Require` | interface | no | [01-pr-3260-verify](01-pr-3260-verify.md), [verify](concepts/verify.md) |
| `VerifyError` | class | no | [01-pr-3260-verify](01-pr-3260-verify.md), [verify](concepts/verify.md) |
| `NotVerified` | class | no | [01-pr-3260-verify](01-pr-3260-verify.md), [04-trial](04-trial.md), [aggregate](concepts/aggregate.md), [invariants-and-transitions](concepts/invariants-and-transitions.md) and 4 more |
| `Rule` | interface | no | [01-pr-3260-verify](01-pr-3260-verify.md), [03-this-apps-rules-under-verify](03-this-apps-rules-under-verify.md), [04-trial](04-trial.md), [ai-and-mcp](concepts/ai-and-mcp.md) and 5 more |
| `Run` | interface | no | [01-pr-3260-verify](01-pr-3260-verify.md), [04-trial](04-trial.md), [cli](concepts/cli.md), [cluster-singletons](concepts/cluster-singletons.md) and 13 more |
| `Report` | interface | no | [01-pr-3260-verify](01-pr-3260-verify.md), [explore](concepts/explore.md), [prove](concepts/prove.md), [tutorial](concepts/tutorial.md) and 1 more |
| `report` | const | no | [01-pr-3260-verify](01-pr-3260-verify.md), [02-merged-since-beta-87](02-merged-since-beta-87.md), [03-this-apps-rules-under-verify](03-this-apps-rules-under-verify.md), [04-trial](04-trial.md) and 19 more |
| `verified` | const | no | [01-pr-3260-verify](01-pr-3260-verify.md), [alchemy-git](concepts/alchemy-git.md), [api](concepts/api.md), [better-auth](concepts/better-auth.md) and 24 more |
| `model` | const | no | [01-pr-3260-verify](01-pr-3260-verify.md), [02-merged-since-beta-87](02-merged-since-beta-87.md), [03-this-apps-rules-under-verify](03-this-apps-rules-under-verify.md), [04-trial](04-trial.md) and 53 more |
| `AggregateOptions` | interface | no | [01-pr-3260-verify](01-pr-3260-verify.md), [verify](concepts/verify.md) |
| `Unproved` | interface | no | [01-pr-3260-verify](01-pr-3260-verify.md), [verify](concepts/verify.md) |
| `AggregateReport` | interface | no | [01-pr-3260-verify](01-pr-3260-verify.md), [verify](concepts/verify.md) |
| `AggregateNotVerified` | class | no | [01-pr-3260-verify](01-pr-3260-verify.md), [verify](concepts/verify.md) |
| `aggregate` | const | no | [01-pr-3260-verify](01-pr-3260-verify.md), [02-merged-since-beta-87](02-merged-since-beta-87.md), [03-this-apps-rules-under-verify](03-this-apps-rules-under-verify.md), [04-trial](04-trial.md) and 44 more |
| `render` | const | no | [01-pr-3260-verify](01-pr-3260-verify.md), [04-trial](04-trial.md), [explore](concepts/explore.md), [prove](concepts/prove.md) and 1 more |

## `View.ts`

| Name | Kind | In beta.87 | Covered in |
| --- | --- | --- | --- |
| `WaitTimeout` | class | yes | [model](concepts/model.md), [reads-and-consistency](concepts/reads-and-consistency.md), [view](concepts/view.md) |
| `ConsistencyTimeout` | class | yes | [02-merged-since-beta-87](02-merged-since-beta-87.md), [ai-and-mcp](concepts/ai-and-mcp.md), [api](concepts/api.md), [cli](concepts/cli.md) and 11 more |
| `Any` | interface | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [04-trial](04-trial.md), [aggregate](concepts/aggregate.md), [ai-and-mcp](concepts/ai-and-mcp.md) and 30 more |
| `Source` | type | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [04-trial](04-trial.md), [aggregate](concepts/aggregate.md), [cluster](concepts/cluster.md) and 13 more |
| `StateOf` | type | yes | [aggregate](concepts/aggregate.md), [model](concepts/model.md), [relation](concepts/relation.md) |
| `EventOf` | type | yes | [aggregate](concepts/aggregate.md), [model](concepts/model.md) |
| `KeyOf` | type | yes | [model](concepts/model.md) |
| `NameOf` | type | yes | [view](concepts/view.md) |
| `SourceEvent` | type | yes | [view](concepts/view.md) |
| `SourceKey` | type | yes | [view](concepts/view.md) |
| `SourceState` | type | yes | [view](concepts/view.md) |
| `Input` | type | yes | [ai-and-mcp](concepts/ai-and-mcp.md), [api](concepts/api.md), [backfill](concepts/backfill.md), [command](concepts/command.md) and 8 more |
| `Inputs` | type | yes | [host-cloudflare](concepts/host-cloudflare.md), [projection](concepts/projection.md), [prove](concepts/prove.md) |
| `HandlerKey` | type | yes | [view](concepts/view.md) |
| `InputFor` | type | yes | [view](concepts/view.md) |
| `StateType` | type | yes | [view](concepts/view.md) |
| `Output` | type | yes | [github](concepts/github.md) |
| `Routing` | interface | yes | [view](concepts/view.md) |
| `HandlerContext` | interface | yes | [view](concepts/view.md) |
| `EmitContext` | interface | yes | [view](concepts/view.md) |
| `KeyFn` | type | yes | [view](concepts/view.md) |
| `Routed` | type | yes | [model](concepts/model.md), [reads-and-consistency](concepts/reads-and-consistency.md) |
| `Definition` | interface | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [aggregate](concepts/aggregate.md), [confidence-scores](concepts/confidence-scores.md), [decision](concepts/decision.md) and 8 more |
| `ComputedFns` | type | yes | [view](concepts/view.md) |
| `Entry` | interface | yes | [04-trial](04-trial.md), [model](concepts/model.md), [stream](concepts/stream.md), [view](concepts/view.md) |
| `Page` | interface | yes | [model](concepts/model.md), [query](concepts/query.md), [view](concepts/view.md) |
| `WatchOptions` | interface | yes | [foldkit](concepts/foldkit.md) |
| `History` | interface | yes | [alchemy-git](concepts/alchemy-git.md), [model](concepts/model.md), [observability](concepts/observability.md), [projection](concepts/projection.md) and 1 more |
| `Host` | interface | yes | [alchemy-git](concepts/alchemy-git.md), [backfill](concepts/backfill.md), [cluster](concepts/cluster.md), [cluster-workflows](concepts/cluster-workflows.md) and 13 more |
| `ViewKey` | interface | yes | [view](concepts/view.md) |
| `make` | const | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [02-merged-since-beta-87](02-merged-since-beta-87.md), [03-this-apps-rules-under-verify](03-this-apps-rules-under-verify.md), [04-trial](04-trial.md) and 46 more |
| `LocalInput` | type | yes | [model](concepts/model.md) |
| `ViewClass` | interface | yes | [view](concepts/view.md) |

## `Watch.ts`

| Name | Kind | In beta.87 | Covered in |
| --- | --- | --- | --- |
| `refuse` | const | yes | [02-merged-since-beta-87](02-merged-since-beta-87.md), [03-this-apps-rules-under-verify](03-this-apps-rules-under-verify.md), [04-trial](04-trial.md), [ai-and-mcp](concepts/ai-and-mcp.md) and 10 more |
| `viewPush` | const | yes | [reads-and-consistency](concepts/reads-and-consistency.md), [view-security](concepts/view-security.md) |
| `streamPush` | const | yes | [reads-and-consistency](concepts/reads-and-consistency.md), [stream](concepts/stream.md), [view-security](concepts/view-security.md) |
| `serveSocket` | const | yes | [host-in-memory](concepts/host-in-memory.md), [reads-and-consistency](concepts/reads-and-consistency.md) |

## `globals.d.ts`

No exported declaration (also in beta.87).

## `index.ts`

| Name | Kind | In beta.87 | Covered in |
| --- | --- | --- | --- |
| `Event` | namespace | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [02-merged-since-beta-87](02-merged-since-beta-87.md), [03-this-apps-rules-under-verify](03-this-apps-rules-under-verify.md), [04-trial](04-trial.md) and 13 more |
| `Command` | namespace | yes | [02-merged-since-beta-87](02-merged-since-beta-87.md), [04-trial](04-trial.md), [aggregate](concepts/aggregate.md), [ai-and-mcp](concepts/ai-and-mcp.md) and 25 more |
| `DefaultConsistency` | const | no | [02-merged-since-beta-87](02-merged-since-beta-87.md), [ai-and-mcp](concepts/ai-and-mcp.md), [api](concepts/api.md), [command](concepts/command.md) and 2 more |
| `Rejection` | namespace | yes | [02-merged-since-beta-87](02-merged-since-beta-87.md), [04-trial](04-trial.md), [annotations](concepts/annotations.md), [command](concepts/command.md) and 11 more |
| `Aggregate` | namespace | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [02-merged-since-beta-87](02-merged-since-beta-87.md), [04-trial](04-trial.md), [aggregate](concepts/aggregate.md) and 26 more |
| `AlreadyExecuted` | const | yes | [aggregate](concepts/aggregate.md), [deadlines](concepts/deadlines.md), [model](concepts/model.md), [platform-contract](concepts/platform-contract.md) |
| `AlreadyCancelled` | const | yes | [aggregate](concepts/aggregate.md), [deadlines](concepts/deadlines.md), [model](concepts/model.md), [platform-contract](concepts/platform-contract.md) |
| `NotScheduled` | const | yes | [aggregate](concepts/aggregate.md), [deadlines](concepts/deadlines.md), [model](concepts/model.md), [platform-contract](concepts/platform-contract.md) |
| `Decision` | namespace | no | [01-pr-3260-verify](01-pr-3260-verify.md), [02-merged-since-beta-87](02-merged-since-beta-87.md), [04-trial](04-trial.md), [aggregate](concepts/aggregate.md) and 21 more |
| `Key` | namespace | yes | [aggregate](concepts/aggregate.md), [alchemy-git](concepts/alchemy-git.md), [annotations](concepts/annotations.md), [backfill](concepts/backfill.md) and 11 more |
| `View` | namespace | yes | [02-merged-since-beta-87](02-merged-since-beta-87.md), [annotations](concepts/annotations.md), [api](concepts/api.md), [backfill](concepts/backfill.md) and 12 more |
| `WaitTimeout` | const | yes | [model](concepts/model.md), [reads-and-consistency](concepts/reads-and-consistency.md), [view](concepts/view.md) |
| `ConsistencyTimeout` | const | yes | [02-merged-since-beta-87](02-merged-since-beta-87.md), [ai-and-mcp](concepts/ai-and-mcp.md), [api](concepts/api.md), [cli](concepts/cli.md) and 11 more |
| `Policy` | namespace | yes | [annotations](concepts/annotations.md), [explore](concepts/explore.md), [external-system](concepts/external-system.md), [host-cloudflare](concepts/host-cloudflare.md) and 5 more |
| `Saga` | namespace | yes | [04-trial](04-trial.md), [annotations](concepts/annotations.md), [cluster-workflows](concepts/cluster-workflows.md), [external-system](concepts/external-system.md) and 5 more |
| `Projection` | namespace | yes | [02-merged-since-beta-87](02-merged-since-beta-87.md), [annotations](concepts/annotations.md), [backfill](concepts/backfill.md), [model](concepts/model.md) and 6 more |
| `Query` | namespace | yes | [02-merged-since-beta-87](02-merged-since-beta-87.md), [annotations](concepts/annotations.md), [api](concepts/api.md), [graphql](concepts/graphql.md) and 11 more |
| `Relation` | namespace | no | [01-pr-3260-verify](01-pr-3260-verify.md), [02-merged-since-beta-87](02-merged-since-beta-87.md), [04-trial](04-trial.md), [annotations](concepts/annotations.md) and 7 more |
| `Stream` | namespace | yes | [alchemy-git](concepts/alchemy-git.md), [annotations](concepts/annotations.md), [api](concepts/api.md), [foldkit](concepts/foldkit.md) and 9 more |
| `ExternalSystem` | namespace | yes | [annotations](concepts/annotations.md), [external-system](concepts/external-system.md), [model](concepts/model.md), [observability](concepts/observability.md) and 2 more |
| `Api` | namespace | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [02-merged-since-beta-87](02-merged-since-beta-87.md), [04-trial](04-trial.md), [ai-and-mcp](concepts/ai-and-mcp.md) and 28 more |
| `protocolHttp` | const | yes | [api](concepts/api.md), [cli](concepts/cli.md), [foldkit](concepts/foldkit.md), [host-effect-cluster](concepts/host-effect-cluster.md) and 5 more |
| `protocolWebSocket` | const | yes | [api](concepts/api.md), [foldkit](concepts/foldkit.md), [host-cloudflare](concepts/host-cloudflare.md), [host-rivet](concepts/host-rivet.md) and 6 more |
| `protocolInProcess` | const | yes | [api](concepts/api.md), [foldkit](concepts/foldkit.md), [model](concepts/model.md) |
| `Model` | namespace | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [02-merged-since-beta-87](02-merged-since-beta-87.md), [04-trial](04-trial.md), [aggregate](concepts/aggregate.md) and 31 more |
| `verify` | const | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [02-merged-since-beta-87](02-merged-since-beta-87.md), [03-this-apps-rules-under-verify](03-this-apps-rules-under-verify.md), [04-trial](04-trial.md) and 24 more |
| `RequestContext` | const | yes | [01-pr-3260-verify](01-pr-3260-verify.md), [04-trial](04-trial.md), [aggregate](concepts/aggregate.md), [better-auth](concepts/better-auth.md) and 7 more |

## `internal.ts`

| Name | Kind | In beta.87 | Covered in |
| --- | --- | --- | --- |
| `internalError` (internal) | const | no | [model](concepts/model.md) |
| `redactCause` (internal) | const | no | [model](concepts/model.md) |
| `inputSchema` (internal) | const | yes | [command](concepts/command.md), [model](concepts/model.md), [query](concepts/query.md) |
| `rejectionTag` (internal) | const | yes | [model](concepts/model.md), [rejection](concepts/rejection.md) |
| `Settled` (internal) | type | yes | [distilled-clients](concepts/distilled-clients.md), [model](concepts/model.md) |
| `settle` (internal) | const | yes | [aggregate](concepts/aggregate.md), [cluster-singletons](concepts/cluster-singletons.md), [command](concepts/command.md), [local-first](concepts/local-first.md) and 5 more |
| `Judged` (internal) | type | yes | [model](concepts/model.md), [reads-and-consistency](concepts/reads-and-consistency.md) |
| `judge` (internal) | const | yes | [aggregate](concepts/aggregate.md), [local-first](concepts/local-first.md), [model](concepts/model.md), [rejection](concepts/rejection.md) and 2 more |
| `targetId` (internal) | const | yes | [aggregate](concepts/aggregate.md), [model](concepts/model.md), [platform-contract](concepts/platform-contract.md), [reads-and-consistency](concepts/reads-and-consistency.md) |
| `LocalViewInput` (internal) | interface | yes | [model](concepts/model.md) |
| `evolveView` (internal) | const | yes | [model](concepts/model.md) |
| `sendPayload` (internal) | const | no | [ai-and-mcp](concepts/ai-and-mcp.md), [cli](concepts/cli.md), [foldkit](concepts/foldkit.md), [http-api](concepts/http-api.md) and 1 more |
