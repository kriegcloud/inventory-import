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
import { browserLocks, lockOf, takingOf, thisTab } from "@inventory/client/TabAtoms"
import { ImportId } from "@inventory/catalog-contract/Ids"
import { ImportNotFound } from "@inventory/catalog-contract/ImportRejection"
import { kept } from "@inventory/review/Kept"
import { progressKey } from "@inventory/review/SavedProgress"
import { leavingApp } from "@inventory/ui/Route"
import { call } from "./Catalog.runtime.ts"
import { decisionsIn, type Draft, eachOnce, emptyDraft, type Named, type Waiting, waiting } from "./Draft.machine.ts"
import { fileNameOf, StoredWaiting, storedFromText, toStored, toWaiting } from "./internal/storedWaiting.ts"
import { leaveRemoved, leaveTakenUp } from "./Notices.atoms.ts"

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
const otherTabs = (actor: Owner, id: ImportId, tab: string): ReadonlyArray<Entry> => {
  const storage = sharedStorage()
  if (storage === undefined) return []
  const legacy = progressKey(scopeOf(actor, id))
  const prefix = progressKey({ ...scopeOf(actor, id), screen: `import:${id}:waiting:` })
  const own = keyOf(actor, id, tab)
  const found: Array<Entry> = []
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

/** One entry kept by another of the member's tabs: an older page's names no tab. */
interface Entry {
  readonly key: string
  readonly tab: O.Option<string>
}

/** What a tab claims before taking an entry up: a lock named for that entry, so only one tab ever takes it. */
const claimOf = (entry: Entry): string => `inventory-kept:${entry.key}`

/**
 * Reads one entry from the browser's storage as it is now, erases it there at once, and hands it over: inside the
 * claim, so another tab that claims it next finds it gone (the atom's own write could land after the claim ends).
 */
const takeEntry = (registry: AtomRegistry.AtomRegistry, key: string, take: (stored: StoredWaiting) => void): void => {
  const storage = sharedStorage()
  let text: string | null = null
  try {
    text = storage?.getItem(key) ?? null
    storage?.removeItem(key)
  } catch {
    return
  }
  registry.set(waitingAt(key), O.none())
  take(storedFromText(text))
}

/**
 * The waiting rows the member's tabs that are gone (closed, crashed, discarded by the browser or not loaded yet) kept
 * for one import, taken up by this tab: each entry is claimed (`claiming`), then read, erased and handed over, and the
 * tab it was taken from is told when it loads again (`leaveTakenUp`). Without the browser's locks no tab can be told
 * gone, and only an older page's entry is taken up. Nothing is taken up before this tab's id is its own.
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
    takingGone(others, (entry) =>
      takeEntry(registry, entry.key, (stored) =>
        O.map(toWaiting(stored), (kept) => {
          O.map(entry.tab, (from) =>
            leaveTakenUp({
              registry,
              of: actor,
              tab: from,
              from: { id, fileName: fileNameOf(stored) },
              rows: R.keys(decisionsIn(kept).rows)
            })
          )
          input.take(kept)
        })
      )
    )
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
 * Claims one entry of another tab and, where that tab is gone, does `then` with it. The claim is a lock of the entry's
 * own, so of two tabs that find the same tab gone at once only one gets it; it is not the gone tab's own lock (a tab
 * loading meanwhile would find that held, and take another id). What keeps a tab that loads at that moment (the browser
 * had discarded it) from reading what is being taken:
 *
 * - the taker holds the tab's take-up lock (`takingOf`, shared) from before it looks whether the tab's own lock is held
 *   until the claim ends; the tab takes it whole after its own lock, before its id is its own and anything kept is read;
 * - so a tab that had its own lock before the taker looked is open, and nothing is taken from it; one that gets it later
 *   waits, and reads an entry that is gone and the notice that says so. Never both.
 *
 * The claim is let go `claimKept` after the take-up is done, so that a tab of that id that comes back and is gone again
 * later (a reload, then a close) is taken up again, by this page or another.
 */
const claiming = (locks: LockManager, entry: Entry, then: () => void): void => {
  const nothing = () => Effect.runPromise(Effect.void)
  const claim = () =>
    locks.request(claimOf(entry), { ifAvailable: true }, (lock) =>
      lock === null
        ? nothing()
        : locks
            .query()
            .then((snapshot) =>
              O.exists(entry.tab, (tab) => A.some(snapshot.held ?? [], (held) => held.name === lockOf(tab)))
                ? nothing()
                : Effect.runPromise(Effect.sync(then).pipe(Effect.andThen(Effect.sleep(claimKept))))
            )
    )
  O.match(entry.tab, {
    onNone: () => void claim(),
    onSome: (tab) =>
      void locks.request(takingOf(tab), { mode: "shared", ifAvailable: true }, (lock) =>
        lock === null ? nothing() : claim()
      )
  })
}

/**
 * Each of these entries whose tab is gone, once claimed. Without the browser's locks no tab can be told gone: only an
 * older page's.
 */
const takingGone = (entries: ReadonlyArray<Entry>, then: (entry: Entry) => void): void => {
  const locks = browserLocks()
  for (const entry of entries) {
    if (locks !== undefined) claiming(locks, entry, () => then(entry))
    else if (O.isNone(entry.tab)) then(entry)
  }
}

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
  /** The name of the import's file, where this tab knows it: kept with the rows, for what names them later. */
  readonly fileName: O.Option<string>
}): void => {
  const { registry, id } = input
  O.map(O.all({ owner: registry.get(draftOwner(id)), tab: registry.get(thisTab) }), ({ owner, tab }) => {
    const key = keyOf(owner, id, tab)
    // An entry not read into the draft yet is left as it is: the draft does not hold what it keeps.
    if (!HashSet.has(registry.get(keysRead), key)) return
    const now = registry.get(waitingAt(key))
    const stored = toStored(
      input.waits,
      O.orElse(input.fileName, () => fileNameOf(now))
    )
    if (!Eq.equals(now, stored)) registry.set(waitingAt(key), stored)
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

/** The members whose rows of one import this page may hold: the draft's, the person signed in now, and `also`. */
const membersHere = ({ also, id, registry }: DraftIn & { readonly also: O.Option<Owner> }): ReadonlyArray<Owner> =>
  A.dedupeWith(
    A.getSomes([
      registry.get(draftOwner(id)),
      O.map(registry.get(member), (actor) => ({ organizationId: actor.organizationId, id: actor.id })),
      also
    ]),
    sameMember
  )

/** Rows let go with their import: whose they were, and what was kept of them. */
interface LetGo {
  readonly owner: Owner
  readonly named: Named
  readonly fileName: O.Option<string>
}

/**
 * Lets go of one import's draft and the rows `owners` kept for it in this browser that no open tab holds (the import was
 * removed): this tab's, a gone tab's and an older page's, each said to `gone` as it goes. An entry of a tab still open
 * stays: that tab finds the import gone itself, and lets its own go.
 */
const lettingGo = (
  input: DraftIn & { readonly owners: ReadonlyArray<Owner>; readonly gone: (letGo: LetGo) => void }
): void => {
  const { gone, id, owners, registry } = input
  const draft = registry.get(draftOf(id))
  const of = registry.get(draftOwner(id))
  const isOwner = (owner: Owner): boolean => O.exists(of, (drafts) => sameMember(drafts, owner))
  if (O.isNone(of) || A.some(owners, isOwner)) {
    registry.set(draftOf(id), emptyDraft)
    registry.set(draftOwner(id), O.none())
    registry.update(waitingImports, HashSet.remove(id))
  }
  // What each of them dismissed of the take-backs a match made goes with the import.
  for (const owner of owners) registry.set(takeBackDismissals(dismissalsKey({ actor: owner, id })), O.none())
  O.map(registry.get(thisTab), (tab) => {
    for (const owner of owners) {
      const own = registry.get(waitingAt(keyOf(owner, id, tab)))
      // The draft in memory holds all its entry keeps, unless that was never read into it.
      const inMemory = isOwner(owner) ? waiting(draft) : O.none<Waiting>()
      const named = eachOnce(A.map(A.getSomes([inMemory, toWaiting(own)]), decisionsIn))
      gone({ owner, named, fileName: fileNameOf(own) })
      registry.set(waitingAt(keyOf(owner, id, tab)), O.none())
      takingGone(otherTabs(owner, id, tab), (entry) =>
        takeEntry(registry, entry.key, (stored) =>
          O.map(toWaiting(stored), (kept) => gone({ owner, named: decisionsIn(kept), fileName: fileNameOf(stored) }))
        )
      )
    }
  })
}

/** Erases one import's draft and the rows kept for it that no open tab holds: the person removed the import here. */
export const forgetDraft = (input: DraftIn): void =>
  lettingGo({ ...input, owners: membersHere({ ...input, also: O.none() }), gone: () => undefined })

/**
 * An import found removed in `organizationId` (the server looked there, and a colleague or another tab had removed it):
 * the rows that members of that organization kept for it are let go, this tab's and those of their tabs that are gone,
 * and named in this tab until dismissed (Benjamin, 2026-11-21: nothing is dropped unnamed). Rows of a member of another
 * organization are not that import's: they stay. Waits for this tab's id, under which they are named.
 */
const letRemovedGo = (input: DraftIn & { readonly organizationId: string; readonly also?: O.Option<Owner> }): void => {
  const { id, organizationId, registry } = input
  onceTabKnown(registry, (tab) =>
    lettingGo({
      registry,
      id,
      owners: A.filter(
        membersHere({ registry, id, also: input.also ?? O.none() }),
        (owner) => owner.organizationId === organizationId
      ),
      gone: ({ fileName, named, owner }) => leaveRemoved({ registry, of: owner, tab, from: { id, fileName }, named })
    })
  )
}

/**
 * An import was not found: removed, where the server looked in the organization the rows belong to (the draft's
 * member's, or whoever is signed in). Its rows are then let go and named (`letRemovedGo`), and this says true. Anywhere
 * else (the session's organization was switched in another tab) nothing kept is touched, and it says false.
 */
export const removedHere = (input: DraftIn & { readonly error: ImportNotFound }): boolean => {
  const { error, id, registry } = input
  const of = O.orElse(ownerOf({ registry, id }), () => registry.get(member))
  if (!O.exists(of, (one) => one.organizationId === error.organizationId)) return false
  letRemovedGo({ registry, id, organizationId: error.organizationId })
  return true
}

/** Does `then` once this tab's id is its own: at once, or as soon as it is. */
const onceTabKnown = (registry: AtomRegistry.AtomRegistry, then: (tab: string) => void): void =>
  O.match(registry.get(thisTab), {
    onSome: then,
    onNone: () => {
      const stop = registry.subscribe(thisTab, (tab) => {
        if (O.isNone(tab)) return
        stop()
        then(tab.value)
      })
    }
  })

/**
 * The imports this tab kept rows for, read from the keys in the browser's storage, and whether any are still to be sent
 * (not only on hold, or left over to be named): each key is the member's scope, then `import:<id>:waiting:<tab>`
 * (escaped by `progressKey`).
 */
const waitingOfThisTab = (input: {
  readonly registry: AtomRegistry.AtomRegistry
  readonly actor: Owner
  readonly tab: string
}): ReadonlyArray<{ readonly id: ImportId; readonly sends: boolean }> => {
  const storage = sharedStorage()
  if (storage === undefined) return []
  const { actor, registry, tab } = input
  const scope = { organizationId: actor.organizationId, memberId: actor.id }
  const start = progressKey({ ...scope, screen: "import:" })
  // The escaped end of every key this tab writes, whatever the import.
  const bare = progressKey({ organizationId: "", memberId: "", screen: "" })
  const end = Str.slice(Str.length(bare))(progressKey({ organizationId: "", memberId: "", screen: `:waiting:${tab}` }))
  const found: Array<{ readonly id: ImportId; readonly sends: boolean }> = []
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
      // Rows left over are only to be named, and rows on hold wait for the person.
      const sends = O.exists(
        toWaiting(registry.get(waitingAt(key))),
        (waits) => !waits.leftOver && !R.isEmptyReadonlyRecord(waits.rows)
      )
      if (S.is(ImportId)(id)) found.push({ id, sends })
    }
  } catch {
    return []
  }
  return found
}

/** The imports whose drafts have rows still to be sent, in this tab: rows left over to be named are not counted. */
const waitingImports = Atom.make(HashSet.empty<ImportId>()).pipe(Atom.keepAlive)

/**
 * An import this tab kept rows for is asked for once at page start: one that was removed meanwhile (by anyone) has its
 * kept rows let go and named here, and asks nothing before the page is left. Only where the server looked in the
 * organization the rows belong to (`of`): a session switched to another organization in another tab, between the
 * session's answer and this read, finds nothing there and says nothing of them. Any other answer, or none, leaves them.
 */
const forgetIfRemoved = ({ id, of, registry }: DraftIn & { readonly of: Owner }): void =>
  void call((api) => api.imports.get({ params: { id } })).then(
    () => undefined,
    (error: unknown) => {
      if (S.is(ImportNotFound)(error) && error.organizationId === of.organizationId) {
        letRemovedGo({ registry, id, organizationId: of.organizationId, also: O.some(of) })
      }
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
    const found = waitingOfThisTab({ registry, actor, tab })
    const sending = A.filter(found, (one) => one.sends)
    registry.set(waitingImports, HashSet.fromIterable(A.map(sending, (one) => one.id)))
    for (const { id } of found) {
      forgetIfRemoved({ registry, id, of: { organizationId: actor.organizationId, id: actor.id } })
    }
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
