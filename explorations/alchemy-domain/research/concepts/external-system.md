---
type: Reference
title: External System
description: An outside service declared as the operations the model calls, with schemas for arguments, results and errors, and implemented by a Layer; this app would use it for the language model, the mail sender and, while it stays in another context, the model-call allowance.
tags: [alchemy-domain, reaction]
---

# External System

An external system is a service outside the model, declared in the model's own words: one entry per operation, each
with its `args`, its `success` and the `error`s the model has an answer for. The declaration is an Effect service, so
a [policy](./policy.md) or a [saga](./saga.md) resolves it with `yield*`, and a Layer built with `toLayer` supplies the
vendor; production, tests and stories each plug in their own. Every call through that Layer is checked against the
schemas, and a value that breaks them is a defect that names the system, the operation and the side. The docs put it
as: "The model declares the calls it makes, in its own words, with their arguments and results"
[https://alchemy.run/domain/external-system].

## When to reach for it

- A reaction must ask or tell something outside the model: a language model, a mail provider, a payment provider, or
  another context of the same app that keeps its own data.
- You want stories to answer each call themselves, so every outcome of the outside world (success, refusal, broken
  connection) is a test.
- You want the vendor's words (endpoints, response fields) kept out of the model.

News coming in from outside (a webhook) goes the other way: an adapter turns it into a [command](./command.md), with
the vendor's event id as the `commandId`.

## How it is declared

```typescript
// SKETCH: not compiled
import * as Domain from "@alchemy.run/domain"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"

export class Mailer extends Domain.ExternalSystem(
  "Mailer",
  {
    send: {
      args: { to: S.String, template: MailTemplate, values: S.Record(S.String, S.String), requestId: S.String },
      success: { messageId: S.String },          // fields, or any schema
      error: [AddressRejected]                   // one schema, a list, or a Schema.Union
    }
  },
  { description: "Sends the app's mail: invitations and import results." }
) {}

export const MailerResend = Mailer.toLayer(
  Effect.gen(function* () {
    const client = yield* ResendClient           // resolved once; operations require nothing
    return {
      send: ({ to, template, values, requestId }) => client.send({ to, template, values, idempotencyKey: requestId })
    }
  }),
  { validate: true }                             // the default
)
```

- The second argument maps operation names to `{ args?, success?, error? }` (`ExternalSystem.OpSpec`). `args` are
  fields; `success` is fields or any schema; `error` is one schema or a list. An operation with no `args` is called
  with no argument; with no `success` it returns `void`, and the adapter's value is passed through unchecked; with no
  `error` it cannot fail with a typed error, and a failure the adapter returns anyway dies with
  `ExternalSystemSchemaError` whose `part` is `"error"` (the error check is always built, against `Schema.Never`;
  `ExternalSystem.ts` 162, 417-422).
- The service shape is one function per operation, `(args) => Effect<Success, Error>`, with no requirements: the
  adapter resolves its clients in the build Effect.
- `toLayer(build, { validate? })` returns the Layer. `validate` defaults to `true`.
- Each operation is also a static of the class (`Mailer.send`), a reference that stories use: `Story.call(Mailer.send,
  ...)`, `Story.succeed`, `Story.fail`.
- Operation names may not be `name`, `length`, `prototype`, `kind`, `systemName`, `ops`, `toLayer`, `key` or
  `annotations`: the signature refuses them, and `toLayer` dies with `ReservedOperation` if one gets through.
- Every call is traced as a span `Domain.external <System>.<op>` and counted by outcome.

Checked in: `packages/domain/src/ExternalSystem.ts` at `v2.0.0-beta.87`: `observeOps` 21-43, `CallRecorder` 51-64,
`ExternalSystemSchemaError` 87-93, `makeCheck` 111-137, `validateOps` 176-192, `ToLayerOptions` 197-204, `OpSpec`
210-214, `Shape` 232-236, `Op` 241-248, reserved names 270-282, `make` and `toLayer` 329-377, `successSchema` and
`errorSchema` 404-422, `ExternalSystemClass` 382-401; `packages/domain/src/DefinitionError.ts` 216
(`ReservedOperation`). Main has the same file, line for line.

### Types and helpers

| Name | What it is | Where (`ExternalSystem.ts`, beta.87 and main) |
| --- | --- | --- |
| `Domain.ExternalSystem` (`make`) | Declares an external system class | 329 |
| `ExternalSystemClass` | The class type `make` returns: `systemName`, `ops`, `annotations`, `toLayer`, one `Op` static per operation | 382-401 |
| `ExternalSystemKey`, `Identifier` | Type-level identity of the system in requirements; its requirement identifier | 266-268, 261 |
| `OpSpec`, `Shape`, `Op` | One operation's declaration; the service shape; the reference a story names (`Mailer.send`) | 210-214, 232-236, 241-248 |
| `ToLayerOptions` | `validate` (default `true`) | 197-204 |
| `ExternalSystemSchemaError` | The defect for a value a schema rejects: `system`, `op`, `part`, `message` | 87-93 |
| `Any` | What every external system class satisfies | 253-258 |
| `observeOps` | Wraps each operation in a span and a counter (internal) | 21-43 |
| `CallRecorder` | The hook a story uses to record and answer calls (internal) | 51-64 |
| `compileChecks`, `validateOps` | Build the schema checks once, and apply them to each call (internal; stories use them too) | 145-166, 176-192 |
| `successSchema`, `errorSchema` | The schema of an operation's `success` and `error` (internal) | 404-422 |

`Domain.ExternalSystem.Any` and `Domain.ExternalSystem.Op` are re-exported as types from the package root (`index.ts`
208-218).

### What main changes

Nothing in `packages/domain/src/ExternalSystem.ts` (identical on main). The docs page
(`website/src/content/docs/domain/external-system.mdx` 165-202 on main) shows `RecordSettlement` with the account id
in its input and sent without a separate target: a change to [commands](./command.md). The examples'
`FraudCheck.external.ts`, `Payments.external.ts` and `SettlementRefund.policy.ts` are the same on main.

## Rules, and the mistakes to avoid

- **Name operations in the model's words.** `send`, `suggest`, `take`; not the vendor's endpoint names. Keep `success`
  to the fields the model uses: undeclared fields are dropped by the check.
- **Declare as errors only the refusals the model answers.** A declined address is a business outcome; a timeout or a
  500 is not. Leave those as defects, so the policy runs again.
- **A broken schema is a defect, not an error.** Arguments the `args` schema rejects, a value the `success` schema
  rejects, or an error the `error` schema does not list all die with `ExternalSystemSchemaError { system, op, part,
  message }`, where `part` is `"args"`, `"success"` or `"error"`. A defect thrown inside a schema passes through as it
  is.
- **The check reads the decoded side only.** It validates with `Schema.toType` and never runs a transformation
  (`ExternalSystem.ts` 117-120). An adapter returns decoded values (a `DateTime`, an `Option`), not the JSON the vendor
  sent; decode the vendor's response yourself in the adapter.
- **`validate: false`** turns the check off for one adapter, for a large payload it already checks.
- **Who may call it.** The library stops an [aggregate](./aggregate.md) from calling it: a `decide` that is an Effect
  may require only what its command's middleware provides (`Command.ContextOf`; `packages/domain/src/Aggregate.ts`
  102-112, 137-150), so `yield* Mailer` there is a type error. On main the same holds for a
  [decision's](./decision.md) `decide`: its `Outcome` Effect requires only `Command.ContextOf<C>`
  (`packages/domain/src/Decision.ts` 101-108, 137-141 on main), and the aggregate's `Decision` type is unchanged
  (`Aggregate.ts` 111-118 on main). At run time `decide` gets only the request contexts sent with the command
  (`RequestContext.ts` 107-116). Policies and sagas are where calls belong: a policy resolves the system in its build
  Effect (its handler requires nothing, `Policy.ts` 49); a saga's handler may `yield*` it inside a step, and the
  requirement passes to the saga's Layer (`Saga.ts` 396-399). A [projection](./projection.md) or a
  [query](./query.md) handler could resolve one in its build Effect; the library does not stop it, but a projection
  that calls out acts again on every replay, so do not.
- **Calls are not deduplicated.** A policy runs at least once and a saga step can run twice. Pass an id derived from the
  event or the step (`envelope.stream` with `envelope.seq`, or `Activity.idempotencyKey(name)`), and have the adapter
  use it as the vendor's idempotency key. Not `envelope.id`: that is the aggregate instance's id, the same for every
  event of it (`Aggregate.ts` 45-63).
- **Stories answer stubbed systems and assert the others.** Systems in the story's `stub` list wait for the story to
  answer each call; the rest run for real through the Layer you provide, and the story checks what each was sent and
  returned (`Story.returned`, `Story.failed`, `Story.died`). A story with a stubbed call left unanswered fails
  ("unanswered external system calls at the end of the story"), and so does one with a real call no step asserts
  (`packages/domain/src/Story.ts` 883 `stub`, 1721, 1728). A stubbed system's answers are checked against its
  schemas too (`Story.ts` 1078-1090).

## In this app

The catalog already treats the model as an outside system and names its file accordingly:
`packages/catalog/model/src/Answer/Answerer.external.ts`. `Answerer` is a `Context.Service` with `status` (a value,
`"on"` or `"off"`) and `ask<Sc>(question, schema)`, generic in the schema of the answer, failing with `AiUnavailable`
(17-63). Two parts do not fit an `ExternalSystem` as they stand:

- **`ask` is generic.** An operation has fixed schemas, so one operation per question the app asks: `suggest` (the
  open rows of an import, answered with `SuggestAnswer`, `packages/catalog/model/src/Suggestion/Suggest.rules.ts`
  31-54) and `readView` (the table assistant's request, answered with its view change). Each feature's guard keeps
  working on the decoded answer.
- **`status` is a value, not a call.** It becomes an operation with no arguments (`status: { success: ModelAvailability
  }`), or stays in the host's settings and decides which Layer is provided (`Answerer.off` already exists as a twin).

```typescript
// SKETCH: not compiled
import * as Domain from "@alchemy.run/domain"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import { AiUnavailable } from "@inventory/catalog-contract/AiUnavailable"

export class Suggester extends Domain.ExternalSystem(
  "Suggester",
  {
    suggest: {
      args: { fileName: S.String, open: S.String, requestId: S.String },
      success: SuggestAnswer,
      error: AiUnavailable                       // no key, refused, busy, bad answer, down
    },
    status: { success: ModelAvailability }
  },
  { description: "The language model, as the catalog asks it: proposals for what the rules cannot fix." }
) {}

export const SuggesterOpenRouter = Suggester.toLayer(
  Effect.gen(function* () {
    const answerer = yield* Answerer             // today's OpenRouter adapter, reused inside
    return {
      suggest: ({ fileName, open }) => {
        const prompt = promptFor(fileName, open)
        const question = ModelQuestion.make({ name: "suggest", prompt, system, maxOutputTokens })
        return Effect.map(answerer.ask(question, SuggestAnswer), (answered) => answered.value)
      },
      status: () => Effect.succeed(answerer.status)
    }
  })
)
```

What the app keeps from today: the model proposes and never writes (rule 8), because the policy or saga that calls
`suggest` can only send a command that records proposals; `answeredByRules` still decides the fallback, now in the
caller, catching `AiUnavailable`; the model id is not hard-coded. What changes: `answeredBy` (which model answered)
is part of `success` if the screen is to keep saying who answered.

**The mail sender** is new: the app sends no mail today. `Mailer.send` (above) with `error: [AddressRejected]`, called
by `InviteMember` and `MailImportResult` (see [policy](./policy.md)) with `requestId` derived from the event. The
adapter for one provider is in [resend](./resend.md). A bounce webhook comes back the other way as a command
(`MarkInvitationBounced`) with the provider's event id as `commandId`.

**The model-call allowance, if it stays outside.** Today the catalog sees it as `ModelAllowance`
(`packages/catalog/model/src/Answer/ModelAllowance.external.ts`), whose host translates to the access context's
`AllowanceStore` (`packages/access/host/src/AllowanceStore.adapter.ts`). As an external system it is `ModelCalls.take:
{ args: { id, purpose }, success: AllowanceAnswer }`, where `AllowanceAnswer` is the existing tagged union of `taken`
and `usedUp`: "used up" is an answer the caller acts on (the rules answer), not an error. The `id` makes a repeated
take answer "taken" without counting twice (the adapter needs `ON CONFLICT` for that; see [policy](./policy.md)). If
the access context joins the same model, the allowance is better an [aggregate](./aggregate.md) per organization and
day: then "at most 40, counted before the call" (rule 9) is an invariant decided one command at a time, not a
property of an SQL statement.

- **Used today:** no. `Answerer` and `ModelAllowance` are plain `Context.Service` ports
  (`packages/catalog/model/src/Catalog.ports.ts` 15-16), called from request handlers.
- **Where it goes:** `Suggester` and `ModelCalls` declared in `packages/catalog/model/src/Answer/`; `Mailer` in the
  access model; their adapters in `packages/catalog/host/src/` and `packages/access/host/src/`; the stub list of each
  story.
- **What the person gets:** nothing they can see from the declaration itself; the features built on it (suggestions on
  staging, invitation and result mail) are what they see.

## How to check it

- A story with the system in `stub`: `Story.call(Suggester.suggest, { fileName: "items_messy.csv" })` then
  `Story.succeed(Suggester.suggest, answer)`, or `Story.fail(Suggester.suggest, aiUnavailable({ kind: "busy",
  retryable: true }))` to check the rules answer.
- A contract test run against both the real adapter and its memory twin, so the twin answers like the vendor (the docs
  call this running the same tests against every adapter; see [test tooling](./test-tooling.md)).
- A unit test that an adapter answering a field of the wrong type dies with `ExternalSystemSchemaError` whose `part` is
  `"success"`.
- Building the system's Layer dies with `ReservedOperation` for a reserved operation name (`ExternalSystem.ts`
  350-357); the signature refuses one first.
- No external system was called in either trial on 2026-11-19.

## What it needs

Nothing from a host: it is a service and a Layer, provided where the model is hosted, next to the platform. Works the
same in memory, on Cloudflare, Rivet and Effect Cluster. beta.87 has everything on this page; main has the same file.

## Verdict

**Use:** declare `Suggester` (one operation per question, `AiUnavailable` as its error) and `Mailer` as external
systems, call them only from policies and sagas with an id derived from the event or the step, and declare the
allowance as `ModelCalls` only while it stays in another context; otherwise make it an aggregate.

## Where this was read

- https://alchemy.run/domain/external-system (the live site documents beta.87)
- `website/src/content/docs/domain/external-system.mdx` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same path, changed
  (command shape)
- `packages/domain/src/ExternalSystem.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same
- `packages/domain/src/Aggregate.ts` (the `decide` type), `RequestContext.ts`, `Story.ts` (stubs) and
  `DefinitionError.ts` at `v2.0.0-beta.87`; `packages/domain/src/Decision.ts` on `main@dbfd0ddb` (new)
- `examples/cloudflare-domain/packages/domain/src/Fraud/FraudCheck.external.ts`, `Fraud/FraudReview.policy.ts`,
  `Settlement/Payments.external.ts`, `Settlement/SettlementRefund.policy.ts` at `v2.0.0-beta.87`; on
  `main@dbfd0ddb`: same, except `FraudReview.policy.ts` (command shape)
- `packages/domain/skills/alchemy-domain/references/building-blocks.md` ("External system") at `v2.0.0-beta.87`; on
  `main@dbfd0ddb`: same section
- App: `packages/catalog/model/src/Answer/Answerer.external.ts`, `ModelAllowance.external.ts`,
  `packages/catalog/model/src/Catalog.ports.ts`, `packages/catalog/model/src/Suggestion/Suggest.rules.ts`,
  `packages/access/host/src/AllowanceStore.adapter.ts`
