// The browser half of saved progress: the chosen file in IndexedDB, the progress as an atom per key that is the
// browser's own record of it (`Atom.kvs` over `localStorage`), and the hook a screen reads it with. The stored shape
// and its keys are in `SavedProgress.schema.ts`.
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import type * as ManagedRuntime from "effect/ManagedRuntime"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import { useAtomSet, useAtomValue } from "@effect/atom-react"
import * as Atom from "effect/reactivity/Atom"
import { progressKey, type ProgressScope, SavedProgress } from "@inventory/review/SavedProgress"
import { keptRuntime } from "./internal/keptStore.ts"

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

// None is kept as no entry at all (`keptStore.ts`), so Confirm leaves nothing behind.
const Kept = S.OptionFromNullOr(SavedProgress)

/**
 * The progress kept under one key, as the browser's own record of it (`Atom.kvs`): read from storage when first
 * read, written there with every write, so an atom let go and read again finds the same. A stored text that no
 * longer decodes (an older version) reads as none and is replaced by the next write.
 */
const progressAt = Atom.family((key: string) =>
  Atom.kvs({ runtime: keptRuntime, key, schema: Kept, defaultValue: () => O.none<SavedProgress>() })
)

/** No scope yet (the actor still loading): nothing is read or written. */
const noProgress: Atom.Writable<O.Option<SavedProgress>, O.Option<SavedProgress>> = Atom.writable(
  () => O.none(),
  () => undefined
)

/**
 * The progress kept for one scope, as the atom a screen's own atoms read and write (the Review step keeps the undo
 * history there with every decision). With no scope yet nothing is read or written.
 */
export const progressOf = (
  scope: O.Option<ProgressScope>
): Atom.Writable<O.Option<SavedProgress>, O.Option<SavedProgress>> =>
  O.match(scope, { onNone: () => noProgress, onSome: (scope) => progressAt(progressKey(scope)) })

/** The progress to keep after a change: what was kept (or a first record), the change over it, and the time now. */
export const progressWith = (input: {
  readonly before: O.Option<SavedProgress>
  readonly change: Partial<Omit<SavedProgress, "version" | "savedAt">>
}): O.Option<SavedProgress> => {
  const now = DateTime.nowUnsafe()
  return O.match(input.before, {
    onNone: () => O.some(SavedProgress.make({ ...SavedProgress.first(now), ...input.change, savedAt: now })),
    onSome: (before) => O.some(SavedProgress.make({ ...before, ...input.change, savedAt: now }))
  })
}

/**
 * One screen's saved progress for the person signed in. `saved` is what is kept now; `save` merges a change and
 * writes it at once; `keepFile` stores the chosen file; `file` reads it back; `clear` removes all of it (on Confirm,
 * or "Start again"). Where the browser keeps nothing (a private window, a full disk) the progress lasts for the
 * visit and the file is not kept: nothing is said, and the upload goes on. With no
 * scope yet (the actor still loading) nothing is read or written; another person or organization reads their own,
 * never the last one's. `browserRuntime` is the page's one runtime: the file is read and written on it, so a Cancel
 * anywhere interrupts it.
 */
export function useSavedProgress(
  scope: O.Option<ProgressScope>,
  browserRuntime: ManagedRuntime.ManagedRuntime<never, never>
) {
  const at = progressOf(scope)
  const kept = useAtomValue(at)
  const saved = kept
  // Given a function, the setter works the change out from the progress as it stands when written, so two changes in
  // one tick both land.
  const update = useAtomSet(at)

  const save = (change: Partial<Omit<SavedProgress, "version" | "savedAt">>) => {
    if (O.isNone(scope)) return
    update((before) => progressWith({ before, change }))
  }

  const keepFile = (file: File) => {
    if (O.isNone(scope)) return
    browserRuntime.runFork(saveFile(scope.value, file).pipe(Effect.ignore))
  }

  const file = (): Promise<O.Option<File>> =>
    O.match(scope, {
      onNone: () => Promise.resolve(O.none<File>()),
      onSome: (scope) => browserRuntime.runPromise(loadFile(scope).pipe(Effect.orElseSucceed(O.none<File>)))
    })

  const clear = () => {
    if (O.isNone(scope)) return
    update(() => O.none())
    browserRuntime.runFork(dropFile(scope.value).pipe(Effect.ignore))
  }

  return { saved, save, keepFile, file, clear }
}
