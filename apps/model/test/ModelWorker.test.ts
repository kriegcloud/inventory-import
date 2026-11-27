// The model Worker's wiring with no deploy: the usage model hosted on the memory host behind the Worker's own `fetch`,
// and its two Apis called over HTTP through that `fetch`, as the site's Worker will call them over the service
// binding. What it holds: `TakeCall` is taken at the server prefix only, a member's read answers at the member prefix,
// a path that names neither is a 404 (each behind a test session, on the usage model as the Worker hosts it); the
// Worker's own composition (`workerOn`, which the Worker runs on Durable Objects and this test on `Domain.InMemory`)
// lets nobody in yet; and the Worker's address props keep it off `workers.dev` and off the site's port. What it does
// not hold: the Durable Objects host, the binding and `alchemy dev` (the harness test beside the stack test,
// Benjamin's answer of 2026-11-26, "Beside the stack test").
import * as Domain from "@alchemy.run/domain"
import { describe, expect, it, layer } from "@effect/vitest"
import { assertTrue } from "@effect/vitest/utils"
import { signInSentence } from "@inventory/access-model/SessionRules"
import { NotSignedIn } from "@inventory/kernel/AccessError"
import { UsageMemberApi } from "@inventory/usage-model/MemberApi"
import { UsageServerApi } from "@inventory/usage-model/ServerApi"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as HttpClient from "effect/http/HttpClient"
import * as HttpClientRequest from "effect/http/HttpClientRequest"
import * as Layer from "effect/Layer"
import type { HttpEffect } from "alchemy/Http"
import { address } from "../src/Address.ts"
import { workerOn } from "../src/Models.ts"
import { memberPrefix, serverPrefix } from "../src/ModelRoutes.ts"
import { UsageHosted, usageWorker } from "../src/UsageHost.ts"
import { ana, as, hal, SessionTest, throughBinding } from "./support/binding.ts"

/** The address the binding is reached at: a Worker's binding takes any host, and the path chooses the Api. */
const at = (path: string) => `http://model${path}`

/** A Worker's `fetch`, and a client whose requests it answers, for the life of the test. */
const bindingTo = Effect.fnUntraced(function* <E, R>(worker: Effect.Effect<{ readonly fetch: HttpEffect }, E, R>) {
  const { fetch } = yield* worker
  const scope = yield* Effect.scope
  return throughBinding({ fetch, scope })
})

/** The usage model's `fetch` on the platform and session of the test's layer. */
const binding = bindingTo(usageWorker)

/** What a call was refused with, or what it answered, as a value a test compares. */
const answerOf = <A, E, R>(call: Effect.Effect<A, E, R>): Effect.Effect<E | { readonly accepted: A }, never, R> =>
  Effect.match(call, { onFailure: (refusal) => refusal, onSuccess: (answer) => ({ accepted: answer }) })

describe("the model's Worker", () => {
  layer(Layer.mergeAll(SessionTest, UsageHosted).pipe(Layer.provide(Domain.InMemory)))("behind a session", (it) => {
    it.effect(
      "takes TakeCall at the server prefix, and a member reads the count at the member prefix",
      Effect.fnUntraced(function* () {
        const client = yield* binding
        const server = yield* UsageServerApi.clientHttp(at(serverPrefix)).pipe(
          Effect.provideService(HttpClient.HttpClient, client)
        )
        const member = yield* UsageMemberApi.clientHttp(at(`${memberPrefix}/${ana.memberId}`)).pipe(
          Effect.provideService(HttpClient.HttpClient, client)
        )
        const taken = yield* server.TakeCall({ organizationId: ana.organizationId, purpose: "view" }, as(ana))
        const read = yield* member.AllowanceToday.get(ana.organizationId, { ...as(ana), atLeast: [taken] })
        expect(read).toMatchObject({ taken: 1 })
      }, Effect.scoped)
    )

    it.effect(
      "takes nothing when TakeCall is sent to the member prefix, whose Api serves no command",
      Effect.fnUntraced(function* () {
        expect(UsageMemberApi.commands).toEqual([])
        const client = yield* binding
        const misrouted = yield* UsageServerApi.clientHttp(at(memberPrefix)).pipe(
          Effect.provideService(HttpClient.HttpClient, client)
        )
        const sent = yield* misrouted
          .TakeCall({ organizationId: hal.organizationId, purpose: "view" }, as(hal))
          .pipe(Effect.exit)
        assertTrue(sent.pipe(Exit.isFailure))
        const member = yield* UsageMemberApi.clientHttp(at(`${memberPrefix}/${hal.memberId}`)).pipe(
          Effect.provideService(HttpClient.HttpClient, client)
        )
        const read = yield* member.AllowanceToday.get(hal.organizationId, { ...as(hal), atLeast: [] })
        expect(read).toBeNull()
      }, Effect.scoped)
    )

    it.effect(
      "answers a path under neither prefix with a 404 and no body",
      Effect.fnUntraced(function* () {
        const client = yield* binding
        const statuses = yield* Effect.forEach(
          ["/", "/members", "/servers/x", "/api/model"],
          (path) =>
            client
              .execute(HttpClientRequest.post(at(path)))
              .pipe(
                Effect.flatMap((response) => Effect.map(response.text, (body) => [response.status, body] as const))
              ),
          { concurrency: 1 }
        )
        expect(statuses).toEqual([
          [404, ""],
          [404, ""],
          [404, ""],
          [404, ""]
        ])
      }, Effect.scoped)
    )
  })

  describe("as the Worker puts itself together, before sign-in reaches it", () => {
    it.effect(
      "refuses every call NotSignedIn, with the sentence of a request that has no session",
      Effect.fnUntraced(function* () {
        const client = yield* Domain.InMemory.pipe(workerOn, bindingTo)
        const server = yield* UsageServerApi.clientHttp(at(serverPrefix)).pipe(
          Effect.provideService(HttpClient.HttpClient, client)
        )
        const member = yield* UsageMemberApi.clientHttp(at(memberPrefix)).pipe(
          Effect.provideService(HttpClient.HttpClient, client)
        )
        const take = yield* server
          .TakeCall({ organizationId: hal.organizationId, purpose: "view" }, as(hal))
          .pipe(answerOf)
        expect(take).toBeInstanceOf(NotSignedIn)
        expect(take).toMatchObject({ reason: signInSentence })
        const read = yield* member.AllowanceToday.get(hal.organizationId, { ...as(hal), atLeast: [] }).pipe(answerOf)
        expect(read).toBeInstanceOf(NotSignedIn)
      }, Effect.scoped)
    )

    it("has no public address, and under alchemy dev a port other than the site's", () => {
      expect(address.workersDev).toBe(false)
      expect(address).not.toHaveProperty("domain")
      expect(address).not.toHaveProperty("routes")
      // Alchemy's default port, which the site's Worker keeps (docs/commands.md, `bun run dev:alchemy`).
      expect(address.dev.port).not.toBe(1337)
    })
  })
})
