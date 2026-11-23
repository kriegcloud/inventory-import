import { useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react"
import * as Effect from "effect/Effect"
import * as A from "effect/Array"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import * as Atom from "effect/reactivity/Atom"
import { Fragment, type ReactNode } from "react"
import { Alert, AlertDescription, AlertTitle } from "@inventory/ui/components/alert"
import { Button } from "@inventory/ui/components/button"
import { Skeleton } from "@inventory/ui/components/skeleton"
import { sessionEnded, signedOutHere, signInWithPassword } from "@/lib/actor"
import { refreshSession, session, sessionView, signOut } from "@inventory/access-web/Session"
import { memberKey } from "@inventory/client/MemberAtoms"
import { sayError } from "@inventory/client/SayError"
import { CreateOrganization, SignIn } from "@inventory/access-web/SignIn"
import { AppShell } from "./AppShell.tsx"

// The sign-in page is drawn with the first paint for a browser that was not signed in last time, without waiting for
// the session answer: Lighthouse on a phone measured mobile Performance at 76 for a sign-in page drawn only once that
// answer (or its own chunk) had arrived, and at 97 drawn at once. Better Auth's browser client is what stays out of
// the first page (`import()` in the session controller and the page, @inventory/access-web).
//
// IN DEVELOPMENT the app opens signed in: when the dev server's session answer offers test accounts (TEST_ACCOUNTS,
// on in development, off in production) and nobody is signed in, the first test account signs in on its own, with
// its password, through Better Auth's own sign-in: a real session, the same one the button on the sign-in page makes.
// The other test accounts are in the person's menu. After a sign-out in this tab it does not happen again, so the
// sign-in page can be seen. A production build has no such branch (`import.meta.env.DEV` is a constant false there).

/** The sign-in card's place, in grey, while the session answer is on its way to a browser that was signed in. */
const Waiting = () => <Skeleton className="mx-auto h-80 w-full max-w-sm" aria-label="Loading who you are" />

/**
 * Signs in as the first test account once, in development, when nobody is signed in and nobody signed out here: an
 * atom that does it when read, then asks who is signed in again. "failed" draws the sign-in page instead, with the
 * test accounts on it; the reason is for whoever is debugging.
 */
/** Signing in as the first test account did not work; the sign-in page is drawn instead. */
class DevelopmentSignInFailed extends S.TaggedError<DevelopmentSignInFailed, { readonly brand: unique symbol }>()(
  "DevelopmentSignInFailed",
  { cause: S.Defect() }
) {}

const developmentSignIn = Atom.make((get) => {
  const view = get(sessionView)
  // The first test account the answer offers, with the password they share.
  const first = O.flatMap(
    O.flatMap(view.features, (features) => features.testAccounts),
    (offer) => O.map(A.head(offer.accounts), (account) => ({ email: account.email, password: offer.password }))
  )
  if (!import.meta.env.DEV || view.status !== "signed-out" || O.isNone(first)) {
    return Effect.succeed("idle" as const)
  }
  if (signedOutHere()) return Effect.succeed("idle" as const)
  const { email, password } = first.value
  return Effect.tryPromise({
    try: () => signInWithPassword({ email, password }),
    catch: (cause) => DevelopmentSignInFailed.make({ cause })
  }).pipe(
    Effect.andThen(Effect.sync(() => get.set(refreshSession, undefined))),
    Effect.as("idle" as const),
    Effect.catch((cause) =>
      Effect.logError("Signing in as the first test account failed", cause).pipe(Effect.as("failed" as const))
    )
  )
})

/** Said above the sign-in form when the page before this one was left because its member's session had ended. */
const Ended = () => (
  <Alert className="mx-auto mb-6 max-w-sm">
    <AlertTitle>You were signed out</AlertTitle>
    <AlertDescription>
      Sign in again to go on where you were. Decisions that were not saved yet are kept in this browser, for you.
    </AlertDescription>
  </Alert>
)

/**
 * Shows its children only to a signed-in member of an organization. Anyone else gets the sign-in screen, or the
 * screen that creates their first organization. The server enforces the same rule on every request. Once drawn, they
 * stay drawn while the session is asked again, and are drawn anew, with nothing typed or open in them, for another
 * organization the person switches to.
 */
export function SignedIn(props: { title: string; children: ReactNode }) {
  const { status, error, features, probablySignedOut } = useAtomValue(sessionView)
  const retry = useAtomRefresh(session)
  const refresh = useAtomSet(refreshSession)
  const signingIn = useAtomValue(developmentSignIn)
  const drawnFor = useAtomValue(memberKey)
  // On its way while the sign-in runs; "idle" or "failed" once it has ended or was not wanted.
  const development = AsyncResult.isSuccess(signingIn) && !signingIn.waiting ? signingIn.value : "signing-in"
  if (status === "ready") return <Fragment key={drawnFor}>{props.children}</Fragment>
  return (
    <AppShell title={props.title}>
      {error !== null ? (
        <Alert variant="destructive" className="mx-auto max-w-sm">
          <AlertTitle>Could not open the app</AlertTitle>
          <AlertDescription>
            <p>{sayError(error).sentence}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={retry}>
                Try again
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : development === "signing-in" ? (
        <Waiting />
      ) : status === "signed-out" ||
        // In development the first test account is about to sign in: the placeholder, not a form that vanishes.
        (status === "loading" && probablySignedOut && !(import.meta.env.DEV && !signedOutHere())) ? (
        // Until the answer comes, `features` is none: the test accounts appear with it.
        <>
          {sessionEnded() ? <Ended /> : null}
          <SignIn features={features} onSignedIn={() => refresh()} />
        </>
      ) : status === "no-organization" ? (
        <CreateOrganization onCreated={() => refresh()} onSignOut={() => void signOut()} />
      ) : (
        <Waiting />
      )}
    </AppShell>
  )
}
