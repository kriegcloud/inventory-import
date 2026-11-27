// What the one session lookup and the `/api/v1` `Identity` middleware put on their spans about who acts: the ids and
// the role, never a name or an email. Sent through a real HttpApi in memory with one endpoint behind `Identity`, over
// the in-memory twins and a Better Auth with Dana signed in, and a tracer that records every span.
import { AuthEmail, AuthOrganizationId, AuthSession, AuthUserId } from "@beep/better-auth/BetterAuthSession"
import { BetterAuthTest } from "@beep/better-auth/BetterAuthTest"
import { expect, layer } from "@effect/vitest"
import { AccountEmail } from "@inventory/access-contract/SessionState"
import { SessionIdentityLive } from "@inventory/access-host/SessionIdentity"
import { SessionLookupLive } from "@inventory/access-host/SessionLookup"
import { accessMemory } from "@inventory/access-model/Memory"
import { CurrentActor } from "@inventory/kernel/Actor"
import { Identity } from "@inventory/kernel/Identity"
import { MemberId, OrganizationId, UserId } from "@inventory/kernel/Ids"
import { Member } from "@inventory/kernel/Member"
import { SessionLookup } from "@inventory/kernel/SessionLookup"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as Formatter from "effect/Formatter"
import * as Layer from "effect/Layer"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import * as Tracer from "effect/Tracer"
import * as Headers from "effect/http/Headers"
import * as HttpServer from "effect/http/HttpServer"
import * as HttpApi from "effect/http-api/HttpApi"
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder"
import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint"
import * as HttpApiGroup from "effect/http-api/HttpApiGroup"
import * as HttpApiTest from "effect/http-api/HttpApiTest"

const dana = Member.make({
  id: MemberId.make("mem_dana"),
  name: "Dana Whitfield",
  role: "editor",
  organizationId: OrganizationId.make("org_prairie"),
  organizationName: "Example Works (test)"
})

const twins = accessMemory({
  accounts: [
    { userId: UserId.make("usr_mem_dana"), name: "Dana Whitfield", email: AccountEmail.make("dana@example.com") }
  ],
  memberships: [{ member: dana, userId: O.some(UserId.make("usr_mem_dana")), joinedAt: O.none(), removed: false }]
})

const danaSignedIn = BetterAuthTest.signedIn(
  AuthSession.make({
    userId: AuthUserId.make("usr_mem_dana"),
    email: AuthEmail.make("dana@example.com"),
    activeOrganizationId: O.some(AuthOrganizationId.make("org_prairie"))
  })
)

/** One endpoint behind `Identity`, whose handler opens a span of its own: what a real endpoint's service call is. */
class ProbeApi extends HttpApi.make("probe").add(
  HttpApiGroup.make("probe")
    .add(HttpApiEndpoint.get("who", "/who", { success: S.String }))
    .middleware(Identity)
) {}

const ProbeLive = HttpApiBuilder.group(ProbeApi, "probe", (handlers) =>
  handlers.handle("who", () =>
    Effect.gen(function* () {
      const actor = yield* CurrentActor
      return yield* Effect.succeed(actor.id).pipe(Effect.withSpan("Probe.inside"))
    })
  )
)

const ended: Array<Tracer.NativeSpan> = []
const Recording = Layer.succeed(
  Tracer.Tracer,
  Tracer.make({
    span: (options) => {
      const span = new Tracer.NativeSpan(options)
      ended.push(span)
      return span
    }
  })
)

const spansNamed = (name: string) => A.filter(ended, (span) => span.name === name)

/** Holds that a span carries who acts as ids and the role, and nothing of their name. */
const carriesIdsOnly = (span: Tracer.NativeSpan) => {
  expect([
    span.attributes.get("actor.id"),
    span.attributes.get("actor.role"),
    span.attributes.get("organization.id")
  ]).toEqual(["mem_dana", "editor", "org_prairie"])
  expect(Formatter.format([...span.attributes.values()])).not.toContain("Dana Whitfield")
  expect(Formatter.format([...span.attributes.values()])).not.toContain("dana@example.com")
}

const services = Layer.merge(twins, danaSignedIn)

layer(
  Layer.mergeAll(
    ProbeLive.pipe(Layer.provideMerge(SessionIdentityLive)),
    SessionLookupLive,
    HttpServer.layerServices
  ).pipe(Layer.provide(services), Layer.provideMerge(Recording))
)("who acts, on the spans", (it) => {
  it.effect("the lookup's own span carries the ids and the role", () =>
    Effect.gen(function* () {
      const sessions = yield* SessionLookup
      yield* sessions.verdictOf(Headers.empty)
      const lookups = spansNamed("SessionLookup.verdictOf")
      expect(A.length(lookups)).toBeGreaterThan(0)
      A.forEach(lookups, carriesIdsOnly)
    })
  )

  it.effect("the Identity span and every span inside the request carry them too", () =>
    Effect.gen(function* () {
      const client = yield* HttpApiTest.groups(ProbeApi, ["probe"])
      const who = yield* client.probe.who()
      expect(who).toBe("mem_dana")
      const identity = spansNamed("Identity")
      const inside = spansNamed("Probe.inside")
      expect([A.length(identity), A.length(inside)]).toEqual([1, 1])
      A.forEach([...identity, ...inside], carriesIdsOnly)
    })
  )
})
