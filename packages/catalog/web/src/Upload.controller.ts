import { request } from "@inventory/client/Http"
import * as SecureRandom from "effect/crypto/SecureRandom"
// One file on its way in: read in a worker, sent to the server in chunks, turned into an import. The upload lives in
// this module, not in a component, so it carries on while the person opens another page, and there is one per tab.
// The one thing not to break: Cancel stops everything (the worker, every request in flight) and then deletes what
// reached the server, and the screen says it was cancelled only once the server has answered. And an upload is one
// member's: nothing of it is sent while who is signed in is being asked again, nor ever as anybody else. A page left for
// another person's ends it. The person's own switch of organization waits for it (`beforeOwnSwitch`): an upload still
// sending is stopped and what reached the server deleted, one being prepared is let finish, and either is said where
// the person is next, with its true reason; the chosen file stays kept where it was chosen, to be continued there.
import * as Cause from "effect/Cause"
import * as Data from "effect/Data"
import * as Deferred from "effect/Deferred"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Fiber from "effect/Fiber"
import * as O from "effect/Option"
import * as Atom from "effect/reactivity/Atom"
import type * as AtomRegistry from "effect/reactivity/AtomRegistry"
import { invalidate } from "@inventory/client/Api"
import {
  askWhoIsSignedIn,
  beforeOwnSwitch,
  keptOfMember,
  memberKey,
  onceSignedInKnown
} from "@inventory/client/MemberAtoms"
import * as A from "effect/Array"
import { leavingApp } from "@inventory/ui/Route"
import * as Queue from "effect/Queue"
import * as Result from "effect/Result"
import * as Schedule from "effect/Schedule"
import * as Stream from "effect/Stream"
import * as S from "effect/Schema"
import { toast } from "sonner"
import type { ImportView } from "@inventory/catalog-contract/Import"
import { FileProblem } from "@inventory/catalog-contract/FileProblem"
import { type ImportId, UploadKey } from "@inventory/catalog-contract/Ids"
import { UploadNotFound } from "@inventory/catalog-contract/ImportRejection"
import { Forbidden, NotSignedIn } from "@inventory/kernel/AccessError"
import { matchedColumn } from "@inventory/catalog-contract/Mapping"
import { requiredFields, type StagedHead, StagedRow, type StagedTable } from "@inventory/catalog-contract/Staged"
import type { SheetChoice, SheetSummary } from "@inventory/catalog-model/Spreadsheet"
import { savedRows } from "@inventory/catalog-model/Upload"
import { rowsOf, UploadState } from "./Upload.machine.ts"
import { type Client, fork, runExit, apiPrefixOf } from "./Catalog.runtime.ts"
import { importTable, importView, openWorkbook } from "./Imports.atoms.ts"
import { navigate } from "@inventory/ui/Route"
import { importAddress } from "./internal/route.ts"
import { ReadMessage } from "./internal/protocol.ts"
import type { ReadRequest } from "./internal/protocol.ts"
import { sayError } from "@inventory/client/SayError"
import { catalogKeys } from "./Catalog.keys.ts"

export type { UploadState } from "./Upload.machine.ts"

/** The reader itself failed (not the file): `message` says so, for the person. */
class ReadFailed extends S.TaggedError<ReadFailed, { readonly brand: unique symbol }>()("ReadFailed", {
  message: S.String
}) {}

/** The person switched organization while the file was on its way: it was for the one they left. */
class LeftBehind extends S.TaggedError<LeftBehind, { readonly brand: unique symbol }>()("LeftBehind", {}) {}
const isLeftBehind = S.is(LeftBehind)

/**
 * What the upload can end in short of an import: the file's own problem (from the reader or the server's answer), the
 * reader failing, the person leaving its organization, or a request failing (a typed refusal, the network, an answer
 * that did not decode).
 */
type Refused<K extends "beginUpload" | "putChunk" | "finishUpload"> = Effect.Error<ReturnType<Client["imports"][K]>>
type UploadError =
  | FileProblem
  | ReadFailed
  | LeftBehind
  | Refused<"beginUpload">
  | Refused<"putChunk">
  | Refused<"finishUpload">

/**
 * Sends one request of an upload as whoever started it, or not at all: held while who is signed in is being asked
 * (again), and never sent as anybody else. Asked of every try, a retry included.
 */
const asStarter = (input: {
  readonly registry: AtomRegistry.AtomRegistry
  readonly startedAs: string
}): (<A, E>(request: Effect.Effect<A, E>) => Effect.Effect<A, E | LeftBehind>) => {
  const { registry, startedAs } = input
  return (request) =>
    onceSignedInKnown(registry).pipe(
      Effect.andThen((): Effect.Effect<void, LeftBehind> =>
        registry.get(memberKey) === startedAs ? Effect.void : Effect.fail(LeftBehind.make({}))
      ),
      Effect.andThen(request)
    )
}

/** A staging step's answer: what it made, or the file's problem as this upload's failure. */
const staged = <A, E>(answer: Effect.Effect<Result.Result<A, FileProblem>, E>): Effect.Effect<A, E | FileProblem> =>
  Effect.flatMap(retrying(answer), Effect.fromResult)

/** Pieces sent at once. Three keeps the network busy without queueing work on a server that writes one at a time. */
const inFlight = 3

/** Errors that say something about the request itself; sending it again would get the same answer. */
const final = S.Union([UploadNotFound, Forbidden, NotSignedIn, ReadFailed, LeftBehind])
const transient = (error: unknown): boolean => !S.is(final)(error)

/** The reader's last word: the file is read (`Done`), cannot be staged (`Refused`), or the reader failed (`Crashed`). */
const isLast = (message: ReadMessage): boolean =>
  ReadMessage.$match(message, {
    Progress: () => false,
    Head: () => false,
    Chunk: () => false,
    Done: () => true,
    Refused: () => true,
    Crashed: () => true
  })

/** A request that failed on the network or with a server error is tried three more times, waiting longer each time. */
const retrying = <A, E>(effect: Effect.Effect<A, E>) =>
  effect.pipe(Effect.retry({ schedule: Schedule.exponential("400 millis"), times: 3, while: transient }))

/**
 * Where the upload of this tab stands: kept for the page, as the upload carries on across pages. What the last one said
 * (a file that could not be read, a save that failed) is that member's: in another organization nothing is said of it.
 */
export const uploadState = keptOfMember((): UploadState => UploadState.cases.Idle.make({}))

/** Says where the upload stands, in the registry it was started from (the tab's one). */
const set = (registry: AtomRegistry.AtomRegistry, next: UploadState) => {
  registry.set(uploadState, next)
  if (UploadState.isAnyOf(["Preparing", "Cancelling"])(next)) {
    registry.update(
      uploadRunning,
      O.map((now) => ({ ...now, last: true }))
    )
  }
  // While the rows are saving, fetch the review's code, so it is ready when the import is.
  if (UploadState.guards.Saving(next)) void import("./ReviewStep.screen.tsx")
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

/**
 * The upload under way: its fiber, the server's id for it once the server has one, who started it and who to tell
 * how it ends. Kept for the page, as the upload carries on across pages; none while none is under way.
 */
interface Running {
  readonly fiber: Fiber.Fiber<Finished, UploadError>
  readonly fileName: string
  readonly uploadId: ImportId | null
  readonly onEnd: (end: UploadEnd) => void
  /** Who the upload was started as: it is sent as them alone, and its import is theirs. */
  readonly startedAs: string
  /** True once its last request is out (it is being prepared), or it is being cancelled: nothing more to stop. */
  readonly last: boolean
  /** Stops listening for the page being left, and for another organization. */
  readonly stop: () => void
  /** True once the person's own switch of organization waits for it: how it ends is said where they are next. */
  readonly leaving: boolean
  /** Done when it has ended, what reached the server deleted if it did not arrive: what a switch waits for. */
  readonly ended: Deferred.Deferred<void>
}
const uploadRunning = Atom.make<O.Option<Running>>(O.none()).pipe(Atom.keepAlive)

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
          if (isLast(event.data)) Queue.endUnsafe(queue)
        }
        // The worker's file could not be loaded or crashed: a sentence, not a hang.
        worker.onerror = (event) => {
          event.preventDefault()
          Queue.offerUnsafe(
            queue,
            ReadMessage.Crashed({
              message: `"${request.file.name}" could not be read. Reload the page and choose it again.`
            })
          )
          Queue.endUnsafe(queue)
        }
        worker.postMessage(request)
        return worker
      }),
      (worker) => Effect.sync(() => worker.terminate())
    )
  )

const decodeChunk = S.decodeEffect(S.Array(StagedRow))

/** Reads `file` in the worker, sends it in chunks as they arrive, and finishes it. Reports each step to the store. */
const program = Effect.fn("upload.program")(function* (
  registry: AtomRegistry.AtomRegistry,
  client: Client,
  request: ReadRequest,
  startedAs: string
) {
  const fileName = request.file.name
  const mine = asStarter({ registry, startedAs })
  const begun = yield* Deferred.make<{ readonly id: ImportId; readonly sizes: ReadonlyArray<number> }>()
  const chunks: Array<ReadonlyArray<StagedRow>> = []
  const acknowledged: Array<number> = []
  let head: StagedHead | undefined
  let workbook: Finished["workbook"] = null

  // Every step's own errors (a typed refusal, the network) end the stream the same way, so they are not told apart
  // here: the observer in `start` turns whatever ended it into a sentence.
  const handle = (message: ReadMessage): Effect.Effect<void, UploadError> =>
    ReadMessage.$match(message, {
      Progress: (progress) =>
        Effect.sync(() =>
          set(
            registry,
            UploadState.cases.Reading.make({
              fileName,
              rowsRead: progress.rowsRead,
              rows: rowsOf(progress)
            })
          )
        ),
      Head: Effect.fn("Upload.head")(function* (message) {
        // The sheet crossed the threads as its name or null: the Option is made again here.
        const read: StagedHead = { ...message.head, sheet: O.fromNullOr(message.head.sheet) }
        head = read
        workbook = message.workbook
        const rows = message.chunkSizes.reduce((sum, size) => sum + size, 0)
        // One key for this file: a begin sent again after a lost answer is the same upload on the server, so the
        // begin can be retried like every other step.
        const key = UploadKey.make(SecureRandom.uuidV4Unsafe())
        const { id } = yield* client.imports
          .beginUpload({ payload: { key, head: read, rowCount: rows, chunkCount: message.chunkSizes.length } })
          .pipe(mine, staged)
        registry.update(
          uploadRunning,
          O.map((now) => ({ ...now, uploadId: id }))
        )
        set(registry, UploadState.cases.Saving.make({ fileName, uploadId: id, rowsSaved: 0, rows }))
        yield* Deferred.succeed(begun, { id, sizes: message.chunkSizes })
      }),
      Chunk: Effect.fn("Upload.chunk")(function* (message) {
        // The rows crossed the threads in the wire's form (protocol.ts): decoded once here. Our own reader made
        // them, so rows that do not decode are a defect, not the file's problem.
        const decoded = yield* decodeChunk(message.rows).pipe(Effect.orDie)
        chunks[message.seq] = decoded
        const { id, sizes } = yield* Deferred.await(begun)
        yield* client.imports
          .putChunk({ params: { id }, payload: { seq: message.seq, rows: decoded } })
          .pipe(mine, staged)
        acknowledged.push(message.seq)
        const rows = sizes.reduce((sum, size) => sum + size, 0)
        set(
          registry,
          UploadState.cases.Saving.make({
            fileName,
            uploadId: id,
            rowsSaved: savedRows({ chunkSizes: sizes, acknowledged }),
            rows
          })
        )
      }),
      Done: () => Effect.void,
      Refused: ({ problem: { kind, fileName: name, problem, todo } }) =>
        Effect.fail(FileProblem.make({ kind, fileName: name, problem, todo })),
      Crashed: ({ message }) => Effect.fail(ReadFailed.make({ message }))
    })

  yield* reader(request).pipe(Stream.mapEffect(handle, { concurrency: inFlight }), Stream.runDrain)
  const { id, sizes } = yield* Deferred.await(begun)
  const rows = sizes.reduce((sum, size) => sum + size, 0)
  set(registry, UploadState.cases.Preparing.make({ fileName, uploadId: id, rows }))
  const view = yield* client.imports.finishUpload({ params: { id } }).pipe(mine, staged)
  if (head === undefined) return yield* Effect.die("the reader sent chunks without a head")
  const table: StagedTable = { ...head, rows: chunks.flat() }
  return { view, table, workbook } satisfies Finished
})

/** Asks the server to delete an upload, as whoever started it. Resolves to whether it answered. */
const discard = (input: {
  readonly registry: AtomRegistry.AtomRegistry
  readonly startedAs: string
  readonly uploadId: ImportId
}): Promise<boolean> =>
  fork((client) => client.imports.discardUpload({ params: { id: input.uploadId } }).pipe(asStarter(input)))
    .pipe(Fiber.join, runExit)
    .then(Exit.isSuccess)

/** Puts a finished upload where the next screen looks for it, and moves on to it if the person is still here. */
const arrive = (input: {
  readonly registry: AtomRegistry.AtomRegistry
  readonly file: File
  readonly done: Finished
  readonly startedAs: string
  readonly leaving: boolean
}) => {
  const { registry } = input
  const { view, table, workbook } = input.done
  // The person changed organization (or is changing, and the switch waited for this) while the file was being prepared:
  // the import belongs to the one they left, and is listed there. Nothing of it is put in place or opened.
  if (input.leaving || registry.get(memberKey) !== input.startedAs) {
    // Said where the person is now, with no way to open it: it is not this organization's to open.
    toast(`${view.fileName} was uploaded for the organization you were in when you chose it. It is listed there.`)
    return
  }
  registry.set(importView(view.id), view)
  registry.set(importTable(view.id), table)
  invalidate(catalogKeys.openImports)
  invalidate(catalogKeys.activity)
  if (workbook !== null) {
    registry.set(openWorkbook(view.id), O.some({ file: input.file, sheets: workbook.sheets, chosen: workbook.chosen }))
  }
  // Straight to the review when every required field found its column by heading; to Match when one did not.
  const unmatched = view.mapping.some((entry) => O.isNone(matchedColumn(entry)) && requiredFields.includes(entry.field))
  const next = importAddress(view.id, unmatched ? "match" : "review")
  if (window.location.pathname === "/") navigate(next)
  else toast(`${view.fileName} is ready to review`, { action: { label: "Open", onClick: () => navigate(next) } })
}

/** Starts reading and sending `file`; `onEnd` is told how it ended. Ignored while another upload is under way. */
const start = (input: {
  readonly registry: AtomRegistry.AtomRegistry
  readonly file: File
  readonly sheet: string | null
  readonly onEnd: (end: UploadEnd) => void
}) => {
  const { file, registry } = input
  const running = registry.get(uploadRunning)
  if (O.isSome(running)) {
    // The screen of this organization shows no upload: the one under way is another's, on its last request.
    if (running.value.startedAs !== registry.get(memberKey)) {
      toast(`${running.value.fileName} is still being prepared for the organization you chose it in`, {
        description: `Choose ${file.name} again in a moment.`
      })
    }
    return
  }
  set(
    registry,
    UploadState.cases.Reading.make({
      fileName: file.name,
      rowsRead: 0,
      rows: rowsOf({ rowsAbout: null, exact: false })
    })
  )
  const startedAs = registry.get(memberKey)
  const fiber = fork((client) => program(registry, client, { file, sheet: input.sheet }, startedAs))
  /** This upload, while it is still the one under way. */
  const mine = () => O.filter(registry.get(uploadRunning), (now) => now.fiber === fiber)
  /** It was for the organization the person has left: said where they are now, and kept where it was chosen. */
  const leftBehind = () =>
    O.map(mine(), ({ onEnd, stop, ended }) => {
      registry.set(uploadRunning, O.none())
      stop()
      set(registry, UploadState.cases.Idle.make({}))
      // As a save that failed: the chosen file stays kept for the organization it was chosen in, for Continue there.
      onEnd(UploadEnd.Failed({ step: "save" }))
      void toast.error(`${file.name} was not uploaded`, {
        description:
          "You changed organization while it was on its way. It is kept for the one you chose it in: switch back there and continue it."
      })
      Deferred.doneUnsafe(ended, Exit.void)
    })
  /**
   * The person's own switch of organization, pressed while this is under way, before it is sent: still sending, it is
   * stopped and what reached the server is deleted, as their member; its last request out, its answer is waited for.
   */
  const beforeSwitch: Effect.Effect<void> = Effect.suspend(() =>
    O.match(mine(), {
      onNone: () => Effect.void,
      onSome: (running) => {
        registry.update(
          uploadRunning,
          O.map((now) => ({ ...now, leaving: true }))
        )
        if (running.last) return Deferred.await(running.ended)
        return Effect.promise(() =>
          fiber.pipe(Fiber.interrupt, runExit).then(() => {
            const uploadId = O.getOrNull(O.flatMap(mine(), (now) => O.fromNullOr(now.uploadId)))
            return uploadId === null ? true : discard({ registry, startedAs, uploadId })
          })
        ).pipe(Effect.andThen(Effect.sync(leftBehind)))
      }
    })
  )
  registry.update(beforeOwnSwitch, A.append(beforeSwitch))
  // The person is in another organization from now on: nothing more of it is read or sent. Once it is being prepared,
  // its last request is out, and its answer says where it went (`arrive`).
  const unfollow = registry.subscribe(memberKey, (now) => {
    if (now === startedAs || O.exists(mine(), (running) => running.last)) return
    leftBehind()
    void fiber.pipe(Fiber.interrupt, runExit)
  })
  // Leaving the page mid-upload: ask the server to delete what arrived, in a request that outlives the page.
  const onHide = () => {
    const id = O.getOrNull(O.map(mine(), (now) => now.uploadId))
    if (id === null) return
    void request(`${apiPrefixOf()}/imports/uploads/${encodeURIComponent(id)}`, {
      method: "DELETE",
      keepalive: true
    }).catch(() => {})
  }
  // The app itself leaves the page (a sign-out, somebody else signed in): whoever is signed in by then is not who
  // uploaded it, so nothing is asked of the server as them. It deletes what arrived within the hour.
  const onLeave = () => window.removeEventListener("pagehide", onHide)
  window.addEventListener("pagehide", onHide)
  window.addEventListener(leavingApp, onLeave)
  registry.set(
    uploadRunning,
    O.some({
      fiber,
      fileName: file.name,
      uploadId: null,
      onEnd: input.onEnd,
      startedAs,
      last: false,
      leaving: false,
      ended: Deferred.makeUnsafe<void>(),
      stop: () => {
        registry.update(
          beforeOwnSwitch,
          A.filter((work) => work !== beforeSwitch)
        )
        unfollow()
        window.removeEventListener("pagehide", onHide)
        window.removeEventListener(leavingApp, onLeave)
      }
    })
  )
  fiber.addObserver((exit) => {
    const current = mine()
    // Cancel handles its own ending.
    if (O.isNone(current) || (Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause))) return
    const { onEnd, stop, uploadId, leaving, ended } = current.value
    // Nothing of it could be sent any more: who is signed in is another organization of the person's.
    if (Exit.isFailure(exit) && O.exists(Cause.findErrorOption(exit.cause), isLeftBehind)) {
      leftBehind()
      return
    }
    registry.set(uploadRunning, O.none())
    stop()
    if (Exit.isSuccess(exit)) {
      set(registry, UploadState.cases.Idle.make({}))
      onEnd(UploadEnd.Arrived())
      arrive({ registry, file, done: exit.value, startedAs, leaving })
      Deferred.doneUnsafe(ended, Exit.void)
      return
    }
    const error = Cause.squash(exit.cause)
    // Nothing half-sent stays behind, as its member (a switch waits for this); the server would also delete it within
    // the hour.
    const discarded = uploadId === null ? Promise.resolve(true) : discard({ registry, startedAs, uploadId })
    void discarded.then(() => Deferred.doneUnsafe(ended, Exit.void))
    // Nobody is signed in: the page's idea of who is signed in is out of date. The chosen file stays kept, to continue.
    if (S.is(NotSignedIn)(error)) askWhoIsSignedIn(registry)
    // Its own reason, said where the person is next when they are leaving its organization: what the screen holds of
    // it is that organization's, and is let go with it.
    if (leaving || registry.get(memberKey) !== startedAs) {
      void toast.error(`${file.name} was not uploaded`, { description: sayError(error).sentence })
    }
    // The file's own problem is said as data: what is wrong with it and what to do.
    if (S.is(FileProblem)(error)) {
      onEnd(UploadEnd.Refused())
      set(registry, UploadState.cases.Refused.make({ problem: error }))
      return
    }
    const read = S.is(ReadFailed)(error)
    onEnd(UploadEnd.Failed({ step: read ? "read" : "save" }))
    set(
      registry,
      UploadState.cases.Failed.make({
        fileName: file.name,
        step: read ? "read" : "save",
        message: read ? error.message : sayError(error).sentence
      })
    )
  })
}

/**
 * Stops the upload under way: the worker ends, requests in flight are aborted, and what reached the server is
 * deleted. Once the import is being prepared it is too late, and Cancel is not offered then.
 */
const cancel = (registry: AtomRegistry.AtomRegistry): Promise<void> => {
  const running = registry.get(uploadRunning)
  if (O.isNone(running) || UploadState.isAnyOf(["Preparing", "Cancelling"])(registry.get(uploadState))) {
    return Promise.resolve()
  }
  const current = running.value
  set(registry, UploadState.cases.Cancelling.make({ fileName: current.fileName, uploadId: current.uploadId }))
  return current.fiber
    .pipe(Fiber.interrupt, runExit)
    .then(() => {
      // The server may have given the upload its id while the cancel was on its way.
      const uploadId = O.getOrElse(
        O.map(registry.get(uploadRunning), (now) => now.uploadId),
        () => current.uploadId
      )
      registry.set(uploadRunning, O.none())
      current.stop()
      current.onEnd(UploadEnd.Cancelled())
      return uploadId === null ? true : discard({ registry, startedAs: current.startedAs, uploadId })
    })
    .then((answered) => {
      Deferred.doneUnsafe(current.ended, Exit.void)
      set(registry, UploadState.cases.Idle.make({}))
      if (answered) toast(`Cancelled. Nothing from ${current.fileName} was saved.`)
      else
        toast.error(
          `Cancelled, but the server could not be reached to delete what arrived. It is never imported and is deleted within the hour.`
        )
    })
}

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
  start({ registry: get.registry, file: input.file, sheet: input.sheet ?? null, onEnd: input.onEnd ?? (() => {}) })
})

/** Stops the upload under way and deletes what reached the server; not offered once the import is being prepared. */
export const cancelUpload = Atom.fnSync((_: void, get) => {
  void cancel(get.registry)
})

/** Puts away what the last upload said (a problem with the file, a failure), back to choosing a file. */
export const dismissUpload = Atom.fnSync((_: void, get) => {
  set(get.registry, UploadState.cases.Idle.make({}))
})
