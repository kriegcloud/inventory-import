// The browser half of saved progress: the chosen file in IndexedDB, the progress as an atom per key over the
// browser's storage, and the hook a screen reads it with. The rules and the
// stored shape are in `SavedProgress.schema.ts` (tested without a browser).
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import type * as ManagedRuntime from "effect/ManagedRuntime"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import { useAtomSet, useAtomValue } from "@effect/atom-react"
import * as Atom from "effect/reactivity/Atom"
import {
  progressKey,
  type ProgressScope,
  type ProgressStorage,
  readAt,
  SavedProgress,
  writeAt
} from "@inventory/review/SavedProgress"

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
  return found instanceof File ? O.some(found) : O.none<File>()
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

/** The browser's storage, looked up once: undefined where it is refused (some private windows). */
const storage = browserStorage()

/** True once the browser would not keep progress or a file: the screen says so once. */
const refusedToKeep = Atom.make(false)

/**
 * The progress kept under one key. The browser's storage is the record: the atom reads it, and every write goes to
 * it before the atom shows it, so an atom let go and read again finds the same.
 */
const progressAt = Atom.family((key: string) =>
  Atom.writable(
    () => O.fromUndefinedOr(storage === undefined ? undefined : readAt(storage, key)),
    (ctx, next: O.Option<SavedProgress>) => {
      if (O.isSome(next)) {
        if (storage === undefined || !writeAt(storage, key, next.value)) ctx.set(refusedToKeep, true)
      } else storage?.removeItem(key)
      ctx.setSelf(next)
    }
  )
)

/** No scope yet (the actor still loading): nothing is read or written. */
const noProgress: Atom.Writable<O.Option<SavedProgress>, O.Option<SavedProgress>> = Atom.writable(
  () => O.none(),
  () => undefined
)

/**
 * One screen's saved progress for the person signed in. `saved` is what is kept now; `save` merges a change and
 * writes it at once; `keepFile` stores the chosen file; `file` reads it back; `clear` removes all of it (on Confirm,
 * or "Start again"). `refused` turns true when the browser would not keep it, so the screen can say so once. With no
 * scope yet (the actor still loading) nothing is read or written; another person or organization reads their own,
 * never the last one's. `browserRuntime` is the page's one runtime: the file is read and written on it, so a Cancel
 * anywhere interrupts it.
 */
export function useSavedProgress(
  scope: ProgressScope | undefined,
  browserRuntime: ManagedRuntime.ManagedRuntime<never, never>
) {
  const at = scope === undefined ? noProgress : progressAt(progressKey(scope))
  const kept = useAtomValue(at)
  const saved = O.getOrUndefined(kept)
  // Given a function, the setter works the change out from the progress as it stands when written, so two changes in
  // one tick both land.
  const update = useAtomSet(at)
  const refused = useAtomValue(refusedToKeep)
  const setRefused = useAtomSet(refusedToKeep)

  const save = (change: Partial<Omit<SavedProgress, "version" | "savedAt">>) => {
    if (scope === undefined) return
    update((before) => {
      const now = DateTime.nowUnsafe()
      return O.some(
        SavedProgress.make({ ...O.getOrElse(before, () => SavedProgress.first(now)), ...change, savedAt: now })
      )
    })
  }

  const keepFile = (file: File) => {
    if (scope === undefined) return
    browserRuntime.runFork(saveFile(scope, file).pipe(Effect.tapError(() => Effect.sync(() => setRefused(true)))))
  }

  const file = (): Promise<File | undefined> =>
    scope === undefined
      ? Promise.resolve(undefined)
      : browserRuntime.runPromise(
          loadFile(scope).pipe(
            Effect.map(O.getOrUndefined),
            Effect.orElseSucceed(() => undefined)
          )
        )

  const clear = () => {
    if (scope === undefined) return
    update(() => O.none())
    browserRuntime.runFork(dropFile(scope).pipe(Effect.ignore))
  }

  return { saved, save, keepFile, file, clear, refused }
}
