// One page is one member's. While who is signed in is asked again the page keeps the member it had, and a write waits
// for the answer; a write pressed for one member never goes as another; and what is typed, chosen or open is gone for
// another member or another organization, and stays for the same one.
import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Cause from "effect/Cause"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Layer from "effect/Layer"
import * as O from "effect/Option"
import * as Inspectable from "effect/Inspectable"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import * as Atom from "effect/reactivity/Atom"
import * as AtomRegistry from "effect/reactivity/AtomRegistry"
import { Member } from "@inventory/kernel/Member"
import { MemberId, OrganizationId } from "@inventory/kernel/Ids"
import { DisplayName } from "@inventory/kernel/Text"
import { makeApiAtoms, provideApi } from "@inventory/client/Api"
import {
  answeredFor,
  asPressed,
  askedOfAnswer,
  keptOfMember,
  memberOfAnswer,
  NotSentElsewhere,
  ofMember,
  provideMember,
  provideWhoIsSignedInAsked
} from "@inventory/client/MemberAtoms"

const someone = (id: string, organization: string) =>
  O.some(
    Member.make({
      id: MemberId.make(id),
      name: DisplayName.make(id),
      role: "admin",
      organizationId: OrganizationId.make(organization),
      organizationName: DisplayName.make(organization)
    })
  )
const dana = someone("mem_dana", "org_prairie")
const marcus = someone("mem_marcus", "org_prairie")

const settle = Effect.sleep("10 millis")

interface Server {
  readonly save: (what: string) => Effect.Effect<string>
}
class SaveServer extends Context.Service<SaveServer, Server>()(
  "@inventory/client/test/SignedIn.atoms.test/SaveServer"
) {}

/** A page with one write, sent as the app's client sends it, and what the server got. */
const world = () => {
  const who = Atom.make(dana).pipe(Atom.keepAlive)
  const asked = Atom.make(false).pipe(Atom.keepAlive)
  const got: Array<string> = []
  const layer = Layer.succeed(SaveServer, {
    save: Effect.fn("SaveServer.save")(
      (what: string) =>
        Effect.sync(() => {
          got.push(what)
          return what
        }),
      (send) => asPressed(send)
    )
  })
  const save = makeApiAtoms(SaveServer).write<string>()((server, what) => server.save(what), {
    reactivityKeys: O.none()
  })
  const registry = AtomRegistry.make({
    initialValues: [provideApi(layer), provideMember(who), provideWhoIsSignedInAsked(asked)]
  })
  registry.mount(save)
  return { registry, who, asked, got, save }
}

describe("a write pressed while who is signed in is asked again", () => {
  it.live("waits for the answer, and goes once it is the member who pressed it", () =>
    Effect.gen(function* () {
      const t = world()
      t.registry.set(t.asked, true)
      t.registry.set(t.save, "a name")
      yield* settle
      expect(t.got).toEqual([])
      t.registry.set(t.asked, false)
      yield* settle
      expect(t.got).toEqual(["a name"])
    })
  )

  it.live("is not sent as somebody else: it fails, saying why", () =>
    Effect.gen(function* () {
      const t = world()
      t.registry.set(t.asked, true)
      t.registry.set(t.save, "a name")
      yield* settle
      // The person's own switch of organization has answered.
      t.registry.set(t.who, someone("mem_dana_northline", "org_northline"))
      t.registry.set(t.asked, false)
      yield* settle
      const result = t.registry.get(t.save)
      expect(t.got).toEqual([])
      expect(
        AsyncResult.isFailure(result) && S.is(NotSentElsewhere)(result.cause.pipe(Cause.squash)) && !result.waiting
      ).toBe(true)
    })
  )

  it.live("goes at once when nothing is asked", () =>
    Effect.gen(function* () {
      const t = world()
      t.registry.set(t.save, "a name")
      yield* settle
      expect(t.got).toEqual(["a name"])
    })
  )
})

describe("state that is one member's", () => {
  it("starts again for another member and for another organization, and stays for the same one", () => {
    const who = Atom.make(dana).pipe(Atom.keepAlive)
    const typed = keptOfMember(() => "")
    const registry = AtomRegistry.make({ initialValues: [provideMember(who)] })
    // Written before anything reads it, as a press on a screen that is not drawn writes it.
    registry.set(typed, "hex bolt")
    // The same member, as a session asked again answers: a new object that says the same.
    registry.set(who, someone("mem_dana", "org_prairie"))
    expect(registry.get(typed)).toBe("hex bolt")
    registry.set(who, marcus)
    expect(registry.get(typed)).toBe("")
    registry.set(typed, "brass washer")
    registry.set(who, someone("mem_marcus", "org_northline"))
    expect(registry.get(typed)).toBe("")
  })
})

describe("state of a screen that is not drawn for a moment", () => {
  it("is still there for the same member, asked again meanwhile", () => {
    const who = Atom.make(dana).pipe(Atom.keepAlive)
    const typed = ofMember(() => "")
    const registry = AtomRegistry.make({ initialValues: [provideMember(who)], defaultIdleTTL: 400 })
    registry.set(typed, "hex bolt")
    // Nobody is known for a moment, and then the same member: nothing reads the state meanwhile.
    registry.set(who, O.none())
    registry.set(who, someone("mem_dana", "org_prairie"))
    expect(registry.get(typed)).toBe("hex bolt")
    registry.set(who, marcus)
    expect(registry.get(typed)).toBe("")
  })
})

describe("state kept for the page", () => {
  it.live("leaves memory the moment the member changes, though nothing reads it", () =>
    Effect.gen(function* () {
      const who = Atom.make(dana).pipe(Atom.keepAlive)
      const typed = keptOfMember(() => "")
      const registry = AtomRegistry.make({ initialValues: [provideMember(who)] })
      registry.set(typed, "hex bolt")
      const held = () =>
        A.some(A.fromIterable(registry.getNodes().values()), (node) =>
          node.valueOption().pipe(Inspectable.toStringUnknown, Str.includes("hex bolt"))
        )
      yield* settle
      expect(held()).toBe(true)
      registry.set(who, marcus)
      yield* settle
      expect(held()).toBe(false)
    })
  )
})

describe("a session's answer, as a page takes it", () => {
  const take = (before: O.Option<Member>, after: O.Option<Member>, chosen: boolean) => {
    const left: Array<string> = []
    return answeredFor({ answer: "the answer", before, after, chosen, leave: () => left.push("left") }).pipe(
      Effect.timeoutOption("5 millis"),
      Effect.map((answer) => ({ answer, left }))
    )
  }

  it.live("is the page's while the member is the same, the page had nobody, or the person chose it", () =>
    Effect.gen(function* () {
      const taken = yield* Effect.all(
        [
          take(dana, someone("mem_dana", "org_prairie"), false),
          take(O.none(), marcus, false),
          take(O.none(), O.none(), false),
          take(dana, someone("mem_dana_northline", "org_northline"), true)
        ],
        { concurrency: 1 }
      )
      expect(A.map(taken, ({ answer, left }) => [O.isSome(answer), left])).toEqual(A.makeBy(4, () => [true, []]))
    })
  )

  it.live("leaves the page, which never hears it, when it is anybody else, another organization or nobody", () =>
    Effect.gen(function* () {
      const taken = yield* Effect.all(
        [
          take(dana, marcus, false),
          take(dana, someone("mem_dana", "org_northline"), false),
          take(dana, O.none(), false)
        ],
        { concurrency: 1 }
      )
      expect(A.map(taken, ({ answer, left }) => [O.isSome(answer), left])).toEqual(A.makeBy(3, () => [false, ["left"]]))
    })
  )

  it("keeps the member it gave while the session is asked again, and when it could not be read; nobody is certain then", () => {
    const answer = AsyncResult.success<O.Option<Member>, string>(dana)
    const unread = AsyncResult.fromExitWithPrevious(Exit.fail("the network"), O.some(answer))
    const memberOf = (one: O.Option<Member>) => one
    const states = [AsyncResult.initial<O.Option<Member>, string>(true), answer, AsyncResult.waiting(answer), unread]
    expect(A.map(states, (session) => O.isSome(memberOfAnswer({ session, memberOf })))).toEqual([
      false,
      true,
      true,
      true
    ])
    expect(A.map(states, askedOfAnswer)).toEqual([true, false, true, true])
  })
})
