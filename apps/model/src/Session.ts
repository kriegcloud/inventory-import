/**
 * The server half of the usage model's `Session` middleware, as the model's Worker has it until sign-in reaches the
 * Worker: nobody is signed in, so every command and every read is refused `NotSignedIn` before anything is taken or
 * read. The seam is this one Layer. It is replaced, whole, by the Layer built on the kernel's `SessionLookup` (the one
 * session lookup, implemented once in the access context's host: Benjamin, 2026-11-26, "A port in the kernel"), with
 * the session read through Alchemy's Better Auth package on this Worker only (host-03; "Model's Worker only", the same
 * day). The one thing not to break: nothing here, and nothing that replaces it, names who acts from a header or a
 * payload.
 *
 * @packageDocumentation
 */
import { signInSentence } from "@inventory/access-model/SessionRules"
import { NotSignedIn } from "@inventory/kernel/AccessError"
import { Session } from "@inventory/usage-model/Session"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"

/**
 * `Session` with no session to read: every call is refused with the sentence a request with no session gets on
 * `/api/v1` today, so nothing reaches the model as anybody. Nothing forwards a page's call here yet (host-04).
 */
export const SessionNotYetRead = Layer.succeed(Session, () => Effect.fail(NotSignedIn.make({ reason: signInSentence })))
