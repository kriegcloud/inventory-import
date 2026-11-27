// THE TABLE ASSISTANT. A person types what they want to see; a model (or the fixed rules) answers with changes to
// their own view of a table, each checked against the catalog the request carried. The one thing not to break: it
// changes a view, never stored data, and an answer that names a column the table does not have is refused whole.
// One call is taken from the organization's allowance before the model is asked.
/** What an answer says when there is no key; the panel says once what the rules read (`rulesRead`). */
import { AnsweredBy } from "@inventory/catalog-contract/Answer"
import { ViewRequest } from "@inventory/catalog-contract/ViewRequest"
import { ViewOutcome, ViewCommand } from "@inventory/catalog-contract/TableView"
import { readByRules, checkCommand } from "./TableView.rules.ts"
import { identity } from "effect/Function"
import * as A from "effect/Array"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as Result from "effect/Result"
import { AgentRun } from "@inventory/kernel/AgentRun"
import * as S from "effect/Schema"
import { CurrentActor } from "@inventory/kernel/Actor"
import { Answerer, ModelAvailability, ModelQuestion } from "../Answer/Answerer.port.ts"
import { AllowanceAnswer, ModelAllowance } from "../Answer/ModelAllowance.port.ts"
import { AssistantLog } from "./AssistantLog.port.ts"
import * as SecureRandom from "effect/crypto/SecureRandom"
import { asAgent } from "@inventory/kernel/Agent"
import { Activity } from "@inventory/kernel/Activity"
import { ActivityId } from "@inventory/kernel/Ids"
export const noKey = "No AI key is set, so the rules answered."

/** What an answer says when the organization has used the day's model calls; the rules answer until some come back. */
export const usedUpSentence = (words: string): string => `${words}, so the rules answered.`

/**
 * The fixed rules' answer to a request, checked against its catalog like a model's, with the sentence that says why
 * the rules answered. Pure: it needs no key and touches no table.
 */
/** The rules answered, and why no model did. */
const answeredByRules = (reason: string): AnsweredBy => AnsweredBy.cases.Rules.make({ reason })

/** What the assistant says when the model changed nothing and gave no words of its own for why. */
const nothingToChange = "The model found nothing in that request to change in the view."

export const answerByRules = (input: { readonly request: ViewRequest; readonly why: string }): ViewOutcome => {
  const { request, why } = input
  const read = readByRules({ prompt: request.prompt, columns: request.columns })
  const checked = Result.isSuccess(read)
    ? checkCommand({ changes: read.success, columns: request.columns, searchable: request.searchable })
    : read
  return Result.isSuccess(checked)
    ? Result.succeed({ changes: checked.success, answeredBy: answeredByRules(why), note: O.none() })
    : Result.fail({ reason: checked.failure, answeredBy: answeredByRules(why), note: O.none() })
}

/** The agent that reads table requests. It changes a person's view only, so it never acts above a viewer. */
export const viewReader = AgentRun.make({ agent: "Table assistant", maxRole: "viewer" })

const toJson = S.encodeUnknownEffect(S.fromJsonString(S.Unknown))

// What the model is told. The catalog travels as JSON in the prompt; the answer's Schema says the rest.
const system = A.join(
  [
    "You turn what a person wants to see in a table into changes to the table's view: sort, filter, search, show or hide a column, or clear.",
    "When the table is searchable and the person asks to find rows by words (part of a name, a code, a note), use one search change with just those words, without filler like 'the' or 'all'; its box finds every word in any order and forgives one wrong letter. Use a column filter only when they name the column.",
    'Use only the column ids, operators and values in the catalog you are given. Never invent a column. A select column\'s filter values must be copied from its values list; a boolean filter is eq with "true" or "false"; a number is compared in the units the person reads.',
    "You change only the view, never the data. Anything asked that these changes cannot do (a column the table does not have, grouping, totals, charts, editing rows) goes in cannot, in one plain sentence, and you do the rest."
  ],
  "\n"
)

/**
 * Turns a request into changes checked against its catalog. A model answers when one can be asked and a call is left;
 * the rules answer otherwise and the answer says why. A model's answer leaves one audit line naming the model; an
 * answer from the rules is a read and leaves none. Answers are data (`ViewOutcome`), so a refusal is a sentence the
 * screen shows, never a request error.
 */
export const view = Effect.fn("TableAssistant.view")(function* (request: ViewRequest) {
  const actor = yield* CurrentActor
  const answerer = yield* Answerer
  const allowance = yield* ModelAllowance
  const log = yield* AssistantLog
  const random = yield* SecureRandom.SecureRandom
  if (!ModelAvailability.is.on(answerer.status)) {
    return answerByRules({ request, why: noKey })
  }
  // One call from the day's allowance, taken before the call is made, so a call that fails still counts.
  const call = yield* allowance.take("view")
  if (AllowanceAnswer.guards.usedUp(call)) {
    return answerByRules({ request, why: usedUpSentence(call.reason) })
  }
  const catalog = yield* toJson({
    table: request.table,
    searchable: request.searchable,
    columns: request.columns
  }).pipe(Effect.orDie)
  const asked = yield* answerer
    .ask(
      ModelQuestion.make({
        name: "view",
        prompt: `The table and its columns:\n${catalog}\n\nThe person asks: ${request.prompt}`,
        system: O.some(system),
        maxOutputTokens: O.some(1200)
      }),
      ViewCommand
    )
    .pipe(asAgent(viewReader), Effect.result)
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
  // The person's words stay out of the trail: the line says what kind of thing happened and who answered.
  const n = Result.isSuccess(checked) ? checked.success.length : 0
  const id = yield* random.uuidV4()
  const createdAt = yield* DateTime.now
  yield* log.record(
    Activity.make({
      id: ActivityId.make(id),
      organizationId: actor.organizationId,
      actorId: actor.id,
      actorName: actor.name,
      action: "Asked for a view",
      detail: `${request.table}: ${n} ${n === 1 ? "change" : "changes"} to the view, answered by ${model}`,
      agent: O.some(viewReader.agent),
      createdAt
    })
  )
  const cannot = command.cannot === "" ? O.none() : O.some(command.cannot)
  if (Result.isFailure(checked)) {
    return Result.fail({ reason: checked.failure, answeredBy, note: cannot })
  }
  if (A.isReadonlyArrayEmpty(checked.success)) {
    return Result.fail({
      // The model's own words for what it could not do, when it gave any.
      reason: O.match(cannot, { onNone: () => nothingToChange, onSome: identity }),
      answeredBy,
      note: O.none()
    })
  }
  return Result.succeed({ changes: checked.success, answeredBy, note: cannot })
})

/** What the assistant group's one endpoint does. Any member may ask, because it changes only their own view. */
export const assistantEndpoints = Effect.gen(function* () {
  const ports = yield* Effect.context<Answerer | ModelAllowance | AssistantLog | SecureRandom.SecureRandom>()
  return {
    view: Effect.fn("assistant.view")(function* ({ payload }: { readonly payload: ViewRequest }) {
      return yield* view(payload).pipe(Effect.provideContext(ports))
    })
  }
})
