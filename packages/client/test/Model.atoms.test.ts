// A model's Api through the kit's atoms, on a small model hosted in memory. The rules that would hurt if wrong: one
// press is one command, and its resend after a lost answer carries the same command id, so the model decides it once;
// a watched key changes on every open page when anyone's command changes it, with nothing asked again; a key the view
// refuses ends in the view's own refusal; a watch is opened on the page's member's own client, with the member's id in
// the socket's address, and closed the moment the page leaves that member, so another member starts from nothing and
// no socket stays open for the one it left; a watch kept for the same member is closed when its five minutes run out
// or `forgetReads` lets go of every read; and a watch the server closes to judge it again (code 4000) carries on, with
// nothing on the page failing.
import { type CounterId, CounterIds, CountingApi, CountingHost, judging, TooHigh } from "./Counting.fixture"
import * as Domain from "@alchemy.run/domain"
import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer"
import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Cause from "effect/Cause"
import * as Context from "effect/Context"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as HttpClientError from "effect/http/HttpClientError"
import * as Headers from "effect/http/Headers"
import * as HttpClientRequest from "effect/http/HttpClientRequest"
import * as HttpServer from "effect/http/HttpServer"
import * as HttpServerRequest from "effect/http/HttpServerRequest"
import * as Layer from "effect/Layer"
import * as MutableRef from "effect/MutableRef"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import * as Atom from "effect/reactivity/Atom"
import * as AtomRegistry from "effect/reactivity/AtomRegistry"
import * as RpcClientError from "effect/rpc/RpcClientError"
import * as Schedule from "effect/Schedule"
import * as S from "effect/Schema"
import * as Socket from "effect/socket/Socket"
import * as Str from "effect/String"
import * as Stream from "effect/Stream"
import { vi } from "vitest"
import { forgetReads, heldReadMembers, keepUnwatched, makeHolds, provideApi } from "@inventory/client/Api"
import { modelHttpClient } from "@inventory/client/Http"
import {
  keyOfMember,
  memberKey,
  NotSentElsewhere,
  provideMember,
  provideWhoIsSignedInAsked
} from "@inventory/client/MemberAtoms"
import { NotSignedIn } from "@inventory/kernel/AccessError"
import { makeModelAtoms } from "@inventory/client/Model"
import { MemberId, OrganizationId } from "@inventory/kernel/Ids"
import { Member } from "@inventory/kernel/Member"
import { DisplayName } from "@inventory/kernel/Text"

interface BumpInput {
  readonly counterId: CounterId
  readonly by: number
}

/** Every watch a page opens and closes, by whom it was opened for: the member its own client was made for. */
class Watches extends Context.Service<
  Watches,
  {
    readonly opened: MutableRef.MutableRef<ReadonlyArray<string>>
    readonly closed: MutableRef.MutableRef<ReadonlyArray<string>>
  }
>()("@inventory/client/test/Model.atoms.test/Watches") {}

/**
 * One member's client of the hosted model, made for each live read: it writes down in the page's `Watches` whom each
 * watch of a counter was opened for, when it opens and when it closes.
 */
const watchingFor = (who: O.Option<Member>) =>
  Layer.effect(
    CountingApi.Client,
    Effect.gen(function* () {
      const watches = yield* Watches
      const api = yield* CountingApi.client
      const as = keyOfMember(who)
      const watch: typeof api.CounterTotal.watch = (key, options) =>
        Stream.unwrap(
          Effect.sync(() => {
            MutableRef.update(watches.opened, A.append(as))
            return api.CounterTotal.watch(key, options).pipe(
              Stream.ensuring(Effect.sync(() => MutableRef.update(watches.closed, A.append(as))))
            )
          })
        )
      return { ...api, CounterTotal: { ...api.CounterTotal, watch } }
    })
  ).pipe(Layer.provide(Domain.protocolInProcess(CountingApi)))

const counting = makeModelAtoms(CountingApi.Client, { liveClient: watchingFor })
const bump = counting.command<BumpInput>()((api, input, sent) => api.Bump(input, sent), { reactivityKeys: O.none() })
/** The same command, naming what it changes for the HTTP reads that show it. */
const bumpShown = counting.command<BumpInput>()((api, input, sent) => api.Bump(input, sent), {
  reactivityKeys: O.some(["counter totals"])
})
const total = counting.watched((api, counter: CounterId) => api.CounterTotal.watch(counter))

/** Where the model is served, for a member's socket. */
class Served extends Context.Service<Served, { readonly url: string }>()(
  "@inventory/client/test/Model.atoms.test/Served"
) {}

/**
 * The model's live reads over WebSockets, each on a client made for the member with the member's id in its address,
 * as the app wires it. The path is this test's; the site's Worker reads it at web-02.
 */
const overSockets = makeModelAtoms(CountingApi.Client, {
  liveClient: (who) =>
    Effect.service(Served).pipe(
      Effect.map((served) =>
        CountingApi.layerClientWebSocket(
          O.match(who, { onNone: () => served.url, onSome: (one) => `${served.url}/${one.id}` })
        )
      ),
      Layer.unwrap
    )
})
const totalOverSockets = overSockets.watched((api, counter: CounterId) => api.CounterTotal.watch(counter))

const memberOf = (id: string, organization: string) =>
  O.some(
    Member.make({
      id: MemberId.make(id),
      name: DisplayName.make("Dana Whitfield"),
      role: "admin",
      organizationId: OrganizationId.make(organization),
      organizationName: DisplayName.make(organization)
    })
  )

const noExpiry = O.none<Duration.Duration>()
const letGoAtOnce = O.none<number>()
const everySecond = O.some(Duration.seconds(1))

/** What `look` finds, once it finds it: asked every 10 ms, for 5 s at most. */
const until = <A>(look: () => O.Option<A>): Effect.Effect<A, Cause.NoSuchElementError> =>
  Effect.suspend(() => Effect.fromOption(look())).pipe(
    Effect.retry({ schedule: Schedule.spaced("10 millis"), times: 500 })
  )

/**
 * Runs `body` with the timers and the clock faked, but moving with real time, so everything waits as it would and a
 * test can also make the five minutes a read nobody looks at is kept pass at once (`fiveMinutesPass`).
 */
const withJumps = <A, E, R>(body: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
  Effect.acquireUseRelease(
    Effect.sync(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"], shouldAdvanceTime: true })),
    () => body,
    () => Effect.sync(() => vi.useRealTimers())
  )

/** The five minutes a read nobody looks at is kept pass, and a second more. */
const fiveMinutesPass = Effect.promise(() => vi.advanceTimersByTimeAsync(keepUnwatched + 1_000))

/** The model hosted once, its reads judged by `judge`: every client a test connects reaches this one host. */
const hosted = (judge: ReturnType<typeof judging>) => Layer.build(Layer.merge(CountingHost, judge.layer))

type Host = Effect.Success<ReturnType<typeof hosted>>

/**
 * A client of `host` that writes down the command id of every `Bump` it sends; with `losing`, its first send reaches
 * the model and then loses its answer, as a dropped connection does.
 */
const recording = (host: Host, losing: boolean) => {
  const sent = MutableRef.make<ReadonlyArray<string>>([])
  const lostAnswer = RpcClientError.RpcClientError.make({
    reason: HttpClientError.HttpClientErrorSchema.fromHttpClientError(
      new HttpClientError.HttpClientError({
        reason: new HttpClientError.TransportError({
          request: HttpClientRequest.post("http://localhost/api"),
          cause: new TypeError("Failed to fetch")
        })
      })
    )
  })
  const layer = Layer.effect(
    CountingApi.Client,
    Effect.map(CountingApi.client, (api) => {
      const send: typeof api.Bump = (input, options) =>
        Effect.suspend(() => {
          MutableRef.update(sent, A.append(String(options?.commandId)))
          const once = api.Bump(input, options)
          return losing && sent.current.length === 1 ? Effect.andThen(once, Effect.fail(lostAnswer)) : once
        })
      return { ...api, Bump: send }
    })
  ).pipe(Layer.provide(Domain.protocolInProcess(CountingApi)), Layer.provide(Layer.succeedContext(host)))
  return { sent, layer }
}

/**
 * A page: its own registry, signed in as `who`, with its own client of the model. `idle` is how long the registry
 * keeps an atom nobody reads (the app's is 400 ms); with none it lets it go at once.
 */
const page = <R>(clientLayer: Layer.Layer<R>, who: ReturnType<typeof memberOf>, idle: O.Option<number>) => {
  const signedIn = Atom.make(who)
  const registry = AtomRegistry.make({
    initialValues: [provideApi(clientLayer), provideMember(signedIn)],
    ...R.getSomes({ defaultIdleTTL: idle })
  })
  return { registry, signedIn }
}

/**
 * What a page of the hosted model is given: the client its commands go through, and what each member's own client of
 * a live read is made from (the hosted model, and the page's `Watches`, which `opened` and `closed` read).
 */
const served = (host: Host) => {
  const opened = MutableRef.make<ReadonlyArray<string>>([])
  const closed = MutableRef.make<ReadonlyArray<string>>([])
  const layer = Layer.mergeAll(
    CountingApi.layerClientInProcess.pipe(Layer.provide(Layer.succeedContext(host))),
    Layer.succeedContext(host),
    Layer.succeed(Watches, { opened, closed })
  )
  return { opened, closed, layer }
}

/** The app's registry lets an atom nobody reads go 400 ms later: what "at once" is measured against. */
const appIdle = O.some(400)

/** The total a watched counter shows now, if it shows one. */
const shown = (registry: AtomRegistry.AtomRegistry, counter: CounterId): O.Option<number> =>
  O.flatMap(AsyncResult.value(registry.get(total(counter))), (snapshot) =>
    O.map(O.fromNullishOr(snapshot.state), (state) => state.total)
  )

/** The watched counter's total, once it is `expected`. */
const showsTotal = (registry: AtomRegistry.AtomRegistry, counter: CounterId, expected: number) =>
  until(() => O.filter(shown(registry, counter), (now) => now === expected))

/** The watched counter's first snapshot, once it has one. */
const firstSnapshot = (registry: AtomRegistry.AtomRegistry, counter: CounterId) =>
  until(() => AsyncResult.value(registry.get(total(counter))))

/** The command's result, once it has one other than `before`. */
const answered = <A, E>(
  registry: AtomRegistry.AtomRegistry,
  before: O.Option<unknown>,
  command: Atom.Atom<AsyncResult.AsyncResult<A, E>>
) =>
  until(() => {
    const now = registry.get(command)
    return AsyncResult.isSuccess(now) && !now.waiting && !O.contains(before, now.value) ? O.some(now.value) : O.none()
  })

/** A counter's total as the model holds it once it has applied `receipt`, read past the atoms. */
const totalHeld = (host: Host, counter: CounterId, receipt: { readonly stream: string; readonly version: number }) =>
  Effect.flatMap(CountingApi.clientInProcess, (api) => api.CounterTotal.get(counter, { atLeast: [receipt] })).pipe(
    Effect.provideContext(host),
    Effect.scoped
  )

/**
 * A page of `counter` for Dana, its registry letting an atom nobody reads go 50 ms later, with the counter bumped to 1
 * and shown: what the tests of a watch kept for the same member start from. `leave` is the screen leaving it.
 */
const lookingAt = Effect.fn("lookingAt")(function* (counter: CounterId) {
  // What other tests left held, let go, so the held members read below are this test's only.
  forgetReads()
  const host = yield* hosted(noExpiry.pipe(judging))
  const client = served(host)
  const { registry, signedIn } = page(client.layer, memberOf("mem_dana", "org_prairie"), O.some(50))
  registry.mount(bump)
  const leave = registry.mount(total(counter))
  registry.set(bump, { counterId: counter, by: 1 })
  yield* showsTotal(registry, counter, 1)
  return { client, registry, signedIn, leave }
})

describe("a model's command", () => {
  it.live("is one command per press: each press is decided once, under its own command id", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const host = yield* hosted(noExpiry.pipe(judging))
        const client = recording(host, false)
        const { registry } = page(client.layer, memberOf("mem_dana", "org_prairie"), letGoAtOnce)
        registry.mount(bump)
        const counter = CounterIds.press
        registry.set(bump, { counterId: counter, by: 2 })
        const first = yield* answered(registry, O.none(), bump)
        registry.set(bump, { counterId: counter, by: 3 })
        const second = yield* answered(registry, O.some(first), bump)
        // Two presses, two ids, two events: the view folded both.
        expect([first.version, second.version, A.dedupe(client.sent.current).length]).toEqual([1, 2, 2])
        const held = yield* totalHeld(host, counter, second)
        expect(held).toEqual({ total: 5 })
      })
    )
  )

  it.live("is sent again with the same command id after a failure that may pass, and decided once", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const host = yield* hosted(noExpiry.pipe(judging))
        const client = recording(host, true)
        const { registry } = page(client.layer, memberOf("mem_dana", "org_prairie"), letGoAtOnce)
        registry.mount(bump)
        const counter = CounterIds.resend
        registry.set(bump, { counterId: counter, by: 7 })
        const receipt = yield* answered(registry, O.none(), bump)
        // Sent twice, with one id: the second answer is the first receipt, of the one event.
        expect([client.sent.current.length, A.dedupe(client.sent.current).length, receipt.version]).toEqual([2, 1, 1])
        const held = yield* totalHeld(host, counter, receipt)
        expect(held).toEqual({ total: 7 })
      })
    )
  )

  it.live("asks again the HTTP reads that show what it changed, once it succeeds", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const host = yield* hosted(noExpiry.pipe(judging))
        const { registry } = page(served(host).layer, memberOf("mem_dana", "org_prairie"), letGoAtOnce)
        // A read that shows the counter totals, counting how often it is asked.
        const asked = MutableRef.make(0)
        const totals = counting.query(() => Effect.sync(() => MutableRef.incrementAndGet(asked)), {
          keep: "unwatched",
          reactivityKeys: O.some(["counter totals"])
        })
        registry.mount(totals)
        registry.mount(bumpShown)
        const askedFirst = yield* until(() => AsyncResult.value(registry.get(totals)))
        registry.set(bumpShown, { counterId: CounterIds.asked, by: 1 })
        yield* answered(registry, O.none(), bumpShown)
        const askedAfter = yield* until(() => O.filter(AsyncResult.value(registry.get(totals)), (now) => now > 1))
        expect([askedFirst, askedAfter]).toEqual([1, 2])
      })
    )
  )
})

describe("a watched key", () => {
  it.live("changes on another member's open page when a command changes it, with nothing asked again", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const host = yield* hosted(noExpiry.pipe(judging))
        const dana = page(served(host).layer, memberOf("mem_dana", "org_prairie"), letGoAtOnce)
        const sam = page(served(host).layer, memberOf("mem_sam", "org_prairie"), letGoAtOnce)
        const counter = CounterIds.shared
        dana.registry.mount(bump)
        const looking = sam.registry.mount(total(counter))
        yield* firstSnapshot(sam.registry, counter)
        dana.registry.set(bump, { counterId: counter, by: 4 })
        const four = yield* showsTotal(sam.registry, counter, 4)
        dana.registry.set(bump, { counterId: counter, by: 6 })
        const ten = yield* showsTotal(sam.registry, counter, 10)
        expect([four, ten]).toEqual([4, 10])
        looking()
      })
    )
  )

  it.live("ends in the view's own refusal once the key may no longer be read", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const host = yield* hosted(noExpiry.pipe(judging))
        const { registry } = page(served(host).layer, memberOf("mem_dana", "org_prairie"), letGoAtOnce)
        const counter = CounterIds.refused
        registry.mount(bump)
        const looking = registry.mount(total(counter))
        registry.set(bump, { counterId: counter, by: 60 })
        yield* showsTotal(registry, counter, 60)
        registry.set(bump, { counterId: counter, by: 50 })
        const refused = yield* until(() => {
          const now = registry.get(total(counter))
          return AsyncResult.isFailure(now) ? O.some(now.cause.pipe(Cause.squash)) : O.none()
        })
        expect(refused).toBeInstanceOf(TooHigh)
        looking()
      })
    )
  )

  it.live("is opened for the page's member, closed at once for the organization it left, and starts from nothing", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const host = yield* hosted(noExpiry.pipe(judging))
        const client = served(host)
        const { registry, signedIn } = page(client.layer, memberOf("mem_lee", "org_prairie"), appIdle)
        const counter = CounterIds.switched
        registry.mount(bump)
        const looking = registry.mount(total(counter))
        registry.set(bump, { counterId: counter, by: 9 })
        yield* showsTotal(registry, counter, 9)
        registry.set(signedIn, memberOf("mem_lee", "org_harbor"))
        // The other organization's read: waiting, with nothing of the last one's state.
        const switched = registry.get(total(counter))
        expect([switched.waiting, switched.pipe(AsyncResult.value, O.isNone)]).toEqual([true, true])
        // Well within the 400 ms the registry keeps an atom nobody reads: the left organization's watch is closed.
        yield* Effect.sleep("100 millis")
        expect([client.opened.current, client.closed.current]).toEqual([
          ["mem_lee/org_prairie", "mem_lee/org_harbor"],
          ["mem_lee/org_prairie"]
        ])
        expect(heldReadMembers()).not.toContain("mem_lee/org_prairie")
        const again = yield* showsTotal(registry, counter, 9)
        expect(again).toBe(9)
        looking()
        forgetReads()
      })
    )
  )

  it.live("kept while nobody looks, is closed at once when the person signs out or another signs in", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const { client, registry, signedIn, leave } = yield* lookingAt(CounterIds.left)
        const counter = CounterIds.left
        const dana = memberOf("mem_dana", "org_prairie")
        // The person leaves the screen: for the same member the watch is kept open.
        leave()
        yield* Effect.sleep("300 millis")
        expect([client.closed.current, heldReadMembers()]).toEqual([[], ["mem_dana/org_prairie"]])
        // Signed out: the watch nobody looks at is closed, without waiting for its five minutes or a `forgetReads`.
        registry.set(signedIn, O.none())
        yield* Effect.sleep("100 millis")
        expect([client.closed.current, heldReadMembers()]).toEqual([["mem_dana/org_prairie"], []])
        // Signed in again as somebody else and back: each member's is opened anew and closed when the page leaves them.
        registry.set(signedIn, memberOf("mem_sam", "org_prairie"))
        const looking = registry.mount(total(counter))
        yield* showsTotal(registry, counter, 1)
        registry.set(signedIn, dana)
        yield* Effect.sleep("100 millis")
        looking()
        expect([client.opened.current, client.closed.current]).toEqual([
          ["mem_dana/org_prairie", "mem_sam/org_prairie", "mem_dana/org_prairie"],
          ["mem_dana/org_prairie", "mem_sam/org_prairie"]
        ])
        forgetReads()
      })
    )
  )

  it.live("kept while nobody looks, is closed when `forgetReads` lets go of every read", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const { client, leave } = yield* lookingAt(CounterIds.forgotten)
        leave()
        yield* Effect.sleep("300 millis")
        expect([client.closed.current, heldReadMembers()]).toEqual([[], ["mem_dana/org_prairie"]])
        // What a sign-out from the page does (`leavePage`): the watch kept for the same member is closed now.
        forgetReads()
        yield* Effect.sleep("100 millis")
        expect([client.closed.current, heldReadMembers()]).toEqual([["mem_dana/org_prairie"], []])
      })
    )
  )

  it.live("let go by `forgetReads` while it is looked at, is not kept when the screen then leaves it", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const dana = "mem_dana/org_prairie"
        const { client, leave } = yield* lookingAt(CounterIds.forgottenLooked)
        // `leavePage` lets go of every read, and then the screen leaves: the watch let go is closed, and none is opened
        // again for the person the page is leaving, so nothing is kept.
        forgetReads()
        leave()
        yield* Effect.sleep("300 millis")
        expect([client.opened.current, client.closed.current, heldReadMembers()]).toEqual([[dana], [dana], []])
      })
    )
  )

  it.live(
    "let go by `forgetReads` while the screen shows it, is closed, and none is opened until it is refreshed",
    () =>
      Effect.scoped(
        Effect.gen(function* () {
          const counter = CounterIds.forgottenShown
          const dana = "mem_dana/org_prairie"
          const { client, registry, leave } = yield* lookingAt(counter)
          // The screen still shows it: the watch is closed all the same, and the screen waits, with nothing of its state.
          forgetReads()
          yield* Effect.sleep("100 millis")
          const waiting = registry.get(total(counter))
          expect([client.opened.current, client.closed.current, AsyncResult.isInitial(waiting)]).toEqual([
            [dana],
            [dana],
            true
          ])
          // A change pushed meanwhile opens nothing for the member the page is leaving.
          registry.set(bump, { counterId: counter, by: 2 })
          yield* answered(registry, O.none(), bump)
          yield* Effect.sleep("100 millis")
          expect([client.opened.current, shown(registry, counter)]).toEqual([[dana], O.none()])
          // A refresh opens one watch again, which shows the state as it is now.
          registry.refresh(total(counter))
          const again = yield* showsTotal(registry, counter, 3)
          expect([again, client.opened.current, client.closed.current]).toEqual([3, [dana, dana], [dana]])
          leave()
          forgetReads()
        })
      )
  )

  it.live("let go by `forgetReads` while the screen shows it, opens a watch for the next member the page has", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const counter = CounterIds.forgottenShown
        const { client, registry, signedIn, leave } = yield* lookingAt(counter)
        forgetReads()
        yield* Effect.sleep("100 millis")
        registry.set(signedIn, memberOf("mem_sam", "org_prairie"))
        const now = yield* showsTotal(registry, counter, 1)
        expect([now, client.opened.current, client.closed.current]).toEqual([
          1,
          ["mem_dana/org_prairie", "mem_sam/org_prairie"],
          ["mem_dana/org_prairie"]
        ])
        leave()
        forgetReads()
      })
    )
  )

  it.live("kept while nobody looks, is closed when its five minutes run out, and a return opens it anew", () =>
    Effect.gen(function* () {
      const counter = CounterIds.expired
      const { client, registry, leave } = yield* lookingAt(counter)
      leave()
      yield* Effect.sleep("300 millis")
      expect([client.closed.current, heldReadMembers()]).toEqual([[], ["mem_dana/org_prairie"]])
      yield* fiveMinutesPass
      yield* Effect.sleep("100 millis")
      // Nothing holds it any more, and nothing names the member it was held for.
      expect([client.closed.current, heldReadMembers()]).toEqual([["mem_dana/org_prairie"], []])
      const back = registry.mount(total(counter))
      yield* showsTotal(registry, counter, 1)
      back()
      expect(client.opened.current).toEqual(["mem_dana/org_prairie", "mem_dana/org_prairie"])
      forgetReads()
    }).pipe(Effect.scoped, withJumps)
  )

  it.live("looked at again, is no longer held: its five minutes run only while nobody looks", () =>
    Effect.gen(function* () {
      const counter = CounterIds.returned
      const { client, registry, leave } = yield* lookingAt(counter)
      leave()
      yield* Effect.sleep("300 millis")
      const back = registry.mount(total(counter))
      yield* Effect.sleep("100 millis")
      // Five minutes on a screen that shows it: the watch is the same one, still the member's.
      yield* fiveMinutesPass
      yield* Effect.sleep("100 millis")
      expect([client.closed.current, heldReadMembers()]).toEqual([[], ["mem_dana/org_prairie"]])
      // The screen leaves it again: kept, as on the first leave.
      back()
      yield* Effect.sleep("300 millis")
      expect([client.opened.current, client.closed.current, heldReadMembers()]).toEqual([
        ["mem_dana/org_prairie"],
        [],
        ["mem_dana/org_prairie"]
      ])
      forgetReads()
    }).pipe(Effect.scoped, withJumps)
  )

  it.live("is kept open while nobody looks, so a return shows its state at once, with the watch not opened again", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const judge = noExpiry.pipe(judging)
        const host = yield* hosted(judge)
        // The registry lets an atom nobody reads go 50 ms later (the app's: 400 ms).
        const { registry } = page(served(host).layer, memberOf("mem_dana", "org_prairie"), O.some(50))
        const counter = CounterIds.kept
        registry.mount(bump)
        const leave = registry.mount(total(counter))
        registry.set(bump, { counterId: counter, by: 5 })
        yield* showsTotal(registry, counter, 5)
        const judgedBefore = judge.judged.current
        // The person leaves the screen; meanwhile someone changes the counter; the person comes back.
        leave()
        yield* Effect.sleep("300 millis")
        const before = registry.get(bump)
        registry.set(bump, { counterId: counter, by: 2 })
        yield* answered(registry, AsyncResult.value(before), bump)
        yield* Effect.sleep("100 millis")
        const back = registry.mount(total(counter))
        // At once: the state the watch kept following while nobody looked, never a skeleton, from the same watch.
        expect([shown(registry, counter), judge.judged.current - judgedBefore]).toEqual([O.some(7), 0])
        back()
        forgetReads()
      })
    )
  )

  it.live(
    "carries on when the server closes it to judge it again, every socket with the member's id in its address",
    () =>
      Effect.scoped(
        Effect.gen(function* () {
          // The model served over HTTP and WebSockets on a local port, its reads judged with a verdict that holds for
          // one second (the server's floor), so the server closes each open read every second with code 4000.
          const judge = judging(everySecond)
          const host = yield* hosted(judge)
          const { fetch } = yield* CountingApi.pipe(Effect.provideContext(host))
          // The address of every socket the server is asked to open.
          const upgrades = MutableRef.make<ReadonlyArray<string>>([])
          const recorded = Effect.gen(function* () {
            const request = yield* HttpServerRequest.HttpServerRequest
            if (Headers.has(request.headers, "upgrade")) MutableRef.update(upgrades, A.append(request.url))
            return yield* fetch
          })
          const server = yield* Layer.build(NodeHttpServer.layerTest)
          yield* HttpServer.serveEffect()(recorded.pipe(Effect.interruptible)).pipe(Effect.provideContext(server))
          const url = yield* HttpServer.addressFormattedWith(Effect.succeed).pipe(Effect.provideContext(server))
          const sockets = Layer.merge(modelHttpClient, Socket.layerWebSocketConstructorGlobal)
          // The page's own client, for its commands, is at the address every member shares.
          const clientLayer = Layer.mergeAll(
            CountingApi.layerClientWebSocket(url).pipe(Layer.provide(sockets)),
            sockets,
            Layer.succeed(Served, { url })
          )
          const { registry } = page(clientLayer, memberOf("mem_dana", "org_prairie"), letGoAtOnce)
          const counter = CounterIds.judged
          const seen: Array<AsyncResult.AsyncResult<unknown, unknown>> = []
          registry.mount(bump)
          const looking = registry.subscribe(totalOverSockets(counter), (now) => seen.push(now), { immediate: true })
          yield* until(() => AsyncResult.value(registry.get(totalOverSockets(counter))))
          const judgedAtOpen = judge.judged.current
          // Two verdicts later: the server closed the read twice, and the client opened it again each time. Waited
          // for, not slept: about two seconds, within `until`'s five.
          const judgedAgain = yield* until(() =>
            O.liftPredicate(judge.judged.current - judgedAtOpen, (again) => again >= 2)
          )
          registry.set(bump, { counterId: counter, by: 3 })
          const after = yield* until(() =>
            O.filter(
              O.flatMap(AsyncResult.value(registry.get(totalOverSockets(counter))), (snapshot) =>
                O.map(O.fromNullishOr(snapshot.state), (state) => state.total)
              ),
              (now) => now === 3
            )
          )
          expect([judgedAgain >= 2, after, A.filter(seen, AsyncResult.isFailure)]).toEqual([true, 3, []])
          // Every socket, the first and each one opened again, at the member's own address.
          expect([
            upgrades.current.length >= 3,
            A.filter(upgrades.current, (address) => !Str.startsWith("/mem_dana?")(address))
          ]).toEqual([true, []])
          looking()
        })
      )
  )
})

describe("a live read's hold", () => {
  it.live("holds nothing for a member the page has already left, and says so to the read", () =>
    Effect.gen(function* () {
      const { registry } = page(Layer.empty, memberOf("mem_dana", "org_prairie"), letGoAtOnce)
      // The page has heard who is signed in now before the read it left is let go.
      expect(registry.get(memberKey)).toBe("mem_dana/org_prairie")
      const left = MutableRef.make<ReadonlyArray<string>>([])
      const holds = makeHolds({
        forget: () => {},
        leave: (who) => MutableRef.update(left, A.append(who)),
        members: () => []
      })
      const read = Atom.make(0)
      holds.left(registry, "mem_sam/org_prairie", read)
      // Nothing keeps it: the registry lets it go at its next turn, as it does any atom nobody reads.
      yield* Effect.sleep("20 millis")
      expect([left.current, registry.getNodes().has(read)]).toEqual([["mem_sam/org_prairie"], false])
    })
  )

  it.live("ends when its five minutes run out, says so to the read once, and hears no later change of member", () =>
    withJumps(
      Effect.gen(function* () {
        const { registry, signedIn } = page(Layer.empty, memberOf("mem_dana", "org_prairie"), letGoAtOnce)
        const left = MutableRef.make<ReadonlyArray<string>>([])
        const holds = makeHolds({
          forget: () => {},
          leave: (who) => MutableRef.update(left, A.append(who)),
          members: () => []
        })
        const read = Atom.make(0)
        holds.left(registry, "mem_dana/org_prairie", read)
        yield* Effect.sleep("20 millis")
        expect([left.current, registry.getNodes().has(read)]).toEqual([[], true])
        yield* fiveMinutesPass
        yield* Effect.sleep("20 millis")
        expect([left.current, registry.getNodes().has(read)]).toEqual([["mem_dana/org_prairie"], false])
        // The page's member changes after the hold ended: nothing more is said for it.
        registry.set(signedIn, memberOf("mem_sam", "org_prairie"))
        yield* Effect.sleep("20 millis")
        expect(left.current).toEqual(["mem_dana/org_prairie"])
      })
    )
  )

  it.live("taken again for the same member, lets go of the earlier one", () =>
    Effect.gen(function* () {
      const { registry } = page(Layer.empty, memberOf("mem_dana", "org_prairie"), letGoAtOnce)
      const holds = makeHolds({ forget: () => {}, leave: () => {}, members: () => [] })
      const earlier = Atom.make(0)
      const later = Atom.make(1)
      holds.left(registry, "mem_dana/org_prairie", earlier)
      holds.left(registry, "mem_dana/org_prairie", later)
      yield* Effect.sleep("20 millis")
      expect([registry.getNodes().has(earlier), registry.getNodes().has(later)]).toEqual([false, true])
      holds.looked("mem_dana/org_prairie")
      yield* Effect.sleep("20 millis")
      expect(registry.getNodes().has(later)).toBe(false)
    })
  )
})

/** The model's session refusing a call: the page that sent it was opened for somebody else than is signed in now. */
const nobodyAsNamed = NotSignedIn.make({
  reason: "This page was opened for somebody else than is signed in now. Load the page again."
})

/** A live read that gave up on its connection, as the library ends it after its last reconnect. */
const lostConnection = RpcClientError.RpcClientError.make({
  reason: RpcClientError.RpcClientDefect.make({
    message: "Live read CounterTotal.watch lost its connection",
    cause: undefined
  })
})

/** How the server answers a watch of `counter` before it is read: refused for want of a member, a lost connection, or not at all. */
const refusalOf = (counter: CounterId): Effect.Effect<void, NotSignedIn | RpcClientError.RpcClientError> =>
  counter === CounterIds.unsigned || counter === CounterIds.unsignedToo
    ? Effect.fail(nobodyAsNamed)
    : counter === CounterIds.lost
      ? Effect.fail(lostConnection)
      : Effect.void

/**
 * A watched counter whose watch the server refuses for want of a member (two counters), or which loses its
 * connection (one), and any other as the model answers it.
 */
const guardedTotal = counting.watched((api, counter: CounterId) =>
  Stream.unwrap(Effect.as(refusalOf(counter), api.CounterTotal.watch(counter)))
)

/** Refused for want of a member the first `refusals` times it is sent, then sent to the model. */
const refusedFirst = (refusals: number) => {
  const sent = MutableRef.make(0)
  const refusedNow: Effect.Effect<void, NotSignedIn> = Effect.suspend(() =>
    MutableRef.incrementAndGet(sent) <= refusals ? Effect.fail(nobodyAsNamed) : Effect.void
  )
  const press = counting.command<BumpInput>()(
    (api, input, options) => Effect.andThen(refusedNow, api.Bump(input, options)),
    { reactivityKeys: O.none() }
  )
  return { sent, press }
}

/**
 * A page whose session is a stand-in that counts how often who is signed in is asked, and is then being asked until
 * the test answers (`answer`), as the app's session is: the member it answers is who the page is for from then on.
 */
const askingPage = <R>(clientLayer: Layer.Layer<R>) => {
  const signedIn = Atom.make(memberOf("mem_dana", "org_prairie")).pipe(Atom.keepAlive)
  const asking = Atom.make(false).pipe(Atom.keepAlive)
  const asks = MutableRef.make(0)
  const session = Atom.readable(
    (get) => get(signedIn),
    () => {
      MutableRef.increment(asks)
      registry.set(asking, true)
    }
  )
  const registry = AtomRegistry.make({
    initialValues: [provideApi(clientLayer), provideMember(session), provideWhoIsSignedInAsked(asking)]
  })
  const answer = (who: ReturnType<typeof memberOf>) => {
    registry.set(signedIn, who)
    registry.set(asking, false)
  }
  return { registry, asks, answer }
}

/** What a watched counter or a command ended in, once it failed: the failure itself. */
const failureOf = <A, E>(registry: AtomRegistry.AtomRegistry, atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>) =>
  until(() => {
    const now = registry.get(atom)
    return AsyncResult.isFailure(now) && !now.waiting ? O.some(now.cause.pipe(Cause.squash)) : O.none()
  })

describe("a model call refused for want of a member", () => {
  it.live("a watched read: asks who is signed in once, also when two are refused together, and stays refused", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const host = yield* hosted(noExpiry.pipe(judging))
        const t = askingPage(served(host).layer)
        t.registry.mount(guardedTotal(CounterIds.unsigned))
        t.registry.mount(guardedTotal(CounterIds.unsignedToo))
        const first = yield* failureOf(t.registry, guardedTotal(CounterIds.unsigned))
        const second = yield* failureOf(t.registry, guardedTotal(CounterIds.unsignedToo))
        expect([first, second, MutableRef.get(t.asks)]).toEqual([nobodyAsNamed, nobodyAsNamed, 1])
      })
    )
  )

  it.live("a watched read that lost its connection asks nothing: it was not refused", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const host = yield* hosted(noExpiry.pipe(judging))
        const t = askingPage(served(host).layer)
        t.registry.mount(guardedTotal(CounterIds.lost))
        const lost = yield* failureOf(t.registry, guardedTotal(CounterIds.lost))
        expect([lost, MutableRef.get(t.asks)]).toEqual([lostConnection, 0])
      })
    )
  )

  it.live("a command: asks once, waits for the answer, and is sent once more for the same member", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const host = yield* hosted(noExpiry.pipe(judging))
        const t = askingPage(served(host).layer)
        const { sent, press } = refusedFirst(1)
        t.registry.mount(press)
        t.registry.set(press, { counterId: CounterIds.unsigned, by: 1 })
        yield* until(() => O.liftPredicate(MutableRef.get(t.asks), (asks) => asks > 0))
        // Asked, and held: not sent again until who is signed in is known.
        yield* Effect.sleep("30 millis")
        expect([MutableRef.get(t.asks), MutableRef.get(sent), t.registry.get(press).waiting]).toEqual([1, 1, true])
        t.answer(memberOf("mem_dana", "org_prairie"))
        const receipt = yield* answered(t.registry, O.none(), press)
        expect([MutableRef.get(sent), receipt.version]).toEqual([2, 1])
      })
    )
  )

  it.live("a command, after the person's own switch of organization: not sent there, and said so", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const host = yield* hosted(noExpiry.pipe(judging))
        const t = askingPage(served(host).layer)
        const { sent, press } = refusedFirst(1)
        t.registry.mount(press)
        t.registry.set(press, { counterId: CounterIds.unsignedToo, by: 1 })
        yield* until(() => O.liftPredicate(MutableRef.get(t.asks), (asks) => asks > 0))
        t.answer(memberOf("mem_dana", "org_northline"))
        const failed = yield* failureOf(t.registry, press)
        expect([S.is(NotSentElsewhere)(failed), MutableRef.get(sent)]).toEqual([true, 1])
      })
    )
  )
})
