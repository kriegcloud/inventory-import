// @effect-diagnostics nodeBuiltinImport:off
// The app as the tests run it. Two storages: `TestDatabase`, a real D1 database in local workerd with the real
// migrations (slow: name the file `*.slow.test.ts`), and the in-memory services in `inMemory`, for rules that live in
// the handlers and middleware (fast). Settings come from a ConfigProvider, the same way the Worker gets them. Sign-in
// is real on the D1 database (`TestAuth`, Better Auth on the same binding); in memory nobody is signed in to it
// (`SignedOutAuth`), and the header identity names the actor.
import { D1Binding } from "@beep/d1/D1"
import { D1Test, D1TestOptions } from "@beep/d1/D1Test"
import {
  Array as Arr,
  Config,
  ConfigProvider,
  Context,
  DateTime,
  Effect,
  Layer,
  MutableRef,
  Option,
  Record as Rec,
  String as Str
} from "effect"
import * as S from "effect/Schema"
import { DevTools } from "effect/devtools"
import { type HttpRouter, HttpServer } from "effect/http"
import { HttpApiMiddleware } from "effect/http-api"
import { actingAs, directoryFollowing, HeaderIdentity } from "@inventory/access-host/AccessTest"
import { accessServices } from "@inventory/access-host/Host"
import { SessionIdentityLive } from "@inventory/access-host/SessionIdentity"
import { signIn } from "@inventory/access-host/SignIn"
import { Activity } from "@inventory/kernel/Activity"
import { ActivityId } from "@inventory/kernel/Ids"
import { MemberId, type OrganizationId } from "@inventory/kernel/Ids"
import { type Member } from "@inventory/kernel/Member"
import { OpenRouter } from "@beep/openrouter/OpenRouter"
import { ModelId } from "@beep/openrouter/OpenRouterModel"
import { OpenRouterTest } from "@beep/openrouter/OpenRouterTest"
import { makeApp, makeRoutes, servicesWith, toFetch } from "../../../src/server/App.ts"
import { BetterAuthTest } from "@beep/better-auth/BetterAuthTest"
import { Handlers } from "../../../src/server/handlers.ts"
import { ImportStore } from "@inventory/catalog-model/ImportStore"
import { ItemStore } from "@inventory/catalog-model/ItemStore"
import { Suggestions } from "@inventory/catalog-model/Suggestions"
import { answerByRules } from "@inventory/catalog-host/TableAssistant"
import { TableAssistant } from "@inventory/catalog-model/TableAssistant"
import * as Observability from "../../../src/server/Observability.ts"
import { SameOriginLive } from "../../../src/server/SameOrigin.ts"
import { testAccountPassword } from "@inventory/access-host/TestAccounts"

const migrations = new URL("../../../migrations/", import.meta.url)

/** Settings as the tests see them: no AI key, the model id wrangler.jsonc sets, a sign-in secret, and quiet logs. */
export const testSettings = {
  AI_MODEL: "anthropic/claude-haiku-5.5",
  LOG_LEVEL: "Warn",
  BETTER_AUTH_SECRET: "a-test-secret-that-is-at-least-32-characters"
} as const

/** A ConfigProvider over plain values: what worker.ts builds from `env`, for a test. */
export const settingsLayer = (values: Record<string, string> = testSettings) =>
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
    return Option.match(url, { onNone: () => Layer.empty, onSome: (address) => DevTools.layer(address) })
  })
).pipe(Layer.orDie)

/**
 * A fresh D1 database (local workerd, nothing persisted) with every migration applied, in filename order. One value,
 * so the SQL client, Better Auth (which takes the raw binding, `D1Binding`) and the seeding share the database one
 * layer build opens.
 */
export const TestDatabase = D1Test.layer(D1TestOptions.make({ migrations })).pipe(Layer.orDie)

/**
 * Better Auth on the test database, as the Worker builds it: no `waitUntil`, rate limits off unless asked for, and a
 * development build unless `production` says otherwise.
 */
export const TestAuth = (options: { readonly rateLimit?: boolean; readonly production?: boolean } = {}) =>
  Layer.unwrap(
    Effect.gen(function* () {
      return signIn({
        database: yield* D1Binding,
        production: options.production ?? false,
        rateLimit: options.rateLimit ?? false
      })
    })
  ).pipe(Layer.provide(TestDatabase))

/** Sign-in for the in-memory app: nobody is ever signed in, and /api/auth/* is not there. A test double. */
export const SignedOutAuth = BetterAuthTest.signedOut

/** The whole app on a fresh test database, as the Worker composes it, with the header identity naming the actor. */
export const TestApp = makeApp({
  database: TestDatabase,
  identity: HeaderIdentity,
  auth: TestAuth(),
  production: false,
  docs: false
}).pipe(Layer.provideMerge(DevToolsWhenAsked), Layer.provide(settingsLayer()))

/**
 * The audit trail the in-memory app starts with: one line per organization, so a count has something to count. SQL
 * itself is tested on D1.
 */
const seededLines = (at: DateTime.Utc): ReadonlyArray<Activity> =>
  Arr.map(["org_prairie", "org_northline"] as const, (org, index) =>
    Activity.make({
      id: ActivityId.make(`00000000-0000-4000-8000-00000000000${index}`),
      organizationId: org as OrganizationId,
      actorId: MemberId.make(org === "org_prairie" ? "mem_dana" : "mem_elena"),
      actorName: "Seeded",
      action: "Uploaded a file",
      detail: "items.csv: 13 rows staged, nothing imported yet",
      agent: Option.none(),
      createdAt: at
    })
  )

/**
 * The access context in memory, acting as `member` whatever a header says: its ports on the in-memory twins, the
 * session answer and the model allowance over them.
 */
const InMemoryAccess = (member: Member) =>
  accessServices({ production: false }).pipe(
    Layer.provideMerge(Layer.unwrap(Effect.map(DateTime.now, (at) => actingAs({ member, lines: seededLines(at) }))))
  )

/**
 * A service the in-memory app does not have: its storage is SQL, tested on D1 (`*.slow.test.ts`). Any call dies with
 * a sentence naming the method, so a fast test that reaches one says what it reached.
 */
const notInMemory = <I, S extends object>(tag: Context.Key<I, S>, name: string) =>
  Layer.succeed(
    tag,
    new Proxy({} as S, {
      get: (_, method) => () => Effect.die(`${name}.${String(method)} is not in memory: test it on D1`)
    })
  )

/**
 * The services that keep their rows in SQL, for the in-memory app: absent, except the table assistant, which with no
 * key reads by its rules and touches no table, exactly as the real one does then.
 */
const InMemoryStorage = Layer.mergeAll(
  notInMemory(ImportStore, "ImportStore"),
  notInMemory(ItemStore, "ItemStore"),
  notInMemory(Suggestions, "Suggestions"),
  Layer.succeed(
    TableAssistant,
    TableAssistant.of({
      view: Effect.fn("TableAssistant.view")(function* (_actor: Member, request) {
        return answerByRules({ request, why: "No AI key is set, so the rules answered." })
      })
    })
  )
)

/**
 * The API's routes and middleware on in-memory storage, acting as `member`, with the given model layer: the fast
 * way to test a rule that lives in the HTTP layer (roles, payload validation, cross-site writes, headers).
 */
export const inMemoryApp = <E, R>({
  ai,
  docs = false,
  member,
  settings = testSettings
}: {
  readonly member: Member
  readonly ai: Layer.Layer<OpenRouter, E, R>
  /** Mount the API reference page, as a development build does. */
  readonly docs?: boolean
  /** The settings the app reads, as the Worker's `env` would give them. Default: `testSettings`. */
  readonly settings?: Record<string, string>
}) =>
  makeRoutes({ docs, identity: HeaderIdentity }).pipe(
    Layer.provide(InMemoryStorage),
    Layer.provide(InMemoryAccess(member)),
    Layer.provide(SignedOutAuth),
    Layer.provide(ai),
    Layer.provide(HttpServer.layerServices),
    Layer.provideMerge(Observability.layer({ production: false })),
    Layer.provideMerge(DevToolsWhenAsked),
    Layer.provide(settingsLayer(settings))
  )

/** The handlers and every middleware they declare, on in-memory storage, for `HttpApiTest.groups` (a typed client). */
export const inMemoryHandlers = <E, R>({
  ai,
  member
}: {
  readonly member: Member
  readonly ai: Layer.Layer<OpenRouter, E, R>
}) =>
  Handlers.pipe(
    Layer.provideMerge(HeaderIdentity),
    Layer.provideMerge(SameOriginLive),
    Layer.provideMerge(HttpApiMiddleware.layerProblemDetails({ includeDetails: true })),
    Layer.provide(InMemoryStorage),
    Layer.provideMerge(InMemoryAccess(member)),
    Layer.provide(SignedOutAuth),
    Layer.provide(ai),
    Layer.provideMerge(HttpServer.layerServices)
  )

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

/**
 * The handlers on a fresh test database with the real services and the given model (none, unless the test scripts
 * one), for the typed client (`HttpApiTest.groups`). Use `as(memberId)` on each call. Slow: name the file
 * `*.slow.test.ts`.
 */
export const testAppWith = <E, R>(ai: Layer.Layer<OpenRouter, E, R>) =>
  Handlers.pipe(
    Layer.provideMerge(HeaderIdentity),
    Layer.provideMerge(SameOriginLive),
    Layer.provideMerge(HttpApiMiddleware.layerProblemDetails({ includeDetails: true })),
    // The header identity looks up whoever `as` named last, in the real `member` table.
    Layer.provide(directoryFollowing(() => MutableRef.get(acting))),
    Layer.provideMerge(servicesWith({ ai, production: false })),
    Layer.provide(SignedOutAuth),
    Layer.provideMerge(TestDatabase),
    Layer.provideMerge(HttpServer.layerServices),
    Layer.provide(settingsLayer())
  )

/** The typed-client app with no AI key: the state the app must be complete in. */
export const TypedApp = testAppWith(OpenRouterTest.off("noKey", ModelId.make(testSettings.AI_MODEL)))

/** The app's `fetch`, as the Worker exports it: security headers included. `dispose` runs when the test block ends. */
export class TestFetch extends Context.Service<
  TestFetch,
  { readonly handle: (request: Request) => Promise<Response> }
>()("@inventory/app/test/server/support/app/TestFetch") {
  static readonly layer = <E>(app: Layer.Layer<never, E, HttpRouter.HttpRouter>) =>
    Layer.effect(
      TestFetch,
      Effect.map(
        Effect.acquireRelease(
          Effect.sync(() => toFetch(app)),
          (running) => Effect.promise(() => running.dispose())
        ),
        (running) => TestFetch.of({ handle: running.fetch })
      )
    )
}

const toJson = S.encodeEffect(S.fromJsonString(S.Unknown))
const fromJson = S.decodeUnknownEffect(S.fromJsonString(S.Unknown))

/** The address the tests send to. Its origin is the app's own. */
export const testOrigin = "http://localhost:5320"

/**
 * Sends one request to the app the way a browser or curl would, as the member named by `actingAs` (the demo
 * identity header), and reads back the status, the headers and the JSON body.
 */
export const send = Effect.fn("test.send")(function* (options: {
  readonly path: string
  readonly method?: string
  readonly actingAs?: string
  readonly body?: unknown
  readonly headers?: Record<string, string>
}) {
  const { handle } = yield* TestFetch
  const body = options.body === undefined ? undefined : yield* toJson(options.body).pipe(Effect.orDie)
  const headers = new Headers(options.headers)
  if (options.actingAs !== undefined) headers.set("x-acting-as", options.actingAs)
  if (body !== undefined) headers.set("content-type", "application/json")
  const response = yield* Effect.promise(() =>
    handle(
      new Request(`${testOrigin}${options.path}`, {
        method: options.method ?? (body === undefined ? "GET" : "POST"),
        headers,
        ...(body === undefined ? {} : { body })
      })
    )
  )
  const text = yield* Effect.promise(() => response.text())
  const json = text === "" ? undefined : yield* fromJson(text).pipe(Effect.orElseSucceed(() => text))
  return { status: response.status, headers: response.headers, json, text }
})

/** The local test accounts, written into the test database the way `bun run dev` writes them. */
export const SeededAccounts = D1Test.seed(new URL("../../../scripts/dev-accounts.sql", import.meta.url)).pipe(
  Layer.provide(TestDatabase),
  Layer.orDie
)

/**
 * Sign-in end to end: the app exactly as the Worker builds it (the session identity, Better Auth's routes beside the
 * HttpApi), on a fresh test database with the test accounts, rate limits on, the breach check off unless the settings
 * turn it on, and a development build unless `production` says otherwise.
 */
export const signInApp = (
  options: { readonly settings?: Record<string, string>; readonly production?: boolean } = {}
) =>
  TestFetch.layer(
    // One layer, so the database, Better Auth and the seeding share one test database.
    Layer.merge(
      makeApp({
        database: TestDatabase,
        identity: SessionIdentityLive,
        auth: TestAuth({ rateLimit: true, production: options.production ?? false }),
        production: options.production ?? false,
        docs: false
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
    body?: unknown,
    extra?: Record<string, string>
  ) {
    const { handle } = yield* TestFetch
    const headers: Record<string, string> = {
      origin: testOrigin,
      "sec-fetch-site": "same-origin",
      "cf-connecting-ip": address,
      ...(cookie === "" ? {} : { cookie }),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...extra
    }
    const payload = body === undefined ? undefined : yield* encodeAny(body).pipe(Effect.orDie)
    const response = yield* Effect.promise(() =>
      handle(
        new Request(`${testOrigin}${path}`, {
          method,
          headers: Rec.filter(headers, (value) => value !== ""),
          ...(payload === undefined ? {} : { body: payload })
        })
      )
    )
    const setCookie = Option.getOrUndefined(
      Arr.findFirst(response.headers.getSetCookie(), (line) => Str.includes("inventory.session_token=")(line))
    )
    if (setCookie !== undefined) cookie = Str.split(setCookie, ";")[0] ?? ""
    const text = yield* Effect.promise(() => response.text())
    const json = text === "" ? undefined : yield* decodeAny(text).pipe(Effect.orElseSucceed(() => text))
    return { status: response.status, json, setCookie }
  })
  return {
    send,
    cookie: () => cookie,
    signIn: (email: string) => send("POST", "/api/auth/sign-in/email", { email, password: testAccountPassword })
  }
}
