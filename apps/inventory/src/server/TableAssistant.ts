// THE TABLE ASSISTANT: a request typed in words becomes a checked change to the person's own view of a table. The
// model is asked through @beep/openrouter (`askModel` in Model.ts: one retry policy, OpenRouter's fallback list, the five
// model-trouble sentences); with no key or
// a model in trouble, the fixed rules read the plain cases. Whoever answers, the answer is checked against the
// request's own catalog (`checkCommand`) before the screen sees it. A model call is taken from the organization's
// daily allowance first (the access context's `ModelAllowanceGateway`), the one every model feature draws on; when it is used up the rules answer
// and say so. The one thing not to break: nothing here writes anything but that count and the audit line of a
// model's answer, so it never needs more than the viewer role.
import { Array as Arr, Context, DateTime, Effect, Layer, Option, Result } from "effect"
import * as S from "effect/Schema"
import { SecureRandom } from "effect/crypto"
import { SqlClient } from "effect/sql"
import type { ViewRequest } from "@inventory/catalog-contract/ViewRequest"
import { AgentRun } from "@inventory/kernel/AgentRun"
import { Member } from "@inventory/kernel/Member"
import type { AnsweredBy } from "@inventory/catalog-contract/Answer"
import { checkCommand, readByRules } from "../domain/TableView.ts"
import { type ViewChange, ViewCommand, type ViewOutcome } from "@inventory/catalog-contract/TableView"
import { asAgent } from "@inventory/kernel/Agent"
import { OpenRouter } from "@beep/openrouter/OpenRouter"
import { askModel, modelIsOn } from "./Model.ts"
import { ModelAllowanceGateway, usedUpWords } from "@inventory/access-contract/ModelAllowance"
import { CurrentActor } from "@inventory/kernel/Actor"
import { D1, NoRows } from "@beep/d1/D1"

/** What an answer says when there is no key; the panel says once what the rules read (`rulesRead`). */
export const noKey = "No AI key is set, so the rules answered."

/** What an answer says when the organization has used the day's model calls; the rules answer until some come back. */
export const usedUp = `${usedUpWords}, so the rules answered.`

/**
 * The fixed rules' answer to a request, checked against its catalog like a model's, with the sentence that says why
 * the rules answered. Pure: it needs no key and touches no table.
 */
/** The rules answered, and why no model did. */
const answeredByRules = (reason: string): AnsweredBy => ({ _tag: "Rules", reason })

export const answerByRules = (input: { readonly request: ViewRequest; readonly why: string }): ViewOutcome => {
  const { request, why } = input
  const read = readByRules({ prompt: request.prompt, columns: request.columns })
  const checked = Result.isSuccess(read)
    ? checkCommand({ changes: read.success, columns: request.columns, searchable: request.searchable })
    : read
  return Result.isSuccess(checked)
    ? Result.succeed({ changes: checked.success, answeredBy: answeredByRules(why), note: Option.none() })
    : Result.fail({ reason: checked.failure, answeredBy: answeredByRules(why), note: Option.none() })
}

/** The agent that reads table requests. It changes a person's view only, so it never acts above a viewer. */
export const viewReader = AgentRun.make({ agent: "Table assistant", maxRole: "viewer" })

const toJson = S.encodeUnknownEffect(S.fromJsonString(S.Unknown))

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
>()("@inventory/app/server/TableAssistant") {
  static readonly layer = Layer.effect(
    TableAssistant,
    Effect.gen(function* () {
      const openRouter = yield* OpenRouter
      const sql = yield* SqlClient.SqlClient
      const { run } = yield* D1
      const random = yield* SecureRandom.SecureRandom
      const allowance = yield* ModelAllowanceGateway

      const line = D1.statement({
        Request: S.Struct({
          id: S.String,
          org: S.String,
          actor: S.String,
          name: S.String,
          detail: S.String,
          agent: S.String,
          at: S.String
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
        if (!modelIsOn(openRouter.status)) {
          return answerByRules({ request, why: noKey })
        }
        // One call from the day's allowance, taken before the call is made, so a call that fails still counts.
        const call = yield* allowance.take("view").pipe(Effect.provideService(CurrentActor, actor))
        if (call.kind === "usedUp") {
          return answerByRules({ request, why: usedUp })
        }
        const catalog = yield* toJson({
          table: request.table,
          searchable: request.searchable,
          columns: request.columns
        }).pipe(Effect.orDie)
        const asked = yield* askModel(openRouter, {
          name: "view",
          schema: ViewCommand,
          maxOutputTokens: 1200,
          system,
          prompt: `The table and its columns:\n${catalog}\n\nThe person asks: ${request.prompt}`
        }).pipe(asAgent(viewReader), Effect.result)
        if (Result.isFailure(asked)) {
          return answerByRules({ request, why: `${asked.failure.reason} The rules answered instead.` })
        }
        const answeredBy = asked.success.answeredBy
        const model = answeredBy.model
        const command = asked.success.value
        const checked = checkCommand({
          changes: command.changes,
          columns: request.columns,
          searchable: request.searchable
        })
        yield* item(actor, request, model, Result.isSuccess(checked) ? checked.success : []).pipe(asAgent(viewReader))
        const cannot = command.cannot === "" ? Option.none() : Option.some(command.cannot)
        if (Result.isFailure(checked)) {
          return Result.fail({ reason: checked.failure, answeredBy, note: cannot })
        }
        if (checked.success.length === 0) {
          return Result.fail({
            reason: Option.getOrElse(cannot, () => "The model found nothing in that request to change in the view."),
            answeredBy,
            note: Option.none()
          })
        }
        return Result.succeed({ changes: checked.success, answeredBy, note: cannot })
      })

      return TableAssistant.of({ view })
    })
  ).pipe(Layer.provide(SecureRandom.layerWebCrypto))
}
