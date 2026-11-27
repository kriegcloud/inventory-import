// The app as the tests run it. Two storages: `TestDatabase`, a real D1 database in local workerd with the real
// migrations (slow: name the file `*.slow.test.ts`), and the in-memory services in `inMemory`, for rules that live in
// the handlers and middleware (fast). Settings come from a ConfigProvider, the same way the Worker gets them. Sign-in
// is real on the D1 database (`TestAuth`, Better Auth on the same binding); in memory nobody is signed in to it
// (`SignedOutAuth`), and the header identity names the actor.
import { type D1, D1Binding } from "@beep/d1/D1"
import { D1Test, D1TestOptions } from "@beep/d1/D1Test"
import * as A from "effect/Array"
import * as Config from "effect/Config"
import * as ConfigProvider from "effect/ConfigProvider"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Fiber from "effect/Fiber"
import * as Layer from "effect/Layer"
import * as MutableRef from "effect/MutableRef"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as Str from "effect/String"
import * as S from "effect/Schema"
import * as DevTools from "effect/devtools/DevTools"
import * as InMemoryPlatform from "@alchemy.run/domain/InMemory"
import * as HttpClient from "effect/http/HttpClient"
import * as HttpClientError from "effect/http/HttpClientError"
import type * as HttpClientRequest from "effect/http/HttpClientRequest"
import type * as HttpClientResponse from "effect/http/HttpClientResponse"
import type * as HttpRouter from "effect/http/HttpRouter"
import * as HttpServer from "effect/http/HttpServer"
import * as HttpApiMiddleware from "effect/http-api/HttpApiMiddleware"
import { actingAs, directoryFollowing, HeaderIdentity, HeaderSessions } from "@inventory/access-host/AccessTest"
import { accessServices } from "@inventory/access-host/Host"
import { SessionIdentityLive } from "@inventory/access-host/SessionIdentity"
import { SessionLookupLive } from "@inventory/access-host/SessionLookup"
import { signIn } from "@inventory/access-host/SignIn"
import { Activity } from "@inventory/kernel/Activity"
import { ActivityId } from "@inventory/kernel/Ids"
import { MemberId, OrganizationId } from "@inventory/kernel/Ids"
import { type Member } from "@inventory/kernel/Member"
import { OpenRouter } from "@beep/openrouter/OpenRouter"
import { ModelId } from "@beep/openrouter/OpenRouterModel"
import { OpenRouterTest } from "@beep/openrouter/OpenRouterTest"
import { AddressLimit } from "../../../src/server/AddressLimit.ts"
import { makeApp, makeRoutes, servicesWith, toServe } from "../../../src/server/App.ts"
import { BetterAuthTest } from "@beep/better-auth/BetterAuthTest"
import { Handlers } from "../../../src/server/handlers.ts"
import { AnswererOpenRouter } from "@inventory/catalog-host/Model"
import {
  AssistantLogMemory,
  CatalogMemoryRef,
  ImportStoreMemory,
  ItemStoreMemory,
  SuggestionStoreMemory
} from "@inventory/catalog-model/Memory"
import { ModelAllowanceViaUsage } from "@inventory/catalog-host/ModelAllowance"
import type { ImportStore } from "@inventory/catalog-model/ImportStore"
import type * as SqlClient from "effect/sql/SqlClient"

/** What a stand-in store may build on: the real store, or the test database itself (a store of its own on it). */
type StoreNeeds = ImportStore | D1 | SqlClient.SqlClient
import * as Observability from "../../../src/server/Observability.ts"
import { SameOriginLive } from "../../../src/server/SameOrigin.ts"
import { ModelAllowanceOverUsage, Models } from "../../../src/server/Models.ts"
import { testAccountPassword } from "@inventory/access-host/TestAccounts"

const migrations = new URL("../../../migrations/", import.meta.url)
// The two test organizations and their people: a seed, not a migration, so a production database starts empty.
const organizations = new URL("../../../seeds/organizations.sql", import.meta.url)

/** Settings as the tests see them: no AI key, the model id wrangler.jsonc sets, a sign-in secret, and quiet logs. */
export const testSettings = {
  AI_MODEL: "anthropic/claude-haiku-5.5",
  LOG_LEVEL: "Warn",
  BETTER_AUTH_SECRET: "a-test-secret-that-is-at-least-32-characters"
} as const

/** A ConfigProvider over plain values: what worker.ts builds from `env`, for a test. */
export const settingsLayer = (values: Record<string, string>) =>
  ConfigProvider.layer(ConfigProvider.fromUnknown(values))

/**
 * Effect DevTools for the Node test runtime, where it works (the Worker cannot hold the connection: see
 * src/server/Observability.ts). Off unless EFFECT_DEVTOOLS_URL is set, for example
 * `EFFECT_DEVTOOLS_URL=ws://localhost:34437 bun run test -- test/server` with the DevTools panel listening.
 */
export const DevToolsWhenAsked = Layer.unwrap(
  Effect.gen(function* () {
    // Read from the process environment itself: the app's own settings are the test's, not the shell's.
    const url = yield* Config.option(Config.String("EFFECT_DEVTOOLS_URL")).parse(ConfigProvider.fromEnv())
    return O.match(url, { onNone: () => Layer.empty, onSome: (address) => DevTools.layer(address) })
  })
).pipe(Layer.orDie)

/**
 * A fresh D1 database (local workerd, nothing persisted) with every migration applied, in filename order. One value,
 * so the SQL client, Better Auth (which takes the raw binding, `D1Binding`) and the seeding share the database one
 * layer build opens.
 */
export const TestDatabase = D1Test.layer(D1TestOptions.make({ migrations, seeds: [organizations] })).pipe(Layer.orDie)

/** Starting authentication settings for a fixture. */
export const authStart = { rateLimit: false, production: false }

/**
 * Better Auth on the test database, as the Worker builds it: no `waitUntil`, rate limits off unless asked for, and a
 * development build unless `production` says otherwise.
 */
export const TestAuth = (options: { readonly rateLimit: boolean; readonly production: boolean }) =>
  Layer.unwrap(
    Effect.gen(function* () {
      return signIn({
        backgroundTasks: O.none(),
        database: yield* D1Binding,
        production: options.production,
        rateLimit: options.rateLimit
      })
    })
  ).pipe(Layer.provide(TestDatabase))

/**
 * The network as a test sees it: every request the app sends (to the collector) is answered by `answer`, in Effect, and
 * nothing reaches a real service.
 */
export const standInHttp = (
  answer: (
    request: HttpClientRequest.HttpClientRequest
  ) => Effect.Effect<HttpClientResponse.HttpClientResponse, HttpClientError.HttpClientError>
): Layer.Layer<HttpClient.HttpClient> => Layer.succeed(HttpClient.HttpClient, HttpClient.make(answer))

/** A request that could not be sent at all, as fetch fails when nothing answers at the address. */
export const unreachable = (request: HttpClientRequest.HttpClientRequest) =>
  Effect.fail(
    new HttpClientError.HttpClientError({
      reason: new HttpClientError.TransportError({ request, description: "nothing answers in tests" })
    })
  )

/** No network: every request the app sends fails as unreachable. What a test that sends nothing out runs on. */
export const noNetwork = standInHttp(unreachable)

/** Sign-in for the in-memory app: nobody is ever signed in, and /api/auth/* is not there. A test double. */
export const SignedOutAuth = BetterAuthTest.signedOut

/**
 * The app's models as `bun run dev` runs them: in memory, in this process (`Models.inMemoryOn`), on the session lookup
 * given beside them. The memory host stamps each command with the clock the test app is built on (the test clock in a
 * test's layer), not the wall clock `Domain.InMemory` reads, so a test moves the day by moving its clock. Each test app
 * builds its own, so the day's count starts at nothing in every one.
 */
export const ModelsInMemory = Models.inMemoryOn(
  Layer.unwrap(
    Effect.clockWith((clock) =>
      Effect.succeed(InMemoryPlatform.make({ now: () => clock.currentTimeMillisUnsafe() }).layer)
    )
  )
)

/** The whole app on a fresh test database, as the Worker composes it, with the header identity naming the actor. */
export const TestApp = makeApp({
  database: TestDatabase,
  identity: HeaderIdentity,
  auth: TestAuth({ ...authStart }),
  production: false,
  docs: false,
  http: noNetwork,
  limit: AddressLimit.open,
  models: ModelsInMemory,
  sessions: HeaderSessions
}).pipe(Layer.provideMerge(DevToolsWhenAsked), Layer.provide(settingsLayer(testSettings)))

/**
 * The audit trail the in-memory app starts with: one line per organization, so a count has something to count. SQL
 * itself is tested on D1.
 */
const seededLines = (at: DateTime.Utc): ReadonlyArray<Activity> =>
  A.map(["org_prairie", "org_northline"] as const, (org, index) =>
    Activity.make({
      id: ActivityId.make(`00000000-0000-4000-8000-00000000000${index}`),
      organizationId: OrganizationId.make(org),
      actorId: MemberId.make(org === "org_prairie" ? "mem_dana" : "mem_elena"),
      actorName: "Seeded",
      action: "Uploaded a file",
      detail: "items.csv: 13 rows staged, nothing imported yet",
      agent: O.none(),
      createdAt: at
    })
  )

/**
 * The access context in memory, acting as `member` whatever a header says: its ports on the in-memory twins and the
 * session answer over them.
 */
const InMemoryAccess = (member: Member) =>
  accessServices({ production: false }).pipe(
    Layer.provideMerge(Layer.unwrap(Effect.map(DateTime.now, (at) => actingAs({ member, lines: seededLines(at) }))))
  )

/**
 * The app's models in memory for the in-memory app, with the allowance's gateway through them and the header session
 * lookup in front, over the in-memory access context's directory.
 */
const InMemoryModels = ModelAllowanceOverUsage.pipe(
  Layer.provideMerge(ModelsInMemory),
  Layer.provideMerge(HeaderSessions)
)

/**
 * The catalog's stores for the in-memory app: its twins, on one state of their own. The model and the allowance are
 * the real adapters, on the test's model service and the in-memory models.
 */
const InMemoryStorage = Layer.mergeAll(
  Layer.mergeAll(ImportStoreMemory, ItemStoreMemory, SuggestionStoreMemory, AssistantLogMemory).pipe(
    Layer.provide(CatalogMemoryRef.layer)
  ),
  AnswererOpenRouter,
  ModelAllowanceViaUsage
)

/**
 * The API's routes and middleware on in-memory storage, acting as `member`, with the given model layer: the fast
 * way to test a rule that lives in the HTTP layer (roles, payload validation, cross-site writes, headers).
 */
export const inMemoryAppLimited = <E, R>({
  ai,
  docs,
  http,
  limit,
  member,
  settings
}: {
  /** The coarse limit's counter (src/server/AddressLimit.ts): a test about the limit supplies its own. */
  readonly limit: Layer.Layer<AddressLimit>
  readonly member: Member
  readonly ai: Layer.Layer<OpenRouter, E, R>
  /** Mount the API reference page, as a development build does. */
  readonly docs: boolean
  /** How the app's requests out (to the collector) are answered. The caller supplies its network policy. */
  readonly http: Layer.Layer<HttpClient.HttpClient>
  /** The settings the app reads, as the Worker's `env` would give them. The caller supplies its starting settings. */
  readonly settings: Record<string, string>
}) => {
  const access = InMemoryAccess(member)
  const models = InMemoryModels.pipe(Layer.provide(access))
  return makeRoutes({ docs, identity: HeaderIdentity, limit }).pipe(
    Layer.provide(http),
    Layer.provide(InMemoryStorage.pipe(Layer.provide(Layer.mergeAll(access, ai, models)))),
    Layer.provide(models),
    Layer.provide(access),
    Layer.provide(SignedOutAuth),
    Layer.provide(ai),
    Layer.provide(HttpServer.layerServices),
    Layer.provideMerge(Observability.layer({ production: false })),
    Layer.provideMerge(DevToolsWhenAsked),
    Layer.provide(settingsLayer(settings))
  )
}

/** `inMemoryAppLimited` with no limit: what every test that is not about the coarse limit runs on. */
export const inMemoryApp = <E, R>(options: {
  readonly member: Member
  readonly ai: Layer.Layer<OpenRouter, E, R>
  readonly docs: boolean
  readonly http: Layer.Layer<HttpClient.HttpClient>
  readonly settings: Record<string, string>
}) => inMemoryAppLimited({ ...options, limit: AddressLimit.open })

/** The handlers and every middleware they declare, on in-memory storage, for `HttpApiTest.groups` (a typed client). */
export const inMemoryHandlers = <E, R>({
  ai,
  member
}: {
  readonly member: Member
  readonly ai: Layer.Layer<OpenRouter, E, R>
}) => {
  const access = InMemoryAccess(member)
  const models = InMemoryModels.pipe(Layer.provide(access))
  return Handlers.pipe(
    Layer.provideMerge(HeaderIdentity),
    Layer.provideMerge(SameOriginLive),
    Layer.provideMerge(HttpApiMiddleware.layerProblemDetails({ includeDetails: true })),
    Layer.provide(InMemoryStorage.pipe(Layer.provide(Layer.mergeAll(access, ai, models)))),
    Layer.provideMerge(models),
    Layer.provideMerge(access),
    Layer.provide(SignedOutAuth),
    Layer.provide(ai),
    Layer.provideMerge(HttpServer.layerServices)
  )
}

const acting = MutableRef.make<MemberId>(MemberId.make("mem_dana"))

/**
 * Runs a request of the typed client (`HttpApiTest.groups`) as a seeded member ("mem_tom"), on `testAppWith`. The
 * identity middleware resolves the member through `Members`, and there `Members` looks up whoever was named last in
 * the real `member` table (`directoryFollowing`), so one database can be used by several people in one test. Tests in a file run in turn.
 */
export const as =
  (memberId: string) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
    Effect.flatMap(
      Effect.sync(() => MutableRef.set(acting, MemberId.make(memberId))),
      () => effect
    )

/** The handlers on a fresh test database, with the real services, the given model and any stand-in around the store. */
const handlersOn = <E, R>(
  ai: Layer.Layer<OpenRouter, E, R>,
  /**
   * A stand-in around the real import store, or a store of its own on the test database (a test that puts another
   * request between two steps): none by default.
   */
  around: O.Option<Layer.Layer<ImportStore, never, StoreNeeds>>
) => {
  // The usage model in memory reads its session the way the header identity does: whoever `as` named last.
  const services = servicesWith({
    ai,
    production: false,
    models: ModelsInMemory,
    sessions: HeaderSessions.pipe(Layer.provide(directoryFollowing(() => MutableRef.get(acting))))
  })
  return Handlers.pipe(
    Layer.provideMerge(HeaderIdentity),
    Layer.provideMerge(SameOriginLive),
    Layer.provideMerge(HttpApiMiddleware.layerProblemDetails({ includeDetails: true })),
    // The header identity looks up whoever `as` named last, in the real `member` table.
    Layer.provide(directoryFollowing(() => MutableRef.get(acting))),
    Layer.provideMerge(
      O.match(around, {
        onNone: () => services,
        onSome: (around) => around.pipe(Layer.provideMerge(services))
      })
    ),
    Layer.provide(SignedOutAuth),
    Layer.provideMerge(TestDatabase),
    Layer.provideMerge(HttpServer.layerServices),
    Layer.provide(settingsLayer(testSettings))
  )
}

/**
 * The handlers on a fresh test database with the real services and the given model (none, unless the test scripts
 * one), for the typed client (`HttpApiTest.groups`). Use `as(memberId)` on each call. Slow: name the file
 * `*.slow.test.ts`.
 */
export const testAppWith = <E, R>(ai: Layer.Layer<OpenRouter, E, R>) => handlersOn(ai, O.none())

/** The typed-client app with no AI key: the state the app must be complete in. */
export const TypedApp = testAppWith(OpenRouterTest.off("noKey", ModelId.make(testSettings.AI_MODEL)))

/**
 * `TypedApp` with a stand-in around the real import store, or a store of its own built on the test database (the real
 * D1 store over a D1 whose batches a test can step into): a test that puts another person's request between the
 * moment a handler or a store has read an import and the moment the store writes. Slow: name the file
 * `*.slow.test.ts`.
 */
export const testAppAround = (around: Layer.Layer<ImportStore, never, StoreNeeds>) =>
  handlersOn(OpenRouterTest.off("noKey", ModelId.make(testSettings.AI_MODEL)), O.some(around))

/** The app as the Worker serves it: security headers included. `dispose` runs when the test block ends. */
export class TestFetch extends Context.Service<
  TestFetch,
  { readonly handle: (request: Request) => Effect.Effect<Response> }
>()("@inventory/app/test/server/support/app/TestFetch") {
  static readonly layer = <E>(app: Layer.Layer<never, E, HttpRouter.HttpRouter>) =>
    Layer.effect(
      TestFetch,
      Effect.map(
        Effect.acquireRelease(
          Effect.sync(() => toServe(app)),
          (running) => running.dispose
        ),
        (running) => TestFetch.of({ handle: running.serve })
      )
    )
}

/** A response's body as text: the platform's promise, taken in. */
export const textOf = (response: Response): Effect.Effect<string> => Effect.promise(() => response.text())

/** A response's body as JSON, or its text when it is not JSON. */
export const jsonOf = (response: Response): Effect.Effect<unknown> =>
  Effect.flatMap(textOf(response), (text) => fromJson(text).pipe(Effect.orElseSucceed(() => text)))

/**
 * What a request hands the platform after its answer, started at once as `waitUntil` starts it, and kept in `pending`
 * to be waited for by `settled`.
 */
export const afterAnswerInto =
  (pending: Array<Fiber.Fiber<void>>) =>
  (work: Effect.Effect<void>): Effect.Effect<void> =>
    Effect.map(Effect.forkDetach(work), (fiber) => {
      pending.push(fiber)
    })

const toJson = S.encodeEffect(S.fromJsonString(S.Unknown))
const fromJson = S.decodeUnknownEffect(S.fromJsonString(S.Unknown))

/** The address the tests send to. Its origin is the app's own. */
export const testOrigin = "http://localhost:5320"

/**
 * Waits for everything a request handed on after its answer. Each piece is already running, so nothing is started
 * here: they are only waited for, all of them at once, and a failed one fails the test.
 */
export const settled = (pending: ReadonlyArray<Fiber.Fiber<void>>): Effect.Effect<void> =>
  Effect.asVoid(Fiber.joinAll(pending))

/**
 * Sends one request to the app the way a browser or curl would, as the member named by `actingAs` (the demo
 * identity header), and reads back the status, the headers and the JSON body.
 */
export const send = Effect.fn("test.send")(function* (options: {
  readonly path: string
  readonly method: string
  readonly actingAs: O.Option<string>
  readonly body: O.Option<unknown>
  readonly headers: Record<string, string>
}) {
  const { handle } = yield* TestFetch
  const body = yield* O.match(options.body, {
    onNone: () => Effect.succeed(O.none<string>()),
    onSome: (value) => toJson(value).pipe(Effect.orDie, Effect.asSome)
  })
  const headers = new Headers(options.headers)
  O.map(options.actingAs, (actor) => headers.set("x-acting-as", actor))
  O.map(body, () => headers.set("content-type", "application/json"))
  const response = yield* handle(
    new Request(`${testOrigin}${options.path}`, {
      method: options.method,
      headers,
      ...O.match(body, { onNone: () => ({}), onSome: (body) => ({ body }) })
    })
  )
  const text = yield* textOf(response)
  const json = text === "" ? undefined : yield* fromJson(text).pipe(Effect.orElseSucceed(() => text))
  return { status: response.status, headers: response.headers, json, text }
})

/** The local test accounts, written into the test database the way `bun run dev` writes them. */
export const SeededAccounts = D1Test.seed(new URL("../../../seeds/accounts.sql", import.meta.url)).pipe(
  Layer.provide(TestDatabase),
  Layer.orDie
)

/** Starting sign-in app settings for a fixture. */
export const signInStart = { settings: {}, production: false, limit: AddressLimit.open }

/**
 * Sign-in end to end: the app exactly as the Worker builds it (the session identity, Better Auth's routes beside the
 * HttpApi), on a fresh test database with the test accounts, rate limits on, the breach check off unless the settings
 * turn it on, and a development build unless `production` says otherwise.
 */
export const signInApp = (options: {
  readonly settings: Record<string, string>
  readonly production: boolean
  /** The coarse limit's counter: none in `signInStart`; a test about the limit supplies its own. */
  readonly limit: Layer.Layer<AddressLimit>
}) =>
  TestFetch.layer(
    // One layer, so the database, Better Auth and the seeding share one test database.
    Layer.merge(
      makeApp({
        database: TestDatabase,
        identity: SessionIdentityLive,
        auth: TestAuth({ ...authStart, rateLimit: true, production: options.production }),
        production: options.production,
        docs: false,
        http: noNetwork,
        limit: options.limit,
        models: ModelsInMemory,
        sessions: SessionLookupLive
      }),
      SeededAccounts
    ).pipe(Layer.provide(settingsLayer({ ...testSettings, PWNED_PASSWORD_CHECK: "false", ...options.settings })))
  )

const decodeAny = S.decodeUnknownEffect(S.fromJsonString(S.Any))
const encodeAny = S.encodeUnknownEffect(S.fromJsonString(S.Any))

/**
 * One browser on the app's own page: keeps the session cookie between requests and sends the headers such a page
 * sends (`Origin`, `Sec-Fetch-Site`), from its own address (`cf-connecting-ip`, which rate limits count by). An empty
 * header in `extra` leaves that header out. Answers stay untyped: tests check them field by field.
 */
export const browser = (address: string) => {
  let cookie = ""
  const send = Effect.fn("browser.send")(function* (
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    body: O.Option<unknown>,
    extra: Record<string, string>
  ) {
    const { handle } = yield* TestFetch
    const headers: Record<string, string> = {
      origin: testOrigin,
      "sec-fetch-site": "same-origin",
      "cf-connecting-ip": address,
      ...(cookie === "" ? {} : { cookie }),
      ...O.match(body, { onNone: () => ({}), onSome: () => ({ "content-type": "application/json" }) }),
      ...extra
    }
    const payload = yield* O.match(body, {
      onNone: () => Effect.succeed(O.none<string>()),
      onSome: (value) => encodeAny(value).pipe(Effect.orDie, Effect.asSome)
    })
    const response = yield* handle(
      new Request(`${testOrigin}${path}`, {
        method,
        headers: R.filter(headers, (value) => value !== ""),
        ...O.match(payload, { onNone: () => ({}), onSome: (body) => ({ body }) })
      })
    )
    const setCookie = A.findFirst(response.headers.getSetCookie(), (line) =>
      Str.includes("inventory.session_token=")(line)
    )
    O.map(setCookie, (value) => {
      cookie = A.headNonEmpty(Str.split(value, ";"))
    })
    const text = yield* textOf(response)
    const json = text === "" ? undefined : yield* decodeAny(text).pipe(Effect.orElseSucceed(() => text))
    return { status: response.status, json, setCookie }
  })
  return {
    send,
    cookie: () => cookie,
    signIn: (email: string) =>
      send("POST", "/api/auth/sign-in/email", O.some({ email, password: testAccountPassword }), {})
  }
}
