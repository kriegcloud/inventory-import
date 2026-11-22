---
type: Reference
title: Sessions and request context
description: How a request says who is asking (a request context provided by RPC middleware) and how `decide` reads it; this app would carry its member, role and organization, and an acting agent, this way.
tags: [alchemy-domain, people-and-clients]
---

# Sessions and request context

A request context is an Effect service that travels with a request into the domain. Middleware on the Api provides
it (for example "who is signed in"); the domain encodes it with its schema when a command is sent, and decodes it
again wherever the aggregate runs, so an effectful `decide` (and a view's `validate`) can `yield*` it. The docs put
the idea as: "A request context is a service that travels with the request into the domain."
[https://alchemy.run/domain/sessions] Authentication is RPC middleware (`effect/rpc/RpcMiddleware`), listed per
command; authorization is the command's own `decide`. Tenancy is not a feature of the library: nothing in it knows
about organizations, so the app writes that check itself.

## When to reach for it

- Every command or read that must know who is asking: here, every write (saving review decisions, confirm,
  take-back, an item edit, people changes) and every read scoped to one organization.
- When the decision runs somewhere other than the request (a Durable Object, a cluster entity): a plain Effect
  service would not cross that boundary; a request context does, because it has a schema.
- When a policy, a story or a scheduled job sends a command with no request: it provides the context itself (see
  [policy](./policy.md) and [story](./story.md)).

## How it is declared

Three pieces: the context, the middleware that provides it, and the list of middleware on a command.

```typescript
// SKETCH: not compiled
import * as Domain from "@alchemy.run/domain"
import * as RpcMiddleware from "effect/rpc/RpcMiddleware"
import * as S from "effect/Schema"

// 1. The context: a key (unique in the program) and a schema (it must encode synchronously to JSON).
export const Actor = S.Struct({
  organizationId: S.String,
  memberId: S.String,
  role: S.Literals(["admin", "editor", "viewer"])
})
export class CurrentActor extends Domain.RequestContext<CurrentActor>()("Inventory/CurrentActor", Actor) {}

// 2. The middleware that provides it; its `error` is what a client sees when it refuses.
export class NotSignedIn extends S.TaggedError<NotSignedIn>()("NotSignedIn", {}) {}
export class Session extends RpcMiddleware.Service<Session, { provides: CurrentActor }>()("Inventory/Session", {
  error: NotSignedIn
}) {}

// 3. A command lists it; its `decide` may then read CurrentActor (beta.87 shape, with `target`).
export class SettleRow extends Domain.Command("SettleRow", {
  target: ImportId,
  middleware: [Session],
  input: {},
  events: [RowSettled],
  rejects: [NotPermitted, NotOpen, NothingWaiting]
}) {}
```

What the source does:

- `Domain.RequestContext<Self>()(key, schema)` builds `Context.Service<Self, S["Type"]>()(key)`, adds a static
  `schema`, and puts the key in a module-level registry (a plain `Map` keyed by the string) with a JSON codec
  (`Schema.toCodecJson`) and synchronous encode and decode. The class is an ordinary Effect service: `yield*
  CurrentActor` works anywhere it is provided, and `Effect.provideService(CurrentActor, value)` provides it.
- `capture` (internal) walks the registry and, for each registered key, reads the service with
  `Effect.serviceOption`; a present one is encoded and kept under its key. A service that was never declared with
  `Domain.RequestContext` is not in the registry, so it is silently left behind. `capture` runs when a command is sent
  (`Model.ts`) and when a live read is authorized (`Api.ts`), after the read's middleware has run around it.
- `restore` (internal) decodes that JSON back into a `Context`. A key that is not in the registry dies with a
  `DefinitionError` whose reason is `UnknownRequestContext` ("Unknown request context '<key>'"). A registered key whose
  value does not decode throws from `decodeUnknownSync`, which is a defect too. The registry is filled when the module
  that declares the class is evaluated, so the process that runs `decide` must import that module.
- The kernel restores the context only for an effectful decision: when `decide` returns an Effect, it is provided
  with the restored context. A handler that returns events or a rejection directly cannot read any service.
- The type of an effectful decision allows exactly `Command.ContextOf<C>` as its requirements: the union of what the
  command's middleware `provides` (`Middleware.Provides`). Anything else is a type error.
- A command's `middleware` is applied to its RPC by `Middleware.apply`; its errors join the client's error type
  (`Middleware.Errors`). Which entry of a two-entry list runs first differs between the refs: see
  [command](./command.md) and "What main changes" below.
- `rejects` accepts any tagged error schema class (`Rejection.Any`), so an existing `Schema.TaggedError` such as the
  kernel's `Forbidden` can be declared as a rejection without a new class. A returned rejection that the command does
  not declare is a `DefinitionError` with reason `UndeclaredDecision`, and the decision dies.

Checked in: `packages/domain/src/RequestContext.ts:16` (registry), `:21-28` (`RequestContextClass`), `:66-86`
(`make`), `:93-100` (`capture`), `:107-116` (`restore`, unknown key at `:110-112`); `packages/domain/src/index.ts:291`
(`Domain.RequestContext`); `packages/domain/src/DefinitionError.ts:166-176` (`UndeclaredDecision`), `:207-213`
(`UnknownRequestContext`); `packages/domain/src/internal.ts` (`judge`); `packages/domain/src/Middleware.ts:9-38`;
`packages/domain/src/Command.ts:29,38,265`; `packages/domain/src/Aggregate.ts:105-112` (`Decision`);
`packages/domain/src/Kernel.ts:1119-1126` (restore in decide); `packages/domain/src/Model.ts:747` (capture at send);
`packages/domain/src/Api.ts:852-866` (capture for a live read); `packages/domain/src/Watch.ts:98` (restore for
`validate`); `packages/domain/src/Rejection.ts:11-18`; `packages/domain/src/Story.ts:632` (`provide`); all at
`v2.0.0-beta.87`. Effect's `packages/effect/src/rpc/RpcMiddleware.ts:278-336` (`Service` with `provides`, `requires`,
`error`, `requiredForClient`) and `packages/effect/src/rpc/RpcServer.ts:621-624` at effect@4.1.4.

| Name | What it is | Where |
| --- | --- | --- |
| `Domain.RequestContext` | `RequestContext.make`: declares a request context class | `index.ts:291`, `RequestContext.ts:66` |
| `RequestContextClass<Self, Key, S>` | The class type `make` returns: an Effect `ServiceClass` plus a static `schema` | `RequestContext.ts:21-28` |
| `RequestContext.Json` | The JSON form of a request's contexts, by key; carried in `Platform`'s command and read inputs | `RequestContext.ts:8` |
| `capture`, `restore` | Encode the present contexts; decode them back into a `Context` (internal) | `RequestContext.ts:93,107` |
| `Middleware.List` | The middleware a command or view declares | `Middleware.ts:9` |
| `Middleware.Provides`, `Middleware.Errors` | The services a list provides; the errors it can fail a request with | `Middleware.ts:12,19` |
| `Middleware.Apply`, `apply` | The RPC type with a list applied; the function that applies it (internal) | `Middleware.ts:26,34` |
| `Command.ContextOf<C>` | What a command's `decide` may require: what its middleware provides | `Command.ts:38` |

### What main changes

- Middleware order. At beta.87 `Middleware.apply` adds the list with `reduce`; Effect's RPC server wraps the handler
  once per middleware in the order they were added (`RpcServer.ts:621-624`, the set grows by appending at
  `Rpc.ts:901`, effect@4.1.4), so the last one added is outermost and runs first: the LAST entry of the list runs
  first. The beta.87 doc comment (`Middleware.ts:4-8`) says the first runs first; the code does the opposite. Main
  changes `apply` to `reduceRight` (`packages/domain/src/Middleware.ts:39-43` on main, commit `6c184fcb4`, #3413), so
  the first entry is outermost and what it provides reaches later entries, and `sessions.mdx` says so ("Guard
  commands and views"). Read from source, not run. [command](./command.md) holds the full account.
- Commands without `target`: the instance id travels inside `input` and the aggregate finds it with `keyOf` (the
  docs' `SetNickname` drops `target` and adds `accountId` to `input`). The session pieces do not change.
- Transitions may read the context. An aggregate's `transitions` (main only) may be an `Effect.fn` that reads what
  its commands' middleware provides, typed `Effect<boolean, never, Command.ContextOf<C>>`
  (`packages/domain/src/Aggregate.ts:160-171` on main). They are proof obligations for `Verify` and `Prove`; no host
  evaluates them at run time.
- The prover treats each request context a command reads as an input, made once per command
  (`packages/domain/src/Prove/internal/Value.ts:215-226` on main): a rule is proved for every value the context's
  schema allows.
- A [decision](./decision.md) restores the context the same way (`packages/domain/src/Kernel.ts:1422` on main, beside
  the aggregate's at `:1233`); `Model.ts:992` and `:1108` capture it for a command and for a decision.
- `RequestContext.ts` itself is the same at both refs; on main `Domain.RequestContext` is at `index.ts:319` and
  `UnknownRequestContext` at `DefinitionError.ts:247`.

## Rules, and the mistakes to avoid

- One key per context, unique across the whole program: the registry is one map keyed by the string, and a second
  class with the same key replaces the first silently.
- Declare every service that must reach `decide` with `Domain.RequestContext`. A plain `Context.Service` (such as
  today's `CurrentAgent`) is not captured; inside `decide` it is simply absent.
- The schema must encode and decode synchronously (the registry uses `encodeUnknownSync` and `decodeUnknownSync`).
  An encode failure is a thrown error inside `capture`, not a typed failure.
- Read the context only in an effectful `decide` (`Effect.fn`). A handler that returns an array cannot see it.
- Never put the organization, member or role in a command's `input`. The payload can be forged; the context comes
  from middleware the server runs.
- Do not write a middleware that reads what an earlier entry in the same list provides until the order is settled for
  the ref you run (see [command](./command.md)). Put such a check in `decide`, where the order does not matter.
- A policy, a saga or a test that sends a guarded command without a request must provide the context itself
  (`Effect.provideService(CurrentActor, ...)`, or `Story.provide(CurrentActor, ...)` in a story); otherwise the type
  check fails, because the decision requires it.
- Tenancy is the app's job. The library has no organization concept. Keep the organization in the instance's state
  (set from the actor when the import is staged) or in its id, and compare it with the actor's in every `decide`.
- Inside `decide`, build events and rejections with `new` (`return yield* new NotPermitted({})`), never `.make`: on
  main the prover does not read `.make`, and on beta.87 `Rejection.make()` does not type-check. The app's lint rule
  `newSchemaClass` needs an exception for domain blocks.
- On main, everything `decide` and the transitions call must be reachable by relative imports from the aggregate's
  file. A helper imported by package name (for example `requireRole` from `@inventory/kernel/Actor`) is reported as
  "calls <package>.requireRole, which the prover has no model for", and nothing through it is proved.
- WebSocket live reads cannot carry a header from a browser: they authenticate by the cookie on the upgrade.

## In this app

Today the kernel has `CurrentActor` as a plain `Context.Service<CurrentActor, Member>` (`packages/kernel/src/Actor.context.ts:24`),
provided by `Identity`, an `HttpApiMiddleware` whose live layer reads the Better Auth session
(`packages/access/host/src/SessionIdentity.adapter.ts:48-76`). `requireRole` reads it, and also `CurrentAgent` (read
with `Effect.serviceOption`) when an agent acts for the person (`packages/kernel/src/Actor.context.ts:33-49`,
`Agent.context.ts:20`). `Domain.RequestContext` returns a `Context.Service` class, so one class can be provided by the
existing `HttpApiMiddleware` and by a new `RpcMiddleware`, and `requireRole` keeps working for the `HttpApi` handlers.

The example that ran: a trial on 2026-11-19 wrote a model of this app on `main@dbfd0ddb` with a request context
`CurrentActor` of `{ organizationId, memberId, role }`, every `ImportDraft` command listing `middleware: [Session]`,
each `decide` an `Effect.fn` that reads it, and two transitions that read it. Trimmed to one command:

```typescript
// SKETCH: not compiled (trimmed from the model that ran; main's shapes: no `target`, `keyOf`)
import * as Domain from "@alchemy.run/domain"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import { CurrentActor, Session } from "./Actor.context.ts"

export const ImportId = S.String.pipe(S.brand("ImportId"))
export class RowSettled extends Domain.Event("RowSettled", {}) {}
export class NotPermitted extends Domain.Rejection("NotPermitted", {}) {}
export class NotOpen extends Domain.Rejection("NotOpen", {}) {}
export class SettleRow extends Domain.Command("SettleRow", {
  middleware: [Session],
  input: { importId: ImportId },
  events: [RowSettled],
  rejects: [NotPermitted, NotOpen]
}) {}

export class ImportDraft extends Domain.Aggregate("ImportDraft", {
  id: ImportId,
  state: ImportState, // Unstaged | Open { organizationId, rows, ready, waiting, left } | Imported | TakenBack
  initial: { _tag: "Unstaged" },
  transitions: {
    OnlyItsOwnOrganizationChangesAnImport: Effect.fn(function* ({ before }) {
      if (before._tag === "Unstaged") return true
      return (yield* CurrentActor).organizationId === before.organizationId
    }),
    AViewerChangesNothing: Effect.fn(function* () {
      return (yield* CurrentActor).role !== "viewer"
    })
  },
  commands: [SettleRow],
  keyOf: (command) => command.importId,
  decide: {
    SettleRow: Effect.fn(function* (state) {
      const actor = yield* CurrentActor
      if (state._tag !== "Open") return yield* new NotOpen({})
      if (actor.organizationId !== state.organizationId || actor.role === "viewer") {
        return yield* new NotPermitted({})
      }
      return [new RowSettled({})]
    })
  },
  evolve: {
    RowSettled: (state) =>
      state._tag === "Open" ? { ...state, ready: state.ready + 1, waiting: state.waiting - 1 } : state
  }
}) {}
```

The organization lives in the import's state, set from the actor by `StageImport`, so a member of `org_northline`
sending `SettleRow` for an `org_prairie` import is refused in `decide`. For the real app the context's schema would be
the kernel's `Member` (an `S.Opaque` struct of `id`, `name`, `role`, `organizationId`, `organizationName`,
`packages/kernel/src/Member.schema.ts:28-38`), and `CurrentAgent` would become a second request context so a
suggestion made inside `asAgent` carries its `maxRole` into `decide`. The rule from `requireRole` (the member's role,
then the agent's `maxRole`) must then be written in a file the aggregate imports relatively, or the prover cannot read
it.

- **Used today:** no. `CurrentActor` is a plain service provided by `Identity` (`packages/kernel/src/Identity.middleware.ts`,
  an `HttpApiMiddleware`); `requireRole` is called at the top of each handler
  (`packages/catalog/model/src/Import/Imports.handler.ts`), and the organization filter is in every D1 query.
- **Where it goes:** an `Actor.context.ts` and an `Agent.context.ts` in each model's own package (request contexts; the
  kernel's two stay for `/api/v1`), a `Session` RPC middleware declared beside them, its live layer beside
  `packages/access/host/src/SessionIdentity.adapter.ts`, and the check in each `decide` of a future Import aggregate.
- **What the person gets:** nothing they can see; the same refusals, now enforced where the import is decided.

## How to check it

- Stories, as run in the trial on main: `Story.provide(CurrentActor, dana)` then `Story.when(new ConfirmImport({ ... }))`
  records `ImportConfirmed` and the reply; `Story.provide(CurrentActor, outsider)` (an admin of `org_northline`) then
  `SettleRow` on an `org_prairie` import is `Story.rejected(new NotPermitted({}))`. Both passed. At beta.87 the same
  story is written `Story.when(ref, command)`.
- `Verify.aggregate(ImportDraft)` on main PROVED, for every state and every input after any number of commands, the
  transitions `OnlyItsOwnOrganizationChangesAnImport` and `AViewerChangesNothing` (with the other eight rules of the
  aggregate), and `Verify.model` proved them again within the whole model. See [verify](./verify.md).
- What that proof assumes: the report's "Assumed" list includes "middleware lets every caller in: who sends a command
  is anyone its request context allows" (`packages/domain/src/Verify.ts:226` on main). The middleware's own check (is
  this session real, is this member in this organization) is not proved. It needs its own test: the `Session` layer
  with no cookie fails `NotSignedIn`; a member removed from the organization gets no context; the context it provides
  is the member the directory holds for the session's active organization.
- A test that `restore` of an unknown key dies: send a context JSON with a key no module declared and expect the
  `UnknownRequestContext` defect (the host must import the module that declares `CurrentActor`).
- A test that a context declared as a plain `Context.Service` does not reach `decide` (so `CurrentAgent` must be a
  request context).

## What it needs

Any host (in memory, Durable Objects, Rivet, Effect Cluster): the context crosses the boundary as JSON, so the only
need is that the host process imports the module declaring each context. `Domain.RequestContext`, middleware on
commands and an effectful `decide` are on beta.87. Transitions that read the context, and the proofs above, need
`main@dbfd0ddb` (see [verify](./verify.md)). The app's existing Better Auth session lookup can be the body of the RPC
middleware's live layer (see [better-auth](./better-auth.md)).

## Verdict

**Use:** make `CurrentActor` and `CurrentAgent` request contexts declared in each model's own package (the prover
reads no rule through a context imported by package name; the kernel's stay for `/api/v1`), provide them from one RPC
`Session` middleware backed by the Better Auth lookup, and check organization then role in every `decide` through one shared
function in a file the aggregate imports relatively. Keep each command's middleware list to one entry until the
ordering on the ref you run is settled ([command](./command.md)), and test the middleware itself, because the proof
assumes it.

## Where this was read

- https://alchemy.run/domain/sessions (the live site documents beta.87)
- `website/src/content/docs/domain/sessions.mdx` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed (order sentence, no `target`)
- `packages/domain/src/RequestContext.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same
- `packages/domain/src/Middleware.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed (`reduceRight`)
- `packages/domain/src/{Kernel,Model,Api,Watch,Story,Command,DefinitionError,internal}.ts` at `v2.0.0-beta.87`; on
  `main@dbfd0ddb`: changed (line numbers; `Decision` restore added)
- `packages/domain/src/{Aggregate,Verify}.ts` and `packages/domain/src/Prove/internal/Value.ts` on `main@dbfd0ddb`
  (transitions, the "Assumed" list, request contexts as inputs)
- `examples/cloudflare-domain/packages/domain/src/{CurrentActor.context.ts,Session.middleware.ts,MfaChallenge.middleware.ts,Actor.ts}`
  and `examples/cloudflare-domain/packages/server/src/Session.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same
- `examples/cloudflare-domain/packages/domain/src/Fraud/FraudReview.policy.ts:23-26` (a policy providing the actor)
- `packages/effect/src/rpc/RpcMiddleware.ts`, `RpcServer.ts`, `Rpc.ts` at effect@4.1.4
- A trial on 2026-11-19 (stories and Verify on `main@dbfd0ddb`)
