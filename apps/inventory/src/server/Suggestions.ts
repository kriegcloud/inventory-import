// SUGGEST WHAT THE RULES CANNOT. For an open import, a model (or the fixed rules when there is no key, or the day's
// model calls are used) suggests a name for a row with none, a category for a row whose category is not listed, and
// a file column for a field no heading matched. The one thing not to break: a model proposes and never writes. Every
// answer passes the guard in src/domain/Suggest.ts, which sets the confidence and the evidence itself, and is only
// stored in `importSuggestion`: no item and no decision is touched, and the review shows each one as a proposal the
// person accepts or rejects. One call is taken from the organization's allowance before the model is asked.
import { D1Client } from "@effect/sql-d1"
import { Array as Arr, Context, DateTime, Effect, Layer, Schema } from "effect"
import { SecureRandom } from "effect/crypto"
import { SqlClient, SqlSchema } from "effect/sql"
import type { AnsweredBy } from "../api/v1/Api.ts"
import { AgentRun } from "../domain/Agent.ts"
import { type Member, MemberId, OrganizationId } from "../domain/Identity.ts"
import { type NewSuggestion, Suggestion } from "../domain/ItemImport.ts"
import {
  answerByRules,
  digest,
  guard,
  questions,
  SuggestAnswer,
  suggestLines,
  type SuggestSource
} from "../domain/Suggest.ts"
import { asAgent } from "./Agent.ts"
import { Ai, answeredByRules } from "./Ai.ts"
import { ModelCalls, usedUpWords } from "./ModelCalls.ts"
import { batchOn, NoRows, statement } from "./Sql.ts"

/** The agent that suggests. It only proposes, and the most it may do is what an editor may do. */
export const suggester = AgentRun.make({ agent: "Suggestions", maxRole: "editor" })

/** Why the rules answered when the organization has used the day's model calls. */
export const usedUp = `${usedUpWords}, so the rules answered.`

/** Why nobody was asked when every open row already has a suggestion, or none can have one. */
export const nothingToAsk = "Nothing was left to suggest, so no model was asked."

const toJson = Schema.encodeUnknownEffect(Schema.fromJsonString(Schema.Unknown))

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
  const ai = yield* Ai
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
  const allowed = ai.status.available ? yield* input.take : true
  const byRules = (reason: string): Proposed => {
    const checked = guard({ source: input.source, answer: answerByRules(asked), by: "rule", model: null })
    return {
      suggestions: checked.suggestions,
      answeredBy: { _tag: "Rules", reason },
      lines: suggestLines({ made: checked.suggestions, refused: checked.refused.length, asked, by: "rule" })
    }
  }
  if (!allowed) return byRules(usedUp)
  const sent = yield* toJson(asked).pipe(Effect.orDie)
  const answer = yield* ai
    .generateObject({
      name: "suggest",
      schema: SuggestAnswer,
      maxOutputTokens: 2000,
      system,
      prompt: `What is open in the file "${input.fileName}":\n${sent}`
    })
    .pipe(
      asAgent(suggester),
      answeredByRules(() => null)
    )
  // No model could answer (no key, busy, down, an answer that did not fit): the rules do, and the reason is said.
  if (answer.value === null || answer.answeredBy._tag === "Rules") {
    const why = answer.answeredBy._tag === "Rules" ? answer.answeredBy.reason : "No model answered."
    return byRules(`${why} The rules answered instead.`)
  }
  const checked = guard({ source: input.source, answer: answer.value, by: "model", model: answer.answeredBy.model })
  const proposed: Proposed = {
    suggestions: checked.suggestions,
    answeredBy: answer.answeredBy,
    lines: suggestLines({ made: checked.suggestions, refused: checked.refused.length, asked, by: "model" })
  }
  return proposed
})

const Stored = Schema.Struct({
  ...Suggestion.fields,
  rowId: Schema.String.annotate({ description: "The row's id; empty for a column" })
}).annotate({ description: "A suggestion as its table holds it: the row id is empty, not null, for a column" })

const toSuggestion = (row: typeof Stored.Type): Suggestion => ({ ...row, rowId: row.rowId === "" ? null : row.rowId })

/** The suggestions of an import: reading them for the review, and asking for more. */
export class Suggestions extends Context.Service<
  Suggestions,
  {
    /** Every suggestion stored for the import, oldest first: what the review is given, on the server and the screen. */
    list(organizationId: OrganizationId, importId: string): Effect.Effect<ReadonlyArray<Suggestion>>
    /**
     * Asks for suggestions for what is still open in the import and stores the ones that pass the guard, with one
     * audit line, in one batch. A row that has a suggestion keeps it, so a second request stores nothing twice.
     * Returns what this request stored and who answered.
     */
    suggest(
      actor: Member,
      input: { readonly importId: string; readonly fileName: string; readonly source: SuggestSource }
    ): Effect.Effect<{
      readonly made: ReadonlyArray<Suggestion>
      readonly answeredBy: AnsweredBy
      readonly lines: ReadonlyArray<string>
    }>
  }
>()("inventory/server/Suggestions") {
  static readonly layer = Layer.effect(
    Suggestions,
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient
      const d1 = yield* D1Client.D1Client
      const batch = batchOn(d1)
      const random = yield* SecureRandom.SecureRandom
      const ai = yield* Ai
      const calls = yield* ModelCalls

      const findAll = SqlSchema.findAll({
        Request: Schema.Struct({ org: OrganizationId, id: Schema.String }),
        Result: Stored,
        execute: (r) => sql`SELECT id, kind, rowId, rowNumber, field, fromValue AS "from", toValue AS "to",
            columnIndex AS "column", madeBy AS "by", model, confidence, basis
          FROM importSuggestion WHERE organizationId = ${r.org} AND importId = ${r.id} ORDER BY createdAt, id`
      })

      // Written only while the import is open, and only where the row and field have no suggestion yet.
      const insert = statement({
        Request: Schema.Struct({
          org: OrganizationId,
          importId: Schema.String,
          actor: MemberId,
          at: Schema.String,
          row: Stored
        }),
        Result: Schema.Array(Schema.Struct({ id: Schema.String })),
        execute: (r) => sql`INSERT INTO importSuggestion (id, organizationId, importId, kind, rowId, rowNumber, field,
            fromValue, toValue, columnIndex, madeBy, model, confidence, basis, askedById, createdAt)
          SELECT ${r.row.id}, ${r.org}, ${r.importId}, ${r.row.kind}, ${r.row.rowId}, ${r.row.rowNumber},
            ${r.row.field}, ${r.row.from}, ${r.row.to}, ${r.row.column}, ${r.row.by}, ${r.row.model},
            ${r.row.confidence}, ${r.row.basis}, ${r.actor}, ${r.at}
          WHERE EXISTS (SELECT 1 FROM importDraft WHERE organizationId = ${r.org} AND id = ${r.importId}
            AND status = 'open')
          ON CONFLICT (organizationId, importId, rowId, field) DO NOTHING RETURNING id`
      })

      const line = statement({
        Request: Schema.Struct({
          id: Schema.String,
          org: OrganizationId,
          actor: MemberId,
          name: Schema.String,
          detail: Schema.String,
          agent: Schema.String,
          at: Schema.String
        }),
        Result: NoRows,
        execute: (r) => sql`INSERT INTO activity (id, organizationId, actorId, actorName, action, detail, createdAt,
            agent)
          VALUES (${r.id}, ${r.org}, ${r.actor}, ${r.name}, 'Asked for suggestions', ${r.detail}, ${r.at}, ${r.agent})`
      })

      const list = Effect.fn("Suggestions.list")(function* (organizationId: OrganizationId, importId: string) {
        const rows = yield* findAll({ org: organizationId, id: importId })
        return Arr.map(rows, toSuggestion)
      }, Effect.orDie)

      const suggest = Effect.fn("Suggestions.suggest")(function* (
        actor: Member,
        input: { readonly importId: string; readonly fileName: string; readonly source: SuggestSource }
      ) {
        const proposed = yield* propose({
          source: input.source,
          fileName: input.fileName,
          take: calls.take(actor, "suggest")
        }).pipe(Effect.provideService(Ai, ai))
        if (proposed.suggestions.length === 0) {
          return { made: [], answeredBy: proposed.answeredBy, lines: proposed.lines }
        }
        const now = yield* DateTime.now
        const at = DateTime.formatIso(now)
        const rows = yield* Effect.forEach(proposed.suggestions, (suggestion) =>
          Effect.map(random.uuidV4(), (id) => ({ ...suggestion, id, rowId: suggestion.rowId ?? "" }))
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
            insert({ org: actor.organizationId, importId: input.importId, actor: actor.id, at, row })
          )
        ])
        // Only the rows this batch wrote: one another request stored first is not counted as made here.
        const written = Arr.flatMap(Arr.drop(answers, 1), (rowsBack) => Arr.map(rowsBack, (row) => row.id))
        const made = Arr.map(
          Arr.filter(rows, (row) => Arr.contains(written, row.id)),
          toSuggestion
        )
        return { made, answeredBy: proposed.answeredBy, lines: proposed.lines }
      }, Effect.orDie)

      return Suggestions.of({ list, suggest })
    })
  ).pipe(Layer.provide(SecureRandom.layerWebCrypto))
}
