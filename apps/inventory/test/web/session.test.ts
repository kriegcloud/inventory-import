// The app's own root atoms and session: what the page holds from its start, and what it does when who is signed in is
// asked again. The same member: everything stays, the page drawn with them all along. Anybody else, another
// organization, nobody: the page is left with a full page load, never having been theirs. And what was typed, chosen or
// open in it is one member's.
import { describe, expect, it } from "@effect/vitest"
import { RegistryContext } from "@effect/atom-react"
import * as A from "effect/Array"
import * as Cause from "effect/Cause"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as MutableRef from "effect/MutableRef"
import * as O from "effect/Option"
import * as Str from "effect/String"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import type * as Atom from "effect/reactivity/Atom"
import type * as AtomRegistry from "effect/reactivity/AtomRegistry"
import { createElement, isValidElement, type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { vi } from "vitest"
import { inNoOrganization, nobody, openPage, signedInAs } from "./support/page.ts"

vi.mock("sonner", () => ({
  toast: Object.assign(() => 0, { dismiss: () => undefined, error: () => 0, loading: () => 0, success: () => 0 })
}))
// Better Auth's client, as the app loads it: a switch of organization the server takes, or refuses.
// A switch the test holds (`hold`) is answered when the test says.
// Read when the app first loads the client, which a test does after this line has run.
const auth: {
  readonly refuses: MutableRef.MutableRef<boolean>
  readonly hold: MutableRef.MutableRef<O.Option<Promise<void>>>
} = { refuses: MutableRef.make(false), hold: MutableRef.make(O.none()) }
vi.mock("../../../../packages/access/web/src/internal/authClient.ts", () => ({
  authClient: {
    organization: {
      setActive: () =>
        MutableRef.get(auth.refuses)
          ? Promise.reject(new Error("Not a member."))
          : O.getOrElse(MutableRef.get(auth.hold), () => Promise.resolve(undefined))
    }
  },
  orThrow: (answer: unknown) => answer
}))

// A cold start of the app's modules, on a busy machine.

const settle = Effect.sleep("30 millis")

/** A page of the app: its modules loaded afresh, its root registry made, and the session asked for the first time. */
const load = (options: Parameters<typeof openPage>[0] = {}) =>
  Effect.suspend(() => {
    const page = openPage(options)
    vi.resetModules()
    return Effect.all(
      [
        Effect.promise(() => import("../../src/web/lib/root.ts")),
        Effect.promise(() => import("@inventory/access-web/Session")),
        Effect.promise(() => import("@inventory/client/MemberAtoms")),
        Effect.promise(() => import("@inventory/ui/Route"))
      ],
      { concurrency: "unbounded" }
    ).pipe(Effect.map(([root, session, member, route]) => ({ page, root, session, member, route })))
  }).pipe(
    Effect.tap(() => settle),
    Effect.map((loaded) => {
      const registry = loaded.root.rootRegistry({ api: Layer.empty })
      const onPurpose: Array<string> = []
      window.addEventListener(loaded.route.leavingApp, () => onPurpose.push("left on purpose"))
      const who = () => registry.get(loaded.member.memberKey)
      const asked = () => registry.get(loaded.member.whoIsSignedInAsked)
      const ask = () => loaded.member.askWhoIsSignedIn(registry)
      const view = () => registry.get(loaded.session.sessionView)
      /** The person picks another organization in the sidebar. */
      const pick = (organization: string) => {
        registry.mount(loaded.session.switchOrganization)
        registry.set(loaded.session.switchOrganization, organization)
      }
      return { ...loaded, registry, onPurpose, who, asked, ask, view, pick }
    }),
    Effect.tap(() => settle)
  )

/** The same page, with its first answer given. */
const loadAs = Effect.fnUntraced(function* (answer: string, options: Parameters<typeof openPage>[0] = {}) {
  const t = yield* load(options)
  t.page.asked[0]?.answer(answer)
  yield* settle
  return t
})

/** The address the page is at. */
const here = () => `${window.location.pathname}${window.location.search}`

describe("the page's start", () => {
  it.live("holds this tab's lock with nobody signed in", () =>
    Effect.gen(function* () {
      const t = yield* loadAs(nobody)
      expect(t.view().status).toBe("signed-out")
      expect(A.map(t.page.locks, (name) => A.headNonEmpty(Str.split(name, ":")))).toEqual([
        "inventory-tab",
        "inventory-taking"
      ])
    })
  )

  it.live("asks the session once, and again when who is signed in is asked", () =>
    Effect.gen(function* () {
      const t = yield* loadAs(signedInAs("dana"))
      expect([t.page.asked.length, t.who(), t.asked()]).toEqual([1, "mem_dana/org_prairie", false])
      t.ask()
      yield* settle
      expect([t.page.asked.length, t.asked()]).toEqual([2, true])
    })
  )
})

describe("who is signed in, asked again", () => {
  it.live("the same member: they stay signed in and drawn all along, and nothing is left", () =>
    Effect.gen(function* () {
      const t = yield* loadAs(signedInAs("dana"))
      const drawn: Array<string> = []
      const members: Array<string> = []
      t.registry.subscribe(t.session.sessionView, (view) => drawn.push(view.status))
      t.registry.subscribe(t.member.member, () => members.push(t.who()))
      t.ask()
      yield* settle
      expect([t.who(), t.view().status]).toEqual(["mem_dana/org_prairie", "ready"])
      t.page.asked[1]?.answer(signedInAs("dana"))
      yield* settle
      expect([t.who(), t.asked(), t.page.left]).toEqual(["mem_dana/org_prairie", false, []])
      expect(A.filter(drawn, (status) => status !== "ready")).toEqual([])
      expect(A.filter(members, (who) => who !== "mem_dana/org_prairie")).toEqual([])
    })
  )

  it.live("anybody else, another organization, nobody or no organization: the page is left, and never theirs", () =>
    Effect.gen(function* () {
      for (const answer of [signedInAs("marcus"), signedInAs("dana", "northline"), nobody, inNoOrganization]) {
        const t = yield* loadAs(signedInAs("dana"))
        const members: Array<string> = []
        t.registry.subscribe(t.member.member, () => members.push(t.who()))
        t.ask()
        yield* settle
        t.page.asked[1]?.answer(answer)
        yield* settle
        // Left on purpose (nothing asks first), and until it has gone: nobody else's, and nothing is sent.
        expect([t.page.left, t.onPurpose]).toEqual([["/"], ["left on purpose"]])
        expect([t.who(), t.asked(), t.view().status]).toEqual(["mem_dana/org_prairie", true, "ready"])
        expect(A.filter(members, (who) => who !== "mem_dana/org_prairie")).toEqual([])
      }
    })
  )

  it.live("a page the browser brings back after it was left is loaded again", () =>
    Effect.gen(function* () {
      const t = yield* loadAs(signedInAs("dana"))
      t.ask()
      yield* settle
      t.page.asked[1]?.answer(nobody)
      yield* settle
      window.dispatchEvent(Object.assign(new Event("pageshow"), { persisted: true }))
      expect(t.page.reloads.times).toBe(1)
    })
  )

  it.live("not answered: the member stays, nothing is certain, and it is asked again when the connection is back", () =>
    Effect.gen(function* () {
      const t = yield* loadAs(signedInAs("dana"))
      t.ask()
      yield* settle
      t.page.asked[1]?.fail()
      yield* settle
      expect([t.who(), t.view().status, t.asked(), t.view().error === null]).toEqual([
        "mem_dana/org_prairie",
        "ready",
        true,
        false
      ])
      window.dispatchEvent(new Event("online"))
      yield* settle
      t.page.asked[2]?.answer(signedInAs("dana"))
      yield* settle
      expect([t.page.asked.length, t.asked(), t.view().error, t.page.left]).toEqual([3, false, null, []])
    })
  )

  it.live("asked by somebody signing in where nobody was: the page goes on, as theirs", () =>
    Effect.gen(function* () {
      const t = yield* loadAs(nobody)
      t.registry.mount(t.session.refreshSession)
      t.registry.set(t.session.refreshSession, undefined)
      yield* settle
      expect(t.view().status).toBe("loading")
      t.page.asked[1]?.answer(signedInAs("marcus"))
      yield* settle
      expect([t.who(), t.page.left]).toEqual(["mem_marcus/org_prairie", []])
    })
  )
})

describe("the person's own switch of organization", () => {
  it.live("goes on without a page load, as the member there, and nothing is certain from the press until it has", () =>
    Effect.gen(function* () {
      const t = yield* loadAs(signedInAs("dana"))
      t.pick("org_northline")
      expect([t.asked(), t.page.asked.length]).toEqual([true, 1])
      yield* settle
      t.page.asked[1]?.answer(signedInAs("dana", "northline"))
      yield* settle
      expect([t.who(), t.asked(), t.page.left]).toEqual(["mem_dana/org_northline", false, []])
    })
  )

  it.live("leaves what the address says of the organization behind: an import, a search, a filter", () =>
    Effect.gen(function* () {
      openPage()
      const { addressInAnother } = yield* Effect.promise(() => import("../../src/web/components/app/AppSidebar.tsx"))
      const at = (pathname: string, search: string) => addressInAnother({ pathname, search })
      expect([at("/", "?import=5&step=review"), at("/items", "?search=oak&category=tools"), at("/people", "")]).toEqual(
        ["/", "/items", "/people"]
      )
    })
  )

  it.live("refused by the server: still the same member, and certain again", () =>
    Effect.gen(function* () {
      MutableRef.set(auth.refuses, true)
      const t = yield* loadAs(signedInAs("dana"))
      t.pick("org_northline")
      yield* settle
      expect([t.who(), t.asked(), t.page.asked.length]).toEqual(["mem_dana/org_prairie", false, 1])
      MutableRef.set(auth.refuses, false)
    })
  )

  it.live("answered by somebody else's session in that organization: the page is left", () =>
    Effect.gen(function* () {
      const t = yield* loadAs(signedInAs("dana"))
      t.pick("org_northline")
      yield* settle
      t.page.asked[1]?.answer(signedInAs("marcus", "northline"))
      yield* settle
      expect([t.who(), t.page.left]).toEqual(["mem_dana/org_prairie", ["/"]])
    })
  )
})

describe("a session found ended", () => {
  const ended = Effect.fnUntraced(function* (at: string) {
    const t = yield* loadAs(signedInAs("dana"), { at })
    t.ask()
    yield* settle
    t.page.asked[1]?.answer(nobody)
    yield* settle
    return t.page
  })

  it.live("takes its member back to where they were, once, and the sign-in page says they were signed out", () =>
    Effect.gen(function* () {
      const before = yield* ended("/?import=5&step=review")
      const t = yield* loadAs(nobody, { kept: before.kept, tab: before.tab })
      expect(t.session.sessionEnded()).toBe(true)
      t.registry.mount(t.session.refreshSession)
      t.registry.set(t.session.refreshSession, undefined)
      yield* settle
      t.page.asked[1]?.answer(signedInAs("dana"))
      yield* settle
      expect([here(), t.session.sessionEnded()]).toEqual(["/?import=5&step=review", false])
    })
  )

  it.live("takes nobody else there: a search in the address is the person's own", () =>
    Effect.gen(function* () {
      const before = yield* ended("/items?search=oak")
      const t = yield* loadAs(signedInAs("marcus"), { kept: before.kept, tab: before.tab })
      expect([here(), t.session.sessionEnded()]).toEqual(["/", false])
    })
  )
})

/** What a write reaches in these tests. */
class SaveServer extends Context.Service<SaveServer, { readonly save: Effect.Effect<string> }>()(
  "@inventory/app/test/web/session.test/SaveServer"
) {}

describe("a write pressed on the page", () => {
  it.live("while who is signed in is asked again is never sent as somebody else", () =>
    Effect.gen(function* () {
      const page = openPage()
      vi.resetModules()
      const [root, api, member, http, HttpClient, HttpClientRequest, HttpClientResponse] = yield* Effect.all(
        [
          Effect.promise(() => import("../../src/web/lib/root.ts")),
          Effect.promise(() => import("@inventory/client/Api")),
          Effect.promise(() => import("@inventory/client/MemberAtoms")),
          Effect.promise(() => import("../../src/web/lib/ofThisPage.ts")),
          Effect.promise(() => import("effect/http/HttpClient")),
          Effect.promise(() => import("effect/http/HttpClientRequest")),
          Effect.promise(() => import("effect/http/HttpClientResponse"))
        ],
        { concurrency: "unbounded" }
      )
      const sent: Array<string> = []
      const answers = { status: 401 }
      const client = http.ofThisPage(
        HttpClient.make((request) =>
          Effect.sync(() => {
            sent.push(request.method)
            return HttpClientResponse.fromWeb(request, new Response(null, { status: answers.status }))
          })
        )
      )
      const layer = Layer.succeed(SaveServer, {
        save: client
          .execute(HttpClientRequest.post("http://localhost/api/v1/items"))
          .pipe(Effect.as("saved"), Effect.orDie)
      })
      const save = api.makeApiAtoms(SaveServer).write<void>()((one) => one.save, {})
      const registry = root.rootRegistry({ api: layer })
      yield* settle
      page.asked[0]?.answer(signedInAs("dana"))
      yield* settle
      registry.mount(save)
      // The server says nobody is signed in: who is signed in is asked again, once.
      registry.set(save, undefined)
      yield* settle
      expect([sent.length, page.asked.length, registry.get(member.whoIsSignedInAsked)]).toEqual([1, 2, true])
      answers.status = 200
      registry.set(save, undefined)
      yield* settle
      expect(sent.length).toBe(1)
      // Who is signed in cannot be read: still not sent. Any answer of the server's says it can be asked again.
      page.asked[1]?.fail()
      yield* settle
      expect([sent.length, page.asked.length]).toEqual([1, 2])
      yield* client.execute(HttpClientRequest.get("http://localhost/api/v1/items")).pipe(Effect.orDie)
      yield* settle
      expect([sent.length, page.asked.length]).toEqual([2, 3])
      // Marcus: the page is left, and what Dana pressed was never sent.
      page.asked[2]?.answer(signedInAs("marcus"))
      yield* settle
      expect([sent, page.left]).toEqual([["POST", "GET"], ["/"]])
    })
  )
})

describe("what is typed, chosen or open", () => {
  it.live("is one member's: kept when the same member is asked again, and gone in another organization", () =>
    Effect.gen(function* () {
      const t = yield* loadAs(signedInAs("dana"))
      const [people, activity, upload, uploading, assistant, machine] = yield* Effect.all(
        [
          Effect.promise(() => import("@inventory/access-web/People")),
          Effect.promise(() => import("../../src/web/pages/ActivityPage.tsx")),
          Effect.promise(() => import("@inventory/catalog-web/UploadStep")),
          Effect.promise(() => import("@inventory/catalog-web/Upload")),
          Effect.promise(() => import("@inventory/catalog-web/TableAssistant")),
          Effect.promise(() => import("@inventory/catalog-web/UploadMachine"))
        ],
        { concurrency: "unbounded" }
      )
      const { registry } = t
      /** A state of a screen that is drawn: what the person put in it, and whether it is there. */
      const held = <A>(atom: Atom.Writable<A>, value: A) => {
        registry.mount(atom)
        registry.set(atom, value)
        return () => registry.get(atom) === value
      }
      const states = [
        held(people.addOpen, true),
        held(people.addEmail, "wen@example.com"),
        held(people.addRole, "viewer"),
        held(activity.chosenView, O.some("events" as const)),
        held(upload.uploadProblem, "items.csv is no longer kept in this browser."),
        held(assistant.assistantOf("Items"), { open: true, prompt: "Only oak" }),
        held(
          uploading.uploadState,
          machine.UploadState.cases.Failed.make({ fileName: "items.csv", step: "save", message: "The network." })
        )
      ]
      t.ask()
      yield* settle
      t.page.asked[1]?.answer(signedInAs("dana"))
      yield* settle
      expect(A.map(states, (there) => there())).toEqual(A.map(states, () => true))
      t.pick("org_northline")
      yield* settle
      t.page.asked[2]?.answer(signedInAs("dana", "northline"))
      yield* settle
      expect([t.who(), A.map(states, (there) => there())]).toEqual([
        "mem_dana/org_northline",
        A.map(states, () => false)
      ])
    })
  )
})

describe("the workspace", () => {
  /** What the sign-in gate draws: the workspace, with the key it is drawn under (if any), or none for anything else. */
  const gate = Effect.fnUntraced(function* (t: { readonly registry: AtomRegistry.AtomRegistry }) {
    const { SignedIn } = yield* Effect.promise(() => import("../../src/web/components/app/SignedIn.tsx"))
    const seen: { drawn: ReactNode } = { drawn: undefined }
    // The gate's own element, read where its hooks run; it is drawn only when it is not the workspace's.
    const Probe = (): ReactNode => {
      seen.drawn = SignedIn({ title: "Inventory import", children: "WORKSPACE" })
      return null
    }
    renderToStaticMarkup(createElement(RegistryContext, { value: t.registry }, createElement(Probe)))
    const { drawn } = seen
    return isValidElement<{ readonly children?: ReactNode }>(drawn) && drawn.props.children === "WORKSPACE"
      ? O.some(O.fromNullOr(drawn.key))
      : O.none()
  })

  it.live("stays drawn, the same one, while who is signed in is asked again and when it could not be read", () =>
    Effect.gen(function* () {
      const t = yield* load()
      const first = yield* gate(t)
      expect(first).toEqual(O.none())
      t.page.asked[0]?.answer(signedInAs("dana"))
      yield* settle
      const answered = yield* gate(t)
      t.ask()
      yield* settle
      const asking = yield* gate(t)
      t.page.asked[1]?.fail()
      yield* settle
      const unread = yield* gate(t)
      expect([answered, asking, unread]).toEqual(A.makeBy(3, () => O.some(O.some("mem_dana/org_prairie"))))
    })
  )

  it.live("is another one, with nothing typed or open in it, in another organization", () =>
    Effect.gen(function* () {
      const t = yield* loadAs(signedInAs("dana"))
      t.pick("org_northline")
      yield* settle
      t.page.asked[1]?.answer(signedInAs("dana", "northline"))
      yield* settle
      const there = yield* gate(t)
      expect(there).toEqual(O.some(O.some("mem_dana/org_northline")))
    })
  )
})

/** What the rows read and the save reach in these tests. */
class RowServer extends Context.Service<
  RowServer,
  { readonly rows: Effect.Effect<string>; readonly save: Effect.Effect<string> }
>()("@inventory/app/test/web/session.test/RowServer") {}

/**
 * A page of the app with the API's client as the app makes it, on a server that keeps one cookie for the browser (whose
 * session it is) and refuses a request named for another member than the cookie's, as the Worker does. `done` is every
 * write the server made, and as whom; the rows are those of whoever the cookie is.
 */
const browserWithServer = Effect.fnUntraced(function* () {
  const page = openPage()
  vi.resetModules()
  const [root, api, member, session, http, HttpClient, HttpClientRequest, HttpClientResponse, Headers] =
    yield* Effect.all(
      [
        Effect.promise(() => import("../../src/web/lib/root.ts")),
        Effect.promise(() => import("@inventory/client/Api")),
        Effect.promise(() => import("@inventory/client/MemberAtoms")),
        Effect.promise(() => import("@inventory/access-web/Session")),
        Effect.promise(() => import("../../src/web/lib/ofThisPage.ts")),
        Effect.promise(() => import("effect/http/HttpClient")),
        Effect.promise(() => import("effect/http/HttpClientRequest")),
        Effect.promise(() => import("effect/http/HttpClientResponse")),
        Effect.promise(() => import("effect/http/Headers"))
      ],
      { concurrency: "unbounded" }
    )
  const server = { cookie: "mem_dana/org_prairie", done: A.empty<string>(), named: A.empty<string>() }
  const client = http.ofThisPage(
    HttpClient.make((request) =>
      Effect.sync(() => {
        const named = O.getOrElse(Headers.get(request.headers, "x-page-member"), () => "")
        server.named.push(`${request.method} for ${named}`)
        if (named !== "" && named !== server.cookie) {
          return HttpClientResponse.fromWeb(request, new Response(null, { status: 401 }))
        }
        if (request.method !== "GET") server.done.push(`${request.method} as ${server.cookie}`)
        return HttpClientResponse.fromWeb(request, new Response(`rows of ${server.cookie}`, { status: 200 }))
      })
    )
  )
  const layer = Layer.succeed(RowServer, {
    rows: client.execute(HttpClientRequest.get("http://localhost/api/v1/items")).pipe(
      Effect.flatMap((response) => response.text),
      Effect.orDie
    ),
    save: client.execute(HttpClientRequest.post("http://localhost/api/v1/items")).pipe(Effect.as("saved"), Effect.orDie)
  })
  const atoms = api.makeApiAtoms(RowServer)
  const rows = atoms.query((one) => one.rows, { keep: "unwatched" })
  const save = atoms.write<void>()((one) => one.save, {})
  const registry = root.rootRegistry({ api: layer })
  yield* settle
  page.asked[0]?.answer(signedInAs("dana"))
  yield* settle
  registry.mount(rows)
  registry.mount(save)
  yield* settle
  /** What the page draws of the rows. */
  const drawn = () => O.getOrElse(AsyncResult.value(registry.get(rows)), () => "nothing")
  /** Another tab of the browser signs in as Marcus: the cookie is his, and that tab says so. */
  const marcusSignsInElsewhere = (said: boolean) => {
    server.cookie = "mem_marcus/org_prairie"
    page.kept[session.changedKey] = "another tab"
    if (said) window.dispatchEvent(Object.assign(new Event("storage"), { key: session.changedKey }))
  }
  return { page, registry, server, rows, save, drawn, marcusSignsInElsewhere, api, member, session }
})

describe("somebody else signed in in another tab of the browser", () => {
  it.live("is asked at once: what Dana presses is never sent as Marcus, and nothing of his is drawn as hers", () =>
    Effect.gen(function* () {
      const t = yield* browserWithServer()
      expect(t.drawn()).toBe("rows of mem_dana/org_prairie")
      t.marcusSignsInElsewhere(true)
      expect([t.page.asked.length, t.registry.get(t.member.whoIsSignedInAsked)]).toEqual([2, true])
      // She presses Save, and the rows are read again, while who is signed in is asked.
      t.registry.set(t.save, undefined)
      t.registry.refresh(t.rows)
      yield* settle
      t.page.asked[1]?.answer(signedInAs("marcus"))
      yield* settle
      expect(t.page.left).toEqual(["/"])
      expect([t.server.done, t.drawn(), t.registry.get(t.member.memberKey)]).toEqual([
        [],
        "rows of mem_dana/org_prairie",
        "mem_dana/org_prairie"
      ])
    })
  )

  it.live("before this tab has heard of it: the server refuses what is named for Dana, and nothing is taken", () =>
    Effect.gen(function* () {
      const t = yield* browserWithServer()
      t.marcusSignsInElsewhere(false)
      t.registry.set(t.save, undefined)
      t.registry.refresh(t.rows)
      yield* settle
      // Both went named for Dana, were refused, and wait for who is signed in, which is asked once.
      expect([t.server.named.slice(-2), t.page.asked.length]).toEqual([
        ["POST for mem_dana/org_prairie", "GET for mem_dana/org_prairie"],
        2
      ])
      // Neither is said as failed meanwhile: the save is on its way, and the rows are Dana's, being read.
      expect([t.registry.get(t.save).waiting, AsyncResult.isFailure(t.registry.get(t.rows))]).toEqual([true, false])
      t.page.asked[1]?.answer(signedInAs("marcus"))
      yield* settle
      expect([t.page.left, t.server.done, t.drawn()]).toEqual([["/"], [], "rows of mem_dana/org_prairie"])
    })
  )

  it.live("as Dana again (the cookie changed back): what she pressed is sent once more, as her", () =>
    Effect.gen(function* () {
      const t = yield* browserWithServer()
      t.marcusSignsInElsewhere(false)
      t.registry.set(t.save, undefined)
      yield* settle
      t.server.cookie = "mem_dana/org_prairie"
      t.page.asked[1]?.answer(signedInAs("dana"))
      yield* settle
      expect([t.page.left, t.server.done]).toEqual([[], ["POST as mem_dana/org_prairie"]])
    })
  )

  it.live("is asked again when this tab is shown, or gains focus, after it was hidden", () =>
    Effect.gen(function* () {
      const t = yield* loadAs(signedInAs("dana"))
      window.dispatchEvent(new Event("focus"))
      document.dispatchEvent(new Event("visibilitychange"))
      expect(t.page.asked.length).toBe(1)
      Object.assign(document, { visibilityState: "hidden" })
      document.dispatchEvent(new Event("visibilitychange"))
      Object.assign(document, { visibilityState: "visible" })
      document.dispatchEvent(new Event("visibilitychange"))
      expect(t.page.asked.length).toBe(2)
      Object.assign(document, { visibilityState: "hidden" })
      document.dispatchEvent(new Event("visibilitychange"))
      window.dispatchEvent(new Event("focus"))
      expect(t.page.asked.length).toBe(3)
      // Another key of the browser's storage is nobody's sign-in.
      window.dispatchEvent(Object.assign(new Event("storage"), { key: "theme" }))
      expect(t.page.asked.length).toBe(3)
    })
  )

  it.live("is told by this tab at its own switch, and when it finds the session ended", () =>
    Effect.gen(function* () {
      const t = yield* loadAs(signedInAs("dana"))
      const said = () => t.page.kept[t.session.changedKey]
      expect(said()).toBeUndefined()
      t.pick("org_northline")
      yield* settle
      const atSwitch = said()
      t.page.asked[1]?.answer(signedInAs("dana", "northline"))
      yield* settle
      t.ask()
      yield* settle
      t.page.asked[2]?.answer(nobody)
      yield* settle
      expect([atSwitch === undefined, said() === atSwitch, t.page.left]).toEqual([false, false, ["/"]])
    })
  )
})

describe("the person's own switch, pressed while who is signed in is already asked", () => {
  it.live("is hers when that ask answers in the organization she chose: nothing is left, and nothing reloaded", () =>
    Effect.gen(function* () {
      const held = Promise.withResolvers<void>()
      MutableRef.set(auth.hold, O.some(held.promise))
      const t = yield* loadAs(signedInAs("dana"))
      t.ask()
      yield* settle
      t.pick("org_northline")
      yield* settle
      // The server took the switch before the earlier ask: it answers her, in Northline, before the switch has.
      t.page.asked[1]?.answer(signedInAs("dana", "northline"))
      yield* settle
      expect([t.page.left, t.who()]).toEqual([[], "mem_dana/org_northline"])
      held.resolve()
      MutableRef.set(auth.hold, O.none())
      yield* settle
      t.page.asked[2]?.answer(signedInAs("dana", "northline"))
      yield* settle
      expect([t.page.left, t.who(), t.asked()]).toEqual([[], "mem_dana/org_northline", false])
    })
  )

  it.live("answered there for somebody else's account: the page is left", () =>
    Effect.gen(function* () {
      const held = Promise.withResolvers<void>()
      MutableRef.set(auth.hold, O.some(held.promise))
      const t = yield* loadAs(signedInAs("dana"))
      t.ask()
      yield* settle
      t.pick("org_northline")
      yield* settle
      t.page.asked[1]?.answer(signedInAs("marcus", "northline"))
      yield* settle
      expect(t.page.left).toEqual(["/"])
      held.resolve()
      MutableRef.set(auth.hold, O.none())
    })
  )

  it.live("a write she pressed for the organization she left is said as not sent, in words", () =>
    Effect.gen(function* () {
      const held = Promise.withResolvers<void>()
      MutableRef.set(auth.hold, O.some(held.promise))
      const t = yield* browserWithServer()
      const { sayError } = yield* Effect.promise(() => import("@inventory/client/SayError"))
      const pick = () => {
        t.registry.mount(t.session.switchOrganization)
        t.registry.set(t.session.switchOrganization, "org_northline")
      }
      pick()
      yield* settle
      t.registry.set(t.save, undefined)
      yield* settle
      t.server.cookie = "mem_dana/org_northline"
      held.resolve()
      MutableRef.set(auth.hold, O.none())
      yield* settle
      t.page.asked[1]?.answer(signedInAs("dana", "northline"))
      yield* settle
      const result = t.registry.get(t.save)
      expect(t.server.done).toEqual([])
      expect(AsyncResult.isFailure(result) ? sayError(Cause.squash(result.cause), { fields: {} }) : "sent").toEqual({
        title: "That did not work",
        sentence:
          "You opened another organization before it was sent, so it was not sent and nothing was changed. Switch back to do it there.",
        problems: []
      })
    })
  )
})

describe("a read refused while the person switches organization", () => {
  it.live("is not taken where she went, and is read again when she is back: never left as being read for good", () =>
    Effect.gen(function* () {
      const t = yield* browserWithServer()
      const go = Effect.fnUntraced(function* (organization: "prairie" | "northline") {
        t.registry.mount(t.session.switchOrganization)
        t.registry.set(t.session.switchOrganization, `org_${organization}`)
        t.server.cookie = `mem_dana/org_${organization}`
        // A read of the organization she is leaving goes out before the switch's own answer is back.
        t.registry.refresh(t.rows)
        yield* settle
        t.page.asked[t.page.asked.length - 1]?.answer(signedInAs("dana", organization))
        yield* settle
      })
      yield* go("northline")
      expect([t.registry.get(t.member.memberKey), t.page.left]).toEqual(["mem_dana/org_northline", []])
      const before = t.server.named.length
      yield* go("prairie")
      expect(t.registry.get(t.member.memberKey)).toBe("mem_dana/org_prairie")
      expect(A.contains(t.server.named.slice(before), "GET for mem_dana/org_prairie")).toBe(true)
      expect([t.drawn(), t.registry.get(t.rows).waiting]).toEqual(["rows of mem_dana/org_prairie", false])
    })
  )
})

describe("leaving the page", () => {
  it.live("lets every read the person held go from memory", () =>
    Effect.gen(function* () {
      const t = yield* browserWithServer()
      expect(t.api.heldReadMembers()).toEqual(["mem_dana/org_prairie"])
      t.member.askWhoIsSignedIn(t.registry)
      yield* settle
      t.page.asked[1]?.answer(signedInAs("marcus"))
      yield* settle
      expect([t.page.left, t.api.heldReadMembers()]).toEqual([["/"], []])
    })
  )
})

describe("the screen that creates a first organization", () => {
  const otherAccount = `{"status":"no-organization","email":"ada@example.com","organizations":[],"features":{"testAccounts":null,"pwnedPasswordCheck":false,"signUp":"closed"}}`

  it.live("is one account's: another account, or nobody, leaves it, so nothing typed there is theirs", () =>
    Effect.gen(function* () {
      for (const answer of [otherAccount, nobody, signedInAs("marcus")]) {
        const t = yield* loadAs(inNoOrganization)
        t.ask()
        yield* settle
        t.page.asked[1]?.answer(answer)
        yield* settle
        expect(t.page.left).toEqual(["/"])
      }
      // The same account, once its organization is made: it goes on, as theirs.
      const t = yield* loadAs(inNoOrganization)
      t.ask()
      yield* settle
      t.page.asked[1]?.answer(signedInAs("dana"))
      yield* settle
      expect([t.page.left, t.who()]).toEqual([[], "mem_dana/org_prairie"])
    })
  )
})
