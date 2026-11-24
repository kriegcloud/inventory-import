// The review's draft as atoms, with no screen in it: what the Review step holds for one import besides the server's
// view, the decisions it shows, how it follows the draft while it is open, and what a decision does. The rule this
// file protects: the screen never shows, and never sends, less than the person and the others have decided.
import * as Cause from "effect/Cause"
import * as DateTime from "effect/DateTime"
import * as Eq from "effect/Equal"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import * as Atom from "effect/reactivity/Atom"
import type * as AtomRegistry from "effect/reactivity/AtomRegistry"
import { toast } from "sonner"
import { perKey } from "@inventory/client/Api"
import { NotSignedIn } from "@inventory/kernel/AccessError"
import { hasRole } from "@inventory/kernel/Role"
import { askWhoIsSignedIn, member, whoIsSignedInAsked } from "@inventory/client/MemberAtoms"
import { isTransient, sayError, toastError } from "@inventory/client/SayError"
import type { SavedDecisions, TakenBackKind } from "@inventory/catalog-contract/Decision"
import type { ImportId } from "@inventory/catalog-contract/Ids"
import {
  ImportEvent,
  type ImportView,
  type MatchTakeBack,
  type SuggestOutcome
} from "@inventory/catalog-contract/Import"
import { restored, saved } from "@inventory/review/ReviewDraft"
import type { ReviewState } from "@inventory/review/ReviewTypes"
import { restoredReview, storedReview } from "@inventory/review/SavedProgress"
import { dropFile, progressOf, progressWith } from "@inventory/review/SavedProgressHook"
import { navigate } from "@inventory/ui/Route"
import { AcceptsTakenBack, DraftBusy, DraftMoved, ImportNotFound } from "@inventory/catalog-contract/ImportRejection"
import { fieldLabels } from "@inventory/catalog-contract/Staged"
import * as A from "effect/Array"
import * as Str from "effect/String"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import type { review } from "@inventory/catalog-model/Review"
import { call, callWrite, catalogRuntime } from "./Catalog.runtime.ts"
import { importAddress } from "./internal/route.ts"
import {
  anotherThan,
  claimDraft,
  dismissalsKey,
  draftOf,
  keepWaiting,
  keptWaiting,
  letAnothersDraftGo,
  removedHere,
  type Owner,
  ownedByAnother,
  ownerOf,
  signedInAs,
  takeBackDismissals,
  takeUpGoneTabs,
  unreadKept
} from "./Draft.atoms.ts"
import { thisTab } from "@inventory/client/TabAtoms"
import { leftOverLines, namedWords, rowsWords, takeBackLine } from "./internal/leftOver.ts"
import {
  changesBetween,
  DraftEffect,
  DraftEvent,
  linesShown,
  type Named,
  notSaved,
  type RowChanges,
  Said,
  shown,
  type StaleAccept,
  step,
  waiting
} from "./Draft.machine.ts"
import { toRegionDecisions, toServerDecisions } from "./ImportReview.controller.ts"
import { changeView, importTable, importView, importViewShown, putConfirmed, viewWith } from "./Imports.atoms.ts"

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
const isLocal = DraftEffect.$match({
  Put: () => true,
  Restart: () => true,
  Send: () => false,
  Ask: () => false,
  Confirm: () => false,
  Say: () => false
})

/** A row as the person knows it: "row 55". */
const rowWords = (rowId: string): string => Str.replace("-", " ")(rowId)

/** A field as the person knows it: "Unit cost". */
const fieldWords = (field: string): string => O.getOrElse(R.get<string, string>(fieldLabels, field), () => field)

/**
 * The decisions the server did not apply, in a sentence, each by what it was and its row: "Unit cost on row 55; the
 * Replace on row 7 (SKU matched again)". An accept is named by its field alone, as it always was.
 */
export const acceptsWords = (accepts: ReadonlyArray<StaleAccept>): string =>
  A.join(
    A.map(accepts, (taken) => {
      const row = rowWords(taken.rowId)
      const field = fieldWords(taken.field)
      const said: Record<TakenBackKind, string> = {
        accept: `${field} on ${row}`,
        stored: `the keep-or-replace on ${row} (${field} matched again)`,
        twin: `the row kept of two on ${row} (${field} matched again)`,
        undo: `the undone fix of ${field} on ${row}`
      }
      return said[taken.kind ?? "accept"]
    }),
    "; "
  )

/** True when every decision taken back was an accept: said in the words an accept always had. */
const onlyAccepts = (accepts: ReadonlyArray<StaleAccept>): boolean =>
  A.every(accepts, (taken) => (taken.kind ?? "accept") === "accept")

/** The scope this browser keeps one import's review under, for the person signed in; none while nobody is. */
const scopeFor = (signedIn: O.Option<{ readonly organizationId: string; readonly id: string }>, id: ImportId) =>
  signedIn.pipe(
    O.map((actor) => ({ organizationId: actor.organizationId, memberId: actor.id, screen: `import:${id}` })),
    O.getOrUndefined
  )

/** A confirm ends the draft and its undo history: nothing of either comes back on the next visit. */
const forget = (registry: AtomRegistry.AtomRegistry, id: ImportId): void => {
  const scope = scopeFor(registry.get(member), id)
  registry.set(progressOf(scope), O.none())
  if (scope !== undefined) catalogRuntime().runFork(dropFile(scope).pipe(Effect.ignore))
}

/**
 * When the server last answered a write of each import's draft from this tab (a save or a confirm, made or not): what
 * a read must have left after to include it. Counted from the answer, not from when the write left: a read that left
 * after the write may still be served before the write commits, and a write sent again after a failure leaves later
 * than it was first sent.
 */
const lastAnswered = perKey((_id: ImportId) => Atom.make<O.Option<DateTime.Utc>>(O.none()).pipe(Atom.keepAlive))
/** The server answered a write of this import: recorded before the machine hears of it. */
const answered = (registry: AtomRegistry.AtomRegistry, id: ImportId): void =>
  registry.set(lastAnswered(id), O.some(DateTime.nowUnsafe()))

/**
 * Does `then` once who is signed in is known: at once, or, while the session is being asked again (after a write was
 * refused for nobody signed in, or a switch), when it has answered. The page's member until then is what it last knew,
 * which may not be whose cookie the request would carry.
 */
const onceSignedInKnown = (registry: AtomRegistry.AtomRegistry, then: () => void): void => {
  if (!registry.get(whoIsSignedInAsked)) return then()
  const stop = registry.subscribe(whoIsSignedInAsked, (asked) => {
    if (asked) return
    stop()
    then()
  })
}

/**
 * Does what the machine asks: sends, asks, puts the person's own save into the view, starts the region again. `owner`
 * is the member the draft's rows belonged to when the machine asked: a save or a confirm goes only as that member.
 */
const perform = (input: {
  readonly registry: AtomRegistry.AtomRegistry
  readonly id: ImportId
  readonly effect: DraftEffect
  readonly owner: O.Option<Owner>
}): void => {
  const { registry, id, owner } = input
  const happened = (event: DraftEvent) => registry.set(draftEvents(id), event)
  DraftEffect.$match(input.effect, {
    // A failure that may pass (the network, a server error) was sent again under the same rows already; if it
    // still fails the rows stay on screen and wait for "Save again": they are the person's work. A refusal (the
    // import was confirmed or removed meanwhile, the role was taken away) puts the screen back to what the server
    // holds, and the toast says why.
    // Rows go only as the member they belong to: with that member not signed in (signed out, or someone else signed
    // in on this page), nothing is sent and the rows wait as after a save refused for nobody signed in. While who is
    // signed in is being asked again, the save waits for the answer, and that answer decides.
    // A row that waited names what it may be written over (`over`), and the server says which were decided since.
    Send: ({ delta, id: sent, madeOn, over }) =>
      onceSignedInKnown(registry, () => {
        if (!signedInAs({ registry, owner })) return happened(DraftEvent.SaveSignedOut({ id: sent }))
        const payload = { madeOn, over, ...delta }
        void callWrite((api) => api.imports.decide({ params: { id }, payload })).then(
          ({ changed, decidedSince, notApplied, revision }) => {
            answered(registry, id)
            happened(DraftEvent.SaveAnswered({ id: sent, revision, changed, notApplied, decidedSince }))
          },
          (error: unknown) => {
            answered(registry, id)
            // Nobody signed in is not a refusal: the rows wait, kept in this browser, and are sent after sign-in; the
            // page's idea of who is signed in is out of date, so it is asked again (the tab then shows the sign-in page
            // or whoever is signed in now), and nothing of the draft is sent until it answers. Nor is a draft too busy
            // to work the save out against (others matching at the same moment): nothing was written, and the rows
            // wait to be sent again, as after a failure that may pass.
            if (S.is(NotSignedIn)(error)) askWhoIsSignedIn(registry)
            happened(
              S.is(NotSignedIn)(error)
                ? DraftEvent.SaveSignedOut({ id: sent })
                : isTransient(error) || S.is(DraftBusy)(error)
                  ? DraftEvent.SaveFailed({ id: sent })
                  : DraftEvent.SaveRefused({ id: sent, reason: sayError(error).sentence })
            )
          }
        )
      }),
    // Said only when the machine says so: an answer it no longer waits for is not told to anybody.
    Say: ({ what }) =>
      Said.$match(what, {
        // The rows stay on screen and are kept in this browser: they are sent with the next decision, when the import is
        // read again, or at once when the person presses Save again, wherever they are in the app. The server writes
        // each only where nobody decided it otherwise meanwhile.
        NotSaved: () =>
          void toast.error("Not saved yet", {
            description:
              "Your last decision is kept in this browser, and the server did not take it. Save again sends it now; where someone decided that row meanwhile, the review asks you which stands.",
            action: { label: "Save again", onClick: () => happened(DraftEvent.SaveAgain()) }
          }),
        // Said as it is: nobody is signed in, or somebody else is.
        SignedOut: () => {
          const another = ownedByAnother({ registry, id })
          void toast.error(another ? "Not saved: someone else is signed in" : "Not saved: you are signed out", {
            description: another
              ? "Your last decision is kept in this browser for you, and was not sent as them. Sign in again as yourself in this tab, then Save again sends it."
              : "Your last decision is kept in this browser. Sign in again as yourself in this tab, then Save again sends it.",
            action: { label: "Save again", onClick: () => happened(DraftEvent.SaveAgain()) }
          })
        },
        Refused: ({ reason }) =>
          void toast.error("Your last decision was not saved", {
            description: `${reason} It is listed above the review until you decide that row again or dismiss it; the review shows what was saved.`
          }),
        DecidedSince: ({ rows }) =>
          void toast.error(rows.length === 1 ? "1 row was decided since" : `${rows.length} rows were decided since`, {
            description: `Someone else or another tab decided ${rowsWords(rows)} while your decision waited, so it was not saved over theirs. The import's review asks you which stands.`
          }),
        // Not written, and what is saved may be an earlier decision of the person's as a match left it: not said as
        // somebody else's.
        SavedOtherwise: ({ rows }) =>
          void toast.error(rows.length === 1 ? "1 row was not saved" : `${rows.length} rows were not saved`, {
            description: `What is saved of ${rowsWords(rows)} is not what you last decided, so your decision was not saved over it. The import's review asks you which stands.`
          }),
        AcceptsTakenBack: ({ accepts }) =>
          void toast.error(
            onlyAccepts(accepts)
              ? accepts.length === 1
                ? "An accept was taken back"
                : `${accepts.length} accepts were taken back`
              : accepts.length === 1
                ? "A decision was taken back"
                : `${accepts.length} decisions were taken back`,
            {
              description: onlyAccepts(accepts)
                ? `The column was matched again after you accepted: ${acceptsWords(accepts)}. Each row shows its proposal again.`
                : `A column was matched again after you decided: ${acceptsWords(accepts)}. Each row shows what it reads now, to decide again.`
            }
          ),
        // Named once, and let go: the import was confirmed, and opened again, before these rows were sent.
        Outlived: (named) => {
          const one = leftOverLines(named).length === 1
          void toast.error(
            one
              ? "1 decision of yours was not part of this import"
              : `${leftOverLines(named).length} decisions of yours were not part of this import`,
            {
              duration: Number.POSITIVE_INFINITY,
              closeButton: true,
              description: `The import was confirmed, and opened again, before ${one ? "it was" : "they were"} saved, so ${one ? "it was" : "they were"} not sent: ${namedWords(named)}. The review shows the import as it is now.`
            }
          )
        }
      }),
    // The import is wanted no older than the last write the server answered this screen. A read already out that
    // left after that answer includes it, and is let land; one that left before is let land too, and asked once more
    // when it does. A read that is out is never ended: a save that answers every few milliseconds would otherwise keep
    // it from landing.
    // Off the review with no picture held (Save again pressed on another page, before the step had read the import),
    // nothing hands a view to the draft: it is read here, and handed over, so what waits is judged and sent on it.
    Ask: () => {
      importView(id).askAgain(registry, O.getOrUndefined(registry.get(lastAnswered(id))))
      const now = registry.get(draftOf(id))
      if (now.onScreen || O.isSome(now.held)) return
      void call((api) => api.imports.get({ params: { id } })).then(
        (view) => {
          const then = registry.get(draftOf(id))
          if (!then.onScreen && O.isNone(then.held)) registry.set(draftEvents(id), arrivedFrom(view, false))
        },
        // Not read (the network, the import gone): what waits stays, and the next press or visit asks again.
        () => undefined
      )
    },
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
    },
    // Sent once. Made: the result is put in place and the person taken to it, if they are still on the review. Not
    // made because the draft had moved on: the machine asks for the newer picture and the screen says so above the
    // review. Any other failure (somebody else confirmed it, the role was taken away, the network) is said, and the
    // import asked again, which moves the screen to the result where there is one.
    // Like a save, only as the member the rows belong to (the owner when the machine asked, even where nothing waits
    // after it): with that member not signed in, nothing is sent, nothing is imported, and the rows wait, kept for
    // them. While who is signed in is being asked again, the confirm waits for the answer, and that answer decides.
    Confirm: ({ delta, id: sent, madeOn, revision }) =>
      onceSignedInKnown(registry, () => {
        if (!signedInAs({ registry, owner })) {
          const another = anotherThan({ registry, owner })
          void toast.error(another ? "Not imported: someone else is signed in" : "Not imported: you are signed out", {
            description:
              "Nothing was confirmed. Your decisions are kept in this browser; confirm again once you are signed in as yourself."
          })
          return happened(DraftEvent.ConfirmFailed({ id: sent }))
        }
        return void call((api) => api.imports.commit({ params: { id }, payload: { revision, madeOn, ...delta } })).then(
          (view) => {
            answered(registry, id)
            const onScreen = registry.get(draftOf(id)).onScreen
            putConfirmed({ registry, view })
            // The picture the confirm answered with: rows decided while it was out are named on the result.
            happened(DraftEvent.ConfirmDone({ id: sent, revision: view.revision, decisions: view.decisions }))
            forget(registry, id)
            if (onScreen) navigate(importAddress(view.id, "result"))
          },
          (error: unknown) => {
            answered(registry, id)
            if (S.is(DraftMoved)(error)) return happened(DraftEvent.ConfirmMoved({ id: sent }))
            if (S.is(AcceptsTakenBack)(error)) {
              return happened(DraftEvent.ConfirmStale({ id: sent, accepts: error.accepts }))
            }
            // Closed already, or the answer was lost: the machine sends nothing and asks for the import, whose picture
            // says what was written.
            toastError(error)
            happened(DraftEvent.ConfirmFailed({ id: sent }))
          }
        )
      })
  })
}

/** A view of the import as the machine reads it: a picture, whether it can be decided, its confirms and its matches. */
const arrivedFrom = (view: ImportView, waiting: boolean): DraftEvent =>
  DraftEvent.ViewArrived({
    revision: view.revision,
    decisions: view.decisions,
    open: view.status === "open",
    // How many times it was confirmed: one more than the person's waiting rows knew means they outlived one.
    confirms: A.filter(view.history, ImportEvent.guards.Confirmed).length,
    waiting,
    matches: A.map(view.choices, (choice) => choice.at),
    takenBack: A.map(view.takenBack, (taken) => ({ revision: taken.revision, rows: taken.rows }))
  })

/** Keeps what waits of one import's draft in this browser, as it stands now, with its file's name where it is known. */
const keeping = ({ id, registry }: { readonly registry: AtomRegistry.AtomRegistry; readonly id: ImportId }): void =>
  keepWaiting({
    registry,
    id,
    waits: waiting(registry.get(draftOf(id))),
    fileName: O.flatMap(importView(id).peek(registry), (view) => O.fromNullishOr(view.fileName))
  })

/**
 * Everything that happens to one import's draft goes in here: the machine says what the draft becomes and what to
 * do, and this does it. Written to, never read.
 */
export const draftEvents = perKey((id: ImportId) =>
  Atom.writable(noValue, (ctx, event: DraftEvent) => {
    const registry = ctx.get(registryOf)
    // The person's own doing: the step opened, a row decided or a line settled, rows taken up from a tab of theirs that
    // is gone. The rows are then theirs, kept under their key.
    const pressed =
      DraftEvent.$is("Opened")(event) ||
      DraftEvent.$is("Decided")(event) ||
      DraftEvent.$is("Settled")(event) ||
      DraftEvent.$is("TakenUp")(event) ||
      DraftEvent.$is("ConfirmPressed")(event)
    // The draft in memory is another member's (someone else signed in on this page) and the member signed in now acts
    // on the import: the draft is let go, and its rows stay kept in this browser for that member, never sent, confirmed
    // or kept as whoever is signed in now. An answer to the owner's own request is still the owner's. With the step
    // drawn, the draft starts again for the member signed in now, over the view the screen shows (their own kept rows,
    // and the picture their press is made on), so the press is never made on a draft with no picture.
    if (pressed && ownedByAnother({ registry, id })) {
      const onScreen = registry.get(draftOf(id)).onScreen
      letAnothersDraftGo({ registry, id })
      registry.update(reviewLocal(id), (now) => ({ ...now, state: O.none() }))
      if (onScreen && !DraftEvent.$is("Opened")(event)) {
        registry.set(draftEvents(id), DraftEvent.Opened({ kept: keptWaiting({ registry, id }) }))
        O.map(importView(id).peek(registry), (view) => registry.set(draftEvents(id), arrivedFrom(view, true)))
      }
      // A confirm pressed on a screen that showed another member's decisions confirms nothing: the button said what
      // that screen showed, not what the import holds for the member signed in now. The screen is drawn again for them.
      if (DraftEvent.$is("ConfirmPressed")(event)) {
        void toast.error("Nothing was imported", {
          description:
            "This review was showing decisions another person made in this browser, not saved yet. It now shows the import for you: check it, then import."
        })
        return
      }
    }
    if (pressed) {
      claimDraft({ registry, id })
      // The member's own entry in this browser, not read into the draft this page holds (another member opened the
      // step here before them): taken in first, so writing their rows never erases what it kept, and their new rows are
      // kept under their key from the first one.
      if (!DraftEvent.$is("Opened")(event)) {
        O.map(unreadKept({ registry, id }), (kept) =>
          registry.set(draftEvents(id), DraftEvent.TakenUp({ kept, here: true }))
        )
      }
    }
    // The member the rows belong to when the machine asks for a save or a confirm: whoever the draft was for before
    // what waits is written, since a confirm that leaves nothing waiting still goes as them, or not at all.
    const owner = ownerOf({ registry, id })
    const stepped = step(registry.get(draftOf(id)), event)
    // One change for whoever follows the draft: the new draft and what it changes in this tab are in place before
    // anything is worked out from them (the epoch, before what a region of that epoch is given). What goes to the
    // server goes after.
    Atom.batch(() => {
      registry.set(draftOf(id), stepped.draft)
      for (const effect of stepped.effects) if (isLocal(effect)) perform({ registry, id, effect, owner })
    })
    // What waits is kept in this browser as it changes, so a reload finds it, under the member the rows belong to;
    // nothing waiting is no entry.
    keeping({ registry, id })
    for (const effect of stepped.effects) if (!isLocal(effect)) perform({ registry, id, effect, owner })
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

/** One take-back of a match, as its dismissal is kept: the revision it was written at, the field and the kind. */
const takeBackKey = (taken: MatchTakeBack): string => `${taken.revision}:${taken.field}:${taken.kind}`

/** Where the member signed in keeps what they dismissed of one import's take-backs; none while nobody is. */
const dismissedKey = (signedIn: O.Option<{ readonly organizationId: string; readonly id: string }>, id: ImportId) =>
  O.map(signedIn, (actor) => dismissalsKey({ actor, id }))

/**
 * The decisions matches took back that this screen names for one import (Benjamin, 2026-11-20, G1, G5, G6, G7: "the
 * screen names it as taken back"): each match's take-backs of one kind on one field, from the view (the matcher's own
 * screen reads its match's answer, every other screen the picture it reads next), until the person dismisses them.
 * A dismissal is kept per person and import in this browser.
 */
export const takeBacksNamed = perKey((id: ImportId) =>
  Atom.readable((get): ReadonlyArray<MatchTakeBack> => {
    const dismissed = O.match(dismissedKey(get(member), id), {
      onNone: (): ReadonlyArray<string> => [],
      onSome: (key) => O.getOrElse(get(takeBackDismissals(key)), (): ReadonlyArray<string> => [])
    })
    return O.match(viewOf(get, id), {
      onNone: (): ReadonlyArray<MatchTakeBack> => [],
      onSome: (view) => A.filter(view.takenBack, (taken) => !A.contains(dismissed, takeBackKey(taken)))
    })
  })
)

/**
 * The take-backs named, each as the line above the review says it: for the rows not decided again since, and only
 * somebody who can decide is told to decide. A line with no such row left is gone.
 */
export const takeBackLines = perKey((id: ImportId) =>
  Atom.readable((get): ReadonlyArray<{ readonly taken: MatchTakeBack; readonly text: string }> => {
    const canDecide = O.exists(get(member), (actor) => hasRole(actor.role, "editor"))
    const decisions = O.match(viewOf(get, id), {
      onNone: (): SavedDecisions => ({}),
      onSome: (view) => view.decisions
    })
    return A.getSomes(
      A.map(get(takeBacksNamed(id)), (taken) =>
        O.map(takeBackLine({ taken, decisions, canDecide }), (text) => ({ taken, text }))
      )
    )
  })
)

/** The person dismissed one named take-back: it is named no more to them for this import, in this browser. */
export const dismissTakeBack = perKey((id: ImportId) =>
  Atom.writable(noValue, (ctx, taken: MatchTakeBack) => {
    O.map(dismissedKey(ctx.get(member), id), (key) =>
      ctx.set(
        takeBackDismissals(key),
        O.some(
          A.dedupe([
            ...O.getOrElse(ctx.get(takeBackDismissals(key)), (): ReadonlyArray<string> => []),
            takeBackKey(taken)
          ])
        )
      )
    )
  })
)

/** True from the press of the confirm button until the server has answered it, or it is held back. */
export const confirmingImport = perKey((id: ImportId) =>
  Atom.map(draftOf(id), (draft) => draft.confirm !== "idle" || O.exists(draft.heldBack, (why) => !why.read))
)

/** The lines above the review: the rows that wait for the person to say which decision stands, or let one go. */
export const reviewLines = perKey((id: ImportId) => Atom.map(draftOf(id), linesShown))

/** How many of the person's rows wait after a save that failed, for the line that says so; 0 while none do. */
export const rowsNotSaved = perKey((id: ImportId) => Atom.map(draftOf(id), notSaved))

/**
 * The person's decisions that were not part of the confirm that closed the import (they were never saved), for the
 * result to name, each line whole: none while there are none, or while the import can still be decided.
 */
export const rowsLeftOver = perKey((id: ImportId) =>
  Atom.map(draftOf(id), (draft): O.Option<Named> => (draft.ended ? draft.leftOver : O.none()))
)

/**
 * Mounted by the screen that names the rows left over: when it leaves, they have been named, and nothing of them is
 * kept any more.
 */
export const namingLeftOver = perKey((id: ImportId) =>
  Atom.setIdleTTL(
    Atom.readable((get) => {
      const registry = get.registry
      get.addFinalizer(() => registry.set(draftEvents(id), DraftEvent.LeftOverNamed()))
    }),
    0
  )
)

/**
 * The last confirm was not made because the import had changed since the picture it was pressed on: how many rows
 * the newer picture decides otherwise (none where it was a match or a suggestion), until the person confirms again.
 */
export const confirmHeldBack = perKey((id: ImportId) => Atom.map(draftOf(id), (draft) => draft.heldBack))

/**
 * How many presses of Import the lines above the review have stopped: more at each press, so each takes the person to
 * the lines; 0 once no line is left.
 */
export const importStopped = perKey((id: ImportId) => Atom.map(draftOf(id), (draft) => draft.stopped))

/** Goes up when the region must be drawn again from what is shown: the decisions under it changed elsewhere. */
export const regionEpoch = perKey((id: ImportId) => Atom.map(draftOf(id), (draft) => draft.epoch))

/**
 * The organization an import was not found in when who is signed in was last asked because of it: none once the import
 * has been found again.
 */
const askedWhere = perKey((_id: ImportId) => Atom.make<O.Option<string>>(O.none()).pipe(Atom.keepAlive))

/**
 * Follows one import's draft while its Review step is drawn: the step is on screen from when this is mounted until it
 * is let go, and every view of the import the tab comes to hold is handed to the machine.
 */
export const followDraft = perKey((id: ImportId) =>
  Atom.setIdleTTL(
    Atom.readable((get) => {
      const registry = get.registry
      const takeUp = () =>
        takeUpGoneTabs({ registry, id, take: (kept) => registry.set(draftEvents(id), DraftEvent.TakenUp({ kept })) })
      // What this browser kept of the person's waiting rows (from before a reload) comes back with the step.
      registry.set(draftEvents(id), DraftEvent.Opened({ kept: keptWaiting({ registry, id }) }))
      // And what the person's tabs that are gone kept for it: taken up by this one (never from a tab still open).
      takeUp()
      // Drawn before this tab's id is its own (the page has just started): its own kept rows, and the gone tabs',
      // are read once it is, and taken into the draft as it stands then; nothing is written over them before.
      if (O.isNone(registry.get(thisTab))) {
        let read = false
        get.subscribe(thisTab, (tab) => {
          if (read || O.isNone(tab)) return
          read = true
          O.map(keptWaiting({ registry, id }), (kept) =>
            registry.set(draftEvents(id), DraftEvent.TakenUp({ kept, here: true }))
          )
          // Rows decided here meanwhile could not be kept under an id the tab did not have yet: they are now.
          keeping({ registry, id })
          takeUp()
        })
      }
      get.addFinalizer(() => registry.set(draftEvents(id), DraftEvent.Left()))
      // (The browser asks before the page is left while rows wait wherever the person is: `askBeforeLeaving`.)
      let handed: unknown = undefined
      const hand = (result: AsyncResult.AsyncResult<ImportView, unknown>): void => {
        handed = result
        // Not found: removed, and its rows are let go and named; or not in the organization the rows belong to (the
        // session's was switched in another tab), where nothing kept is touched and who is signed in is asked again.
        if (AsyncResult.isFailure(result)) {
          const error = result.cause.pipe(Cause.squash)
          if (result.waiting || !S.is(ImportNotFound)(error)) return
          if (removedHere({ registry, id, error })) return
          // Asked once for the organization it was looked for in: asking takes the workspace away until it has answered,
          // and a step drawn again over the same answer must not ask again, without end.
          const asked = O.some(error.organizationId)
          if (Eq.equals(registry.get(askedWhere(id)), asked)) return
          registry.set(askedWhere(id), asked)
          askWhoIsSignedIn(registry)
          return
        }
        if (!AsyncResult.isSuccess(result)) return
        // Found again, by an answer of the server's: the next not found is another matter.
        if (!result.waiting) registry.set(askedWhere(id), O.none())
        // The view held, given again while it is asked anew, is no answer: the machine is told so.
        registry.set(draftEvents(id), arrivedFrom(result.value, result.waiting))
      }
      get.subscribe(importViewShown(id), hand, { immediate: true })
      // What the first view asked for may have answered while it was being handed over, before anything listened:
      // the view as it is now is handed over too.
      const now = registry.get(importViewShown(id))
      if (now !== handed) hand(now)
    }),
    0
  )
)

/** Where this browser keeps one import's review for the person signed in: the undo history behind the decisions. */
const progressFor = (get: <A>(atom: Atom.Atom<A>) => A, id: ImportId) => progressOf(scopeFor(get(member), id))

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
