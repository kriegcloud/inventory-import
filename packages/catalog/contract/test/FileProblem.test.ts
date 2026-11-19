// A problem in the person's file is data, not a request error. The rule that would hurt if wrong: a server step that
// stages a file answers 200 with a `StagingOutcome` holding either what it made or the `FileProblem`, so the screen
// can say what is wrong and what to do; a 4xx would reach the screen as "This was not accepted". Sent through a real
// HttpApi in memory, so the status and the body are what a browser gets.
import { describe, expect, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Result from "effect/Result"
import * as S from "effect/Schema"
import * as HttpRouter from "effect/http/HttpRouter"
import * as HttpServer from "effect/http/HttpServer"
import * as HttpApi from "effect/http-api/HttpApi"
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder"
import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint"
import * as HttpApiGroup from "effect/http-api/HttpApiGroup"
import { FileProblem, fileProblem, fileProblemTitles, StagingOutcome } from "@inventory/catalog-contract/FileProblem"
const Staged = S.Struct({ rows: S.Int })

class StagingApi extends HttpApi.make("staging").add(
  HttpApiGroup.make("files").add(
    HttpApiEndpoint.post("stage", "/stage", {
      payload: S.Struct({ fileName: S.String.check(S.isMaxLength(200)), rows: S.Int }),
      success: StagingOutcome(Staged)
    })
  )
) {}

// A staging step as a handler writes one: the file's problem is `Result.fail`, never an error of the endpoint.
const FilesLive = HttpApiBuilder.group(StagingApi, "files", (handlers) =>
  handlers.handle("stage", ({ payload }) =>
    Effect.succeed(
      payload.rows === 0
        ? Result.fail(fileProblem.noRows({ fileName: payload.fileName }))
        : Result.succeed({ rows: payload.rows })
    )
  )
)

const send = (body: unknown) =>
  Effect.acquireUseRelease(
    Effect.sync(() =>
      StagingApi.pipe(
        HttpApiBuilder.layer,
        Layer.provide(FilesLive),
        Layer.provide(HttpServer.layerServices),
        HttpRouter.toWebHandler
      )
    ),
    ({ handler }) =>
      Effect.gen(function* () {
        const text = yield* S.encodeEffect(S.fromJsonString(S.Unknown))(body)
        const response = yield* Effect.promise(() =>
          handler(
            new Request("http://localhost/stage", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: text
            })
          )
        )
        const json = yield* Effect.promise((): Promise<unknown> => response.json())
        return { status: response.status, json }
      }),
    ({ dispose }) => Effect.promise(() => dispose())
  )

describe("a file that cannot be staged", () => {
  it.effect("is answered with 200 and its problem as data, and a file that can with what was made", () =>
    Effect.gen(function* () {
      const empty = yield* send({ fileName: "items.csv", rows: 0 })
      expect(empty).toEqual({
        status: 200,
        json: {
          _tag: "Failure",
          failure: {
            _tag: "FileProblem",
            kind: "empty",
            fileName: "items.csv",
            problem: '"items.csv" has column names but no rows under them.',
            todo: "Choose the file that holds the rows to import."
          }
        }
      })
      const made = yield* send({ fileName: "items.csv", rows: 12 })
      expect(made).toEqual({
        status: 200,
        json: { _tag: "Success", success: { rows: 12 } }
      })
    })
  )

  it.effect("reads back as the same problem, with a heading for each kind", () =>
    Effect.gen(function* () {
      const outcome = StagingOutcome(Staged)
      const problem = fileProblem.tooManyRows({ fileName: "stock.xlsx", rows: 60_000, limit: 50_000 })
      const encoded = yield* S.encodeEffect(S.toCodecJson(outcome))(Result.fail(problem))
      const decoded = yield* S.decodeEffect(S.toCodecJson(outcome))(encoded)
      expect(Result.isFailure(decoded) && S.is(FileProblem)(decoded.failure)).toBe(true)
      expect(decoded).toEqual(Result.fail(problem))
      expect(fileProblemTitles[problem.kind]).toBe("This file is too large")
    })
  )
})
