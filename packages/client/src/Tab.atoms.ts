// This tab among the person's tabs, as an atom: its id, kept for a reload of the tab in the tab's own storage, and the
// browser lock it holds for as long as the page is open, so another tab can tell it is gone (Benjamin, 2026-11-20,
// "Each tab keeps its own"). The one thing a reader must not break: one id per tab for the page's life. The id and its
// lock are one keep-alive atom, read once per page, so a screen drawn again never asks for the lock again (a lock asked
// for twice by one page is found held, and would take the page a second id); and the app reads it at page start, so a
// tab on the sign-in page, or still loading its workspace, counts as open.
import * as SecureRandom from "effect/crypto/SecureRandom"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as Atom from "effect/reactivity/Atom"
import { tabStorage } from "@inventory/client/Storage"

/** Where a tab keeps its id: in the tab's own storage, which a reload of the tab keeps and a new tab does not. */
const tabSlot = "inventory:tab"

/** The id this tab had before a reload, if its storage kept one (none where reading it is refused, or no window). */
const keptId = (): O.Option<string> => tabStorage.read(tabSlot)

/** A new id for this tab, kept for a reload of it (where the tab's storage refuses, a reload is another tab). */
const newId = (): string => {
  const id = SecureRandom.uuidV4Unsafe()
  // Storage refused: the id lasts as long as the page.
  tabStorage.write(tabSlot, id)
  return id
}

/**
 * The lock a tab holds for as long as it is open: another tab tells it is gone when nobody holds it.
 *
 * @example lockOf("6f1c…") // "inventory-tab:6f1c…"
 */
export const lockOf = (tab: string): string => `inventory-tab:${tab}`

/**
 * The lock another tab holds (shared) while it takes up what the tab of this id kept, believing it gone. The tab takes
 * it whole, once, before its id is its own: a take-up that had begun is over by then, so what it kept is read by one of
 * the two, never both; and one that begins later finds the tab's own lock held.
 *
 * @example takingOf("6f1c…") // "inventory-taking:6f1c…"
 */
export const takingOf = (tab: string): string => `inventory-taking:${tab}`

/** The browser's locks, or none where it has none (an old browser, a test). */
export const browserLocks = (): LockManager | undefined =>
  typeof navigator === "undefined" || navigator.locks === undefined ? undefined : navigator.locks

/**
 * This tab's id, once it is the tab's own: none until the tab holds its lock. A tab opened as a copy of another (its
 * storage copied, the id with it) finds the lock held and takes a new id, so two open tabs never share one, and nothing
 * is kept or counted under the copied id. A tab that loads while another is taking up what it kept (it counted as
 * gone: the browser had discarded it) waits for that to be over first (`takingOf`). Where the browser has no locks, the
 * kept id (or a new one) at once.
 */
export const thisTab: Atom.Atom<O.Option<string>> = Atom.readable((get): O.Option<string> => {
  const first = O.match(keptId(), { onSome: (id) => id, onNone: newId })
  const locks = browserLocks()
  if (locks === undefined) return O.some(first)
  const hold = (tab: string): void =>
    void locks
      .request(lockOf(tab), { ifAvailable: true }, (lock) =>
        lock === null
          ? Effect.runPromise(Effect.succeed("taken" as const))
          : // Held for the page's life; the id is the tab's own from now on. Said after this read has returned.
            Effect.runPromise(
              Effect.promise(() =>
                locks.request(takingOf(tab), { mode: "exclusive" }, () => Effect.runPromise(Effect.void))
              ).pipe(Effect.andThen(Effect.sync(() => get.setSelf(O.some(tab)))), Effect.andThen(Effect.never))
            )
      )
      .then((answer) => {
        if (answer === "taken") hold(newId())
      })
  hold(first)
  return O.none()
}).pipe(Atom.keepAlive)
