// Where one import's draft is held in the tab, and what of it this browser keeps: the machine's state
// (`Draft.machine.ts`), one per import; the person's waiting rows, kept under the key of whoever decided them; and the
// question the browser asks before the page is left while rows wait. A file of its own so that what removes an import
// can empty its draft and erase its kept rows without knowing how the Review step runs it.
//
// The one thing not to break: rows are kept, and cleared, under the member who decided them, whoever is signed in
// when the server answers (a switch of organization can fall between the two); and under the tab that decided them
// (Benjamin, 2026-11-20, "Each tab keeps its own"): a tab keeps and sends only its own, takes up rows only from a tab
// that is gone, and never writes over or erases another tab's entry.
import * as A from "effect/Array"
import * as SecureRandom from "effect/crypto/SecureRandom"
import * as Effect from "effect/Effect"
import * as Eq from "effect/Equal"
import { pipe } from "effect/Function"
import * as HashSet from "effect/HashSet"
import * as MutableHashMap from "effect/MutableHashMap"
import * as O from "effect/Option"
import * as P from "effect/Predicate"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import * as Atom from "effect/reactivity/Atom"
import type * as AtomRegistry from "effect/reactivity/AtomRegistry"
import { perKey } from "@inventory/client/Api"
import { member } from "@inventory/client/MemberAtoms"
import { RowDecision } from "@inventory/catalog-contract/Decision"
import { ImportId } from "@inventory/catalog-contract/Ids"
import { kept } from "@inventory/review/Kept"
import { progressKey } from "@inventory/review/SavedProgress"
import { leavingApp } from "@inventory/ui/Route"
import { type Draft, emptyDraft, Hold, type HeldRow, type Waiting } from "./Draft.machine.ts"

/**
 * One import's draft: what this tab holds of the server's decisions and what the person changed here that the server
 * has not confirmed. Kept for as long as the page lives, because a save that is out, or one waiting for "Save again",
 * is the person's work whether or not the Review step is drawn; the machine empties it when the step has left and the
 * server has everything, and when the import is confirmed or removed.
 */
export const draftOf = perKey((_id: ImportId) => Atom.keepAlive(Atom.make<Draft>(emptyDraft)))

/** Why a row is held, as this browser keeps it: refused with the server's sentence, or decided elsewhere since. */
const StoredHold = S.Union([
  S.Struct({ kind: S.tag("refused"), reason: S.String }),
  S.Struct({ kind: S.tag("elsewhere"), theirs: S.OptionFromNullOr(RowDecision) })
]).pipe(S.toTaggedUnion("kind"))

/** One row on hold as this browser keeps it. */
const StoredHeld = S.Struct({ mine: S.OptionFromNullOr(RowDecision), madeOn: S.Int, why: StoredHold })

/**
 * One import's waiting rows as this browser keeps them. Read too as an older page of the app kept them: one revision
 * for all the rows (`madeOn` a number), no count of confirms, no values seen and no rows on hold.
 */
const StoredWaiting = S.Struct({
  madeOn: S.Union([S.Int, S.Record(S.String, S.Int)]),
  confirms: S.Int.pipe(S.NullOr, S.optionalKey),
  leftOver: S.Boolean,
  rows: S.Record(S.String, S.OptionFromNullOr(RowDecision)),
  seen: S.Record(S.String, RowDecision.pipe(S.OptionFromNullOr, S.Array)).pipe(S.optionalKey),
  held: S.Record(S.String, StoredHeld).pipe(S.optionalKey)
}).pipe(S.OptionFromNullOr)
type StoredWaiting = typeof StoredWaiting.Type

const toWaiting = (stored: StoredWaiting): O.Option<Waiting> =>
  O.map(stored, (entry) => {
    const made = entry.madeOn
    return {
      rows: entry.rows,
      madeOn: P.isNumber(made) ? R.map(entry.rows, () => made) : made,
      confirms: O.fromNullishOr(entry.confirms),
      leftOver: entry.leftOver,
      seen: entry.seen ?? {},
      held: R.map(entry.held ?? {}, (held): HeldRow => ({
        mine: held.mine,
        madeOn: held.madeOn,
        why: StoredHold.match(held.why, {
          refused: ({ reason }) => Hold.Refused({ reason }),
          elsewhere: ({ theirs }) => Hold.Elsewhere({ theirs })
        })
      }))
    }
  })

const toStored = (waits: O.Option<Waiting>): StoredWaiting =>
  O.map(waits, (entry) => ({
    madeOn: entry.madeOn,
    confirms: O.getOrNull(entry.confirms),
    leftOver: entry.leftOver,
    rows: entry.rows,
    ...(R.isEmptyReadonlyRecord(entry.seen) ? {} : { seen: entry.seen }),
    ...(R.isEmptyReadonlyRecord(entry.held)
      ? {}
      : {
          held: R.map(entry.held, (held) => ({
            mine: held.mine,
            madeOn: held.madeOn,
            why: Hold.$match(held.why, {
              Refused: ({ reason }) => ({ kind: "refused" as const, reason }),
              Elsewhere: ({ theirs }) => ({ kind: "elsewhere" as const, theirs })
            })
          }))
        })
  }))

const waitingAt = Atom.family((key: string) =>
  kept({ key, schema: StoredWaiting, defaultValue: (): StoredWaiting => O.none() })
)

/** The browser's storage of one kind, or none where reading it is itself refused (some private windows). */
const storageOf = (kind: "localStorage" | "sessionStorage"): Storage | undefined => {
  try {
    return window[kind]
  } catch {
    return undefined
  }
}

/** Where this tab keeps its id: in the tab's own storage, which a reload of the tab keeps and a new tab does not. */
const tabSlot = "inventory:tab"

/** This tab's id among the person's tabs, made when first asked for. */
const thisTab = { id: "" }

/** A new id for this tab, kept for a reload of it. */
const newTab = (): string => {
  const id = SecureRandom.uuidV4Unsafe()
  try {
    storageOf("sessionStorage")?.setItem(tabSlot, id)
  } catch {
    // Storage refused: the id lasts as long as the page, and a reload is another tab.
  }
  thisTab.id = id
  return id
}

/** This tab's id: the one it had before a reload, or a new one. */
export const tabId = (): string => {
  if (thisTab.id !== "") return thisTab.id
  let held: string | null = null
  try {
    held = storageOf("sessionStorage")?.getItem(tabSlot) ?? null
  } catch {
    held = null
  }
  if (held === null) return newTab()
  thisTab.id = held
  return held
}

/** The lock a tab holds for as long as it is open: another tab tells it is gone when nobody holds it. */
const lockOf = (tab: string): string => `inventory-tab:${tab}`

/** The browser's locks, or none where it has none (an old browser, a test). */
const locksOf = (): LockManager | undefined =>
  typeof navigator === "undefined" || navigator.locks === undefined ? undefined : navigator.locks

/**
 * Holds this tab's lock for the page's life. A tab opened as a copy of another (its storage copied, the id with it)
 * finds the lock held and takes a new id, so two open tabs never share one.
 */
export const holdThisTab = (): void => {
  const locks = locksOf()
  if (locks === undefined) return
  const hold = (tab: string): void =>
    void locks
      .request(lockOf(tab), { ifAvailable: true }, (lock) =>
        lock === null ? Effect.runPromise(Effect.succeed("taken" as const)) : Effect.runPromise(Effect.never)
      )
      .then((answer) => {
        if (answer === "taken") hold(newTab())
      })
  hold(tabId())
}

/** The scope one import's waiting rows are kept under for one member, in one organization: every tab's begins so. */
const scopeOf = (actor: { readonly organizationId: string; readonly id: string }, id: ImportId) => ({
  organizationId: actor.organizationId,
  memberId: actor.id,
  screen: `import:${id}:waiting`
})

/** The key one import's waiting rows are kept under for one member, in one organization, by this tab. */
const keyOf = (actor: { readonly organizationId: string; readonly id: string }, id: ImportId): string =>
  progressKey({ ...scopeOf(actor, id), screen: `import:${id}:waiting:${tabId()}` })

/**
 * The entries kept for one import by the member's other tabs, by key, with the tab each belongs to: the one an older
 * page kept for every tab (no tab in its key) counts as a tab that is gone.
 */
const otherTabs = (
  actor: { readonly organizationId: string; readonly id: string },
  id: ImportId
): ReadonlyArray<{ readonly key: string; readonly tab: O.Option<string> }> => {
  const storage = storageOf("localStorage")
  if (storage === undefined) return []
  const legacy = progressKey(scopeOf(actor, id))
  const prefix = progressKey({ ...scopeOf(actor, id), screen: `import:${id}:waiting:` })
  const found: Array<{ readonly key: string; readonly tab: O.Option<string> }> = []
  try {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index)
      if (key === null || key === keyOf(actor, id)) continue
      if (key === legacy) found.push({ key, tab: O.none() })
      else if (Str.startsWith(prefix)(key)) found.push({ key, tab: O.some(Str.slice(Str.length(prefix))(key)) })
    }
  } catch {
    return []
  }
  return found
}

/**
 * The waiting rows the member's tabs that are gone (closed or crashed) kept for one import, taken up by this tab: each
 * is read, its entry erased, and handed over. A tab still open is never taken from; without the browser's locks no
 * tab can be told gone, and only an older page's entry is taken up.
 */
export const takeUpGoneTabs = (input: {
  readonly registry: AtomRegistry.AtomRegistry
  readonly id: ImportId
  readonly take: (kept: Waiting) => void
}): void => {
  const { registry, id } = input
  O.map(registry.get(member), (actor) => {
    const others = otherTabs(actor, id)
    if (!A.isReadonlyArrayNonEmpty(others)) return
    const takeFrom = (gone: ReadonlyArray<{ readonly key: string }>) => {
      for (const entry of gone) {
        const waits = toWaiting(registry.get(waitingAt(entry.key)))
        registry.set(waitingAt(entry.key), O.none())
        O.map(waits, input.take)
      }
    }
    const locks = locksOf()
    if (locks === undefined) return takeFrom(A.filter(others, (entry) => O.isNone(entry.tab)))
    void locks.query().then((snapshot) => {
      const open = A.map(snapshot.held ?? [], (lock) => lock.name ?? "")
      takeFrom(A.filter(others, (entry) => !O.exists(entry.tab, (tab) => A.contains(open, lockOf(tab)))))
    })
  })
}

/** The member each import's waiting rows belong to: whoever decided them, taken when the step opens or rows wait. */
const keptKeys = MutableHashMap.empty<ImportId, string>()

/**
 * The waiting rows this browser kept for one import, for the person signed in now: what the step reads when it opens.
 * None while nobody is.
 */
export const keptWaiting = (input: {
  readonly registry: AtomRegistry.AtomRegistry
  readonly id: ImportId
}): O.Option<Waiting> =>
  O.flatMap(input.registry.get(member), (actor) => toWaiting(input.registry.get(waitingAt(keyOf(actor, input.id)))))

/**
 * Keeps what waits of one import's draft after an event, under the member the rows belong to: the person signed in
 * when the step opened or a row was decided, not whoever is signed in when the server answers. Nothing waiting is no
 * entry, and the import's rows then belong to nobody until the next press.
 */
export const keepWaiting = (input: {
  readonly registry: AtomRegistry.AtomRegistry
  readonly id: ImportId
  readonly waits: O.Option<Waiting>
  /** True for an event the person signed in now caused (the step opened, a row decided): the rows are theirs. */
  readonly pressed: boolean
}): void => {
  const { registry, id } = input
  if (input.pressed) {
    O.map(registry.get(member), (actor) => MutableHashMap.set(keptKeys, id, keyOf(actor, id)))
  }
  O.map(MutableHashMap.get(keptKeys, id), (key) => {
    const stored = toStored(input.waits)
    if (!Eq.equals(registry.get(waitingAt(key)), stored)) registry.set(waitingAt(key), stored)
    if (O.isNone(input.waits)) MutableHashMap.remove(keptKeys, id)
  })
  registry.update(waitingImports, (now) =>
    // Rows on hold are kept, and not to be sent by themselves: they ask nothing before the page is left.
    O.exists(input.waits, (waits) => !waits.leftOver && !R.isEmptyReadonlyRecord(waits.rows))
      ? HashSet.add(now, id)
      : HashSet.remove(now, id)
  )
}

/**
 * Erases one import's draft and every row kept for it in this browser (the import was removed): under the member
 * the rows belong to, and under the person signed in now.
 */
export const forgetDraft = (input: { readonly registry: AtomRegistry.AtomRegistry; readonly id: ImportId }): void => {
  const { registry, id } = input
  registry.set(draftOf(id), emptyDraft)
  O.map(MutableHashMap.get(keptKeys, id), (key) => registry.set(waitingAt(key), O.none()))
  O.map(registry.get(member), (actor) => registry.set(waitingAt(keyOf(actor, id)), O.none()))
  MutableHashMap.remove(keptKeys, id)
  registry.update(waitingImports, HashSet.remove(id))
}

/**
 * The imports this tab kept rows to be sent for, read from the keys in the browser's storage: each key is the
 * member's scope, then `import:<id>:waiting:<tab>` (escaped by `progressKey`).
 */
const waitingOfThisTab = (input: {
  readonly registry: AtomRegistry.AtomRegistry
  readonly actor: { readonly organizationId: string; readonly id: string }
}): ReadonlyArray<ImportId> => {
  const storage = storageOf("localStorage")
  if (storage === undefined) return []
  const { actor, registry } = input
  const scope = { organizationId: actor.organizationId, memberId: actor.id }
  const start = progressKey({ ...scope, screen: "import:" })
  // The escaped end of every key this tab writes, whatever the import.
  const bare = progressKey({ organizationId: "", memberId: "", screen: "" })
  const end = Str.slice(Str.length(bare))(
    progressKey({ organizationId: "", memberId: "", screen: `:waiting:${tabId()}` })
  )
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
 * The browser asks before the page is left while any import has rows still to be sent, wherever the person is in the
 * app: kept for the page by the workspace. Rows left over by a closed import are only to be named, and never sent,
 * so they ask nothing. A page the app leaves on purpose (a sign-out, a sign-in as somebody else) asks nothing either:
 * the session is ended by then, and the rows stay kept in this browser for that person's next visit.
 */
export const askBeforeLeaving = Atom.readable((get) => {
  if (typeof window === "undefined") return
  const registry = get.registry
  holdThisTab()
  // Rows this tab kept before a reload wait to be sent wherever the person is, whether or not their import's step is
  // opened again: they count from the start.
  O.map(registry.get(member), (actor) => {
    for (const id of waitingOfThisTab({ registry, actor })) registry.update(waitingImports, HashSet.add(id))
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
