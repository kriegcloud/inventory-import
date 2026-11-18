import { DateTime } from "effect"
// The browser half of saved progress: the chosen file in IndexedDB and the hook a screen uses. The rules and the
// stored shape are in `store.ts` (tested without a browser).
import { Effect, Option } from "effect"
import * as S from "effect/Schema"
import { useCallback, useMemo, useRef, useState } from "react"
import { browserRuntime } from "../runtime.ts"
import {
  blank,
  progressKey,
  type ProgressScope,
  type ProgressStorage,
  readAt,
  type SavedProgress,
  writeAt
} from "./store.ts"

export * from "./store.ts"

// The chosen file, kept as a Blob in IndexedDB: a whole spreadsheet does not fit localStorage, and a Blob is stored
// without being copied through the page's thread.
const database = "saved-progress"
const files = "files"

/** The browser would not keep or read the chosen file: a private window, a full disk, or storage turned off. */
export class FileNotKept extends S.TaggedError<FileNotKept, { readonly brand: unique symbol }>()("FileNotKept", {}) {}

const openFiles = Effect.callback<IDBDatabase, FileNotKept>((resume) => {
  if (typeof indexedDB === "undefined") return resume(Effect.fail(FileNotKept.make()))
  const request = indexedDB.open(database, 1)
  request.onupgradeneeded = () => request.result.createObjectStore(files)
  request.onsuccess = () => resume(Effect.succeed(request.result))
  request.onerror = () => resume(Effect.fail(FileNotKept.make()))
})

/** One request in its own transaction, answered once the transaction is complete (written, not only queued). */
const inFiles = <A>(mode: IDBTransactionMode, use: (store: IDBObjectStore) => IDBRequest<A>) =>
  Effect.acquireUseRelease(
    openFiles,
    (db) =>
      Effect.callback<A, FileNotKept>((resume) => {
        const transaction = db.transaction(files, mode)
        const request = use(transaction.objectStore(files))
        transaction.oncomplete = () => resume(Effect.succeed(request.result))
        transaction.onerror = () => resume(Effect.fail(FileNotKept.make()))
        transaction.onabort = () => resume(Effect.fail(FileNotKept.make()))
      }),
    (db) => Effect.sync(() => db.close())
  )

/** Keeps the chosen file for one scope, replacing the one kept before. */
export const saveFile = Effect.fn("savedProgress.saveFile")(function* (scope: ProgressScope, file: File) {
  yield* inFiles("readwrite", (store) => store.put(file, progressKey(scope)))
})

/** The file kept for one scope, or none. */
export const loadFile = Effect.fn("savedProgress.loadFile")(function* (scope: ProgressScope) {
  const found = yield* inFiles<unknown>("readonly", (store) => store.get(progressKey(scope)))
  return found instanceof File ? Option.some(found) : Option.none<File>()
})

/** Forgets the file kept for one scope. */
export const dropFile = Effect.fn("savedProgress.dropFile")(function* (scope: ProgressScope) {
  yield* inFiles("readwrite", (store) => store.delete(progressKey(scope)))
})

const browserStorage = (): ProgressStorage | undefined => {
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

/**
 * One screen's saved progress for the person signed in. `saved` is what was there when the screen opened (or after
 * the last `clear`); `save` merges a change and writes it at once; `keepFile` stores the chosen file; `file` reads
 * it back; `clear` removes all of it (on Confirm, or "Start again"). `refused` turns true when the browser would not
 * keep it, so the screen can say so once. With no scope yet (the actor still loading) nothing is read or written.
 */
export function useSavedProgress(scope: ProgressScope | undefined) {
  const key = scope === undefined ? undefined : progressKey(scope)
  const storage = useMemo(browserStorage, [])
  const [refused, setRefused] = useState(false)
  const read = (at: string | undefined) => (at === undefined || storage === undefined ? undefined : readAt(storage, at))
  const [state, setState] = useState<{ key: string | undefined; saved: SavedProgress | undefined }>(() => ({
    key,
    saved: read(key)
  }))
  // Another person or organization: read theirs, never show the last one's.
  const current = state.key === key ? state : { key, saved: read(key) }
  if (current !== state) setState(current)

  // The latest progress, read by `save` so two changes in one tick both land.
  const latest = useRef(current.saved)
  latest.current = current.saved

  const save = useCallback(
    (change: Partial<Omit<SavedProgress, "version" | "savedAt">>) => {
      if (key === undefined) return
      const next: SavedProgress = {
        ...(latest.current ?? blank),
        ...change,
        version: 1,
        savedAt: DateTime.formatIso(DateTime.nowUnsafe())
      }
      latest.current = next
      if (storage === undefined || !writeAt(storage, key, next)) setRefused(true)
      setState({ key, saved: next })
    },
    [key, storage]
  )

  // The scope's ids, kept with the key they make: a new object with the same ids is the same scope.
  const scoped = useMemo(() => scope, [key])

  const keepFile = useCallback(
    (file: File) => {
      if (scoped === undefined) return
      browserRuntime.runFork(saveFile(scoped, file).pipe(Effect.tapError(() => Effect.sync(() => setRefused(true)))))
    },
    [scoped]
  )

  const file = useCallback(
    (): Promise<File | undefined> =>
      scoped === undefined
        ? Promise.resolve(undefined)
        : browserRuntime.runPromise(
            loadFile(scoped).pipe(
              Effect.map(Option.getOrUndefined),
              Effect.orElseSucceed(() => undefined)
            )
          ),
    [scoped]
  )

  const clear = useCallback(() => {
    if (scoped === undefined) return
    storage?.removeItem(progressKey(scoped))
    latest.current = undefined
    browserRuntime.runFork(dropFile(scoped).pipe(Effect.ignore))
    setState({ key: progressKey(scoped), saved: undefined })
  }, [scoped, storage])

  return { saved: current.saved, save, keepFile, file, clear, refused }
}
