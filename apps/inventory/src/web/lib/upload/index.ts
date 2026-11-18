import { request } from "../http.ts"
import { SecureRandom } from "effect/crypto"
// One file on its way in: read in a worker, sent to the server in chunks, turned into an import. The upload lives in
// this module, not in a component, so it carries on while the person opens another page, and there is one per tab.
// The one thing not to break: Cancel stops everything (the worker, every request in flight) and then deletes what
// reached the server, and the screen says it was cancelled only once the server has answered.
import { useQueryClient, type QueryClient } from "@tanstack/react-query"
import { Cause, Deferred, Effect, Exit, Fiber, HashSet, MutableHashSet, Queue, Result, Schedule, Stream } from "effect"
import * as S from "effect/Schema"
import { useCallback, useSyncExternalStore } from "react"
import { toast } from "sonner"
import type { ImportView } from "../../../api/v1/Api.ts"
import { apiPrefix } from "../../../api/v1/Version.ts"
import { FileProblem } from "../../../domain/FileProblem.ts"
import { requiredFields, type StagedHead, type StagedRow, type StagedTable } from "../../../domain/ItemImport.ts"
import type { SheetChoice, SheetSummary } from "../../../domain/Spreadsheet.ts"
import { savedRows, type UploadState } from "../../../domain/Upload.ts"
import { type Client, fork, runExit } from "../api.ts"
import { rememberWorkbook } from "../imports.ts"
import { importAddress, navigate } from "../route.ts"
import type { ReadMessage, ReadRequest } from "./protocol.ts"
import { sayError } from "../errors.ts"
import { queryKeys } from "../queries.ts"

export type { UploadState } from "../../../domain/Upload.ts"

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

// The store: one state, and whoever is drawing it.
let state: UploadState = { _tag: "Idle" }
const listeners = MutableHashSet.empty<() => void>()
const set = (next: UploadState) => {
  state = next
  for (const listener of listeners) listener()
}
const subscribe = (listener: () => void) => {
  MutableHashSet.add(listeners, listener)
  return () => {
    MutableHashSet.remove(listeners, listener)
  }
}

/** How an upload ended, for a caller that keeps something until it does (the chosen file, for Continue). */
export type UploadEnd =
  | { readonly _tag: "Arrived" }
  | { readonly _tag: "Cancelled" }
  /** The file itself cannot be staged: reading it again would find the same. */
  | { readonly _tag: "Refused" }
  | Failure

type Failure = { readonly _tag: "Failed"; readonly step: "read" | "save" }

/** What is running now: its fiber, the server's id for it once the server has one, and who to tell how it ends. */
let running: {
  fiber: Fiber.Fiber<Finished, UploadError>
  fileName: string
  uploadId: string | null
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
        const worker = new Worker(new URL("./reader.worker.ts", import.meta.url), {
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
  const begun = yield* Deferred.make<{ readonly id: string; readonly sizes: ReadonlyArray<number> }>()
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
            rowsAbout: message.rowsAbout,
            exact: message.exact
          })
        )
      case "Head":
        return Effect.gen(function* () {
          head = message.head
          workbook = message.workbook
          const rows = message.chunkSizes.reduce((sum, size) => sum + size, 0)
          // One key for this file: a begin sent again after a lost answer is the same upload on the server, so the
          // begin can be retried like every other step.
          const key = SecureRandom.uuidV4Unsafe()
          const { id } = yield* staged(
            client.imports.beginUpload({
              payload: { key, head: message.head, rowCount: rows, chunkCount: message.chunkSizes.length }
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
const discard = (uploadId: string): Promise<boolean> =>
  runExit(Fiber.join(fork((client) => client.imports.discardUpload({ params: { id: uploadId } })))).then(Exit.isSuccess)

/** Puts a finished upload where the next screen looks for it, and moves on to it if the person is still here. */
const arrive = (queryClient: QueryClient, file: File, done: Finished) => {
  const { view, table, workbook } = done
  queryClient.setQueryData(queryKeys.import(view.id), view)
  queryClient.setQueryData(queryKeys.importTable(view.id), table)
  void queryClient.invalidateQueries({ queryKey: queryKeys.openImports })
  void queryClient.invalidateQueries({ queryKey: queryKeys.activity })
  if (workbook !== null) rememberWorkbook(view.id, { file, sheets: workbook.sheets, chosen: workbook.chosen })
  // Straight to the review when every required field found its column by heading; to Match when one did not.
  const unmatched = view.mapping.some((entry) => entry.column === null && requiredFields.includes(entry.field))
  const next = importAddress(view.id, unmatched ? "match" : "review")
  if (window.location.pathname === "/") navigate(next)
  else toast(`${view.fileName} is ready to review`, { action: { label: "Open", onClick: () => navigate(next) } })
}

/** Starts reading and sending `file`; `onEnd` is told how it ended. Ignored while another upload is under way. */
const start = (queryClient: QueryClient, file: File, sheet: string | null, onEnd: (end: UploadEnd) => void) => {
  if (running !== null) return
  set({ _tag: "Reading", fileName: file.name, rowsRead: 0, rowsAbout: null, exact: false })
  const fiber = fork((client) => program(client, { file, sheet }))
  const current = { fiber, fileName: file.name, uploadId: null as string | null, onEnd }
  running = current
  fiber.addObserver((exit) => {
    // Cancel handles its own ending.
    if (running !== current || (Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause))) return
    running = null
    if (Exit.isSuccess(exit)) {
      set({ _tag: "Idle" })
      current.onEnd({ _tag: "Arrived" })
      arrive(queryClient, file, exit.value)
      return
    }
    const error = Cause.squash(exit.cause)
    // Nothing half-sent stays behind; the server would also delete it within the hour.
    if (current.uploadId !== null) void discard(current.uploadId)
    // The file's own problem is said as data: what is wrong with it and what to do.
    if (S.is(FileProblem)(error)) {
      current.onEnd({ _tag: "Refused" })
      set({ _tag: "Refused", problem: error })
      return
    }
    const read = S.is(ReadFailed)(error)
    current.onEnd({ _tag: "Failed", step: read ? "read" : "save" })
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
  if (current === null || state._tag === "Preparing" || state._tag === "Cancelling") return Promise.resolve()
  set({ _tag: "Cancelling", fileName: current.fileName, uploadId: current.uploadId })
  return runExit(Fiber.interrupt(current.fiber))
    .then(() => {
      running = null
      current.onEnd({ _tag: "Cancelled" })
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
  void request(`${apiPrefix}/imports/uploads/${encodeURIComponent(id)}`, { method: "DELETE", keepalive: true }).catch(
    () => {}
  )
})

const ignore = () => {}

/**
 * The upload of this tab: where it stands, and how to start or cancel one. `start` takes the file, the sheet of a
 * workbook, and who to tell how the upload ended (the upload step keeps the chosen file until then).
 */
export function useUpload() {
  const current = useSyncExternalStore(subscribe, () => state)
  const queryClient = useQueryClient()
  const begin = useCallback(
    (file: File, sheet?: string, onEnd: (end: UploadEnd) => void = ignore) =>
      start(queryClient, file, sheet ?? null, onEnd),
    [queryClient]
  )
  return { state: current, start: begin, cancel: () => void cancel(), dismiss: () => set({ _tag: "Idle" }) }
}
