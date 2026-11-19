// SUGGEST WHAT THE RULES CANNOT. For an open import, a model (or the fixed rules when there is no key, or the day's
// model calls are used) suggests a name for a row with none, a category for a row whose category is not listed, and
// a file column for a field no heading matched. The one thing not to break: a model proposes and never writes. Every
// answer passes the guard in packages/catalog/model/src/Suggestion/Suggest.rules.ts, which sets the confidence and the evidence itself, and is only
// stored in `importSuggestion`: no item and no decision is touched, and the review shows each one as a proposal the
// person accepts or rejects. One call is taken from the organization's allowance before the model is asked.
import { AgentRun } from "@inventory/kernel/AgentRun"
import { usedUpWords, ModelAllowanceGateway } from "@inventory/access-contract/ModelAllowance"
import * as S from "effect/Schema"
import { Array as Arr, DateTime, Effect, Layer } from "effect"
import {
  type NewSuggestion,
  suggestedByRule,
  suggestedByModel,
  SuggestionKind,
  SuggestionByKind,
  suggestionFromStored,
  storedSuggestion,
  suggestionToStored
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
} from "@inventory/catalog-model/Suggest"
import { OpenRouter } from "@beep/openrouter/OpenRouter"
import { modelIsOn, askModel, answeredByRules } from "./Answerer.adapter.ts"
import { asAgent } from "@inventory/kernel/Agent"
import { SuggestionId, RowId } from "@inventory/catalog-contract/Ids"
import { Field } from "@inventory/catalog-contract/Staged"
import { Suggestions } from "@inventory/catalog-model/Suggestions"
import { SqlClient, SqlSchema } from "effect/sql"
import { D1, NoRows } from "@beep/d1/D1"
import { SecureRandom } from "effect/crypto"
import { OrganizationId, MemberId } from "@inventory/kernel/Ids"
import { Member } from "@inventory/kernel/Member"
import { CurrentActor } from "@inventory/kernel/Actor"
import { LiteralKit } from "@beep/schema/LiteralKit"

/** The agent that suggests. It only proposes, and the most it may do is what an editor may do. */
export const suggester = AgentRun.make({ agent: "Suggestions", maxRole: "editor" })

/** Why the rules answered when the organization has used the day's model calls. */
export const usedUp = `${usedUpWords}, so the rules answered.`

/** Why nobody was asked when every open row already has a suggestion, or none can have one. */
export const nothingToAsk = "Nothing was left to suggest, so no model was asked."

const toJson = S.encodeUnknownEffect(S.fromJsonString(S.Unknown))

// What the model is told. It picks and names; it is never asked to count or to rate itself.
const system = Arr.join(
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
 * about to be asked; with no key nothing is taken. Whoever answered is in `answeredBy`, with the reason when it was
 * the rules.
 */
export const propose = Effect.fn("Suggestions.propose")(function* (input: {
  readonly source: SuggestSource
  readonly fileName: string
  readonly take: Effect.Effect<boolean>
}) {
  const openRouter = yield* OpenRouter
  const asked = digest(input.source)
  if (questions(asked) === 0) {
    const none: Proposed = {
      suggestions: [],
      answeredBy: { _tag: "Rules", reason: nothingToAsk },
      lines: ["Suggested nothing: every row the rules cannot fix has a suggestion already, or has nothing to go on"]
    }
    return none
  }
  // One call from the day's allowance, taken before the call is made, and only when there is a model to ask.
  const allowed = modelIsOn(openRouter.status) ? yield* input.take : true
  const byRules = (reason: string): Proposed => {
    const checked = guard({ source: input.source, answer: answerByRules(asked), by: suggestedByRule })
    return {
      suggestions: checked.suggestions,
      answeredBy: { _tag: "Rules", reason },
      lines: suggestLines({ made: checked.suggestions, refused: checked.refused.length, asked, by: "rule" })
    }
  }
  if (!allowed) return byRules(usedUp)
  const sent = yield* toJson(asked).pipe(Effect.orDie)
  const answer = yield* askModel(openRouter, {
    name: "suggest",
    schema: SuggestAnswer,
    maxOutputTokens: 2000,
    system,
    prompt: `What is open in the file "${input.fileName}":\n${sent}`
  }).pipe(
    asAgent(suggester),
    answeredByRules(() => null)
  )
  // No model could answer (no key, busy, down, an answer that did not fit): the rules do, and the reason is said.
  if (answer.value === null || answer.answeredBy._tag === "Rules") {
    const why = answer.answeredBy._tag === "Rules" ? answer.answeredBy.reason : "No model answered."
    return byRules(`${why} The rules answered instead.`)
  }
  const checked = guard({ source: input.source, answer: answer.value, by: suggestedByModel(answer.answeredBy.model) })
  const proposed: Proposed = {
    suggestions: checked.suggestions,
    answeredBy: answer.answeredBy,
    lines: suggestLines({ made: checked.suggestions, refused: checked.refused.length, asked, by: "model" })
  }
  return proposed
})

// A suggestion as its table's columns hold it; `suggestionFromStored` reads it and `suggestionToStored` writes it.
const Stored = S.Struct({
  id: SuggestionId,
  kind: SuggestionKind,
  rowId: S.Union([RowId, S.Literal("")]),
  rowNumber: S.NullOr(S.Int),
  field: Field,
  from: S.String,
  to: S.String,
  column: S.NullOr(S.Int),
  by: SuggestionByKind,
  model: S.NullOr(S.String),
  confidence: LiteralKit(["medium", "low"]),
  basis: S.String
}).annotate({ description: "A suggestion as its table holds it: the row id is empty, not null, for a column" })

/** `Suggestions` with a model behind it when one is on, the rules otherwise, stored on D1. */
export const SuggestionsLive = Layer.effect(
  Suggestions,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const d1 = yield* D1
    const { batch } = d1
    const random = yield* SecureRandom.SecureRandom
    const openRouter = yield* OpenRouter
    const allowance = yield* ModelAllowanceGateway

    const findAll = SqlSchema.findAll({
      Request: S.Struct({ org: OrganizationId, id: S.String }),
      Result: Stored,
      execute: (r) => sql`SELECT id, kind, rowId, rowNumber, field, fromValue AS "from", toValue AS "to",
          columnIndex AS "column", madeBy AS "by", model, confidence, basis
        FROM importSuggestion WHERE organizationId = ${r.org} AND importId = ${r.id} ORDER BY createdAt, id`
    })

    // Written only while the import is open, and only where the row and field have no suggestion yet.
    const insert = D1.statement({
      Request: S.Struct({
        org: OrganizationId,
        importId: S.String,
        actor: MemberId,
        at: S.String,
        row: Stored
      }),
      Result: S.Array(S.Struct({ id: S.String })),
      execute: (r) => sql`INSERT INTO importSuggestion (id, organizationId, importId, kind, rowId, rowNumber, field,
          fromValue, toValue, columnIndex, madeBy, model, confidence, basis, askedById, createdAt)
        SELECT ${r.row.id}, ${r.org}, ${r.importId}, ${r.row.kind}, ${r.row.rowId}, ${r.row.rowNumber},
          ${r.row.field}, ${r.row.from}, ${r.row.to}, ${r.row.column}, ${r.row.by}, ${r.row.model},
          ${r.row.confidence}, ${r.row.basis}, ${r.actor}, ${r.at}
        WHERE EXISTS (SELECT 1 FROM importDraft WHERE organizationId = ${r.org} AND id = ${r.importId}
          AND status = 'open')
        ON CONFLICT (organizationId, importId, rowId, field) DO NOTHING RETURNING id`
    })

    const line = D1.statement({
      Request: S.Struct({
        id: S.String,
        org: OrganizationId,
        actor: MemberId,
        name: S.String,
        detail: S.String,
        agent: S.String,
        at: S.String
      }),
      Result: NoRows,
      execute: (r) => sql`INSERT INTO activity (id, organizationId, actorId, actorName, action, detail, createdAt,
          agent)
        VALUES (${r.id}, ${r.org}, ${r.actor}, ${r.name}, 'Asked for suggestions', ${r.detail}, ${r.at}, ${r.agent})`
    })

    const list = Effect.fn("Suggestions.list")(function* (organizationId: OrganizationId, importId: string) {
      const rows = yield* findAll({ org: organizationId, id: importId })
      return Arr.getSomes(Arr.map(rows, suggestionFromStored))
    }, Effect.orDie)

    const suggest = Effect.fn("Suggestions.suggest")(function* (
      actor: Member,
      input: { readonly importId: string; readonly fileName: string; readonly source: SuggestSource }
    ) {
      const proposed = yield* propose({
        source: input.source,
        fileName: input.fileName,
        take: allowance.take("suggest").pipe(
          Effect.provideService(CurrentActor, actor),
          Effect.map((call) => call.kind === "taken")
        )
      }).pipe(Effect.provideService(OpenRouter, openRouter))
      if (proposed.suggestions.length === 0) {
        return { made: [], answeredBy: proposed.answeredBy, lines: proposed.lines }
      }
      const now = yield* DateTime.now
      const at = DateTime.formatIso(now)
      const rows = yield* Effect.forEach(
        proposed.suggestions,
        (made) => Effect.map(random.uuidV4(), (id) => storedSuggestion({ id: SuggestionId.make(id), made })),
        { concurrency: 1 }
      )
      const activity = yield* random.uuidV4()
      const who = proposed.answeredBy._tag === "Model" ? proposed.answeredBy.model : "the rules, with no model"
      // One batch: the audit line and every suggestion land together or not at all.
      const answers = yield* batch([
        line({
          id: activity,
          org: actor.organizationId,
          actor: actor.id,
          name: actor.name,
          detail: `${input.fileName}: ${rows.length} ${rows.length === 1 ? "suggestion" : "suggestions"} for the review, answered by ${who}; nothing was changed`,
          agent: suggester.agent,
          at
        }),
        ...Arr.map(rows, (row) =>
          insert({
            org: actor.organizationId,
            importId: input.importId,
            actor: actor.id,
            at,
            row: suggestionToStored(row)
          })
        )
      ])
      // Only the rows this batch wrote: one another request stored first is not counted as made here.
      const written = Arr.flatMap(Arr.drop(answers, 1), (rowsBack) => Arr.map(rowsBack, (row) => row.id))
      const made = Arr.filter(rows, (row) => Arr.contains(written, row.id))
      return { made, answeredBy: proposed.answeredBy, lines: proposed.lines }
    }, Effect.orDie)

    return Suggestions.of({ list, suggest })
  })
).pipe(Layer.provide(SecureRandom.layerWebCrypto))
