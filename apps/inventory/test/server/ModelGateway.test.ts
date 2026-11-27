// The allowance's gateway as the site's Worker composes it under `dev:alchemy` and deployed (usage-03): the gateway's
// Layer (`ModelAllowanceOverUsage`) over the models reached by a binding (`Models.overBinding`), whose `fetch` is the
// model Worker's own, in this process, on the memory host, behind the model Worker's own session over a lookup that
// reads the cookie. What it holds: a take carries the person, the cookie and the page's member header of the request
// being answered and nothing else of it, and is taken as that member; a take with no request to carry, or for a page
// opened for somebody else, is not taken; the forty-first take of a day is used up, with the sentence a person reads;
// and a model Worker that cannot be reached, or answers with a fault, is a defect, as a failed count on D1 was before. What it does not hold:
// the Durable Objects host and the service binding itself (the harness test beside the stack test).
import * as Domain from "@alchemy.run/domain"
import { describe, expect, it } from "@effect/vitest"
import { pageMemberHeader } from "@inventory/access-contract/Access"
import { NotSignedIn } from "@inventory/kernel/AccessError"
import { CurrentActor } from "@inventory/kernel/Actor"
import { MemberId, OrganizationId } from "@inventory/kernel/Ids"
import { Member } from "@inventory/kernel/Member"
import { SessionLookup, SessionVerdict } from "@inventory/kernel/SessionLookup"
import { modelsOn } from "@inventory/model-app/Models"
import { usageWorker } from "@inventory/model-app/UsageHost"
import { ModelAllowanceGateway, taken, usedUp, usedUpSentence } from "@inventory/usage-contract/ModelAllowance"
import * as A from "effect/Array"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Headers from "effect/http/Headers"
import * as HttpEffect from "effect/http/HttpEffect"
import * as HttpServerRequest from "effect/http/HttpServerRequest"
import * as HttpServerResponse from "effect/http/HttpServerResponse"
import * as Layer from "effect/Layer"
import * as MutableRef from "effect/MutableRef"
import * as O from "effect/Option"
import type * as Scope from "effect/Scope"
import { type ModelBinding, ModelAllowanceOverUsage, Models } from "../../src/server/Models.ts"

const ana = Member.make({
  id: MemberId.make("mem_ana"),
  name: "Ana Lima",
  role: "editor",
  organizationId: OrganizationId.make("org_prairie"),
  organizationName: "Example Works (test)"
})

/** The cookie a browser signed in as Ana sends. */
const anasCookie = "session=mem_ana"

/** What the model's session lookup was handed, call by call: the cookie and the page's member header, if any. */
interface Seen {
  readonly cookie: O.Option<string>
  readonly pageMember: O.Option<string>
  readonly others: ReadonlyArray<string>
}

/**
 * The model Worker's session lookup in this test: the cookie names Ana or nobody, and the page's member header can
 * only refuse, as the one session lookup does. It writes down what each call carried.
 */
const lookupSeeing = (seen: MutableRef.MutableRef<ReadonlyArray<Seen>>) =>
  SessionLookup.of({
    verdictOf: Effect.fn("SessionLookup.verdictOf")(function* (headers) {
      const cookie = Headers.get(headers, "cookie")
      const pageMember = Headers.get(headers, pageMemberHeader)
      const others = A.filter(["x-acting-as", "authorization"], (name) => O.isSome(Headers.get(headers, name)))
      MutableRef.update(seen, A.append({ cookie, pageMember, others }))
      if (!O.contains(cookie, anasCookie)) return yield* NotSignedIn.make({ reason: "Sign in to continue." })
      if (O.exists(pageMember, (page) => page !== `${ana.id}/${ana.organizationId}`)) {
        return yield* NotSignedIn.make({
          reason: "This page was opened for somebody else than is signed in now. Load the page again."
        })
      }
      return SessionVerdict.judged({ member: ana, at: yield* DateTime.now, sessionEnds: O.none() })
    }),
    memberNow: Effect.fn("SessionLookup.memberNow")(function* () {
      return yield* Effect.succeedSome(ana)
    })
  })

/**
 * The binding as the site's Worker holds it, answered by the model Worker's own `fetch` on the memory host: a request
 * in, a response out, through the platform's own web handler (`HttpEffect.toWebHandler`).
 */
const bindingTo = Effect.fnUntraced(function* (seen: MutableRef.MutableRef<ReadonlyArray<Seen>>) {
  const hosted = yield* Layer.build(
    modelsOn({ platform: Domain.InMemory, sessions: Layer.succeed(SessionLookup, lookupSeeing(seen)) })
  )
  const worker = yield* Effect.provideContext(usageWorker, hosted)
  return answeredBy(worker.fetch)
})

/** A binding whose every request `answer` answers, as a Worker answers its `fetch`. */
const answeredBy = <E>(
  answer: Effect.Effect<HttpServerResponse.HttpServerResponse, E, HttpServerRequest.HttpServerRequest | Scope.Scope>
): ModelBinding => {
  const handler = HttpEffect.toWebHandler(answer)
  return { fetch: (input, init) => handler(new Request(input, init)) }
}

/** A binding whose every fetch fails at once, as the platform's does when the Worker it names cannot be reached. */
const unreachable: ModelBinding = {
  fetch: () => {
    throw new TypeError("Network connection lost.")
  }
}

/** The gateway's Layer over `binding`, as the site's Worker composes it. */
const gatewayOver = (binding: ModelBinding) =>
  Layer.build(ModelAllowanceOverUsage.pipe(Layer.provide(Models.overBinding(binding))))

/** A request the site's Worker is answering, from a browser signed in as Ana, with `headers` beside the cookie. */
const answering = (headers: Record<string, string>) =>
  Effect.provideService(
    HttpServerRequest.HttpServerRequest,
    HttpServerRequest.fromWeb(
      new Request("http://localhost/api/v1/assistant/view", {
        method: "POST",
        headers: { cookie: anasCookie, ...headers }
      })
    )
  )

/** One take for Ana's organization, as the table assistant asks it. */
const take = Effect.flatMap(Effect.service(ModelAllowanceGateway), (gateway) => gateway.take("view")).pipe(
  Effect.provideService(CurrentActor, ana)
)

describe("the allowance's gateway over the binding to the model's Worker", () => {
  it.effect(
    "carries the cookie and the page's member header of the request it answers, and nothing else of it",
    Effect.fnUntraced(function* () {
      const seen = MutableRef.make<ReadonlyArray<Seen>>([])
      const binding = yield* bindingTo(seen)
      const gateway = yield* gatewayOver(binding)
      const answer = yield* take.pipe(
        answering({ [pageMemberHeader]: "mem_ana/org_prairie", "x-acting-as": "mem_dana", authorization: "Bearer x" }),
        Effect.provideContext(gateway)
      )
      expect([answer, seen.current]).toEqual([
        taken,
        [{ cookie: O.some(anasCookie), pageMember: O.some("mem_ana/org_prairie"), others: [] }]
      ])
    }, Effect.scoped)
  )

  it.effect(
    "takes nothing for a page opened for somebody else, nor with no request to carry: each is a defect",
    Effect.fnUntraced(function* () {
      const seen = MutableRef.make<ReadonlyArray<Seen>>([])
      const binding = yield* bindingTo(seen)
      const gateway = yield* gatewayOver(binding)
      const elsewhere = yield* take.pipe(
        answering({ [pageMemberHeader]: "mem_marcus/org_prairie" }),
        Effect.provideContext(gateway),
        Effect.exit
      )
      const unasked = yield* take.pipe(Effect.provideContext(gateway), Effect.exit)
      // Both refused before anything was taken: the next take, carried properly, is the day's first and is taken.
      const after = yield* take.pipe(answering({}), Effect.provideContext(gateway))
      expect([Exit.hasDies(elsewhere), Exit.hasDies(unasked), after]).toEqual([true, true, taken])
      expect(A.map(seen.current, (one) => one.cookie)).toEqual([O.some(anasCookie), O.none(), O.some(anasCookie)])
    }, Effect.scoped)
  )

  it.effect(
    "answers the forty-first take of the day used up, with the sentence a person reads",
    Effect.fnUntraced(function* () {
      const seen = MutableRef.make<ReadonlyArray<Seen>>([])
      const binding = yield* bindingTo(seen)
      const gateway = yield* gatewayOver(binding)
      const answers = yield* Effect.forEach(
        A.makeBy(41, () => take),
        (one) => one.pipe(answering({}), Effect.provideContext(gateway)),
        { concurrency: 1 }
      )
      expect([A.filter(answers, (one) => one === taken).length, A.last(answers)]).toEqual([
        40,
        O.some(usedUp(usedUpSentence))
      ])
    }, Effect.scoped)
  )

  it.effect.each([
    // A binding whose fetch fails before it answers, as one to a Worker that cannot be reached does.
    { said: "cannot be reached", binding: unreachable },
    { said: "answers 500", binding: answeredBy(HttpServerResponse.empty({ status: 500 }).pipe(Effect.succeed)) }
  ])(
    "is a defect when the binding $said: the asker's request ends as a 500, as a failed count on D1 did",
    Effect.fnUntraced(function* ({ binding }) {
      const gateway = yield* gatewayOver(binding)
      const exit = yield* take.pipe(answering({}), Effect.provideContext(gateway), Effect.exit)
      expect(Exit.hasDies(exit)).toBe(true)
    }, Effect.scoped)
  )
})
