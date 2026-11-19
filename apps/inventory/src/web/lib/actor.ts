import { request } from "@inventory/client/Http"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { sessionPath } from "../../api/v1/Version.ts"
import { preload } from "../preload.ts"
import { forgetEarly } from "@inventory/client/Early"
import { queryKeys, sessionQuery } from "./queries.ts"

// Who is signed in, read through the browser HTTP boundary: this module is in the sign-in screen's first download,
// without the API client or contract. The answer is decoded by a module of its own
// (./session.ts), asked for as this module loads, beside the first session request.

/** Better Auth's browser client, fetched the first time a person signs in, switches or signs out. */
const loadAuthClient = () => import("./auth-client.ts")
const decoder = import("./session.ts")

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
 * (`SignedIn`); after a sign-out it does not, so the sign-in page can be seen and another account chosen there.
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

// Someone was signed in here last time, so they most likely still are: the workspace's code and the first screen's
// data are asked for now, beside the session (which index.html preloads), instead of after its answer.
if (wasSignedIn()) preload()

/**
 * Who is signed in, and as whom they act: one request (`GET /api/v1/identity/session`, always a 200), fetched once
 * and shared by every component that asks. It is fetched again only after signing in, creating an organization or
 * switching organization, and all of those drop every cached query first. Signing out reloads the page.
 */
export function useActor() {
  const queryClient = useQueryClient()
  const session = useQuery({
    queryKey: queryKeys.session,
    queryFn: () =>
      // index.html preloads this address, so the answer is usually on its way before this code runs.
      request(sessionPath, { credentials: "same-origin" }).then((response) => {
        if (!response.ok) throw new Error("The session could not be read. Reload the page.")
        return response.json().then((body: unknown) =>
          decoder
            .then(({ decodeSession }) => decodeSession(body))
            .then((answer) => {
              rememberSignedIn(answer.status !== "signed-out")
              // Signed in: the workspace's code and the first screen's data, if the hint did not start them. Not signed
              // in: whatever the hint asked for was asked for the wrong person, and no screen may take it.
              if (answer.status === "ready") preload()
              else forgetEarly()
              return answer
            })
        )
      }),
    ...sessionQuery
  })
  const state = session.data
  /** Everything cached belonged to the previous person or organization: drop it all and ask again. */
  const refresh = () => queryClient.resetQueries()
  return {
    /** loading, then signed-out, no-organization or ready (`actor` is set only when ready). */
    status: state?.status ?? "loading",
    actor: state?.actor ?? undefined,
    email: state?.email ?? undefined,
    organizations: state?.organizations ?? [],
    features: state?.features,
    /** No answer yet, and this browser was not signed in last time: draw the sign-in page without waiting. */
    probablySignedOut: state === undefined && !wasSignedIn(),
    isPending: session.isPending,
    error: session.error,
    retry: () => void session.refetch(),
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
