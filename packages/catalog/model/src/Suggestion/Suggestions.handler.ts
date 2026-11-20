// SUGGEST WHAT THE RULES CANNOT. For an open import, a model (or the fixed rules when there is no model, or the day's
// model calls are used) suggests a name for a row with none, a category for a row whose category is not listed, and
// a file column for a field no heading matched. The one thing not to break: a model proposes and never writes. Every
// answer passes the guard in `Suggest.rules.ts`, which sets the confidence and the evidence itself, and is only
// stored as a suggestion: no item and no decision is touched, and the review shows each one as a proposal the
// person accepts or rejects. One call is taken from the organization's allowance before the model is asked.
/** The agent that suggests. It only proposes, and the most it may do is what an editor may do. */
import { AgentRun } from "@inventory/kernel/AgentRun"
import * as S from "effect/Schema"
import * as A from "effect/Array"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import {
  type NewSuggestion,
  suggestedByRule,
  suggestedByModel,
  Suggestion,
  storedSuggestion
} from "@inventory/catalog-contract/Suggestion"
import { AnsweredBy } from "@inventory/catalog-contract/Answer"
import {
  type SuggestSource,
  digest,
  questions,
  guard,
  answerByRules,
  suggestLines,
  SuggestAnswer
} from "./Suggest.rules.ts"
import { AllowanceAnswer, taken, ModelAllowance } from "../Answer/ModelAllowance.external.ts"
import { Answerer, modelIsOn, ModelQuestion, answeredByRules } from "../Answer/Answerer.external.ts"
import { asAgent } from "@inventory/kernel/Agent"
import { ImportId, SuggestionId } from "@inventory/catalog-contract/Ids"
import { CurrentActor } from "@inventory/kernel/Actor"
import { SuggestionStore, StoreSuggestions } from "./SuggestionStore.store.ts"
import * as SecureRandom from "effect/crypto/SecureRandom"
import { Activity } from "@inventory/kernel/Activity"
import { ActivityId } from "@inventory/kernel/Ids"
export const suggester = AgentRun.make({ agent: "Suggestions", maxRole: "editor" })

/** Why the rules answered when the organization has used the day's model calls, from the allowance's own words. */
export const usedUpSentence = (words: string): string => `${words}, so the rules answered.`

/** Why nobody was asked when every open row already has a suggestion, or none can have one. */
export const nothingToAsk = "Nothing was left to suggest, so no model was asked."

const toJson = S.encodeUnknownEffect(S.fromJsonString(S.Unknown))

// What the model is told. It picks and names; it is never asked to count or to rate itself.
const system = A.join(
  [
    "You help a person review a spreadsheet of inventory items. You only suggest: a person accepts or rejects every suggestion, and nothing you say is stored as an item.",
    "names: for each row in rowsWithoutName, a short name for the item taken from its description: the thing itself, in title case, without phrases like 'for general use'. Use only words the description has. Leave a row out when the description does not say what the item is.",
    "categories: for each row in rowsWithoutCategory, the one value from the categories list that fits the item's name and description. Copy it exactly as written. Leave a row out when none clearly fits.",
    "columns: for each field in fieldsWithoutColumn, the heading from unusedHeadings whose name and examples clearly hold that field. Copy the heading exactly. Leave a field out when no heading clearly fits: notes and comments are not a field.",
    "Answer only for the row numbers, fields and headings you are given."
  ],
  "\n"
)

/** What was worked out for one request, before anything is stored. */
export type Proposed = {
  readonly suggestions: ReadonlyArray<NewSuggestion>
  readonly answeredBy: AnsweredBy
  readonly lines: ReadonlyArray<string>
}

/**
 * Works out the suggestions for an import and stores nothing: the model's answer when one can be asked, the rules'
 * otherwise, each through the guard. `take` takes one call from the day's allowance and is run only when a model is
 * about to be asked; with no model nothing is taken. Whoever answered is in `answeredBy`, with the reason when it was
 * the rules.
 */
export const propose = Effect.fn("Suggestions.propose")(function* <R>(input: {
  readonly source: SuggestSource
  readonly fileName: string
  readonly take: Effect.Effect<AllowanceAnswer, never, R>
}) {
  const answerer = yield* Answerer
  const asked = digest(input.source)
  if (questions(asked) === 0) {
    const none: Proposed = {
      suggestions: [],
      answeredBy: AnsweredBy.cases.Rules.make({ reason: nothingToAsk }),
      lines: ["Suggested nothing: every row the rules cannot fix has a suggestion already, or has nothing to go on"]
    }
    return none
  }
  // One call from the day's allowance, taken before the call is made, and only when there is a model to ask.
  const call = modelIsOn(answerer.status) ? yield* input.take : taken
  const byRules = (reason: string): Proposed => {
    const checked = guard({ source: input.source, answer: answerByRules(asked), by: suggestedByRule })
    return {
      suggestions: checked.suggestions,
      answeredBy: AnsweredBy.cases.Rules.make({ reason }),
      lines: suggestLines({ made: checked.suggestions, refused: checked.refused.length, asked, by: "rule" })
    }
  }
  if (call.kind === "usedUp") return byRules(usedUpSentence(call.reason))
  const sent = yield* toJson(asked).pipe(Effect.orDie)
  const answer = yield* answerer
    .ask(
      ModelQuestion.make({
        name: "suggest",
        prompt: `What is open in the file "${input.fileName}":\n${sent}`,
        system: O.some(system),
        maxOutputTokens: O.some(2000)
      }),
      SuggestAnswer
    )
    .pipe(
      asAgent(suggester),
      answeredByRules(() => null)
    )
  // No model could answer (no key, busy, down, an answer that did not fit): the rules do, and the reason is said.
  const model = O.liftPredicate(answer.answeredBy, AnsweredBy.guards.Model)
  if (answer.value === null || O.isNone(model)) {
    const why = AnsweredBy.match(answer.answeredBy, {
      Rules: (rules) => rules.reason,
      Model: () => "No model answered."
    })
    return byRules(`${why} The rules answered instead.`)
  }
  const checked = guard({ source: input.source, answer: answer.value, by: suggestedByModel(model.value.model) })
  const proposed: Proposed = {
    suggestions: checked.suggestions,
    answeredBy: answer.answeredBy,
    lines: suggestLines({ made: checked.suggestions, refused: checked.refused.length, asked, by: "model" })
  }
  return proposed
})

/**
 * Asks for suggestions for what is still open in an import and stores the ones that pass the guard, with one audit
 * line, in one batch. A row that has a suggestion keeps it, so a second request stores nothing twice. Answers what
 * this request stored, who answered, and what happened in lines.
 */
export const suggest = Effect.fn("Suggestions.suggest")(function* (input: {
  readonly importId: ImportId
  readonly fileName: string
  readonly source: SuggestSource
}) {
  const actor = yield* CurrentActor
  const store = yield* SuggestionStore
  const allowance = yield* ModelAllowance
  const random = yield* SecureRandom.SecureRandom
  const proposed = yield* propose({ source: input.source, fileName: input.fileName, take: allowance.take("suggest") })
  if (proposed.suggestions.length === 0) {
    const none: ReadonlyArray<Suggestion> = []
    return { made: none, answeredBy: proposed.answeredBy, lines: proposed.lines }
  }
  const suggestions = yield* Effect.forEach(
    proposed.suggestions,
    (made) => Effect.map(random.uuidV4(), (id) => storedSuggestion({ id: SuggestionId.make(id), made })),
    { concurrency: 1 }
  )
  const id = yield* random.uuidV4()
  const createdAt = yield* DateTime.now
  const n = suggestions.length
  const who = AnsweredBy.match(proposed.answeredBy, {
    Model: (by) => by.model,
    Rules: () => "the rules, with no model"
  })
  const made = yield* store.store(
    StoreSuggestions.make({
      draft: input.importId,
      suggestions,
      audit: Activity.make({
        id: ActivityId.make(id),
        organizationId: actor.organizationId,
        actorId: actor.id,
        actorName: actor.name,
        action: "Asked for suggestions",
        detail: `${input.fileName}: ${n} ${n === 1 ? "suggestion" : "suggestions"} for the review, answered by ${who}; nothing was changed`,
        agent: O.some(suggester.agent),
        createdAt
      })
    })
  )
  return { made, answeredBy: proposed.answeredBy, lines: proposed.lines }
})
