// The table assistant through the real handlers and SQL: the rules with no key, and a scripted model standing where a
// real one would be. The claims under test are the screen's: who answered is said, an answer naming anything the table
// does not have is refused whole, and a model's answer leaves one audit line that only its own organization sees.
import { expect, layer } from "@effect/vitest"
import { Array as Arr, Effect, Layer, Option, Result } from "effect"
import * as S from "effect/Schema"
import { HttpApiTest } from "effect/http-api"
import { TestClock } from "effect/testing"
import { Api } from "../../src/api/v1/Api.ts"
import { type AnsweredBy } from "@inventory/catalog-contract/Answer"
import { ModelId } from "@beep/openrouter/OpenRouterModel"
import { OpenRouterTest } from "@beep/openrouter/OpenRouterTest"
import { dailyModelCalls } from "@inventory/access-contract/ModelAllowance"
import { usedUp } from "../../src/server/TableAssistant.ts"
import { items } from "./support/columns.ts"
import { as, TypedApp as TestApp, testAppWith } from "./support/app.ts"

const request = (prompt: string) => ({ payload: { prompt, table: "Items", columns: items, searchable: false } })
/** Who read a request, in a word: the rules or a model. */
const who = (answer: { readonly answeredBy: AnsweredBy }): "rules" | "model" =>
  answer.answeredBy._tag === "Rules" ? "rules" : "model"
/** The model that read it, when one did. */
const modelOf = (answer: { readonly answeredBy: AnsweredBy }): string | null =>
  answer.answeredBy._tag === "Model" ? answer.answeredBy.model : null

layer(TestApp)("the table assistant with no AI key", (it) => {
  it.effect("the rules answer the plain cases, say that they did, and write nothing", () =>
    Effect.gen(function* () {
      const client = yield* HttpApiTest.groups(Api, ["assistant", "activity"])
      const read = yield* client.assistant.view(request("Sort by name descending and only Box")).pipe(as("mem_priya"))
      expect(Result.isSuccess(read)).toBe(true)
      if (Result.isSuccess(read)) {
        // Who answered is the contract's one value: the rules, with the reason no model did.
        expect(read.success.answeredBy).toEqual({ _tag: "Rules", reason: "No AI key is set, so the rules answered." })
        expect(read.success.note).toEqual(Option.none())
        expect(read.success.changes).toEqual([
          { kind: "sort", column: "name", direction: "desc" },
          { kind: "filter", column: "unit", operator: "inArray", values: ["Box"] }
        ])
      }
      const refused = yield* client.assistant.view(request("show items we count with no vendor")).pipe(as("mem_priya"))
      expect(Result.isFailure(refused)).toBe(true)
      if (Result.isFailure(refused)) {
        expect(refused.failure.reason).toContain("The rules could not read “show items we count with no vendor”.")
      }
      const trail = yield* client.activity.recent().pipe(as("mem_marcus"))
      expect(Arr.filter(trail, (row) => row.action === "Asked for a view")).toEqual([])
    })
  )

  it.effect("a request with no words is a 400 that says what to give", () =>
    Effect.gen(function* () {
      const client = yield* HttpApiTest.groups(Api, ["assistant"])
      const failed = yield* client.assistant.view(request("   ")).pipe(as("mem_priya"), Effect.flip)
      expect(String(failed)).not.toBe("")
    })
  )
})

const toJson = S.encodeEffect(S.fromJsonString(S.Unknown))

const answering = (reply: unknown) =>
  Layer.unwrap(
    Effect.gen(function* () {
      const text = yield* toJson(reply)
      return OpenRouterTest.scripted([{ text }], { model: ModelId.make("scripted/model") }).layer
    })
  )

layer(
  testAppWith(
    answering({
      changes: [{ kind: "filter", column: "counted", operator: "eq", values: ["true"] }],
      cannot: "This table has no vendor column, so items with no vendor could not be picked out."
    })
  )
)("the table assistant with a model", (it) => {
  it.effect(
    "the model's answer is checked, names the model and what it could not do, and is audited per organization",
    () =>
      Effect.gen(function* () {
        const client = yield* HttpApiTest.groups(Api, ["assistant", "activity"])
        const read = yield* client.assistant.view(request("show items we count with no vendor")).pipe(as("mem_priya"))
        expect(Result.isSuccess(read)).toBe(true)
        if (Result.isSuccess(read)) {
          expect(read.success.answeredBy).toMatchObject({ _tag: "Model", model: "scripted/model" })
          expect(read.success.note).toEqual(
            Option.some("This table has no vendor column, so items with no vendor could not be picked out.")
          )
          expect(read.success.changes).toEqual([
            { kind: "filter", column: "counted", operator: "eq", values: ["true"] }
          ])
        }
        const trail = yield* client.activity.recent().pipe(as("mem_marcus"))
        const lines = Arr.filter(trail, (row) => row.action === "Asked for a view")
        expect(Arr.map(lines, (row) => [row.detail, row.agent])).toEqual([
          ["Items: 1 change to the view, answered by scripted/model", Option.some("Table assistant")]
        ])
        // The person's words are not in the trail.
        expect(lines[0]?.detail).not.toContain("vendor")
        // Another organization's trail never shows it.
        const elsewhere = yield* client.activity.recent().pipe(as("mem_tom"))
        expect(Arr.filter(elsewhere, (row) => row.action === "Asked for a view")).toEqual([])
      })
  )
})

layer(
  testAppWith(
    answering({ changes: [{ kind: "filter", column: "vendor", operator: "isEmpty", values: [] }], cannot: "" })
  )
)("the table assistant with a model that names a column the table does not have", (it) => {
  it.effect("the answer is refused whole, with a sentence and the model's name", () =>
    Effect.gen(function* () {
      const client = yield* HttpApiTest.groups(Api, ["assistant"])
      const read = yield* client.assistant.view(request("items with no vendor")).pipe(as("mem_priya"))
      expect(Result.isFailure(read)).toBe(true)
      if (Result.isFailure(read)) {
        expect(read.failure).toMatchObject({
          reason: "The answer named a column this table does not have (“vendor”), so nothing was changed.",
          answeredBy: { _tag: "Model", model: "scripted/model" },
          note: Option.none()
        })
      }
    })
  )
})

// The Items table has a search box: the request says so, and a search change is then allowed, from the rules or a
// model. A table that says it has none still refuses one.
const searchable = (prompt: string) => ({ payload: { ...request(prompt).payload, searchable: true } })

layer(TestApp)("the table assistant filling a table's search box, with no AI key", (it) => {
  it.effect("the rules put the words after find into the search box, and only where there is one", () =>
    Effect.gen(function* () {
      const client = yield* HttpApiTest.groups(Api, ["assistant"])
      const read = yield* client.assistant.view(searchable("find the steel brackets")).pipe(as("mem_priya"))
      expect(Result.isSuccess(read) ? [who(read.success), read.success.changes] : read).toEqual([
        "rules",
        [{ kind: "search", text: "steel brackets" }]
      ])
      const none = yield* client.assistant.view(request("find the steel brackets")).pipe(as("mem_priya"))
      expect(Result.isFailure(none) ? none.failure.reason : none).toContain("This table has no search box")
    })
  )
})

layer(testAppWith(answering({ changes: [{ kind: "search", text: "  steel bracket  " }], cannot: "" })))(
  "the table assistant with a model that fills the search box",
  (it) => {
    it.effect("the model's search is checked, trimmed and named as the model's", () =>
      Effect.gen(function* () {
        const client = yield* HttpApiTest.groups(Api, ["assistant"])
        const read = yield* client.assistant.view(searchable("show me the steel brackets")).pipe(as("mem_priya"))
        expect(
          Result.isSuccess(read) ? [who(read.success), modelOf(read.success), read.success.changes] : read
        ).toEqual(["model", "scripted/model", [{ kind: "search", text: "steel bracket" }]])
        const none = yield* client.assistant.view(request("show me the steel brackets")).pipe(as("mem_priya"))
        expect(Result.isFailure(none) ? [who(none.failure), none.failure.reason] : none).toEqual([
          "model",
          "This table has no search box; ask for a filter on a column instead, so nothing was changed."
        ])
      })
    )
  }
)

// The assistant draws on the organization's one daily allowance of model calls (`dailyModelCalls`), the same one the
// check that the key works takes from. Once it is used up the rules answer and say so, and the check is refused, until a day has passed. The clock is the test clock: a day passes without waiting for one.
layer(testAppWith(answering({ changes: [{ kind: "sort", column: "name", direction: "asc" }], cannot: "" })))(
  "the table assistant and the day's allowance of model calls",
  (it) => {
    it.effect(
      "takes a call from the shared allowance, then answers by the rules and says why, until a day passes",
      () =>
        Effect.gen(function* () {
          const client = yield* HttpApiTest.groups(Api, ["assistant", "system"])
          const ask = client.assistant.view(request("sort by name")).pipe(as("mem_priya"))
          const answers = yield* Effect.forEach(Arr.range(1, dailyModelCalls + 1), () => ask, { concurrency: 1 })
          const by = Arr.map(answers, (answer) => who(Result.isSuccess(answer) ? answer.success : answer.failure))
          expect(Arr.filter(by, (who) => who === "model").length).toBe(dailyModelCalls)
          const last = Arr.last(answers)
          expect(last._tag === "Some" && Result.isSuccess(last.value) ? last.value.success.answeredBy : last).toEqual({
            _tag: "Rules",
            reason: usedUp
          })
          // The rules still do the work: the same sort, read from the words.
          expect(last._tag === "Some" && Result.isSuccess(last.value) ? last.value.success.changes : last).toEqual([
            { kind: "sort", column: "name", direction: "asc" }
          ])
          // The allowance is the organization's, shared: the check that the key works is refused too, in words.
          const check = yield* client.system.checkAi().pipe(as("mem_marcus"), Effect.flip)
          expect(check._tag === "ModelCallsUsedUp" ? check.reason : check._tag).toBe(
            `The day's ${dailyModelCalls} AI calls are used. They come back over the next day.`
          )
          // Another organization has its own allowance.
          const elsewhere = yield* client.assistant.view(request("sort by name")).pipe(as("mem_tom"))
          expect(Result.isSuccess(elsewhere) ? who(elsewhere.success) : elsewhere).toBe("model")
          yield* TestClock.adjust("25 hours")
          const later = yield* ask
          expect(Result.isSuccess(later) ? who(later.success) : later).toBe("model")
        })
    )
  }
)
