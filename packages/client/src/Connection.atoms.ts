// The connection coming back, as the page can tell: the browser says it is online, or the server answers any request;
// and, while nothing else does, every half minute. A read that could not be made is then asked again by itself, with
// nothing for the person to press. The one thing not to break: only a failure that may pass is asked again here, and
// never in a loop: at once only on something else's answer, otherwise not before `askAgainEvery` has passed.
import * as Cause from "effect/Cause"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import * as Atom from "effect/reactivity/Atom"
import type * as AtomRegistry from "effect/reactivity/AtomRegistry"
import { apiRuntime } from "@inventory/client/Api"

/** The event the page sends itself when the server has answered a request. */
const answered = "inventory:server-answered"

/**
 * The server answered a request with this status: said to whatever waits for the connection to be back. The server's
 * own failure, and its "too many requests", are no answer.
 */
export const serverAnswered = (status: number): void => {
  if (typeof window === "undefined" || status === 429 || status >= 500) return
  window.dispatchEvent(new Event(answered))
}

/**
 * How long a read that could not be made waits, when nothing else is answered meanwhile, before it is asked again by
 * itself: a quiet page whose server failed for a while recovers without a press. Half a minute.
 */
export const askAgainEvery = Duration.seconds(30)

/**
 * Asks a read again by itself, for as long as this is mounted: when the browser says it is online, when the server has
 * answered any other request, and every `askAgainEvery` while its last try stays failed. Only a read whose last try
 * failed, and is not being asked now; of those, the ones `mayPass` says (by default the network, a server error, "too
 * many requests"). The timer runs on the API's runtime, so its clock is the one the app (or a test) provides.
 */
export const askedAgainWhenBack = <A, E>(input: {
  readonly read: Atom.Atom<AsyncResult.AsyncResult<A, E>>
  readonly askAgain: (registry: AtomRegistry.AtomRegistry) => void
  readonly mayPass: (error: unknown) => boolean
}): Atom.Atom<void> => {
  const mayPass = input.mayPass
  /** Whether the read stands failed, with a failure that may pass, and nothing is asking it now. */
  const standsFailed = (now: AsyncResult.AsyncResult<A, E>): boolean =>
    AsyncResult.isFailure(now) && !now.waiting && mayPass(now.cause.pipe(Cause.squash))
  // Started again each time the read changes: a new failure waits the whole time again, and an answer stops it.
  const timer = apiRuntime.atom((get) =>
    standsFailed(get(input.read))
      ? Effect.sleep(askAgainEvery).pipe(Effect.andThen(Effect.sync(() => input.askAgain(get.registry))))
      : Effect.void
  )
  return Atom.readable((get) => {
    if (typeof window === "undefined") return
    const registry = get.registry
    get.mount(input.read)
    get.mount(timer)
    const back = () => {
      if (standsFailed(registry.get(input.read))) input.askAgain(registry)
    }
    window.addEventListener("online", back)
    window.addEventListener(answered, back)
    get.addFinalizer(() => {
      window.removeEventListener("online", back)
      window.removeEventListener(answered, back)
    })
  })
}
