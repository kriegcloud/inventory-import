// The catalog's `Session` middleware for a test that sends through an Api: who is signed in, named by the test, or
// nobody. It stays in this package's tests: a host may not import another context's model, and the Layer of the real
// session (one lookup, through the kernel's port) is built by the model's Worker. The one thing not to break: this
// file is a test's only, so no Worker's bundle may hold `sessionAs`.
import { NotSignedIn } from "@inventory/kernel/AccessError"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { type Actor, CurrentActor } from "../src/Actor/Actor.context.ts"
import { Session } from "../src/Actor/Session.middleware.ts"

/** The session of `who`: every call served through it acts as them, as a story's `Story.provide(CurrentActor, who)`. */
export const sessionAs = (who: Actor): Layer.Layer<Session> =>
  Layer.succeed(Session, (effect) => Effect.provideService(effect, CurrentActor, who))

/** Nobody is signed in: every call is refused `NotSignedIn`, as a request with no session is. */
export const noSession: Layer.Layer<Session> = Layer.succeed(Session, () =>
  Effect.fail(NotSignedIn.make({ reason: "Sign in to continue." }))
)
