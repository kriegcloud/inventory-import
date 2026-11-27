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
 * The usage model hosted, on the platform provided to it. Its layer options are the library's defaults for now:
 * telemetry (host-05), which views fill lazily (host-11) and whether it takes over a class from before Domain
 * version 0 (host-12) are each an item of their own.
 */
export const UsageHosted = Usage.layer(AllowanceTodayLive)

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
