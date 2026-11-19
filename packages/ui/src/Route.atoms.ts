// The address is the only place the app keeps where the person is: the page in the path, the import and its step
// in the query. A hard refresh therefore lands on the same screen. The rule this file protects (decision "atoms A5"):
// the address is one atom over the app's own `navigate`, so a link, the back button and a refresh behave alike.
import { useAtomValue } from "@effect/atom-react"
import * as Atom from "effect/reactivity/Atom"

const snapshot = () => `${window.location.pathname}${window.location.search}`

// Told when `navigate` changes the address: the atom below, while something reads it.
let followers: ReadonlyArray<() => void> = []

/** The current path and query as one string, following `navigate` and the back and forward buttons. */
export const address: Atom.Atom<string> = Atom.readable((get) => {
  const follow = () => get.setSelf(snapshot())
  followers = [...followers, follow]
  window.addEventListener("popstate", follow)
  get.addFinalizer(() => {
    followers = followers.filter((entry) => entry !== follow)
    window.removeEventListener("popstate", follow)
  })
  return snapshot()
})

/** The current path and query, read apart. */
export const location: Atom.Atom<{ readonly path: string; readonly params: URLSearchParams }> = Atom.map(
  address,
  (at) => {
    const [path = "/", query = ""] = at.split("?")
    return { path, params: new URLSearchParams(query) }
  }
)

/** Goes to an address inside the app without a page load. `replace` keeps the back button on the previous screen. */
export const navigate = (to: string, options?: { replace?: boolean }) => {
  if (to === snapshot()) return
  if (options?.replace === true) window.history.replaceState(null, "", to)
  else window.history.pushState(null, "", to)
  for (const follow of followers) follow()
}

/** `location`, read: for the screens that have not moved to reading the atom themselves (goals/atoms). */
export const useLocation = (): { readonly path: string; readonly params: URLSearchParams } => useAtomValue(location)

/**
 * What a link inside the app takes: the address, and a click that goes there without a page load. A click with a
 * modifier key is left to the browser, so "open in a new tab" still works.
 */
export const linkTo = (to: string, after?: () => void) => ({
  href: to,
  onClick: (event: { metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; preventDefault: () => void }) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey) return
    event.preventDefault()
    navigate(to)
    after?.()
  }
})
