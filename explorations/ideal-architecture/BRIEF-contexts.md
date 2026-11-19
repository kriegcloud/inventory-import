---
type: Brief
title: "Brief: contexts"
description: The goal contexts, step 7 of the order of work. The app's product code is cut into two bounded contexts, access (who may do what) and catalog (items and the imports that write them), each as contract, model, host and web packages, with the HTTP contract brought to the schema rules on the way (DateTime timestamps, Option for absence, tagged unions for every case set) and the app left holding only the assembly.
---

# Brief: `contexts`

Step 7 of the order of work in [README.md](README.md), after [BRIEF-ui-packages.md](BRIEF-ui-packages.md). It rests on
the answered decisions "core", "packages", "file naming", "strictness", "schema form", "client state", "rules reach",
"CurrentActor", "kernel identity" and "model status types" in [DECISIONS.md](DECISIONS.md); on sections 1, 2, 4 and
8 of [research/04-beep-direction.md](research/04-beep-direction.md), section 3 of
[research/03-effect-modules.md](research/03-effect-modules.md) and "Modelling C" of
[research/01-alchemy-domain.md](research/01-alchemy-domain.md); and on the closing note of
[goals/kernel-drivers/PLAN.md](../../goals/kernel-drivers/PLAN.md). Where this brief and a report differ, this brief is
the later word and says why ("Where the research was wrong").

## Problem

1. **Everything product-shaped lives in the app.** The contract is one 1,018-line `src/api/v1/Api.ts` with seven
   groups and three satellite files; the server is sixteen services in `src/server`; the rules are eleven modules in
   `src/domain`; the screens import all of it through `@/`. Nothing stops one area from reading another's storage,
   and one does: `Items.ts` imports `itemColumns` and `ItemRow` from `Imports.ts`.
2. **The contract breaks the schema rules** (`docs/standards/schema-first.md`). Counted from the code, outside the
   kernel and the drivers:

   | File | `.annotate(` calls (SF-1 where on a key) | SF-2 times as text | SF-4 `S.NullOr` / optional keys | SF-6 literal flags or parts per case | SF-3/5 `trim`, case or `??` in code |
   | --- | --- | --- | --- | --- | --- |
   | `api/v1/Api.ts` | 25 | 7 `instant()` | 5 / 3 | `RowOutcome` (`reason` empty and `decidedBy` null per outcome), `discarded`/`removed` booleans, `ImportView.status` beside `result` | — |
   | `api/v1/Identity.ts` | 2 | — | 3 / 0 | `SessionState` (`status` beside a nullable `email` and `actor`) | — |
   | `api/v1/People.ts` | 4 | `joinedAt` | 2 / 0 | `{ removed: true }` | lower-case in the service |
   | `domain/Item.ts` | 24 | `firstReceivedOn`, `discontinuedOn` as text | 8 / 0 | `isActive` beside `discontinuedOn` | 10 / 2 |
   | `domain/ItemImport.ts` | 15 | — | 12 / 16 | `RowDecision` (`out`, `kept`, `stored`), `ColumnMatch` (`how` beside nullable `column` and `header`), `Suggestion` (`kind` beside nullable `rowId`, `rowNumber`, `column`, `model`), `Change` (`how` beside nullable `basis`, `confidence`) | 51 / 25 |
   | `domain/ItemQuery.ts` | 12 | — | 2 / 0 | — | — |
   | `domain/TableView.ts` | 16 | — | 4 / 0 | `ViewAnswer`/`ViewRefusal` (`by` beside a nullable `model`, a second `AnsweredBy`), `ColumnChange` (`kind` of two values) | 13 / 7 |
   | `domain/Upload.ts` | 1 | — | 2 / 0 | `UploadState.Reading` (`exact` beside a nullable `rowsAbout`) | — / 2 |
   | `domain/Spreadsheet.ts`, `FileProblem.ts` | 15 | — | 0 / 4 | — | — / 2 |
   | `server/Imports.ts` | 14 | stored as text | 11 / 0 | `CommitRow.status`, `ChoicesSaved` as TypeScript unions | — / 5 (`changedBy ?? ""` reaches the wire) |
   | `server/ImportHandlers.ts` | — | — | — | — | 4 (`importedAt ?? ""` reaches the wire) |
   | `server/Items.ts` | 8 | — | 4 / 0 | `EditOutcome` as a TypeScript union | 3 / 0 |

   No id of the catalog is branded (`importId`, `memberId` in a path, `batchId`, `item.id`, `rowId` are plain
   strings); every literal union is `S.Literals`; every sentence an error carries is an unbounded string.
3. **Service signatures are not data.** `Imports`, `Items` and `People` take `memberId: string`, return TypeScript
   unions (`EditOutcome`, `CommitRow`, `ChoicesSaved`, `StoredDecisions`) and `Members.findByUser` takes
   `OrganizationId | null`. None of it can be generated, tested by property, or swapped for a twin.
4. **The model allowance belongs to one area and is called from three.** `ModelCalls` (who may spend what) is taken
   in `TableAssistant.ts`, `Suggestions.ts` and the `checkAi` handler, each importing the service directly.

## Appetite

Scope, not time. In:

- Eight packages: `@inventory/access-{contract,model,host,web}` under `packages/access/` and
  `@inventory/catalog-{contract,model,host,web}` under `packages/catalog/`, access first, each package with the app
  switched over and green before the next starts.
- One package the two web packages share, `@inventory/client` (`packages/client`): decision (C1).
- The contract brought to SF-1 to SF-9, in the app first, one shape per commit with the screens that read it, then
  moved: timestamps to `DateTime`, absence to `Option`, defaults onto schemas, every case set to a tagged union, ids
  branded.
- No migration of stored rows: every table keeps its columns and every JSON column its bytes; adapters convert.

Out: everything in No-gos. The goal is done when `apps/inventory/src/domain` and `src/server` hold nothing a context
owns, `src/api/v1` holds only the assembly and the system group, and every screen works as before (save the visible
changes this brief lists and Benjamin accepts).

## Sketch

Contract first, then the model, then the host, then the web package, for each context. Every Effect name was checked
in effect 4.1.4's source (`node_modules/effect/src`); a sketch marked **not compiled** was read from source only.
Conventions for every schema are those of [BRIEF-kernel-drivers.md](BRIEF-kernel-drivers.md) ("Conventions for every
schema below"), with three reminders: a field's description is `S.annotateKey` first in its pipe; a field that is
`null` on the wire today becomes `Option` through `S.OptionFromNullOr`, and an optional key through
`S.OptionFromOptionalKey`, so the wire keeps its bytes; a case set is a `LiteralKit` mapped to member schemas and
closed with `S.toTaggedUnion(<discriminator>)`, keeping today's discriminator name where there is one. `LiteralKit`
needs the narrow vendored patch that restores it to Worker-side packages, which lands on `main` before this goal is
built. `Sentence`, `DisplayName`, `Instant`, ids and `Role` are the kernel's.

### The dependency direction

```
                          @inventory/kernel ─────────────────────────────┐
                         ▲  ▲   ▲   ▲   ▲   ▲                            │
   foundation (@beep/identity, @beep/schema, @beep/utils, @beep/csv)     │
                         ▲  ▲   ▲   ▲   ▲   ▲                            │
 access-contract ◄── access-model ◄── access-host ──► drivers (@beep/d1, @beep/better-auth)
        ▲                  │                ▲
        │                  └─ ports ◄───────┘ (implements)
        │
        ├────────────────────────────────── catalog-host ──► drivers (@beep/d1, @beep/openrouter)
        │ (gateway ModelAllowanceGateway)        │  implements catalog-model's ModelAllowance port over it
 catalog-contract ◄── catalog-model ◄────────────┘
        ▲                  ▲
        │                  │ (pure rules only: the same review the server runs)
 catalog-web ──────────────┘          access-web ──► access-contract
        │ └► @inventory/ui, @inventory/review, @inventory/client ◄┘
        ▼
 apps/inventory: assembles Api from the groups, composes the hosts' Layers, mounts the web packages' screens
```

In types, for each context `X`:

```ts
type Allowed = {
  "X-contract": "kernel" | "foundation"
  "X-model": "X-contract" | "kernel" | "foundation"                       // no driver, no host, no other model
  "X-host": "X-model" | "X-contract" | "other-contract" | "kernel" | "foundation" | "driver"
  "X-web": "X-contract" | "X-model(rules)" | "kernel" | "ui" | "review" | "client" | "foundation"
  "app": "*-host" | "*-web" | "*-contract" | "kernel" | "driver" | "ui" | "client"
}
```

Enforced three ways:

1. **Package dependencies.** Each `package.json` names only what its row allows. bun hoists one `node_modules`, so an
   undeclared import still resolves; therefore
2. **`scripts/check-boundaries.mjs`** (root `check`): reads every workspace's `package.json` (`beep.family`,
   `beep.context`, `beep.layer`) and every import specifier under its `src` and `test`, and fails on an import of a
   package not declared, or declared against the table above (a model importing a host, a web package importing
   another context's anything, a contract importing a driver, any package importing `apps/`).
3. **A purity type in `<Context>.ports.ts`** (research 04, M10): every handler is registered through
   `handlersOf({...})`, whose parameter type admits only Effects whose requirements are the context's ports, the
   kernel's contexts and Effect's platform services; a handler that yields an undeclared service does not compile
   (`<Context>.ports.test.ts` keeps one `// @ts-expect-error` case to prove it bites).

### 0. `@inventory/client` (`packages/client`), shared by both web packages (decision (C1))

The browser's seam to the API, with no contract in it: both context web packages need `call`, `callWrite`, the
optimistic write with per-change undo, `sayError`, the query client and the signed-in member, and neither may import
the other or the app.

| File | Exports | From today |
| --- | --- | --- |
| `ApiRuntime.runtime.ts` | `ApiRuntime` (a React context holding the app's `ManagedRuntime`), `call(tag, use)`, `callWrite(tag, use)`, `fork(tag, use)`, `runExit`, `newRequestId` | `lib/api.ts` without the client construction |
| `Optimistic.controller.ts` | `useOptimisticWrite`, `cacheChange`, `rollback` | `lib/optimistic.ts`, `lib/rollback.ts` |
| `SayError.controller.ts` | `sayError`, `toastError`, `isTransient`, `Said` | `lib/errors.ts` without the model sentences (an `AiUnavailable` already carries its sentence as `reason`) and without `answeredByLine` (catalog's) |
| `QueryClient.runtime.ts` | `queryClient`, `freshFor`, `QueryPrefix` (the top-level key words both contexts invalidate: `identity`, `people`, `activity`, `imports-open`, `imports-past`, `import`, `import-table`, `items`, `changes`) | `lib/queries.ts` without the keys |
| `CurrentMember.controller.ts` | `CurrentMemberProvider`, `useMember` (the kernel's `Member`, set once the session is `ready`) | `useActor`'s read side |
| `Early.runtime.ts`, `Http.runtime.ts` | `early`, `takeEarly`, `forgetEarly`; `request` (the one `fetch` the browser makes) | `lib/early.ts`, `lib/http.ts` |

Dependencies: `effect`, `@inventory/kernel`, React, `@tanstack/react-query`, `sonner`. `"beep": { "family": "web-kit" }`.
`call(tag, use)` takes the client's `Context.Service` tag a web package declares (`AccessClient`, `CatalogClient`), so
the app builds one `ManagedRuntime` with one `HttpApiClient.make(Api)` and provides both tags from it: one runtime,
one DevTools connection (`lib/devtools.ts`'s rule).

### 1. `access`: who may do what

People and their roles, the session as the browser sees it, the audit trail's read side, and the daily model
allowance. Its tables: `user`, `session`, `account`, `verification`, `invitation`, `organization`, `member` (shared
with Better Auth), `activity` (read side; every host writes its own lines), `modelCall`.

#### 1.1 `access-contract` (`packages/access/contract`)

**Ids.** None new: `MemberId`, `OrganizationId`, `UserId`, `ActivityId` are the kernel's.

**Reads** (`Session/SessionState.read.ts`, `People/Person.read.ts`, `Activity/AuditTrail.read.ts`)

| Schema | Definition | Behaviour beside it |
| --- | --- | --- |
| `AccountEmail` | `S.String.check(S.isMaxLength(254), S.isPattern(/^[^\s@]+@[^\s@]+$/))`, branded | |
| `OrganizationChoice` | `{ id: OrganizationId, name: DisplayName }` | |
| `Membership` | `{ organizationName: DisplayName, role: Role }` | |
| `TestAccount` | `{ email: AccountEmail, name: DisplayName, memberships: S.Array(Membership) (at most 20) }` | |
| `TestAccountsOffer` | `{ password: S.String (1 to 128), accounts: S.Array(TestAccount) (at most 50) }` | |
| `SignInFeatures` | `{ testAccounts: Option<TestAccountsOffer> (OptionFromNullOr), pwnedPasswordCheck: S.Boolean }` | |
| `SessionStatus` | `LiteralKit(["signed-out", "no-organization", "ready"])` | |
| `SessionState` | by `status`: `signed-out { features }`; `no-organization { email: AccountEmail, organizations: S.Array(OrganizationChoice), features }`; `ready { email, actor: Member, organizations, features }` | `SessionState.actor(state)`: `Option<Member>`; `SessionState.match` at every branch of the sign-in gate |
| `Person` | `{ memberId: MemberId, name: DisplayName, email: Option<AccountEmail> (OptionFromNullOr), role: Role, joinedAt: Option<Instant> (OptionFromNullOr) }` | |
| `AuditTrail` | `S.Array(Activity.json)`, at most 500 lines, newest first | |

**Commands** (`People/People.command.ts`)

| Schema | Definition | Behaviour beside it |
| --- | --- | --- |
| `EmailToFind` | `S.Trim`, then `SchemaGetter.toLowerCase()` on decode (passthrough on encode), then `AccountEmail` | the lookup key; the service no longer lower-cases (SF-3) |
| `AddPerson` | `{ email: EmailToFind, role: Role }`, each with `messageMissingKey` as today | |
| `ChangeRole` | `{ role: Role }` | |
| `AddPersonProblemKind` | `LiteralKit(["noAccount", "alreadyMember"])` | |
| `AddPersonProblem` | `S.Opaque` over `S.TaggedStruct("AddPersonProblem", { kind: AddPersonProblemKind, problem: Sentence, todo: Sentence })` | keeps today's `_tag` on the wire |
| `AddPersonOutcome` | `S.Result(Person, AddPersonProblem)` | as today |

**Rejections** (`People/People.rejection.ts`; every one `{ reason: Sentence }`, `S.TaggedError` with its status):
`PersonNotFound` (404), `LastAdmin` (409). The kernel's `Forbidden` and `NotSignedIn` stay where they are.

**The allowance gateway** (`Allowance/ModelAllowance.gateway.ts`), what another context may ask of `access`:

```ts
export const dailyModelCalls = 40
export const ModelCallPurpose = LiteralKit(["view", "check", "suggest"])        // the modelCall.kind CHECK
export const AllowanceAnswer = AllowanceAnswerKind.mapMembers(() => Tuple.make(
  Taken,                                   // { kind: "taken" }
  UsedUp                                   // { kind: "usedUp", reason: Sentence }
)).pipe(S.toTaggedUnion("kind"))
export class ModelCallsUsedUp extends S.TaggedError<ModelCallsUsedUp, { readonly brand: unique symbol }>($I`ModelCallsUsedUp`)(
  "ModelCallsUsedUp", { reason: Sentence }, $I.annoteError<ModelCallsUsedUp>("ModelCallsUsedUp", { httpApiStatus: 429, description: "..." })) {}
export class ModelAllowanceGateway extends Context.Service<ModelAllowanceGateway, {
  /** One call from the actor's organization's allowance, taken before the call is made. */
  readonly take: (purpose: ModelCallPurpose) => Effect.Effect<AllowanceAnswer, never, CurrentActor>
}>()($I`ModelAllowanceGateway`) {}
```

**Groups** (`Access.contract.ts`): `IdentityApi` (`session` open; `members`, `me` behind `Identity`), `PeopleApi`
(`list`, `add`, `setRole` and `remove` with `params: { memberId: MemberId }`), `ActivityApi` (`recent`). Endpoints,
summaries and descriptions as today; `people.remove` answers `HttpApiSchema.NoContent` (decision (A2)).

**What changes on the wire** (an API client sees each "yes"; no stored row changes for any of them):

| Shape | Before | After | Client sees |
| --- | --- | --- | --- |
| `GET /identity/session`, signed out | `{"status":"signed-out","email":null,"actor":null,"organizations":[],"features":{...}}` | `{"status":"signed-out","features":{...}}` | yes: keys gone |
| same, no organization | `{"status":"no-organization","email":"...","actor":null,"organizations":[...],"features":{...}}` | `actor` gone | yes |
| same, ready | as today | as today | no |
| `Person.email`, `Person.joinedAt` | `string \| null` | the same text, `Option` in code | no (a stored `joinedAt` that is not a date now fails to decode: rabbit hole) |
| `Person.memberId`, `/:memberId` in a path | any string up to 64 | `MemberId` (`[A-Za-z0-9_-]{1,64}`) | a malformed id answers 400 instead of 404 |
| `DELETE /people/:memberId` | 200 `{"removed":true}` | 204, no body | yes (decision (A2)) |
| `AddPersonProblem.problem` for `noAccount` | names the email as typed | names it lower-cased (decision (A3)) | yes, in words |
| `ModelCallsUsedUp`, `AuditTrail` | as today | as today | no |

#### 1.2 `access-model` (`packages/access/model`)

Pure rules, the ports a handler may use, in-memory twins, and the handlers. No SQL, no driver, no HTTP.

**Rules** (`.rules.ts`, pure, each with its test)

| File | Exports | Rule |
| --- | --- | --- |
| `People/LastAdmin.rules.ts` | `keepsAnAdmin(members, member, next: Option<Role>)`, `lastAdminSentence(person, organization)` | an organization keeps a linked admin; the D1 adapter asserts the same condition inside the statement that writes (below) |
| `People/AddPerson.rules.ts` | `noAccount(email)`, `alreadyMember(person, organization)`, `sameAdd(existing, role)` | an add asked again for the role the person has is the same add (today's retry rule) |
| `Session/Session.rules.ts` | `sessionStateOf(user, actor, organizations, features)`, `notSignedInReason(user)` | the two sentences of today's `SessionIdentityLive` |
| `Allowance/Allowance.rules.ts` | `windowStart(now)` (24 hours back), `usedUpSentence(purpose)` | the allowance comes back by itself a day later |

**Ports** (`.store.ts` each with an in-memory twin as a static `memory` Layer; data they pass is schemas in the same file)

```ts
// Session/MemberDirectory.store.ts: who a signed-in user acts as. Not scoped to one organization, like today's Members.
export class SignedInUser extends S.Opaque<SignedInUser, { readonly brand: unique symbol }>()(S.Struct({
  userId: UserId, email: AccountEmail, active: S.Option(OrganizationId) })) {}
export class MemberDirectory extends Context.Service<MemberDirectory, {
  readonly actorFor: (user: SignedInUser) => Effect.Effect<Option.Option<Member>>      // active org, else earliest
  readonly organizationsOf: (user: UserId) => Effect.Effect<ReadonlyArray<OrganizationChoice>>
  readonly inOrganization: (organization: OrganizationId) => Effect.Effect<ReadonlyArray<Member>>
  readonly testAccounts: (users: ReadonlyArray<UserId>) => Effect.Effect<ReadonlyArray<TestAccount>>
}>()($I`MemberDirectory`) { static readonly memory: (seed: DirectorySeed) => Layer.Layer<MemberDirectory> }

// People/PeopleStore.store.ts: every write carries its audit line, written in the same atomic batch or not at all.
export class Account extends S.Opaque<Account, ...>()(S.Struct({ userId: UserId, name: DisplayName })) {}
export const AddWrite = ...     // by kind: added { person } | alreadyMember { existing: Option<Person> }
export const RoleWrite = ...    // by kind: changed { person } | lastAdmin {} | missing {}
export const RemoveWrite = ...  // by kind: removed {} | lastAdmin {} | missing {}
export class PeopleStore extends Context.Service<PeopleStore, {
  readonly list: (organization: OrganizationId) => Effect.Effect<ReadonlyArray<Person>>
  readonly find: (organization: OrganizationId, member: MemberId) => Effect.Effect<Option.Option<Person>>
  readonly accountByEmail: (email: AccountEmail) => Effect.Effect<Option.Option<Account>>
  readonly add: (write: { readonly member: MemberId; readonly account: Account; readonly role: Role;
                          readonly audit: Activity }) => Effect.Effect<AddWrite>
  readonly setRole: (write: { readonly member: MemberId; readonly role: Role; readonly before: Role;
                              readonly audit: Activity }) => Effect.Effect<RoleWrite>
  readonly remove: (write: { readonly member: MemberId; readonly audit: Activity }) => Effect.Effect<RemoveWrite>
}>()($I`PeopleStore`) { static readonly memory: (seed: PeopleSeed) => Layer.Layer<PeopleStore> }

// Activity/AuditTrailStore.store.ts
export class AuditTrailStore extends Context.Service<AuditTrailStore, {
  readonly recent: (organization: OrganizationId) => Effect.Effect<ReadonlyArray<Activity>>   // newest 500
  readonly count: (organization: OrganizationId) => Effect.Effect<number>
}>()($I`AuditTrailStore`) { static readonly memory: (lines: ReadonlyArray<Activity>) => Layer.Layer<AuditTrailStore> }

// Allowance/AllowanceStore.store.ts: the count and the taking are one statement, so two requests cannot both take the last call.
export class Reservation extends S.Opaque<Reservation, ...>()(S.Struct({ id: S.String.check(S.isUUID()),
  organization: OrganizationId, actor: MemberId, purpose: ModelCallPurpose, at: Instant, since: Instant,
  limit: S.Int.check(S.isBetween({ minimum: 1, maximum: 10_000 })) })) {}
export class AllowanceStore extends Context.Service<AllowanceStore, {
  readonly take: (reservation: Reservation) => Effect.Effect<boolean>
}>()($I`AllowanceStore`) { static readonly memory: Layer.Layer<AllowanceStore> }
```

The `organization` of a write is the audit line's (`Activity.organizationId`), which the handler takes from
`CurrentActor`; no port method takes an organization from anywhere else.

**Handlers** (`.handler.ts`, `Effect.fn`, registered through `handlersOf`)

| Handler | Signature | Behaviour |
| --- | --- | --- |
| `listPeople` | `() => Effect<ReadonlyArray<Person>, never, CurrentActor \| PeopleStore>` | |
| `addPerson` | `(command: AddPerson) => Effect<AddPersonOutcome, Forbidden, CurrentActor \| PeopleStore \| SecureRandom>` | `requireRole("admin")`; no account: `noAccount`; `alreadyMember` with the same role: the person (nothing written) |
| `changeRole` | `(member: MemberId, command: ChangeRole) => Effect<Person, Forbidden \| PersonNotFound \| LastAdmin, CurrentActor \| PeopleStore \| SecureRandom>` | the audit line is written only if the role was |
| `removePerson` | `(member: MemberId) => Effect<void, Forbidden \| PersonNotFound \| LastAdmin, ...>` | |
| `sessionState` | `(user: Option<SignedInUser>, features: SignInFeatures) => Effect<SessionState, never, MemberDirectory>` | |
| `actorOf` | `(user: Option<SignedInUser>) => Effect<Member, NotSignedIn, MemberDirectory>` | the identity middleware's rule |
| `recentActivity`, `activityCount` | `() => Effect<..., never, CurrentActor \| AuditTrailStore>` | |
| `ModelAllowanceGatewayLive` | `Layer<ModelAllowanceGateway, never, AllowanceStore>` | `take`: no call left is `usedUp` with the sentence; `Clock` and `SecureRandom` from the platform |

`Access.ports.ts`: `type AccessPorts = MemberDirectory | PeopleStore | AuditTrailStore | AllowanceStore`, the
`handlersOf` purity type over `AccessPorts | CurrentActor | CurrentAgent | SecureRandom.SecureRandom`.

#### 1.3 `access-host` (`packages/access/host`)

| File | Exports | From today |
| --- | --- | --- |
| `MemberDirectory.adapter.ts` | `MemberDirectoryD1: Layer<MemberDirectory, never, SqlClient>` | `server/Members.ts` |
| `PeopleStore.adapter.ts` | `PeopleStoreD1: Layer<PeopleStore, never, SqlClient \| D1>` | `server/People.ts` |
| `AuditTrailStore.adapter.ts` | `AuditTrailStoreD1` | `server/Activities.ts` |
| `AllowanceStore.adapter.ts` | `AllowanceStoreD1` | `server/ModelCalls.ts` |
| `SessionIdentity.adapter.ts` | `SessionIdentityLive: Layer<Identity, never, BetterAuth \| MemberDirectory>` | `server/SessionIdentity.ts` (decodes `AuthSession` into `SignedInUser`, then `actorOf`) |
| `SignIn.route.ts` | `signIn(options)`, `SignInRoute` | `server/SignIn.ts`, `authOptions.ts` (internal), `TestAccounts.ts` (internal) |
| `Config.ts` | `authSettings`, `signInFeaturesFrom(settings, accounts)` | the sign-in part of `server/Settings.ts` |
| `Access.http.ts` | `identityHandlers`, `peopleHandlers`, `activityHandlers`: the build functions the app passes to `HttpApiBuilder.group(Api, ...)` | `server/handlers.ts` (identity, people, activity) |
| `Adapters.ts` | `AccessAdaptersD1 = Layer.mergeAll(...)` | |
| `Host.ts` | `AccessLive: Layer<AccessPorts \| ModelAllowanceGateway \| Identity, never, SqlClient \| D1 \| BetterAuth>` | part of `server/App.ts` |
| `AccessTest.test-layer.ts` | `HeaderIdentity` (today's `IdentityLive`), `AccessTest.memory(seed)` | `server/Identity.ts`; kept out of the Worker by `check-production-identity.mjs` |
| `internal/auditLine.ts` | the guarded `INSERT INTO activity ... SELECT ... WHERE <guard>` from an `Activity` | the four copies in today's services |

**Atomic writes, unchanged.** `PeopleStoreD1.setRole` sends today's two statements in one `d1.batch`: the `UPDATE
member ... WHERE ... AND (role != 'admin' OR <another linked admin>) RETURNING id`, then the audit line guarded by
the same condition; it answers `changed` when the first returned a row, `lastAdmin` when the person exists and it
did not. `remove` puts the guarded audit line first, as today. `AllowanceStoreD1.take` keeps the single
`INSERT ... SELECT ... WHERE (SELECT COUNT(*) ...) < limit RETURNING id`. The memory twins implement the same answers
from `LastAdmin.rules.ts`; the D1 SQL keeps its own guard, because two admins demoting each other at the same moment
is only refused by the statement (the rule's comment says so).

**The handlers' groups.** `HttpApiBuilder.group(api, name, build)` keys its Layer by the api's id and the group's
name and routes through the assembled api's prefix and middleware (`HttpApiBuilder.ts`, `group` and
`handlerToRoute`), so the group Layer is built in the app against the real `Api`; the host exports `build` (rabbit
hole: its type against the prefixed group).

#### 1.4 `access-web` (`packages/access/web`)

| File | Exports | From today |
| --- | --- | --- |
| `Access.runtime.ts` | `AccessClient` (`Context.Service` over `HttpApiClient.Client<IdentityApi \| PeopleApi \| ActivityApi>`), `accessKeys` | `lib/api.ts` (the client's type), `lib/queries.ts` (`session`, `members`, `people`, `activity`) |
| `Session.controller.ts` | `useSession`, `wasSignedIn`, `signedOutHere`, `sessionQuery`, `decodeSession` | `lib/actor.ts`, `lib/session.ts`, `lib/auth-client.ts` (internal) |
| `SignIn.screen.tsx` | `SignIn` | `pages/SignIn.tsx` |
| `People.screen.tsx` | `PeoplePage` | `pages/PeoplePage.tsx` (optimistic role change through `@inventory/client`) |
| `AuditEvents.screen.tsx` | `AuditEvents` (the Activity page's "Events" list) | part of `pages/ActivityPage.tsx` |

TanStack Query stays (decision "client state"): the session query, people, activity. The People page's optimistic
role change keeps `useOptimisticWrite`. Screens read `Option` with `Option.match` and dates with `DateTime`
(`joinedAt`), and the sign-in gate (`SignedIn.tsx`, which stays in the app) branches with `SessionState.match`.

### 2. `catalog`: items and the imports that write them

Items, the upload and staging of a file, the review and its decisions, the confirm and the take-back (they share one
atomic write with the items), the result and history, the changed values, suggestions and the table assistant.
Its tables: `importUpload`, `importUploadChunk`, `importDraft`, `importChunk`, `importDecision`,
`importSuggestion`, `importBatch`, `item`, `itemSearch` (with its three triggers), `importReplaced`, `importOutcome`,
`importChange`; and its own `activity` lines (recorded exception, decision "packages" and research 04 decision 14).

#### 2.1 `catalog-contract` (`packages/catalog/contract`)

Modules: `Item/`, `Import/`, `Staging/`, `Suggestion/`, `Assistant/`, `Answer/`; the groups in `Catalog.contract.ts`.

**Ids** (`Catalog.id.ts`)

| Schema | Definition | Behaviour beside it |
| --- | --- | --- |
| `ImportId` | UUID, branded: the upload's id, then the import's | |
| `UploadKey` | 1 to 64 characters, branded: chosen by the browser per file | |
| `ItemId`, `ConfirmId`, `SuggestionId` | UUID, branded (`ConfirmId` is today's `batchId`) | |
| `RowNumber` | `S.Int`, 1 to 1,048,576: the row Excel shows | |
| `Part` | `S.Int`, 1 to 1,000: which item of a row that holds several | |
| `RowId` | `^row-[1-9][0-9]{0,6}(\.[1-9][0-9]{0,3})?$`, branded | `RowId.of(rowNumber, part: Option<Part>)` (today's `rowId`) |
| `ColumnIndex` | `S.Int`, 0 to 199 | |
| `Revision` | `S.Int` ≥ 1 | |

**Items** (`Item/Item.read.ts`, `Item/ItemQuery.read.ts`)

| Schema | Definition | Behaviour beside it |
| --- | --- | --- |
| `Sku` | `^[A-Z]{3}-[0-9]{4}$` | |
| `SkuKey` | `S.String` decoded with spaces removed and upper-cased (`SchemaGetter`), branded | `SkuKey.of(sku)` (today's `skuKey`) |
| `ItemName` | 1 to 120 characters with one that is not a space | |
| `Category`, `Uom` | `LiteralKit(categories)`, `LiteralKit(uoms)` | |
| `UnitCost` | `S.BigDecimalFromString` checked: not negative, at most 4 decimals and 12 whole digits (decision (C2)) | `UnitCost.cents`, sums (today's `decimalUnits`) |
| `StockCount` | `S.Int`, 0 to 999,999,999,999 | |
| `CalendarDay` | `^\d{4}-\d{2}-\d{2}$` and a real day, branded (deviation 2) | `CalendarDay.of` (today's `isoDate`) |
| `Dimensions` | `{ length, width, height: S.Finite > 0, unit: LiteralKit(["cm", "in"]) }` | |
| `Vendor` | `{ vendorName: 1 to 200, vendorSku: Option<1 to 200>, unitCost: UnitCost, leadTimeDays: Option<StockCount>, isPreferred: S.Boolean }` | |
| `Stocking` | by `kind`: `active {}`, `inactive {}`, `discontinued { on: CalendarDay }` | replaces `isActive` and `discontinuedOn`; "discontinued and active" can no longer be said |
| `ItemFields` | `{ sku, name, description: Option<0 to 32,767>, category, uom, unitCost, quantityOnHand: StockCount, reorderPoint: Option<StockCount>, stocking: Stocking, lotTracked: S.Boolean, tags: S.Array(Tag) (default []), firstReceivedOn: Option<CalendarDay>, dimensions: Option<Dimensions>, vendors: S.Array(Vendor) (at most 3, at most one preferred, default []) }` | `ItemFields.of(item)` (today's `fieldsOf`) |
| `Item` | `{ id: ItemId, ...ItemFields.fields, createdAt: Instant, createdBy: DisplayName, revision: Revision }` (today's `StoredItem`) | |
| `ItemSort`, `ItemFilter`, `ItemQuery`, `ItemQueryParams` | as today, the literal unions as `LiteralKit`s, `ItemQueryParams.search` defaulted on the schema as today | |
| `ItemPage` | `{ data: S.Array(Item), pageCount, total }` | |
| `ItemFacets` | the cost and quantity bounds `Option` (`OptionFromNullOr`) | |

**Item commands and rejections** (`Item/Item.command.ts`, `Item/Item.rejection.ts`)

`ItemEdit`: `{ revision: Revision, name: ItemName, description, category, uom, unitCost, quantityOnHand,
reorderPoint, stocking: Stocking, lotTracked, firstReceivedOn }` with today's `messageMissingKey` texts. What
`editProblem` checks today is now in the schema (a name of only spaces, a day off the calendar, discontinued and
active), so the request is refused as a 400 problem document naming the field: decision (C3) on whether
`ItemInvalid` (422) goes. `ItemNotFound` (404) and `ItemChanged` (409, `{ reason, item: Item }`) as today.

**Staging** (`Staging/Staging.read.ts`)

`StagedCell { text: 0 to 32,767, shown: Option<...> (OptionFromOptionalKey) }`, `StagedRow { rowNumber: RowNumber,
cells }`, `StagedColumn { index: ColumnIndex, letter: ^[A-Z]{1,3}$, label }`, `StagedNote { kind: 1 to 40, level:
LiteralKit(["info", "warning"]), message, rows: S.Array(RowNumber) }`, `StagedHead` and `StagedTable` (`sheet`
`Option` through `OptionFromNullOr`, at most 200 columns and 50,000 rows), `FileProblemKind` (`LiteralKit`),
`FileProblem` (`S.Opaque` over `S.TaggedStruct("FileProblem", { kind, fileName, problem: Sentence, todo: Sentence })`),
`StagingOutcome(success)` as today. Their encoded sides are the bytes `importDraft.headJson` and `importChunk` hold.

**Import commands** (`Import/Import.command.ts`)

| Schema | Definition |
| --- | --- |
| `Field` | `LiteralKit(fields)`, the sixteen fields |
| `UploadStart` | `{ key: UploadKey, head: StagedHead, rowCount: S.Int 1 to 50,000, chunkCount: S.Int 1 to 100 }` |
| `UploadChunk` | `{ seq: S.Int 0 to 99, rows: S.Array(StagedRow) 1 to 500 }` |
| `MatchColumn` | `{ field: Field, column: Option<ColumnIndex> (OptionFromNullOr) }` |
| `RowPlace` | by `kind`: `open {}`, `kept {}`, `leftOut { wasKept: S.Boolean }`: the review package's union, the same rule (`@inventory/review/ReviewDecision`) |
| `StoredChoice` | by `kind`: `undecided {}`, `keep {}`, `replace {}`: what to do with a row whose SKU is stored with other values |
| `RowDecision` | decoded `{ place: RowPlace (default open), stored: StoredChoice (default undecided), accepted: S.Array(FieldKey) (default []), reverted (default []), edits: S.Record(FieldKey, CellText) (default {}) }`; encoded today's `{ out?, kept?, accepted?, reverted?, edits?, stored? }` |
| `SavedDecisions` | `S.Record(RowKey, RowDecision)`, at most 50,000 |
| `DecisionDelta` | `{ set: SavedDecisions, clear: S.Array(RowKey) (at most 50,000) }`, `messageMissingKey` as today |
| `MappingChoice` | decoded `{ field: Field, column: Option<ColumnIndex> }`; encoded today's `{ field, column: number \| null, by: "person" }` |
| `TakeBackRequest` | `{ confirms: S.Array(ConfirmId) 1 to 1,000 }` |

`FieldKey` and `RowKey` stay bounded text (40 characters, as today) rather than `Field` and `RowId`: a stored
decision with a key today's screen never wrote must still decode, or the import would answer 500 (M9).

**Import reads** (`Import/Import.read.ts`, `Import/Change.read.ts`, `Suggestion/Suggestion.read.ts`)

| Schema | Definition | Behaviour beside it |
| --- | --- | --- |
| `ImportStatus` | `LiteralKit(["open", "imported", "takenBack"])` | |
| `ColumnPick` | `{ index: ColumnIndex, header: S.String, examples: S.Array(S.String) (at most 5) }` | |
| `ColumnMatch` | by `how`: `heading { field, column: ColumnPick }`, `person { field, column: Option<ColumnPick> }` (`None`: no column, on purpose), `none { field }` | |
| `UnusedColumn` | `StagedColumn` plus `filled: S.Int ≥ 0` | |
| `ProgressCounts` | `{ needsAtStart, needs, decision, cannot, ready, fixedRows, fixedCells, rows }`, each `S.Int ≥ 0` | `needs = decision + cannot` checked |
| `DecidedBy` | by `kind`: `person { name: DisplayName }`, `nobody {}` | |
| `RowOutcome` | by `outcome`: `created`, `updated`, `takenBack` `{ rowNumber, part: Option<Part> (OptionFromOptionalKey), sku, name }`; `already { ..., reason: Sentence }`; `notImported { ..., reason: Sentence, decidedBy: DecidedBy }` | |
| `ImportResult` | `{ importedBy: DisplayName, importedAt: Instant, created, updated, already, notImported, takenBack: S.Int ≥ 0, fixed: { rows, cells }, rows: S.Array(RowOutcome) }` | the five counts add up to `rows.length` (a check) |
| `ImportEvent` | by `_tag` as today: `Confirmed { batchId: ConfirmId, by, at: Instant, ... }`, `TakenBack { ..., at: Instant }` | |
| `ChangedItem` | `{ sku, name, changedBy: Option<DisplayName>, changedAt: Option<Instant> }` | |
| `TakeBackState` | `{ confirms: S.Array(ConfirmId), removable, restorable, changedCount, keptCount: S.Int ≥ 0, changed, kept: S.Array(ChangedItem) (at most 20) }` | |
| `ImportView` | `{ id: ImportId, fileName, status: ImportStatus, startedBy: DisplayName, createdAt: Instant, rowCount, storedItems: S.Array(ItemFields), mapping: S.Array(ColumnMatch), choices: S.Array(MappingChoice), unusedColumns, createdRows: S.Array(RowNumber), createdIds: S.Array(RowId) (default []), decisions: SavedDecisions, suggestions: S.Array(Suggestion) (default []), revision: S.Int ≥ 0, progress: ProgressCounts, result: Option<ImportResult> (OptionFromNullOr), history: S.Array(ImportEvent), takeBack: TakeBackState }` | |
| `OpenImports`, `PastImport`, `PastImports` | as today, `PastImport.confirmedAt: Instant`, `status: ImportStatus` | |
| `ChangeSource` | `LiteralKit(["rule", "model", "person"])` | |
| `Change` | by `how`: `appliedByRule { field, from, to, basis: Sentence, confidence }` (source rule, decided by rule); `acceptedProposal { field, from, to, source: rule \| model, basis, confidence }`; `typed { field, from, to }` (source person) | replaces `source`, `decidedBy`, `how`, nullable `basis` and `confidence` |
| `ChangeRecord` | `{ importId, fileName, rowNumber, part: Option<Part>, sku, change: Change, decidedByName: Option<DisplayName>, createdAt: Instant, takenBack: S.Boolean }` | |
| `SuggestionBy` | by `kind`: `model { model: ModelName }`, `rule {}` | |
| `Suggestion` | by `kind`: `name { id, rowId: RowId, rowNumber, from, to, by: SuggestionBy, confidence: LiteralKit(["medium", "low"]), basis }`, `category { ...same }`, `column { id, field: Field, column: ColumnIndex, heading: S.String, by, confidence, basis }` | `Suggestion.fits(...)` (today's `suggestionFits`) |
| `SuggestOutcome` | `{ made, suggestions: S.Array(Suggestion), answeredBy: AnsweredBy, lines: S.Array(Sentence) }` | |

**Answers and the model** (`Answer/AnsweredBy.read.ts`, `Answer/AiUnavailable.rejection.ts`): `ModelName` (1 to
200 characters), `AnsweredBy` by `_tag`: `Model { provider: LiteralKit(["openrouter"]), model: ModelName, fallback }`,
`Rules { reason: Sentence }` (as today), `AiTrouble` (`LiteralKit`), `modelSentences`, `AiUnavailable` (503, `{ reason:
Sentence, kind: AiTrouble, retryable }`). They move here from the app (decision "model status types": they move with
the context that owns the features that answer); the app's system group imports them.

**The table assistant** (`Assistant/View.read.ts`, `Assistant/View.command.ts`)

`ViewChange` closed with `S.toTaggedUnion("kind")`: `sort`, `filter`, `search`, `show`, `hide`, `clear` (today's
`ColumnChange` splits in two; the `kind` values are the same, so the wire and the assistant's stored conversation keep
their bytes). `ViewCommand` as today. `ViewAnswer { changes, answeredBy: AnsweredBy, note: Option<Sentence> }` and
`ViewRefusal { reason: Sentence, answeredBy: AnsweredBy, note: Option<Sentence> }`: today's second `AnsweredBy`
(`by: "rules" | "model"` beside a nullable `model`) is replaced by the contract's one. `ViewRequest` as today.

**Rejections** (`Import/Import.rejection.ts`; each `{ reason: Sentence }`): `ImportNotFound` (404), `ColumnNotFound`
(404), `AlreadyImported` (409), `ImportKept` (409), `UploadNotFound` (404).

**Groups** (`Catalog.contract.ts`): `ImportsApi`, `ItemsApi`, `AssistantApi`, endpoints and words as today, path ids
as `ImportId` and `ItemId`; `discardUpload` answers `UploadDiscard` (by `kind`: `discarded {}`, `nothingToDiscard {}`);
`imports.remove` answers `HttpApiSchema.NoContent` (decision (A2)).

**What changes on the wire and in storage**

| Shape | Before | After | Client sees | Stored data |
| --- | --- | --- | --- | --- |
| Seven `instant()` fields and `Item.createdAt` | ISO text | the same text; `DateTime.Utc` in code | no | none |
| Every `null` field (`description`, `reorderPoint`, `firstReceivedOn`, `dimensions`, `vendorSku`, `leadTimeDays`, `result`, `sheet`, `column` in a match) | `null` | `null`; `Option` in code | no | none |
| `ImportResult.importedBy`/`importedAt`, `ChangedItem.changedBy`/`changedAt` | `""` when not stored | the result is `None` (no confirm yet); `changedBy`/`changedAt` are `Option`, `null` when not stored | yes: `null` instead of `""` | none |
| `ImportView.createdIds` | key left out when empty | always there | yes: additive | none |
| `isActive` + `discontinuedOn` on `Item`, `ItemFields`, `ItemEdit` | `"isActive":false,"discontinuedOn":"2024-06-19"` | `"stocking":{"kind":"discontinued","on":"2024-06-19"}` | yes | none: the columns stay; the adapter maps (the table's `CHECK` already refuses the impossible pair) |
| `unitCost` (decision (C2)) | the decimal text sent | canonical decimal text (`"12.50"` is stored as `"12.5"`, which the importer already does) | an edit sending trailing zeros reads them back without | none: every stored cost is already canonical (`readDecimal`) |
| `RowOutcome` in `ImportResult.rows` | every key, `reason: ""`, `decidedBy: null`, `decidedByName: null` | per outcome; `decidedBy: {"kind":"person","name":"…"}` or `{"kind":"nobody"}` | yes | none: `importOutcome` keeps its columns |
| `ColumnMatch` in `ImportView.mapping` | `{"field","column":3,"header":"Unit","how":"heading","examples":[...]}` | `{"how":"heading","field","column":{"index":3,"header":"Unit","examples":[...]}}` | yes | none: not stored |
| `Suggestion` | `kind`, nullable `rowId`/`rowNumber`/`column`/`model`, `by` | per kind; `by: {"kind":"model","model":"…"}` | yes | none: `importSuggestion` keeps its columns (`rowId` `''` for a column) |
| `Change` in `ChangeRecord` | `source`, `decidedBy`, `how`, nullable `basis`, `confidence` | `change: { how, ... }` per case | yes | none: `importChange` keeps its columns |
| `ViewAnswer`, `ViewRefusal` | `by`, `model` | `answeredBy` | yes | the assistant's conversation in `localStorage` stores `ViewChange` only, whose bytes do not change |
| `RowDecision` in `ImportView.decisions`, `DecisionDelta.set` | flags | the same flags | no | none: `importDecision.decisionJson` keeps its bytes |
| `MappingChoice` | `{ field, column, by }` | the same | no | none: `importDraft.choicesJson` keeps its bytes |
| `discardUpload` | `{"discarded":true}` | `{"kind":"discarded"}` | yes | none |
| `DELETE /imports/:id` | 200 `{"removed":true}` | 204 | yes (decision (A2)) | none |
| `PUT /items/:id` refused for a blank name or an impossible day | 422 `ItemInvalid` | 400 problem document naming the field | yes (decision (C3)) | none |
| ids in paths | any string up to 64 | `ImportId`, `ItemId` (UUID) | a malformed id answers 400 instead of 404 | none |

**No stored row is rewritten and no migration is added.** Every JSON column keeps its encoded schema; every column
read into an `Option` was nullable already; the timestamps the adapters read were all written by
`DateTime.formatIso`.

#### 2.2 `catalog-model` (`packages/catalog/model`)

The pure rules (the same functions the browser runs, which is why `catalog-web` may import them), the ports, their
twins, and the handlers.

**Rules** (from `src/domain`, split by Module; SF fixes as they move)

| File | From today |
| --- | --- |
| `Reading/Spreadsheet.rules.ts`, `Reading/SheetLayout.rules.ts`, `Reading/FileProblem.rules.ts` | `domain/Spreadsheet.ts`, `SheetLayout.ts`, `FileProblem.ts` (the `fileProblem` sentences) |
| `Staging/Staging.rules.ts`, `Staging/Upload.rules.ts` | `stageTable`, `stagingProblem`, `maxStagedRows`; `domain/Upload.ts` (chunks; `UploadState` goes to `catalog-web`) |
| `Review/Mapping.rules.ts` | `matchColumns`, `headingWords` |
| `Review/CellReading.rules.ts` | `readDecimal`, `readCount`, `readDate`, `dateReadings`, `readDimensions`, `readVendors`, `canonicalTags`, `itemText` |
| `Review/Review.rules.ts` | `review`, `ruleFor`, `recheckRow`, `firstDecisions`, `carryDecisions`, `dropAccepted`, `problemKinds`, `ruleFixes`, `ItemsOfRow` (a `Context.Reference`, today's `ImportShape.ts`) |
| `Review/NotImported.rules.ts` | `notImportedCsv` (through `@beep/csv`) |
| `Confirm/Confirm.rules.ts` | NET-NEW from `ImportHandlers.commit`: `confirmPlan(review, authors, actor)` → `ConfirmPlan` |
| `Item/ItemEdit.rules.ts`, `Item/ItemSearch.rules.ts`, `Item/ItemQuery.rules.ts` | `readItemForm`; `domain/ItemSearch.ts`; the filter narrowing that does not need SQL |
| `Suggestion/Suggest.rules.ts` | `domain/Suggest.ts` |
| `Assistant/TableView.rules.ts` | `checkCommand`, `rulesRead`, `readByRules`, `operatorsFor` |

The file readers in `CellReading.rules.ts` keep their `Str.trim` and case calls: there a trimmed or re-cased value is
a proposal the person sees as before and after, not a silent decode, so SF-3 does not apply (deviation 3).

`ConfirmPlan` (`Confirm/Confirm.rules.ts`): `{ draft: ImportId, rows: S.Array(PlannedRow) }`, `PlannedRow` by
`status`: `ready { rowNumber, part, sku, name, item: ItemFields, changes: S.Array(PlannedChange) }`, `update {
...same }`, `already { ..., reason }`, `notImported { ..., reason, decidedBy: DecidedBy }`, replacing today's
`CommitRow` TypeScript type and its `item: ... | null`.

**Ports** (each `.store.ts` with a `memory` twin)

| Port | Methods (inputs and answers are schemas in the same file) |
| --- | --- |
| `Import/ImportStore.store.ts` | uploads: `beginUpload(UploadBegin) → Result<ImportId, FileProblem>`, `findUpload(Owner, ImportId) → Option<Upload>`, `putChunk(Owner, Upload, UploadChunk) → Result<void, FileProblem>`, `uploadChunks`, `finishUpload(UploadFinish) → boolean`, `discardUpload(Owner, ImportId) → boolean`; drafts: `find`, `listOpen`, `listPast`, `table`, `decisions`, `decide(DecideWrite) → Option<Revision>`, `setChoices(ChoicesWrite) → ChoicesSaved` (by `kind`: `saved`, `same`, `closed`), `rewriteDecisions`, `reopen`, `remove(RemoveWrite) → boolean`, `createdRows`, `storedAmong(OrganizationId, ReadonlyArray<SkuKey>) → ReadonlyArray<Item>`; the two writes below; reads: `history`, `takeBackState`, `outcomes`, `fixed`, `changes` |
| `Item/ItemStore.store.ts` | `list`, `page(OrganizationId, SearchPlan, ItemQuery) → ItemPage`, `facets`, `edit(EditWrite) → EditWrite.Answer` (by `kind`: `edited { item }`, `same { item }`, `changed { item }`, `missing {}`: today's `EditOutcome`) |
| `Suggestion/SuggestionStore.store.ts` | `list(OrganizationId, ImportId)`, `store(StoreSuggestions) → ReadonlyArray<Suggestion>` (with its audit line) |
| `Assistant/AssistantLog.store.ts` | `record(Activity)`: the assistant's one line, which changes nothing else |
| `Answer/ModelAllowance.external.ts` | `take(purpose: CatalogModelPurpose) → Effect<AllowanceAnswer, never, CurrentActor>` (decision (C4) for the purpose list) |
| `Answer/Answerer.external.ts` | `status: ModelAvailability`; `ask(prompt: ModelQuestion, schema) → Effect<ModelAnswered<A>, AiUnavailable>`: the model, as catalog needs it |

The two writes that must stay one atomic batch each:

```ts
// Import/ImportStore.store.ts (not compiled)
export class ConfirmWrite extends S.Opaque<ConfirmWrite, { readonly brand: unique symbol }>()(S.Struct({
  draft: ImportId, fileName: S.String, confirm: ConfirmId, plan: ConfirmPlan,
  itemIds: S.Array(ItemId),                 // one per ready row, made by the handler
  audit: Activity                           // "Imported a file", in the same batch
})) {}
export const Confirmed = ...                 // by kind: confirmed {} | closed {} (another confirm won; nothing written)

export class TakeBackWrite extends S.Opaque<TakeBackWrite, { readonly brand: unique symbol }>()(S.Struct({
  draft: ImportId, fileName: S.String, takeBack: S.String.check(S.isUUID()), confirms: S.Array(ConfirmId),
  audit: Activity                           // its detail is filled in by the batch from what it counted
})) {}
export const TookBack = ...                  // by kind: tookBack {} | nothingInForce {} (a second press)

export class ImportStore extends Context.Service<ImportStore, {
  // ... the methods in the table above ...
  readonly commit: (write: ConfirmWrite) => Effect.Effect<Confirmed>
  readonly takeBack: (write: TakeBackWrite) => Effect.Effect<TookBack>
}>()($I`ImportStore`) { static readonly memory: Layer.Layer<ImportStore> }
```

**Handlers** (`.handler.ts`, registered through `handlersOf`; today's `ImportHandlers.ts`, `Suggestions.ts`,
`TableAssistant.ts` logic, unchanged in what they decide)

| File | Handlers |
| --- | --- |
| `Import/Imports.handler.ts` | `beginUpload`, `putChunk`, `finishUpload`, `discardUpload`, `match`, `get`, `table`, `open`, `past`, `changes`, `decide`, `commit`, `takeBack`, `reopen`, `remove`, and the internal `reviewOf` and `viewOf` |
| `Item/Items.handler.ts` | `list`, `page`, `facets`, `edit` |
| `Suggestion/Suggestions.handler.ts` | `suggest` (runs `asAgent(suggester)`; takes from `ModelAllowance` before `Answerer.ask`; ends with `answeredByRules`) |
| `Assistant/Assistant.handler.ts` | `view` (runs `asAgent(viewReader)`; the same order) |

`commit` keeps today's sequence: refuse a closed draft (`AlreadyImported`), save the unsaved delta, review the staged
file again with the same pure `review` and the stored suggestions, build the `ConfirmPlan`, `ImportStore.commit`,
answer the view read back from what is stored. A `closed` answer is `AlreadyImported`, as today.

`Catalog.ports.ts`: `type CatalogPorts = ImportStore | ItemStore | SuggestionStore | AssistantLog | ModelAllowance |
Answerer`, with `ItemsOfRow`, the kernel's contexts and `SecureRandom` the only other requirements `handlersOf`
admits.

#### 2.3 `catalog-host` (`packages/catalog/host`)

| File | Exports | From today |
| --- | --- | --- |
| `ImportStore.adapter.ts` | `ImportStoreD1: Layer<ImportStore, never, SqlClient \| D1>` | `server/Imports.ts` (every statement verbatim, decoded through the new schemas) |
| `ItemStore.adapter.ts` | `ItemStoreD1` | `server/Items.ts` (the FTS5 search, the guarded edit) |
| `SuggestionStore.adapter.ts`, `AssistantLog.adapter.ts` | `SuggestionStoreD1`, `AssistantLogD1` | the storage halves of `Suggestions.ts`, `TableAssistant.ts` |
| `ModelAllowance.adapter.ts` | `ModelAllowanceViaAccess: Layer<ModelAllowance, never, ModelAllowanceGateway>` | NET-NEW: section 3 |
| `Answerer.adapter.ts` | `AnswererOpenRouter: Layer<Answerer, never, OpenRouter>` | `askModel`, `answeredByModel`, `aiUnavailableOf` of `server/Model.ts` |
| `Catalog.http.ts` | `importsHandlers`, `itemsHandlers`, `assistantHandlers` (build functions) | `ImportHandlers.ts`, the assistant part of `handlers.ts` |
| `Adapters.ts`, `Host.ts` | `CatalogAdaptersD1`; `CatalogLive: Layer<CatalogPorts, never, SqlClient \| D1 \| OpenRouter \| ModelAllowanceGateway>` | part of `App.ts` |
| `CatalogTest.test-layer.ts` | `CatalogTest.memory(seed)`; `ItemsOfRow` override for a test file whose rows hold several items | `ImportShape.ts`'s test use |
| `internal/itemRow.ts`, `internal/auditLine.ts` | `ItemRow`, `itemColumns` (shared by the two adapters inside the host, no longer across services); the guarded audit insert | `Imports.ts` |

**The confirm, unchanged.** `ImportStoreD1.commit` sends today's batch in today's order: `insertBatch` (answers the
confirm id only for the batch that closes the draft), `closeDraft`, `insertItems` per size group,
`keepReplaced`/`replaceItems`, `insertOutcomes`, `insertChanges`, `countBatch`, then the audit line, every statement
guarded by "this draft is still open / this confirm is the one in force". `takeBack` keeps `markConfirms`, the restore
passes (one per confirm asked for, at most ten), `countTakeBack`, the audit line, `markOutcomes`,
`markReplacedOutcomes`, `removeItems`, `settleDraft`. The `ConfirmPlan` replaces only the TypeScript `CommitRow` the
statements are built from; the SQL text does not change, so `Imports.slow`, `TakeBack.slow` and `Tenancy.slow` keep
proving it.

**Activity lines.** `internal/auditLine.ts` is the same guarded insert as `access-host`'s, written twice on purpose
(a host may not import another host); `Tenancy.slow.test.ts` reads the schema and covers both.

#### 2.4 `catalog-web` (`packages/catalog/web`)

| File | Exports | From today |
| --- | --- | --- |
| `Catalog.runtime.ts` | `CatalogClient` (over `HttpApiClient.Client<ImportsApi \| ItemsApi \| AssistantApi>`), `catalogKeys` | `lib/api.ts` (type), `lib/queries.ts` (import and item keys) |
| `ImportPage.screen.tsx`, `UploadStep.screen.tsx`, `MatchStep.screen.tsx`, `ReviewStep.screen.tsx`, `ResultStep.screen.tsx` | the import steps | `pages/ImportPage.tsx`, `pages/import/*` |
| `ItemsPage.screen.tsx`, `ItemEditor.screen.tsx` | the Items page | `pages/ItemsPage.tsx`, `ItemEditor.tsx` |
| `ImportDecisions.screen.tsx`, `PastImports.screen.tsx` | the Activity page's "Decisions" and "Imports" lists | parts of `pages/ActivityPage.tsx`, `pages/import/pastImports.tsx` |
| `TableAssistant.screen.tsx` | the assistant panel | `components/app/TableAssistant.tsx` |
| `Imports.controller.ts`, `Draft.controller.ts`, `Upload.controller.ts` | `useImportView`, `useOpenImports`, `useRemoveImport`, the draft saver, `useUpload` | `lib/imports.ts`, `lib/draft.ts`, `lib/upload/index.ts` |
| `Upload.machine.ts` | `UploadState` (the `Reading` member's `rowsAbout` and `exact` become `rows: RowEstimate` by `kind`: `unknown {}`, `about { n }`, `counted { n }`), `progressOf` | `domain/Upload.ts` |
| `Conversation.machine.ts` | the assistant's conversation (its `null`s become `Option`, stored bytes kept) | `lib/table-assistant/*` |
| `ImportReview.controller.ts` | the adapter between the server's review and the review region | `pages/import/reviewAdapter.ts` |
| `internal/reader.worker.ts`, `internal/spreadsheet/*`, `internal/format.tsx`, `internal/itemText.ts`, `internal/CellForms.tsx`, `internal/WhyFlagged.tsx`, `internal/SheetChooser.tsx` | | `lib/upload/reader.worker.ts` (kept beside `new URL(..., import.meta.url)`), `lib/spreadsheet`, `pages/import/*`, `components/app/SheetChooser.tsx` |

Screens read `DateTime` (`whenShort` takes a `DateTime.Utc`; `UploadStep`'s "newer than my saved draft" compares
with `DateTime.isGreaterThanOrEqualTo` instead of comparing ISO text), `Option` (`Option.match` where `null` was
tested), and the unions with their `.match` (`RowOutcome`, `ColumnMatch`, `Suggestion`, `Change`, `Stocking`). The
`importWords` and `defaultReviewWords` stay where they are set today. TanStack Query stays; keys keep their words, so
`queryClient.invalidateQueries` across the two contexts (a confirm invalidates `activity`) goes through
`@inventory/client`'s `QueryPrefix`.

`test/web/reviewHonesty.test.ts` and `reviewParity.test.ts` move here: they are where the browser's review and the
server's meet (research 04 put the second in `catalog-model`, which cannot hold a React region).

### 3. How `catalog` reaches the model allowance in `access`

```ts
// catalog-model: Answer/ModelAllowance.external.ts (not compiled)
export const CatalogModelPurpose = LiteralKit(["view", "suggest"])
export class ModelAllowance extends Context.Service<ModelAllowance, {
  readonly take: (purpose: CatalogModelPurpose) => Effect.Effect<AllowanceAnswer, never, CurrentActor>
}>()($I`ModelAllowance`) { static readonly memory: (left: number) => Layer.Layer<ModelAllowance> }

// catalog-host: ModelAllowance.adapter.ts
export const ModelAllowanceViaAccess = Layer.effect(ModelAllowance, Effect.gen(function* () {
  const gateway = yield* ModelAllowanceGateway                       // @inventory/access-contract
  return ModelAllowance.of({
    take: (purpose) => gateway.take(purpose).pipe(Effect.map(AccessAnswer.match({
      taken: () => Taken.make({}), usedUp: ({ reason }) => UsedUp.make({ reason }) })))
  })
}))
```

The catalog's `AllowanceAnswer` is its own union of the same two cases, so `catalog-model` never imports
`access-contract`; only the host translates. In the app, `CatalogLive` is provided `ModelAllowanceGateway` from
`AccessLive`; the take happens before the model is asked, and a used-up allowance means the rules answer, as today.
The app's `system.checkAi` takes from the gateway directly (purpose `check`).

### 4. What stays in the app

| What | Why |
| --- | --- |
| `src/api/v1/Api.ts`: `HttpApi.make("inventory")` adding the six context groups and `SystemApi`, `ProblemDetails`, `SameOrigin`, the prefix, the OpenAPI annotations; `Document.ts` (component names, which the contexts' `$I` identifiers rely on); `Version.ts` | the one assembly of the contract |
| `src/api/v1/System.ts`: `SystemApi`, `SystemStatus`, `AiStatus`, `AiRoute`, `AiCheck` | platform health, not a context's language; it reads `access`'s count and the driver's status |
| `src/server`: `App.ts` (composition: `AccessLive`, `CatalogLive`, the drivers, the group Layers built from each host's build functions), `worker.ts`, `System.http.ts` (status, `checkAi`), `Model.ts` (settings to `OpenRouterSettings`, `aiStatusOf`), `Settings.ts` (driver settings), `Observability.ts`, `RequestTelemetry.ts`, `Telemetry.ts`, `SameOrigin.ts`, `security.ts`, `env.d.ts` | runtime wiring is app-local (research 04, F9) |
| `src/web`: `main.tsx`, `App.tsx`, `Workspace.tsx`, `AppShell`, `AppSidebar`, `SignedIn`, `BrandMark`, `ThemeToggle`, `slots`, `ActivityPage.tsx` (the three-view shell over `AuditEvents`, `ImportDecisions`, `PastImports`: decision (A1)), `ReviewGallery.tsx`, `lib/api.ts` (one `HttpApiClient.make(Api)` providing `AccessClient` and `CatalogClient`), `devtools.ts`, `telemetry.ts`, `otlp.ts`, `traceContext.ts`, `settings.ts`, `index.css` | the shell |
| `migrations/0001_init.sql`, `scripts/`, `public/`, `wrangler.jsonc` | one D1 history for one Worker; each table's header names the context that owns it |
| `test/server/*.slow.test.ts` and `support/`, the fast tests of what stays | they need the Worker composition, the real migrations and the samples |

## Proof

The definition of done, per package, written before the code.

| Package | Proof |
| --- | --- |
| `@inventory/client` | `call`, `callWrite` with a scripted client: a transient failure is retried twice, a refusal never; `useOptimisticWrite`'s per-change undo (today's `optimistic.test.ts`, moved); `sayError` table (today's `errors.test.ts`, moved). |
| `access-contract` | `AccessContract.property.test.ts`: every exported schema "generates only valid values" and round-trips; today's three session JSON bodies decode, the `ready` one to the same bytes; `Person` with `null` email and `joinedAt` decodes to `None` and encodes back to `null`. |
| `access-model` | over the memory twins: the last admin cannot be demoted or removed, another admin can; an add for an email nobody signed up with is `noAccount`; the same add again answers the person and writes no second line; a viewer and an editor are refused every People write (`Forbidden`); the allowance gives 40 calls then `usedUp`, and one more after 24 hours of `TestClock`; every write produces its audit line and a refused one none; `Access.ports.test.ts` keeps its `@ts-expect-error`. |
| `access-host` | decode tests of every row schema against a row as the migration shapes it. The adapters are proved in the app by `People.slow`, `Tenancy.slow`, `Auth.slow`, `AuthSchema.slow`, `Pwned.slow`, `Assistant.slow` (the allowance) on `D1Test`. |
| `access-web` | `bun run lint:shadcn` clean; the app's browser pass below. |
| `catalog-contract` | `CatalogContract.property.test.ts` over every schema; a stored `importDecision` JSON, `choicesJson`, `headJson` and an `importChunk` captured from today's database decode and encode back to the same bytes; `Stocking` from the two stored columns and back, the impossible pair refused. |
| `catalog-model` | the moved domain tests (`ItemImport`, `ReviewRules`, `ItemSearch`, `TableView`, `Upload`, `SheetLayout`, `FileProblem`, `Suggestions`) unchanged in count; `confirmPlan` property: the plan's statuses add up to the review's rows; handlers over the memory twins: a second confirm is `AlreadyImported`, a take-back pressed twice writes once, a used-up allowance asks no model; `Catalog.ports.test.ts`. |
| `catalog-host` | row decode tests; proved in the app by `Imports.slow` (155 created from the messy sample, a second load adds nothing), `TakeBack.slow` (atomic, a changed item kept and named), `Tenancy.slow` (every table filtered and keyed by organization), `Suggestions.slow`, `Assistant.slow`, `QueryPlans` (the indexes still used). |
| `catalog-web` | `reviewParity`, `reviewHonesty`, `readSpreadsheet`, `readInPieces`, `csvDifferential`, `tableView`, `form` tests moved and passing; `lint:shadcn` clean. |
| boundaries | `check-boundaries.mjs` passes, and fails on a planted import of `catalog-host` from `access-model` (tried once, reverted). |
| the app, after each package | `bun run check:full` through turbo and the production build; the stage C ceilings' sum at most what the ui goal left; the dev server on port 5200 (`--strictPort`); `items_messy.csv` through Confirm in a real browser, 200 rows in the file and the result screen, the Items table and the stored rows agreeing on 155. After `access`: People (add a person who signed up, change a role, the last admin refused with its sentence, remove), Activity's Events, sign out and in. After `catalog`: the full import with a decision made, undone and redone; a hard refresh mid-review losing nothing; Confirm, the result (counts, the not-imported download), a take-back (removed and kept named); the Items page with search, a filter and the editor (a change saved; a stale edit answered with the item as it is now); the table assistant with the model on (it names the model) and with `AI_ENABLED=false` (answered by the rules); Activity's three views; and the same at phone width (375 px). |

### How this brief obeys the schema rules

| Rule | Where it shows |
| --- | --- |
| SF-1 keys annotated as keys | every field above takes `S.annotateKey` first; whole schemas `$I.annoteSchema`, errors `$I.annoteError`; no `.annotate` is left on a key |
| SF-2 Effect's own values | the seven `instant()` fields, `Item.createdAt`, `Person.joinedAt`, `ChangedItem.changedAt` are `DateTime.Utc`; `UnitCost` is a `BigDecimal` (decision (C2)); calendar days are the one exception (deviation 2) |
| SF-3 normalised in the schema | `EmailToFind` (trim, lower case), `SkuKey`; the file readers keep theirs on purpose (deviation 3) |
| SF-4 absence is `Option` | every field `null` or optional on the wire today, through `OptionFromNullOr` or `OptionFromOptionalKey`; the `?? ""` that reached the wire is gone |
| SF-5 defaults on the schema | `RowDecision`'s parts, `ImportView.createdIds` and `suggestions`, `ItemFields.tags` and `vendors`, `ItemQueryParams.search`; none on an id, a role, a time or money |
| SF-6 tagged unions | `SessionState`, `RowPlace`, `StoredChoice`, `Stocking`, `RowOutcome`, `DecidedBy`, `ColumnMatch`, `Suggestion`, `SuggestionBy`, `Change`, `ViewChange`, `UploadDiscard`, `RowEstimate`, `AllowanceAnswer`, `PlannedRow` and the ports' answers (`AddWrite`, `RoleWrite`, `RemoveWrite`, `EditWrite.Answer`, `ChoicesSaved`, `Confirmed`, `TookBack`); every literal set a `LiteralKit` |
| SF-7 generates only valid values | every id branded and bounded; counts `S.Int` with bounds; texts bounded; one `*.property.test.ts` per package over every exported schema |
| SF-8 behaviour beside its data | `RowId.of`, `SkuKey.of`, `CalendarDay.of`, `UnitCost.cents`, `ItemFields.of`, `Suggestion.fits`, `SessionState.actor`, `RowPlace.putBack`, `keepsAnAdmin` beside `Person` |
| SF-9 schema forms | plain data branded `S.Opaque`; errors `S.TaggedError`; no `Model.Class` (open decision 11 is answered by (C5)) |

### Deviations from the exemplars, and why

1. **`catalog-web` imports `catalog-model`.** The browser runs the same pure `review` the server runs at the
   confirm: that is the import's core guarantee. Only `.rules.ts` subpaths are imported from the web package, and
   `check-boundaries.mjs` refuses any other.
2. **Calendar days are checked text.** effect 4.1.4 ships no plain-date schema (`Schema.ts` has date-times, a `Date`,
   and no date without a time); `CalendarDay` is a branded checked string until one exists.
3. **The file readers normalise in code.** A trimmed SKU or a re-cased unit read from a file is proposed to the person
   as before and after; decoding it silently in a schema would break "the person decides; the app proposes".
4. **Encoded sides of stored and wire JSON are frozen where nothing forces a change** (`RowDecision`, `MappingChoice`,
   staging, `ViewChange`): SF-6 shapes the decoded side; M9 freezes stored bytes.
5. **Two copies of the audit insert,** one per host, because a host may not import another (decision "packages",
   research 04 decision 14).
6. **`SystemApi` stays in the app.** It is health and model status, read from both contexts and a driver.
7. **Role vocabulary.** `Config.ts` and `Adapters.ts`, `Host.ts` as research 04 lists; `.test-layer.ts` from the
   drivers' vocabulary for host test layers; web packages add nothing.

### Where the research was wrong

1. **Web packages need more than their contract.** Research 04 §4 lists `own contract, ui, review, kernel` for a web
   package. Both need a shared browser runtime (`call`, optimistic writes, `sayError`, the signed-in member), which is
   section 0, and `catalog-web` needs its model's rules.
2. **The Activity page is two contexts' data.** Research 04 puts it in `access-web`; two of its three lists are the
   catalog's (`imports.changes`, `imports.past`).
3. **`AiStatus`/`AiTrouble`/`AiUnavailable` into a driver** (research 04 §4) was already undone by the kernel goal;
   here they settle in `catalog-contract`, and `AiStatus` with the system group in the app.
4. **`reviewParity` in `catalog-model`** cannot be: it imports the React region and the web adapter.
5. **Handler groups cannot be built in a host against its own `HttpApi`.** `HttpApiBuilder.group` routes through the
   assembled api's prefix and middleware, so the group Layer is built in the app (research 04 implied the host owns
   it).
6. **Not wrong, but missing:** two stored formats in the browser (the saved review and the assistant's conversation)
   and five JSON columns in D1 are formats the move must not rewrite; research 04's M9 row covers them, its moves
   table does not.

## Decisions for Benjamin

**(C1) Where does the browser's contract-free plumbing live?** (`call`, `callWrite`, optimistic writes, `sayError`,
the query client, the signed-in member)

| Option | For the person | For an API client | For stored data |
| --- | --- | --- | --- |
| **A ninth package, `@inventory/client` (recommended)** | nothing changes | nothing | nothing |
| In `@inventory/ui` | nothing changes; the design system gains an API runtime and the kernel | nothing | nothing |
| Each web package receives it from the app as React props | nothing changes; every screen grows props | nothing | nothing |

Reason: both web packages are its consumers (research 04's F4 two-consumer gate holds), and a design system should
not know there is an API.

**(A1) The Activity page.**

| Option | What it changes |
| --- | --- |
| **The app keeps the page's three-view shell; `access-web` gives "Events", `catalog-web` gives "Decisions" and "Imports" (recommended)** | Nothing for the person; each context shows its own data. |
| The whole page in `catalog-web`, reading `access-contract`'s activity | A web package imports another context's contract (M8 allows contracts; research 04's table does not). |
| Two pages | The person finds the audit trail somewhere new. |

**(A2) What a removal answers.** (`DELETE /people/:memberId`, `DELETE /imports/:id`; both always say `true`)

| Option | For an API client |
| --- | --- |
| **204 No Content (recommended)** | No body; a client that read `removed` sees nothing. Screens unchanged. |
| A one-case tagged answer `{"kind":"removed"}` | A body that carries nothing either. |
| Leave `{ "removed": true }`, with a recorded SF-6 deviation | Unchanged. |

**(A3) Rule-forced changes to the words a person reads.**

| Change | Recommended | Alternative |
| --- | --- | --- |
| "Nobody has signed up with Elena@Sample-Supply.test yet." reads the email lower-cased, because the schema lower-cases it (SF-3) | **Accept** | Keep the typed text beside the key in the command (`EmailToFind` with the original kept) |
| A stored `member.createdAt` that is not a date shows "Not set" instead of the raw text | **Accept** | Keep `joinedAt` as text (SF-2 deviation) |

**(C2) Unit cost as `BigDecimal`** (SF-2: a decimal amount decodes to `S.BigDecimalFromString`).

| Option | For the person | For an API client | For stored data |
| --- | --- | --- | --- |
| **`BigDecimal` in code, canonical text on the wire and in D1 (recommended)** | nothing: the importer already stores canonical text, and the editor reads it | an edit sending `"12.50"` is stored and answered as `"12.5"` | none; every stored cost is canonical already |
| Keep the checked decimal string, with a recorded SF-2 deviation | nothing | nothing | nothing |

**(C3) `ItemInvalid` (422).** Its three checks move into `ItemEdit`'s schema.

| Option | For the person | For an API client |
| --- | --- | --- |
| **Remove it: a 400 problem document names the field (recommended)** | nothing: the editor checks the form before it sends | 400 with the field and its rule, instead of 422 with a sentence |
| Keep `ItemInvalid` for a request that passes the schema but fails a cross-field rule | nothing | as today; with the union no such rule is left, so it would be dead |

**(C4) Who names the model-call purposes?**

| Option | What it changes |
| --- | --- |
| **`access-contract` lists `view`, `check`, `suggest` (the `modelCall` table's check); catalog's port lists the two it uses (recommended)** | A new model feature adds its purpose in access and in the table, as `CLAUDE.md` says today. |
| A free label (1 to 32 of `[a-z]`), the table's `CHECK` relaxed | A migration; access stops knowing catalog's features. |

**(C5) Open decisions 11 and 12, which this goal settles.** Decision 12 ("`Option`/`DateTime` fields or
`null`/strings?") is answered by this goal's charter: `DateTime` for every timestamp and `Option` for every absence,
with the wire keeping its `null`s. Decision 11 ("Where is `Model.Class` used?"):

| Option | What it changes |
| --- | --- |
| **Nowhere new: stored rows decode through the adapters' row schemas, as today; the kernel's `Activity` stays the only `Model.Class` (recommended)** | Row schemas stay private to each host (`internal/itemRow.ts`); the contract's `Item` is plain `S.Opaque`. |
| `Item` as a `Model.Class` with `select`, `insert`, `update`, `json` variants (research 03 §3.1) | One schema for the row and the wire; it carries no brand (TS2558, the kernel's deviation 1) and the `isActive`/`discontinuedOn` columns map to `Stocking` inside its variants. |

Record both answers in [DECISIONS.md](DECISIONS.md).

**(C6) The store twins.**

| Option | What it changes |
| --- | --- |
| **Every port has a memory twin, `ImportStore`'s included (recommended)** | Every handler is tested without workerd; the import twin re-implements confirm and take-back in memory, and the slow tests remain the proof of the SQL. |
| Twins for the access stores, `ItemStore`, `SuggestionStore` and `AssistantLog`; `ImportStore` proved only by the slow tests | Less new code; the import handlers are tested only through workerd. |

## Rabbit holes

- **A group's handlers built outside the app.** Whether `HttpApiBuilder.Handlers.FromGroup<typeof PeopleApi>` is
  assignable where the app's prefixed group is expected is unverified; the fallback is the host exporting one
  function per endpoint and the app calling `handlers.handle(name, fn)`.
- **`LiteralKit` on the Worker** depends on the vendored patch landing first; until it does, `S.Literals` and
  `S.toTaggedUnion` directly, as the kernel did.
- **Identity composers for the contexts.** `$InventoryId.compose("access")` then `.compose("contract")` is assumed to
  give `@beep/inventory/access/contract/...`; tried in the first commit. OpenAPI component names rely on
  `Document.ts` shortening them, as the kernel's do.
- **`member.createdAt` as Better Auth writes it.** The seeds write ISO text; whether Better Auth's D1 adapter writes a
  member's `createdAt` as ISO text is unverified; `joinedAt` decoding is tried on a member added in the browser.
- **`OptionFromNullOr` on a field whose encoded side the generated JSON Schema must still call nullable**, for the
  OpenAPI document; checked in `Docs.test.ts`.
- **The memory twin of take-back** must follow revisions as the SQL does; its tests copy the slow test's scenarios.
- **First page weight.** `access-web`'s session controller and `SessionState` are on the first page; the contract's
  `$I` annotations and `LiteralKit` must not pull the whole contract in. `build:report` before and after.
- **Spans.** Handlers keep their span names (`imports.commit`, `People.setRole`, ...); a renamed one is written in
  PLAN with every assertion that names it (`Spans.test.ts`).

## No-gos

- No new migration, no column change, no rewrite of stored JSON; no seed split (that is `@beep/infra`'s).
- No event sourcing, no aggregate, no `@alchemy.run/domain` (decision "core").
- No atoms, no `@effect/atom-react` (decision "client state").
- No change to `authOptions`' behaviour, to the import's row rules, to what the review proposes, or to any count.
- No third context (`authority`, `suggestions`), no split of `catalog` (decision "packages").
- No change to `@beep/*` drivers or the vendored kit beyond the patch that restores `LiteralKit`.
- No `CLAUDE.md` or `docs/` change beyond what the moves make false (the layout, "What is there", "Adding a feature",
  the paths in `docs/patterns.md`, `docs/kit.md`, `docs/architecture.md`, `.claude/agents/backend.md` and
  `frontend.md`).

## Map

| Part | Goal | Cites |
| --- | --- | --- |
| `@inventory/client` | `contexts`, slice 0 | `apps/inventory/src/web/lib/api.ts`, `optimistic.ts`, `rollback.ts`, `errors.ts`, `queries.ts`, `early.ts`, `http.ts`, `actor.ts` (read side) |
| `access-contract` with its wire changes | `contexts`, slice A1 | `apps/inventory/src/api/v1/Identity.ts`, `People.ts`, `ActivityApi` and `ModelCallsUsedUp` in `Api.ts` |
| `access-model` | slice A2 | `apps/inventory/src/server/People.ts`, `Members.ts`, `ModelCalls.ts`, `SessionIdentity.ts` (rules and sentences); NET-NEW ports and twins |
| `access-host` | slice A3 | `apps/inventory/src/server/Members.ts`, `People.ts`, `Activities.ts`, `ModelCalls.ts`, `SessionIdentity.ts`, `SignIn.ts`, `authOptions.ts`, `TestAccounts.ts`, `Identity.ts`, `handlers.ts` |
| `access-web` | slice A4 | `apps/inventory/src/web/pages/SignIn.tsx`, `PeoplePage.tsx`, `ActivityPage.tsx` (events), `lib/actor.ts`, `session.ts`, `auth-client.ts` |
| `catalog-contract` with its wire changes | slice C1 | `apps/inventory/src/api/v1/Api.ts`, `Assistant.ts`, `ModelTrouble.ts`; the schemas of `src/domain/*.ts` |
| `catalog-model` | slice C2 | `apps/inventory/src/domain/*.ts`, `src/server/ImportHandlers.ts`, `Suggestions.ts`, `TableAssistant.ts`, `ImportShape.ts` |
| `catalog-host` | slice C3 | `apps/inventory/src/server/Imports.ts`, `Items.ts`, `Suggestions.ts`, `TableAssistant.ts`, `Model.ts` (ask) |
| `catalog-web` | slice C4 | `apps/inventory/src/web/pages/ImportPage.tsx`, `pages/import/*`, `ItemsPage.tsx`, `ItemEditor.tsx`, `ActivityPage.tsx` (decisions, imports), `components/app/TableAssistant.tsx`, `SheetChooser.tsx`, `lib/imports.ts`, `draft.ts`, `upload/*`, `spreadsheet/*`, `table-assistant/*` |
| `check-boundaries.mjs` | slice 0 | NET-NEW |

### Order of moves

Each is one commit, `bun run check:full` and the build green, the app working; a shape change is made in the app
first, with every screen that reads it, and only then moved, so no commit both moves and reshapes.

0. Merge local `main` (the ui packages and the `LiteralKit` patch). `check-boundaries.mjs` with today's single app
   (it passes trivially) and `@inventory/client` with the app switched to it.
1. **access, shapes in place:** `SessionState` union with `SignedIn.tsx`, `SignIn.tsx` and `lib/actor.ts`; `Person`
   with `Option` and `Instant`, `MemberId` in the path, 204 removal (A2), `EmailToFind` (A3), with `PeoplePage.tsx`;
   `LiteralKit`s and bounded sentences. Browser: sign out and in, People.
2. `access-contract`: the reshaped schemas, the rejections, the gateway and the three groups move; the app's `Api`
   adds them.
3. `access-model`: rules, ports, twins, handlers; tests over the twins. The app is not yet wired to it.
4. `access-host`: adapters, the identity middleware, sign-in, the build functions, `AccessLive`; the app composes it
   and deletes `Members.ts`, `People.ts`, `Activities.ts`, `ModelCalls.ts`, `SessionIdentity.ts`, `SignIn.ts`,
   `authOptions.ts`, `TestAccounts.ts`, `Identity.ts`; `TableAssistant.ts`, `Suggestions.ts` and `checkAi` take
   through `ModelAllowanceGateway`. Browser: the messy sample, People, Activity.
5. `access-web`: sign-in, People, Events; the app's Activity page composes "Events". Browser: the same.
6. **catalog, shapes in place**, one commit each, screens and server together: (a) timestamps to `Instant`; (b)
   `Option` for every `null`, the `?? ""` removed; (c) `Stocking` with the Items page, the editor and the review's
   item build; (d) `RowOutcome` and `DecidedBy` with the result screen and its download; (e) `ColumnMatch` with the
   match step; (f) `Suggestion` and `Change` with the review and the Activity decisions; (g) `RowDecision`'s decoded
   union with the review adapter; (h) `ViewAnswer`/`ViewRefusal` on `AnsweredBy` with the assistant; (i) ids branded,
   `UploadDiscard`, 204 removal, `ItemInvalid` per (C3), `UnitCost` per (C2). Browser after each of (c), (d), (e),
   (f), (g): the messy sample through Confirm.
7. `catalog-contract`: the reshaped schemas and the three groups move; the app's `Api` adds them.
8. `catalog-model`: the domain modules split into Modules, `ConfirmPlan`, ports, twins, handlers; the moved domain
   tests.
9. `catalog-host`: adapters, `ModelAllowanceViaAccess`, `AnswererOpenRouter`, the build functions, `CatalogLive`; the
   app composes it and deletes `Imports.ts`, `Items.ts`, `ImportHandlers.ts`, `ImportShape.ts`, `Suggestions.ts`,
   `TableAssistant.ts` and `src/domain`. Browser: the full catalog pass.
10. `catalog-web`: screens, controllers, machines, the worker; the app mounts them and composes the Activity page;
    `reviewParity` and `reviewHonesty` move. Browser: the full pass, then at phone width.
11. Documents the moves made false; `DECISIONS.md` records 11 and 12; PLAN's closing note with what `@beep/xlsx` and
    `@beep/infra` should know.

The first vertical slice is moves 0 to 2: the client seam and the smallest context's contract, which proves the
pattern (wire changes made in place, then moved, then assembled by the app) before the large one.
