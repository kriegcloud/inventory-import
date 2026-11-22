// The connection coming back, as the page can tell: the browser says it is online, or the server answers any request.
// A read that could not be made is then asked again by itself, with nothing for the person to press. The one thing not
// to break: only a failure that may pass is asked again here, and only by something else's answer, so a server that
// keeps failing is never asked in a loop.
import * as Cause from "effect/Cause"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import * as Atom from "effect/reactivity/Atom"
import type * as AtomRegistry from "effect/reactivity/AtomRegistry"
import { isTransient } from "@inventory/client/SayError"

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
 * Asks a read again by itself once the connection is back, for as long as this is mounted: when the browser says it is
 * online, or when the server has answered any other request. Only a read whose last try failed, and is not being asked
 * now; of those, the ones `mayPass` says (by default the network, a server error, "too many requests").
 */
export const askedAgainWhenBack = <A, E>(input: {
  readonly read: Atom.Atom<AsyncResult.AsyncResult<A, E>>
  readonly askAgain: (registry: AtomRegistry.AtomRegistry) => void
  readonly mayPass?: (error: unknown) => boolean
}): Atom.Atom<void> =>
  Atom.readable((get) => {
    if (typeof window === "undefined") return
    const registry = get.registry
    const mayPass = input.mayPass ?? isTransient
    get.mount(input.read)
    const back = () => {
      const now = registry.get(input.read)
      if (!AsyncResult.isFailure(now) || now.waiting) return
      if (mayPass(now.cause.pipe(Cause.squash))) input.askAgain(registry)
    }
    window.addEventListener("online", back)
    window.addEventListener(answered, back)
    get.addFinalizer(() => {
      window.removeEventListener("online", back)
      window.removeEventListener(answered, back)
    })
  })
