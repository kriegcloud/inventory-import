// THE TABLE ASSISTANT: a request typed in words becomes a checked change to the person's own view of a table. The
// model is asked through `Ai` (one retry policy, the fallback chain, the five model-trouble sentences); with no key or
// a model in trouble, the fixed rules read the plain cases. Whoever answers, the answer is checked against the
// request's own catalog (`checkCommand`) before the screen sees it. A model call is taken from the organization's
// daily allowance first (ModelCalls.ts), the one every model feature draws on; when it is used up the rules answer
// and say so. The one thing not to break: nothing here writes anything but that count and the audit line of a
// model's answer, so it never needs more than the viewer role.
import { Array as Arr, Context, DateTime, Effect, Layer, Result, Schema } from "effect"
import { SecureRandom } from "effect/crypto"
import { SqlClient } from "effect/sql"
import type { ViewRequest } from "../api/v1/Assistant.ts"
import { AgentRun } from "../domain/Agent.ts"
import { Member } from "../domain/Identity.ts"
import { checkCommand, readByRules, type ViewChange, ViewCommand, type ViewOutcome } from "../domain/TableView.ts"
import { asAgent } from "./Agent.ts"
import { Ai } from "./Ai.ts"
import { ModelCalls, usedUpWords } from "./ModelCalls.ts"
import { NoRows, run, statement } from "./Sql.ts"

/** What an answer says when there is no key; the panel says once what the rules read (`rulesRead`). */
export const noKey = "No AI key is set, so the rules answered."

/** What an answer says when the organization has used the day's model calls; the rules answer until some come back. */
export const usedUp = `${usedUpWords}, so the rules answered.`

/**
 * The fixed rules' answer to a request, checked against its catalog like a model's, with the sentence that says why
 * the rules answered. Pure: it needs no key and touches no table.
 */
export const answerByRules = (input: { readonly request: ViewRequest; readonly why: string }): ViewOutcome => {
  const { request, why } = input
  const read = readByRules({ prompt: request.prompt, columns: request.columns })
  const checked = Result.isSuccess(read)
    ? checkCommand({ changes: read.success, columns: request.columns, searchable: request.searchable })
    : read
  return Result.isSuccess(checked)
    ? Result.succeed({ changes: checked.success, by: "rules" as const, model: null, note: why })
    : Result.fail({ reason: checked.failure, by: "rules" as const, model: null, note: why })
}

/** The agent that reads table requests. It changes a person's view only, so it never acts above a viewer. */
export const viewReader = AgentRun.make({ agent: "Table assistant", maxRole: "viewer" })

const toJson = Schema.encodeUnknownEffect(Schema.fromJsonString(Schema.Unknown))

// What the model is told. The catalog travels as JSON in the prompt; the answer's Schema says the rest.
const system = Arr.join(
  [
    "You turn what a person wants to see in a table into changes to the table's view: sort, filter, search, show or hide a column, or clear.",
    "When the table is searchable and the person asks to find rows by words (part of a name, a code, a note), use one search change with just those words, without filler like 'the' or 'all'; its box finds every word in any order and forgives one wrong letter. Use a column filter only when they name the column.",
    'Use only the column ids, operators and values in the catalog you are given. Never invent a column. A select column\'s filter values must be copied from its values list; a boolean filter is eq with "true" or "false"; a number is compared in the units the person reads.',
    "You change only the view, never the data. Anything asked that these changes cannot do (a column the table does not have, grouping, totals, charts, editing rows) goes in cannot, in one plain sentence, and you do the rest."
  ],
  "\n"
)

/**
 * Reads table requests for the person signed in. A model answers when there is a key and it can be reached; the
 * rules answer otherwise and the answer says why. Answers are data (`ViewOutcome`), so a refusal is a sentence the
 * screen shows, never a request error.
 */
export class TableAssistant extends Context.Service<
  TableAssistant,
  {
    /**
     * Turns a request into changes checked against its catalog. A model's answer leaves one audit line naming the
     * model; an answer from the rules is a read and leaves none.
     */
    view(actor: Member, request: ViewRequest): Effect.Effect<ViewOutcome>
  }
>()("inventory/server/TableAssistant") {
  static readonly layer = Layer.effect(
    TableAssistant,
    Effect.gen(function* () {
      const ai = yield* Ai
      const sql = yield* SqlClient.SqlClient
      const random = yield* SecureRandom.SecureRandom
      const calls = yield* ModelCalls

      const line = statement({
        Request: Schema.Struct({
          id: Schema.String,
          org: Schema.String,
          actor: Schema.String,
          name: Schema.String,
          detail: Schema.String,
          agent: Schema.String,
          at: Schema.String
        }),
        Result: NoRows,
        execute: (r) => sql`INSERT INTO activity (id, organizationId, actorId, actorName, action, detail, createdAt,
            agent)
          VALUES (${r.id}, ${r.org}, ${r.actor}, ${r.name}, 'Asked for a view', ${r.detail}, ${r.at}, ${r.agent})`
      })

      const item = Effect.fn("TableAssistant.item")(function* (
        actor: Member,
        request: ViewRequest,
        model: string,
        changes: ReadonlyArray<ViewChange>
      ) {
        const id = yield* random.uuidV4()
        const now = yield* DateTime.now
        const n = changes.length
        // The person's words stay out of the trail: the line says what kind of thing happened and who answered.
        const detail = `${request.table}: ${n} ${n === 1 ? "change" : "changes"} to the view, answered by ${model}`
        yield* run(
          line({
            id,
            org: actor.organizationId,
            actor: actor.id,
            name: actor.name,
            detail,
            agent: viewReader.agent,
            at: DateTime.formatIso(now)
          })
        )
      }, Effect.orDie)

      const view = Effect.fn("TableAssistant.view")(function* (actor: Member, request: ViewRequest) {
        if (!ai.status.available) {
          return answerByRules({ request, why: noKey })
        }
        // One call from the day's allowance, taken before the call is made, so a call that fails still counts.
        if (!(yield* calls.take(actor, "view"))) {
          return answerByRules({ request, why: usedUp })
        }
        const catalog = yield* toJson({
          table: request.table,
          searchable: request.searchable,
          columns: request.columns
        }).pipe(Effect.orDie)
        const asked = yield* ai
          .generateObject({
            name: "view",
            schema: ViewCommand,
            maxOutputTokens: 1200,
            system,
            prompt: `The table and its columns:\n${catalog}\n\nThe person asks: ${request.prompt}`
          })
          .pipe(asAgent(viewReader), Effect.result)
        if (Result.isFailure(asked)) {
          return answerByRules({ request, why: `${asked.failure.reason} The rules answered instead.` })
        }
        const model = asked.success.answeredBy.model
        const command = asked.success.value
        const checked = checkCommand({
          changes: command.changes,
          columns: request.columns,
          searchable: request.searchable
        })
        yield* item(actor, request, model, Result.isSuccess(checked) ? checked.success : []).pipe(asAgent(viewReader))
        const cannot = command.cannot === "" ? null : command.cannot
        if (Result.isFailure(checked)) {
          return Result.fail({ reason: checked.failure, by: "model" as const, model, note: cannot })
        }
        if (checked.success.length === 0) {
          return Result.fail({
            reason: cannot ?? "The model found nothing in that request to change in the view.",
            by: "model" as const,
            model,
            note: null
          })
        }
        return Result.succeed({ changes: checked.success, by: "model" as const, model, note: cannot })
      })

      return TableAssistant.of({ view })
    })
  ).pipe(Layer.provide(SecureRandom.layerWebCrypto))
}
