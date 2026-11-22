---
type: Reference
title: Resend
description: The distilled Resend client (an Effect SDK for Resend's mail API) and how inventory-import would send its four mails through it, as the adapter behind a mail sender the domain model declares as an external system.
tags: [alchemy-domain, extra]
---

# Resend

Read at the library's release `2.0.0-beta.87` and its `main@dbfd0dd`, not at the pin `734c27a` the repository
builds on. What changed between that touches what this page recommends is listed once in [the map](../00-map.md),
"From `dbfd0dd` to the pin".

`@distilled.cloud/resend` is a generated Effect SDK for Resend's REST API: every Resend operation is a function that
returns an `Effect` with a typed input, a typed output and the tagged errors that operation can answer. Sending a mail
is one operation, `createEmail`; it needs an `HttpClient` and a `Credentials` service in context, both provided as
Layers. In a domain model the mail sender is not a vendor call scattered through handlers: it is an
[external system](./external-system.md) the model declares in its own words ("send this person this mail"), called
by a [policy](./policy.md) after an event, and the Resend client lives only in the adapter Layer behind it. The
Alchemy docs: "An external system is a service outside the model that its policies call"
[https://alchemy.run/domain/external-system].

## When to reach for it

- A mail must follow something that already happened in the model: an import was confirmed, a take-back ran, a
  person was added. That is a policy calling a `Mailer` external system; the Resend client is the production adapter.
- Better Auth asks the app to send a link (address verification, password reset, an organization invitation). Those
  are callbacks inside the sign-in route, not domain events; the same `Mailer` adapter answers them.
- Deploy-time setup of the sending domain and a sending-only key (`createDomain`, `verifyDomain`, `createApiKey`).
  There is no Alchemy Resend provider (no `resend` hit under `packages/` at `main@dbfd0ddb` outside the AWS package's
  unrelated `ResendValidationEmail`), so that would be a custom provider calling this client.
- Not for anything that must happen in the same step as a write: a policy runs after the commit, at least once.

## How it is declared

The client, as the source has it (`@distilled.cloud/resend@1.0.0-rc.20`, the version on npm today, peer
`effect ^4.1.2`; the app pins `effect` 4.1.4):

```ts
// SKETCH: not compiled
import * as Resend from "@distilled.cloud/resend"
import * as Config from "effect/Config"
import * as Effect from "effect/Effect"
import * as FetchHttpClient from "effect/http/FetchHttpClient"
import * as Layer from "effect/Layer"

// Credentials from the app's own Settings (a Config.Redacted), not from process.env.
const ResendLive = Effect.gen(function* () {
  const apiKey = yield* Config.Redacted("RESEND_API_KEY")
  return Resend.fromApiKey({ apiKey })
}).pipe(Layer.unwrap, Layer.merge(FetchHttpClient.layer))

const sendOne = Resend.createEmail({
  from: "Inventory <mail@example.com>",
  to: "dana@example.com",
  subject: "Import confirmed",
  text: "149 items created.",
  // The event that caused the mail, `<stream>/<seq>`: sent as the Idempotency-Key header.
  idempotencyKey: "Import/imp_0b3f/2",
  // The same key with "-", the only form a tag allows: Resend's webhook events carry it back.
  tags: [{ name: "event", value: "Import-imp_0b3f-2" }]
}).pipe(
  Effect.catchTags({
    TestingRecipientOnly: () => Effect.succeed({ id: "" }),
    DailyQuotaExceeded: () => Effect.succeed({ id: "" })
  })
)
```

What the source says, piece by piece:

- **The operation.** `createEmail: API.OperationMethod<CreateEmailRequest, SendEmailResponse, CreateEmailError,
  ResendOpContext>`, `POST /emails`, span `CreateEmail` (`packages/resend/src/services/resend.ts:5353-5387`, the
  HTTP binding at `:12447-12462`). The input has `from`, `to` (a string or up to 50), `subject` required, and optional
  `idempotencyKey` (sent as the `Idempotency-Key` header), `bcc`, `cc`, `reply_to`, `html`, `text`, `template` (`{ id,
  variables }` of a published template), `headers`, `scheduled_at`, `attachments`, `tags`, `topic_id` (`:1424-1452`).
  The answer is `{ id }` (`SendEmailResponse`, `:1453-1456`). `createEmailBatch` (`:5389-5436`) sends up to 100 mails
  as the request body under ONE `idempotencyKey` for the whole batch (a mail in it has no key of its own,
  `SendEmailRequest`, `:1482-1508`); `batchValidation` travels as the `x-batch-validation` header: `strict`, Resend's
  default, refuses the whole batch when one mail is invalid, `permissive` sends the valid ones and lists the rest in
  `errors: [{ index, message }]` (`:1511-1534`, binding `:12540-12547`). The package has 138 operations in all (106
  plain, 32 paginated) in one generated module, plus `webhook_events.ts` for typed webhook payloads.
- **An operation is an Effect two ways.** Called, `createEmail(input)` is an `Effect<O, E, Credentials |
  HttpClient>`; yielded first, `const send = yield* createEmail` captures the context and returns a function with no
  requirements (`packages/core/src/api.ts:172-190`). The second form is how an adapter built once in a Layer keeps
  its calls requirement-free.
- **Credentials.** `Credentials` is a `Context.Service` holding an `Effect<Config, ConfigError>` that the protocol
  resolves on every request (`packages/resend/src/credentials.ts:21-24`). `fromApiKey({ apiKey: Redacted, apiBaseUrl? })`
  builds it from a value (`:27-37`). `CredentialsFromEnv` reads `process.env.RESEND_API_KEY` directly (`:40-56`), so it
  ignores the `ConfigProvider` the app's Worker builds from `env` (`apps/inventory/src/server/worker.ts:16`): use
  `fromApiKey` with the app's own `Config.Redacted`, as the sketch does. (Discord's, GitHub's and 1Password's
  `CredentialsFromEnv` go through `@distilled.cloud/core/config`, which does honour a provided `ConfigProvider`; Resend's
  does not.)
- **The protocol.** `ResendProtocol` is one `makeRestProtocol` call: `Authorization: Bearer <key>`, a fixed
  `User-Agent` (Resend's edge answers 403 without one), and errors mapped by Resend's `name` field
  (`packages/resend/src/protocol.ts:31-76`). `ResendOpContext = Credentials | HttpClient.HttpClient` (`:51`). The
  README's quick start also merges `ResendProtocol` into the Layer; the operation's own config names the protocol and
  core builds it once per process (`packages/core/src/api.ts:218-240`), so only `HttpClient` and `Credentials` are
  required in context.
- **Typed errors on `createEmail`** (`resend.ts:5342-5351`): `DailyQuotaExceeded` and `MonthlyQuotaExceeded` (429; not
  retried, they reset at midnight UTC), `UnverifiedSender` (the `from` domain is not verified), `TestingRecipientOnly`
  (without a verified domain Resend sends only to the account's own address and its test addresses),
  `InvalidAttachment`, `InvalidIdempotencyKey`, `IdempotencyKeyReused` (409: the key was used in the last 24 hours with
  another body), `IdempotentRequestInProgress` (409, retried), plus `ResendOpError`: every operation's common errors
  (`MissingApiKey`, `InvalidApiKey`, `RestrictedApiKey`, `InactiveApiKey`, `SuspendedApiKey`, `InvalidPermission`,
  `ValidationError`, `MissingRequiredField`, `MissingRequiredParameter`, `InvalidParameter`, `ResourceLocked`;
  `packages/resend/src/errors.ts:49-160`), core's HTTP-status errors, `UnknownResendError`, `ResendParseError`,
  `ConfigError`, `HttpClientError`, `InvalidInput`, `SdkError` (`protocol.ts:40-48`).
- **Retries.** `createEmail` and `createEmailBatch` read the `Retry` service (`packages/resend/src/retry.ts:35`) and
  set no override of their own (`resend.ts:5353-5387`, `:5400-5436`). Without a `Retry` service, core's default
  applies: at most two retries (three attempts), full jitter from 50 ms (1 s for a 429), capped at 20 s, the server's
  `Retry-After` honoured, drawn from one retry budget per host that every distilled client in the isolate shares
  (`packages/core/src/retry.ts:117-159`, `:343-355`). What it retries is `isTransientError`
  (`packages/core/src/category.ts:273-278`): an error marked retryable (on a send, `IdempotentRequestInProgress`,
  `resend.ts:400-410`, and `ResourceLocked`, `errors.ts:142-146`), a throttling 429, and an `HttpClientError` whose
  reason is `TransportError`, which includes a response that never finished (`category.ts:246-254`): Resend may
  already have sent that mail. A 5xx is not retried. The quota errors carry no retry mark and are not retried
  (`resend.ts:240-249`, `:523-532`). `Resend.Retry.none` installs `{ while: () => false }` (`retry.ts:42-44`);
  `Resend.Retry.throttling` and `Resend.Retry.transient` retry WITHOUT a limit (`retry.ts:46-50`,
  `packages/core/src/retry.ts:409-423`).
- **Spans.** Each call is one span around all its retries, built from the operation's `span: "CreateEmail"` and the
  module's telemetry config (`system: "resend-api"`, `prefix: "Resend"`; `resend.ts:31-40`,
  `packages/core/src/telemetry.ts:1-30`); the exact span name format was not checked. Nothing is recorded unless the
  app installs a tracer.
- **Webhooks.** `Resend.Webhooks.verifySignature({ payload, headers, secret, toleranceSeconds? })` checks a Standard
  Webhooks (Svix) signature: it reads `svix-id`, `svix-timestamp` and `svix-signature` (or the `webhook-*` names)
  from a `Headers`, a plain record or the three values; computes HMAC-SHA256 over `id.timestamp.body` with the
  base64 part of the endpoint's `whsec_` secret (a string or a `Redacted`); accepts any matching `v1,` entry; and
  refuses a timestamp more than `DEFAULT_WEBHOOK_TOLERANCE_SECONDS` (300) from `Date.now()`, a check that
  `toleranceSeconds: 0` skips (`packages/resend/src/webhooks.ts:32-209`). `payload` must be the raw body as received
  (a string or bytes), never re-serialised JSON. `constructEvent` verifies, then parses and checks only that `type`
  is a string: the event is typed, not decoded, and an event type newer than the client arrives with a `type`
  outside the union (`:211-245`). Failures are `ResendWebhookSignatureError` or `ResendWebhookPayloadParseError`
  (`errors.ts:169-191`). The HMAC runs on core's `Crypto`, a `Context.Reference` with a default (`node:crypto` where
  it exists, else WebCrypto), so no Layer is needed (`packages/core/src/crypto.ts:172-175`). `WebhookEvent` is a
  union of 37 event types and `WebhookEvents` maps each `type` to its payload (`services/webhook_events.ts:988-1069`),
  both reached as `Resend.Webhooks.WebhookEvent` (`index.ts:21`). A bounce reported this way is news from outside
  that becomes a command.
- **Answers are not checked.** Core reads a 2xx body in `lenient` mode unless a
  `ResponseValidation.additionalProperties` or `ResponseValidation.strict` Layer from `@distilled.cloud/core` is
  provided (`packages/core/src/response-validation.ts:1-60`): `{ id }` is typed, not decoded. The adapter decodes
  what it keeps (the message id) with its own Schema, as the app does for every outside answer.
- **In a Worker.** Every request goes through `effect/http/HttpClient` (`packages/core/src/protocol-rest.ts:3`,
  `:641`), and the package's `worker` export condition points at its TypeScript sources (`packages/resend/package.json`).
  With `FetchHttpClient.layer` it runs on workerd's `fetch`, the same way the app's model driver already does
  (`apps/inventory/src/server/Model.ts:39`). Not run in this app's Worker: not verified end to end.

#### Types and helpers (the hand-written part of the package)

| Name | What it is | Where |
| --- | --- | --- |
| `DEFAULT_API_BASE_URL`, `Config` | `https://api.resend.com`; the resolved `{ apiKey, apiBaseUrl }` | `packages/resend/src/credentials.ts:14-19` |
| `Credentials`, `fromApiKey`, `CredentialsFromEnv` | the credentials service and its two Layers; the env one also reads `RESEND_API_BASE_URL` | `credentials.ts:21-56` |
| `ResendProtocol`, `ResendOpError`, `ResendOpContext` | the REST protocol and the types every operation shares | `protocol.ts:40-76` |
| `Retry.Retry`, `Retry.policy`, `Retry.none`, `Retry.throttling`, `Retry.transient` | the retry service; `none` (no retry), `policy(p)`, and `throttling` and `transient`, which retry without a limit; the module also re-exports core's `makeDefault`, `jittered`, `capped`, `throttlingOptions`, `transientOptions`, `throttlingFactory`, `transientFactory` | `retry.ts:21-50` |
| `Webhooks.verifySignature`, `Webhooks.constructEvent`, `DEFAULT_WEBHOOK_TOLERANCE_SECONDS` (300) and the payload, header and option types | Svix signature check and typed webhook events | `webhooks.ts:30-229` |
| `UnknownResendError`, the common errors, `ResendCommonError`, `ResendParseError`, `ResendWebhookSignatureError`, `ResendWebhookPayloadParseError` | errors outside any one operation | `errors.ts:36-184` |
| `paginateResend`, `T` | internal: the cursor strategy the 32 paginated operations use, and the generator's traits | `pagination.ts:19`, `traits.ts` |

The domain side, the part the model owns (names follow [policy](./policy.md)):

```ts
// SKETCH: not compiled
import * as Domain from "@alchemy.run/domain"
import * as S from "effect/Schema"

/** The four mails the app sends, in its own words. */
export const Mail = S.TaggedUnion({
  Invitation: { organizationName: S.String, invitedBy: S.String, link: S.String },
  ImportResult: { fileName: S.String, created: S.Int, updated: S.Int, notImported: S.Int, link: S.String },
  TakenBack: { fileName: S.String, removed: S.Int, restored: S.Int, kept: S.Int, link: S.String },
  SignInLink: { purpose: S.Literals(["verify", "reset"]), link: S.String }
})

/** Resend refused the address itself: a business outcome the People page can show. */
export class AddressRejected extends S.TaggedError<AddressRejected>()("AddressRejected", { to: S.String }) {}

export class Mailer extends Domain.ExternalSystem(
  "Mailer",
  {
    send: {
      args: { to: S.String, mail: Mail, idempotencyKey: S.String },
      success: S.Union([
        S.TaggedStruct("Sent", { messageId: S.String }),
        S.TaggedStruct("NotSent", { reason: S.Literals(["mailOff", "quotaUsed", "previewStage"]) })
      ]),
      error: [AddressRejected]
    }
  },
  { description: "Sends the app's mails. Resend in production; nothing on a stage with no mail key." }
) {}
```

Checked in: `packages/domain/src/ExternalSystem.ts:210-214` (`OpSpec`: `args`, `success`, `error` as one schema or a
list), `:329-380` (`make`, `toLayer` with `validate` defaulting to on), `packages/domain/src/index.ts:218`
(`Domain.ExternalSystem`); `packages/domain/src/Policy.ts:38-49` (`Options.retry`; the handler is `Effect<void>` with no
error), `:201-247` (`make`, `toLayer`), `index.ts:158` (`Domain.Policy`), all at `v2.0.0-beta.87`.

### What main changes

For the domain side: nothing in `ExternalSystem.ts` (identical at `main@dbfd0ddb`); in `Policy.ts` only the doc
example changes, to commands that carry their own target (`packages/domain/src/Policy.ts:151` on main). The docs page
`external-system.mdx` changes the same way (its webhook example's command carries `accountId`; `Story.when` takes the
command alone). `index.ts` moves the exports to lines 177 and 246. The distilled client is not part of the Alchemy
repository and has no beta/main split: one version, `1.0.0-rc.20`, read at the distilled repository's commit
`51ba3a2c6` (2026-11-18).

## Rules, and the mistakes to avoid

- **The model never names Resend.** Policies call `Mailer.send`; only the adapter imports `@distilled.cloud/resend`.
  A story answers `Mailer.send` itself, so no test sends mail.
- **Map vendor refusals onto declared errors, and nothing else.** `TestingRecipientOnly` or a `ValidationError` about
  the `to` address become `AddressRejected`; a quota error becomes `NotSent { reason: "quotaUsed" }`. A timeout, a 5xx
  or an `UnverifiedSender` (a deploy mistake) is not a business outcome: let it fail so the policy runs again, or die.
  An error the operation does not declare is a defect at the seam (`ExternalSystem.ts`, `validateOps`).
- **Key the mail by the event, not by `envelope.id`.** A policy runs at least once (`Policy.ts:43-48`). The
  envelope's `id` is the id of the aggregate instance, the same for every event it records, and an envelope has no
  event id of its own; its fields are `id`, `stream`, `seq`, `at`, `commandId`, `correlationId`
  (`packages/domain/src/Aggregate.ts:45-64`, same on main). The event's own key is its stream (`<aggregate>/<id>`,
  `Aggregate.ts:47`, `InMemory.ts:682`; `InMemory.ts:766` on main) and sequence number: `` idempotencyKey: `${envelope.stream}/${envelope.seq}` ``,
  for example `Import/imp_0b3f/2`. The client sends it as the `Idempotency-Key` header, which Resend takes only at 1
  to 256 characters, or the send fails with `InvalidIdempotencyKey` (`resend.ts:500-510`); the app's ids are at most
  64 characters (`packages/kernel/src/Ids.id.ts:16`), so the key fits. With it a second run of the same event does not
  send a second mail within Resend's 24-hour window; a different body under the same key fails with
  `IdempotencyKeyReused` (`resend.ts:388-397`), which means the mail was already sent, so treat it as `Sent`. Build
  the body only from the event, so a second run sends the same body.
- **Tag the mail with the same key, joined by `-`.** A tag's `name` and `value` take only ASCII letters, digits, `_`
  and `-`, at most 256 characters each (`resend.ts:1417-1423`), so `/` is not allowed: write
  `{ name: "event", value: "Import-imp_0b3f-2" }` (the app's ids hold only those characters, `Ids.id.ts:16`). Resend's
  `email.bounced`, `email.failed`, `email.suppressed` and other mail events carry the tags back as a map in
  `data.tags` (`services/webhook_events.ts:174`, `:220`), with `data.bounce.type` `Permanent`, `Transient` or
  `Undetermined` (`:194`) and `data.suppressed.reason` `previous_bounce` or `previous_complaint` (`:466`): that is how
  a bounce finds the event, and the person, it belongs to.
- **One key covers a whole batch.** `createEmailBatch` sends all its mails under one `Idempotency-Key`. Put in a batch
  only the mails of one event, keyed by that event; a batch that mixes events would send some of them again when one
  event's policy runs a second time under its own key.
- **Set a retry policy that cannot send twice.** The client's default retries a transport failure, a response cut
  off mid-way included, after Resend may already have sent the mail; that retry is safe only because the same
  `idempotencyKey` goes with it. So: every send carries the event's key, and the adapter either keeps the default
  (at most two retries) or wraps the call in `Resend.Retry.none` and leaves redelivery to the policy, which runs the
  same event again under the same key. Never wrap a send in `Resend.Retry.throttling` or `Resend.Retry.transient`:
  they retry without a limit. A send with no key must run under `Resend.Retry.none`.
- **Never `CredentialsFromEnv` in the Worker**: it reads `process.env`, not the app's settings. Read the key once in
  `Settings.ts` as `Config.Redacted` and build `fromApiKey`.
- **No key is a supported state.** The adapter is chosen from the settings, as the model driver is: key present, the
  Resend adapter; absent, an adapter that answers `NotSent { reason: "mailOff" }` and writes nothing. The screen reads
  the outcome; it never says "we mailed you" unless the answer was `Sent`.
- **A preview never sends to a real address.** Its plan gives it no mail key (as it gives none for the model), so the
  "mail off" adapter runs; and preview data holds only test accounts with `.test` addresses (decision "infra, who may
  sign up on a preview"). If a preview ever needs a real send, the adapter refuses any `to` outside
  `@resend.dev`'s test addresses.
- **Do not await mail inside Better Auth's request.** Better Auth's callbacks return a `Promise<void>`; run the send
  through the Worker's `waitUntil` (the app already passes it as `backgroundTasks`, `authOptions.ts:51-52`, `:126-127`),
  so a slow mail never delays sign-in, and a failure is logged, not shown as a sign-in error.
- **Quota.** Resend's free tier and per-team rate limit are small (research 02 §3.18); the quota errors are not
  retried by the client. A mail that hit the quota is `NotSent`, said on screen, not retried every minute.

## In this app

Today no mail is sent (decision "infra I6, email (23)": "Not now"). Each mail below says what triggers it, who sends
it in the model's terms, what happens with no key, what a preview must never do, and what the stack declares.

1. **The invitation, when an admin adds a person.** Today `addPerson` adds only someone who already signed up, by that
   email (`packages/access/model/src/People/People.handler.ts:54-80`), and Better Auth's `invitation` table is unused.
   Two mails are possible. (a) A notice to an existing account: event `MemberAdded` on the people
   [aggregate](./aggregate.md), policy `InviteMember` calls
   `` Mailer.send({ to, mail: Invitation, idempotencyKey: `${envelope.stream}/${envelope.seq}` }) ``;
   `AddressRejected` becomes a command `MarkInvitationBounced` so the People page can say the address bounced. (b) An invitation to someone with no account: Better Auth's organization plugin calls
   `sendInvitationEmail({ id, role, email, organization, invitation, inviter }, request)`
   (`better-auth@1.7.22`, `dist/plugins/organization/types.d.mts:214-243`), and the invited person must then be allowed
   to sign up: today sign-up is closed to everyone `SIGN_UP` does not name (decision "infra I8",
   `authOptions.ts:129-139`), so (b) also needs that rule to admit an invited email. The recipient's address: the
   kernel's `Member` has no email (`packages/kernel/src/Member.schema.ts:29-38`); the adapter reads it from the
   account (`PeopleStore.accountByEmail` goes the other way, `packages/access/model/src/People/PeopleStore.store.ts:105-106`).
   No key: (a) answers `NotSent { reason: "mailOff" }` and the People page says the person was added and no mail
   went; (b) is not offered, since nobody would learn of the invitation. A preview never mails a real address: it has
   no key, and its people are test accounts with `.test` addresses.
2. **Sign-in verification and password reset.** Better Auth asks for them through
   `emailVerification.sendVerificationEmail({ user, url, token }, request)` and
   `emailAndPassword.sendResetPassword({ user, url, token }, request)` (`@better-auth/core`,
   `dist/types/init-options.d.mts:631-647`, `:727-741`). The app configures neither and sets
   `requireEmailVerification: false` (`authOptions.ts:76-95`); `docs/auth.md` "Not done" says so. These are not
   domain events: no aggregate owns a password. The sign-in route runs the `Mailer` adapter directly, with `mail:
   SignInLink`, under `waitUntil`. No key: the session answer's sign-in features (`docs/auth.md`, the
   `/api/v1/identity/session` line) say reset is off, the sign-in page offers no "forgot password", and
   `requireEmailVerification` stays `false`; turning verification on without a key would lock every new account out.
   A preview has no key, so it never sends a link. These mails have no domain event, so the key is Better Auth's
   `token` for the link, not a stream and sequence number (its length against the 256-character limit is not
   verified).
3. **The result of a confirm.** Event `ImportConfirmed` on the `Import` aggregate, which carries the counts
   (`created`, `updated`, `already`, `notImported` in [event](./event.md)'s shape), and a policy `MailImportResult`:

   ```ts
   // SKETCH: not compiled
   import * as Domain from "@alchemy.run/domain"
   import * as Effect from "effect/Effect"
   import * as O from "effect/Option"

   export class MailImportResult extends Domain.Policy("MailImportResult", { from: Import, on: [ImportConfirmed] }) {}

   export const MailImportResultLive = MailImportResult.toLayer(
     Effect.gen(function* () {
       const mailer = yield* Mailer
       const people = yield* Recipients // a port: the confirming member's address, or none
       return Effect.fn(function* ({ source, event, envelope }) {
         const to = yield* people.addressOf(event.by)
         if (O.isNone(to)) return
         yield* mailer
           .send({
             to: to.value,
             idempotencyKey: `${envelope.stream}/${envelope.seq}`,
             mail: {
               _tag: "ImportResult",
               fileName: event.fileName,
               created: event.created,
               updated: event.updated,
               notImported: event.notImported,
               link: `/?import=${source.id}&step=result`
             }
           })
           .pipe(Effect.catchTag("AddressRejected", () => Effect.void))
       })
     })
   )
   ```

   The link is the Result step's own address (`importAddress(id, "result")` in
   `packages/catalog/web/src/internal/route.ts:18-19`, which also URL-encodes the id; a web package, so the policy
   writes the same shape rather than importing it),
   made absolute with the stage's `BETTER_AUTH_URL`. `by` and `fileName` are fields the event would need; [event](./event.md)'s
   `ImportConfirmed` has the counts but not those two. No key: the policy still runs, the adapter answers `NotSent`,
   and the Result step, which already counts from what is stored, adds nothing about mail. A preview has no key, so
   the same `NotSent` answer; it never mails whoever confirmed.
4. **A take-back.** Event `ImportTakenBack` on the `Import` aggregate; policy `MailTakeBack` calls
   `Mailer.send` with `TakenBack` (removed, restored and kept, the same three numbers the take-back's batch writes,
   `packages/catalog/host/src/ImportStore.adapter.ts`, `takeBack`) and the take-back event's own `<stream>/<seq>` as
   its key, so it never collides with the confirm's mail. A kept item (someone changed it) is named in the mail as the
   screen names it. No key, or a preview: `NotSent { reason: "mailOff" }`, nothing sent, the Result step unchanged.

What the stack declares (`packages/infra/src/Inventory.stack.ts`): a `mailKey` setting in the stage plan beside
`modelKey` (`packages/infra/src/Stage.schema.ts:200-205`), `FromEnvironment({ variable: "RESEND_API_KEY" })` for
production and `NotGiven` for test and preview stages (as `StagePlan.rules.ts:77-105` does for the model key); the
stack reads it with `secretOf` and adds `RESEND_API_KEY` to the Worker's `env` only when present (the pattern at
`Inventory.stack.ts:74-79`, `:119`), plus a plain `MAIL_FROM`. The production key reaches the deploy job as a GitHub
environment secret written by `GitHub.stack.ts` (the `ProductionModelKey` pattern), filled under `op run` from an
`op://` reference that is never resolved by anything else. Use a sending-only key restricted to the sending domain;
the full-access key that creates the domain stays out of the Worker. The domain itself (DNS records, verification
that can take hours) is deploy-time work for a custom provider calling `createDomain` and `verifyDomain`, not
something the Worker does.

- **Used today:** no. No mail at all (`authOptions.ts:81-82`, `docs/auth.md` "Not done"); decision 23 "Not now".
- **Where it goes:** `Mailer` beside the people and import aggregates (`packages/access/model/src/People/`,
  `packages/catalog/model/src/Import/`); the Resend adapter in a new driver `packages/drivers/resend/` next to
  `packages/drivers/openrouter/`; Better Auth's two callbacks in `packages/access/host/src/internal/authOptions.ts`;
  `RESEND_API_KEY` in `apps/inventory/src/server/Settings.ts`, `.dev.vars.example` and the stacks.
- **What the person gets:** a mail with the counts and a link back after a confirm or a take-back, an invitation when
  added, and a way back in when they forget their password; on a stage without mail, screens that say mail is off.

## How to check it

- A [story](./story.md) per policy: given `ImportConfirmed`, `Story.call(Mailer.send, { ... })` with the exact counts
  and link, then `Story.succeed(Mailer.send, { _tag: "Sent", messageId: "m1" })`; a second story answers
  `Story.fail(Mailer.send, new AddressRejected({ to }))` and expects `MarkInvitationBounced` (`Story.call`,
  `Story.succeed`, `Story.fail` are in `packages/domain/src/Story.ts:1925-1955`).
- An adapter test with a fake `HttpClient` that answers Resend's 403 `validation_error` body for an unverified
  domain: the adapter must return `AddressRejected` or `NotSent`, never a defect, and must send the event's
  stream and sequence number as the `Idempotency-Key` header and the `-` form as a tag.
- An adapter test whose fake `HttpClient` fails the first attempt with a `TransportError` and answers `{ id }` on
  the second: both requests carry the same `Idempotency-Key`. A key of 257 characters must be refused before the
  call (Resend would answer `InvalidIdempotencyKey`).
- A webhook test signs a body with a test `whsec_` secret and calls `verifySignature` with `toleranceSeconds: 0`:
  the window is measured with `Date.now()`, not Effect's `Clock`, so a `TestClock` does not move it
  (`webhooks.ts:185-192`). A second test changes one byte of the body and expects `ResendWebhookSignatureError`.
- A Settings test: no `RESEND_API_KEY`, the "mail off" Layer is chosen and the session answer reports reset off.
- On a real key, Resend's test address `delivered@resend.dev` receives the mail; never a person's address from a test.

## What it needs

Any host that runs policies ([in memory](./host-in-memory.md) for stories, [Cloudflare](./host-cloudflare.md) Durable
Objects for this app). Works on `v2.0.0-beta.87`: `Domain.ExternalSystem` and `Domain.Policy` are published there. The
adapter needs `@distilled.cloud/resend@1.0.0-rc.20` (not installed in the app today; only `core`, `cloudflare`,
`github` and a few others arrive through Alchemy), `FetchHttpClient`, a Resend account with a verified sending domain,
and a sending key. Decision 23 must be reversed by the owner first.

## Verdict

**Use:** declare `Mailer` as an external system, send the confirm, take-back and invitation mails from policies and the
two sign-in links from Better Auth's callbacks, and implement `Mailer` in production with `Resend.createEmail` over
`FetchHttpClient` and `Resend.fromApiKey`, with a "mail off" Layer on every stage without a key. The one thing outside
the code is the owner's word: decision 23 is "Not now" until he reverses it.

## Where this was read

- https://alchemy.run/domain/external-system (the live site documents beta.87)
- `website/src/content/docs/domain/external-system.mdx` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed (examples only)
- `packages/domain/src/ExternalSystem.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same
- `packages/domain/src/Policy.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed (doc example only)
- `packages/domain/src/Story.ts` at `v2.0.0-beta.87` (the `Story` object only)
- distilled repository `packages/resend/` at `51ba3a2c6`: `README.md`, `package.json`, every hand-written `src/*.ts`
  and `src/services/webhook_events.ts` in full, `src/services/resend.ts` by outline with `createEmail` and
  `createEmailBatch` in full; `packages/core/src/{retry,category}.ts` in full,
  `packages/core/src/{api,protocol-rest,telemetry,config,crypto,response-validation}.ts` by outline
- the app: `packages/access/host/src/internal/authOptions.ts`, `docs/auth.md`,
  `packages/access/model/src/People/People.handler.ts`, `explorations/ideal-architecture/DECISIONS.md`,
  `explorations/ideal-architecture/research/02-alchemy-infra.md`, `packages/infra/src/Inventory.stack.ts`
