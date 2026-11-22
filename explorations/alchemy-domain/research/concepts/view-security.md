---
type: Reference
title: Views as security boundaries
description: How a view or stream decides who may read each key, on every read and every live change; this app would use it to keep each organization's imports to its own members, by role.
tags: [alchemy-domain, read, security]
---

# Views as security boundaries

Read at the library's release `2.0.0-beta.87` and its `main@dbfd0dd`, not at the pin `734c27a` the repository
builds on. What changed between that touches what this page recommends is listed once in [the map](../00-map.md),
"From `dbfd0dd` to the pin".

A [view](./view.md) (or a [stream](./stream.md)) exposed through an [Api](./api.md) is a security boundary, like a
command. Its declaration lists the `middleware` that says who is asking and the `rejects` a read may fail with; its
Layer supplies one `validate(request, state)` that allows the read or fails with one of those rejections. `validate`
decides whether the caller may read a key; it never decides which fields they see, so a different audience gets a
different view. The docs say it "decides whether the person asking may read the key they asked for"
[https://alchemy.run/domain/view-security].

## When to reach for it

- Every view or stream an Api exposes to people who are not all allowed to see everything. In this app that is every
  one: each key belongs to one organization.
- When two roles should see different facts about the same thing (a viewer sees an import's counts; an admin also sees
  who decided each row): two views, not one view with a role switch.

## How it is declared

```typescript
// SKETCH: not compiled
import * as Domain from "@alchemy.run/domain"
import * as Effect from "effect/Effect"
import { CurrentActor } from "@inventory/kernel/Actor"
import { Session } from "./Session.middleware.ts"
import { NotInOrganization } from "./NotInOrganization.rejection.ts"

export class ImportResult extends Domain.View("ImportResult", {
  from: [Import],
  key: Import,
  middleware: [Session],          // provides CurrentActor
  rejects: [NotInOrganization],   // what a refused read fails with, typed on the client
  state: ImportResultState,       // carries organizationId
  initial: emptyResult,
  evolve: { /* ... */ }
}) {}

/** Any member of the import's organization may read it; nobody else. */
export const ImportResultLive = ImportResult.toLayer(
  Effect.succeed(
    Effect.fn("ImportResult.validate")(function* (_request, result) {
      const actor = yield* CurrentActor
      if (result !== null && result.organizationId !== actor.organizationId) {
        return yield* new NotInOrganization()   // a rejection is built with `new` (see below)
      }
    })
  )
)
```

A rejection is built with `new` here, as the docs do: on beta.87 `Rejection.make()` does not type-check (a trial on
2026-11-19 got TS2322). The app's Effect diagnostic `newSchemaClass` reports every `new`, so a domain file needs an
exception to it (`// @effect-diagnostics-next-line newSchemaClass:off`, or the rule off for domain blocks).

The pieces, from the source:

- `Read.Request` is `{ mode, key }`; `mode` is `"get" | "watch" | "events" | "list"`. A `snapshot` is judged with mode
  `"get"`. The caller's `where` is not in the request: access never depends on a filter.
- `state` is the key's state (a view) or its latest entry (a stream), or `null` when the key has nothing yet.
- `validate`'s requirements may only be what the middleware provides and `RuntimeContext`. Anything else (a
  permissions store) is resolved once, while the Layer is built.
- A declaration with any `middleware` or any `rejects` is "guarded": the model's Layer does not type-check until its
  Layer is provided, and at run time the model dies with `UnvalidatedRead`.

Checked in: `packages/domain/src/Read.ts` at `v2.0.0-beta.87`: `Mode` line 9, `Request` 48-52, `Contract` 61-76,
`Validate` 91-103, `Guarded` 140-149, `isGuarded` 152-153; `packages/domain/src/View.ts` `toLayer` 542-547 and its doc
615-627; `packages/domain/src/Model.ts` the type that demands the Layer (`ValidatorOf`) 225-236, the run-time wiring
598-624; `packages/domain/src/DefinitionError.ts` `UnvalidatedRead` 235-242.

Types and helpers of `Read.ts` this page has not named yet:

| Name | What it is | Where |
| --- | --- | --- |
| `ValidatorKey<Name>` | The type-level identity of a view's or stream's validator Layer in an Effect's requirements; what `toLayer` provides and the model's Layer requires | `Read.ts` 111-113 |
| `MiddlewareOf<D>` | The middleware a read's declaration lists, or `readonly []`; types what `validate` may read | `Read.ts` 116-120 |
| `RejectsOf<D>` | The rejections a read's declaration lists, or `readonly []`; types what `validate` may fail with | `Read.ts` 123-127 |

### What is checked, read by read (beta.87)

| Read | When `validate` runs | Against what |
| --- | --- | --- |
| `get`, `snapshot`, stream `peek` | once, after any `atLeast` wait | the key's state (or latest entry) |
| `list` | once, before the page is read (a view's `list`: after any `atLeast` wait) | the key's current state, not each entry |
| `watch` | on every change pushed, including the first | each new state (or latest entry) |
| `events`, as a streamed response | on each entry the caller's `where` keeps | the state after that entry (a stream: that entry) |
| `events`, over a WebSocket | on each entry after the cursor, kept by `where` or not | the same |

A failure on a live read ends it with the rejection as its `Exit`. Checked in `packages/domain/src/Api.ts` lines
639-769 (the read handlers) and `packages/domain/src/Watch.ts` lines 86-246 (pushes over WebSockets).

What is not checked on beta.87:

- The `CaughtUp` frame is never judged (`Watch.ts` `Item.marker` 78-79, the skip in `encode` 102, `markCaughtUp`
  140-153; `Api.ts` `withCaughtUp` 532-553). When the key has nothing after the caller's `after`, `events` sends
  `CaughtUp` first and unjudged, carrying the caller's own `after` (`Api.ts` 552), so a refused caller is not refused:
  it learns the key has nothing past that point (with `after` 0, that the key has no history) and stays subscribed
  until the next entry is judged. When the caller's `where` keeps no entry of the history, `CaughtUp` is sent unjudged
  with the key's last `seq` (`Api.ts` 541-547). Over a WebSocket, a first push with no entries after the cursor sends
  the unjudged `CaughtUp` alone (`Watch.ts` 183-199).
- A WebSocket `watch` that reconnects with a cursor at or past the key's version is sent nothing and not judged; the
  socket stays open until the next change, which is judged (`Watch.ts` 169-171 and 215-217).
- With `atLeast`, the wait comes before `validate`, so a refused caller can hold a request open up to the timeout and
  learn from its length whether the key moved (`Api.ts` view `get` 700-707, `snapshot` 743-754, `list` 755-769, stream
  `peek` 639-646).
- Entries the caller's `where` drops are not judged on a streamed `events` response (`Api.ts` 669-672 and 734-737);
  they are not sent either, so this hides nothing.
- A read made on the server never runs `validate`: `yield* ImportResult` inside a command's handler, a policy, a
  query's handler or a story reads the view's host directly. The validators are looked up only by the Api's read
  handlers (`Api.ts` 621) and by the WebSocket pushes the model builds for an Api (`Model.ts` 462-463, 512, 524);
  `Story.ts` reads a view with `host.get` (line 1393) and never calls one.

### What main changes

All three gaps above are closed on main, by commit `794557619` (#3414, "validate before disclosing reads"); the source
comments name the issues #3060, #2907 and #2906:

- `events` judges the `CaughtUp` frame: when no history comes first, against the key's state now; otherwise the event
  that ends the history is judged even when the caller's `where` drops it. A refused caller is refused the same way
  with or without history (`packages/domain/src/Api.ts` `withCaughtUp` 612-649, the first frame 646-648, the ending
  event 633-635; `packages/domain/src/Watch.ts` `markCaughtUp` 141-167).
- `watch` is judged before the cursor is consulted, on every push including a reconnect, and a refused read keeps the
  cursor the client sent, so the refusal carries nothing of the key's state (`Watch.ts` `viewPush` 185-208,
  `streamPush` 243-260, `encode` 136).
- A read with `atLeast` is judged on the key's current state first, then waits, then is judged again only if the
  version moved (`judgedRead`, `Api.ts` 651-671; used by view `get`, `snapshot`, `list` 855-934 and stream `peek`,
  `list` 785-844). A view `get` without receipts is one read and one judgment (866-874).
- `atLeast` on a read is now one receipt or several (`Query.AtLeastJson`, `packages/domain/src/Query.ts` 32;
  `packages/domain/src/ReadRpcs.ts` 99, 129, 157, 188, 205), and a stream's `list` takes it too, so it can now fail
  with `ConsistencyTimeout` (`ReadRpcs.ts` 129 and 139).
- `Watch.refuse` takes an `Exit` (`Watch.ts` 68-73), so a live read whose middleware dies ends with a redacted defect
  instead of failing the upgrade (`Api.ts` 1039-1053).
- Unchanged: `validate` still runs only for reads served through an Api (`Api.ts` 766, `Model.ts` 649-650, 720, 732),
  and a WebSocket `events` push still judges every entry after the cursor.

The read contract types (`Read.ts`) are the same on main.

## Rules, and the mistakes to avoid

- Write the rule once, as a function (`mustBeMember(organizationId)`), and call it from every view's and stream's
  `validate` and every [query](./query.md) handler.
- Put the owner in the state. A view keyed by `Import` can only judge tenancy if its state carries `organizationId`;
  fold it in from the first event.
- Decide what `null` means. The bank example allows a read of a key that does not exist yet, so a client can watch for
  it to appear. Ids here are random, so allowing it leaks little; refusing it is stricter and also fine.
- Prefer a rule on the key when the key says whose data it is: a view keyed by `OrganizationId` compares
  `request.key` with `actor.organizationId` and needs no state.
- Never branch on the role inside one view to hide fields. Make a second view and expose it in a second Api, or list
  it only where that role reaches.
- A `where` filter is not a permission. `validate` does not see it.
- On beta.87, treat `events` and a reconnecting `watch` as able to tell a refused caller whether a key has history
  and how far it goes (`CaughtUp` unjudged), and an `atLeast` read as able to tell it, by its length, whether the key
  moved. Do not put anything meaningful in a key id.
- `validate` guards the Api only. A handler, policy or query that reads a view on the server must check the caller
  itself.

## In this app

Three roles in one organization, and a second organization that must see nothing:

- **Viewer, editor, admin of `org_prairie`**: all may read `ImportResult` and the Items page. Today every read handler
  checks only membership; writes start with `requireRole("editor")` (`packages/catalog/model/src/Import/Imports.handler.ts`)
  and people changes with `requireRole("admin")` (`packages/access/model/src/People/People.handler.ts`). The same split
  holds for views: `ImportResult.validate` checks the organization only.
- **Who decided each row** (`importDecision`, with its member): a separate `ImportDecisions` view whose `validate` also
  calls `Member.allows(actor, "editor")`, so a viewer is refused the whole view rather than shown a view with names
  blanked.
- **The day's model-call allowance per member**: an `AllowanceUsage` view keyed by `OrganizationId`, `validate` by key
  and `Member.allows(actor, "admin")`.
- **A member of `org_northline`**: every one of these reads fails with `NotInOrganization`, and a live read of an
  `org_prairie` key ends with it.

- **Used today:** no. Each read handler takes the organization from `CurrentActor` and puts it in the SQL `WHERE`
  (`packages/catalog/host/src/ItemStore.adapter.ts`, `scoped`), so another organization's row is never found.
- **Where it goes:** one `*.validate` per view next to its declaration in `packages/catalog/model/src/Import/`, merged into
  the model's handlers Layer; the rule function in `packages/kernel/src/Actor.context.ts` beside `requireRole`.
- **What the person gets:** nothing they can see; a member of another organization is refused with a typed reason.

## How to check it

- Ask through the Api's `clientInProcess`, as a member of each role and of the other organization, and assert the
  rejection (the docs' "Testing an Api"). A `Story` alone does not prove `validate`: `packages/domain/src/Story.ts`
  never calls a view's validator (its only mention of a read's `validate` is a stale doc on the query step, line 475 at
  beta.87, 484 on main).
- For live reads, start `watch` as an editor, then change the key so `validate` refuses (move it to another
  organization in a test model) and assert the stream ends with the rejection.
- On beta.87, a test whose `validate` refuses a key with no events after `after` gets `CaughtUp`, not the rejection,
  and the read stays open: that is the `CaughtUp` gap above, fixed on main. None of this was run: the trials on
  2026-11-19 ran no view and no Api read on either ref.
- The model fails to build with `UnvalidatedRead` when a guarded view has no Layer.

## What it needs

An Api with a session middleware that provides `CurrentActor` (see [Sessions](./sessions.md) and
[Better Auth](./better-auth.md)). Any host. The gaps above are closed only on main (`main@dbfd0ddb`, not on npm).

## Verdict

**Use, from main:** give every view and stream `middleware: [Session]` and `rejects`, with a `validate` that checks the
organization (and the role, for an audience-specific view). Taking it from `main@dbfd0ddb` (commit `794557619`) is what
makes a refused caller learn nothing; on beta.87 the declaration and `get`/`list`/`watch` checks work, but `events`,
a reconnecting `watch` and `atLeast` reads can tell a member of another organization whether one of its keys exists
and moved, so beta.87 is not safe for a view whose key or history is itself private to one organization.

## Where this was read

- https://alchemy.run/domain/view-security (the live site documents beta.87)
- `website/src/content/docs/domain/view-security.mdx` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same
- `packages/domain/src/Read.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same
- `packages/domain/src/Watch.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed
- `packages/domain/src/Api.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed
- `packages/domain/src/Model.ts`, `Story.ts`, `ReadRpcs.ts`, `Query.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`:
  changed
