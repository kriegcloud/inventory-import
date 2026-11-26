// The browser's two storages (the one every tab shares, and the tab's own) as calls that answer an Option instead of
// throwing. The one thing a reader must not break: the browser may refuse any of them at any time, so no caller may
// count on one: a private window refuses even to hand over the storage, a full disk (the quota) refuses a write, and
// site data blocked by the person refuses everything. A refusal is none, and each caller decides what it means for the
// person (usually: what was to be kept lasts as long as the page).
import * as A from "effect/Array"
import * as O from "effect/Option"

/**
 * One of the browser's storages, every call answering none where the browser refuses it (a private window, a full
 * disk, site data blocked) or there is no browser at all (a test, a server).
 */
export interface BrowserStorage {
  /** The text kept under `key`: none when nothing is kept there, or when the browser refuses the read. */
  readonly read: (key: string) => O.Option<string>
  /** Keeps `text` under `key`: none when the browser refuses (full, private, blocked), and then nothing was kept. */
  readonly write: (key: string, text: string) => O.Option<void>
  /** Forgets what is kept under `key`: none when the browser refuses, and then it may still be there. */
  readonly remove: (key: string) => O.Option<void>
  /** Every key kept now, in the storage's own order: none when the browser refuses to list them. */
  readonly keys: () => O.Option<ReadonlyArray<string>>
  /**
   * Several steps on the storage as one: what `use` answers, or none when the browser refuses any of them, and then
   * the steps after the refused one did not happen. For work that must stop at the first refusal (read, then erase).
   */
  readonly attempt: <A>(use: (storage: Storage) => A) => O.Option<A>
}

/**
 * The calls on the storage `lookup` finds. Finding it is itself inside the refusal: a private window throws on
 * `window.localStorage`, and with no window at all (a test) there is nothing to find. A caller that reads the storage
 * under another name than `window.localStorage` (a module that reads the global `localStorage`) passes its own lookup,
 * so what it reads is unchanged.
 *
 * @example browserStorage(() => window.localStorage).read("theme") // O.some("dark"), or none in a private window
 */
export const browserStorage = (lookup: () => Storage): BrowserStorage => {
  // Everything the browser may refuse goes through here: the lookup and the call, together.
  const attempt = <A>(use: (storage: Storage) => A): O.Option<A> => O.liftThrowable(() => use(lookup()))()
  return {
    read: (key) =>
      O.flatMap(
        attempt((storage) => storage.getItem(key)),
        O.fromNullOr
      ),
    write: (key, text) => attempt((storage) => storage.setItem(key, text)),
    remove: (key) => attempt((storage) => storage.removeItem(key)),
    // `makeBy` makes at least one: an empty storage's `key(0)` is null, and so nothing.
    keys: () => attempt((storage) => A.getSomes(A.makeBy(storage.length, (index) => O.fromNullOr(storage.key(index))))),
    attempt
  }
}

/** The storage every tab of this browser shares (`window.localStorage`), which outlives the page and the tab. */
export const sharedStorage: BrowserStorage = browserStorage(() => window.localStorage)

/** The tab's own storage (`window.sessionStorage`): a reload of the tab keeps it, a new tab starts without it. */
export const tabStorage: BrowserStorage = browserStorage(() => window.sessionStorage)

/** The actual browser window, absent during server rendering and tests without a DOM. */
export const browserWindow = (): O.Option<Window> => O.fromUndefinedOr(globalThis.window)

/** Web Locks capability, absent in older browsers and tests. */
export const browserLocks = (): O.Option<LockManager> =>
  O.flatMap(O.fromUndefinedOr(globalThis.navigator), (navigator) => O.fromUndefinedOr(navigator.locks))

/** A nullable platform lock is converted at its callback entry; the caller handles both complete cases. */
export const requestAvailable = <A>(input: {
  readonly locks: LockManager
  readonly name: string
  readonly options: LockOptions
  readonly use: (lock: O.Option<Lock>) => A
}) => input.locks.request(input.name, input.options, (lock) => input.use(O.fromNullOr(lock)))

/** Reads an entry without catching a refusal: the owning storage transaction decides its error policy. */
export const storageText =
  (key: string) =>
  (storage: Storage): O.Option<string> =>
    O.fromNullOr(storage.getItem(key))

/** Reads one key in the browser's own order without catching a refusal. */
export const storageKey =
  (index: number) =>
  (storage: Storage): O.Option<string> =>
    O.fromNullOr(storage.key(index))
