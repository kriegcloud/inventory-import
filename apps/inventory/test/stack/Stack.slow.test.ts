// The stack test (goals/alchemy-uptake, step 4): the app's own stack, as `bun run dev:alchemy` declares it, deployed
// on Alchemy's local providers by its test harness, then used over HTTP as a person would: a test account signs in
// with its cookie, imports items_clean.csv through the same upload and confirm the screen sends, and reads its 25
// items back. The one thing not to break: the sign-in secret the stack mints is in no file the run writes. The state
// is in memory; the local runtime still writes its databases under `.alchemy/local` here, so the run's own database
// is removed when it ends (it holds the test accounts' password hashes and the run's sessions).
//
// Beside it, the harness test of the model's Worker (Benjamin, 2026-11-26, "Beside the stack test"; host-03, access-01,
// access-02), sent to the local address `alchemy dev` gives that Worker (localhost:1338, "Restate for dev:alchemy",
// 2026-11-27), as the site's Worker will send it over the binding: a `TakeCall` sent with the cookie the site handed
// at sign-in is decided as that member, one with no cookie is refused `NotSignedIn`; and a `watch` opened with the
// cookie is closed once its verdict runs out after a sign-out ("One minute at most"; about ten seconds later than
// that under `alchemy dev`, said where it is checked), its reconnect refused `NotSignedIn`. It holds
// what no fast test can: the binding names the stack hands the Worker, the Secure-cookie setting, the D1 database
// both Workers read and the Durable Objects host.
//
// And the harness test of the hosted half (tests-13, host-06's check): one list of calls, sent to the model's Worker
// on Durable Objects and to the same composition in memory (`modelsOn` on `Domain.InMemory`, judged over the site's
// own sessions), answers the same, refusal by refusal; the site's forwarding route (host-04) reads the view the calls
// made, over HTTP and as a live read at the member's own address, refuses a live read at somebody else's address with
// the lookup's sentence, and refuses a call from another site. What it does not hold: a deployed stage's Secure
// cookie, and a page in a browser (the headless look on `bun run dev` holds that).
import * as Cloudflare from "@alchemy.run/cloudflare"
import * as Test from "@alchemy.run/test/Vitest"
import InventoryDev, { localStackState } from "@beep/infra/InventoryDev"
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem"
import { assertSome, deepStrictEqual } from "@effect/vitest/utils"
import * as State from "alchemy/State"
import * as A from "effect/Array"
import * as NodeSocket from "@effect/platform-node/NodeSocket"
import { signInSentence } from "@inventory/access-model/SessionRules"
import { NotSignedIn } from "@inventory/kernel/AccessError"
import { Member } from "@inventory/kernel/Member"
import { SessionLookup, SessionVerdict } from "@inventory/kernel/SessionLookup"
import * as Domain from "@alchemy.run/domain"
import { modelsOn } from "@inventory/model-app/Models"
import { memberPrefix, serverPrefix } from "@inventory/model-app/ModelRoutes"
import type { UsageServerClient as UsageServerClientOf } from "../../src/server/Models.ts"
import { AllowanceNotFound, DayUsedUp, NotPermitted } from "@inventory/usage-model/Allowance"
import { UsageMemberApi } from "@inventory/usage-model/MemberApi"
import { UsageServerApi } from "@inventory/usage-model/ServerApi"
import * as Clock from "effect/Clock"
import * as DateTime from "effect/DateTime"
import * as MutableHashMap from "effect/MutableHashMap"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Fiber from "effect/Fiber"
import * as FileSystem from "effect/FileSystem"
import * as FetchHttpClient from "effect/http/FetchHttpClient"
import * as Headers from "effect/http/Headers"
import * as HttpClient from "effect/http/HttpClient"
import * as HttpClientRequest from "effect/http/HttpClientRequest"
import * as HttpApiClient from "effect/http-api/HttpApiClient"
import * as Layer from "effect/Layer"
import * as O from "effect/Option"
import * as PlatformError from "effect/PlatformError"
import * as P from "effect/Predicate"
import * as Queue from "effect/Queue"
import * as Redacted from "effect/Redacted"
import * as Result from "effect/Result"
import * as S from "effect/Schema"
import * as Socket from "effect/socket/Socket"
import * as Stream from "effect/Stream"
import * as Str from "effect/String"
import clean from "../../public/samples/items_clean.csv?raw"
import { Api } from "../../src/api/v1/Api.ts"
import { stage } from "../server/support/files.ts"
import { upload } from "../server/support/upload.ts"

// A personal stage: the dev stack's guard lets only `alchemy dev` (here, the harness's `dev: true`) start one.
const stageName = "dev_stacktest"
// Where the local runtime writes, whatever `dotAlchemy` says: under the folder vitest runs in, the app's (seen in the
// trial). Named from this file, since the harness does not keep the working folder a relative path is read from.
const dotAlchemy = `${import.meta.dirname}/../../.alchemy`
const runtimeData = `${dotAlchemy}/local`

const { test, beforeAll, afterAll, deploy, destroy } = Test.make({
  providers: Cloudflare.providers().pipe(
    Layer.provideMerge(Layer.mergeAll(FetchHttpClient.layer, NodeFileSystem.layer))
  ),
  // The stack's own store: its `state` is the one a deploy uses, so the test reads the same records.
  state: localStackState,
  dev: true,
  stage: stageName
})

/**
 * Every file under `dir`, or none when it is not there. Walked a folder at a time: the file system the harness
 * provides lists nothing with `recursive` (seen: a folder holding a database answered an empty list).
 */
const filesUnder = (
  dir: string
): Effect.Effect<ReadonlyArray<string>, PlatformError.PlatformError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const there = yield* fs.exists(dir)
    if (!there) return A.empty<string>()
    const info = yield* fs.stat(dir)
    if (info.type === "File") return A.of(dir)
    if (info.type !== "Directory") return A.empty<string>()
    const names = yield* fs.readDirectory(dir)
    const nested = yield* Effect.forEach(names, (name) => filesUnder(`${dir}/${name}`), { concurrency: 1 })
    return A.flatten(nested)
  })

// What was under the runtime's folder before this run: only what the run adds is removed after it.
const before = beforeAll(filesUnder(runtimeData))
const stack = beforeAll(deploy(InventoryDev), { timeout: 240_000 })

afterAll(
  Effect.gen(function* () {
    yield* destroy(InventoryDev)
    const fs = yield* FileSystem.FileSystem
    const had = yield* before
    const now = yield* filesUnder(runtimeData)
    yield* Effect.forEach(
      A.filter(now, (path) => Str.includes("/d1/")(path) && !A.contains(had, path)),
      (path) => fs.remove(path),
      { concurrency: 1, discard: true }
    )
  }),
  { timeout: 120_000 }
)

const Offer = S.Struct({
  status: S.Literal("signed-out"),
  features: S.Struct({
    testAccounts: S.Struct({ password: S.String, accounts: S.Array(S.Struct({ email: S.String })) })
  })
})
const SignInSecret = S.Struct({ attr: S.Struct({ text: S.Redacted(S.String) }) })

/** What the site says of a signed-in session: the member it acts as (ids only are read here). */
const Ready = S.Struct({
  status: S.Literal("ready"),
  actor: S.Struct({ id: S.String, organizationId: S.String })
})

/** The model's Worker as the stack's state records it: the address `alchemy dev` serves it on. */
const ServedAt = S.Struct({ attr: S.Struct({ url: S.String }) })

/** What the site says of a signed-in session, the member whole: what the in-memory run's session lookup reads. */
const ReadyMember = S.Struct({ status: S.Literal("ready"), actor: Member })

/**
 * A test account signed in on the site over HTTP, as the sign-in page does: the first the page offers, or the one with
 * `email`; the `cookie` header the browser sends back from then on.
 */
const signInAs = Effect.fnUntraced(function* (url: string, email: O.Option<string>) {
  const http = yield* HttpClient.HttpClient
  // Signed out, the page offers the test accounts and their password (a personal stage's are the repository's).
  const signedOut = yield* http.get(`${url}/api/v1/identity/session`)
  const signedOutBody = yield* signedOut.json
  const offer = yield* S.decodeUnknownEffect(Offer)(signedOutBody)
  const accounts = offer.features.testAccounts.accounts
  const account = yield* Effect.fromOption(
    O.match(email, {
      onNone: () => A.head(accounts),
      onSome: (wanted) => A.findFirst(accounts, (one) => one.email === wanted)
    })
  )
  const signedIn = yield* http.execute(
    HttpClientRequest.post(`${url}/api/auth/sign-in/email`).pipe(
      HttpClientRequest.setHeader("origin", url),
      HttpClientRequest.bodyJsonUnsafe({ email: account.email, password: offer.features.testAccounts.password })
    )
  )
  return yield* Effect.fromOption(
    O.flatMap(Headers.get(signedIn.headers, "set-cookie"), (header) => A.head(Str.split(";")(header)))
  )
})

/** The first test account signed in. */
const signIn = (url: string) => signInAs(url, O.none())

/** The member the session on `cookie` acts as, as the site says. */
const memberOf = Effect.fnUntraced(function* (url: string, cookie: string) {
  const http = yield* HttpClient.HttpClient
  const response = yield* http.execute(
    HttpClientRequest.get(`${url}/api/v1/identity/session`).pipe(HttpClientRequest.setHeader("cookie", cookie))
  )
  const ready = yield* Effect.flatMap(response.json, S.decodeUnknownEffect(Ready))
  return ready.actor
})

/** The address the model's Worker answers on under `alchemy dev`, read from the stack's state. */
const modelWorkerUrl = Effect.gen(function* () {
  const opening = yield* State.State
  const state = yield* opening
  const fqns = yield* state.list({ stack: "inventory", stage: stageName })
  const fqn = yield* Effect.fromOption(A.findFirst(fqns, (name) => Str.endsWith("ModelWorker")(name)))
  const persisted = yield* state.get({ stack: "inventory", stage: stageName, fqn })
  const served = yield* S.decodeUnknownEffect(ServedAt)(persisted)
  return Str.replace(/\/$/, "")(served.attr.url)
})

/**
 * A WebSocket that sends `cookie` with its upgrade, as a browser sends the site's cookie with every request to its
 * origin: the library's live read sends no header of its own (`@alchemy.run/domain/src/Api.ts`, `protocolWebSocket`).
 */
const socketsWithCookie = Effect.fnUntraced(function* (cookie: string) {
  return yield* socketsWith({ cookie })
})

/** A WebSocket that sends `headers` with its upgrade: the cookie, and the `Origin` a browser's page sends. */
const socketsWith = Effect.fnUntraced(function* (headers: Record<string, string>) {
  const node = yield* Layer.build(NodeSocket.layerWebSocketConstructor)
  const open = Context.get(node, Socket.WebSocketConstructor)
  return Socket.WebSocketConstructor.of((address, options) =>
    open(address, P.isString(options) || A.isArray(options) ? { protocols: options, headers } : { ...options, headers })
  )
})

/**
 * The kernel's session lookup for the in-memory run, over the site's own session answer: who the cookie on a call's
 * headers acts as is what `GET /api/v1/identity/session` says for it, so the memory host judges a call by the same
 * sessions the model's Worker reads from D1. No cookie, or one the site knows nobody by, is refused with the sentence
 * to sign in, as the Worker's lookup refuses it. A member asked about is still in while the site said so.
 */
const sessionsOverSite = (url: string) => {
  const seen = MutableHashMap.empty<string, Member>()
  return Layer.effect(
    SessionLookup,
    Effect.gen(function* () {
      const http = yield* HttpClient.HttpClient
      return SessionLookup.of({
        verdictOf: Effect.fn("SessionLookup.verdictOf")(function* (headers: Headers.Headers) {
          const ready = yield* Effect.fromOption(Headers.get(headers, "cookie")).pipe(
            Effect.flatMap((cookie) =>
              http.execute(
                HttpClientRequest.get(`${url}/api/v1/identity/session`).pipe(
                  HttpClientRequest.setHeader("cookie", cookie)
                )
              )
            ),
            Effect.flatMap((response) => response.json),
            Effect.flatMap(S.decodeUnknownEffect(ReadyMember)),
            Effect.mapError(() => NotSignedIn.make({ reason: signInSentence }))
          )
          MutableHashMap.set(seen, ready.actor.id, ready.actor)
          const at = yield* DateTime.now
          return SessionVerdict.judged({ member: ready.actor, at, sessionEnds: O.none() })
        }),
        memberNow: Effect.fn("SessionLookup.memberNow")(function* (asked) {
          return yield* Effect.succeed(
            O.filter(MutableHashMap.get(seen, asked.id), (member) => member.organizationId === asked.organizationId)
          )
        })
      })
    })
  )
}

/** An answer as the two runs are compared: a receipt is "accepted" (its ids are the host's own), a refusal itself. */
const comparable = <A, E, R>(call: Effect.Effect<A, E, R>) =>
  Effect.match(call, { onFailure: (refusal) => refusal, onSuccess: () => "accepted" as const })

/** What a call was refused with, or what it answered, as a value a test compares. */
const answerOf = <A, E, R>(call: Effect.Effect<A, E, R>): Effect.Effect<E | { readonly accepted: A }, never, R> =>
  Effect.match(call, { onFailure: (refusal) => refusal, onSuccess: (answer) => ({ accepted: answer }) })

test(
  "a test account signs in over HTTP, imports items_clean.csv and reads 25 items back; the secret is in no file",
  Effect.gen(function* () {
    const outputs = yield* stack
    const url = String(outputs.url)

    const sent = yield* signIn(url)

    // The app's own client, as the page's: the cookie, and the origin a write from the page carries.
    const client = yield* HttpApiClient.make(Api, {
      baseUrl: url,
      transformClient: HttpClient.mapRequest(HttpClientRequest.setHeaders({ origin: url, cookie: sent }))
    })
    const table = yield* stage(new File([clean], "items_clean.csv"))
    const staged = yield* upload({ client, table })
    deepStrictEqual([staged.progress.rows, staged.progress.ready], [25, 25])
    const confirmed = yield* client.imports.commit({
      params: { id: staged.id },
      payload: { revision: staged.revision, madeOn: {}, set: {}, clear: [] }
    })
    assertSome(
      O.map(confirmed.result, (result) => result.created),
      25
    )
    const items = yield* client.items.list()
    deepStrictEqual(items.length, 25)

    // The secret the stack minted, read from its state, is in no file under the runtime's folder.
    // The service is the effect that opens the store.
    const opening = yield* State.State
    const state = yield* opening
    const fqns = yield* state.list({ stack: "inventory", stage: stageName })
    const secretFqn = A.findFirst(fqns, (fqn) => Str.endsWith("SignInSecret")(fqn))
    assertSome(
      O.map(secretFqn, () => true),
      true
    )
    const persisted = yield* state.get({
      stack: "inventory",
      stage: stageName,
      fqn: O.match(secretFqn, { onNone: () => "", onSome: (fqn) => fqn })
    })
    const secret = yield* S.decodeUnknownEffect(SignInSecret)(persisted)
    const text = Redacted.value(secret.attr.text)
    deepStrictEqual(text.length, 64)
    const fs = yield* FileSystem.FileSystem
    const written = yield* filesUnder(dotAlchemy)
    // The search reads the run's own database at least: a search of no file proves nothing.
    deepStrictEqual(
      A.some(written, (path) => Str.includes("/d1/")(path) && Str.endsWith(".sqlite")(path)),
      true
    )
    const holding = yield* Effect.filter(
      written,
      (path) => Effect.map(fs.readFile(path), (bytes) => Str.includes(text)(new TextDecoder("latin1").decode(bytes))),
      { concurrency: 1 }
    )
    deepStrictEqual(holding, [])
  }),
  { timeout: 180_000 }
)

test(
  "Usage answers one list of calls the same in memory and on Durable Objects, and the site forwards a page's reads to it",
  Effect.gen(function* () {
    const outputs = yield* stack
    const url = String(outputs.url)
    const model = yield* modelWorkerUrl
    // The second organization's admin, who uses up its day; a viewer and an editor of the first. Each run's model
    // Worker has objects of its own, so nothing was taken for the second organization before this test.
    const admin = yield* signInAs(url, O.some("elena@sample-supply.test"))
    const viewer = yield* signInAs(url, O.some("priya@example-works.test"))
    const editor = yield* signInAs(url, O.some("dana@example-works.test"))
    const elena = yield* memberOf(url, admin)
    const dana = yield* memberOf(url, editor)
    const as = (cookie: string) => ({ headers: { cookie } })

    // The one list: the second organization's forty and a forty-first, a viewer's check, a call for an organization
    // the caller is not in, the first organization's next call, and one with no cookie.
    const calls = (server: UsageServerClientOf) =>
      Effect.all(
        [
          Effect.forEach(
            A.range(1, 40),
            () => Effect.result(server.TakeCall({ organizationId: elena.organizationId, purpose: "view" }, as(admin))),
            { concurrency: 1 }
          ),
          comparable(server.TakeCall({ organizationId: elena.organizationId, purpose: "view" }, as(admin))),
          comparable(server.TakeCall({ organizationId: dana.organizationId, purpose: "check" }, as(viewer))),
          comparable(server.TakeCall({ organizationId: dana.organizationId, purpose: "view" }, as(admin))),
          comparable(server.TakeCall({ organizationId: dana.organizationId, purpose: "view" }, as(editor))),
          comparable(server.TakeCall({ organizationId: dana.organizationId, purpose: "view" }))
        ],
        { concurrency: 1 }
      )
    /** A run's answers as they are compared: the forty's receipts are each host's own ids, so only "accepted". */
    const compared = ([forty, ...rest]: Effect.Success<ReturnType<typeof calls>>) => [
      A.map(forty, Result.match({ onSuccess: () => "accepted" as const, onFailure: (refusal) => refusal })),
      ...rest
    ]

    // On Durable Objects, at the address `alchemy dev` gives the model's Worker.
    const onObjects = yield* UsageServerApi.clientHttp(`${model}${serverPrefix}`).pipe(Effect.flatMap(calls))
    // In memory, on the model Worker's own composition (`modelsOn`), judged over the same sessions.
    const hosted = yield* Layer.build(modelsOn({ platform: Domain.InMemory, sessions: sessionsOverSite(url) }))
    const inMemory = yield* UsageServerApi.clientInProcess.pipe(Effect.provideContext(hosted), Effect.flatMap(calls))
    deepStrictEqual(compared(inMemory), compared(onObjects))
    // And what the list holds: forty taken, then the day used up, the viewer's check not permitted, the other
    // organization's allowance not found, the first organization's call taken, and nobody refused with the sentence.
    const [forty, fortyFirst, viewerCheck, elsewhere, firstsNext, nobody] = onObjects
    deepStrictEqual(A.every(forty, Result.isSuccess), true)
    deepStrictEqual(
      [S.is(DayUsedUp)(fortyFirst), S.is(NotPermitted)(viewerCheck), S.is(AllowanceNotFound)(elsewhere), firstsNext],
      [true, true, true, "accepted"]
    )
    deepStrictEqual(nobody, NotSignedIn.make({ reason: signInSentence }))
    const lastOf = (run: typeof onObjects) => A.getSuccesses(run[0]).slice(-1)

    // The site's forwarding route (host-04), as a page reaches it: the view read through `/api/model/member` with
    // the cookie and the page's own origin, at least as new as the fortieth call, the same as the memory host's.
    const page = HttpClient.mapRequest(HttpClientRequest.setHeaders({ origin: url, "sec-fetch-site": "same-origin" }))
    const throughSite = yield* UsageMemberApi.clientHttp(`${url}/api/model/member`).pipe(
      Effect.provideServiceEffect(HttpClient.HttpClient, Effect.map(Effect.service(HttpClient.HttpClient), page))
    )
    const read = yield* throughSite.AllowanceToday.get(elena.organizationId, {
      ...as(admin),
      atLeast: lastOf(onObjects)
    })
    const readInMemory = yield* UsageMemberApi.clientInProcess.pipe(
      Effect.provideContext(hosted),
      Effect.flatMap((reader) =>
        reader.AllowanceToday.get(elena.organizationId, { ...as(admin), atLeast: lastOf(inMemory) })
      )
    )
    deepStrictEqual(read?.taken, 40)
    deepStrictEqual(readInMemory?.taken, read?.taken)

    // A live read through the site, at the member's own address, with the cookie and the page's origin: it opens and
    // delivers the count. One at another member's address is refused by the model's session, as the page's member.
    const sockets = yield* socketsWith({ cookie: admin, origin: url })
    const watchedAt = (member: string) =>
      UsageMemberApi.clientWebSocket(`${url}/api/model/member/${member}`).pipe(
        Effect.provideService(Socket.WebSocketConstructor, sockets),
        Effect.flatMap((reader) => reader.AllowanceToday.watch(elena.organizationId).pipe(Stream.runHead)),
        Effect.timeout("30 seconds"),
        answerOf
      )
    const watched = yield* watchedAt(elena.id)
    const delivered: unknown = P.hasProperty(watched, "accepted")
      ? O.map(watched.accepted, (snapshot) => snapshot.state?.taken)
      : watched
    deepStrictEqual(delivered, O.some(40))
    const forSomebodyElse = yield* watchedAt(dana.id)
    deepStrictEqual(
      forSomebodyElse,
      NotSignedIn.make({ reason: "This page was opened for somebody else than is signed in now. Load the page again." })
    )

    // From another site's page, the route refuses the call before anything is read or forwarded.
    const crossSite = yield* Effect.flatMap(Effect.service(HttpClient.HttpClient), (http) =>
      http.execute(
        HttpClientRequest.post(`${url}/api/model/member`).pipe(
          HttpClientRequest.setHeaders({
            cookie: admin,
            origin: "https://elsewhere.example",
            "sec-fetch-site": "cross-site"
          })
        )
      )
    )
    deepStrictEqual(crossSite.status, 403)
  }).pipe(Effect.scoped),
  { timeout: 180_000 }
)

test(
  "the model's Worker takes a call as the member whose cookie it is sent with, and refuses one sent with none",
  Effect.gen(function* () {
    const outputs = yield* stack
    const url = String(outputs.url)
    const model = yield* modelWorkerUrl
    const cookie = yield* signIn(url)
    const member = yield* memberOf(url, cookie)
    const withCookie = { headers: { cookie } }
    const server = yield* UsageServerApi.clientHttp(`${model}${serverPrefix}`)
    const reader = yield* UsageMemberApi.clientHttp(`${model}${memberPrefix}/${member.id}`)

    // Decided as the member the cookie names: their organization's count goes up by the call.
    const before = yield* reader.AllowanceToday.get(member.organizationId, { ...withCookie, atLeast: [] })
    const taken = yield* server.TakeCall({ organizationId: member.organizationId, purpose: "view" }, withCookie)
    const after = yield* reader.AllowanceToday.get(member.organizationId, { ...withCookie, atLeast: [taken] })
    deepStrictEqual(
      O.map(O.fromNullOr(after), (count) => count.taken),
      O.some(O.match(O.fromNullOr(before), { onNone: () => 1, onSome: (count) => count.taken + 1 }))
    )
    // The organization comes from the session, never from the payload: another one is not found.
    const elsewhere = yield* server
      .TakeCall({ organizationId: `${member.organizationId}-other`, purpose: "view" }, withCookie)
      .pipe(answerOf)
    deepStrictEqual(S.is(AllowanceNotFound)(elsewhere), true)

    // No cookie: refused with the sentence to sign in, and nothing is taken.
    const signedOut = yield* server.TakeCall({ organizationId: member.organizationId, purpose: "view" }).pipe(answerOf)
    deepStrictEqual(signedOut, NotSignedIn.make({ reason: signInSentence }))
    const unchanged = yield* reader.AllowanceToday.get(member.organizationId, { ...withCookie, atLeast: [] })
    deepStrictEqual(unchanged?.taken, after?.taken)
  }).pipe(Effect.scoped),
  { timeout: 60_000 }
)

test(
  "a watch opened with the cookie is closed after a sign-out with no change to its key, and its reconnect is refused NotSignedIn",
  Effect.gen(function* () {
    const outputs = yield* stack
    const url = String(outputs.url)
    const model = yield* modelWorkerUrl
    const http = yield* HttpClient.HttpClient
    const cookie = yield* signIn(url)
    const member = yield* memberOf(url, cookie)
    const server = yield* UsageServerApi.clientHttp(`${model}${serverPrefix}`)
    yield* server.TakeCall({ organizationId: member.organizationId, purpose: "view" }, { headers: { cookie } })
    const sockets = yield* socketsWithCookie(cookie)
    const reader = yield* UsageMemberApi.clientWebSocket(`${model}${memberPrefix}/${member.id}`).pipe(
      Effect.provideService(Socket.WebSocketConstructor, sockets)
    )
    const delivered = yield* Queue.unbounded<unknown>()
    const watching = yield* reader.AllowanceToday.watch(member.organizationId).pipe(
      Stream.runForEach((snapshot) => Queue.offer(delivered, snapshot)),
      answerOf,
      Effect.forkScoped
    )
    // Open and delivering: the count as it is now.
    yield* Queue.take(delivered)

    const signOut = yield* http.execute(
      HttpClientRequest.post(`${url}/api/auth/sign-out`).pipe(
        HttpClientRequest.setHeaders({ origin: url, cookie }),
        HttpClientRequest.bodyJsonUnsafe({})
      )
    )
    deepStrictEqual(signOut.status, 200)
    const signedOutAt = yield* Clock.currentTimeMillis

    // Nothing changes the key: the read ends because its verdict ran out, and the read it reconnects is refused.
    const ended = yield* Fiber.join(watching).pipe(Effect.timeout("90 seconds"))
    const waited = (yield* Clock.currentTimeMillis) - signedOutAt
    deepStrictEqual(ended, NotSignedIn.make({ reason: signInSentence }))
    // The verdict runs out a minute after the read opened. Under `alchemy dev` the object closed it about 70 s after
    // it opened, twice on 2026-11-27: some 10 s after the verdict ran out, for a reason not found in the library (its
    // alarm closes the read, `@alchemy.run/domain/src/DurableObjects.ts`, `makeExpiry`). Not looked at on a deploy.
    deepStrictEqual(waited <= 75_000, true)
  }).pipe(Effect.scoped),
  { timeout: 120_000 }
)
