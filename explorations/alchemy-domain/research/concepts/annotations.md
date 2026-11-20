---
type: Reference
title: Domain.Annotations
description: The data every declaration takes as its last argument (a description, an HTTP cache rule, and keys you add); inventory-import would use it to describe each command and read for MCP tools, CLI help and OpenAPI.
tags: [alchemy-domain, declaration]
---

# Domain.Annotations

Every building block takes an annotations object as its last argument and keeps it as the static `X.annotations`.
The library itself reads two keys: `description`, which the surfaces built from an [Api](./api.md) show (AI and MCP
tool descriptions, CLI help, OpenAPI), and `httpApiCacheControl`, which `toHttpApi` sends as `cache-control`. Every
other key is yours: `Domain.Annotations` is an interface you augment, and a key nobody declared is a type error. The
docs call annotations "data about a declaration for what is built on the model" [https://alchemy.run/domain/annotations].

## When to reach for it

- On every command, query, view and stream an Api serves: the description is what a person or an agent reads before
  calling it.
- On the Api itself: its description heads the CLI's root help and the OpenAPI document.
- On a query or read whose answer may be cached by the caller's browser (`httpApiCacheControl`).
- When tooling built on the model needs data per declaration (a glossary, a diagram, which of the app's rules a
  command upholds): add a key by augmentation instead of a side table.

## How it is declared

```typescript
// SKETCH: not compiled
import * as Domain from "@alchemy.run/domain"
import * as S from "effect/Schema"

export class ConfirmImport extends Domain.Command(
  "ConfirmImport",
  { target: ImportId, input: { revision: S.Int }, events: [ImportConfirmed], rejects: [ImportNotOpen] },
  { description: "Write the import's ready rows as items. Only while the import is open." }
) {}

ConfirmImport.annotations.description // the string above
```

The interface (beta.87) has two optional keys:

| Key | Type | Read by |
| --- | --- | --- |
| `description` | `string` | The Ai toolkit and MCP (`Ai.ts:103-123`, `toolDescription`): for a command it replaces the generated sentence ("Send the X command."); for a read it follows the sentence that says what the call does. The CLI: each entry's description is its subcommand's help (`Cli.ts:325-330`, `:538`), and the Api's description is the root help unless `toCli` is given its own `description` option (`Cli.ts:84-85`, `:546`). `toHttpApi` (`Http.ts:329-335` per operation, `:464-469` the Api's description as the group's and the document's `OpenApi.Description`). For a command only, `ReadRpcs.ts:250-251` falls back to the command Schema's own `description` when the annotation is absent. |
| `httpApiCacheControl` | `string` | `toHttpApi` only (`Http.ts:231-238`): the `cache-control` sent with a successful answer from a query or a view's, stream's or aggregate's `get`, `peek`, `snapshot` and `list`. Without it, and for every failure, live read (`watch`, `events`) and command, the header is `private, no-store`. |

Which declarations take annotations, and where (beta.87): `Event` (`Event.ts:77`), `Command` (`Command.ts:237`),
`Rejection` (`Rejection.ts:67`), `Aggregate` (`Aggregate.ts:730`), `View` (`View.ts:524`), `Stream`
(`Stream.ts:225`), `Query` (`Query.ts:308`), `Policy` (`Policy.ts:209`), `Projection` (`Projection.ts:250`), `Saga`
(`Saga.ts:278`), `ExternalSystem` (`ExternalSystem.ts:333`), `Model` (`Model.ts:312`) and `Api`
(`Api.ts:1232`). Each defaults to `{}`.

For an event and a rejection the type is wider: `Domain.Annotations` and Effect's
`Schema.Annotations.Declaration` for that class (`Event.ts:33-34`, `Rejection.ts:24-25`), and the same object is the
class Schema's annotations. So a [rejection](./rejection.md) takes `httpApiStatus: 403`, which an HTTP API answers
with, and its JSON Schema carries the description.

Adding a key is TypeScript module augmentation of the root module:

```typescript
// SKETCH: not compiled
declare module "@alchemy.run/domain" {
  interface Annotations {
    /** Which of the app's ten rules this declaration upholds, by number. */
    readonly upholds?: ReadonlyArray<number>
  }
}
```

Checked in: `packages/domain/src/Annotations.ts:28-54` (the interface), `packages/domain/src/index.ts:287` (exported
as a type), the files and lines above, all at `v2.0.0-beta.87`.

### What main changes

Nothing in the interface: main `Annotations.ts:27-53` holds the same two keys. Only its doc example changed, because
commands lost `target` (the example's `examples` key now holds `{ input: { accountId, amount } }`). The docs page
changed the same way. `Domain.Decision` takes annotations too (main `Decision.ts:396-401`); `Domain.Relation` does
not. Commit not known.

## Rules, and the mistakes to avoid

- Write the description for whoever calls the block: a person reading CLI help, or an agent choosing a tool. Say what
  it does and any unit ("the price is a decimal string"), not how it is built.
- The surfaces read only `description` and `httpApiCacheControl`. A key you add does nothing until your own tooling
  reads it.
- Never set `httpApiCacheControl` to `public` on an answer that depends on who asks. A shared cache does not know the
  Api's middleware read a session, and hands one organization's answer to the next. In this app every read is scoped to
  an organization, so at most `private, max-age=...`.
- A misspelled key (`descripton`) is a type error. That only holds while the interface is not widened with an index
  signature: do not augment it with `[key: string]: unknown`.
- An external system cannot have an operation named `annotations` (`ExternalSystem.ts:270-281`, `ReservedOperation`).

## In this app

Today the app describes its wire schemas with Effect's own annotations: `S.Struct(...).annotate({ identifier,
description })` and `annotateKey({ description })` on fields (for example
`packages/catalog/contract/src/Import/Decision.command.ts`), and the OpenAPI document comes from the `HttpApi` in
`packages/catalog/contract/src/Catalog.contract.ts`. In an Alchemy model those field descriptions stay on the
schemas, and the block's own description moves to the declaration's last argument:

```typescript
// SKETCH: not compiled
export class EditItem extends Domain.Command(
  "EditItem",
  {
    target: ItemId,
    input: { revision: S.Int, name: S.String },
    events: [ItemEdited],
    rejects: [ItemChangedMeanwhile]
  },
  {
    description: "Change one item by hand. Refused when the item changed since the revision you saw.",
    upholds: [5]
  }
) {}

// A test that every command an Api serves says what it does.
const undocumented = Catalog.commands.filter((command) => command.annotations.description === undefined)
```

- **Used today:** no. The app uses Effect Schema `annotate`/`annotateKey` descriptions on its contract schemas
  (`packages/catalog/contract/src/*`, `packages/access/contract/src/*`).
- **Where it goes:** the last argument of each declaration in `packages/catalog/model/src/**` and
  `packages/access/model/src/**`; a module augmentation file such as
  `packages/kernel/src/DomainAnnotations.ts` if the app adds keys.
- **What the person gets:** the same words on every surface: the tool list the table assistant's model sees, the CLI
  help and the OpenAPI page say what each action does.

## How to check it

A test over the model's lists: every entry of `Catalog.commands`, `Catalog.views`, `Catalog.queries` and
`Catalog.streams` has a non-empty `annotations.description`. For `httpApiCacheControl`, an HTTP test through
`toHttpApi` that reads the `cache-control` header of a query's answer (see [http-api](./http-api.md)). The type-check
catches unknown keys.

## What it needs

Nothing beyond the declaration. Any host. Published on beta.87.

## Verdict

**Use:** give every served declaration and each Api a `description` from the start, add app keys only by augmentation,
and keep `httpApiCacheControl` private or unset.

## Where this was read

- https://alchemy.run/domain/annotations (the live site documents beta.87)
- `website/src/content/docs/domain/annotations.mdx` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed (examples only)
- `packages/domain/src/Annotations.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed (doc comment only)
- `packages/domain/src/Event.ts`, `Rejection.ts`, `Command.ts`, `Http.ts`, `Ai.ts`, `Cli.ts`, `ReadRpcs.ts`,
  `ExternalSystem.ts` (the lines cited) at `v2.0.0-beta.87`
- `packages/domain/src/Decision.ts` on `main@dbfd0ddb`: new
