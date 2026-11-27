// The usage model's `Session` on the one session lookup (access-01, access-02): the verdict's end is the call's expiry,
// so a pushed read is judged again within a minute at most and never past the session's end, and a refusal is the
// lookup's own. What it holds: the expiry a live read is given, and that a command, which has none, is judged all the
// same; the actor a call is run as is the verdict's member, role included; its spans and log lines carry ids and the
// role only; and a refused call runs nothing. What it does not hold: the socket a live read is pushed over (the
// Durable Objects host closes it at that expiry), which runs only on a deploy or under `alchemy dev`.
import { CurrentExpiry, type Expiry } from "@alchemy.run/domain/RequestContext"
import { describe, expect, it } from "@effect/vitest"
import { NotSignedIn } from "@inventory/kernel/AccessError"
import { MemberId, OrganizationId } from "@inventory/kernel/Ids"
import { Member } from "@inventory/kernel/Member"
import { SessionLookup, SessionVerdict } from "@inventory/kernel/SessionLookup"
import { CurrentActor } from "@inventory/usage-model/Actor"
import * as A from "effect/Array"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Headers from "effect/http/Headers"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as Ref from "effect/Ref"
import * as References from "effect/References"
import { asSessionMember, verdictOn } from "../src/Session.ts"

const ana = Member.make({
  id: MemberId.make("mem_ana"),
  name: "Ana Lima",
  role: "editor",
  organizationId: OrganizationId.make("org_prairie"),
  organizationName: "Example Works (test)"
})

/** A minute on from the start of the test clock, as the lookup trusts a verdict for. */
const aMinuteOn = DateTime.makeUnsafe("1970-01-01T00:01:00.000Z")

const vic = Member.make({
  id: MemberId.make("mem_vic"),
  name: "Vic Moreau",
  role: "viewer",
  organizationId: OrganizationId.make("org_harbor"),
  organizationName: "Harbor Supply (test)"
})

/** An effect run on a lookup whose verdict on every call is `member`, until a minute on. */
const judging = (member: Member) =>
  Effect.provideService(
    SessionLookup,
    SessionLookup.of({
      verdictOf: Effect.fn("SessionLookup.verdictOf")(function* () {
        return yield* Effect.succeed(
          SessionVerdict.judged({ member, at: DateTime.makeUnsafe(0), sessionEnds: O.none() })
        )
      }),
      memberNow: Effect.fn("SessionLookup.memberNow")(function* () {
        return yield* Effect.succeedSome(member)
      })
    })
  )

const anaUntilAMinuteOn = judging(ana)

/** What a call run as the session's member sees: the actor, and what its spans and log lines are annotated with. */
const seenInside = Effect.gen(function* () {
  const actor = yield* CurrentActor
  const logs = yield* References.CurrentLogAnnotations
  const spans = yield* References.TracerSpanAnnotations
  const span = yield* Effect.currentSpan
  return { actor, logs, spans, callSpan: R.fromEntries(A.fromIterable(span.attributes)) }
})

/** An effect run on a lookup that refuses every call, in its own words. */
const nobody = Effect.provideService(
  SessionLookup,
  SessionLookup.of({
    verdictOf: Effect.fn("SessionLookup.verdictOf")(function* () {
      return yield* NotSignedIn.make({ reason: "Sign in to continue." })
    }),
    memberNow: Effect.fn("SessionLookup.memberNow")(function* () {
      return yield* Effect.succeedNone
    })
  })
)

describe("the usage model's Session on the one session lookup", () => {
  it.effect(
    "gives a live read the verdict's end as its expiry",
    Effect.fnUntraced(function* () {
      const expiry: Expiry = { at: undefined }
      const verdict = yield* verdictOn(Headers.empty).pipe(
        Effect.provideService(CurrentExpiry, expiry),
        anaUntilAMinuteOn
      )
      expect(verdict.member).toEqual(ana)
      expect(expiry.at).toBe(aMinuteOn.pipe(DateTime.toEpochMillis))
    })
  )

  it.effect(
    "keeps an earlier expiry another middleware set: one verdict never extends another",
    Effect.fnUntraced(function* () {
      const expiry: Expiry = { at: 30_000 }
      yield* verdictOn(Headers.empty).pipe(Effect.provideService(CurrentExpiry, expiry), anaUntilAMinuteOn)
      expect(expiry.at).toBe(30_000)
    })
  )

  it.effect(
    "judges a command, which has no expiry, all the same",
    Effect.fnUntraced(function* () {
      const verdict = yield* verdictOn(Headers.empty).pipe(anaUntilAMinuteOn)
      expect(verdict.until).toEqual(aMinuteOn)
    })
  )

  it.effect(
    "refuses in the lookup's words, and sets no expiry",
    Effect.fnUntraced(function* () {
      const expiry: Expiry = { at: undefined }
      const refused = yield* verdictOn(Headers.empty).pipe(
        Effect.provideService(CurrentExpiry, expiry),
        nobody,
        Effect.flip
      )
      expect(refused).toEqual(NotSignedIn.make({ reason: "Sign in to continue." }))
      expect(expiry.at).toBeUndefined()
    })
  )
})

describe("a call run as the session's member", () => {
  it.effect.each([ana, vic])(
    "acts as $role $id of $organizationId, as the verdict says, and as nobody a header names",
    Effect.fnUntraced(function* (member) {
      const seen = yield* asSessionMember(seenInside, Headers.empty).pipe(judging(member), Effect.orDie)
      expect(seen.actor).toEqual({ organizationId: member.organizationId, memberId: member.id, role: member.role })
    })
  )

  it.effect(
    "annotates its span, and every span and log line inside it, with the ids and the role only",
    Effect.fnUntraced(function* () {
      const seen = yield* asSessionMember(seenInside, Headers.empty).pipe(judging(vic), Effect.orDie)
      const ids = { "actor.id": vic.id, "actor.role": vic.role, "organization.id": vic.organizationId }
      expect(seen.logs).toEqual(ids)
      expect(seen.spans).toEqual(ids)
      expect(seen.callSpan).toMatchObject(ids)
      // No name of the member's or of their organization reaches the call's span.
      expect(R.values(seen.callSpan)).not.toContain(vic.name)
      expect(R.values(seen.callSpan)).not.toContain(vic.organizationName)
    })
  )

  it.effect(
    "runs nothing for a call the lookup refuses",
    Effect.fnUntraced(function* () {
      const ran = yield* Ref.make(false)
      const refused = yield* asSessionMember(Ref.set(ran, true), Headers.empty).pipe(nobody, Effect.flip)
      expect(refused).toEqual(NotSignedIn.make({ reason: "Sign in to continue." }))
      const didRun = yield* Ref.get(ran)
      expect(didRun).toBe(false)
    })
  )
})
