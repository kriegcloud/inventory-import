// An upload is one member's: nothing of it is sent while who is signed in is being asked again, nor ever as anybody
// else. Another organization the person switches to waits for it: still sending, it is stopped, what reached the server
// deleted and said; being prepared, its answer is waited for and said with its own reason. The chosen file is kept where
// it was chosen; a
// page the app leaves for another person asks the server nothing as them; and what the last upload said is not said in
// another organization.
import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Deferred from "effect/Deferred"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as ManagedRuntime from "effect/ManagedRuntime"
import * as Result from "effect/Result"
import { vi } from "vitest"
import { makeApi } from "@inventory/client/ApiRuntime"
import { leavingApp } from "@inventory/ui/Route"
import type { ImportId } from "@inventory/catalog-contract/Ids"
import type { ImportView } from "@inventory/catalog-contract/Import"
import { FileProblem } from "@inventory/catalog-contract/FileProblem"
import { settledBeforeOwnSwitch } from "@inventory/client/MemberAtoms"
import type * as Fiber from "effect/Fiber"
import { type CatalogApiClient, CatalogClient, configureCatalog } from "../src/Catalog.runtime.ts"
import { ReadMessage, type PlainHead } from "../src/internal/protocol.ts"
import { UploadState } from "../src/Upload.machine.ts"
import { startUpload, UploadEnd, uploadState } from "../src/Upload.controller.ts"
import { importId, registryFor, viewAt } from "./support/catalog.ts"
import { memberOf, sessionStandIn } from "./support/session.ts"

// The browser: its window, the reader's worker (the test says what it has read), and what is asked of the server as the
// page goes.
const browser = vi.hoisted(() => {
  const readers: Array<{ onmessage: ((event: { data: unknown }) => void) | null; ended: boolean }> = []
  const asked: Array<string> = []
  class Reader {
    onmessage: ((event: { data: unknown }) => void) | null = null
    onerror: unknown = null
    ended = false
    postMessage() {
      readers.push(this)
    }
    terminate() {
      this.ended = true
    }
  }
  Object.assign(globalThis, {
    Worker: Reader,
    location: { href: "http://localhost/" },
    window: Object.assign(new EventTarget(), {
      location: { pathname: "/items", search: "" },
      history: { pushState: () => undefined, replaceState: () => undefined }
    }),
    fetch: (_address: unknown, init: RequestInit) => {
      asked.push(init.method ?? "")
      return Promise.resolve(new Response(null, { status: 204 }))
    }
  })
  return { readers, asked, said: [] as Array<string>, described: [] as Array<string> }
})
vi.mock("sonner", () => ({
  toast: Object.assign((title: string) => browser.said.push(title), {
    error: (title: string, options?: { readonly description?: string }) => {
      browser.said.push(title)
      browser.described.push(options?.description ?? "")
    },
    dismiss: () => undefined
  })
}))
vi.mock("../src/ReviewStep.screen.tsx", () => ({ ReviewStep: () => null }))

const settle = Effect.sleep("20 millis")
const uploadId = importId as ImportId
const head = {
  fileName: "items.csv",
  kind: "csv",
  headerRowNumber: 1,
  sheet: null,
  columns: [{ index: 0, letter: "A", label: "SKU" }],
  notes: []
} satisfies PlainHead

/** A page on which Dana has chosen a file: the server takes each step, or not until the test says. */
const world = () => {
  const session = sessionStandIn(memberOf({ id: "mem_dana" }))
  const sent: Array<string> = []
  const finished = Deferred.makeUnsafe<Result.Result<ImportView, FileProblem>>()
  const step = <A>(name: string, answer: A) =>
    Effect.sync(() => {
      sent.push(name)
      return Result.succeed(answer)
    })
  // The stand-in holds only the endpoints an upload calls: the rest of the client is never reached.
  const client = {
    imports: {
      beginUpload: () => step("begin", { id: uploadId }),
      putChunk: () => step("chunk", {}),
      finishUpload: () =>
        Effect.suspend(() => {
          sent.push("finish")
          return Deferred.await(finished)
        }),
      discardUpload: () => Effect.sync(() => sent.push("discard"))
    }
  } as unknown as CatalogApiClient
  const registry = registryFor({ endpoints: client, signedIn: session.signedIn, asked: session.asked })
  configureCatalog({
    ...makeApi(ManagedRuntime.make(Layer.succeed(CatalogClient, client)), CatalogClient),
    runtime: ManagedRuntime.make(Layer.empty),
    apiPrefix: "/api/v1"
  })
  browser.said.length = 0
  browser.described.length = 0
  browser.asked.length = 0
  const ended: Array<UploadEnd> = []
  registry.mount(startUpload)
  registry.set(startUpload, { file: new File(["a"], "items.csv"), onEnd: (end) => ended.push(end) })
  const reader = browser.readers[browser.readers.length - 1]!
  const says = (message: ReadMessage) => reader.onmessage?.({ data: message })
  /** The file's head is read: the upload begins. */
  const begin = () => says(ReadMessage.Head({ head: head as never, chunkSizes: [1, 1], workbook: null }))
  const chunk = (seq: number) => says(ReadMessage.Chunk({ seq, rows: [] }))
  /** She picks her other organization, and the session answers it. */
  const switched = Effect.gen(function* () {
    session.choose("org_northline")
    registry.refresh(session.signedIn)
    yield* settle
    yield* session.answer(memberOf({ id: "mem_dana_northline", organization: "org_northline", account: "mem_dana" }))
    yield* settle
  })
  const state = () => registry.get(uploadState)
  return { session, registry, sent, ended, reader, says, begin, chunk, switched, state, finished }
}

describe("an upload", () => {
  it.live("waits while who is signed in is asked again, and goes on once it is the member who started it", () =>
    Effect.gen(function* () {
      const t = world()
      t.begin()
      yield* settle
      t.registry.refresh(t.session.signedIn)
      yield* settle
      t.chunk(0)
      yield* settle
      expect(t.sent).toEqual(["begin"])
      yield* t.session.answer(memberOf({ id: "mem_dana" }))
      yield* settle
      expect(t.sent).toEqual(["begin", "chunk"])
      t.says(ReadMessage.Crashed({ message: "Enough." }))
      yield* settle
    })
  )

  it.live("is not sent as anybody else: the page is left, and nothing more of it goes", () =>
    Effect.gen(function* () {
      const t = world()
      t.begin()
      yield* settle
      t.registry.refresh(t.session.signedIn)
      yield* settle
      t.chunk(0)
      t.chunk(1)
      yield* t.session.answer(memberOf({ id: "mem_marcus" }))
      yield* settle
      // The app leaves the page: what the page asks as it goes would be asked as Marcus.
      window.dispatchEvent(new Event(leavingApp))
      window.dispatchEvent(new Event("pagehide"))
      yield* settle
      expect([t.session.left.times, t.sent, browser.asked]).toEqual([1, ["begin"], []])
    })
  )

  it.live("is deleted on the server when the person closes the page in the middle of it", () =>
    Effect.gen(function* () {
      const t = world()
      t.begin()
      yield* settle
      window.dispatchEvent(new Event("pagehide"))
      yield* settle
      expect(browser.asked).toEqual(["DELETE"])
      t.says(ReadMessage.Crashed({ message: "Enough." }))
      yield* settle
    })
  )

  it.live("is stopped and said in another organization the person switches to, its file kept where it was chosen", () =>
    Effect.gen(function* () {
      const t = world()
      t.begin()
      yield* settle
      t.chunk(0)
      yield* settle
      yield* t.switched
      // At once, whatever the reader reads next.
      expect([t.reader.ended, t.state(), browser.said]).toEqual([
        true,
        UploadState.cases.Idle.make({}),
        ["items.csv was not uploaded"]
      ])
      t.chunk(1)
      yield* settle
      expect([t.sent, browser.said]).toEqual([["begin", "chunk"], ["items.csv was not uploaded"]])
      expect(A.map(t.ended, UploadEnd.$is("Failed"))).toEqual([true])
    })
  )

  it.live("that was being prepared says where its import went, and puts nothing of it in the other organization", () =>
    Effect.gen(function* () {
      const t = world()
      t.begin()
      yield* settle
      t.chunk(0)
      t.chunk(1)
      t.says(ReadMessage.Done())
      yield* settle
      expect(A.last(t.sent)).toEqual(A.last(["finish"]))
      yield* t.switched
      expect(t.state()).toEqual(UploadState.cases.Idle.make({}))
      // Another file chosen here meanwhile is told to wait, not dropped without a word.
      t.registry.set(startUpload, { file: new File(["b"], "more.csv") })
      yield* settle
      expect(browser.said).toEqual(["items.csv is still being prepared for the organization you chose it in"])
      yield* Deferred.succeed(t.finished, Result.succeed(viewAt({ revision: 1, fileName: "items.csv", mapping: [] })))
      yield* settle
      expect(A.last(browser.said)).toEqual(
        A.last(["items.csv was uploaded for the organization you were in when you chose it. It is listed there."])
      )
    })
  )

  it.live("that failed says so to whoever started it, and nothing in another organization", () =>
    Effect.gen(function* () {
      const t = world()
      t.says(ReadMessage.Crashed({ message: '"items.csv" could not be read.' }))
      yield* settle
      expect(UploadState.guards.Failed(t.state())).toBe(true)
      yield* t.switched
      expect(t.state()).toEqual(UploadState.cases.Idle.make({}))
    })
  )
})

/** Whether the switch has stopped waiting. */
const ended = (fiber: Fiber.Fiber<unknown, unknown>): boolean => fiber.pollUnsafe() !== undefined

describe("an upload, when the person presses another organization", () => {
  it.live("still sending: is stopped and what reached the server deleted, as her, before the switch is sent", () =>
    Effect.gen(function* () {
      const t = world()
      t.begin()
      yield* settle
      t.chunk(0)
      yield* settle
      const switching = yield* Effect.forkChild(settledBeforeOwnSwitch(t.registry))
      yield* settle
      // Done before the switch: nothing more is read or sent, and what was staged is deleted.
      expect([ended(switching), t.reader.ended, t.sent]).toEqual([true, true, ["begin", "chunk", "discard"]])
      expect([t.state(), browser.said, A.map(t.ended, UploadEnd.$is("Failed"))]).toEqual([
        UploadState.cases.Idle.make({}),
        ["items.csv was not uploaded"],
        [true]
      ])
      yield* t.switched
      expect(t.sent).toEqual(["begin", "chunk", "discard"])
    })
  )

  it.live("being prepared: the switch waits for its answer, and a refusal is said with its own reason", () =>
    Effect.gen(function* () {
      const t = world()
      t.begin()
      yield* settle
      t.chunk(0)
      t.chunk(1)
      t.says(ReadMessage.Done())
      yield* settle
      const switching = yield* Effect.forkChild(settledBeforeOwnSwitch(t.registry))
      yield* settle
      expect(ended(switching)).toBe(false)
      const refused = FileProblem.make({
        kind: "tooLarge",
        fileName: "items.csv",
        problem: "items.csv has more rows than one import takes.",
        todo: "Split it into files of 5,000 rows or fewer."
      })
      yield* Deferred.succeed(t.finished, Result.fail(refused))
      yield* settle
      expect([ended(switching), A.last(t.sent)]).toEqual([true, A.last(["discard"])])
      expect([browser.said, browser.described]).toEqual([
        ["items.csv was not uploaded"],
        ["items.csv has more rows than one import takes. Split it into files of 5,000 rows or fewer."]
      ])
    })
  )

  it.live("being prepared and arrived: said as listed in the organization it was chosen in, and not opened", () =>
    Effect.gen(function* () {
      const t = world()
      t.begin()
      yield* settle
      t.chunk(0)
      t.chunk(1)
      t.says(ReadMessage.Done())
      yield* settle
      const switching = yield* Effect.forkChild(settledBeforeOwnSwitch(t.registry))
      yield* settle
      yield* Deferred.succeed(t.finished, Result.succeed(viewAt({ revision: 1, fileName: "items.csv", mapping: [] })))
      yield* settle
      expect([ended(switching), browser.said]).toEqual([
        true,
        ["items.csv was uploaded for the organization you were in when you chose it. It is listed there."]
      ])
    })
  )
})
