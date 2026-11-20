// The review's draft as atoms, with no screen in it: what the Review step holds for one import besides the server's
// view, the decisions it shows, how it follows the draft while it is open, and what a decision does. The rule this
// file protects: the screen never shows, and never sends, less than the person and the others have decided.
import * as Eq from "effect/Equal"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import * as Atom from "effect/reactivity/Atom"
import type * as AtomRegistry from "effect/reactivity/AtomRegistry"
import { toast } from "sonner"
import { perKey } from "@inventory/client/Api"
import { member } from "@inventory/client/MemberAtoms"
import { isTransient, toastError } from "@inventory/client/SayError"
import type { SavedDecisions } from "@inventory/catalog-contract/Decision"
import type { ImportId } from "@inventory/catalog-contract/Ids"
import type { ImportView, SuggestOutcome } from "@inventory/catalog-contract/Import"
import { restored, saved } from "@inventory/review/ReviewDraft"
import type { ReviewState } from "@inventory/review/ReviewTypes"
import { restoredReview, storedReview } from "@inventory/review/SavedProgress"
import { progressOf, progressWith } from "@inventory/review/SavedProgressHook"
import type { review } from "@inventory/catalog-model/Review"
import { callWrite } from "./Catalog.runtime.ts"
import { draftOf } from "./Draft.atoms.ts"
import { changesBetween, DraftEffect, DraftEvent, type RowChanges, shown, step, unconfirmed } from "./Draft.machine.ts"
import { toRegionDecisions, toServerDecisions } from "./ImportReview.controller.ts"
import { changeView, importTable, importView, importViewShown, viewWith } from "./Imports.atoms.ts"

/**
 * What the Review step holds for one import besides its draft: the region's decisions with their undo history (none
 * until the person's first decision on this visit, and again whenever the region starts again) and the last
 * suggestions. Let go with the screen: the draft itself (`draftOf`) is what outlives it.
 */
export interface ReviewLocal {
  readonly state: O.Option<ReviewState>
  readonly suggested: O.Option<SuggestOutcome>
}

export const reviewLocal = perKey((_id: ImportId) => Atom.make<ReviewLocal>({ state: O.none(), suggested: O.none() }))

/** The view's answer, once there is one. */
const viewOf = (get: Atom.AtomContext, id: ImportId): O.Option<ImportView> => AsyncResult.value(get(importView(id)))

/** True when the two are the same object or hold the same values. */
const sameValues = (before: unknown, next: unknown): boolean => before === next || Eq.equals(before, next)

/**
 * What the review is worked out from, besides the decisions: kept as the same object while those parts of the view
 * hold the same values, so a new revision of the draft (after every saved decision) does not work out 50,000 rows
 * again. The parts are compared by value, not by object: an import read again comes back decoded anew, every part a
 * new object, though only its draft moved. The staged rows never change and are compared as the object they are.
 */
export const reviewInput = perKey((id: ImportId) =>
  Atom.readable((get): O.Option<ReviewInput> => {
    const view = viewOf(get, id)
    const table = AsyncResult.value(get(importTable(id)))
    if (O.isNone(view) || O.isNone(table)) return O.none()
    const held = O.flatten(get.self<O.Option<ReviewInput>>())
    const next: ReviewInput = {
      table: table.value,
      choices: view.value.choices,
      storedItems: view.value.storedItems,
      // A server that sends only the row numbers: each row is then one item.
      createdIds: view.value.createdIds,
      // The stored suggestions, as the server reads them at the confirm: each is a proposal on its row.
      suggestions: view.value.suggestions
    }
    const same = O.exists(
      held,
      (before) =>
        before.table === next.table &&
        sameValues(before.choices, next.choices) &&
        sameValues(before.storedItems, next.storedItems) &&
        sameValues(before.createdIds, next.createdIds) &&
        sameValues(before.suggestions, next.suggestions)
    )
    return same ? held : O.some(next)
  })
)
export type ReviewInput = Omit<Parameters<typeof review>[0], "decisions">

/** The registry these atoms live in, for what answers later. */
const registryOf = Atom.readable((get) => get.registry)

/** A write with nothing to read. */
const noValue = (): void => undefined

/** True for what changes only what this tab holds; false for what goes to the server. */
const isLocal = DraftEffect.$match({ Put: () => true, Restart: () => true, Send: () => false, Ask: () => false })

/** Does what the machine asks: sends, asks, puts the person's own save into the view, starts the region again. */
const perform = (input: {
  readonly registry: AtomRegistry.AtomRegistry
  readonly id: ImportId
  readonly effect: DraftEffect
}): void => {
  const { registry, id } = input
  const happened = (event: DraftEvent) => registry.set(draftEvents(id), event)
  DraftEffect.$match(input.effect, {
    // A failure that may pass (the network, a server error) was sent again under the same rows already; if it
    // still fails the rows stay on screen and wait for "Save again": they are the person's work. A refusal (the
    // import was confirmed or removed meanwhile, the role was taken away) puts the screen back to what the server
    // holds, and the toast says why.
    Send: ({ delta }) =>
      void callWrite((api) => api.imports.decide({ params: { id }, payload: delta })).then(
        ({ revision }) => happened(DraftEvent.SaveAnswered({ revision })),
        (error: unknown) => {
          if (isTransient(error)) {
            happened(DraftEvent.SaveFailed())
            toastError(error, {
              lead: "Your last decision is on this screen but not saved yet.",
              action: { label: "Save again", onClick: () => happened(DraftEvent.SaveAgain()) }
            })
          } else {
            toastError(error, { lead: "Your last decision was not saved, so the review shows what was saved." })
            happened(DraftEvent.SaveRefused())
          }
        }
      ),
    Ask: () => registry.refresh(importView(id)),
    // Only the decisions and the revision, and never over a later revision already held.
    Put: ({ decisions, revision }) =>
      changeView({
        registry,
        id,
        change: (held) => (held.revision >= revision ? held : viewWith(held, { decisions, revision }))
      }),
    Restart: ({ announce }) => {
      registry.update(reviewLocal(id), (now) => ({ ...now, state: O.none() }))
      if (announce) toast("Updated with what changed on another screen")
    }
  })
}

/**
 * Everything that happens to one import's draft goes in here: the machine says what the draft becomes and what to
 * do, and this does it. Written to, never read.
 */
export const draftEvents = perKey((id: ImportId) =>
  Atom.writable(noValue, (ctx, event: DraftEvent) => {
    const registry = ctx.get(registryOf)
    const stepped = step(registry.get(draftOf(id)), event)
    // One change for whoever follows the draft: the new draft and what it changes in this tab are in place before
    // anything is worked out from them (the epoch, before what a region of that epoch is given). What goes to the
    // server goes after.
    Atom.batch(() => {
      registry.set(draftOf(id), stepped.draft)
      for (const effect of stepped.effects) if (isLocal(effect)) perform({ registry, id, effect })
    })
    for (const effect of stepped.effects) if (!isLocal(effect)) perform({ registry, id, effect })
  })
)

/**
 * The decisions the screen shows: the server's as this tab holds them, with the person's own changes over them. The
 * same object while the decisions are: the whole review is worked out from it, and a refresh of the view that answers
 * the same, or a change to something else the screen holds, must not work out 50,000 rows again.
 */
export const shownDecisions = perKey((id: ImportId) =>
  Atom.readable((get): O.Option<SavedDecisions> => {
    const draft = get(draftOf(id))
    const next = O.isSome(draft.held) ? O.some(shown(draft)) : O.map(viewOf(get, id), (view) => view.decisions)
    const held = O.flatten(get.self<O.Option<SavedDecisions>>())
    return O.isSome(held) && O.isSome(next) && Eq.equals(held.value, next.value) ? held : next
  })
)

/** The rows of the person's that the server has not confirmed: what a confirm carries beside the decisions shown. */
export const unconfirmedRows = perKey((id: ImportId) => Atom.map(draftOf(id), unconfirmed))

/** Goes up when the region must be drawn again from what is shown: the decisions under it changed elsewhere. */
export const regionEpoch = perKey((id: ImportId) => Atom.map(draftOf(id), (draft) => draft.epoch))

/**
 * Follows one import's draft while its Review step is drawn: the step is on screen from when this is mounted until it
 * is let go, and every view of the import the tab comes to hold is handed to the machine.
 */
export const followDraft = perKey((id: ImportId) =>
  Atom.setIdleTTL(
    Atom.readable((get) => {
      const registry = get.registry
      registry.set(draftEvents(id), DraftEvent.Opened())
      get.addFinalizer(() => registry.set(draftEvents(id), DraftEvent.Left()))
      get.subscribe(
        importViewShown(id),
        (result) => {
          if (!AsyncResult.isSuccess(result)) return
          const { revision, decisions } = result.value
          registry.set(draftEvents(id), DraftEvent.ViewArrived({ revision, decisions }))
        },
        { immediate: true }
      )
    }),
    0
  )
)

/** Where this browser keeps one import's review for the person signed in: the undo history behind the decisions. */
const progressFor = (get: <A>(atom: Atom.Atom<A>) => A, id: ImportId) =>
  progressOf(
    get(member).pipe(
      O.map((actor) => ({ organizationId: actor.organizationId, memberId: actor.id, screen: `import:${id}` })),
      O.getOrUndefined
    )
  )

const stateHeld = perKey((id: ImportId) => Atom.map(reviewLocal(id), (local) => local.state))

/**
 * Where the region starts: the decisions the screen shows, with their undo history when this browser kept one that
 * ends at them, so a refresh brings "Undo last step" back too. A change made on another screen since starts a new
 * history from what is shown. The region holds a keep-or-replace answer as a value of its own column; the server
 * keeps it apart (`toServerDecisions`, `toRegionDecisions`).
 */
const startState = perKey((id: ImportId) =>
  Atom.readable((get): ReviewState => {
    const decisions = O.getOrElse(get(shownDecisions(id)), (): SavedDecisions => ({}))
    // Read as it stands when the review starts: every decision after that is kept there, and starts nothing again.
    const kept = O.flatMap(get.once(progressFor(get, id)), (progress) => progress.review)
    return O.match(kept, {
      onNone: () => restored(toRegionDecisions(decisions)),
      onSome: (review) =>
        Eq.equals(toServerDecisions(review.decisions), decisions)
          ? restoredReview(review)
          : restored(toRegionDecisions(decisions))
    })
  })
)

/**
 * The review region's decisions with their undo, for one import: the region reads them here and writes them here with
 * every action. A write is shown at once; the rows it changed (the difference between what the region held before the
 * action and after it, never a difference from the server's picture) go to the draft, which sends them; and the
 * decisions are kept in this browser with their undo history.
 */
export const reviewState = perKey((id: ImportId) =>
  Atom.writable(
    (get): ReviewState => O.getOrElse(get(stateHeld(id)), () => get(startState(id))),
    (ctx, next: ReviewState) => {
      const before = toServerDecisions(saved(ctx.get(reviewState(id))))
      const decisions = saved(next)
      const changes: RowChanges = changesBetween({ before, after: toServerDecisions(decisions) })
      ctx.set(reviewLocal(id), { ...ctx.get(reviewLocal(id)), state: O.some(next) })
      if (!R.isEmptyReadonlyRecord(changes)) ctx.set(draftEvents(id), DraftEvent.Decided({ changes }))
      const kept = progressFor((atom) => ctx.get(atom), id)
      ctx.set(
        kept,
        progressWith({
          before: ctx.get(kept),
          change: { step: "review", review: O.some(storedReview(next)), decided: R.keys(decisions).length }
        })
      )
    }
  )
)

/**
 * What the region drawn at one epoch is given: `source` for as long as that epoch is the draft's, and from then on the
 * last value it had. When the draft changes on another screen the region is drawn again from the new one (a new
 * epoch); the one about to go is not handed the new draft first, where it would work every row out again only to leave.
 *
 * @example whileCurrent({ id, epoch: 3, source: reviewState(id) })
 */
export const whileCurrent = <A>(input: {
  readonly id: ImportId
  readonly epoch: number
  readonly source: Atom.Atom<A>
}): Atom.Atom<A> =>
  Atom.readable((get) => {
    const held = get.self<A>()
    return O.isSome(held) && get(regionEpoch(input.id)) !== input.epoch ? held.value : get(input.source)
  })

/**
 * The decisions of the region drawn at one epoch of an import's draft: `reviewState` while that epoch is the
 * draft's. A region that has been replaced reads what it last had and writes nothing.
 */
export const reviewStateAt = perKey((id: ImportId) =>
  perKey((epoch: number) => {
    const read = whileCurrent({ id, epoch, source: reviewState(id) })
    return Atom.writable(
      (get): ReviewState => get(read),
      (ctx, next: ReviewState) => {
        if (ctx.get(regionEpoch(id)) === epoch) ctx.set(reviewState(id), next)
      }
    )
  })
)

export { draftOf }
