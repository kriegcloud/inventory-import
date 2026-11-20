// Where one import's draft is held in the tab, and what of it this browser keeps: the machine's state
// (`Draft.machine.ts`), one per import; the member it belongs to; the person's waiting rows, kept under the key of
// whoever decided them; and the question the browser asks before the page is left while rows wait. A file of its own so
// that what removes an import can empty its draft and erase its kept rows without knowing how the Review step runs it.
//
// The one thing not to break: rows are kept, cleared and sent only under the member who decided them, whoever is signed
// in when the server answers (a switch of organization, or someone else signing in on this page, can fall between the
// two; Benjamin, 2026-11-20, G3); and under the tab that decided them ("Each tab keeps its own", G4): a tab keeps and
// sends only its own, takes up rows only from a tab that is gone, and never writes over or erases another tab's entry.
// Nothing here is a module-level variable a screen depends on: the tab, the owner and the counts are atoms.
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as Eq from "effect/Equal"
import { pipe } from "effect/Function"
import * as HashSet from "effect/HashSet"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import * as Atom from "effect/reactivity/Atom"
import type * as AtomRegistry from "effect/reactivity/AtomRegistry"
import { perKey } from "@inventory/client/Api"
import { member } from "@inventory/client/MemberAtoms"
import { browserLocks, lockOf, thisTab } from "@inventory/client/TabAtoms"
import { ImportId } from "@inventory/catalog-contract/Ids"
import { ImportNotFound } from "@inventory/catalog-contract/ImportRejection"
import { kept } from "@inventory/review/Kept"
import { progressKey } from "@inventory/review/SavedProgress"
import { leavingApp } from "@inventory/ui/Route"
import { call } from "./Catalog.runtime.ts"
import { type Draft, emptyDraft, type Waiting } from "./Draft.machine.ts"
import { StoredWaiting, toStored, toWaiting, waitingFromText } from "./internal/storedWaiting.ts"

/**
 * One import's draft: what this tab holds of the server's decisions and what the person changed here that the server
 * has not confirmed. Kept for as long as the page lives, because a save that is out, or one waiting for "Save again",
 * is the person's work whether or not the Review step is drawn; the machine empties it when the step has left and the
 * server has everything, and when the import is confirmed or removed.
 */
export const draftOf = perKey((_id: ImportId) => Atom.keepAlive(Atom.make<Draft>(emptyDraft)))

/** A member as the draft knows whom its rows belong to. */
export interface Owner {
  readonly organizationId: string
  readonly id: string
}

const sameMember = (one: Owner, other: Owner): boolean =>
  one.id === other.id && one.organizationId === other.organizationId

/**
 * The member one import's draft belongs to: whoever was signed in when the step opened, a row was decided or a held
 * one settled, rows were taken up. None while the draft holds nothing of anyone's that the server has not.
 */
const draftOwner = perKey((_id: ImportId) => Atom.make<O.Option<Owner>>(O.none()).pipe(Atom.keepAlive))

/** One import's draft in one registry: what the helpers below look at. */
interface DraftIn {
  readonly registry: AtomRegistry.AtomRegistry
  readonly id: ImportId
}

/** True when the draft in memory belongs to another member than the one signed in now. */
export const ownedByAnother = ({ id, registry }: DraftIn): boolean =>
  O.exists(registry.get(draftOwner(id)), (owner) =>
    O.exists(registry.get(member), (actor) => !sameMember(owner, actor))
  )

/** The member one import's draft belongs to now: none while it holds nothing of anyone's the server has not. */
export const ownerOf = ({ id, registry }: DraftIn): O.Option<Owner> => registry.get(draftOwner(id))

/**
 * True while `owner` is the member signed in: only then are the rows that member decided sent or confirmed. Rows that
 * waited after a save refused for nobody signed in go only once that member is signed in again, never as whoever
 * signs in next (Benjamin, 2026-11-20, G3). Rows nobody was known to be signed in for when they were decided belong to
 * nobody, and are compared with nobody.
 */
export const signedInAs = (input: {
  readonly registry: AtomRegistry.AtomRegistry
  readonly owner: O.Option<Owner>
}): boolean =>
  O.match(input.owner, {
    onNone: () => true,
    onSome: (owner) => O.exists(input.registry.get(member), (actor) => sameMember(owner, actor))
  })

/** True when somebody other than `owner` is signed in now: said so, not as a sign-out. */
export const anotherThan = (input: {
  readonly registry: AtomRegistry.AtomRegistry
  readonly owner: O.Option<Owner>
}): boolean =>
  O.exists(input.owner, (owner) => O.exists(input.registry.get(member), (actor) => !sameMember(owner, actor)))

/**
 * The member signed in now acts on the draft (opens the step, decides a row, settles one, takes rows up, presses the
 * confirm): from here on its rows are theirs, kept under their key. With nobody signed in, it stays whose it was.
 */
export const claimDraft = ({ id, registry }: DraftIn): void =>
  void O.map(registry.get(member), (actor) =>
    registry.set(draftOwner(id), O.some({ organizationId: actor.organizationId, id: actor.id }))
  )

/**
 * Lets the draft in memory go because it belongs to another member than the one signed in now: its rows stay kept in
 * this browser under its owner's key, for that member's next visit, and nothing of it is written or sent here. The
 * entry is no longer the draft's: it is read again before it is written again.
 */
export const letAnothersDraftGo = ({ id, registry }: DraftIn): void => {
  O.map(O.all({ owner: registry.get(draftOwner(id)), tab: registry.get(thisTab) }), ({ owner, tab }) =>
    registry.update(keysRead, HashSet.remove(keyOf(owner, id, tab)))
  )
  registry.set(draftOf(id), { ...emptyDraft, epoch: registry.get(draftOf(id)).epoch + 1 })
  registry.set(draftOwner(id), O.none())
}

const waitingAt = Atom.family((key: string) =>
  kept({ key, schema: StoredWaiting, defaultValue: (): StoredWaiting => O.none() })
)

/** The browser's storage shared by every tab, or none where reading it is itself refused (some private windows). */
const sharedStorage = (): Storage | undefined => {
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

/** The scope one import's waiting rows are kept under for one member, in one organization: every tab's begins so. */
const scopeOf = (actor: Owner, id: ImportId) => ({
  organizationId: actor.organizationId,
  memberId: actor.id,
  screen: `import:${id}:waiting`
})

/** The key one import's waiting rows are kept under for one member, in one organization, by one tab. */
const keyOf = (actor: Owner, id: ImportId, tab: string): string =>
  progressKey({ ...scopeOf(actor, id), screen: `import:${id}:waiting:${tab}` })

/**
 * The entries kept for one import by the member's other tabs, by key, with the tab each belongs to: the one an older
 * page kept for every tab (no tab in its key) counts as a tab that is gone.
 */
const otherTabs = (
  actor: Owner,
  id: ImportId,
  tab: string
): ReadonlyArray<{ readonly key: string; readonly tab: O.Option<string> }> => {
  const storage = sharedStorage()
  if (storage === undefined) return []
  const legacy = progressKey(scopeOf(actor, id))
  const prefix = progressKey({ ...scopeOf(actor, id), screen: `import:${id}:waiting:` })
  const own = keyOf(actor, id, tab)
  const found: Array<{ readonly key: string; readonly tab: O.Option<string> }> = []
  try {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index)
      if (key === null || key === own) continue
      if (key === legacy) found.push({ key, tab: O.none() })
      else if (Str.startsWith(prefix)(key)) found.push({ key, tab: O.some(Str.slice(Str.length(prefix))(key)) })
    }
  } catch {
    return []
  }
  return found
}

/** What a tab claims before taking an entry up: a lock named for that entry, so only one tab ever takes it. */
const claimOf = (entry: { readonly key: string }): string => `inventory-kept:${entry.key}`

/**
 * The entries of tabs that are gone, from the browser's locks as they are now: a tab still open holds its own lock;
 * an older page's entry (no tab) belongs to no open tab.
 */
const goneOf = <Entry extends { readonly tab: O.Option<string> }>(
  locks: LockManager,
  entries: ReadonlyArray<Entry>,
  then: (gone: ReadonlyArray<Entry>) => void
): void =>
  void locks.query().then((snapshot) => {
    const open = A.map(snapshot.held ?? [], (lock) => lock.name ?? "")
    then(A.filter(entries, (entry) => !O.exists(entry.tab, (tab) => A.contains(open, lockOf(tab)))))
  })

/**
 * Reads one entry from the browser's storage as it is now, erases it there at once, and hands it over: inside the
 * claim, so another tab that claims it next finds it gone (the atom's own write could land after the claim ends).
 */
const takeEntry = (registry: AtomRegistry.AtomRegistry, key: string, take: (kept: Waiting) => void): void => {
  const storage = sharedStorage()
  let text: string | null = null
  try {
    text = storage?.getItem(key) ?? null
    storage?.removeItem(key)
  } catch {
    return
  }
  registry.set(waitingAt(key), O.none())
  O.map(waitingFromText(text), take)
}

/**
 * The waiting rows the member's tabs that are gone (closed or crashed) kept for one import, taken up by this tab: each
 * entry is claimed under the gone tab's own lock, so a tab still open (which holds it) is never taken from, and of two
 * tabs taking up at once only one gets it; then read, erased and handed over. Without the browser's locks no tab can be
 * told gone, and only an older page's entry is taken up. Nothing is taken up before this tab's id is its own.
 */
export const takeUpGoneTabs = (input: {
  readonly registry: AtomRegistry.AtomRegistry
  readonly id: ImportId
  readonly take: (kept: Waiting) => void
}): void => {
  const { registry, id } = input
  O.map(O.all({ actor: registry.get(member), tab: registry.get(thisTab) }), ({ actor, tab }) => {
    const others = otherTabs(actor, id, tab)
    if (!A.isReadonlyArrayNonEmpty(others)) return
    const locks = browserLocks()
    if (locks === undefined) {
      for (const entry of others) if (O.isNone(entry.tab)) takeEntry(registry, entry.key, input.take)
      return
    }
    goneOf(locks, others, (gone) => {
      for (const entry of gone) claiming(locks, entry, () => takeEntry(registry, entry.key, input.take))
    })
  })
}

/**
 * How long a claim is kept after this tab has read and erased the entry it took. An assumption, not a guarantee: that
 * every other tab of this browser sees the erase in its own copy of the browser's storage within half a second. Nothing
 * here can check that: this tab's own copy reads the entry as gone at once, whatever the others read. A tab whose copy
 * lags longer than that, and that claims the same entry after this claim is let go, would find it still there and take
 * it up a second time. Kept short so that a tab of that id that comes back and is gone again (a reload, then a close)
 * is soon taken up again.
 */
const claimKept = "500 millis"

/**
 * Claims one entry of a tab that is gone and, once claimed, does `then` with it: of two tabs that find the same tab
 * gone at once, only one gets it. The claim is let go `claimKept` after the take-up is done, so that a tab of that id
 * that comes back and is gone again later (a reload, then a close) is taken up again, by this page or another.
 */
const claiming = (locks: LockManager, entry: { readonly key: string }, then: () => void): void =>
  void locks.request(claimOf(entry), { ifAvailable: true }, (lock) =>
    lock === null
      ? Effect.runPromise(Effect.void)
      : Effect.runPromise(Effect.sync(then).pipe(Effect.andThen(Effect.sleep(claimKept))))
  )

/**
 * The keys of the waiting rows this page has read into the draft it holds: only those are ever written by
 * `keepWaiting`. A draft whose entry was not read yet (the step opened before this tab's id was its own, or the draft
 * is another member's now) holds none of what the entry keeps, and writing it there would erase the rows kept before a
 * reload: such an entry is read into the draft first (`unreadKept`).
 */
const keysRead = Atom.make(HashSet.empty<string>()).pipe(Atom.keepAlive)

/**
 * The waiting rows this browser kept for one import, for the person signed in now and this tab: what the step reads
 * when it opens, or when this tab's id becomes its own after the step opened. None while nobody is, or before this
 * tab's id is its own. Once read, the entry is the draft's to write.
 */
export const keptWaiting = (input: {
  readonly registry: AtomRegistry.AtomRegistry
  readonly id: ImportId
}): O.Option<Waiting> =>
  pipe(
    O.all({ actor: input.registry.get(member), tab: input.registry.get(thisTab) }),
    O.flatMap(({ actor, tab }) => {
      const key = keyOf(actor, input.id, tab)
      input.registry.update(keysRead, HashSet.add(key))
      return toWaiting(input.registry.get(waitingAt(key)))
    })
  )

/**
 * The waiting rows this browser kept for one import under the member signed in now, by this tab, when that entry has
 * not been read into the draft this page holds: read now, so the draft takes them in before anything is written over
 * the entry. None when it was read already, holds nothing, or nobody is signed in, or before this tab's id is its own.
 */
export const unreadKept = (input: {
  readonly registry: AtomRegistry.AtomRegistry
  readonly id: ImportId
}): O.Option<Waiting> =>
  pipe(
    O.all({ actor: input.registry.get(member), tab: input.registry.get(thisTab) }),
    O.filter(({ actor, tab }) => !HashSet.has(input.registry.get(keysRead), keyOf(actor, input.id, tab))),
    O.flatMap(() => keptWaiting(input))
  )

/**
 * Keeps what waits of one import's draft after an event, under the member the rows belong to (`claimDraft`): the
 * person signed in when the step opened or a row was decided, not whoever is signed in when the server answers.
 * Nothing waiting is no entry, and the import's draft then belongs to nobody until the next press.
 */
export const keepWaiting = (input: {
  readonly registry: AtomRegistry.AtomRegistry
  readonly id: ImportId
  readonly waits: O.Option<Waiting>
}): void => {
  const { registry, id } = input
  O.map(O.all({ owner: registry.get(draftOwner(id)), tab: registry.get(thisTab) }), ({ owner, tab }) => {
    const key = keyOf(owner, id, tab)
    // An entry not read into the draft yet is left as it is: the draft does not hold what it keeps.
    if (!HashSet.has(registry.get(keysRead), key)) return
    const stored = toStored(input.waits)
    if (!Eq.equals(registry.get(waitingAt(key)), stored)) registry.set(waitingAt(key), stored)
  })
  if (O.isNone(input.waits)) registry.set(draftOwner(id), O.none())
  registry.update(waitingImports, (now) =>
    // Rows on hold are kept, and not to be sent by themselves: they ask nothing before the page is left.
    O.exists(input.waits, (waits) => !waits.leftOver && !R.isEmptyReadonlyRecord(waits.rows))
      ? HashSet.add(now, id)
      : HashSet.remove(now, id)
  )
}

/**
 * The take-backs of a match one member dismissed for one import, by key, kept in this browser: none is no entry. An
 * older page kept the list bare; it is read the same.
 */
export const takeBackDismissals = Atom.family((key: string) =>
  kept({
    key,
    schema: S.String.pipe(S.Array, S.OptionFromNullOr),
    defaultValue: (): O.Option<ReadonlyArray<string>> => O.none()
  })
)

/** Where one member's dismissals of one import's take-backs are kept. */
export const dismissalsKey = (of: { readonly actor: Owner; readonly id: ImportId }): string =>
  progressKey({ organizationId: of.actor.organizationId, memberId: of.actor.id, screen: `import:${of.id}:takenBack` })

/**
 * Erases one import's draft and the rows kept for it in this browser that no open tab holds (the import was removed):
 * this tab's, under the member the rows belong to and under the person signed in now, a gone tab's and an older page's.
 * An entry of a tab still open stays: that tab finds the import gone itself, and erases its own.
 */
export const forgetDraft = (input: { readonly registry: AtomRegistry.AtomRegistry; readonly id: ImportId }): void => {
  const { registry, id } = input
  const owners = A.dedupeWith(
    A.getSomes([
      registry.get(draftOwner(id)),
      O.map(registry.get(member), (actor) => ({ organizationId: actor.organizationId, id: actor.id }))
    ]),
    sameMember
  )
  registry.set(draftOf(id), emptyDraft)
  registry.set(draftOwner(id), O.none())
  registry.update(waitingImports, HashSet.remove(id))
  // What each of them dismissed of the take-backs a match made goes with the import.
  for (const owner of owners) registry.set(takeBackDismissals(dismissalsKey({ actor: owner, id })), O.none())
  O.map(registry.get(thisTab), (tab) => {
    const locks = browserLocks()
    for (const owner of owners) {
      registry.set(waitingAt(keyOf(owner, id, tab)), O.none())
      const others = otherTabs(owner, id, tab)
      if (locks === undefined) {
        for (const entry of others) if (O.isNone(entry.tab)) registry.set(waitingAt(entry.key), O.none())
        continue
      }
      goneOf(locks, others, (gone) => {
        for (const entry of gone) claiming(locks, entry, () => takeEntry(registry, entry.key, () => undefined))
      })
    }
  })
}

/**
 * The imports this tab kept rows to be sent for, read from the keys in the browser's storage: each key is the
 * member's scope, then `import:<id>:waiting:<tab>` (escaped by `progressKey`).
 */
const waitingOfThisTab = (input: {
  readonly registry: AtomRegistry.AtomRegistry
  readonly actor: Owner
  readonly tab: string
}): ReadonlyArray<ImportId> => {
  const storage = sharedStorage()
  if (storage === undefined) return []
  const { actor, registry, tab } = input
  const scope = { organizationId: actor.organizationId, memberId: actor.id }
  const start = progressKey({ ...scope, screen: "import:" })
  // The escaped end of every key this tab writes, whatever the import.
  const bare = progressKey({ organizationId: "", memberId: "", screen: "" })
  const end = Str.slice(Str.length(bare))(progressKey({ organizationId: "", memberId: "", screen: `:waiting:${tab}` }))
  const ids: Array<ImportId> = []
  try {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index)
      if (key === null || !Str.startsWith(start)(key) || !Str.endsWith(end)(key)) continue
      const id = pipe(
        key,
        Str.slice(Str.length(start), Str.length(key) - Str.length(end)),
        Str.replaceAll("%3A", ":"),
        Str.replaceAll("%25", "%")
      )
      // Only an entry with rows still to be sent: rows left over are only to be named.
      const sends = O.exists(
        toWaiting(registry.get(waitingAt(key))),
        (waits) => !waits.leftOver && !R.isEmptyReadonlyRecord(waits.rows)
      )
      if (sends && S.is(ImportId)(id)) ids.push(id)
    }
  } catch {
    return []
  }
  return ids
}

/** The imports whose drafts have rows still to be sent, in this tab: rows left over to be named are not counted. */
const waitingImports = Atom.make(HashSet.empty<ImportId>()).pipe(Atom.keepAlive)

/**
 * An import this tab kept rows for is asked for once at page start: one that was removed meanwhile (by anyone) has its
 * kept rows erased, and asks nothing before the page is left. Any other answer, or none, leaves them.
 */
const forgetIfRemoved = (registry: AtomRegistry.AtomRegistry, id: ImportId): void =>
  void call((api) => api.imports.get({ params: { id } })).then(
    () => undefined,
    (error: unknown) => {
      if (S.is(ImportNotFound)(error)) forgetDraft({ registry, id })
    }
  )

/**
 * The browser asks before the page is left while any import has rows still to be sent, wherever the person is in the
 * app: kept for the page by the workspace. Rows left over by a closed import are only to be named, and never sent,
 * so they ask nothing; nor do rows of an import removed meanwhile. A page the app leaves on purpose (a sign-out, a
 * sign-in as somebody else) asks nothing either: the session is ended by then, and the rows stay kept in this browser
 * for that person's next visit. This tab's rows are counted once its id is its own (a copied tab counts none of the
 * original's), and again for whoever is signed in.
 */
export const askBeforeLeaving = Atom.readable((get) => {
  if (typeof window === "undefined") return
  const registry = get.registry
  // Rows this tab kept before a reload wait to be sent wherever the person is, whether or not their import's step is
  // opened again: they count from the start.
  O.map(O.all({ actor: get(member), tab: get(thisTab) }), ({ actor, tab }) => {
    const ids = waitingOfThisTab({ registry, actor, tab })
    registry.set(waitingImports, HashSet.fromIterable(ids))
    for (const id of ids) forgetIfRemoved(registry, id)
  })
  const ask = (event: BeforeUnloadEvent) => {
    if (HashSet.size(registry.get(waitingImports)) > 0) event.preventDefault()
  }
  const onPurpose = () => window.removeEventListener("beforeunload", ask)
  window.addEventListener("beforeunload", ask)
  window.addEventListener(leavingApp, onPurpose)
  get.addFinalizer(() => {
    window.removeEventListener("beforeunload", ask)
    window.removeEventListener(leavingApp, onPurpose)
  })
})
