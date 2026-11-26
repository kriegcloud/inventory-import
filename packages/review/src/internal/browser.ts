// Review is independent of the API client. These are its actual nullable platform reads.
import * as O from "effect/Option"
import * as Effect from "effect/Effect"
import * as KeyValueStore from "effect/persistence/KeyValueStore"

/** IndexedDB is absent in server rendering and some test platforms. */
export const fileDatabase = (): O.Option<IDBFactory> => O.fromUndefinedOr(globalThis.indexedDB)
/** Storage lookup may itself be refused by the browser. Later calls retain their own error handling. */
export const localStore = (): O.Option<Storage> =>
  O.flatMap(O.liftThrowable(() => window.localStorage)(), O.fromUndefinedOr)
/** Storage failure retains the method, key, cause and existing words for the KVS consumer. */
export const refusal = (input: { readonly method: string; readonly key: string; readonly cause: unknown }) =>
  new KeyValueStore.KeyValueStoreError({
    key: input.key,
    method: input.method,
    message: `The browser would not ${input.method} ${input.key}`,
    cause: input.cause
  })
/** KVS requires undefined for a missing key; legacy bare words are still read as JSON strings. */
export const storedJson = (key: string) => (storage: Storage) =>
  Effect.try({
    try: () => {
      const text = storage.getItem(key)
      return text === null ? undefined : /^(?!null$|true$|false$)[a-z]+$/.test(text) ? `"${text}"` : text
    },
    catch: (cause) => refusal({ method: "get", key, cause })
  })
/** Finds a node without changing the selector or the time of the read. */
export const query = <A extends Element = HTMLElement>(input: {
  readonly selector: string
  readonly root: ParentNode
}): O.Option<A> => O.fromNullOr(input.root.querySelector<A>(input.selector))
/** Reads the scroll viewport from the nullable root React supplies to its ref callback. */
export const viewport = (root: HTMLElement | null): O.Option<HTMLElement> =>
  O.flatMap(O.fromNullOr(root), (root) => query({ selector: '[data-slot="scroll-area-viewport"]', root }))
/** A nullable closest lookup becomes Option at the read. */
export const closest =
  <A extends Element = HTMLElement>(selector: string) =>
  (node: Element): O.Option<A> =>
    O.fromNullOr(node.closest<A>(selector))
/** Dataset keys distinguish omission from an empty value. */
export const data =
  (key: string) =>
  (node: HTMLElement): O.Option<string> =>
    O.fromUndefinedOr(node.dataset[key])
/** A scroll viewport may have no content child yet. */
export const firstChild = (node: Element): O.Option<Element> => O.fromNullOr(node.firstElementChild)
/** A missing navigator has no platform string. */
export const platform = (): O.Option<string> =>
  O.map(O.fromUndefinedOr(globalThis.navigator), (navigator) => navigator.platform)
/** The match control may be in a sheet rather than on the page. */
export const byId = (id: string): O.Option<HTMLElement> => O.fromNullOr(document.getElementById(id))

/** Converts React's nullable DOM callback argument at callback entry, preserving its cleanup return. */
export const refCallback =
  <A extends Element, B>(use: (node: O.Option<A>) => B) =>
  (node: A | null): B =>
    use(O.fromNullOr(node))
