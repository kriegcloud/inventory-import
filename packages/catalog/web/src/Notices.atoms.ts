// What became of the person's unsaved decisions while this tab was away, said in this tab until the person dismisses
// it: taken up by another tab of theirs (this one was discarded by the browser, closed or not loaded yet), or let go
// because their import was removed. Kept in this browser beside the kept rows (`Draft.atoms.ts`), one record per member
// and tab, so it is said when that tab loads again and to nobody else.
//
// The one thing not to break: a record is written for the tab it is about, under the member whose rows they were, and
// read only by that tab while that member is signed in on it. A tab that never comes back never reads its record, so
// they are bounded: whenever one is written, the member's records older than 30 days go, and all but the newest 20; one
// record names at most the newest 20 imports.
import * as A from "effect/Array"
import * as DateTime from "effect/DateTime"
import * as O from "effect/Option"
import * as Order from "effect/Order"
import * as R from "effect/Record"
import * as Str from "effect/String"
import * as Atom from "effect/reactivity/Atom"
import type * as AtomRegistry from "effect/reactivity/AtomRegistry"
import { member } from "@inventory/client/MemberAtoms"
import { sharedStorage } from "@inventory/client/Storage"
import { thisTab } from "@inventory/client/TabAtoms"
import { kept } from "@inventory/review/Kept"
import { progressKey } from "@inventory/review/SavedProgress"
import { eachOnce, type Named } from "./Draft.machine.ts"
import { Notice, NoticesKept, noticesFromText, noticesText } from "./internal/notices.ts"

/** The member a record is kept for. */
interface Member {
  readonly organizationId: string
  readonly id: string
}

/** How long a record is kept for a tab that does not come back, and for how many tabs of one member at most. */
const keptFor = { days: 30, tabs: 20, imports: 20 } as const

const keyOf = (of: Member, tab: string): string =>
  progressKey({ organizationId: of.organizationId, memberId: of.id, screen: `notices:${tab}` })

const noticesAt = Atom.family((key: string) =>
  kept({ key, schema: NoticesKept, defaultValue: (): NoticesKept => O.none() })
)

const listOf = (stored: NoticesKept): ReadonlyArray<Notice> => O.getOrElse(stored, (): ReadonlyArray<Notice> => [])

/** True for a notice of rows that were only to be named. */
const isNamed = (one: Notice): boolean => Notice.guards.TakenUp(one) && one.named === true

/** True for two notices about the same import that say the same thing happened to it. */
const sameNotice = (one: Notice, other: Notice): boolean =>
  one.importId === other.importId &&
  Notice.guards.TakenUp(one) === Notice.guards.TakenUp(other) &&
  isNamed(one) === isNamed(other)

/** A removed import's decisions, as they are named: an older page kept nothing of what the import held. */
const namedIn = ({ beside, rows, theirs }: Extract<Notice, { readonly rows: Named["rows"] }>): Named => ({
  rows,
  beside,
  theirs: theirs ?? {}
})

/** Two notices of the same thing as one: the rows of both, and the file's name where either knows it. */
const together = (before: Notice, now: Notice): Notice => {
  const fileName = O.orElse(now.fileName, () => before.fileName)
  return Notice.guards.TakenUp(before) && Notice.guards.TakenUp(now)
    ? { ...now, fileName, rows: A.dedupe([...before.rows, ...now.rows]) }
    : Notice.guards.Removed(before) && Notice.guards.Removed(now)
      ? { ...now, fileName, ...eachOnce([namedIn(before), namedIn(now)]) }
      : now
}

/** The notices with one more: together with the one that says the same of the same import, the newest ones kept. */
const withNotice = (stored: NoticesKept, notice: Notice): NoticesKept => {
  const before = listOf(stored)
  const now = O.match(
    A.findFirst(before, (one) => sameNotice(one, notice)),
    { onNone: () => notice, onSome: (one) => together(one, notice) }
  )
  return O.some(A.takeRight([...A.filter(before, (one) => !sameNotice(one, notice)), now], keptFor.imports))
}

/** When the newest notice of a record was left, in milliseconds. */
const newest = (stored: NoticesKept): number => A.reduce(listOf(stored), 0, (latest, one) => Math.max(latest, one.at))

/** Records of tabs that did not come back: the member's older than 30 days go, and all but the newest 20. */
const bounding = (storage: Storage, of: Member): void => {
  const prefix = progressKey({ organizationId: of.organizationId, memberId: of.id, screen: "notices:" })
  const records: Array<{ readonly key: string; readonly at: number }> = []
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (key === null || !Str.startsWith(prefix)(key)) continue
    records.push({ key, at: newest(noticesFromText(storage.getItem(key))) })
  }
  const newestFirst = A.sort(
    records,
    Order.mapInput(Order.flip(Order.Number), (record: { at: number }) => record.at)
  )
  const oldest = DateTime.toEpochMillis(DateTime.subtract(DateTime.nowUnsafe(), { days: keptFor.days }))
  A.forEach(newestFirst, (record, n) => {
    if (n >= keptFor.tabs || record.at < oldest) storage.removeItem(record.key)
  })
}

/**
 * Leaves a notice for one tab of a member's: this tab says it at once, another when it loads again. Another tab's is
 * written to the browser's storage now, inside the claim that took its rows, so the tab finds it once it has its id.
 */
const leave = (input: {
  readonly registry: AtomRegistry.AtomRegistry
  readonly of: Member
  readonly tab: string
  readonly notice: Notice
}): void => {
  const { notice, of, registry, tab } = input
  const key = keyOf(of, tab)
  const here = O.exists(registry.get(thisTab), (own) => own === tab)
  if (here) registry.set(noticesAt(key), withNotice(registry.get(noticesAt(key)), notice))
  // Storage refused (full, or turned off): the decisions are with the tab that took them up, and only this is not said.
  sharedStorage.attempt((storage) => {
    if (!here) {
      const text = noticesText(withNotice(noticesFromText(storage.getItem(key)), notice))
      O.map(text, (kept) => storage.setItem(key, kept))
    }
    bounding(storage, of)
  })
}

/** The import a notice is about: its id, and its file's name where it was kept with the rows. */
interface Of {
  readonly id: string
  readonly fileName: O.Option<string>
}

/** For a tab another one took the rows of: said there, by import and row, when that tab loads again. */
export const leaveTakenUp = (input: {
  readonly registry: AtomRegistry.AtomRegistry
  readonly of: Member
  readonly tab: string
  readonly from: Of
  readonly rows: ReadonlyArray<string>
  /** True for rows that were only to be named. */
  readonly named: boolean
}): void => {
  const { from, named, of, registry, rows, tab } = input
  if (!A.isReadonlyArrayNonEmpty(rows)) return
  const at = DateTime.toEpochMillis(DateTime.nowUnsafe())
  leave({
    registry,
    of,
    tab,
    notice: Notice.cases.TakenUp.make({
      importId: from.id,
      fileName: from.fileName,
      rows,
      ...(named ? { named } : {}),
      at
    })
  })
}

/** For this tab, whose rows of an import removed meanwhile were let go: named here, decision by decision. */
export const leaveRemoved = (input: {
  readonly registry: AtomRegistry.AtomRegistry
  readonly of: Member
  readonly tab: string
  readonly from: Of
  readonly named: Named
}): void => {
  const { from, named, of, registry, tab } = input
  if (R.isEmptyReadonlyRecord(named.rows)) return
  const at = DateTime.toEpochMillis(DateTime.nowUnsafe())
  leave({
    registry,
    of,
    tab,
    notice: Notice.cases.Removed.make({ importId: from.id, fileName: from.fileName, ...named, at })
  })
}

/** Where this tab's notices for the member signed in are kept; none while nobody is, or before its id is its own. */
const noticesHere = Atom.readable((get): O.Option<string> =>
  O.map(O.all({ of: get(member), tab: get(thisTab) }), ({ of, tab }) => keyOf(of, tab))
)

/** What this tab says to the member signed in, until they dismiss it. */
export const notices = Atom.readable((get): ReadonlyArray<Notice> =>
  O.match(get(noticesHere), { onNone: (): ReadonlyArray<Notice> => [], onSome: (key) => listOf(get(noticesAt(key))) })
)

/** The person dismissed one: it goes. */
export const dismissNotice = Atom.writable(
  (): void => undefined,
  (ctx, notice: Notice) => {
    O.map(ctx.get(noticesHere), (key) => {
      const left = A.filter(listOf(ctx.get(noticesAt(key))), (one) => !sameNotice(one, notice))
      ctx.set(noticesAt(key), A.isReadonlyArrayNonEmpty(left) ? O.some(left) : O.none())
    })
  }
)
