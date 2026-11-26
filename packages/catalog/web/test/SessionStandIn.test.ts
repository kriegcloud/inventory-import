import * as O from "effect/Option"
// The tests' page of who is signed in leaves the page where the app would: the person's own switch is their own account
// in the organization they chose, and the choice is over with the next answer, whatever it is. Anything else that is
// not the member the page has leaves it.
import { describe, expect, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { memberKey } from "@inventory/client/MemberAtoms"
import { registryFor, registryStart } from "./support/catalog.ts"
import { memberStart, memberOf, sessionStandIn } from "./support/session.ts"

const settle = Effect.sleep("10 millis")

/** Dana's page, in Prairie, and how to ask who is signed in again. */
const page = Effect.fnUntraced(function* () {
  const session = sessionStandIn(memberOf({ ...memberStart, account: "mem_dana", id: "mem_dana" }))
  const registry = registryFor({
    ...registryStart,
    endpoints: {},
    signedIn: O.some(session.signedIn),
    asked: O.some(session.asked)
  })
  registry.mount(memberKey)
  yield* settle
  const ask = () => registry.refresh(session.signedIn)
  return { session, registry, ask, who: () => registry.get(memberKey) }
})

const danaInNorthline = memberOf({
  ...memberStart,
  id: "mem_dana_northline",
  organization: "org_northline",
  account: "mem_dana"
})
const marcusInNorthline = memberOf({
  ...memberStart,
  id: "mem_marcus_northline",
  organization: "org_northline",
  account: "mem_marcus"
})

describe("the person's own switch, as the tests' page has it", () => {
  it.live("is her own account in the organization she chose: the page goes on, as her member there", () =>
    Effect.gen(function* () {
      const t = yield* page()
      t.session.choose("org_northline")
      t.ask()
      yield* settle
      yield* t.session.answer(danaInNorthline)
      yield* settle
      expect([t.session.left.times, t.who()]).toEqual([0, "mem_dana_northline/org_northline"])
    })
  )

  it.live("answered for another account in that organization: the page is left", () =>
    Effect.gen(function* () {
      const t = yield* page()
      t.session.choose("org_northline")
      t.ask()
      yield* settle
      yield* t.session.answer(marcusInNorthline)
      yield* settle
      expect([t.session.left.times, t.who()]).toEqual([1, "mem_dana/org_prairie"])
    })
  )

  it.live("is over with the answer it got: somebody else there later leaves the page", () =>
    Effect.gen(function* () {
      const t = yield* page()
      t.session.choose("org_northline")
      t.ask()
      yield* settle
      yield* t.session.answer(danaInNorthline)
      yield* settle
      t.ask()
      yield* settle
      yield* t.session.answer(marcusInNorthline)
      yield* settle
      expect(t.session.left.times).toBe(1)
    })
  )

  it.live("is over with any answer: one for the member she had ends it, and the next in Northline is not hers", () =>
    Effect.gen(function* () {
      const t = yield* page()
      t.session.choose("org_northline")
      t.ask()
      yield* settle
      yield* t.session.answer(memberOf({ ...memberStart, account: "mem_dana", id: "mem_dana" }))
      yield* settle
      t.ask()
      yield* settle
      yield* t.session.answer(danaInNorthline)
      yield* settle
      expect(t.session.left.times).toBe(1)
    })
  )
})
