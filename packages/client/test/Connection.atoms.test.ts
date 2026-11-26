import { assertedValue } from "./support"
import { assertDefined } from "@effect/vitest/utils"
import { isTransient } from "@inventory/client/SayError"
// A read that could not be made is made again by itself once the connection is back: when the browser says it is online,
// when the server has answered anything else, and every half minute while nothing does. Never a read the server refused, which would be refused again, and
// never in a loop on a server that keeps failing.
import { describe, expect, it } from "@effect/vitest"
import * as Clock from "effect/Clock"
import * as Context from "effect/Context"
import type * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as O from "effect/Option"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import * as AtomRegistry from "effect/reactivity/AtomRegistry"
import * as HttpApiError from "effect/http-api/HttpApiError"
import * as TestClock from "effect/testing/TestClock"
import { beforeEach } from "vitest"
import { makeApiAtoms, provideApi } from "@inventory/client/Api"
import { askedAgainWhenBack, serverAnswered } from "@inventory/client/ConnectionAtoms"
import { request } from "@inventory/client/Http"
import { Forbidden } from "@inventory/kernel/AccessError"

beforeEach(() => {
  Object.assign(globalThis, { window: new EventTarget() })
})

const settle = Effect.sleep("30 millis")

type Refusal = HttpApiError.InternalServerErrorProblem | Forbidden
interface Rows {
  readonly rows: Effect.Effect<string, Refusal>
}
class RowServer extends Context.Service<RowServer, Rows>()("@inventory/client/test/Connection.atoms.test/RowServer") {}

/**
 * A read whose server answers as the test says, followed by what asks it again; `times` counts the requests. With a
 * `clock` (the test's own), the API's runtime runs on it and the server answers at once.
 */
const world = (clock: O.Option<Clock.Clock>) => {
  const server: { answer: Effect.Effect<string, Refusal>; times: number } = {
    answer: Effect.succeed("rows"),
    times: 0
  }
  const layer = Layer.succeed(RowServer, {
    rows: Effect.suspend(() => {
      server.times += 1
      return O.match(clock, {
        onNone: () => Effect.sleep("1 millis").pipe(Effect.andThen(server.answer)),
        onSome: () => server.answer
      })
    })
  }).pipe(
    Layer.merge(O.match(clock, { onNone: () => Layer.empty, onSome: (clock) => Layer.succeed(Clock.Clock, clock) }))
  )
  const rows = makeApiAtoms(RowServer).query((api) => api.rows, { keep: "unwatched", reactivityKeys: O.none() })
  const registry = AtomRegistry.make({ initialValues: [provideApi(layer)] })
  const stop = registry.mount(
    askedAgainWhenBack({ mayPass: isTransient, read: rows, askAgain: (at) => rows.askAgain(at, O.none()) })
  )
  const read = () => registry.get(rows)
  const down = Effect.fail(HttpApiError.InternalServerErrorProblem.make({}))
  return { registry, rows, read, server, stop, down }
}

describe("a read that could not be made", () => {
  it.live("is made again when the browser is online, and when the server has answered something else", () =>
    Effect.gen(function* () {
      const t = world(O.none())
      yield* settle
      t.server.answer = t.down
      t.rows.askAgain(t.registry, O.none())
      yield* settle
      expect(AsyncResult.isFailure(t.read())).toBe(true)
      const before = t.server.times
      window.dispatchEvent(new Event("online"))
      yield* settle
      // Still down: tried (and once more, as every read is), and left until the next sign.
      expect([t.server.times - before, AsyncResult.isFailure(t.read())]).toEqual([2, true])
      t.server.answer = Effect.succeed("fresh rows")
      serverAnswered(200)
      yield* settle
      expect(AsyncResult.value(t.read())).toEqual(O.some("fresh rows"))
      const after = t.server.times
      serverAnswered(200)
      window.dispatchEvent(new Event("online"))
      yield* settle
      expect(t.server.times).toBe(after)
    })
  )

  it.live("is made again when a request made outside the atoms has been answered (the session's, a sign-in's)", () =>
    Effect.gen(function* () {
      const t = world(O.none())
      yield* settle
      t.server.answer = t.down
      t.rows.askAgain(t.registry, O.none())
      yield* settle
      t.server.answer = Effect.succeed("fresh rows")
      const context = yield* Effect.context<never>()
      const signal = yield* Effect.abortSignal
      let observed: RequestInit | undefined
      const native = new Response("native response", { status: 201 })
      Object.assign(globalThis, {
        location: { href: "http://localhost/" },
        fetch: (_input: unknown, init: RequestInit) => {
          observed = init
          return Effect.runPromiseWith(context)(Effect.succeed(native))
        }
      })
      const response = yield* Effect.promise(() =>
        request("/api/v1/items", {
          method: "POST",
          body: "request body",
          credentials: "include",
          cache: "no-store",
          redirect: "manual",
          integrity: "sha256-example",
          signal
        })
      )
      assertDefined(observed)
      expect([observed.credentials, observed.cache, observed.redirect, observed.integrity]).toEqual([
        "include",
        "no-store",
        "manual",
        "sha256-example"
      ])
      const observedSignal = O.fromNullishOr(observed.signal)
      const forwarded = assertedValue(observedSignal)
      expect(forwarded.aborted).toBe(false)
      expect(response).toBe(native)
      const text = yield* Effect.promise(() => response.text())
      expect(text).toBe("native response")
      yield* settle
      expect(AsyncResult.value(t.read())).toEqual(O.some("fresh rows"))
    })
  )

  it.live("is not made again for a refusal, for the server failing elsewhere, or once nothing follows it", () =>
    Effect.gen(function* () {
      const t = world(O.none())
      yield* settle
      t.server.answer = Effect.fail(Forbidden.make({ reason: "Your role is viewer.", required: "editor" }))
      t.rows.askAgain(t.registry, O.none())
      yield* settle
      const refused = t.server.times
      serverAnswered(200)
      window.dispatchEvent(new Event("online"))
      yield* settle
      expect(t.server.times).toBe(refused)
      t.server.answer = t.down
      t.rows.askAgain(t.registry, O.none())
      yield* settle
      const failed = t.server.times
      serverAnswered(503)
      serverAnswered(429)
      yield* settle
      expect(t.server.times).toBe(failed)
      t.registry.mount(t.rows)
      t.stop()
      yield* settle
      serverAnswered(200)
      yield* settle
      expect(t.server.times).toBe(failed)
    })
  )
})

describe("a read that could not be made, on a quiet page", () => {
  it.effect("is made again every half minute while it stays failed, and no more once it is answered", () =>
    Effect.gen(function* () {
      const clock = yield* Clock.clockWith(Effect.succeed)
      const t = world(O.some(clock))
      const tick = (by: Duration.Input) => TestClock.adjust(by)
      yield* tick("1 second")
      t.server.answer = t.down
      t.rows.askAgain(t.registry, O.none())
      yield* tick("1 second")
      expect(AsyncResult.isFailure(t.read())).toBe(true)
      const failed = t.server.times
      // Half a minute after it failed, and not before.
      yield* tick("28 seconds")
      expect(t.server.times).toBe(failed)
      yield* tick("1 second")
      // Asked again (and once more, as every read is), still down: and again half a minute later.
      expect(t.server.times - failed).toBe(2)
      yield* tick("30 seconds")
      expect(t.server.times - failed).toBe(4)
      t.server.answer = Effect.succeed("fresh rows")
      yield* tick("30 seconds")
      expect(AsyncResult.value(t.read())).toEqual(O.some("fresh rows"))
      const answered = t.server.times
      yield* tick("2 minutes")
      expect(t.server.times).toBe(answered)
    })
  )
})
