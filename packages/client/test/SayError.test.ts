// What the person reads when something fails. The rule that would hurt if wrong: no status code, URL, stack or
// provider text ever reaches the screen, and a request refused for several fields names every one of them at once.
import * as HttpClientError from "effect/http/HttpClientError"
import * as HttpClientRequest from "effect/http/HttpClientRequest"
import * as HttpClientResponse from "effect/http/HttpClientResponse"
import * as HttpApiError from "effect/http-api/HttpApiError"
import * as A from "effect/Array"
import * as S from "effect/Schema"
import { describe, expect, it, vi } from "vitest"
import { installTroubleSentences, sayError } from "@inventory/client/SayError"

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
      const said = sayError(error)
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
          { path: ["payload", "unitCost"], message: "Expected a finite number, got NaN" }
        ]
      }),
      { fields: { action: "Action", detail: "Detail" } }
    )
    expect(said.problems).toEqual([
      "Action was not accepted. Check it and try again.",
      "Detail was not accepted. Check it and try again.",
      "Unit cost was not accepted. Check it and try again."
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
      expect(sayError(AiUnavailable.make({ kind, reason: "provider said 503 {}" })).sentence).toBe(modelSentences[kind])
    }
  })
})
