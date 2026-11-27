// The model Worker's wiring with no deploy: the usage model hosted on the memory host behind the Worker's own `fetch`,
// and its two Apis called over HTTP through that `fetch`, as the site's Worker will call them over the service
// binding. What it holds: `TakeCall` is taken at the server prefix only, a member's read answers at the member prefix,
// a path that names neither is a 404 (each behind a test session, on the usage model as the Worker hosts it); the
// Worker's own composition (`workerOn`, which the Worker runs on Durable Objects and this test on `Domain.InMemory`),
// on the Worker's own session lookup (`sessionsOver`) over its own Better Auth, acts as the member whose cookie the
// site's Worker forwards, role included (a viewer's check is refused `NotPermitted`), and lets nobody else in; and the
// Worker's address props keep it off `workers.dev` and off the site's port. What it does not hold: the Durable Objects
// host, the D1 database (the sign-in store and the member directory are in memory here), the bindings the stack hands
// the Worker and `alchemy dev`, all of which the harness test beside the stack test holds (`apps/inventory/test/stack`;
// Benjamin, 2026-11-26, "Beside the stack test"), and the site's Worker forwarding the cookie, which is not built yet.
import { Memory } from "@alchemy.run/better-auth/Memory"
import * as Domain from "@alchemy.run/domain"
import { describe, expect, it, layer } from "@effect/vitest"
import { assertTrue } from "@effect/vitest/utils"
import { accessMemory } from "@inventory/access-model/Memory"
import { signInSentence } from "@inventory/access-model/SessionRules"
import { NotSignedIn } from "@inventory/kernel/AccessError"
import { MemberId, OrganizationId, UserId } from "@inventory/kernel/Ids"
import { Member } from "@inventory/kernel/Member"
import { NotPermitted } from "@inventory/usage-model/Allowance"
import { UsageMemberApi } from "@inventory/usage-model/MemberApi"
import { UsageServerApi } from "@inventory/usage-model/ServerApi"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as HttpClient from "effect/http/HttpClient"
import * as HttpClientRequest from "effect/http/HttpClientRequest"
import * as Layer from "effect/Layer"
import * as O from "effect/Option"
import type { HttpEffect } from "alchemy/Http"
import { address } from "../src/Address.ts"
import { workerOn } from "../src/Models.ts"
import { memberPrefix, serverPrefix } from "../src/ModelRoutes.ts"
import { sessionsOver } from "../src/SignIn.ts"
import { UsageHosted, usageWorker } from "../src/UsageHost.ts"
import { ana, as, hal, PeopleStillIn, SessionTest, throughBinding } from "./support/binding.ts"
import type { MemoryDB } from "better-auth/adapters/memory"
import { authStore, signedInMember, siteSecret, withWorkerSettings } from "./support/signIn.ts"

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

/** A member who signs in on the site's construction, and is a member of an organization there and in the directory. */
const dana = {
  email: "dana@example.test",
  memberId: "mem_dana",
  organizationId: "org_prairie",
  role: "editor"
} as const

/** A viewer of the same organization. */
const vic = {
  email: "vic@example.test",
  memberId: "mem_vic",
  organizationId: "org_prairie",
  role: "viewer"
} as const

/** A member as the directory holds them, signed in as the account `userId`. */
const membershipOf = (member: typeof dana | typeof vic, userId: string) => ({
  member: Member.make({
    id: MemberId.make(member.memberId),
    name: `Member ${member.memberId}`,
    role: member.role,
    organizationId: OrganizationId.make(member.organizationId),
    organizationName: "Example Works (test)"
  }),
  userId: O.some(UserId.make(userId)),
  joinedAt: O.none(),
  removed: false
})

/**
 * The Worker's own composition on the memory host, on the Worker's own session lookup (`sessionsOver`) over the
 * model's Better Auth on `store` and a member directory that holds `memberships`.
 */
const signedInWorker = (store: MemoryDB, memberships: ReadonlyArray<ReturnType<typeof membershipOf>>) =>
  bindingTo(
    workerOn({
      platform: Domain.InMemory,
      sessions: sessionsOver({
        auth: Memory(store),
        directory: accessMemory({ memberships: [...memberships] }),
        secureCookies: false
      })
    })
  )

describe("the model's Worker", () => {
  layer(Layer.mergeAll(SessionTest, UsageHosted).pipe(Layer.provide(PeopleStillIn), Layer.provide(Domain.InMemory)))(
    "behind a session",
    (it) => {
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
    }
  )

  describe("as the Worker puts itself together, on the one session lookup", () => {
    it.effect(
      "acts as the member whose cookie the call carries: the call is taken, and the member reads the count",
      Effect.fnUntraced(
        function* () {
          const store = authStore()
          const signedIn = yield* signedInMember(store, dana)
          const client = yield* signedInWorker(store, [membershipOf(dana, signedIn.userId)])
          const withCookie = { headers: { cookie: signedIn.cookie } }
          const server = yield* UsageServerApi.clientHttp(at(serverPrefix)).pipe(
            Effect.provideService(HttpClient.HttpClient, client)
          )
          const member = yield* UsageMemberApi.clientHttp(at(`${memberPrefix}/${dana.memberId}`)).pipe(
            Effect.provideService(HttpClient.HttpClient, client)
          )
          const taken = yield* server.TakeCall({ organizationId: dana.organizationId, purpose: "view" }, withCookie)
          const read = yield* member.AllowanceToday.get(dana.organizationId, { ...withCookie, atLeast: [taken] })
          expect(read).toMatchObject({ taken: 1 })
        },
        Effect.scoped,
        withWorkerSettings(O.some(siteSecret))
      )
    )

    it.effect(
      "refuses every call with no session NotSignedIn, with the sentence to sign in, and takes nothing",
      Effect.fnUntraced(
        function* () {
          const store = authStore()
          const signedIn = yield* signedInMember(store, dana)
          const client = yield* signedInWorker(store, [membershipOf(dana, signedIn.userId)])
          const server = yield* UsageServerApi.clientHttp(at(serverPrefix)).pipe(
            Effect.provideService(HttpClient.HttpClient, client)
          )
          const member = yield* UsageMemberApi.clientHttp(at(`${memberPrefix}/${dana.memberId}`)).pipe(
            Effect.provideService(HttpClient.HttpClient, client)
          )
          // The test session's header names Dana, and the Worker's own session reads no header for who acts.
          const take = yield* server
            .TakeCall({ organizationId: dana.organizationId, purpose: "view" }, as(ana))
            .pipe(answerOf)
          expect(take).toBeInstanceOf(NotSignedIn)
          expect(take).toMatchObject({ reason: signInSentence })
          const read = yield* member.AllowanceToday.get(dana.organizationId, {
            headers: { cookie: signedIn.cookie },
            atLeast: []
          })
          expect(read).toBeNull()
        },
        Effect.scoped,
        withWorkerSettings(O.some(siteSecret))
      )
    )

    it.effect(
      "acts as the viewer whose cookie the call carries: the assistant's call is taken, a check's is refused NotPermitted",
      Effect.fnUntraced(
        function* () {
          const store = authStore()
          const signedIn = yield* signedInMember(store, vic)
          const client = yield* signedInWorker(store, [membershipOf(vic, signedIn.userId)])
          const withCookie = { headers: { cookie: signedIn.cookie } }
          const server = yield* UsageServerApi.clientHttp(at(serverPrefix)).pipe(
            Effect.provideService(HttpClient.HttpClient, client)
          )
          const member = yield* UsageMemberApi.clientHttp(at(`${memberPrefix}/${vic.memberId}`)).pipe(
            Effect.provideService(HttpClient.HttpClient, client)
          )
          const check = yield* server
            .TakeCall({ organizationId: vic.organizationId, purpose: "check" }, withCookie)
            .pipe(answerOf)
          expect(check).toEqual(NotPermitted.make({ required: "editor" }))
          const taken = yield* server.TakeCall({ organizationId: vic.organizationId, purpose: "view" }, withCookie)
          // Only the assistant's call is counted: the refused check took nothing.
          const read = yield* member.AllowanceToday.get(vic.organizationId, { ...withCookie, atLeast: [taken] })
          expect(read).toMatchObject({ taken: 1 })
        },
        Effect.scoped,
        withWorkerSettings(O.some(siteSecret))
      )
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
