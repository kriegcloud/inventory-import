// What this browser keeps for the review between visits (the row height, each import's saved progress), as the
// store `Atom.kvs` reads and writes: the read and the write are the atom's own, and no handler touches storage.
// The one thing a reader must not break: a browser that keeps nothing (a private window, storage turned off, a full
// disk) is not an error on the screen. The value is then held for the visit, and nothing is said.
import { localStore, storedJson, refusal } from "./browser.ts"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as O from "effect/Option"
import * as KeyValueStore from "effect/persistence/KeyValueStore"
import * as Atom from "effect/reactivity/Atom"

/**
 * The browser's storage, or none where reading `localStorage` is itself refused (some private windows). Not
 * `@inventory/client/Storage`, which this package may not use: every call after this one is an `Effect.try` below.
 */
const lookup = localStore

// What `Atom.kvs` writes for a value that is none. Nothing kept is no entry: the key is removed instead.
const nothing = "null"

/** The browser's `localStorage` as a `KeyValueStore`; one that keeps nothing where the browser gives none. */
const browserStore = Layer.sync(KeyValueStore.KeyValueStore)(() => {
  const storage = lookup()
  // With no storage: nothing is read, and a write is refused.
  const reading = <A>(method: string, key: string, read: (kept: Storage) => A, absent: A) =>
    O.match(storage, {
      onNone: () => Effect.succeed(absent),
      onSome: (storage) => Effect.try({ try: () => read(storage), catch: (cause) => refusal({ method, key, cause }) })
    })
  const writing = (method: string, key: string, write: (kept: Storage) => void) =>
    O.match(storage, {
      onNone: () => Effect.fail(refusal({ method, key, cause: "the browser gives no storage" })),
      onSome: (storage) => Effect.try({ try: () => write(storage), catch: (cause) => refusal({ method, key, cause }) })
    })
  return KeyValueStore.makeStringOnly({
    get: (key) => O.match(storage, { onNone: () => Effect.undefined, onSome: storedJson(key) }),
    set: (key, value) =>
      writing("set", key, (kept) => (value === nothing ? kept.removeItem(key) : kept.setItem(key, value))),
    remove: (key) => writing("remove", key, (kept) => kept.removeItem(key)),
    clear: writing("clear", "", (kept) => kept.clear()),
    size: reading("size", "", (kept) => kept.length, 0),
    keys: reading(
      "keys",
      "",
      (kept) => A.getSomes(A.makeBy(kept.length, (n) => O.fromNullOr(kept.key(n)))),
      A.empty<string>()
    )
  })
})

/** The runtime the kept atoms read and write on. */
export const keptRuntime = Atom.runtime(browserStore)
