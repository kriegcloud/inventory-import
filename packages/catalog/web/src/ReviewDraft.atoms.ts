// The review's draft as atoms, with no screen in it: what the Review step holds for one import besides the server's
// view, the decisions it shows, how it follows the draft while it is open, and what a decision does. The rule this
// file protects: the screen never shows, and never sends, less than the person and the others have decided.
import * as Data from "effect/Data"
import * as Eq from "effect/Equal"
import * as O from "effect/Option"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import * as Atom from "effect/reactivity/Atom"
import { toast } from "sonner"
import { perKey } from "@inventory/client/Api"
import { toastError } from "@inventory/client/SayError"
import type { SavedDecisions } from "@inventory/catalog-contract/Decision"
import type { ImportId } from "@inventory/catalog-contract/Ids"
import type { ImportView, SuggestOutcome } from "@inventory/catalog-contract/Import"
import type { SavedDecisions as RegionDecisions } from "@inventory/review/ReviewTypes"
import { decisionSaver } from "./Draft.controller.ts"
import { toRegionDecisions } from "./ImportReview.controller.ts"
import type { review } from "@inventory/catalog-model/Review"
import { changeView, importTable, importView, importViewShown, viewWith } from "./Imports.atoms.ts"

/**
 * What this screen holds for one import besides the server's view: the decisions it shows (until the first change,
 * the server's), the revision of the draft it has caught up with (none until it first sees the import), the region's
 * starting decisions and a count that starts the region again, what the person last typed as a SKU, whether a match
 * made here is on its way, and the last suggestions. Let go with the screen, so the next visit starts from the server.
 */
export interface ReviewLocal {
  readonly known: O.Option<number>
  readonly decisions: O.Option<SavedDecisions>
  readonly start: O.Option<RegionDecisions>
  readonly epoch: number
  readonly typed: string
  readonly matching: boolean
  readonly putBack: boolean
  readonly suggested: O.Option<SuggestOutcome>
}

export const reviewLocal = perKey((_id: ImportId) =>
  Atom.make<ReviewLocal>({
    known: O.none(),
    decisions: O.none(),
    start: O.none(),
    epoch: 0,
    typed: "",
    matching: false,
    putBack: false,
    suggested: O.none()
  })
)

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

/**
 * The decisions the screen shows: its own once the person has changed one, the server's until then. The same object
 * while the decisions are: the whole review is worked out from it, and a refresh of the view that answers the same,
 * or a change to something else the screen holds, must not work out 50,000 rows again.
 */
export const shownDecisions = perKey((id: ImportId) =>
  Atom.readable((get): O.Option<SavedDecisions> => {
    const next = O.orElse(get(reviewLocal(id)).decisions, () => O.map(viewOf(get, id), (view) => view.decisions))
    const held = O.flatten(get.self<O.Option<SavedDecisions>>())
    return O.isSome(held) && O.isSome(next) && held.value === next.value ? held : next
  })
)

/** What the follower does with a view of the draft it has just seen. */
export type FollowStep = Data.TaggedEnum<{
  /** The first view seen: the one the region is drawn from. */
  Start: {}
  /** A newer draft, or the server's after a refusal: the region starts again from it. `announce` tells the person. */
  Restart: { readonly announce: boolean }
  Stay: {}
}>
export const FollowStep = Data.taggedEnum<FollowStep>()

/**
 * What to do with a view of the draft, from where the screen stands. The first one seen is where the region starts,
 * even while the import is being asked again: the region is drawn from it, so its revision is the one to compare the
 * next with. After a refusal the server's decisions are put back. A newer revision starts the region again, unless
 * the saver still has a save out or a change unsent: the view is then behind this page, and the save's own answer
 * will ask for the newer one.
 *
 * @example follow({ known: O.some(20), putBack: false, matching: false, unsettled: false, waiting: false, revision: 25 }) // Restart, announced
 */
export const follow = (seen: {
  readonly known: O.Option<number>
  readonly putBack: boolean
  readonly matching: boolean
  readonly unsettled: boolean
  readonly waiting: boolean
  readonly revision: number
}): FollowStep => {
  if (O.isNone(seen.known)) return FollowStep.Start()
  if (seen.waiting) return FollowStep.Stay()
  if (seen.putBack) return FollowStep.Restart({ announce: false })
  if (seen.revision <= seen.known.value || seen.unsettled) return FollowStep.Stay()
  return FollowStep.Restart({ announce: !seen.matching })
}

/**
 * Follows one import's draft while its review is open (`follow` says what each view means). An atom, so it reads the
 * screen's state as it is now, not as it was when the screen last drew.
 */
export const followDraft = perKey((id: ImportId) =>
  Atom.readable((get) => {
    get.subscribe(
      importViewShown(id),
      (result) => {
        if (!AsyncResult.isSuccess(result)) return
        const now = result.value
        const registry = get.registry
        const local = registry.get(reviewLocal(id))
        const saver = decisionSaver(id)
        const restartFrom = (decisions: SavedDecisions): ReviewLocal => ({
          ...local,
          known: O.some(now.revision),
          decisions: O.some(decisions),
          start: O.some(toRegionDecisions(decisions)),
          epoch: local.epoch + 1,
          matching: false,
          putBack: false
        })
        FollowStep.$match(
          follow({
            known: local.known,
            putBack: local.putBack,
            matching: local.matching,
            unsettled: saver.unsettled(),
            waiting: result.waiting,
            revision: now.revision
          }),
          {
            Start: () => {
              // A save of an earlier visit to this screen is still out: the view does not hold it yet, so the screen
              // shows what the saver is sending, and the saver keeps it.
              if (saver.reset(now.decisions)) registry.set(reviewLocal(id), { ...local, known: O.some(now.revision) })
              else
                registry.set(reviewLocal(id), {
                  ...local,
                  known: O.some(now.revision),
                  decisions: O.some(saver.wanted()),
                  // No starting decisions of its own: the screen starts the region from the ones it shows, with the
                  // undo history this browser kept for them.
                  start: O.none(),
                  epoch: local.epoch + 1
                })
            },
            Restart: ({ announce }) => {
              saver.restart(now.decisions)
              registry.set(reviewLocal(id), restartFrom(now.decisions))
              if (announce) toast("Updated with what changed on another screen")
            },
            Stay: () => undefined
          }
        )
      },
      { immediate: true }
    )
  })
)

/**
 * The SKUs the person typed, as one text: a change means the server must say again which items are already there.
 * Only the rows where one was typed count. With an empty place for every other decision, the text changed whenever
 * the number of decisions did, and every save asked for the import again.
 */
const typedSkus = (saved: SavedDecisions): string =>
  Object.entries(saved)
    .flatMap(([rowId, decision]) => (decision.edits?.sku === undefined ? [] : [`${rowId}=${decision.edits.sku}`]))
    .join("|")

/**
 * The person changed a decision: the screen shows it at once and the saver sends it. What the save's answer does is
 * worked out from what is held when it arrives, never from the screen as it was drawn: suggestions, a match or another
 * save may have landed in between.
 */
export const decideRows = perKey((id: ImportId) =>
  Atom.fnSync((decisions: SavedDecisions, get) => {
    const registry = get.registry
    registry.update(reviewLocal(id), (now) => ({ ...now, decisions: O.some(decisions) }))
    decisionSaver(id).change(decisions, {
      onSaved: (revision, saved) => {
        const typed = typedSkus(saved)
        const now = registry.get(reviewLocal(id))
        // The next revision after the one this screen knows: nobody else saved in between.
        if (O.exists(now.known, (known) => revision === known + 1)) {
          registry.set(reviewLocal(id), { ...now, known: O.some(revision), typed })
          // Only the decisions and the revision, and never over a later revision already held.
          changeView({
            registry,
            id,
            change: (held) => (held.revision >= revision ? held : viewWith(held, { decisions: saved, revision }))
          })
          // A SKU the person typed may belong to an item that is already there: ask the server which are.
          if (typed !== now.typed) registry.refresh(importView(id))
          return
        }
        // Someone else saved in between: the revision this screen knows stays, so the view asked for now, which
        // holds their decisions too, is newer than it and starts the region again from everything the server holds.
        registry.set(reviewLocal(id), { ...now, typed })
        registry.refresh(importView(id))
      },
      // Refused: the screen goes back to the decisions the server holds, and the toast says why.
      onRefused: (error) => {
        toastError(error, { lead: "Your last decision was not saved, so the review shows what was saved." })
        registry.update(reviewLocal(id), (now) => ({ ...now, putBack: true }))
        registry.refresh(importView(id))
      }
    })
  })
)
