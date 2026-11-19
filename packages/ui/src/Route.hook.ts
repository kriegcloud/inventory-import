import { useMemo, useSyncExternalStore } from "react"

// The address is the only place the app keeps where the person is: the page in the path, the import and its step
// in the query. A hard refresh therefore lands on the same screen.

// Who is drawing the address. A plain list, not Effect's MutableHashSet: this module is in the sign-in screen's first
// download, which holds no Effect code, and MutableHashSet would add 16.6 kB (6.0 kB gzipped) to it.
let listeners: ReadonlyArray<() => void> = []
const subscribe = (listener: () => void) => {
  listeners = [...listeners, listener]
  window.addEventListener("popstate", listener)
  return () => {
    listeners = listeners.filter((entry) => entry !== listener)
    window.removeEventListener("popstate", listener)
  }
}
const snapshot = () => `${window.location.pathname}${window.location.search}`

/** Goes to an address inside the app without a page load. `replace` keeps the back button on the previous screen. */
export const navigate = (to: string, options?: { replace?: boolean }) => {
  if (to === snapshot()) return
  if (options?.replace === true) window.history.replaceState(null, "", to)
  else window.history.pushState(null, "", to)
  for (const listener of listeners) listener()
}

/** The current path and query, re-rendering when either changes. */
export function useLocation(): { path: string; params: URLSearchParams } {
  const address = useSyncExternalStore(subscribe, snapshot)
  return useMemo(() => {
    const [path = "/", query = ""] = address.split("?")
    return { path, params: new URLSearchParams(query) }
  }, [address])
}

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
