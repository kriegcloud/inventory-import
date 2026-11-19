// "Suggest what the rules cannot" on items_messy.csv: the guard turns down what the file does not support, a stored
// suggestion never applies itself, with no model the rules answer and say so, and a model's answer is rated by the
// guard, never by the model.
import { describe, expect, it, layer } from "@effect/vitest"
import { Array as Arr, Effect, Option, Record as Rec, Ref } from "effect"
import messy from "../../public/samples/items_messy.csv?raw"
import {
  decisionFromFlags,
  review,
  type RowDecisionFlags,
  storedSuggestion,
  suggestedByModel,
  type Suggestion
} from "../../src/domain/ItemImport.ts"
import { digest, guard, type SuggestSource } from "../../src/domain/Suggest.ts"
import { ModelId } from "@beep/openrouter/OpenRouterModel"
import { OpenRouterTest } from "@beep/openrouter/OpenRouterTest"
import { propose } from "../../src/server/Suggestions.ts"
import { stage } from "./support/files.ts"

const sourceOf = (
  suggestions: ReadonlyArray<Suggestion> = [],
  flags: Readonly<Record<string, RowDecisionFlags>> = {}
) =>
  Effect.map(stage(new File([messy], "items_messy.csv")), (table): SuggestSource => ({
    table,
    review: review({
      table,
      choices: [],
      decisions: Rec.map(flags, decisionFromFlags),
      storedItems: [],
      suggestions
    }),
    suggestions
  }))

const rowOf = (source: SuggestSource, rowNumber: number) =>
  Option.getOrThrow(Arr.findFirst(source.review.rows, (row) => row.rowNumber === rowNumber))

describe("the guard", () => {
  it.effect("turns down a category outside the five, a name over 120 characters and a row nobody asked about", () =>
    Effect.gen(function* () {
      const source = yield* sourceOf()
      // Rows 7 and 83 have no name and a description; row 142 has neither, so nothing is asked about it.
      expect(Arr.map(digest(source).rowsWithoutName, (row) => row.rowNumber)).toEqual([7, 83])
      expect(Arr.map(digest(source).rowsWithoutCategory, (row) => row.rowNumber)).toEqual([40, 116])
      const checked = guard({
        source,
        by: suggestedByModel("scripted/model"),
        answer: {
          names: [
            {
              rowNumber: 7,
              name: Arr.join(
                Arr.makeBy(41, () => "Nylon"),
                " "
              )
            },
            { rowNumber: 83, name: "Copper Plate 1/4in" },
            { rowNumber: 142, name: "Steel Tube" },
            { rowNumber: 2, name: "Another Name" }
          ],
          categories: [
            { rowNumber: 40, category: "widgets" },
            { rowNumber: 116, category: "packaging" }
          ],
          columns: [{ field: "sku", heading: "Internal Notes" }]
        }
      })
      expect(
        Arr.map(checked.suggestions, (s) => (s.kind === "column" ? [] : [s.rowNumber, s.kind, s.to, s.by.kind]))
      ).toEqual([
        [83, "name", "Copper Plate 1/4in", "model"],
        [116, "category", "packaging", "model"]
      ])
      expect(Arr.map(checked.refused, (refused) => refused.why)).toEqual([
        "It is 245 characters long. A name has at most 120.",
        "It is not a row with an empty name and a description.",
        "It is not a row with an empty name and a description.",
        "It is not one of the 5 categories.",
        "That field already has a column, or is not a field."
      ])
      // The guard rates: never high, and the evidence is the file's own description.
      expect(Arr.every(checked.suggestions, (s) => s.confidence === "medium" || s.confidence === "low")).toBe(true)
      expect(checked.suggestions[0]?.basis).toContain("Copper plate 1/4in for general use.")
    })
  )
})

describe("a stored suggestion", () => {
  it.effect("never applies itself: the row stays Cannot import until the person accepts it", () =>
    Effect.gen(function* () {
      const blank = yield* sourceOf()
      const made = guard({
        source: blank,
        by: suggestedByModel("scripted/model"),
        answer: { names: [{ rowNumber: 7, name: "Nylon Coil" }], categories: [], columns: [] }
      }).suggestions
      const stored = Arr.map(made, (suggestion, index): Suggestion =>
        storedSuggestion({ id: `sug_${index}`, made: suggestion })
      )
      const waiting = yield* sourceOf(stored)
      const row = rowOf(waiting, 7)
      expect([row.outcome, row.values.name, row.item, row.changes]).toEqual(["cannot", "", null, []])
      expect(row.problems[0]?.proposal).toMatchObject({ to: "Nylon Coil", by: "model", lossless: false })
      // The counts are the ones the file had before anything was suggested.
      expect(waiting.review.counts).toEqual(blank.review.counts)
      const accepted = yield* sourceOf(stored, { "row-7": { accepted: ["name"] } })
      const taken = rowOf(accepted, 7)
      expect([taken.status, taken.item?.name]).toEqual(["ready", "Nylon Coil"])
      expect(taken.changes).toMatchObject([
        { how: "acceptedProposal", field: "name", to: "Nylon Coil", source: "model" }
      ])
    })
  )
})

layer(OpenRouterTest.off("noKey", ModelId.make("test/model")))("with no model", (it) => {
  it.effect("the rules answer and say so: a name from each description, no category, and no call is taken", () =>
    Effect.gen(function* () {
      const source = yield* sourceOf()
      const taken = yield* Ref.make(0)
      const proposed = yield* propose({
        source,
        fileName: "items_messy.csv",
        take: Effect.as(
          Ref.update(taken, (n) => n + 1),
          true
        )
      })
      expect(proposed.answeredBy._tag).toBe("Rules")
      const calls = yield* Ref.get(taken)
      expect(calls).toBe(0)
      expect(
        Arr.map(proposed.suggestions, (s) => (s.kind === "column" ? [] : [s.rowNumber, s.to, s.by.kind, s.confidence]))
      ).toEqual([
        [7, "Nylon Coil", "rule", "low"],
        [83, "Copper Plate 1/4in", "rule", "low"]
      ])
      expect(proposed.lines).toEqual([
        "Suggested 2 names from the description",
        "Left 2 categories for you: a rule does not guess a category"
      ])
    })
  )
})

const answer =
  '{"names":[{"rowNumber":7,"name":"Nylon Coil"}],"categories":[{"rowNumber":40,"category":"finished-goods"},{"rowNumber":116,"category":"Misc"}],"columns":[]}'
const scripted = OpenRouterTest.scripted([{ text: answer }], { model: ModelId.make("scripted/model") })

layer(scripted.layer)("with a model", (it) => {
  it.effect("one call is taken, the answer goes through the guard, and with the allowance used the rules answer", () =>
    Effect.gen(function* () {
      const source = yield* sourceOf()
      const taken = yield* Ref.make(0)
      const proposed = yield* propose({
        source,
        fileName: "items_messy.csv",
        take: Effect.as(
          Ref.update(taken, (n) => n + 1),
          true
        )
      })
      expect([proposed.answeredBy._tag, yield* Ref.get(taken)]).toEqual(["Model", 1])
      expect(
        Arr.map(proposed.suggestions, (s) => (s.kind === "column" ? [] : [s.rowNumber, s.to, s.by.kind, s.confidence]))
      ).toEqual([
        [7, "Nylon Coil", "model", "medium"],
        [40, "finished-goods", "model", "low"]
      ])
      expect(proposed.lines).toEqual([
        "Suggested 1 name",
        "Suggested 1 category",
        "Turned down 1 suggestion that did not pass the checks"
      ])
      const usedUp = yield* propose({ source, fileName: "items_messy.csv", take: Effect.succeed(false) })
      expect(usedUp.answeredBy).toMatchObject({ _tag: "Rules", reason: expect.stringContaining("AI calls are used") })
      expect(Arr.every(usedUp.suggestions, (s) => s.by.kind === "rule")).toBe(true)
    })
  )
})
