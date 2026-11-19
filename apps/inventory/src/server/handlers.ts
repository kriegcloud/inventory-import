import { Clock, Effect, Layer } from "effect"
import * as S from "effect/Schema"
import { HttpApiBuilder } from "effect/http-api"
import { ModelAllowanceGateway, ModelCallsUsedUp } from "@inventory/access-contract/ModelAllowance"
import { activityCount, activityEndpoints, identityEndpoints, peopleEndpoints } from "@inventory/access-host/Http"
import { AiCheck, Api, SystemStatus } from "../api/v1/Api.ts"
import { CurrentActor } from "@inventory/kernel/Actor"
import { OpenRouter } from "@beep/openrouter/OpenRouter"
import { aiStatusOf, askModel, modelIsOn } from "./Model.ts"
import { requireRole } from "@inventory/kernel/Actor"
import { ImportHandlers, ItemHandlers } from "./ImportHandlers.ts"
import { TableAssistant } from "./TableAssistant.ts"

// Handlers read the actor with `yield* CurrentActor` (from the identity middleware, never from the request) and call
// one service each. Every write starts with `requireRole`; the cross-site check has already run (SameOrigin.ts).

const SystemHandlers = HttpApiBuilder.group(
  Api,
  "system",
  Effect.fn(function* (handlers) {
    const openRouter = yield* OpenRouter
    const allowance = yield* ModelAllowanceGateway
    const countActivity = yield* activityCount
    return handlers.handleAll({
      status: Effect.fn("system.status")(function* () {
        const count = yield* countActivity()
        return SystemStatus.make({ database: { ok: true, activityCount: count }, ai: aiStatusOf(openRouter.status) })
      }),
      checkAi: Effect.fn("system.checkAi")(function* () {
        // It spends the key: an editor or above, like any write, and one of the day's model calls.
        yield* requireRole("editor")
        if (modelIsOn(openRouter.status)) {
          const call = yield* allowance.take("check")
          if (call.kind === "usedUp") return yield* ModelCallsUsedUp.make({ reason: call.reason })
        }
        const started = yield* Clock.currentTimeMillis
        const answer = yield* askModel(openRouter, {
          name: "greeting",
          prompt: "Reply with a five-word greeting.",
          schema: S.Struct({ greeting: S.String })
        })
        const finished = yield* Clock.currentTimeMillis
        return AiCheck.make({
          model: answer.answeredBy.model,
          reply: answer.value.greeting,
          millis: Number(finished - started),
          answeredBy: answer.answeredBy
        })
      })
    })
  })
)

// The access context's three groups: what each endpoint does is the host's; the Layer is built here, against `Api`.
const ActivityHandlers = HttpApiBuilder.group(
  Api,
  "activity",
  Effect.fn(function* (handlers) {
    const endpoints = yield* activityEndpoints
    return handlers.handleAll(endpoints)
  })
)
const IdentityHandlers = HttpApiBuilder.group(
  Api,
  "identity",
  Effect.fn(function* (handlers) {
    const endpoints = yield* identityEndpoints
    return handlers.handleAll(endpoints)
  })
)
const PeopleHandlers = HttpApiBuilder.group(
  Api,
  "people",
  Effect.fn(function* (handlers) {
    const endpoints = yield* peopleEndpoints
    return handlers.handleAll(endpoints)
  })
)

// The table assistant: any member may ask, because it changes only their own view.
const AssistantHandlers = HttpApiBuilder.group(
  Api,
  "assistant",
  Effect.fn(function* (handlers) {
    const assistant = yield* TableAssistant
    return handlers.handle(
      "view",
      Effect.fn("assistant.view")(function* ({ payload }) {
        const actor = yield* CurrentActor
        return yield* assistant.view(actor, payload)
      })
    )
  })
)

/** Every endpoint of the API contract, implemented. `App.ts` provides the services they need. */
export const Handlers = Layer.mergeAll(
  SystemHandlers,
  IdentityHandlers,
  ActivityHandlers,
  ImportHandlers,
  ItemHandlers,
  PeopleHandlers,
  AssistantHandlers
)
