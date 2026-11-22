// What this browser keeps for the review between visits (the row height, each import's saved progress), as the
// store `Atom.kvs` reads and writes: the read and the write are the atom's own, and no handler touches storage.
// The one thing a reader must not break: a browser that keeps nothing (a private window, storage turned off, a full
// disk) is not an error on the screen. The value is then held for the visit, and nothing is said.
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as O from "effect/Option"
import * as KeyValueStore from "effect/persistence/KeyValueStore"
import * as Atom from "effect/reactivity/Atom"

/** The browser's storage, or none where reading `localStorage` is itself refused (some private windows). */
const lookup = (): Storage | undefined => {
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

const refusal = (method: string, key: string, cause: unknown) =>
  new KeyValueStore.KeyValueStoreError({ key, method, message: `The browser would not ${method} ${key}`, cause })

// A value kept before values were kept as JSON is a bare word ("comfortable"): it is read as that word.
const bareWord = /^(?!null$|true$|false$)[a-z]+$/
const asJson = (text: string): string => (bareWord.test(text) ? `"${text}"` : text)

// What `Atom.kvs` writes for a value that is none. Nothing kept is no entry: the key is removed instead.
const nothing = "null"

/** The browser's `localStorage` as a `KeyValueStore`; one that keeps nothing where the browser gives none. */
const browserStore = Layer.sync(KeyValueStore.KeyValueStore)(() => {
  const storage = lookup()
  // With no storage: nothing is read, and a write is refused.
  const reading = <A>(method: string, key: string, read: (kept: Storage) => A, absent: A) =>
    storage === undefined
      ? Effect.succeed(absent)
      : Effect.try({ try: () => read(storage), catch: (cause) => refusal(method, key, cause) })
  const writing = (method: string, key: string, write: (kept: Storage) => void) =>
    storage === undefined
      ? Effect.fail(refusal(method, key, "the browser gives no storage"))
      : Effect.try({ try: () => write(storage), catch: (cause) => refusal(method, key, cause) })
  return KeyValueStore.makeStringOnly({
    get: (key) =>
      reading(
        "get",
        key,
        (kept) => {
          const text = kept.getItem(key)
          return text === null ? undefined : asJson(text)
        },
        undefined
      ),
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
