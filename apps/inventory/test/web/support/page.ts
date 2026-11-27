import { StorageTwin } from "@inventory/ui/StorageTwin"
// A browser's page for the app's own atoms, in Node: the window, its storage and its locks, and a server that answers
// who is signed in when the test says. Opened before anything of the app's is imported: the session is asked for as the
// app starts.
import * as A from "effect/Array"
import * as MutableRef from "effect/MutableRef"

/** What a page did and has, for the test to look at and to set. */
interface Page {
  /** Where the app left the page for, each time it did. */
  readonly left: ReadonlyArray<string>
  /** How many times the page was loaded again as it was. */
  readonly reloads: { readonly times: number }
  /** What the browser keeps for every tab, and for this tab. */
  readonly kept: Record<string, string>
  readonly tab: Record<string, string>
  /** The names of the locks held. */
  readonly locks: ReadonlyArray<string>
  /** The requests that asked who is signed in, oldest first: each is answered when the test says. */
  readonly asked: ReadonlyArray<{ readonly answer: (body: string, status: number) => void; readonly fail: () => void }>
}

const storage = (of: Record<string, string>) => ({
  getItem: (key: string) => StorageTwin.getItem(of, key),
  setItem: (key: string, value: string) => {
    of[key] = value
  },
  removeItem: (key: string) => {
    delete of[key]
  },
  key: (index: number) => {
    let at = 0
    for (const key in of) {
      if (at === index) return key
      at += 1
    }
    return null
  },
  get length() {
    let count = 0
    for (const key in of) if (key !== "") count += 1
    return count
  }
})

/** The page there is now: the browser's `fetch` is one function for good, and each request is that page's. */
const open = MutableRef.make<((request: Page["asked"][number]) => void) | undefined>(undefined)
globalThis.fetch = () => {
  const { promise, reject, resolve } = Promise.withResolvers<Response>()
  MutableRef.get(open)?.({
    answer: (body, status) => resolve(new Response(body, { status, headers: { "content-type": "application/json" } })),
    fail: () => reject(new TypeError("the network"))
  })
  return promise
}

/** A fresh browser page starts here; its stores belong to that page. */
export const pageStart = () => ({ at: "/", kept: {}, tab: {} })

/** Puts a page in place of the one before it, at `at`, with what the browser keeps, and gives what it does. */
export const openPage = (input: {
  readonly at: string
  readonly kept: Record<string, string>
  readonly tab: Record<string, string>
}): Page => {
  const left: Array<string> = []
  const locksHeld: Array<string> = []
  const asked: Array<Page["asked"][number]> = []
  const reloads = MutableRef.make(0)
  const page: Page = {
    left,
    reloads: {
      get times() {
        return MutableRef.get(reloads)
      }
    },
    kept: input.kept,
    tab: input.tab,
    locks: locksHeld,
    asked
  }
  MutableRef.set(open, (request) => {
    asked.push(request)
  })
  const location = {
    pathname: "/",
    search: "",
    href: "http://localhost/",
    assign: (to: string) => left.push(to),
    reload: () => {
      MutableRef.update(reloads, (count) => count + 1)
    }
  }
  const goTo = (_state: unknown, _title: string, to: string) => {
    const url = new URL(to, "http://localhost")
    location.pathname = url.pathname
    location.search = url.search
    location.href = url.href
  }
  goTo(null, "", input.at)
  const window = Object.assign(new EventTarget(), {
    innerWidth: 1440,
    location,
    history: { pushState: goTo, replaceState: goTo },
    localStorage: storage(page.kept),
    sessionStorage: storage(page.tab),
    matchMedia: () => ({ matches: false, addEventListener: () => undefined, removeEventListener: () => undefined })
  })
  const locks = {
    request: (name: string, _options: unknown, callback: (lock: unknown) => Promise<unknown>) =>
      Promise.resolve().then(() => {
        locksHeld.push(name)
        return callback({ name })
      }),
    query: () => Promise.resolve({ held: A.map(page.locks, (name) => ({ name })) })
  }
  Object.assign(globalThis, {
    window,
    location,
    document: Object.assign(new EventTarget(), {
      cookie: "",
      visibilityState: "visible",
      querySelector: () => null
    })
  })
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { locks } })
  return page
}

const features = `"features":{"testAccounts":null,"pwnedPasswordCheck":false,"signUp":"closed"}`
const organizations = `"organizations":[{"id":"org_prairie","name":"Prairie"},{"id":"org_northline","name":"Northline"}]`

/** The session's answer for a member: their account (named in lower case), and the organization they act in. */
export const signedInAs = ({
  who,
  organization
}: {
  readonly who: "dana" | "marcus"
  readonly organization: "prairie" | "northline"
}): string =>
  `{"status":"ready","email":"${who}@example.com","actor":{"id":"mem_${who}","name":"${who}","role":"admin",` +
  `"organizationId":"org_${organization}","organizationName":"${organization}"},${organizations},${features}}`

/** The session's answer when nobody is signed in, and when the account is in no organization. */
export const nobody = `{"status":"signed-out",${features}}`
export const inNoOrganization = `{"status":"no-organization","email":"dana@example.com","organizations":[],${features}}`
