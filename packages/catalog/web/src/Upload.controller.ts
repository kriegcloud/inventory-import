import { request } from "@inventory/client/Http"
import * as SecureRandom from "effect/crypto/SecureRandom"
// One file on its way in: read in a worker, sent to the server in chunks, turned into an import. The upload lives in
// this module, not in a component, so it carries on while the person opens another page, and there is one per tab.
// The one thing not to break: Cancel stops everything (the worker, every request in flight) and then deletes what
// reached the server, and the screen says it was cancelled only once the server has answered.
import * as Cause from "effect/Cause"
import * as Data from "effect/Data"
import * as Deferred from "effect/Deferred"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Fiber from "effect/Fiber"
import * as HashSet from "effect/HashSet"
import * as O from "effect/Option"
import * as Atom from "effect/reactivity/Atom"
import type * as AtomRegistry from "effect/reactivity/AtomRegistry"
import { invalidate } from "@inventory/client/Api"
import { memberKey } from "@inventory/client/MemberAtoms"
import * as Queue from "effect/Queue"
import * as Result from "effect/Result"
import * as Schedule from "effect/Schedule"
import * as Stream from "effect/Stream"
import * as S from "effect/Schema"
import { toast } from "sonner"
import type { ImportView } from "@inventory/catalog-contract/Import"
import { FileProblem } from "@inventory/catalog-contract/FileProblem"
import { type ImportId, UploadKey } from "@inventory/catalog-contract/Ids"
import { matchedColumn } from "@inventory/catalog-contract/Mapping"
import { requiredFields, type StagedHead, type StagedRow, type StagedTable } from "@inventory/catalog-contract/Staged"
import type { SheetChoice, SheetSummary } from "@inventory/catalog-model/Spreadsheet"
import { savedRows } from "@inventory/catalog-model/Upload"
import { rowsOf, type UploadState } from "./Upload.machine.ts"
import { type Client, fork, runExit, apiPrefixOf } from "./Catalog.runtime.ts"
import { importTable, importView, rememberWorkbook } from "./Imports.atoms.ts"
import { navigate } from "@inventory/ui/Route"
import { importAddress } from "./internal/route.ts"
import type { ReadMessage, ReadRequest } from "./internal/protocol.ts"
import { sayError } from "@inventory/client/SayError"
import { catalogKeys } from "./Catalog.keys.ts"

export type { UploadState } from "./Upload.machine.ts"

/** The reader itself failed (not the file): `message` says so, for the person. */
class ReadFailed extends S.TaggedError<ReadFailed, { readonly brand: unique symbol }>()("ReadFailed", {
  message: S.String
}) {}

/**
 * What the upload can end in short of an import: the file's own problem (from the reader or the server's answer), the
 * reader failing, or a request failing (a typed refusal, the network, an answer that did not decode).
 */
type Refused<K extends "beginUpload" | "putChunk" | "finishUpload"> = Effect.Error<ReturnType<Client["imports"][K]>>
type UploadError = FileProblem | ReadFailed | Refused<"beginUpload"> | Refused<"putChunk"> | Refused<"finishUpload">

/** A staging step's answer: what it made, or the file's problem as this upload's failure. */
const staged = <A, E>(answer: Effect.Effect<Result.Result<A, FileProblem>, E>): Effect.Effect<A, E | FileProblem> =>
  Effect.flatMap(retrying(answer), Effect.fromResult)

/** Pieces sent at once. Three keeps the network busy without queueing work on a server that writes one at a time. */
const inFlight = 3

/** Errors that say something about the request itself; sending it again would get the same answer. */
const final = HashSet.make("UploadNotFound", "Forbidden", "NotSignedIn", "ReadFailed")
const transient = (error: unknown): boolean =>
  !(typeof error === "object" && error !== null && "_tag" in error && HashSet.has(final, String(error._tag)))

/** A request that failed on the network or with a server error is tried three more times, waiting longer each time. */
const retrying = <A, E>(effect: Effect.Effect<A, E>) =>
  effect.pipe(Effect.retry({ schedule: Schedule.exponential("400 millis"), times: 3, while: transient }))

/** Where the upload of this tab stands: kept for the page, as the upload carries on across pages. */
export const uploadState = Atom.make<UploadState>({ _tag: "Idle" }).pipe(Atom.keepAlive)

// The registry the upload reports to: the tab's one, handed over when an upload starts (`startUpload`).
let registry: AtomRegistry.AtomRegistry | undefined
const stateNow = (): UploadState => (registry === undefined ? { _tag: "Idle" } : registry.get(uploadState))
const set = (next: UploadState) => {
  registry?.set(uploadState, next)
  // While the rows are saving, fetch the review's code, so it is ready when the import is.
  if (next._tag === "Saving") void import("./ReviewStep.screen.tsx")
}

/** How an upload ended, for a caller that keeps something until it does (the chosen file, for Continue). */
export type UploadEnd = Data.TaggedEnum<{
  Arrived: {}
  Cancelled: {}
  /** The file itself cannot be staged: reading it again would find the same. */
  Refused: {}
  /** Reading the file or saving its rows failed; a save may work when tried again. */
  Failed: { readonly step: "read" | "save" }
}>
/** Builds and tells apart how an upload ended. */
export const UploadEnd = Data.taggedEnum<UploadEnd>()

/** What is running now: its fiber, the server's id for it once the server has one, and who to tell how it ends. */
let running: {
  fiber: Fiber.Fiber<Finished, UploadError>
  fileName: string
  uploadId: ImportId | null
  onEnd: (end: UploadEnd) => void
} | null = null

type Finished = {
  readonly view: ImportView
  readonly table: StagedTable
  readonly workbook: { readonly sheets: ReadonlyArray<SheetSummary>; readonly chosen: SheetChoice } | null
}

/** The reader worker as a stream of its messages. Closing the stream (done, failed or interrupted) ends the worker. */
const reader = (request: ReadRequest) =>
  Stream.callback<ReadMessage>((queue) =>
    Effect.acquireRelease(
      Effect.sync(() => {
        const worker = new Worker(new URL("./internal/reader.worker.ts", import.meta.url), {
          type: "module",
          name: "spreadsheet-reader"
        })
        worker.onmessage = (event: MessageEvent<ReadMessage>) => {
          Queue.offerUnsafe(queue, event.data)
          const tag = event.data._tag
          if (tag === "Done" || tag === "Refused" || tag === "Crashed") Queue.endUnsafe(queue)
        }
        // The worker's file could not be loaded or crashed: a sentence, not a hang.
        worker.onerror = (event) => {
          event.preventDefault()
          Queue.offerUnsafe(queue, {
            _tag: "Crashed",
            message: `"${request.file.name}" could not be read. Reload the page and choose it again.`
          })
          Queue.endUnsafe(queue)
        }
        worker.postMessage(request)
        return worker
      }),
      (worker) => Effect.sync(() => worker.terminate())
    )
  )

/** Reads `file` in the worker, sends it in chunks as they arrive, and finishes it. Reports each step to the store. */
const program = Effect.fn("upload.program")(function* (client: Client, request: ReadRequest) {
  const fileName = request.file.name
  const begun = yield* Deferred.make<{ readonly id: ImportId; readonly sizes: ReadonlyArray<number> }>()
  const chunks: Array<ReadonlyArray<StagedRow>> = []
  const acknowledged: Array<number> = []
  let head: StagedHead | undefined
  let workbook: Finished["workbook"] = null

  // Every step's own errors (a typed refusal, the network) end the stream the same way, so they are not told apart
  // here: the observer in `start` turns whatever ended it into a sentence.
  const handle = (message: ReadMessage): Effect.Effect<void, UploadError> => {
    switch (message._tag) {
      case "Progress":
        return Effect.sync(() =>
          set({
            _tag: "Reading",
            fileName,
            rowsRead: message.rowsRead,
            rows: rowsOf(message)
          })
        )
      case "Head":
        return Effect.gen(function* () {
          // The sheet crossed the threads as its name or null: the Option is made again here.
          const read: StagedHead = { ...message.head, sheet: O.fromNullOr(message.head.sheet) }
          head = read
          workbook = message.workbook
          const rows = message.chunkSizes.reduce((sum, size) => sum + size, 0)
          // One key for this file: a begin sent again after a lost answer is the same upload on the server, so the
          // begin can be retried like every other step.
          const key = UploadKey.make(SecureRandom.uuidV4Unsafe())
          const { id } = yield* staged(
            client.imports.beginUpload({
              payload: { key, head: read, rowCount: rows, chunkCount: message.chunkSizes.length }
            })
          )
          if (running !== null) running.uploadId = id
          set({ _tag: "Saving", fileName, uploadId: id, rowsSaved: 0, rows })
          yield* Deferred.succeed(begun, { id, sizes: message.chunkSizes })
        })
      case "Chunk":
        return Effect.gen(function* () {
          chunks[message.seq] = message.rows
          const { id, sizes } = yield* Deferred.await(begun)
          yield* staged(client.imports.putChunk({ params: { id }, payload: { seq: message.seq, rows: message.rows } }))
          acknowledged.push(message.seq)
          const rows = sizes.reduce((sum, size) => sum + size, 0)
          set({
            _tag: "Saving",
            fileName,
            uploadId: id,
            rowsSaved: savedRows({ chunkSizes: sizes, acknowledged }),
            rows
          })
        })
      case "Done":
        return Effect.void
      case "Refused": {
        const { kind, fileName: name, problem, todo } = message.problem
        return Effect.fail(FileProblem.make({ kind, fileName: name, problem, todo }))
      }
      case "Crashed":
        return Effect.fail(ReadFailed.make({ message: message.message }))
    }
  }

  yield* reader(request).pipe(Stream.mapEffect(handle, { concurrency: inFlight }), Stream.runDrain)
  const { id, sizes } = yield* Deferred.await(begun)
  const rows = sizes.reduce((sum, size) => sum + size, 0)
  set({ _tag: "Preparing", fileName, uploadId: id, rows })
  const view = yield* staged(client.imports.finishUpload({ params: { id } }))
  if (head === undefined) return yield* Effect.die("the reader sent chunks without a head")
  const table: StagedTable = { ...head, rows: chunks.flat() }
  return { view, table, workbook } satisfies Finished
})

/** Asks the server to delete an upload. Resolves to whether it answered. */
const discard = (uploadId: ImportId): Promise<boolean> =>
  fork((client) => client.imports.discardUpload({ params: { id: uploadId } }))
    .pipe(Fiber.join, runExit)
    .then(Exit.isSuccess)

/** Puts a finished upload where the next screen looks for it, and moves on to it if the person is still here. */
const arrive = (file: File, done: Finished, startedAs: string | undefined) => {
  const { view, table, workbook } = done
  // The person changed organization while the file was on its way: the import belongs to the one they left, and is
  // listed there. Nothing of it is put in place or opened where they are now.
  if (registry?.get(memberKey) !== startedAs) {
    // Said where the person is now, with no way to open it: it is not this organization's to open.
    toast(`${view.fileName} was uploaded for the organization you were in when you chose it. It is listed there.`)
    return
  }
  registry?.set(importView(view.id), view)
  registry?.set(importTable(view.id), table)
  invalidate(catalogKeys.openImports)
  invalidate(catalogKeys.activity)
  if (workbook !== null) rememberWorkbook(view.id, { file, sheets: workbook.sheets, chosen: workbook.chosen })
  // Straight to the review when every required field found its column by heading; to Match when one did not.
  const unmatched = view.mapping.some((entry) => O.isNone(matchedColumn(entry)) && requiredFields.includes(entry.field))
  const next = importAddress(view.id, unmatched ? "match" : "review")
  if (window.location.pathname === "/") navigate(next)
  else toast(`${view.fileName} is ready to review`, { action: { label: "Open", onClick: () => navigate(next) } })
}

/** Starts reading and sending `file`; `onEnd` is told how it ended. Ignored while another upload is under way. */
const start = (file: File, sheet: string | null, onEnd: (end: UploadEnd) => void) => {
  if (running !== null) return
  set({ _tag: "Reading", fileName: file.name, rowsRead: 0, rows: rowsOf({ rowsAbout: null, exact: false }) })
  const fiber = fork((client) => program(client, { file, sheet }))
  const current = {
    fiber,
    fileName: file.name,
    uploadId: null as ImportId | null,
    onEnd,
    // Who the upload was started as: its import is theirs, whoever is signed in when it lands.
    startedAs: registry?.get(memberKey)
  }
  running = current
  fiber.addObserver((exit) => {
    // Cancel handles its own ending.
    if (running !== current || (Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause))) return
    running = null
    if (Exit.isSuccess(exit)) {
      set({ _tag: "Idle" })
      current.onEnd(UploadEnd.Arrived())
      arrive(file, exit.value, current.startedAs)
      return
    }
    const error = Cause.squash(exit.cause)
    // Nothing half-sent stays behind; the server would also delete it within the hour.
    if (current.uploadId !== null) void discard(current.uploadId)
    // The file's own problem is said as data: what is wrong with it and what to do.
    if (S.is(FileProblem)(error)) {
      current.onEnd(UploadEnd.Refused())
      set({ _tag: "Refused", problem: error })
      return
    }
    const read = S.is(ReadFailed)(error)
    current.onEnd(UploadEnd.Failed({ step: read ? "read" : "save" }))
    set({
      _tag: "Failed",
      fileName: file.name,
      step: read ? "read" : "save",
      message: read ? error.message : sayError(error).sentence
    })
  })
}

/**
 * Stops the upload under way: the worker ends, requests in flight are aborted, and what reached the server is
 * deleted. Once the import is being prepared it is too late, and Cancel is not offered then.
 */
const cancel = (): Promise<void> => {
  const current = running
  const state = stateNow()
  if (current === null || state._tag === "Preparing" || state._tag === "Cancelling") return Promise.resolve()
  set({ _tag: "Cancelling", fileName: current.fileName, uploadId: current.uploadId })
  return current.fiber
    .pipe(Fiber.interrupt, runExit)
    .then(() => {
      running = null
      current.onEnd(UploadEnd.Cancelled())
      return current.uploadId === null ? true : discard(current.uploadId)
    })
    .then((answered) => {
      set({ _tag: "Idle" })
      if (answered) toast(`Cancelled. Nothing from ${current.fileName} was saved.`)
      else
        toast.error(
          `Cancelled, but the server could not be reached to delete what arrived. It is never imported and is deleted within the hour.`
        )
    })
}

// Leaving the page mid-upload: ask the server to delete what arrived, in a request that outlives the page.
window.addEventListener("pagehide", () => {
  const id = running?.uploadId
  if (id === null || id === undefined) return
  void request(`${apiPrefixOf()}/imports/uploads/${encodeURIComponent(id)}`, {
    method: "DELETE",
    keepalive: true
  }).catch(() => {})
})

/** What starting an upload takes: the file, the sheet of a workbook, and who to tell how the upload ended. */
export interface UploadStart {
  readonly file: File
  readonly sheet?: string
  readonly onEnd?: (end: UploadEnd) => void
}

/**
 * Starts reading and sending a file, unless another upload is under way. The upload step keeps the chosen file until
 * `onEnd` says how it ended. The upload carries on while the person opens another page.
 */
export const startUpload = Atom.fnSync((input: UploadStart, get) => {
  registry = get.registry
  start(input.file, input.sheet ?? null, input.onEnd ?? (() => {}))
})

/** Stops the upload under way and deletes what reached the server; not offered once the import is being prepared. */
export const cancelUpload = Atom.fnSync((_: void, get) => {
  registry = get.registry
  void cancel()
})

/** Puts away what the last upload said (a problem with the file, a failure), back to choosing a file. */
export const dismissUpload = Atom.fnSync((_: void, get) => {
  registry = get.registry
  set({ _tag: "Idle" })
})
