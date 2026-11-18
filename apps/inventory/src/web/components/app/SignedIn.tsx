import { type ReactNode, useEffect, useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { signedOutHere, useActor } from "@/lib/actor"
import { sayError } from "@/lib/errors"
import { CreateOrganization, SignIn } from "@/pages/SignIn"
import { AppShell } from "./AppShell.tsx"

// The sign-in page is drawn with the first paint for a browser that was not signed in last time, without waiting for
// the session answer: Lighthouse on a phone measured mobile Performance at 76 for a sign-in page drawn only once that
// answer (or its own chunk) had arrived, and at 97 drawn at once. Better Auth's browser client is what stays out of
// the first page (`import()` in @/lib/actor and the page).
//
// IN DEVELOPMENT the app opens signed in: when the dev server's session answer offers test accounts (TEST_ACCOUNTS,
// on in development, off in production) and nobody is signed in, the first test account signs in on its own, with
// its password, through Better Auth's own sign-in: a real session, the same one the button on the sign-in page makes.
// The other test accounts are in the person's menu. After a sign-out in this tab it does not happen again, so the
// sign-in page can be seen. A production build has no such branch (`import.meta.env.DEV` is a constant false there).

/** The sign-in card's place, in grey, while the session answer is on its way to a browser that was signed in. */
const Waiting = () => <Skeleton className="mx-auto h-80 w-full max-w-sm" aria-label="Loading who you are" />

/** Signs in as the first test account once, in development, when nobody is signed in and nobody signed out here. */
function useDevelopmentSignIn(): "idle" | "signing-in" | "failed" {
  const { status, features, refresh } = useActor()
  const [state, setState] = useState<"idle" | "signing-in" | "failed">("idle")
  const first = features?.testAccounts?.accounts[0]
  const password = features?.testAccounts?.password
  const wanted =
    import.meta.env.DEV && status === "signed-out" && first !== undefined && password !== undefined && !signedOutHere()
  useEffect(() => {
    if (!wanted || state !== "idle" || first === undefined || password === undefined) return
    setState("signing-in")
    void import("@/lib/auth-client")
      .then(({ authClient, orThrow }) => authClient.signIn.email({ email: first.email, password }).then(orThrow))
      .then(() => refresh())
      .catch((error: unknown) => {
        // The sign-in page is drawn instead, with the test accounts on it; the reason is for whoever is debugging.
        console.error("Signing in as the first test account failed", error)
        setState("failed")
      })
  }, [wanted, state, first, password, refresh])
  return wanted ? state : "idle"
}

/**
 * Shows its children only to a signed-in member of an organization. Anyone else gets the sign-in screen, or the
 * screen that creates their first organization. The server enforces the same rule on every request.
 */
export function SignedIn(props: { title: string; children: ReactNode }) {
  const { status, error, features, probablySignedOut, retry, refresh, signOut } = useActor()
  const development = useDevelopmentSignIn()
  if (status === "ready") return props.children
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
        // Until the answer comes, `features` is undefined: the test accounts appear with it.
        <SignIn features={features} onSignedIn={() => void refresh()} />
      ) : status === "no-organization" ? (
        <CreateOrganization onCreated={() => void refresh()} onSignOut={() => void signOut()} />
      ) : (
        <Waiting />
      )}
    </AppShell>
  )
}
