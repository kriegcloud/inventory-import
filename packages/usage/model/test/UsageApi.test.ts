// The usage model's two Apis in process, on the memory host behind the test session (`session.ts`): the server's
// sends `TakeCall` and reads nothing, a member's reads `AllowanceToday` and sends nothing. Who may read is the view's
// `validate`: every member of the key's organization, a viewer included, while the member record still holds them, and
// no one of another organization (Benjamin, 2026-11-26: "No screen yet; any member may read"). With no session, nothing is taken or read. The one thing not to
// break: a story runs no middleware and Verify reads none, so only this test shows who is let in.
import { expect, layer } from "@effect/vitest"
import { NotSignedIn } from "@inventory/kernel/AccessError"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as Fiber from "effect/Fiber"
import * as O from "effect/Option"
import * as Queue from "effect/Queue"
import * as Stream from "effect/Stream"
import { NotPermitted, AllowanceNotFound } from "../src/Allowance/Allowance.aggregate.ts"
import { UsageServerApi } from "../src/Usage.api.ts"
import { UsageMemberApi } from "../src/UsageMember.api.ts"
import { ana, as, hal, Roster, UsageTest, vic } from "./session.ts"

/**
 * What a call was refused with, or what it answered when it was taken, as a value a test compares. Here in place of
 * `Effect.flip` only until the mutants' runner reads a test that failed with no message: with `flip`, a call taken that
 * should have been refused fails the test with a value vitest's JSON report gives `null` as its message, and the
 * runner's `TestCase.failureMessages` (`S.Array(S.String)`) then refuses the whole report, so the mutant has no result.
 * The runner's fix is `S.Array(S.NullOr(S.String))`; after it this helper is plain test style, not a rule.
 */
const answerOf = <A, E, R>(call: Effect.Effect<A, E, R>): Effect.Effect<E | { readonly accepted: A }, never, R> =>
  Effect.match(call, { onFailure: (refusal) => refusal, onSuccess: (answer) => ({ accepted: answer }) })

layer(UsageTest)("UsageServerApi and UsageMemberApi", (it) => {
  it("serve TakeCall to the server only, and AllowanceToday to a member only", () => {
    expect(A.map(UsageServerApi.commands, (command) => command.tag)).toEqual(["TakeCall"])
    expect(UsageMemberApi.commands).toEqual([])
    expect(A.map(UsageMemberApi.serves, (served) => served.kind)).toEqual(["View"])
  })

  it.effect(
    "a member reads their organization's count after a call is taken, a viewer included",
    Effect.fnUntraced(function* () {
      const server = yield* UsageServerApi.clientInProcess
      const member = yield* UsageMemberApi.clientInProcess
      const first = yield* server.TakeCall({ organizationId: "org_prairie", purpose: "view" }, as(ana))
      const second = yield* server.TakeCall({ organizationId: "org_prairie", purpose: "view" }, as(vic))
      const read = yield* member.AllowanceToday.get("org_prairie", { ...as(vic), atLeast: [first, second] })
      expect(read).toMatchObject({ taken: 2 })
      const byEditor = yield* member.AllowanceToday.get("org_prairie", { ...as(ana), atLeast: [first, second] })
      expect(byEditor).toEqual(read)
    }, Effect.scoped)
  )

  it.effect(
    "with no session nothing is taken and nothing is read: NotSignedIn",
    Effect.fnUntraced(function* () {
      const server = yield* UsageServerApi.clientInProcess
      const member = yield* UsageMemberApi.clientInProcess
      const take = yield* server.TakeCall({ organizationId: "org_prairie", purpose: "view" }).pipe(answerOf)
      expect(take).toBeInstanceOf(NotSignedIn)
      const read = yield* member.AllowanceToday.get("org_prairie", { atLeast: [] }).pipe(answerOf)
      expect(read).toBeInstanceOf(NotSignedIn)
    }, Effect.scoped)
  )

  it.effect(
    "a viewer is refused the check's call NotPermitted, with the role it needs",
    Effect.fnUntraced(function* () {
      const server = yield* UsageServerApi.clientInProcess
      const refused = yield* server
        .TakeCall({ organizationId: "org_prairie", purpose: "check" }, as(vic))
        .pipe(answerOf)
      expect(refused).toBeInstanceOf(NotPermitted)
      expect(refused).toMatchObject({ required: "editor" })
    }, Effect.scoped)
  )

  it.effect(
    "a member of another organization is refused AllowanceNotFound: a take, a read and a watch of this organization's count",
    Effect.fnUntraced(function* () {
      const server = yield* UsageServerApi.clientInProcess
      const member = yield* UsageMemberApi.clientInProcess
      const taken = yield* server.TakeCall({ organizationId: "org_prairie", purpose: "view" }, as(ana))
      const take = yield* server.TakeCall({ organizationId: "org_prairie", purpose: "view" }, as(hal)).pipe(answerOf)
      expect(take).toBeInstanceOf(AllowanceNotFound)
      const read = yield* member.AllowanceToday.get("org_prairie", { ...as(hal), atLeast: [taken] }).pipe(answerOf)
      expect(read).toBeInstanceOf(AllowanceNotFound)
      const watched = yield* member.AllowanceToday.watch("org_prairie", as(hal)).pipe(Stream.runCollect, answerOf)
      expect(watched).toBeInstanceOf(AllowanceNotFound)
      // Their own organization's count is theirs to read.
      const own = yield* member.AllowanceToday.get("org_harbor", { ...as(hal), atLeast: [] })
      expect(own).toBeNull()
    }, Effect.scoped)
  )

  it.effect(
    "a member removed while watching receives nothing more: the watch ends AllowanceNotFound at the next change",
    Effect.fnUntraced(function* () {
      const server = yield* UsageServerApi.clientInProcess
      const member = yield* UsageMemberApi.clientInProcess
      const roster = yield* Roster
      const first = yield* server.TakeCall({ organizationId: "org_prairie", purpose: "view" }, as(ana))
      const seen = yield* member.AllowanceToday.get("org_prairie", { ...as(vic), atLeast: [first] })
      const delivered = yield* Queue.unbounded<unknown>()
      const watching = yield* member.AllowanceToday.watch("org_prairie", as(vic)).pipe(
        Stream.runForEach((state) => Queue.offer(delivered, state)),
        answerOf,
        Effect.forkScoped
      )
      // The watch has delivered the count as it is before the member is removed.
      const before = yield* Queue.take(delivered)
      expect(before).toMatchObject({ state: seen })
      yield* roster.remove(vic)
      yield* server.TakeCall({ organizationId: "org_prairie", purpose: "view" }, as(ana))
      const ended = yield* Fiber.join(watching)
      expect(ended).toBeInstanceOf(AllowanceNotFound)
      // The change that ended it was never delivered.
      const after = yield* Queue.clear(delivered)
      expect(after).toEqual([])
      // A new read by the removed member is refused too; a member still in reads the change.
      const read = yield* member.AllowanceToday.get("org_prairie", { ...as(vic), atLeast: [] }).pipe(answerOf)
      expect(read).toBeInstanceOf(AllowanceNotFound)
      const stillIn = yield* member.AllowanceToday.get("org_prairie", { ...as(ana), atLeast: [] })
      expect(seen).not.toBeNull()
      expect(O.map(O.fromNullOr(stillIn), (state) => state.taken)).toEqual(
        O.map(O.fromNullOr(seen), (state) => state.taken + 1)
      )
    }, Effect.scoped)
  )
})
