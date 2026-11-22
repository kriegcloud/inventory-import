// The app's own root atoms and session: what the page holds from its start, and what it does when who is signed in is
// asked again. The same member: everything stays, the page drawn with them all along. Anybody else, another
// organization, nobody: the page is left with a full page load, never having been theirs. And what was typed, chosen or
// open in it is one member's.
import { describe, expect, it } from "@effect/vitest"
import { RegistryContext } from "@effect/atom-react"
import * as A from "effect/Array"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as O from "effect/Option"
import * as Str from "effect/String"
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
const auth = vi.hoisted(() => ({ refuses: false }))
vi.mock("../../../../packages/access/web/src/internal/authClient.ts", () => ({
  authClient: {
    organization: {
      setActive: () => (auth.refuses ? Promise.reject(new Error("Not a member.")) : Promise.resolve(undefined))
    }
  },
  orThrow: (answer: unknown) => answer
}))

// A cold start of the app's modules, on a busy machine.
vi.setConfig({ testTimeout: 20_000 })

const settle = Effect.sleep("30 millis")

/** A page of the app: its modules loaded afresh, its root registry made, and the session asked for the first time. */
const load = (options: Parameters<typeof openPage>[0] = {}) =>
  Effect.promise(() => {
    const page = openPage(options)
    vi.resetModules()
    return Promise.all([
      import("../../src/web/lib/root.ts"),
      import("@inventory/access-web/Session"),
      import("@inventory/client/MemberAtoms"),
      import("@inventory/ui/Route")
    ]).then(([root, session, member, route]) => ({ page, root, session, member, route }))
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
      auth.refuses = true
      const t = yield* loadAs(signedInAs("dana"))
      t.pick("org_northline")
      yield* settle
      expect([t.who(), t.asked(), t.page.asked.length]).toEqual(["mem_dana/org_prairie", false, 1])
      auth.refuses = false
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
      const [root, api, member, http, HttpClient, HttpClientRequest, HttpClientResponse] = yield* Effect.promise(() =>
        Promise.all([
          import("../../src/web/lib/root.ts"),
          import("@inventory/client/Api"),
          import("@inventory/client/MemberAtoms"),
          import("../../src/web/lib/ofThisPage.ts"),
          import("effect/http/HttpClient"),
          import("effect/http/HttpClientRequest"),
          import("effect/http/HttpClientResponse")
        ])
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
      const save = api.makeApiAtoms(SaveServer).write<void>()((one) => one.save)
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
      const [people, activity, upload, uploading, assistant, machine] = yield* Effect.promise(() =>
        Promise.all([
          import("@inventory/access-web/People"),
          import("../../src/web/pages/ActivityPage.tsx"),
          import("@inventory/catalog-web/UploadStep"),
          import("@inventory/catalog-web/Upload"),
          import("@inventory/catalog-web/TableAssistant"),
          import("@inventory/catalog-web/UploadMachine")
        ])
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
  /** What the sign-in gate draws: the workspace, under which key, or something else. */
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
      ? `workspace of ${drawn.key ?? "nobody"}`
      : "not the workspace"
  })

  it.live("stays drawn, the same one, while who is signed in is asked again and when it could not be read", () =>
    Effect.gen(function* () {
      const t = yield* load()
      const first = yield* gate(t)
      expect(first).toBe("not the workspace")
      t.page.asked[0]?.answer(signedInAs("dana"))
      yield* settle
      const answered = yield* gate(t)
      t.ask()
      yield* settle
      const asking = yield* gate(t)
      t.page.asked[1]?.fail()
      yield* settle
      const unread = yield* gate(t)
      expect([answered, asking, unread]).toEqual(A.makeBy(3, () => "workspace of mem_dana/org_prairie"))
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
      expect(there).toBe("workspace of mem_dana/org_northline")
    })
  )
})
