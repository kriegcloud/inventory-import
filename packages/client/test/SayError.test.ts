// What the person reads when something fails. The rule that would hurt if wrong: no status code, URL, stack or
// provider text ever reaches the screen, and a request refused for several fields names every one of them at once.
import * as HttpClientError from "effect/http/HttpClientError"
import * as HttpClientRequest from "effect/http/HttpClientRequest"
import * as HttpClientResponse from "effect/http/HttpClientResponse"
import * as HttpApiError from "effect/http-api/HttpApiError"
import * as A from "effect/Array"
import * as S from "effect/Schema"
import { describe, expect, it, vi } from "vitest"
import { installTroubleSentences, isTransient, sayError } from "@inventory/client/SayError"
import { CounterIds, CountingApi, CountingHost, judging } from "./Counting.fixture"
import { it as effectIt } from "@effect/vitest"
import * as Cause from "effect/Cause"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as O from "effect/Option"
import * as RpcClientError from "effect/rpc/RpcClientError"
import * as Socket from "effect/socket/Socket"
import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer"
import * as HttpServer from "effect/http/HttpServer"
import * as HttpServerResponse from "effect/http/HttpServerResponse"
import { modelHttpClient } from "@inventory/client/Http"

// The catalog's model failure, as this package meets it: an error of another package, read by its tag alone. A stand-in
// with its own constructor, since this package holds no contract.
class AiUnavailable extends S.TaggedError<AiUnavailable, { readonly brand: unique symbol }>()("AiUnavailable", {
  kind: S.String,
  reason: S.String
}) {}

const request = HttpClientRequest.get("http://localhost:5173/api/v1/activity")
const answered = (status: number) =>
  new HttpClientError.HttpClientError({
    reason: new HttpClientError.DecodeError({
      request,
      response: HttpClientResponse.fromWeb(request, new Response('upstream says {"code":42}', { status }))
    })
  })

const failures: ReadonlyArray<readonly [string, unknown]> = [
  [
    "the network",
    new HttpClientError.HttpClientError({
      reason: new HttpClientError.TransportError({ request, cause: new TypeError("Failed to fetch") })
    })
  ],
  ["a server error", answered(500)],
  ["a proxy's bad gateway", answered(502)],
  ["too many requests", answered(429)],
  ["an answer that did not decode", answered(418)],
  ["a refused request", HttpApiError.BadRequestProblem.make({ detail: "Request validation failed" })],
  ["a server problem document", HttpApiError.InternalServerErrorProblem.make({})],
  ["a busy model", AiUnavailable.make({ kind: "busy", reason: "OpenRouter 429: rate limit for anthropic/x" })],
  ["a crash", new Error("TypeError: Cannot read properties of undefined (reading 'rows') at ReviewGrid.tsx:12")],
  ["nothing at all", undefined]
]

describe("saying a failure", () => {
  it("never shows a status code, a URL, a stack or provider text", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    for (const [what, error] of failures) {
      const said = sayError(error, { fields: {} })
      const words = A.join([said.title, said.sentence, ...said.problems], " ")
      expect(words, what).not.toMatch(/\b(4\d\d|5\d\d)\b|https?:|\/api|Error|\{|\bat \w+\.tsx?/)
      expect(said.sentence.length, what).toBeGreaterThan(10)
    }
  })

  it("names every refused field at once, in the screen's words", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    const said = sayError(
      HttpApiError.BadRequestProblem.make({
        detail: "Request validation failed",
        errors: [
          { path: ["payload", "action"], message: "Expected a value with a length of at most 200, got 201" },
          { path: ["payload", "detail"], message: "Expected a string, got null" },
          { path: ["payload", "unitCost"], message: "Expected a finite number, got NaN" },
          { path: [0], message: "Not accepted" }
        ]
      }),
      { fields: { action: "Action", detail: "Detail", "": "Line" } }
    )
    expect(said.problems).toEqual([
      "Action was not accepted. Check it and try again.",
      "Detail was not accepted. Check it and try again.",
      "Unit cost was not accepted. Check it and try again.",
      "Line was not accepted. Check it and try again."
    ])
  })

  it("says the model's trouble in one of five sentences, never the provider's", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    // The app installs the contract's `modelSentences`; any five sentences show the rule.
    const modelSentences = {
      noKey: "No key is set.",
      refused: "Refused.",
      busy: "Busy.",
      badAnswer: "Not usable.",
      down: "Down."
    } as const
    installTroubleSentences(modelSentences)
    for (const kind of ["noKey", "refused", "busy", "badAnswer", "down"] as const) {
      expect(sayError(AiUnavailable.make({ kind, reason: "provider said 503 {}" }), { fields: {} }).sentence).toBe(
        modelSentences[kind]
      )
    }
  })
})

// The catalog's busy draft, read by its tag alone, as the model's failure is.
class DraftBusy extends S.TaggedError<DraftBusy, { readonly brand: unique symbol }>()("DraftBusy", {
  reason: S.String
}) {}

describe("a request whose every try was overtaken", () => {
  // The server's three sentences: the import kept changing, the items did and the import did not, or both.
  const reasons = [
    "This import kept being changed (in another tab or by someone else) while your request was worked out, so nothing was written. Try again in a moment.",
    "Items this would change kept being changed elsewhere (by another import, on the Items page or by a take-back), or suggestions kept arriving for this import, while your request was worked out, so nothing was written. The import itself did not change. Try again in a moment.",
    "This import, or items it would change, kept being changed (in another tab, by someone else, by another import or on the Items page) while your request was worked out, so nothing was written. Try again in a moment."
  ]
  it("is said under a title true of each, with the server's reason: what kept changing, and to try again", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    for (const reason of reasons) {
      const said = sayError(DraftBusy.make({ reason }), { fields: {} })
      expect(said).toEqual({ title: "Nothing was written", sentence: reason, problems: [] })
      // The title names neither the import nor the items: one of the sentences says the import did not change.
      expect(said.title).not.toMatch(/import|item/i)
    }
  })
})

// A file's own problems, each as its package builds it (stand-ins with their own constructors: this package holds no
// contract). Each is said by its whole shape: a value that has the tag without the fields it is said from is not.
class FileProblem extends S.TaggedClass<FileProblem, { readonly brand: unique symbol }>()("FileProblem", {
  problem: S.String,
  todo: S.String
}) {}
class HalfFileProblem extends S.TaggedClass<HalfFileProblem, { readonly brand: unique symbol }>()("FileProblem", {
  problem: S.String
}) {}
class ReadFailed extends S.TaggedError<ReadFailed, { readonly brand: unique symbol }>()("ReadFailed", {
  message: S.String
}) {}
class FileNotKept extends S.TaggedError<FileNotKept, { readonly brand: unique symbol }>()("FileNotKept", {}) {}

describe("a file that was not read or kept", () => {
  it("says the file's problem and what to do, the reader's sentence, and that progress is not kept", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    expect(
      sayError(FileProblem.make({ problem: "items.csv is empty.", todo: "Choose another file." }), { fields: {} })
    ).toEqual({
      title: "The file was not read",
      sentence: "items.csv is empty. Choose another file.",
      problems: []
    })
    expect(
      sayError(ReadFailed.make({ message: "The file could not be opened. Try again." }), { fields: {} }).sentence
    ).toBe("The file could not be opened. Try again.")
    expect(sayError(FileNotKept.make({}), { fields: {} }).title).toBe("This browser would not keep your progress")
    expect(sayError(HalfFileProblem.make({ problem: "items.csv is empty." }), { fields: {} }).title).toBe(
      "Something went wrong"
    )
  })

  it("asks again after the server's own problem document, never after a refused request", () => {
    expect(isTransient(HttpApiError.InternalServerErrorProblem.make({}))).toBe(true)
    expect(isTransient(HttpApiError.BadRequestProblem.make({ detail: "Request validation failed" }))).toBe(false)
  })
})

it("keeps nonblank reasons on arrays and callable failures without trimming their sentence", () => {
  const reason = "  Your change was refused.  "
  const array = Object.assign([], { reason })
  const callable = Object.assign(() => undefined, { reason })
  expect(sayError(array, { fields: {} }).sentence).toBe(reason)
  expect(sayError(callable, { fields: {} }).sentence).toBe(reason)
  expect(sayError({ reason: " \t\n" }, { fields: {} }).title).toBe("Something went wrong")
})

// A model's call (`@alchemy.run/domain`'s Api client, over Effect RPC) fails before its handler answers with the RPC
// client's error, whose reason says what failed. It is said, and asked again, as the same failure of an HTTP request
// is, in today's words: no new sentence.
const rpcOver = (reason: HttpClientError.HttpClientError) =>
  RpcClientError.RpcClientError.make({ reason: HttpClientError.HttpClientErrorSchema.fromHttpClientError(reason) })
const rpcUnreached = rpcOver(
  new HttpClientError.HttpClientError({
    reason: new HttpClientError.TransportError({ request, cause: new TypeError("Failed to fetch") })
  })
)
const rpcSocket = RpcClientError.RpcClientError.make({
  reason: Socket.SocketReadError.make({ cause: new Error("ECONNRESET") })
})
const rpcDefect = (message: string) =>
  RpcClientError.RpcClientError.make({ reason: RpcClientError.RpcClientDefect.make({ message, cause: undefined }) })
// The library's own words for a live read that could not reconnect (Api.ts, `protocolWebSocket`).
const lostLiveRead = rpcDefect("Live read CounterTotal.watch lost its connection")
const undecodable = rpcDefect("Error decoding HTTP response")
const noExpiry = O.none<never>()

/**
 * What a model's call fails with when its server answers every request with `status` (a deploy's 503 from the edge,
 * a proxy's 502, a rate limit's 429), sent as the app sends it: over the kit's HTTP client for a model.
 */
const servedAnswer = Effect.fn("servedAnswer")(function* (status: number) {
  const server = yield* Layer.build(NodeHttpServer.layerTest)
  const answer = HttpServerResponse.text("error code: 1101", { status })
  yield* HttpServer.serveEffect()(answer.pipe(Effect.succeed)).pipe(Effect.provideContext(server))
  const url = yield* HttpServer.addressFormattedWith(Effect.succeed).pipe(Effect.provideContext(server))
  const client = yield* Layer.build(
    CountingApi.layerClientWebSocket(url).pipe(
      Layer.provide(Layer.merge(modelHttpClient, Socket.layerWebSocketConstructorGlobal))
    )
  )
  const api = yield* Effect.service(CountingApi.Client).pipe(Effect.provideContext(client))
  return yield* api.Bump({ counterId: CounterIds.press, by: 1 }).pipe(Effect.flip)
})

describe("a model's call that failed before its handler answered", () => {
  it("is asked again for its request's network, server error or too many requests, and for a socket's failure", () => {
    expect(isTransient(rpcUnreached)).toBe(true)
    expect(isTransient(rpcOver(answered(503)))).toBe(true)
    expect(isTransient(rpcOver(answered(429)))).toBe(true)
    expect(isTransient(rpcSocket)).toBe(true)
  })

  it("is not asked again for a refused request, a protocol defect or a live read that lost its connection", () => {
    expect(isTransient(rpcOver(answered(400)))).toBe(false)
    expect(isTransient(undecodable)).toBe(false)
    expect(isTransient(lostLiveRead)).toBe(false)
  })

  it("says today's sentences: not reached, our side, could not be read", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    const unreached = sayError(
      new HttpClientError.HttpClientError({
        reason: new HttpClientError.TransportError({ request, cause: new TypeError("Failed to fetch") })
      }),
      { fields: {} }
    )
    const ourSide = sayError(answered(500), { fields: {} })
    const unreadable = sayError(answered(418), { fields: {} })
    const said = (error: unknown) => sayError(error, { fields: {} })
    expect(said(rpcUnreached)).toEqual(unreached)
    expect(said(rpcSocket)).toEqual(unreached)
    expect(said(lostLiveRead)).toEqual(unreached)
    expect(said(rpcOver(answered(502)))).toEqual(ourSide)
    expect(said(undecodable)).toEqual(unreadable)
  })

  // The library sends a call's request with no check of its status, so without the kit's HTTP client a 503 reaches
  // the person as "Received empty HTTP response from RPC server": not asked again, and said as an unreadable answer.
  effectIt.live("over the kit's HTTP client, is asked again and said as today's for a 503, a 502 or a 429 served", () =>
    Effect.scoped(
      Effect.gen(function* () {
        vi.spyOn(console, "error").mockImplementation(() => undefined)
        const ourSide = sayError(answered(500), { fields: {} })
        const tooMany = sayError(answered(429), { fields: {} })
        const seen: Array<readonly [number, boolean, unknown]> = []
        for (const status of [503, 502, 429]) {
          const failure = yield* servedAnswer(status)
          seen.push([status, isTransient(failure), sayError(failure, { fields: {} })])
        }
        expect(seen).toEqual([
          [503, true, ourSide],
          [502, true, ourSide],
          [429, true, tooMany]
        ])
      })
    )
  )

  effectIt.live("says a failure its Api does not declare as the server's own, from what the client receives", () =>
    Effect.scoped(
      Effect.gen(function* () {
        vi.spyOn(console, "error").mockImplementation(() => undefined)
        const host = yield* Layer.build(Layer.merge(CountingHost, noExpiry.pipe(judging).layer))
        const api = yield* CountingApi.clientInProcess.pipe(Effect.provideContext(host))
        const cause = yield* api.Break({ counterId: CounterIds.press }).pipe(Effect.sandbox, Effect.flip)
        const failure = cause.pipe(Cause.squash)
        expect(sayError(failure, { fields: {} })).toEqual(sayError(answered(500), { fields: {} }))
        expect(isTransient(failure)).toBe(false)
      })
    )
  )
})
