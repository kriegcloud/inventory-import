// Who is signed in, as atoms, read through the browser HTTP boundary: this module is in the sign-in screen's first
// download, without the API client or contract. The answer is decoded by a module of its own
// (./internal/Session.decode.ts), asked for as this module loads, beside the first session request. The rule this file
// protects: the session is asked for once per page load and shared; it is asked again only after signing in, creating
// an organization or switching organization, and every read of the API then belongs to the new member
// (`@inventory/client/Api` keys its reads by `member`). Signing out reloads the page.
import { useAtomRefresh, useAtomValue } from "@effect/atom-react"
import { forgetEarly } from "@inventory/client/Early"
import { request } from "@inventory/client/Http"
import { queryClient } from "@inventory/client/QueryClient"
import { actorOfSession, type SessionState } from "@inventory/access-contract/SessionState"
import type { Member } from "@inventory/kernel/Member"
import * as Cause from "effect/Cause"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import * as HttpClientError from "effect/http/HttpClientError"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import * as Atom from "effect/reactivity/Atom"
import { $AccessWebId } from "./internal/identity.ts"

const $I = $AccessWebId.create("Session")

/** Better Auth's browser client, fetched the first time a person signs in, switches or signs out. */
const loadAuthClient = () => import("./internal/authClient.ts")
const decoder = import("./internal/Session.decode.ts")

/** What the app tells the session once, before anything is drawn. */
type SessionSetup = {
  /** Where the browser asks who is signed in: the session endpoint under the app's API prefix. */
  readonly sessionPath: string
  /**
   * Started the moment a member is known, or likely, to be signed in: the app's first screen (its code and data),
   * so it is on its way before the session answer is decoded. Safe to call more than once.
   */
  readonly onSignedIn: () => void
}

let setup: SessionSetup = { sessionPath: "/api/v1/identity/session", onSignedIn: () => {} }

/**
 * Tells the session where it is asked and what to start for a signed-in member. Called once by the app, as its first
 * module loads. If this browser was signed in last time, the first screen is started at once.
 */
export const configureSession = (options: SessionSetup): void => {
  setup = options
  // Someone was signed in here last time, so they most likely still are: the app's first screen is asked for now,
  // beside the session (which index.html preloads), instead of after its answer.
  if (wasSignedIn()) options.onSignedIn()
}

const signedInKey = "signed-in"
const signedOutKey = "signed-out-here"

/**
 * Whether this browser was signed in when it last asked. It decides only what is drawn before the session answer
 * comes (the sign-in page at once, or a placeholder for the app); it grants nothing, and the answer always wins.
 */
export const wasSignedIn = (): boolean => {
  try {
    return window.localStorage.getItem(signedInKey) === "yes"
  } catch {
    return false
  }
}

const rememberSignedIn = (signedIn: boolean) => {
  try {
    if (signedIn) window.localStorage.setItem(signedInKey, "yes")
    else window.localStorage.removeItem(signedInKey)
  } catch {
    // Private windows can refuse storage: the placeholder is then drawn until the answer comes.
  }
}

/**
 * Whether the person signed out in this tab. Development signs a visitor in as the first test account on its own
 * (the app's sign-in gate); after a sign-out it does not, so the sign-in page can be seen and another account chosen there.
 */
export const signedOutHere = (): boolean => {
  try {
    return window.sessionStorage.getItem(signedOutKey) === "yes"
  } catch {
    return false
  }
}

const rememberSignedOut = (signedOut: boolean) => {
  try {
    if (signedOut) window.sessionStorage.setItem(signedOutKey, "yes")
    else window.sessionStorage.removeItem(signedOutKey)
  } catch {
    // Without storage a sign-out in development is followed by the first test account again: nothing is lost.
  }
}

/**
 * The session answer could not be read (not a 200, or not a session). Said as "Something went wrong" with what to
 * do; a network failure stays the HTTP client's own error, said as "could not be reached".
 */
export class SessionUnreadable extends S.TaggedError<SessionUnreadable, { readonly brand: unique symbol }>()(
  "SessionUnreadable",
  {},
  $I.annote("SessionUnreadable", { description: "The session answer could not be read." })
) {}

/** Why the session is not known: the network, or an answer that is not a session. */
export type SessionFailure = HttpClientError.HttpClientError | SessionUnreadable

/** One GET of the session, decoded; remembers whether someone is signed in, and starts or drops the first screen. */
const askSession: Effect.Effect<SessionState, SessionFailure> = Effect.tryPromise({
  // index.html preloads this address, so the answer is usually on its way before this code runs.
  try: () =>
    request(setup.sessionPath, { credentials: "same-origin" }).then((response) => {
      if (!response.ok) throw SessionUnreadable.make({})
      return response.json().then((body: unknown) => decoder.then(({ decodeSession }) => decodeSession(body)))
    }),
  catch: (cause): SessionFailure => (HttpClientError.isHttpClientError(cause) ? cause : SessionUnreadable.make({}))
}).pipe(
  Effect.tap((answer) =>
    Effect.sync(() => {
      rememberSignedIn(answer.status !== "signed-out")
      // Signed in: the workspace's code and the first screen's data, if the hint did not start them. Not signed in:
      // whatever the hint asked for was asked for the wrong person, and no screen may take it.
      if (answer.status === "ready") setup.onSignedIn()
      else forgetEarly()
    })
  )
)

/** Who is signed in, and as whom they act: one request (`GET /api/v1/identity/session`, always a 200), kept all tab. */
export const session: Atom.Atom<AsyncResult.AsyncResult<SessionState, SessionFailure>> = Atom.make(askSession).pipe(
  Atom.keepAlive
)

/** The member the session acts as, once it is ready; none while loading, signed out or with no organization. */
export const actor: Atom.Atom<O.Option<Member>> = Atom.map(session, (result) =>
  result.waiting ? O.none() : O.flatMap(AsyncResult.value(result), actorOfSession)
)

/**
 * Who is signed in, as the app's shell reads it until it moves to the atoms above (goals/atoms, step 4): only the
 * atom hooks, with the same fields `useSession` gave. While the session is asked again (after a switch) it reads as
 * loading, as it did when the cache was emptied for the new member.
 */
export function useSession() {
  const result = useAtomValue(session)
  const askAgain = useAtomRefresh(session)
  const state = result.waiting ? undefined : result.pipe(AsyncResult.value, O.getOrUndefined)
  /** Everything read before belonged to the previous person or organization: ask again, for the new one. */
  const refresh = () => {
    // The catalog screens' cache, until they move to atoms: emptied as before. The atoms' reads follow the member.
    void queryClient.resetQueries()
    askAgain()
    return Promise.resolve()
  }
  return {
    /** loading, then signed-out, no-organization or ready (`actor` is set only when ready). */
    status: state?.status ?? "loading",
    actor: state?.status === "ready" ? state.actor : undefined,
    email: state === undefined || state.status === "signed-out" ? undefined : state.email,
    organizations: state === undefined || state.status === "signed-out" ? [] : state.organizations,
    features: state?.features,
    /** No answer yet, and this browser was not signed in last time: draw the sign-in page without waiting. */
    probablySignedOut: state === undefined && !wasSignedIn(),
    isPending: AsyncResult.isInitial(result),
    error: result._tag === "Failure" && !result.waiting ? Cause.squash(result.cause) : null,
    retry: askAgain,
    refresh,
    switchTo: (organizationId: string) =>
      loadAuthClient().then(({ authClient, orThrow }) =>
        authClient.organization
          .setActive({ organizationId })
          .then(orThrow)
          .then(() => refresh())
      ),
    /**
     * Signs in as another account (a test account, from the person's menu): out of this one, into that one, then a
     * full reload, so nothing the previous person saw stays in memory.
     */
    signInAs: (email: string, password: string) =>
      loadAuthClient().then(({ authClient, orThrow }) =>
        authClient
          .signOut()
          .then(() => authClient.signIn.email({ email, password }))
          .then(orThrow)
          .then(() => {
            rememberSignedOut(false)
            window.location.assign("/")
          })
      ),
    // A full reload after signing out: nothing the previous person saw stays in memory for the next one.
    signOut: () =>
      loadAuthClient().then(({ authClient, orThrow }) =>
        authClient
          .signOut()
          .then(orThrow)
          .then(() => {
            rememberSignedIn(false)
            rememberSignedOut(true)
            window.location.assign("/")
          })
      )
  }
}

/**
 * Signs in with an email and a password through Better Auth's own sign-in: a real session, the one the sign-in page
 * makes. For the app's development sign-in as the first test account; the page then asks who is signed in again.
 */
export const signInWithPassword = (account: { readonly email: string; readonly password: string }): Promise<unknown> =>
  loadAuthClient().then(({ authClient, orThrow }) => authClient.signIn.email(account).then(orThrow))
