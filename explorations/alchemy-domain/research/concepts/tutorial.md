---
type: Reference
title: The tutorial
description: The eight-part bank tutorial for @alchemy.run/domain, part by part at beta.87 and on main, the map of the bank example it grows into, and the same eight steps retold with inventory-import's imports, members, allowance and activity.
tags: [alchemy-domain, learning]
---

# The tutorial

The library's tutorial builds one bank in eight parts: an account aggregate checked by stories, two views,
a second aggregate joined by a policy, an Api guarded by middleware, a Cloudflare deployment, a foldkit browser
app, tracing into Axiom, and finally changing a view that already holds data. It opens with "Build a bank in eight
parts, starting with an account that opens, takes deposits and refuses overdrafts."
[https://alchemy.run/domain/tutorial/part-1]. Every block it introduces is used again, at full size, in the
`examples/cloudflare-domain` bank, so the tutorial is the order to learn the library in and the example is where to
find a worked upstream use of each block. The tutorial changed on main: commands lost `target`, Part 1 now proves a
rule with `Verify`, and Part 4 now verifies the whole bank; the example on main also replaces the username
reservation policy with a [decision](./decision.md).

## When to reach for it

- To learn the library in the order its authors teach it, before reading any single block's page.
- To find a worked upstream example of a block: the table in "The bank example on main" names the file.
- To decide which parts can be followed on the published beta.87 (all eight, in their beta form) and which
  steps need main (Part 1's invariant and `Verify.aggregate`, Part 4's model rules, relation and `Verify.model`).

## How it is declared

The tutorial is eight MDX pages, `website/src/content/docs/domain/tutorial/part-1.mdx` to `part-8.mdx`, published at
`https://alchemy.run/domain/tutorial/part-N`. Each part adds files to one project: `src/` holds one file per block,
named `<Name>.<kind>.ts` (`Account.aggregate.ts`, `DepositMoney.command.ts`, `AccountSummary.view.ts`,
`MainAccountProvisioning.policy.ts`, `BankApi.api.ts`, `Session.middleware.ts`, `CurrentActor.context.ts`), and
`test/` holds stories. Parts 1 to 4 run with `bun vitest run` and nothing else; Parts 5 to 8 run `alchemy dev` and
`alchemy deploy`. The finished bank is a smaller copy of `examples/cloudflare-domain`, whose layout is the one in the
skill's `references/layout.md` (identical at both refs): `packages/domain` (the pure model and its stories),
`packages/server` (the Worker, middleware implementations, adapters), `packages/web` (the foldkit app), and
`alchemy.run.ts` at the root. See [project layout](./project-layout.md).

### What main changes

Checked by `diff -u` of every part at both refs.

- **Commands lose `target`.** At beta.87 a command declares `target: AccountId` and an `input` without the id
  (beta `packages/domain/src/Command.ts:25`, `:102`); the aggregate has no `keyOf`; a story says
  `Story.when(account, new DepositMoney({ amount: 100 }))` (beta `Story.ts:271-280`); a policy sends
  `accounts.send(id, command)`; an Api client calls `bank.DepositMoney(accountId, { amount: 100 })` (beta
  `Api.ts:257`). On main the id is an input field, the aggregate routes with `keyOf: (cmd) => cmd.accountId`
  (main `Aggregate.ts:182`), `Story.when(command)` takes the command alone (main `Story.ts:282-289`),
  `accounts.send(command)` and `bank.DepositMoney({ accountId, amount: 100 })` (main `Api.ts:289`). This touches
  parts 1, 2, 3, 4, 5, 6 and 8. See [command](./command.md), [aggregate](./aggregate.md).
- **Part 1 proves a rule** (main only): an `invariants` entry `NeverNegative`, a test calling
  `Verify.aggregate(Account)` with `NodeServices.layer`, a counterexample (a deposit of `-1`), the fix by an `Amount`
  schema (`Schema.Int.check(Schema.isGreaterThan(0))`), and a `transitions` entry. The install line gains
  `@effect/platform-node`. `Verify.ts`, `invariants` and `transitions` do not exist at beta.87 (beta
  `packages/domain/src` has no `Verify.ts`; main `Aggregate.ts:157`, `:167`). `Verify` came with commit
  `e4adb720c` (#3260).
- **Part 4 verifies the bank** (main only): a model `invariants` entry `EveryCustomerHasAnAccount`, a
  `relations` entry made with `Domain.Relation`, and `Verify.model(Bank, { apis: [BankApi], story })` (main
  `Model.ts:149`, `:158`; `Relation.ts:77`; `Verify.ts:444`). Part 4's commands also switch to `Amount`. Commit
  `852675fdd` (#3504).
- **Part 7 is identical** at both refs. Parts 5, 6 and 8 change only the client call shape.
- **The example on main** (not the tutorial) replaces `Customer/UsernameReservation.policy.ts`,
  `ClaimUsername.command.ts`, `ConfirmRegistration.command.ts` and `RejectRegistration.command.ts` with
  `Customer/Registration.decision.ts` (`Domain.Decision(RegisterCustomer, { reads: { customer, claim }, ... })`), so
  `Customer` and `UsernameClaim` become aggregates that only fold events; adds `invariants`, `transitions`,
  `relations` and `eventually` to `Bank.model.ts` and `Account.aggregate.ts`; renames the saga's durable deferred
  `Decision` to `Approval`; and adds the tests `Bank.verify.test.ts`, `Bank.prove.test.ts`,
  `Bank.explore.test.ts` and eleven tests over small fixture models in `test/fixtures/`. The decision came with
  commit `dbda8cc16` (#3420); the commit that rewrote the example is not identified.

## Part 1: Model an account

- **Builds:** the `Account` aggregate (states `Unopened` and `Open { owner, balance }`), the commands `OpenAccount`,
  `DepositMoney` (with a `reply` of the balance) and `WithdrawMoney`, their events and the rejections
  `AlreadyOpen`, `NotOpen` (in its own file, shared) and `InsufficientFunds { balance, requested }`, the `Bank`
  model, and five stories.
- **Blocks:** [event](./event.md), [rejection](./rejection.md), [command](./command.md),
  [aggregate](./aggregate.md) (`decide`, `evolve`, `reply`), [model](./model.md), [story](./story.md)
  (`Story.make`, `given`, `when`, `then`, `rejected`, `replied`); on main also
  [invariants and transitions](./invariants-and-transitions.md) and [verify](./verify.md).
- **Run:** install `alchemy @alchemy.run/domain effect` with dev `vitest @effect/vitest` (main adds
  `@effect/platform-node`), `skills-npm setup` to link the `alchemy-domain` skill, then `bun vitest run`.
- **beta.87 vs main:** beta stops at five passing stories, written in the `target` form. Main continues: the
  invariant, a failing `Verify.aggregate` run, the `Amount` schema that makes it pass, and the transition
  `AWithdrawalNeverAddsMoney`.

## Part 2: Read it with a view

- **Builds:** `AccountSummary` (a keyed view with `state`, `initial` and `evolve`: owner and balance) and
  `Statement` (a view with no state that `emit`s one `StatementLine` per movement).
- **Blocks:** [view](./view.md) (`from`, `key`, `evolve`, `events`, `emit`); [story](./story.md) (`view`, `emitted`).
- **Teaches:** a story fails when a command commits an event no `then` asserts (the message "committed events no
  step asserts" is in `Story.ts` at both refs, beta `:1755`, main `:1793`).
- **Run:** `bun vitest run` twice: first failing, then passing.
- **beta.87 vs main:** only the `Story.when` form.

## Part 3: React with a policy

- **Builds:** `Customer` (a second aggregate with `RegisterCustomer`, `AlreadyRegistered`), the
  `MainAccountProvisioning` policy that opens `<customerId>-main` on `CustomerRegistered`, its `toLayer`
  implementation, and `BankHandlers`, which every story now passes as `Story.make(Bank, { layer: BankHandlers })`.
- **Blocks:** [aggregate](./aggregate.md), [policy](./policy.md) (`from`, `on`, `toLayer`, `source`),
  [story](./story.md).
- **Teaches:** a policy may see an event twice, so its command uses an id derived from the event and catches
  `AlreadyOpen`. `Story.make` refuses, at the type level, a model with policies and no `layer` (beta `Story.ts:1037-1040`).
- **beta.87 vs main:** `RegisterCustomer` takes `customerId` in its input on main; the policy sends
  `accounts.send(new OpenAccount({ accountId, owner }))` instead of `accounts.send(accountId, new OpenAccount({ owner }))`.

## Part 4: Expose an Api

- **Builds:** `CurrentActor` (`Domain.RequestContext`, carrying `{ customerId }`), the `Session` middleware (an
  Effect `RpcMiddleware.Service` that provides `CurrentActor`, with a demo `SessionLive` that trusts a bearer header
  and a `sessionClient` layer), `NotOwner`, `NotYou`; commands that list `middleware: [Session]`; `decide`
  handlers written as `Effect.fn` that `yield* CurrentActor`; a guarded `AccountSummary` (`middleware`, `rejects`,
  and `AccountSummaryLive`, its `validate`); `Story.provide` to stand in for middleware; `BankApi`
  (`Domain.Api` naming commands and views); an in-process Api test on `Bank.layer(BankHandlers)` over
  `Domain.InMemory`.
- **Blocks:** [sessions](./sessions.md), [view security](./view-security.md), [api](./api.md),
  [host in memory](./host-in-memory.md), [test tooling](./test-tooling.md); on main also
  [model](./model.md) invariants, [relation](./relation.md) and [verify](./verify.md).
- **Run:** `bun vitest run`.
- **beta.87 vs main:** main adds "Say what holds across the bank" (`EveryCustomerHasAnAccount`), "Relate an account
  to its customer" (`AnAccountBelongsToACustomer`) and "Verify the bank", whose report shows the account's rules
  proved and the two bank rules checked, the relation not proved because only the policy ever sends `OpenAccount`.
  The page then points to [decision](./decision.md) as the way to make such a relation provable.

## Part 5: Deploy to Cloudflare

- **Builds:** `BankWorker` (`Cloudflare.Worker` serving `api.fetch`, with
  `DomainCloudflare.layerDurableObjects()` hosting every aggregate, view and policy as a Durable Object class),
  `alchemy.run.ts` (`Alchemy.Stack` with `Cloudflare.providers()` and `DomainCloudflare.providers()`), and a script
  that calls the Api over `Domain.protocolHttp(url)` and watches the summary.
- **Blocks:** [host on Cloudflare](./host-cloudflare.md), [platform contract](./platform-contract.md),
  [api](./api.md); the provider-level detail is in [the Cloudflare tutorial](./cloudflare-tutorial.md).
- **Run:** add `@alchemy.run/cloudflare`; `alchemy dev`; `bun scripts/try.ts http://localhost:1337`;
  `alchemy deploy`.
- **beta.87 vs main:** the script's three client calls change shape; nothing else.

## Part 6: Build the UI with foldkit

- **Builds:** a cookie session (`bank_session`, read before the bearer header), a `sessionRoute` at
  `POST /api/session`, Worker routing, a foldkit app (`Flags`, `Model`, `Message`, `Command.define` wrappers around
  the Api client, `update`, a `Subscription` that watches `AccountSummary`, `view`), `entry.ts` connecting with
  `Domain.protocolWebSocket`, an app Worker forwarding `/api`, and `Cloudflare.Website.Foldkit` in the stack.
- **Blocks:** [foldkit](./foldkit.md), [sessions](./sessions.md); the page points onward to optimistic updates and
  [local first](./local-first.md).
- **Run:** add `foldkit @effect/platform-browser`, dev `vite @foldkit/vite-plugin`; `alchemy dev`, open the `app` URL
  with `?customer=c-2`; `alchemy deploy`.
- **beta.87 vs main:** the two `Command.define` bodies change client call shape.

## Part 7: Observe it

- **Builds:** `Axiom.providers()` in the stack, two `Axiom.Dataset`s and an `Axiom.ApiToken`, `Axiom.Telemetry` in
  the Worker's layer, a span attribute from `Effect.annotateCurrentSpan` in `decide`, a browser span relay
  (`Telemetry.relay` from `alchemy/Telemetry`, authorized by the exported `signedIn`) and an `OtlpTracer` in the
  app.
- **Blocks:** [observability](./observability.md) (`Domain.decide` spans, `domain.outcome`,
  `domain.correlation_id`).
- **Run:** add `@alchemy.run/axiom`; `alchemy deploy`; read the trace in Axiom.
- **beta.87 vs main:** none (identical file).

## Part 8: Change a deployed model

- **Builds:** a `movements` count on `AccountSummary` with `version: 1`; `DailyDeposits`, a view keyed by a plain
  string, whose `keyOf` sends each `MoneyDeposited` to `DateTime.formatIsoDateUtc(envelope.at)`; it is added to the
  model and the Api; then changed again with `version: 1`.
- **Blocks:** [view](./view.md) (`version`, `keyOf` on the envelope), [backfill](./backfill.md),
  [reads and consistency](./reads-and-consistency.md).
- **Teaches:** a view keyed by its source rebuilds in place on first touch; one keyed across sources (by day) is
  filled by the deploy, which waits and prints `Backfilling view:...` lines, and a version bump moves it to fresh
  storage (`view:DailyDeposits#1`). During a rollout the Worker answers reads of an old-code summary itself.
- **Run:** `alchemy deploy` three times, `bun scripts/try.ts <url>`.
- **beta.87 vs main:** the script's client call shape only. `version` and the envelope in `keyOf` exist at both
  refs (beta `View.ts:68`, `:156`; main `View.ts:73`, `:161`).

## The bank example on main

Every file in `examples/cloudflare-domain/packages/domain/src` at `main@dbfd0ddb` (59 files, listed from the
repository's tracked files; at beta.87 the folder holds 62: the four registration files below were there, and
`Customer/Registration.decision.ts` was not). Kinds outside the
fourteen named kinds are marked `rejection`, `schema`, `helper` or `port`.

| File | Kind | Its job in the bank |
| --- | --- | --- |
| `Account/Account.aggregate.ts` | aggregate | One account: states Unopened, Open (owner, balance, frozen, today's withdrawals), Closed; ten commands; two invariants and three transitions |
| `Account/Account.id.ts` | schema | `AccountId` brand, and `mainAccountId(customerId)` |
| `Account/AccountActivity.view.ts` | view | Passes freeze, close, owner change and stranded money through to support agents only |
| `Account/AccountCard.stream.ts` | stream | Every version of an account's card (`CardChanged`), readable by its owner |
| `Account/AccountCards.projection.ts` | projection | Reads `AccountSummary` and appends a card to the stream on every balance change |
| `Account/AccountSummary.view.ts` | view | Balance, owner, frozen and closed per account; its `validate` re-runs on every change while watched |
| `Account/ChangeOwner.command.ts` | command | Support reassigns an account (`OwnerChanged`, `NotPermitted`) |
| `Account/CloseAccount.command.ts` | command | Closes an empty account (`BalanceNotZero`) |
| `Account/CreditTransfer.command.ts` | command | Pays a transfer into the destination; sent by the saga |
| `Account/DebitTransfer.command.ts` | command | Takes a transfer out of the source on the requester's behalf (`requestedBy` is input) |
| `Account/DepositMoney.command.ts` | command | Deposit with `reply: { balance }` |
| `Account/FreezeAccount.command.ts` | command | Stops money leaving; freezing twice records nothing |
| `Account/Frozen.rejection.ts` | rejection | The account is frozen |
| `Account/InsufficientFunds.rejection.ts` | rejection | Balance does not cover the amount |
| `Account/mustOwn.ts` | helper | Read rule shared by views, stream and query: agent, or the owner, or no owner yet |
| `Account/NotOpen.rejection.ts` | rejection | Account not open |
| `Account/NotOwner.rejection.ts` | rejection | Actor does not own the account |
| `Account/OpenAccount.command.ts` | command | Opens an account; sent only by the policy |
| `Account/RecordSettlement.command.ts` | command | A card top-up that already settled; never rejects |
| `Account/RefundTransfer.command.ts` | command | Saga compensation; never rejects, may record `RefundStranded` |
| `Account/Statement.view.ts` | view | Emits one `StatementLine` per money movement |
| `Account/WithdrawMoney.command.ts` | command | Withdrawal behind `Session` and `MfaChallenge`; `DAILY_LIMIT` |
| `Actor.ts` | schema | Who acts: Customer, Agent or System |
| `Bank.model.ts` | model | Hosts everything; relations, model invariants, `eventually`; `BankReads` and `BankHandlers` layers |
| `CurrentActor.context.ts` | context | `Domain.RequestContext` over `Actor` |
| `CustomerApi.api.ts` | api | What the customer app reaches |
| `Customer/Customer.aggregate.ts` | aggregate | A customer; no commands, folds what `Registration` records |
| `Customer/CustomerDashboard.view.ts` | view | A customer's accounts and balances, re-keyed on owner change; `computed` total |
| `Customer/Customer.id.ts` | schema | `CustomerId` brand |
| `Customer/MainAccountProvisioning.policy.ts` | policy | On `CustomerRegistered`, open the main account |
| `Customer/RegisterCustomer.command.ts` | command | Register under a unique username; decided by the decision |
| `Customer/Registration.decision.ts` | decision | Registers the customer and claims the username in one step, with two transitions |
| `Customer/UsernameClaim.aggregate.ts` | aggregate | One username and its holder; folds `UsernameClaimed` |
| `Customer/Username.ts` | schema | `Username` brand |
| `Forbidden.rejection.ts` | rejection | Caller may not read or do this |
| `Fraud/DailyOutflow.view.ts` | view | Money out per account per day; emits `DailyOutflowExceeded` past a threshold |
| `Fraud/FraudCheck.external.ts` | external system | Fraud scoring, declaration only |
| `Fraud/FraudReview.policy.ts` | policy | Scores a crossing and freezes a risky account as the system actor |
| `Ledger/AccountLedger.query.ts` | query | Paged ledger rows for one account, `waitsFor: [Ledger]` |
| `Ledger/Ledger.projection.ts` | projection | Writes every movement to a table outside the model, batched |
| `Ledger/LedgerStore.ts` | port | `Context.Service` the projection writes and the query reads, plus a memory layer |
| `MfaChallenge.middleware.ts` | middleware | Second-factor middleware declaration |
| `Money.ts` | schema | `Cents` and `Amount` (above zero) |
| `Session.middleware.ts` | middleware | Session declaration, its error, cookie name, client helper |
| `Settlement/Payments.external.ts` | external system | Payment processor refund, declaration only |
| `Settlement/SettlementRefund.policy.ts` | policy | Refunds money that settled on a closed account |
| `SupportApi.api.ts` | api | What the support console reaches |
| `Transfer/AccountTransfers.view.ts` | view | Transfers touching an account, one event routed to two keys |
| `Transfer/ApproveTransfer.command.ts` | command | An agent approves a large transfer |
| `Transfer/CompleteTransfer.command.ts` | command | Records a completed transfer; never rejects |
| `Transfer/ExecuteTransfer.saga.ts` | saga | Waits for approval, debits, credits, refunds on failure |
| `Transfer/ExpireTransfer.command.ts` | command | Approval window closed; scheduled |
| `Transfer/FailTransfer.command.ts` | command | Records a failed transfer |
| `Transfer/RequestTransfer.command.ts` | command | Ask for a transfer; client-chosen id makes a retry idempotent |
| `Transfer/Transfer.aggregate.ts` | aggregate | A transfer's lifecycle; approval and expiry race on one instance |
| `Transfer/TransferApprovalDeadline.policy.ts` | policy | Schedules `ExpireTransfer` after 24 hours ([deadlines](./deadlines.md)) |
| `Transfer/TransferExecution.policy.ts` | policy | Starts the saga and signals approval or expiry to it |
| `Transfer/Transfer.id.ts` | schema | `TransferId` brand |
| `Transfer/TransferStatus.view.ts` | view | One transfer's progress from the transfer and both accounts; `computed` status |

Tests on main: `test/Bank.story.test.ts` (22 stories, the whole model in memory with
`stub: [FraudCheck, Payments]`), `Bank.verify.test.ts` (`Verify.model` over both Apis with a `require.proved` list,
and `Verify.aggregate(Account)`), `Bank.prove.test.ts` (`Prove.invariants`, `Prove.decision`),
`Bank.explore.test.ts` (`Explore.check` at depth 2 and 3), and `Consumer`, `Decision`, `Eventually`, `Faults`,
`Guards`, `Nodes`, `Relation`, `Syntax`, `Transitions`, `Verify`, `Walks` tests over small fixture models in
`test/fixtures/` (read by outline). The server package's adapters are the worked examples of
[external systems](./external-system.md) (`SiftFraudCheck.ts`, `StripePayments.ts`), a D1 port
(`Ledger/D1LedgerStore.ts`), signed sessions (`Session.ts`) and a Stripe webhook source (`StripeSettlements.ts`).
`examples/cluster-domain` on main (read by outline) is a smaller bank (accounts, transfers, a saga, two views) hosted
through one `hostBank(platform)` function on Docker, AWS or Cloudflare via [Effect Cluster](./host-effect-cluster.md).

## Where the tutorial does not match the source

- **Part 2's story transcript on main is the beta output.** `part-2.mdx:86-87` on main prints
  `When       Account/a-1: DepositMoney { amount: 100 }`. On main a `When` step is described from the command alone
  (`packages/domain/src/Story.ts:725-726`: `return summarize(s.command)`), with no `Account/a-1:` prefix, and the
  command now carries `accountId`. The prefix comes from beta (`Story.ts:716-717`, `refName(s.ref)`). The exact
  main wording is not verified (not run).
- **Report transcripts were not run.** Part 1's and Part 4's `Verify` reports match the shape the renderer writes
  (`Verify.ts:512-522`, `:646-700`; `Prove.ts:371`), but the numbers (`8,452 sequences, 1,335 states`, `12 outcomes`)
  are not verified.
- **No snippet was found naming an API that does not exist** at its ref. Checked: `Domain.RequestContext`
  (both refs `RequestContext.ts:66`), `Domain.Relation` (main `Relation.ts:77`), `Verify.aggregate` and
  `Verify.model` (main `Verify.ts:574`, `:444`, which require `FileSystem` and `Path`, hence `NodeServices.layer`,
  `Verify.ts:160`), `Story.provide`/`view`/`emitted` (both refs), `DomainCloudflare.layerDurableObjects` and
  `providers` (`Cloudflare/index.ts` both refs), `Api.ClientKey`, `clientInProcess`, `layerClient`,
  `protocolHttp`, `protocolWebSocket` (both refs `Api.ts`), `Telemetry.relay` (main `packages/alchemy/src/Telemetry.ts:74`),
  `Axiom.Telemetry` options (main `packages/axiom/src/Telemetry.ts:27-38`), `Cloudflare.Website.Foldkit` (main
  `packages/cloudflare/src/Website/Foldkit.ts:165`), `Cloudflare.state` (main `StateStore/State.ts:79`), and in
  `effect` 4.1.4: `Schema.TaggedError` (`Schema.ts:17965`), `Option.fromNullishOr`, `Cookies.parseHeader`,
  `HttpServerResponse.setCookieUnsafe`, `HttpClientRequest.bodyJsonUnsafe`, `Socket.layerWebSocketConstructorGlobal`,
  `Effect.forkChild`, `DateTime.formatIsoDateUtc`, `Effect.catch`, `Stream.catch`, `OtlpSerialization.layerJson`.
  foldkit's API (`Command.define`, `Subscription.make`, `Runtime.makeApplication`, `Message.match`) is not verified:
  no foldkit source was read.
- **Copying from the example breaks this app's house rules** in two places, not a defect upstream:
  `Ledger/LedgerStore.ts:18` uses `Schema.Number` and `:50` a native `Map`.

## Rules, and the mistakes to avoid

- Pick the ref before copying a snippet. A beta.87 snippet (`target`, `Story.when(ref, cmd)`, `client(id, input)`)
  does not compile on main, and a main snippet does not compile on the published package.
- Every event a `when` commits needs a `then`; Part 2 makes this mistake on purpose.
- A model with policies needs `Story.make(Model, { layer })`; a guarded view needs its `toLayer` in that layer.
- A story has no middleware: provide the request context with `Story.provide` before the commands that need it.
- A policy can run twice: derive its command's id from the event and treat "already done" as success.
- Bump a deployed view's `version` whenever `evolve`, `state`, `keyOf` or its sources change, and only upward.
- The tutorial trusts any bearer header and any sign-in; the example's `packages/server/src/Session.ts` signs
  tokens with HMAC. This app already has Better Auth; do not copy the demo session.

## In this app

The same eight steps, with inventory-import's nouns. Today nothing in the app imports the library; each line says
which block of this app plays the tutorial's part.

| Tutorial | In inventory-import |
| --- | --- |
| Part 1: the Account, open, deposit, withdraw, refuse an overdraft, `NeverNegative` | The **Import** aggregate keyed by import id: `StageImport`, row decisions (`SettleRow`, `LeaveRowOut`), `ConfirmImport`, `TakeBackImport`; refuse a confirm of an import that is not open (rule 10, `NotOpen`) or reviewed at an old version (`StaleReview`). The overdraft's twin is the **model-call allowance**: an `Allowance` aggregate keyed by organization and day refuses the 41st `TakeModelCall`, with the invariant "at most 40" (the example's `WithinDailyLimit` is the closer model) |
| Part 2: `AccountSummary`, `Statement` | `ImportSummary` counts rows by outcome (ready, needs a decision, cannot import, left out, already there) for the Result's three numbers; an `ImportActivity` view emits one activity line per decision, confirm and take-back, as `Statement` emits a line per movement |
| Part 3: `Customer` and `MainAccountProvisioning` | The organization's **members** play the customer (`AddPerson` by email, `AlreadyMember`); the policy step is "whenever an import is confirmed, send the result mail", which goes one step past the tutorial into an [external system](./external-system.md) ([resend](./resend.md)) |
| Part 4: `CurrentActor`, `Session`, `NotOwner`, `BankApi`, the bank's rules | `CurrentActor` from `packages/kernel/src/Actor.context.ts` (member, organization, role) provided by the Better Auth session middleware; `NotPermitted` for a viewer or another organization; an Api naming the import commands and `ImportSummary`; the model rule "an organization always keeps an admin" (rule 7) and a relation "an item and the import that created it belong to one organization" (rule 6) |
| Part 5: Durable Objects behind a Worker | `apps/inventory/src/server/worker.ts` serves the Api; `packages/infra/src/Inventory.stack.ts` gains `DomainCloudflare.providers()`; each import becomes a Durable Object instead of rows in D1 |
| Part 6: foldkit app watching the balance | The React Review and Result screens (`packages/catalog/web/src/ReviewStep.screen.tsx`, `ResultStep.screen.tsx`) watch `ImportSummary` over a WebSocket; the app keeps React, so foldkit is optional |
| Part 7: Axiom | The app's telemetry (`apps/inventory/src/server/Telemetry.ts`, `Observability.ts`) receives `Domain.decide` spans; annotate a confirm with its row count |
| Part 8: change a view, total by day | Add a `takenBack` count to `ImportSummary` with `version: 1`; a `ModelCallsByDay` or `ItemsCreatedByDay` view keyed by day, filled by backfill |

A worked Part 1 step, in the main shape:

```ts
// SKETCH: not compiled
import * as Domain from "@alchemy.run/domain"
import * as S from "effect/Schema"

export const ImportId = S.String.pipe(S.brand("ImportId"))

export class ImportConfirmed extends Domain.Event("ImportConfirmed", { rowCount: S.Int }) {}
export class ImportNotOpen extends Domain.Rejection("ImportNotOpen") {}
export class ConfirmImport extends Domain.Command("ConfirmImport", {
  input: { importId: ImportId },
  events: [ImportConfirmed],
  rejects: [ImportNotOpen]
}) {}

export class Import extends Domain.Aggregate("Import", {
  id: ImportId,
  state: S.Union([
    S.TaggedStruct("Open", { rowCount: S.Int }),
    S.TaggedStruct("Imported", { rowCount: S.Int }),
    S.TaggedStruct("TakenBack", {})
  ]),
  initial: { _tag: "Open", rowCount: 0 },
  transitions: {
    OnlyAnOpenImportIsConfirmed: ({ before, command }) =>
      command._tag !== "ConfirmImport" || before._tag === "Open"
  },
  commands: [ConfirmImport],
  keyOf: (cmd) => cmd.importId,
  decide: {
    // `new`, not `.make`: the prover on main does not read `.make` here (see below).
    ConfirmImport: (s) =>
      s._tag !== "Open" ? new ImportNotOpen() : [new ImportConfirmed({ rowCount: s.rowCount })]
  },
  evolve: {
    ImportConfirmed: (_, e) => ({ _tag: "Imported" as const, rowCount: e.rowCount })
  }
}) {}
```

On beta.87 the command declares `target: ImportId` and an empty input, and the aggregate has no `keyOf` or
`transitions`.

The tutorial's first part can be followed with this app's nouns today, on both refs. A trial on 2026-11-19 did it
(not this exact block, but an `Import` aggregate in its shape):

- **On beta.87**, in memory: an `Import` aggregate with `StageImport` and `ConfirmImport`, the events
  `ImportStaged` and `ImportConfirmed`, and the rejections `NotOpen` and `StaleReview`, hosted with
  `Inventory.layer(Layer.empty).pipe(Layer.provide(Domain.InMemory))` under Bun and Node. The stage answered a receipt
  at version 1; a confirm reviewed at another version was rejected with `StaleReview { current: 1 }`; the right one
  answered version 2 with its reply; the same `commandId` sent again answered the same receipt; a second confirm was
  rejected with `NotOpen`; `Domain.verify(Inventory)` answered `[]`. Stories with `given`, `when(ref, command)`,
  `then`, `replied` and `rejected` passed under Vitest, and a story that left an event unasserted failed with
  Part 2's message.
- **On main**, in the shape above (no `target`, `keyOf`): stories with `Story.when(command)` passed, and
  `Verify.aggregate` proved every rule of an `ImportDraft` aggregate, among them `NothingIsWrittenBeforeConfirm` and
  `AConfirmOfAClosedImportWritesNothing`; a copy with a deliberate bug failed with `NotVerified` and the shortest
  sequence that broke the rule.

Two things the trial settled for blocks like this one. Inside `decide`, build events and rejections with `new`: on
main the prover reports that a `decide` returning `Event.make(...)` returns something other than an event, proves
nothing and runs no sequence through it, and on beta.87 `Rejection.make()` does not type-check (main fixes the type in commit `663f78894`, #3357). The app's Effect
diagnostic `newSchemaClass` reports every `new`, so domain blocks need an exception to it (on beta.87 the trial used
`// @effect-diagnostics-next-line newSchemaClass:off`). And keep the commands, events, rejections and helpers that
`decide`, `evolve`, invariants and transitions use reachable from the aggregate's file by relative imports: the
prover on main follows only specifiers that start with `.` (`packages/domain/src/Prove/internal/Source.ts:229`), so
importing them from the app's `contract` package by name leaves them unread.

- **Used today:** no. The import's lifecycle is a guarded D1 batch behind the `ImportStore` port
  (`packages/catalog/model/src/Import/ImportStore.store.ts`, D1 adapter `packages/catalog/host/src/ImportStore.adapter.ts`),
  the allowance is `AllowanceStore.take` (`packages/access/model/src/Allowance/AllowanceStore.store.ts`), and the
  review is the pure `review` in `packages/catalog/model/src/Review/Review.rules.ts`.
- **Where it goes:** a new model package beside `packages/catalog/model`, its stories in
  `packages/catalog/model/test`, hosted by `apps/inventory/src/server/App.ts`.
- **What the person gets:** nothing they can see while the tutorial is followed in memory; from Part 6 on, a Result
  screen that updates live.

## How to check it

Follow each part's own check, retold: Parts 1 to 3 are stories in `packages/catalog/model/test` (`Story.make` with
the model and its handlers layer), the unasserted-event failure of Part 2 included. On main, Part 1's
`Verify.aggregate(Import)` and Part 4's `Verify.model(model, { apis, story })` prove or check rules 7 and 10; they
need `NodeServices.layer` because they read source files. Both ran in a trial on 2026-11-19 on a model of this app
beside the example on main: `Verify.aggregate` proved each aggregate's rules in under two seconds, and
`Verify.model(Inventory, { apis: [InventoryApi], story })` answered in about 36 seconds with 19 rules proved and the
model invariant checked in every sequence of up to 2 commands. Keep one aggregate name per test file: two aggregates
of the same name imported into one file were read from one file, and the report said the code disagreed with what the
explorer read. Part 4's Api test is `clientInProcess` over
`Domain.InMemory`. Parts 5 to 8 are checked on a running stack: the watched summary changes, the trace appears, the
deploy prints its backfill lines.

## What it needs

Parts 1 to 4: `@alchemy.run/domain`, `effect`, `vitest` and `@effect/vitest`, in memory; on beta.87 the package also
requires the peer `alchemy` at `2.0.0-beta.87` (the installer added it in the trial on 2026-11-19, with
`effect@4.1.4`, the app's version, and no peer warning). The `Verify` steps need main (unpublished) and
`@effect/platform-node`; the library brings `z3-solver` and `oxc-parser` as
dependencies on main (`packages/domain/package.json`). Part 5 on: `@alchemy.run/cloudflare` and a Cloudflare profile
([host on Cloudflare](./host-cloudflare.md)). Part 6: foldkit (optional for this React app). Part 7: `@alchemy.run/axiom`
and an Axiom profile. Every part exists at beta.87 in its `target` form.

## Verdict

**Use:** follow the tutorial in order on this app's nouns, Parts 1 to 3 in memory first, in the `target` form on
beta.87 (an `Import` aggregate ran that way in the trial on 2026-11-19); the `Verify` steps of Parts 1 and 4 are in
the main form and ran on `main@dbfd0ddb` in the same trial. Use the example table above to find the upstream file for
each block before writing it.

## Where this was read

- https://alchemy.run/domain/tutorial/part-1 to `part-8` (the live site documents beta.87; read from the docs folder)
- `website/src/content/docs/domain/tutorial/part-1.mdx` to `part-8.mdx` at `v2.0.0-beta.87`; on `main@dbfd0ddb`:
  parts 1 to 6 and 8 changed, part 7 same
- `examples/cloudflare-domain` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed (domain files, tests, manifests;
  four files removed, `Customer/Registration.decision.ts`, fourteen test files and `test/fixtures/` new)
- `examples/cluster-domain` on `main@dbfd0ddb` (outline)
- `packages/domain/skills/alchemy-domain/references/layout.md` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same
- `packages/domain/src/{Command,Aggregate,Story,Api,View,Model,Relation,Verify,RequestContext,Prove}.ts` and
  `Cloudflare/index.ts` at both refs, for the checks above (by search, not in full)
