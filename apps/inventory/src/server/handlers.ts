import { Clock, Effect, Layer } from "effect"
import * as S from "effect/Schema"
import { HttpServerRequest } from "effect/http"
import { HttpApiBuilder } from "effect/http-api"
import { AiCheck, Api, ModelCallsUsedUp, SystemStatus } from "../api/v1/Api.ts"
import { CurrentActor } from "@inventory/kernel/Actor"
import { Activities } from "./Activities.ts"
import { OpenRouter } from "@beep/openrouter/OpenRouter"
import { aiStatusOf, askModel, modelIsOn } from "./Model.ts"
import { requireRole } from "@inventory/kernel/Actor"
import { ImportHandlers, ItemHandlers } from "./ImportHandlers.ts"
import { Members } from "./Members.ts"
import { ModelCalls, usedUpWords } from "./ModelCalls.ts"
import { People } from "./People.ts"
import { Sessions } from "./SessionIdentity.ts"
import { TableAssistant } from "./TableAssistant.ts"

// Handlers read the actor with `yield* CurrentActor` (from the identity middleware, never from the request) and call
// one service each. Every write starts with `requireRole`; the cross-site check has already run (SameOrigin.ts).

const SystemHandlers = HttpApiBuilder.group(
  Api,
  "system",
  Effect.fn(function* (handlers) {
    const activities = yield* Activities
    const openRouter = yield* OpenRouter
    const calls = yield* ModelCalls
    return handlers.handleAll({
      status: Effect.fn("system.status")(function* () {
        const actor = yield* CurrentActor
        const activityCount = yield* activities.count(actor.organizationId)
        return SystemStatus.make({ database: { ok: true, activityCount }, ai: aiStatusOf(openRouter.status) })
      }),
      checkAi: Effect.fn("system.checkAi")(function* () {
        // It spends the key: an editor or above, like any write, and one of the day's model calls.
        const actor = yield* requireRole("editor")
        if (modelIsOn(openRouter.status) && !(yield* calls.take(actor, "check"))) {
          return yield* ModelCallsUsedUp.make({ reason: `${usedUpWords}. They come back over the next day.` })
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

const ActivityHandlers = HttpApiBuilder.group(
  Api,
  "activity",
  Effect.fn(function* (handlers) {
    const activities = yield* Activities
    return handlers.handleAll({
      recent: Effect.fn("activity.recent")(function* () {
        const actor = yield* CurrentActor
        return yield* activities.recent(actor.organizationId)
      })
    })
  })
)

const IdentityHandlers = HttpApiBuilder.group(
  Api,
  "identity",
  Effect.fn(function* (handlers) {
    const members = yield* Members
    const sessions = yield* Sessions
    return handlers.handleAll({
      session: Effect.fn("identity.session")(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest
        return yield* sessions.state(new Headers(request.headers))
      }),
      members: Effect.fn("identity.members")(function* () {
        const actor = yield* CurrentActor
        return yield* members.inOrganization(actor.organizationId)
      }),
      me: Effect.fn("identity.me")(function* () {
        return yield* CurrentActor
      })
    })
  })
)

const PeopleHandlers = HttpApiBuilder.group(
  Api,
  "people",
  Effect.fn(function* (handlers) {
    const people = yield* People
    return handlers.handleAll({
      list: Effect.fn("people.list")(function* () {
        const actor = yield* CurrentActor
        return yield* people.list(actor.organizationId)
      }),
      add: Effect.fn("people.add")(function* ({ payload }) {
        const actor = yield* requireRole("admin")
        return yield* people.add(actor, payload.email, payload.role)
      }),
      setRole: Effect.fn("people.setRole")(function* ({ params, payload }) {
        const actor = yield* requireRole("admin")
        return yield* people.setRole(actor, params.memberId, payload.role)
      }),
      remove: Effect.fn("people.remove")(function* ({ params }) {
        const actor = yield* requireRole("admin")
        yield* people.remove(actor, params.memberId)
        return { removed: true }
      })
    })
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
