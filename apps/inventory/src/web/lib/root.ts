// What the app's one atom registry holds from the page's start: what its atoms are given, and what is kept in it
// whatever is drawn. One list, so what `main.tsx` starts the page with is what a test holds it to. The rules this file
// protects: this tab's id and its lock are taken at page start, before anybody is signed in (a tab on the sign-in page
// counts as open, and no other takes up the rows it kept); every web package's `member` is the session's; asking who is
// signed in asks the session; and a session that could not be read is asked again by itself.
import { scheduleTask } from "@effect/atom-react/RegistryContext"
import * as A from "effect/Array"
import type * as Layer from "effect/Layer"
import * as Atom from "effect/reactivity/Atom"
import * as AtomRegistry from "effect/reactivity/AtomRegistry"
import { actor, session, signedInAsked } from "@inventory/access-web/Session"
import { provideApi } from "@inventory/client/Api"
import { askedAgainWhenBack } from "@inventory/client/ConnectionAtoms"
import { provideMember, provideWhoIsSignedInAsked } from "@inventory/client/MemberAtoms"
import { thisTab } from "@inventory/client/TabAtoms"

/**
 * Who the atoms of every web package read the API for: the session's member. Asked again (`askWhoIsSignedIn`), it asks
 * the session again.
 */
const signedIn = Atom.readable(
  (get) => get(actor),
  (refresh) => refresh(session)
)

/** The session asked again by itself once the connection is back: until it answers, nothing of the person's is sent. */
const sessionAskedAgain = askedAgainWhenBack({
  read: session,
  askAgain: (registry) => registry.refresh(session),
  mayPass: () => true
})

/** Kept for the page's life, whatever is drawn. */
const kept: ReadonlyArray<Atom.Atom<unknown>> = [thisTab, sessionAskedAgain]

/**
 * The app's registry, with everything the page starts with in it. `api` is the layer every web package's atoms call the
 * API through. An atom nobody reads is dropped 400 ms later; a read of the API is kept for `keepUnwatched`
 * (@inventory/client/Api).
 */
export const rootRegistry = <R>(input: { readonly api: Layer.Layer<R> }): AtomRegistry.AtomRegistry => {
  const registry = AtomRegistry.make({
    scheduleTask,
    initialValues: [provideApi(input.api), provideMember(signedIn), provideWhoIsSignedInAsked(signedInAsked)],
    defaultIdleTTL: 400
  })
  A.forEach(kept, (atom) => registry.mount(atom))
  return registry
}
