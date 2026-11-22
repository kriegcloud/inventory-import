---
type: Reference
title: Agent tools and MCP (toToolkit, toMcp)
description: toToolkit and toMcp turn the calls of an Api you list into Effect AI tools and an MCP server; inventory-import would give its table assistant read-only tools and never a tool that confirms, takes back or changes a role.
tags: [alchemy-domain, surface]
---

# Agent tools and MCP (toToolkit, toMcp)

Read at the library's release `2.0.0-beta.87` and its `main@dbfd0dd`, not at the pin `734c27a` the repository
builds on. What changed between that touches what this page recommends is listed once in [the map](../00-map.md),
"From `dbfd0dd` to the pin".

`@alchemy.run/domain/Ai` makes tools for a language model from an [Api](./api.md): `toToolkit` gives an Effect AI
`Toolkit` and the Layer of its handlers, for an agent inside the app; `toMcp` registers the same tools on Effect's
`McpServer`, for agents outside it. Each tool calls the Api in process with the headers you choose, so the middleware,
`decide`, `validate` and rejections work for an agent exactly as for a person's client, and a rejection comes back to
the model as a result it can act on. The docs describe the module as turning "the calls of an Api you list into tools
for an agent" [https://alchemy.run/domain/mcp]. Everything it builds on in Effect (`McpServer`, `Tool`, `Toolkit`,
`McpProtocol`) is marked `@stability unstable` in Effect 4.1.4.

## When to reach for it

- An agent in the app that must read the model's views and queries to do its job, acting for the signed-in person.
- An MCP client (a coding agent, a desktop assistant) that a member points at their own organization's data.
- A command as a tool only when the command records a proposal and nothing a person has to confirm.
- Not for an agent outside the organization: its tools return the domain's own replies and states, so write tools of
  your own with their own result schemas.

## How it is declared

```ts
// SKETCH: not compiled
import * as DomainAi from "@alchemy.run/domain/Ai"
import { MemberApi } from "@inventory/catalog-model/MemberApi"

const { toolkit, layer } = DomainAi.toToolkit(MemberApi, {
  expose: ["ItemFacets", "ItemPage", "ImportSummary.get"]
  // headers: left out, each call carries the current HttpServerRequest's headers
})
// Object.keys(toolkit.tools):
// ["MemberApi_ItemFacets_ask", "MemberApi_ItemPage_ask", "MemberApi_ImportSummary_get"]
```

- `toToolkit(api, { expose?, headers? })` returns `{ toolkit, layer }` (`Ai.ts` lines 246-301).
  - `expose`: the calls to give as tools, by name; defaults to `[]`. Only calls that answer once (`OnceCallName`): a
    command (operation `send`), a query (`ask`), a view's `get`, `list`, `snapshot`, a stream's `peek`, `list`.
    `watch` and `events` are streams and never tools.
  - `headers`: an `Effect<Headers.Input, never, R>` run for each call. Left out, a call carries the headers of the
    current `HttpServerRequest` if there is one, and none otherwise (`requestHeaders`, lines 201-204).
  - `layer` holds the handlers; it needs the hosted model and the server Layers of the Api's middleware, minus `Scope`
    and minus the client half of any middleware (a credential the server holds for its own calls never replaces the
    agent's headers). The in-process client is built once, when the Layer is built (line 287).
- `toMcp(api, options)` is `McpServer.toolkit(toolkit)` with `layer` provided (lines 333-343): a Layer you give an
  `McpServer` transport (`McpServer.layerHttp({ name, version, path, protocols: [McpProtocol.v2025_11_25] })`, or on
  a Worker `McpServer.layerHttpRequestScoped` with the sessionless `McpProtocol.v2026_07_28`). Its declared type is
  `Layer<never, never, Services<A> | R>`; the `McpServer` it registers on comes from the transport you provide.

Tool names and shapes:

- A tool is named `<api>_<name>_<operation>`, every character other than a letter, a digit, `_` or `-` replaced by `_`
  (`DomainAi.toolName({ api, name, operation })`). A name over 64 characters, or two calls with one name, make the
  Layer die with a `DefinitionError` (`ToolNameTooLong`, `DuplicateTool`).
- Parameters, success and failure are the call's own JSON codecs. A success that is not a JSON object (a view's
  `state | null`) is wrapped as `{ value }`, since MCP requires an object.
- Failures are the call's declared rejections and its middleware's errors, with `failureMode: "return"`: the model
  receives them as the tool's result. Any other error is a defect, which the model never sees.
- Descriptions: a command's `description` [annotation](./annotations.md) (or its Schema description), else "Send the
  X command."; a read's generated sentence ("Get the current ImportSummary of a key.") followed by the entry's
  description.
- Hints: a command is annotated `Tool.Readonly` false, `Tool.Destructive` true, `Tool.Idempotent` false; every read
  the opposite. `Tool.OpenWorld` is not set, and Effect defaults it to true, so `tools/list` reports
  `openWorldHint: true` for every tool (read from Effect's source, not seen on the wire).

Types and helpers (all in `packages/domain/src/Ai.ts`):

| Name | What it is | Where (beta.87) |
| --- | --- | --- |
| `Toolable` | what `toToolkit` reads from an Api class: `apiName`, `serves`, `group`, `clientInProcess` | lines 25-30 |
| `Services<A>` | the services the tools' Layer needs: the in-process client's, minus `Scope` and client middleware halves | lines 37-40 |
| `Exposable<A>` | a call name `expose` accepts (calls that answer once) | line 60 |
| `ToolkitOptions<A, R>` | the options of `toToolkit` and `toMcp`: `expose` (default `[]`) and `headers` | lines 62-78 |
| `ApiToolkit<R>` | what `toToolkit` returns: `toolkit` and `layer` | lines 81-86 |
| `toolName` | the tool name of a call | lines 97-101 |
| `toToolkit`, `toMcp` | the two functions | lines 246, 333 |

What the docs say is missing, and what Effect 4.1.4 has:

- No approval before a write. Effect's `Tool` has `needsApproval` (`true`, or a function of the parameters that may
  return an Effect; `Tool.ts` lines 281-293) and `setNeedsApproval` (line 1359). `LanguageModel` honours it: a tool
  that needs approval yields a `tool-approval-request` part instead of running (`LanguageModel.ts` lines 1698-1712,
  2244-2266). `McpServer` does not read it. An MCP server can ask its client with `McpServer.elicit` (line 4170),
  which `layerHttpRequestScoped` does not offer (lines 2853-2854). `Ai.ts` sets neither `needsApproval` nor anything
  about elicitation, at beta.87 or at main.
- Every tool is listed to every MCP client. The docs say Effect cannot yet filter tools per request ("needs `McpServer`
  to filter per request, which Effect does not do yet", `mcp.mdx` line 147 at beta.87). Effect 4.1.4 does have it:
  `McpServer.visibility(check)` (lines 548-602) is middleware whose check runs per request, on list requests and on
  calls; a registration it refuses is left out of `tools/list` and its calls fail as if it were not registered.
  `Ai.ts` does not use it, at either ref. `McpServer.toolkit` runs the MCP middleware in the context it is registered
  in (lines 3249-3286), so providing a visibility's `layer` to the Layer `toMcp` returns, or registering
  `McpServer.toolkit(toolkit)` from `toToolkit`'s output yourself as Effect's own example does, should hide tools per
  caller. Read from source, not run.
- Results are the call's raw reply or state, so a field one of them gains later reaches the agent too.
- `watch` and `events` are not tools; an MCP resource subscription might serve them later.

Checked in: `packages/domain/src/Ai.ts` lines 24-40 (`Toolable`, `Services`), 55-86 (`Exposable`, options, result),
88-101 (`toolName`, the 64-character limit), 103-124 (descriptions), 126-167 (one tool per call, `{ value }`,
`failureMode`, hints), 171-204 (how a call is invoked, default headers), 246-301 (`toToolkit`), 333-343 (`toMcp`), at
`v2.0.0-beta.87`. In Effect 4.1.4 as published (`effect/ai`): `Tool.ts` lines 108-126 (`FailureMode`), 281-293
(`needsApproval`), 1359 (`setNeedsApproval`), 2253-2338 (`Readonly` default false, `Destructive` default true,
`Idempotent` default false, `OpenWorld` default true); `Toolkit.ts` lines 103, 706 (`toLayer`, `make`);
`LanguageModel.ts` lines 1698-1712, 2244-2266; `McpServer.ts` lines 548-602 (`visibility`), 2804 (`layerHttp`),
2839-2877 (`layerHttpRequestScoped`), 3249-3286 (`registerToolkit`), 3380-3383 (how hints reach `tools/list`),
3449-3465 (`toolkit`), 4157-4170 (`elicit`); `McpProtocol.ts` lines 211, 220. Every one of these modules is
`@stability unstable`, `@since 4.0.0`.

### What main changes

- A command tool's parameters are `{ commandId?, input, consistency? }`, with no `target` (`Ai.ts` lines 176-179 on
  main, through `sendPayload` in `packages/domain/src/internal.ts` lines 255-271). Commit not known.
- `consistency` is one of the parameters, so the model itself may ask for `"strong"`. Every command tool's failures now
  include `ConsistencyTimeout` (`Command.ts` line 328 on main), returned to the model like a rejection.
- The docs add that a command tool answers at the commit, so a read tool called straight after can be behind, and an
  agent carries no receipt between calls; providing `Domain.DefaultConsistency` as `"strong"` to the tools' Layer makes
  every command tool answer once the views have it (`website/src/content/docs/domain/mcp.mdx` line 94 on main). This
  holds in the source: the in-process client is built when the tools' Layer is built (`Ai.ts` `toLayer`), and a client
  reads `DefaultConsistency` once, when it is built (`Api.ts` lines 1242-1246 on main). Commit `bc0024faf` (#3469).
- Nothing else in `Ai.ts` differs; main still sets no `needsApproval` and no visibility.

## Rules, and the mistakes to avoid

- `destructiveHint` is advice to a client, not a guard. A tool that exists can be called; only the Api's middleware
  and the command's `decide` refuse.
- Expose reads freely within one organization; expose a command only when its worst outcome is a proposal a person
  still has to accept.
- Do not let the model choose who it acts for. The headers come from server code (`options.headers` or the current
  request), never from tool parameters.
- An agent that acts for a person must not exceed a role cap. The in-process client inside `layer` is built when the
  Layer is built, with the services in scope then (`Ai.ts` line 287; `Api.ts` lines 1026-1036 at beta.87), so provide
  `layer` inside the scope that sets the agent's cap. Reasoned from the source, not run.
- Each step of a tool loop is a model call. If the app counts calls, every step must take from the allowance first.
- On a Worker, use `layerHttpRequestScoped` with `McpProtocol.v2026_07_28`; `layerHttp` keeps one server running for
  all requests.
- The docs' table lists "Aggregate `get`" as a tool (`mcp.mdx` line 18, both refs). An Api never serves an aggregate
  (`Servable`, `Api.ts` line 52), so no such tool can be exposed; expose a view's `get`.

## In this app

The app's rule is "a model proposes and never writes; a person confirms". Agents act for the signed-in person through
`asAgent(run)` (`packages/kernel/src/Agent.context.ts`), which provides `CurrentAgent`; `requireRole`
(`packages/kernel/src/Actor.context.ts`) refuses a write unless both the person's role and the run's `maxRole` allow
it. The table assistant runs as `AgentRun.make({ agent: "Table assistant", maxRole: "viewer" })`, exported as
`viewReader` (`packages/catalog/model/src/Assistant/Assistant.handler.ts` line 49).

Which calls are safe to expose as tools (domain names as these pages and the trial model use them):

| Call (in a domain Api) | Tool? | Why |
| --- | --- | --- |
| `ItemPage`, `ItemFacets` (queries) | yes | reads of the person's own organization |
| `ImportSummary.get`, `.list`, `.snapshot` (view) | yes | reads |
| an audit-trail query, a people list | yes, within the organization | reads; the agent acts for a member who may read them |
| `RecordSuggestion` (a command that only records a proposal) | yes, with care | it lands as a suggestion the person accepts or rejects; it is still marked destructive |
| `SettleRow`, `LeaveRowOut` (a row decision) | no | a decision is the person's; an agent saving one is the agent deciding |
| `ConfirmImport` (`commit`) | no | writes items: rule 8 |
| `TakeBackImport`, removing or reopening an import | no | changes or removes stored items and imports |
| `EditItem` | no | writes an item |
| `ChangeRole`, `AddPerson`, `RemoveMember` | no | changes who may do what |
| `TakeModelCall` | no | the server takes the allowance before each model call; a model never spends it |

How the table assistant would use `toToolkit`. Today it asks once for a structured answer (`Answerer.ask`) and checks
it against the catalog the request carried (`checkCommand`). With read tools, the model could look up which units,
categories and ranges actually exist before proposing a filter; the answer is still a `ViewCommand`, still checked by
`checkCommand`, and still changes only the person's view.

```ts
// SKETCH: not compiled. A read-only toolkit, capped at viewer, inside the assistant's request.
import * as Effect from "effect/Effect"
import * as DomainAi from "@alchemy.run/domain/Ai"
import { asAgent } from "@inventory/kernel/Agent"
import { MemberApi } from "@inventory/catalog-model/MemberApi"
import { viewReader } from "./Assistant.handler.ts"

const reads = DomainAi.toToolkit(MemberApi, { expose: ["ItemFacets", "ItemPage"] })

export const askWithTools = Effect.fn("TableAssistant.askWithTools")(function* (prompt: string) {
  // Every step of the loop is a model call: each takes one call from the allowance before it runs.
  return yield* generateViewCommand({ prompt, toolkit: reads.toolkit }).pipe(
    Effect.provide(reads.layer),
    asAgent(viewReader)
  )
})
```

`generateViewCommand` stands for the assistant's own model call through its `Answerer` port with a toolkit added; the
port has no toolkit parameter today (`packages/catalog/model/src/Answer/Answerer.external.ts`).

- **Used today:** no. The table assistant asks a model for one structured answer with no tools, and the app serves no
  MCP endpoint.
- **Where it goes:** `packages/catalog/model/src/Assistant/Assistant.handler.ts` (a read-only toolkit for the view
  request); the `Answerer` port in `packages/catalog/model/src/Answer/Answerer.external.ts` (a toolkit option); an MCP
  route, if ever, in `apps/inventory/src/server/App.ts` with `layerHttpRequestScoped` and a visibility that hides
  every tool from a caller without a session.
- **What the person gets:** the assistant's filters name units and categories that exist in their items, instead of
  guesses that the rules then refuse.

## How to check it

- A fast test: `Object.keys(toolkit.tools)` equals the expected names, and
  `Context.get(tool.annotations, Tool.Destructive)` is false for every tool of the assistant's toolkit (no write was
  exposed).
- A test with the [in-memory host](./host-in-memory.md): build a second toolkit that exposes `ConfirmImport`, call it
  from inside `asAgent(viewReader)` as an editor, and expect the tool's result to be `Forbidden` naming the viewer cap;
  this proves the cap reaches the domain's middleware.
- For MCP: list tools with Effect's `McpTest` client and assert that no name ends in `_send` except the proposal
  commands; then assert a call without a session returns `isError` with the session middleware's error.
- Rule 9 holds: a test that runs a two-step tool loop counts two calls taken from the allowance.
- Nothing here was run in either trial on 2026-11-19: no toolkit, no MCP server.

## What it needs

- Effect 4.1.4's `effect/ai` (`Tool`, `Toolkit`, `LanguageModel`, `McpServer`, `McpProtocol`), all unstable.
- A host providing the model, and the server Layers of the Api's middleware; a session middleware that reads the
  person and honours the agent's role cap (see [sessions](./sessions.md)).
- A language model provider Layer for `toToolkit` (the app's OpenRouter driver, `packages/drivers/openrouter`).
- beta.87 for the published tool parameters; main for target-less command tools and `DefaultConsistency`.

## Verdict

**Use:** give the table assistant a read-only toolkit from `toToolkit`, provided inside `asAgent(viewReader)`; expose no
command that confirms, takes back, edits or changes a role. Serve `toMcp` only behind a `McpServer.visibility` layer,
and add `needsApproval` (or MCP elicitation on `layerHttp`) yourself before any write tool, since `Ai.ts` sets neither.

## Where this was read

- https://alchemy.run/domain/mcp (the live site documents beta.87)
- `website/src/content/docs/domain/mcp.mdx` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same path, changed
- `packages/domain/src/Ai.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same path, changed
- `packages/domain/src/ReadRpcs.ts` at `v2.0.0-beta.87` (lines 224-349); on `main@dbfd0ddb`: same path, changed
- `packages/domain/skills/alchemy-domain/references/hosting.md` at `v2.0.0-beta.87`, "MCP"; on `main@dbfd0ddb`: same
  path, changed
- `packages/effect/src/ai/McpServer.ts`, `Tool.ts`, `Toolkit.ts`, `LanguageModel.ts`, `McpProtocol.ts` at
  `effect@4.1.4` (the published package)
- The app: `packages/kernel/src/Agent.context.ts`, `packages/kernel/src/Actor.context.ts`,
  `packages/catalog/model/src/Assistant/Assistant.handler.ts`, `packages/catalog/model/src/Answer/Answerer.external.ts`
