// Where one import's draft is held in the tab, and what of it this browser keeps: the machine's state
// (`Draft.machine.ts`), one per import; the person's waiting rows, kept under the key of whoever decided them; and the
// question the browser asks before the page is left while rows wait. A file of its own so that what removes an import
// can empty its draft and erase its kept rows without knowing how the Review step runs it.
//
// The one thing not to break: rows are kept, and cleared, under the member who decided them, whoever is signed in
// when the server answers (a switch of organization can fall between the two).
import * as Eq from "effect/Equal"
import * as HashSet from "effect/HashSet"
import * as MutableHashMap from "effect/MutableHashMap"
import * as O from "effect/Option"
import * as P from "effect/Predicate"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import * as Atom from "effect/reactivity/Atom"
import type * as AtomRegistry from "effect/reactivity/AtomRegistry"
import { perKey } from "@inventory/client/Api"
import { member } from "@inventory/client/MemberAtoms"
import { RowDecision } from "@inventory/catalog-contract/Decision"
import type { ImportId } from "@inventory/catalog-contract/Ids"
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

/** The key one import's waiting rows are kept under for one member, in one organization. */
const keyOf = (actor: { readonly organizationId: string; readonly id: string }, id: ImportId): string =>
  progressKey({ organizationId: actor.organizationId, memberId: actor.id, screen: `import:${id}:waiting` })

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
