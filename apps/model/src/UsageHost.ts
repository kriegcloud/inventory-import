/**
 * The usage model as the model's Worker hosts it: the model's Layer with its view's `validate`, and the Worker's
 * `fetch` that serves its two Apis, each at its own prefix (`ModelRoutes.ts`). Both are written against whatever
 * platform and session they are given, so the Worker gives them Durable Objects and its session, and a test gives them
 * `Domain.InMemory` and a test session, and nothing else changes (the library's hosting reference:
 * `@alchemy.run/domain/skills/alchemy-domain/references/hosting.md`). The one thing not to break: `TakeCall` is served
 * under the server prefix only, and the member prefix serves no command.
 *
 * @packageDocumentation
 */
import { AllowanceTodayLive } from "@inventory/usage-model/AllowanceToday"
import { UsageMemberApi } from "@inventory/usage-model/MemberApi"
import { Usage } from "@inventory/usage-model/Model"
import { UsageServerApi } from "@inventory/usage-model/ServerApi"
import * as Effect from "effect/Effect"
import { routeByPrefix } from "./ModelRoutes.ts"

/**
 * How the Worker hosts the usage model, apart from its handlers. `legacyData: false` (host-12): nothing was hosted
 * before Domain version 0 in this Worker, so the model takes over no earlier Durable Object class; its classes are its
 * own (`Usage.AllowanceAggregate`) and claim no former name, as decision 37 ("Start empty") says of the data. Left at
 * the library's defaults for now: telemetry (host-05) and which views fill lazily (host-11), each an item of its own.
 */
export const usageLayerOptions = { legacyData: false } as const

/**
 * The usage model hosted, on the platform provided to it, its view's `validate` reading the member record through the
 * kernel's `SessionLookup` the Worker gives it.
 */
export const UsageHosted = Usage.layer(AllowanceTodayLive, usageLayerOptions)

/**
 * What the Worker answers for the usage model: its `fetch`, with the member's Api (`AllowanceToday`, no command)
 * under the member prefix and the server's (`TakeCall`, no read) under the server prefix. Resolved once, when the
 * Worker starts.
 */
export const usageWorker = Effect.gen(function* () {
  const member = yield* UsageMemberApi
  const server = yield* UsageServerApi
  return { fetch: routeByPrefix({ member, server }) }
})
