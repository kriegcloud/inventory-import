// What this browser keeps for the review between visits (the row height, each import's saved progress), as the
// store `Atom.kvs` reads and writes: the read and the write are the atom's own, and no handler touches storage.
// The one thing a reader must not break: a browser that keeps nothing (a private window, storage turned off, a full
// disk) is not an error on the screen. The value is then held for the visit, and each key whose last write was refused
// is in `refusedKeys`, so that a screen that would say a value is kept can say instead that it is not.
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as HashSet from "effect/HashSet"
import * as Layer from "effect/Layer"
import * as O from "effect/Option"
import * as KeyValueStore from "effect/persistence/KeyValueStore"
import * as Atom from "effect/reactivity/Atom"
import * as AtomRegistry from "effect/reactivity/AtomRegistry"

/**
 * The browser's storage, or none where reading `localStorage` is itself refused (some private windows). Not
 * `@inventory/client/Storage`, which this package may not use: every call after this one is an `Effect.try` below.
 */
const lookup = (): Storage | undefined => O.getOrUndefined(O.liftThrowable(() => window.localStorage)())

const refusal = (method: string, key: string, cause: unknown) =>
  new KeyValueStore.KeyValueStoreError({ key, method, message: `The browser would not ${method} ${key}`, cause })

// A value kept before values were kept as JSON is a bare word ("comfortable"): it is read as that word.
const bareWord = /^(?!null$|true$|false$)[a-z]+$/
const asJson = (text: string): string => (bareWord.test(text) ? `"${text}"` : text)

// What `Atom.kvs` writes for a value that is none. Nothing kept is no entry: the key is removed instead.
const nothing = "null"

/**
 * The keys whose last write the browser refused: held for the visit only, and not kept. A refusal inside `Atom.kvs`'
 * write reaches nobody else, and a screen that says a value is kept would otherwise say so of one the browser refused.
 * A later write of the key that is kept takes it out.
 */
export const refusedKeys = Atom.make(HashSet.empty<string>()).pipe(Atom.keepAlive)

/** The browser's `localStorage` as a `KeyValueStore`, telling `refusedKeys` of each write it refuses. */
const store = (registry: AtomRegistry.AtomRegistry) => {
  const storage = lookup()
  // Whether the browser kept the key's last write, for the screen: changed only when it differs from what was known.
  const known = (key: string, refused: boolean) =>
    Effect.sync(() => {
      if (HashSet.has(registry.get(refusedKeys), key) !== refused) {
        registry.update(refusedKeys, refused ? HashSet.add(key) : HashSet.remove(key))
      }
    })
  // With no storage: nothing is read, and a write is refused.
  const reading = <A>(method: string, key: string, read: (kept: Storage) => A, absent: A) =>
    storage === undefined
      ? Effect.succeed(absent)
      : Effect.try({ try: () => read(storage), catch: (cause) => refusal(method, key, cause) })
  const writing = (method: string, key: string, write: (kept: Storage) => void) =>
    (storage === undefined
      ? Effect.fail(refusal(method, key, "the browser gives no storage"))
      : Effect.try({ try: () => write(storage), catch: (cause) => refusal(method, key, cause) })
    ).pipe(
      Effect.tapError(() => known(key, true)),
      Effect.tap(() => known(key, false))
    )
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
}

/** The browser's `localStorage` as a `KeyValueStore`; one that keeps nothing where the browser gives none. */
const browserStore = Layer.effect(KeyValueStore.KeyValueStore)(
  AtomRegistry.AtomRegistry.pipe(Effect.service, Effect.map(store))
)

/** The runtime the kept atoms read and write on. */
export const keptRuntime = Atom.runtime(browserStore)
