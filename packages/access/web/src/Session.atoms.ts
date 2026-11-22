// Who is signed in, as atoms, read through the browser HTTP boundary: this module is in the sign-in screen's first
// download, without the API client or contract. The answer is decoded by a module of its own
// (./internal/Session.decode.ts), asked for as this module loads, beside the first session request. The rule this file
// protects: the session is asked for once per page load and shared; it is asked again after signing in, creating an
// organization, switching organization, and when the server says this page's idea of who is signed in is out of date.
// One page is one member's: asked again, the page keeps the member it had, and an answer that is somebody else, another
// organization or nobody leaves the page (a full page load, as signing out is), so nothing a person typed, chose or
// read is there for whoever is next. Only the person's own switch of organization goes on without one, as Benjamin
// decided (2026-11-19, "atoms, the reads after a sign-out or a switch"): a switch back shows the rows at once. Every tab
// of the browser shares one session cookie, so each sign-in, sign-out, switch and session found ended is said to the
// other tabs (`changedKey` in localStorage), and each of them asks again at once, as it does when it is shown again.
import { forgetReads } from "@inventory/client/Api"
import { forgetEarly } from "@inventory/client/Early"
import { request } from "@inventory/client/Http"
import {
  answeredFor,
  askedOfAnswer,
  keyOfMember,
  memberOfAnswer,
  settledBeforeOwnSwitch
} from "@inventory/client/MemberAtoms"
import { leaveApp, navigate } from "@inventory/ui/Route"
import { sharedStorage, tabStorage } from "@inventory/client/Storage"
import {
  actorOfSession,
  type OrganizationChoice,
  type SessionState,
  type SignInFeatures
} from "@inventory/access-contract/SessionState"
import type { Member } from "@inventory/kernel/Member"
import * as Cause from "effect/Cause"
import * as SecureRandom from "effect/crypto/SecureRandom"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import * as HttpClientError from "effect/http/HttpClientError"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import * as Atom from "effect/reactivity/Atom"
import * as AtomRegistry from "effect/reactivity/AtomRegistry"
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
export const wasSignedIn = (): boolean => O.contains(sharedStorage.read(signedInKey), "yes")

const rememberSignedIn = (signedIn: boolean) => {
  // Private windows can refuse storage: the placeholder is then drawn until the answer comes.
  if (signedIn) sharedStorage.write(signedInKey, "yes")
  else sharedStorage.remove(signedInKey)
}

/**
 * Whether the person signed out in this tab. Development signs a visitor in as the first test account on its own
 * (the app's sign-in gate); after a sign-out it does not, so the sign-in page can be seen and another account chosen there.
 */
export const signedOutHere = (): boolean => O.contains(tabStorage.read(signedOutKey), "yes")

const rememberSignedOut = (signedOut: boolean) => {
  // Without storage a sign-out in development is followed by the first test account again: nothing is lost.
  if (signedOut) tabStorage.write(signedOutKey, "yes")
  else tabStorage.remove(signedOutKey)
}

/**
 * Said in localStorage each time who is signed in changes in this tab on purpose (a sign-in, a sign-out, a switch of
 * organization) or is found ended: the other tabs of the browser hear it (the `storage` event) and ask who is signed in
 * again (`askedWhenChangedElsewhere`). Its value is new each time, and means nothing else.
 */
export const changedKey = "inventory:signed-in-changed"

/** Tells the other tabs of this browser that who is signed in may have changed. */
const sayChanged = (): void => {
  // Storage refused: the other tabs ask again when they are next shown.
  sharedStorage.write(changedKey, SecureRandom.uuidV4Unsafe())
}

const endedKey = "session-ended"

/**
 * A member's session was found ended on this page: kept for the sign-in page of this tab, which says so, with where
 * they were, for them alone. Two lines: the member, and the address.
 */
const rememberEnded = (who: O.Option<Member>) => {
  sayChanged()
  // Without storage the sign-in page says nothing, and signing in again lands on the first screen. Where the page has
  // no address to read (no window), nothing is kept either.
  const at = O.liftThrowable(() => `${window.location.pathname}${window.location.search}`)()
  if (O.isSome(at)) tabStorage.write(endedKey, `${keyOfMember(who)}\n${at.value}`)
}

/** Whether this tab's last page was left because its member's session had ended. */
export const sessionEnded = (): boolean => O.isSome(tabStorage.read(endedKey))

/** Where `who` was when their session ended in this tab, taken once; none for anybody else, who lands on the first screen. */
const takeEnded = (who: O.Option<Member>): O.Option<string> => {
  const kept = tabStorage.read(endedKey)
  // Where the browser refuses to forget it, it is not taken: nothing is said, and the first screen is the landing.
  if (O.isNone(tabStorage.remove(endedKey))) return O.none()
  const [of = "", at = ""] = Str.split(
    O.getOrElse(kept, () => ""),
    "\n"
  )
  const here = Str.startsWith("/")(at) && !Str.startsWith("//")(at)
  return of !== "" && of === keyOfMember(who) && here ? O.some(at) : O.none()
}

/**
 * Leaves this page for a fresh one, on purpose: nothing asks first, the previous person's reads leave memory, and a
 * browser that brings the page back as it was (its back button) loads it again instead.
 */
const leavePage = (): void => {
  forgetReads()
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) window.location.reload()
  })
  leaveApp("/")
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

/** One GET of the session, decoded; remembers whether someone is signed in. */
const askSession: Effect.Effect<SessionState, SessionFailure> = Effect.tryPromise({
  // index.html preloads this address, so the answer is usually on its way before this code runs.
  try: () =>
    request(setup.sessionPath, { credentials: "same-origin" }).then((response) => {
      if (!response.ok) throw SessionUnreadable.make({})
      return response.json().then((body: unknown) => decoder.then(({ decodeSession }) => decodeSession(body)))
    }),
  catch: (cause): SessionFailure => (HttpClientError.isHttpClientError(cause) ? cause : SessionUnreadable.make({}))
}).pipe(Effect.tap((answer) => Effect.sync(() => rememberSignedIn(answer.status !== "signed-out"))))

/**
 * The organization the person is switching to in this tab, from their press until the session has answered; none
 * otherwise. What tells their own switch from another organization found (switched in another tab).
 */
const switchingTo = Atom.make<O.Option<string>>(O.none()).pipe(Atom.keepAlive)

/** The email of the account signed in, whatever it acts as; none while nobody is. */
const emailOf = (state: SessionState): O.Option<string> =>
  state.status === "signed-out" ? O.none() : O.some(state.email)

/** True when `answer` is the switch the person asked for: the same account, in the organization they chose. */
const isChosen = (input: {
  readonly before: O.Option<SessionState>
  readonly answer: SessionState
  readonly to: O.Option<string>
}): boolean =>
  O.exists(input.to, (to) => O.exists(actorOfSession(input.answer), (actor) => actor.organizationId === to)) &&
  O.exists(O.flatMap(input.before, emailOf), (email) => O.contains(emailOf(input.answer), email))

/** The answer is this page's: starts or drops the first screen, and takes the person back to where their session ended. */
const settled = (answer: SessionState): void => {
  // Not signed in: whatever the hint asked for was asked for the wrong person, and no screen may take it.
  if (answer.status !== "ready") return forgetEarly()
  O.map(takeEnded(actorOfSession(answer)), (at) => navigate(at, { replace: true }))
  // Signed in: the workspace's code and the first screen's data, if the hint did not start them.
  setup.onSignedIn()
}

/**
 * Who is signed in, and as whom they act: one request (`GET /api/v1/identity/session`, always a 200), kept all tab.
 * Asked again while the page is a member's, it goes on being asked when the answer is anybody else: the page is on its
 * way out (`answeredFor`).
 */
export const session: Atom.Atom<AsyncResult.AsyncResult<SessionState, SessionFailure>> = Atom.make((get) => {
  const before = O.flatMap(get.self<AsyncResult.AsyncResult<SessionState, SessionFailure>>(), AsyncResult.value)
  const had = O.flatMap(before, actorOfSession)
  return askSession.pipe(
    Effect.flatMap((answer) => {
      const leave = () => {
        if (answer.status === "signed-out") rememberEnded(had)
        leavePage()
      }
      // A page that is one account's before it has a member (the screen that creates its first organization): anybody
      // else, or nobody, leaves it, so nothing typed there is there for them.
      if (
        O.exists(before, (state) => state.status === "no-organization" && !O.contains(emailOf(answer), state.email))
      ) {
        return Effect.sync(leave).pipe(Effect.andThen(Effect.never))
      }
      return answeredFor({
        answer,
        before: had,
        after: actorOfSession(answer),
        // Read as the answer comes, not as it was asked: a switch pressed while this was already asked is the
        // person's own all the same.
        chosen: isChosen({ before, answer, to: get.registry.get(switchingTo) }),
        leave
      })
    }),
    Effect.tap((answer) =>
      Effect.sync(() => {
        get.set(switchingTo, O.none())
        settled(answer)
      })
    )
  )
}).pipe(Atom.keepAlive)

/**
 * The member this page is for: the session's, kept while the session is asked again and when it could not be read;
 * none before the first answer, while nobody is signed in, and with no organization.
 */
export const actor: Atom.Atom<O.Option<Member>> = Atom.map(session, (result) =>
  memberOfAnswer({ session: result, memberOf: actorOfSession })
)

/**
 * True while who is signed in is not known for certain: asked (again), not read, or the person is switching
 * organization. Nothing is written until it is.
 */
export const signedInAsked: Atom.Atom<boolean> = Atom.readable(
  (get) => askedOfAnswer(get(session)) || O.isSome(get(switchingTo))
)

/** Who is signed in, as the shell draws it: the answer's fields, with "loading" while it is asked (again). */
export interface SessionView {
  /** loading, then signed-out, no-organization or ready (`actor` is set only when ready; once ready, it stays so). */
  readonly status: "loading" | SessionState["status"]
  readonly actor: Member | undefined
  readonly email: string | undefined
  readonly organizations: ReadonlyArray<OrganizationChoice>
  readonly features: SignInFeatures | undefined
  /** No answer yet, and this browser was not signed in last time: draw the sign-in page without waiting. */
  readonly probablySignedOut: boolean
  /** Why the session could not be read, while it is not being asked again; with a member known, they stay. */
  readonly error: unknown
}

/**
 * The session as the shell reads it. The first time it is asked, and after the sign-in page has signed somebody in, it
 * reads as loading until it answers. Asked again while a member is known, it reads as that member: the workspace stays
 * drawn, with whatever is being typed in it.
 */
export const sessionView: Atom.Atom<SessionView> = Atom.map(session, (result): SessionView => {
  const known = result.pipe(AsyncResult.value, O.getOrUndefined)
  const state = result.waiting && known?.status !== "ready" ? undefined : known
  return {
    status: state?.status ?? "loading",
    actor: state?.status === "ready" ? state.actor : undefined,
    email: state === undefined || state.status === "signed-out" ? undefined : state.email,
    organizations: state === undefined || state.status === "signed-out" ? [] : state.organizations,
    features: state?.features,
    probablySignedOut: state === undefined && !wasSignedIn(),
    error: AsyncResult.isFailure(result) && !result.waiting ? Cause.squash(result.cause) : null
  }
})

/**
 * Asks who is signed in again, for a new member (after signing in or creating an organization): every read of the
 * API follows the member, so nothing else has to be emptied.
 */
export const refreshSession = Atom.fnSync((_: void, get) => {
  sayChanged()
  get.refresh(session)
})

/**
 * Asks who is signed in again whenever another tab of this browser says it may have changed, and when this tab is
 * shown, or gains focus, after it was hidden: the cookie is the browser's, not the tab's, and whoever pressed and read
 * here may not be who it names now. Until the answer comes nothing is written (`signedInAsked`), and the server refuses
 * a request named for another member than its cookie's (`pageMemberHeader`). Kept for the page's life.
 */
export const askedWhenChangedElsewhere: Atom.Atom<void> = Atom.readable((get) => {
  if (typeof window === "undefined" || typeof document === "undefined") return
  const ask = () => get.registry.refresh(session)
  const away = { hidden: document.visibilityState === "hidden" }
  const back = () => {
    if (!away.hidden) return
    away.hidden = false
    ask()
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key === changedKey) ask()
  }
  const onVisibility = () => {
    if (document.visibilityState === "hidden") away.hidden = true
    else back()
  }
  window.addEventListener("storage", onStorage)
  window.addEventListener("focus", back)
  document.addEventListener("visibilitychange", onVisibility)
  get.addFinalizer(() => {
    window.removeEventListener("storage", onStorage)
    window.removeEventListener("focus", back)
    document.removeEventListener("visibilitychange", onVisibility)
  })
})

/**
 * Better Auth refused a switch of organization. Its sentence is kept as `message`, for whoever is debugging; the toast
 * says the general sentence, as it did before.
 */
export class SwitchRefused extends S.TaggedError<SwitchRefused, { readonly brand: unique symbol }>()(
  "SwitchRefused",
  { message: S.String },
  $I.annote("SwitchRefused", { description: "Better Auth refused a switch of organization." })
) {}

/**
 * Switches the session to another organization the person belongs to: the server checks the membership, then the
 * session is asked again and every read follows the new member. What must end first as the member of the organization
 * left (an upload's last request) ends before the switch is sent (`beforeOwnSwitch`); from then until the session has
 * answered nothing else is written (`signedInAsked`). Ends when the session has answered.
 */
export const switchOrganization = Atom.fn((organizationId: string, get) =>
  settledBeforeOwnSwitch(get.registry).pipe(
    Effect.andThen(Effect.sync(() => get.set(switchingTo, O.some(organizationId)))),
    Effect.andThen(
      Effect.tryPromise({
        try: () =>
          loadAuthClient().then(({ authClient, orThrow }) =>
            authClient.organization.setActive({ organizationId }).then(orThrow)
          ),
        catch: (cause) =>
          SwitchRefused.make({ message: cause instanceof Error ? cause.message : "The organization was not opened." })
      })
    ),
    Effect.tapError(() => Effect.sync(() => get.set(switchingTo, O.none()))),
    Effect.andThen(() => {
      sayChanged()
      // Said again: an answer that came meanwhile (the session asked again for another reason) ended it.
      get.set(switchingTo, O.some(organizationId))
      get.refresh(session)
      // A session that cannot be read now is asked again by itself, and the switch is taken up then.
      return AtomRegistry.getResult(get.registry, session, { suspendOnWaiting: true }).pipe(Effect.ignore)
    })
  )
)

/**
 * Signs in as another account (a test account, from the person's menu): out of this one, into that one, then a full
 * reload, so nothing the previous person saw stays in memory.
 */
export const signInAs = (account: { readonly email: string; readonly password: string }): Promise<void> =>
  loadAuthClient().then(({ authClient, orThrow }) =>
    authClient
      .signOut()
      .then(() => authClient.signIn.email(account))
      .then(orThrow)
      .then(() => {
        rememberSignedOut(false)
        sayChanged()
        leavePage()
      })
  )

/** Signs out, then a full reload: nothing the previous person saw stays in memory for the next one. */
export const signOut = (): Promise<void> =>
  loadAuthClient().then(({ authClient, orThrow }) =>
    authClient
      .signOut()
      .then(orThrow)
      .then(() => {
        rememberSignedIn(false)
        rememberSignedOut(true)
        sayChanged()
        leavePage()
      })
  )

/**
 * Signs in with an email and a password through Better Auth's own sign-in: a real session, the one the sign-in page
 * makes. For the app's development sign-in as the first test account; the page then asks who is signed in again.
 */
export const signInWithPassword = (account: { readonly email: string; readonly password: string }): Promise<unknown> =>
  loadAuthClient().then(({ authClient, orThrow }) => authClient.signIn.email(account).then(orThrow))
