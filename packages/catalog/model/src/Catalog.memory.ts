import { dual } from "effect/Function"
import { type ImportListQuery, StoredDecisions } from "./Import/ImportStore.store.ts"
// The catalog's ports in memory: the twins a test runs the handlers on. One state holds what the tables hold, and
// each write is one pure step from a state to the next, as each write on D1 is one atomic batch. The one thing not
// to break: a twin answers what the D1 adapter answers. Where the adapter guards a write ("the import is still
// open", "this confirm is in force", "the item is at revision 1"), the twin checks the same thing in the same order.
//
// Two things a twin does not imitate, and a test of them belongs on D1: the size limits of a stored value, and the
// search's forgiveness of one wrong letter (the twin finds a word only as it is typed).
import { Change, changeDecidedBy } from "@inventory/catalog-contract/Change"
import { RowDecision, type DecisionDelta } from "@inventory/catalog-contract/Decision"
import type { FileProblem } from "@inventory/catalog-contract/FileProblem"
import { type ConfirmId, ImportId, type ItemId, type UploadKey } from "@inventory/catalog-contract/Ids"
import {
  ChangedItem,
  type ChangeRecord,
  changedItemsShown,
  type DecidedBy,
  decidedByNobody,
  ImportEvent,
  MatchTakeBack,
  OutcomeKind,
  outcomeOf,
  type PastImport,
  type RowOutcome,
  type TakeBackState
} from "@inventory/catalog-contract/Import"
import {
  costDigits,
  discontinuedOn,
  isActive,
  type ItemEdit,
  type ItemFields,
  Stocking,
  type StoredItem
} from "@inventory/catalog-contract/Item"
import { skuKey } from "@inventory/catalog-contract/SkuKey"
import { FilterOperator, ItemFilterColumn, ItemSortColumn } from "@inventory/catalog-contract/ItemQuery"
import type { ItemFacets, ItemFilter, ItemPage, ItemQuery, ItemSort } from "@inventory/catalog-contract/ItemQuery"
import { ColumnMove, MappingChoice } from "@inventory/catalog-contract/Mapping"
import {
  type Field,
  type StagedHead,
  StagedHeadJson,
  type StagedRow,
  type StagedTable
} from "@inventory/catalog-contract/Staged"
import { Suggestion } from "@inventory/catalog-contract/Suggestion"
import { Activity } from "@inventory/kernel/Activity"
import { ActivityId, type MemberId, type OrganizationId } from "@inventory/kernel/Ids"
import type { Member } from "@inventory/kernel/Member"
import * as A from "effect/Array"
import * as BigDecimal from "effect/BigDecimal"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Eq from "effect/Equal"
import * as Layer from "effect/Layer"
import * as O from "effect/Option"
import * as Order from "effect/Order"
import * as P from "effect/Predicate"
import * as R from "effect/Record"
import * as Ref from "effect/Ref"
import * as Result from "effect/Result"
import * as Str from "effect/String"
import { identity } from "effect/Function"
import * as SecureRandom from "effect/crypto/SecureRandom"
import * as S from "effect/Schema"
import { Answerer } from "./Answer/Answerer.port.ts"
import { ModelAllowance } from "./Answer/ModelAllowance.port.ts"
import { AssistantLog } from "./Assistant/AssistantLog.store.ts"
import type { CatalogPorts } from "./Catalog.ports.ts"
import { plannedItems, PlannedRow } from "./Confirm/Confirm.rules.ts"
import {
  type ChoicesSaved,
  confirmClosed,
  type Confirmed,
  confirmItemsChanged,
  confirmMoved,
  type ComparedAt,
  confirmWritten,
  type ConfirmWrite,
  type Decided,
  decisionsClosed,
  decisionsItemsChanged,
  decisionsMoved,
  decisionsRematched,
  decisionsSaved,
  type Draft,
  DraftStatus,
  draftTries,
  ImportStore,
  nothingInForce,
  type TakeBackWrite,
  tookBack,
  type TookBack,
  type Upload
} from "./Import/ImportStore.store.ts"
import { EditOutcome, ItemStore } from "./Item/ItemStore.store.ts"
import { abandonedAfterMinutes } from "./Staging/Upload.rules.ts"
import {
  type CompareAtMatch,
  type ItemsAsRead,
  stillAsRead,
  planMatch,
  takenBackOfMatch,
  takenBackWords,
  withTakeBacks,
  sameColumn
} from "./Import/Rematch.rules.ts"
import { type StoreSuggestions, SuggestionStore } from "./Suggestion/SuggestionStore.store.ts"
import { searchWords } from "./Item/ItemSearch.rules.ts"
import { plural } from "./Words.rules.ts"

// -- What the tables hold -------------------------------------------------------------------------------------

type MemUpload = {
  readonly organizationId: OrganizationId
  readonly actorId: MemberId
  readonly actorName: string
  readonly key: string
  readonly id: ImportId
  readonly head: StagedHead
  readonly headJson: string
  readonly rowCount: number
  readonly chunkCount: number
  readonly createdAt: DateTime.Utc
  readonly chunks: ReadonlyArray<{ readonly seq: number; readonly rows: ReadonlyArray<StagedRow> }>
}

type MemDecision = {
  readonly rowId: string
  readonly json: string
  readonly decision: RowDecision
  readonly author: string
  /** The member who made it: who it is, where a name is not unique. */
  readonly authorId: string
  readonly savedAt: number
  /** The member who last saved it, changed or not, and the draft's revision that save was made on. */
  readonly lastSavedBy: string
  readonly lastSavedOn: number
}

/** What a save leaves for the store to fill in of each decision it names. */
type MemSet = Omit<MemDecision, "author" | "authorId" | "savedAt" | "lastSavedBy" | "lastSavedOn">

type MemDraft = {
  readonly organizationId: OrganizationId
  readonly draft: Draft
  readonly rows: ReadonlyArray<StagedRow>
  readonly decisions: ReadonlyArray<MemDecision>
  /** How many saves have named a row of it, changed or not. */
  readonly saves: number
}

type MemItem = {
  readonly organizationId: OrganizationId
  readonly item: StoredItem
  readonly importId: ImportId
  readonly confirm: ConfirmId
  readonly rowNumber: number
  readonly part: number
  readonly updatedBy: O.Option<string>
  readonly updatedAt: O.Option<DateTime.Utc>
}

type MemConfirm = {
  readonly organizationId: OrganizationId
  readonly importId: ImportId
  readonly id: ConfirmId
  readonly byName: string
  readonly at: DateTime.Utc
  readonly created: number
  readonly updated: number
  readonly already: number
  readonly notImported: number
  readonly takeBack: O.Option<{ readonly id: string; readonly byName: string; readonly at: DateTime.Utc }>
  readonly removed: number
  readonly restored: number
  readonly kept: number
}

type MemOutcome = {
  readonly organizationId: OrganizationId
  readonly importId: ImportId
  readonly rowNumber: number
  readonly part: number
  readonly sku: string
  readonly name: string
  readonly outcome: OutcomeKind
  readonly reason: string
  readonly decidedBy: DecidedBy
}

type MemChange = {
  readonly organizationId: OrganizationId
  readonly importId: ImportId
  readonly confirm: ConfirmId
  readonly rowNumber: number
  readonly part: number
  readonly sku: string
  readonly change: Change
  readonly decidedByName: O.Option<string>
  readonly createdAt: DateTime.Utc
}

// The copy of an item a confirm replaced, kept so a take-back can put it back.
type MemReplaced = {
  readonly organizationId: OrganizationId
  readonly importId: ImportId
  readonly confirm: ConfirmId
  readonly itemId: ItemId
  readonly rowNumber: number
  readonly part: number
  readonly before: MemItem
  readonly revisionAfter: number
  readonly restored: boolean
}

type MemSuggestion = {
  readonly organizationId: OrganizationId
  readonly importId: ImportId
  readonly suggestion: Suggestion
}

/** Everything the catalog keeps, as the twins hold it. */
export type CatalogState = {
  readonly uploads: ReadonlyArray<MemUpload>
  readonly drafts: ReadonlyArray<MemDraft>
  readonly items: ReadonlyArray<MemItem>
  readonly confirms: ReadonlyArray<MemConfirm>
  readonly outcomes: ReadonlyArray<MemOutcome>
  readonly changes: ReadonlyArray<MemChange>
  readonly replaced: ReadonlyArray<MemReplaced>
  readonly suggestions: ReadonlyArray<MemSuggestion>
  /** Every audit line the catalog wrote, oldest first: what a test reads to see that a write left its line. */
  readonly activity: ReadonlyArray<Activity>
}

const empty: CatalogState = {
  uploads: [],
  drafts: [],
  items: [],
  confirms: [],
  outcomes: [],
  changes: [],
  replaced: [],
  suggestions: [],
  activity: []
}

/** The state the catalog's twins share. A test reads it to see what a handler stored. */
export class CatalogMemoryRef extends Context.Service<CatalogMemoryRef, Ref.Ref<CatalogState>>()(
  "@inventory/catalog-model/Catalog.memory/CatalogMemoryRef"
) {
  /** An empty catalog. */
  static readonly layer: Layer.Layer<CatalogMemoryRef> = Layer.effect(CatalogMemoryRef, Ref.make(empty))
}

// -- Small helpers ----------------------------------------------------------------------------------------------

const DecisionJson = S.fromJsonString(RowDecision)
const ChoicesJson = MappingChoice.pipe(S.Array, S.fromJsonString)
const MovesJson = ColumnMove.pipe(S.Array, S.fromJsonString)
const TakenBackJson = MatchTakeBack.pipe(S.Array, S.fromJsonString)

const line = (input: {
  readonly id: string
  readonly organizationId: OrganizationId
  readonly actorId: MemberId
  readonly actorName: Member["name"]
  readonly action: string
  readonly detail: string
  readonly at: DateTime.Utc
}): Activity =>
  Activity.make({
    id: ActivityId.make(input.id),
    organizationId: input.organizationId,
    actorId: input.actorId,
    actorName: input.actorName,
    action: input.action,
    detail: input.detail,
    agent: O.none(),
    createdAt: input.at
  })

const inForce = (confirm: MemConfirm): boolean => O.isNone(confirm.takeBack)

const sameDraft = (organizationId: OrganizationId, id: string) => (entry: MemDraft) =>
  entry.organizationId === organizationId && entry.draft.id === id

const mapDraft = (
  state: CatalogState,
  organizationId: OrganizationId,
  id: string,
  change: (entry: MemDraft) => MemDraft
): CatalogState => ({
  ...state,
  drafts: A.map(state.drafts, (entry) => (sameDraft(organizationId, id)(entry) ? change(entry) : entry))
})

const isOpen = (state: CatalogState, organizationId: OrganizationId, id: string): boolean =>
  A.some(state.drafts, (entry) => sameDraft(organizationId, id)(entry) && DraftStatus.is.open(entry.draft.status))

const byMoment = Order.mapInput(DateTime.Order, (confirm: MemConfirm) => confirm.at)

// Whether two stockings say the same: the same case, and the same day for a discontinued one.
const sameStocking = S.toEquivalence(Stocking)

// The fields a replace writes over and a take-back puts back: every value but the SKU and the item's origin.
const withFields = (item: StoredItem, fields: ItemFields): StoredItem => ({
  ...item,
  name: fields.name,
  description: fields.description,
  category: fields.category,
  uom: fields.uom,
  unitCost: fields.unitCost,
  quantityOnHand: fields.quantityOnHand,
  reorderPoint: fields.reorderPoint,
  stocking: fields.stocking,
  lotTracked: fields.lotTracked,
  tags: fields.tags,
  firstReceivedOn: fields.firstReceivedOn,
  dimensions: fields.dimensions,
  vendors: fields.vendors
})

// What a judgement's read is checked against now: the organization's items, and the import's created rows and its
// suggestions, as `createdRows` and the suggestion store's `list` read them.
const readNow = (state: CatalogState, organizationId: OrganizationId, importId: string) => ({
  items: A.map(
    A.filter(state.items, (entry) => entry.organizationId === organizationId),
    (entry) => entry.item
  ),
  created: A.map(
    A.filter(
      state.outcomes,
      (row) => row.organizationId === organizationId && row.importId === importId && OutcomeKind.is.created(row.outcome)
    ),
    (row) => ({ rowNumber: row.rowNumber, part: row.part })
  ),
  suggestions: A.map(
    A.filter(state.suggestions, (entry) => entry.organizationId === organizationId && entry.importId === importId),
    (entry) => entry.suggestion.id
  )
})

// -- The confirm, as one step -----------------------------------------------------------------------------------

const alreadyThere = "This SKU is already there. It is skipped, not changed."

const commitStep = (
  state: CatalogState,
  write: ConfirmWrite,
  /** The confirming person's unsaved decisions, encoded as they are stored. */
  unsaved: ReadonlyArray<MemSet>
): readonly [Confirmed, CatalogState] => {
  const audit = write.audit
  const org = audit.organizationId
  const open = A.findFirst(
    state.drafts,
    (entry) => sameDraft(org, write.draft)(entry) && DraftStatus.is.open(entry.draft.status)
  )
  if (O.isNone(open)) return [confirmClosed, state]
  // Made on another revision than the draft is at: nothing is written.
  if (open.value.draft.revision !== write.expected) return [confirmMoved(open.value.draft.revision), state]
  // A stored item, created row or suggestion the confirm's judgement read changed since: nothing is written, and the
  // confirm is judged again.
  if (!stillAsRead(write.read)(readNow(state, org, write.draft))) return [confirmItemsChanged, state]
  const at = audit.createdAt
  const written = plannedItems(write.plan)
  const ready = A.filter(written, PlannedRow.guards.ready)
  const replacing = A.filter(written, PlannedRow.guards.update)
  const ownedKey = (entry: MemItem): string => skuKey(entry.item)

  // New items: a code the organization already has is left as it is.
  const created = A.reduce(A.zip(ready, write.itemIds), state.items, (items, [row, id]) =>
    A.some(items, (entry) => entry.organizationId === org && ownedKey(entry) === skuKey(row.item))
      ? items
      : A.append(items, {
        organizationId: org,
        item: { id, ...row.item, createdAt: at, createdBy: audit.actorName, revision: 1 },
        importId: write.draft,
        confirm: write.confirm,
        rowNumber: row.rowNumber,
        part: row.part,
        updatedBy: O.none(),
        updatedAt: O.none()
      })
  )
  // The copies first, one per item, then the replaces.
  const copies = A.reduce(replacing, state.replaced, (replaced, row) =>
    O.match(
      A.findFirst(created, (entry) => entry.organizationId === org && ownedKey(entry) === skuKey(row.item)),
      {
        onNone: () => replaced,
        onSome: (stored) =>
          A.some(
            replaced,
            (copy) => copy.organizationId === org && copy.confirm === write.confirm && copy.itemId === stored.item.id
          )
            ? replaced
            : A.append(replaced, {
              organizationId: org,
              importId: write.draft,
              confirm: write.confirm,
              itemId: stored.item.id,
              rowNumber: row.rowNumber,
              part: row.part,
              before: stored,
              revisionAfter: stored.item.revision + 1,
              restored: false
            })
      }
    )
  )
  const items = A.reduce(replacing, created, (list, row) =>
    A.map(list, (entry) =>
      entry.organizationId === org && ownedKey(entry) === skuKey(row.item)
        ? {
          ...entry,
          item: { ...withFields(entry.item, row.item), revision: entry.item.revision + 1 },
          updatedBy: O.some<string>(audit.actorName),
          updatedAt: O.some(at)
        }
        : entry
    )
  )
  // A row counts as created only if its item is really there.
  const landed = (row: PlannedRow): boolean =>
    A.some(
      items,
      (entry) =>
        entry.organizationId === org &&
        entry.importId === write.draft &&
        entry.rowNumber === row.rowNumber &&
        entry.part === row.part
    )
  const outcomeFor = (row: PlannedRow): MemOutcome => {
    const at = {
      organizationId: org,
      importId: write.draft,
      rowNumber: row.rowNumber,
      part: row.part,
      sku: row.sku,
      name: row.name
    }
    if (PlannedRow.guards.update(row)) return { ...at, outcome: "updated", reason: "", decidedBy: decidedByNobody }
    if (landed(row)) return { ...at, outcome: "created", reason: "", decidedBy: decidedByNobody }
    return PlannedRow.match(row, {
      ready: (): MemOutcome => ({ ...at, outcome: "already", reason: alreadyThere, decidedBy: decidedByNobody }),
      update: (): MemOutcome => ({ ...at, outcome: "updated", reason: "", decidedBy: decidedByNobody }),
      already: (skipped): MemOutcome => ({
        ...at,
        outcome: "already",
        reason: skipped.reason,
        decidedBy: decidedByNobody
      }),
      notImported: (left): MemOutcome => ({
        ...at,
        outcome: "notImported",
        reason: left.reason,
        decidedBy: left.decidedBy
      })
    })
  }
  const fresh = A.map(write.plan.rows, outcomeFor)
  const sameRow = (a: MemOutcome, b: MemOutcome): boolean =>
    a.organizationId === b.organizationId &&
    a.importId === b.importId &&
    a.rowNumber === b.rowNumber &&
    a.part === b.part
  const outcomes = [...A.filter(state.outcomes, (old) => !A.some(fresh, (next) => sameRow(old, next))), ...fresh]
  // A changed value is recorded only for a row this confirm really wrote, and only once.
  const changes = A.reduce(written, state.changes, (list, row) => {
    const wrote =
      PlannedRow.guards.update(row) ||
      A.some(
        items,
        (entry) =>
          entry.organizationId === org &&
          entry.confirm === write.confirm &&
          entry.rowNumber === row.rowNumber &&
          entry.part === row.part
      )
    if (!wrote) return list
    return A.reduce(row.changes, list, (all, entry) =>
      A.some(
        all,
        (old) =>
          old.organizationId === org &&
          old.confirm === write.confirm &&
          old.rowNumber === row.rowNumber &&
          old.part === row.part &&
          old.change.field === entry.change.field
      )
        ? all
        : A.append(all, {
          organizationId: org,
          importId: write.draft,
          confirm: write.confirm,
          rowNumber: row.rowNumber,
          part: row.part,
          sku: row.sku,
          change: entry.change,
          decidedByName: entry.decidedByName,
          createdAt: at
        })
    )
  })
  const count = (outcome: OutcomeKind): number =>
    A.filter(outcomes, (row) => row.organizationId === org && row.importId === write.draft && row.outcome === outcome)
      .length
  const confirm: MemConfirm = {
    organizationId: org,
    importId: write.draft,
    id: write.confirm,
    byName: audit.actorName,
    at,
    created: A.filter(items, (entry) => entry.organizationId === org && entry.confirm === write.confirm).length,
    updated: count("updated"),
    already: count("already"),
    notImported: count("notImported"),
    takeBack: O.none(),
    removed: 0,
    restored: 0,
    kept: 0
  }
  const said = Activity.make({
    ...audit,
    action: "Imported items",
    detail: `Created ${confirm.created} items${confirm.updated === 0 ? "" : ` and replaced ${confirm.updated}`} from ${write.fileName}`
  })
  const next = mapDraft(
    {
      ...state,
      items,
      replaced: copies,
      outcomes,
      changes,
      confirms: A.append(state.confirms, confirm),
      activity: A.append(state.activity, said)
    },
    org,
    write.draft,
    (entry) => ({
      ...entry,
      // The confirming person's own decisions not saved yet, in the confirm's own write.
      decisions: withSaved(entry.decisions, {
        sets: unsaved,
        clear: write.unsaved.clear,
        author: audit.actorName,
        authorId: audit.actorId,
        savedAt: entry.draft.revision + 1,
        savedOn: entry.draft.revision
      }),
      draft: {
        ...entry.draft,
        status: "imported",
        // One revision on: a confirmed import is never taken for the open one of the same revision.
        revision: entry.draft.revision + 1,
        // What its matches took back is let go: there is nothing left to name, and from this revision on it is kept again.
        takenBackJson: "[]",
        takenBackFrom: entry.draft.revision + 1,
        importedBy: O.some<string>(audit.actorName),
        importedAt: O.some(at)
      }
    })
  )
  return [confirmWritten, next]
}

/**
 * A draft's stored decisions after one person's save: the same decision sent again leaves the row, who made it and the
 * revision it was saved at as they are; a new or changed one is theirs, saved at `savedAt`; a cleared row has none.
 * Every row the save names, changed or not, was last saved by them, on the revision the draft was at (`savedOn`).
 */
const withSaved = (
  stored: ReadonlyArray<MemDecision>,
  save: {
    readonly sets: ReadonlyArray<MemSet>
    readonly clear: ReadonlyArray<string>
    readonly author: string
    readonly authorId: string
    readonly savedAt: number
    readonly savedOn: number
  }
): ReadonlyArray<MemDecision> => {
  const last = { lastSavedBy: save.authorId, lastSavedOn: save.savedOn }
  const kept = A.map(stored, (old) =>
    O.match(
      A.findFirst(save.sets, (set) => set.rowId === old.rowId),
      {
        onNone: () => old,
        onSome: (set) =>
          set.json === old.json
            ? { ...old, ...last }
            : { ...set, author: save.author, authorId: save.authorId, savedAt: save.savedAt, ...last }
      }
    )
  )
  const added = A.map(
    A.filter(save.sets, (set) => !A.some(stored, (old) => old.rowId === set.rowId)),
    (set) => ({ ...set, author: save.author, authorId: save.authorId, savedAt: save.savedAt, ...last })
  )
  return A.filter([...kept, ...added], (entry) => !A.contains(save.clear, entry.rowId))
}

// -- The take-back, as one step -----------------------------------------------------------------------------------

const takeBackStep: {
  (state: CatalogState, write: TakeBackWrite): readonly [TookBack, CatalogState],
  (write: TakeBackWrite): (state: CatalogState) => readonly [TookBack, CatalogState]
} = dual(2, (state: CatalogState, write: TakeBackWrite): readonly [TookBack, CatalogState] => {
  const audit = write.audit
  const org = audit.organizationId
  const at = audit.createdAt
  const mine = (confirm: MemConfirm): boolean =>
    confirm.organizationId === org &&
    confirm.importId === write.draft &&
    inForce(confirm) &&
    A.contains(write.confirms, confirm.id)
  const marked = A.map(A.filter(state.confirms, mine), (confirm) => confirm.id)
  if (marked.length === 0) return [nothingInForce, state]
  const isMarked = (confirm: ConfirmId): boolean => A.contains(marked, confirm)

  // One pass marks the copies it will use, then writes them; a second pass reaches an item two confirms of this
  // take-back replaced in turn.
  const pass = (from: {
    readonly items: ReadonlyArray<MemItem>
    readonly replaced: ReadonlyArray<MemReplaced>
  }): { readonly items: ReadonlyArray<MemItem>; readonly replaced: ReadonlyArray<MemReplaced> } => {
    const usable = (copy: MemReplaced, items: ReadonlyArray<MemItem>): boolean =>
      A.some(
        items,
        (entry) =>
          entry.organizationId === org && entry.item.id === copy.itemId && entry.item.revision === copy.revisionAfter
      )
    const replaced = A.map(from.replaced, (copy) =>
      copy.organizationId === org && !copy.restored && isMarked(copy.confirm) && usable(copy, from.items)
        ? { ...copy, restored: true }
        : copy
    )
    const items = A.map(from.items, (entry) =>
      O.match(
        A.findFirst(
          replaced,
          (copy) =>
            copy.organizationId === org &&
            copy.restored &&
            isMarked(copy.confirm) &&
            copy.itemId === entry.item.id &&
            entry.item.revision === copy.revisionAfter
        ),
        {
          onNone: () => entry,
          onSome: (copy) => ({
            ...entry,
            item: { ...withFields(entry.item, copy.before.item), revision: copy.before.item.revision },
            updatedBy: copy.before.updatedBy,
            updatedAt: copy.before.updatedAt
          })
        }
      )
    )
    return { items, replaced }
  }
  const passes = Math.min(Math.max(write.confirms.length, 1), 10)
  const put = A.reduce(A.range(1, passes), { items: state.items, replaced: state.replaced }, pass)

  const ofConfirm = (confirm: ConfirmId) => (entry: MemItem) =>
    entry.organizationId === org && entry.confirm === confirm
  const copiesOf = (confirm: ConfirmId) => (copy: MemReplaced) =>
    copy.organizationId === org && copy.confirm === confirm
  const takenBackBy: string = audit.actorName
  const confirms = A.map(state.confirms, (confirm) =>
    isMarked(confirm.id) && confirm.organizationId === org
      ? {
        ...confirm,
        takeBack: O.some({ id: write.takeBack, byName: takenBackBy, at }),
        removed: A.filter(put.items, (entry) => ofConfirm(confirm.id)(entry) && entry.item.revision === 1).length,
        restored: A.filter(put.replaced, (copy) => copiesOf(confirm.id)(copy) && copy.restored).length,
        kept:
          A.filter(put.items, (entry) => ofConfirm(confirm.id)(entry) && entry.item.revision > 1).length +
          A.filter(put.replaced, (copy) => copiesOf(confirm.id)(copy) && !copy.restored).length
      }
      : confirm
  )
  const sum = (read: (confirm: MemConfirm) => number): number =>
    A.reduce(
      A.filter(confirms, (confirm) => isMarked(confirm.id) && confirm.organizationId === org),
      0,
      (total, confirm) => total + read(confirm)
    )
  const removed = sum((confirm) => confirm.removed)
  const restored = sum((confirm) => confirm.restored)
  const kept = sum((confirm) => confirm.kept)
  const said = Activity.make({
    ...audit,
    action: "Took back an import",
    detail: `${write.fileName}: removed ${removed}${removed === 1 ? " item" : " items"}${
      restored === 0
        ? ""
        : restored === 1
          ? ", restored 1 item it had replaced"
          : `, restored ${restored} items it had replaced`
    }${kept === 0 ? "" : kept === 1 ? ", kept 1 that had changed since" : `, kept ${kept} that had changed since`}`
  })
  // The rows whose items go, while the items are still there to say which rows they are.
  const outcomes = A.map(state.outcomes, (row): MemOutcome => {
    if (row.organizationId !== org || row.importId !== write.draft) return row
    const going =
      OutcomeKind.is.created(row.outcome) &&
      A.some(
        put.items,
        (entry) =>
          entry.organizationId === org &&
          entry.importId === write.draft &&
          entry.rowNumber === row.rowNumber &&
          entry.part === row.part &&
          entry.item.revision === 1 &&
          isMarked(entry.confirm)
      )
    const undone =
      OutcomeKind.is.updated(row.outcome) &&
      A.some(
        put.replaced,
        (copy) =>
          copy.organizationId === org &&
          copy.importId === write.draft &&
          copy.rowNumber === row.rowNumber &&
          copy.part === row.part &&
          copy.restored &&
          isMarked(copy.confirm)
      )
    return going || undone ? { ...row, outcome: "takenBack", reason: "", decidedBy: decidedByNobody } : row
  })
  const items = A.filter(
    put.items,
    (entry) => !(entry.organizationId === org && entry.item.revision === 1 && isMarked(entry.confirm))
  )
  const anyInForce = A.some(
    confirms,
    (confirm) => confirm.organizationId === org && confirm.importId === write.draft && inForce(confirm)
  )
  const next = mapDraft(
    { ...state, items, replaced: put.replaced, confirms, outcomes, activity: A.append(state.activity, said) },
    org,
    write.draft,
    (entry) => ({
      ...entry,
      draft: {
        ...entry.draft,
        revision: entry.draft.revision + 1,
        status: DraftStatus.is.imported(entry.draft.status) && !anyInForce ? "takenBack" : entry.draft.status
      }
    })
  )
  return [tookBack, next]
})

// -- Items: the page's questions, answered over a list --------------------------------------------------------

const textOf: {
  (item: StoredItem, column: ItemFilter["id"]): O.Option<string>,
  (column: ItemFilter["id"]): (item: StoredItem) => O.Option<string>
} = dual(2, (item: StoredItem, column: ItemFilter["id"]): O.Option<string> =>
  ItemFilterColumn.match(column, {
    name: () => O.some(item.name),
    sku: () => O.some(item.sku),
    description: () => item.description,
    category: () => O.some(item.category),
    uom: () => O.some(item.uom),
    isActive: () => O.some(`${isActive(item.stocking)}`),
    lotTracked: () => O.some(`${item.lotTracked}`),
    quantityOnHand: () => O.some(`${item.quantityOnHand}`),
    unitCost: () => item.unitCost.pipe(costDigits, O.some)
  }))

const numberOf: {
  (item: StoredItem, column: ItemFilter["id"]): O.Option<number>,
  (column: ItemFilter["id"]): (item: StoredItem) => O.Option<number>
} = dual(2, (item: StoredItem, column: ItemFilter["id"]): O.Option<number> =>
  column === "quantityOnHand"
    ? O.some(item.quantityOnHand)
    : column === "unitCost"
      ? O.some(Number(costDigits(item.unitCost)))
      : O.none())

const listOf = (value: ItemFilter["value"]): ReadonlyArray<string> => (P.isString(value) ? [value] : value)

const asNumber = (text: string): O.Option<number> =>
  Str.trim(text) === "" || !Number.isFinite(Number(text)) ? O.none() : O.some(Number(text))

/**
 * The text a value an item leaves out is compared as: empty, as the adapter's `IS NULL OR ... NOT LIKE` and
 * `IS NULL OR = ''` treat a column with no value.
 */
const leftOutText = ""

// None: the filter is half-typed or does not suit its column, and is left out, as the adapter leaves it out.
const passes: {
  (item: StoredItem, filter: ItemFilter): O.Option<boolean>,
  (filter: ItemFilter): (item: StoredItem) => O.Option<boolean>
} = dual(2, (item: StoredItem, filter: ItemFilter): O.Option<boolean> => {
  const has = O.filter(textOf(item, filter.id), Str.isNonEmpty)
  const values = listOf(filter.value)
  const typed = O.filter(A.head(values), Str.isNonEmpty)
  const filled = O.isSome(has)
  if (filter.operator === "isEmpty") return O.some(!filled)
  if (filter.operator === "isNotEmpty") return O.some(filled)
  const text = O.match(has, { onNone: () => leftOutText, onSome: Str.toLowerCase })
  return FilterOperator.matchOrElse(
    filter.operator,
    {
      iLike: () => O.map(typed, (first) => Str.includes(Str.toLowerCase(first))(text)),
      notILike: () => O.map(typed, (first) => !Str.includes(Str.toLowerCase(first))(text)),
      inArray: () =>
        values.length === 0 ? O.none() : O.some(A.some(values, (value) => Str.toLowerCase(value) === text)),
      notInArray: () =>
        values.length === 0 ? O.none() : O.some(!A.some(values, (value) => Str.toLowerCase(value) === text))
    },
    (operator) => {
      const number = numberOf(item, filter.id)
      if (O.isNone(number)) {
        if (operator === "eq") return O.map(typed, (first) => Str.toLowerCase(first) === text)
        if (operator === "ne") return O.map(typed, (first) => Str.toLowerCase(first) !== text)
        return O.none()
      }
      const n = number.value
      if (operator === "isBetween") {
        const low = O.flatMap(A.get(values, 0), asNumber)
        const high = O.flatMap(A.get(values, 1), asNumber)
        if (O.isNone(low) && O.isNone(high)) return O.none()
        return O.some(!O.exists(low, (min) => n < min) && !O.exists(high, (max) => n > max))
      }
      return O.map(O.flatMap(typed, asNumber), (wanted) =>
        FilterOperator.matchOrElse(
          operator,
          {
            eq: () => n === wanted,
            ne: () => n !== wanted,
            lt: () => n < wanted,
            lte: () => n <= wanted,
            gt: () => n > wanted
          },
          () => n >= wanted
        )
      )
    }
  )
})

/** Where an item that leaves a sorted value out goes: before every value, as SQLite orders an empty column first. */
const sortsFirst = { count: -1, day: "" } as const

const sortKey: {
  (item: StoredItem, column: ItemSort["id"]): string | number,
  (column: ItemSort["id"]): (item: StoredItem) => string | number
} = dual(2, (item: StoredItem, column: ItemSort["id"]): string | number =>
  ItemSortColumn.match(column, {
    name: () => Str.toLowerCase(item.name),
    sku: () => item.sku,
    category: () => item.category,
    uom: () => item.uom,
    unitCost: () => Number(costDigits(item.unitCost)),
    quantityOnHand: () => item.quantityOnHand,
    reorderPoint: () => O.match(item.reorderPoint, { onNone: () => sortsFirst.count, onSome: identity }),
    firstReceivedOn: () => O.match(item.firstReceivedOn, { onNone: () => sortsFirst.day, onSome: identity }),
    createdAt: () => DateTime.toEpochMillis(item.createdAt)
  }))

const compareBy =
  (sorting: ReadonlyArray<ItemSort>) =>
    (a: StoredItem, b: StoredItem): -1 | 0 | 1 => {
      for (const sort of sorting) {
        const left = sortKey(a, sort.id)
        const right = sortKey(b, sort.id)
        if (left !== right) {
          const up = left < right ? -1 : 1
          return sort.desc ? (up === -1 ? 1 : -1) : up
        }
      }
      return a.sku < b.sku ? -1 : a.sku > b.sku ? 1 : 0
    }

const pageOf: {
  (items: ReadonlyArray<StoredItem>, query: ItemQuery): ItemPage,
  (query: ItemQuery): (items: ReadonlyArray<StoredItem>) => ItemPage
} = dual(2, (items: ReadonlyArray<StoredItem>, query: ItemQuery): ItemPage => {
  const words = A.map(searchWords(query.search), Str.toLowerCase)
  const haystack = (item: StoredItem): string =>
    Str.toLowerCase(
      A.join([item.sku, item.name, ...A.fromOption(item.description), item.category, A.join(item.tags, " ")], " ")
    )
  const searched = A.filter(items, (item) => A.every(words, (word) => Str.includes(word)(haystack(item))))
  const narrowed = A.filter(searched, (item) => {
    const verdicts = A.getSomes(A.map(query.filters, (filter) => passes(item, filter)))
    if (verdicts.length === 0) return true
    return query.joinOperator === "and" ? A.every(verdicts, (ok) => ok) : A.some(verdicts, (ok) => ok)
  })
  const sorted = A.sort(narrowed, Order.make(compareBy(query.sorting)))
  const from = (query.page - 1) * query.perPage
  return {
    data: A.take(A.drop(sorted, from), query.perPage),
    pageCount: Math.ceil(sorted.length / query.perPage),
    total: sorted.length
  }
})

const facetsOf = (items: ReadonlyArray<StoredItem>): ItemFacets => {
  const counts = (read: (item: StoredItem) => string) =>
    A.map(
      A.sort(
        R.toEntries(A.groupBy(items, read)),
        Order.mapInput(Order.String, ([value]: readonly [string, unknown]) => value)
      ),
      ([value, group]) => ({ value, count: group.length })
    )
  const range = (read: (item: StoredItem) => number) => {
    const values = A.map(items, read)
    return A.isReadonlyArrayNonEmpty(values)
      ? { min: O.some(Math.min(...values)), max: O.some(Math.max(...values)) }
      : { min: O.none<number>(), max: O.none<number>() }
  }
  return {
    total: items.length,
    category: counts((item) => item.category),
    uom: counts((item) => item.uom),
    isActive: counts((item) => `${isActive(item.stocking)}`),
    lotTracked: counts((item) => `${item.lotTracked}`),
    quantityOnHand: range((item) => item.quantityOnHand),
    unitCost: range((item) => Number(costDigits(item.unitCost)))
  }
}

const sameAsEdit: {
  (item: StoredItem, edit: ItemEdit): boolean,
  (edit: ItemEdit): (item: StoredItem) => boolean
} = dual(2, (item: StoredItem, edit: ItemEdit): boolean =>
  item.name === edit.name &&
  Eq.equals(item.description, edit.description) &&
  item.category === edit.category &&
  item.uom === edit.uom &&
  BigDecimal.equals(item.unitCost, edit.unitCost) &&
  item.quantityOnHand === edit.quantityOnHand &&
  Eq.equals(item.reorderPoint, edit.reorderPoint) &&
  sameStocking(item.stocking, edit.stocking) &&
  Eq.equals(discontinuedOn(item.stocking), discontinuedOn(edit.stocking)) &&
  item.lotTracked === edit.lotTracked &&
  Eq.equals(item.firstReceivedOn, edit.firstReceivedOn))

// -- The twins ------------------------------------------------------------------------------------------------------

/** `ImportStore` in memory. */
export const ImportStoreMemory: Layer.Layer<ImportStore, never, CatalogMemoryRef> = Layer.effect(
  ImportStore,
  Effect.gen(function* () {
    const ref = yield* CatalogMemoryRef
    const random = yield* SecureRandom.SecureRandom
    const itemsOfOrg = (state: CatalogState, organizationId: OrganizationId): ReadonlyArray<StoredItem> =>
      A.sort(
        A.map(
          A.filter(state.items, (entry) => entry.organizationId === organizationId),
          (entry) => entry.item
        ),
        Order.mapInput(Order.String, (item: StoredItem) => item.sku)
      )
    const uploadOf = (state: CatalogState, actor: Member, id: string): O.Option<MemUpload> =>
      A.findFirst(
        state.uploads,
        (upload) => upload.organizationId === actor.organizationId && upload.actorId === actor.id && upload.id === id
      )
    const asUpload = (upload: MemUpload): Upload => ({
      id: upload.id,
      fileName: upload.head.fileName,
      headJson: upload.headJson,
      rowCount: upload.rowCount,
      chunkCount: upload.chunkCount
    })

    const beginUpload = Effect.fnUntraced(function* (
      actor: Member,
      key: UploadKey,
      head: StagedHead,
      counts: { readonly rowCount: number; readonly chunkCount: number }
    ) {
      const made = yield* random.uuidV4()
      const now = yield* DateTime.now
      const before = DateTime.subtract(now, { minutes: abandonedAfterMinutes })
      const headJson = yield* S.encodeEffect(StagedHeadJson)(head)
      const id = yield* Ref.modify(ref, (state): readonly [ImportId, CatalogState] => {
        // An upload left unfinished for an hour is gone before the next one of its organization starts.
        const kept = A.filter(
          state.uploads,
          (upload) =>
            upload.organizationId !== actor.organizationId || DateTime.isGreaterThanOrEqualTo(upload.createdAt, before)
        )
        const same = A.findFirst(
          kept,
          (upload) =>
            upload.organizationId === actor.organizationId && upload.actorId === actor.id && upload.key === key
        )
        if (O.isSome(same)) return [same.value.id, { ...state, uploads: kept }]
        const upload: MemUpload = {
          organizationId: actor.organizationId,
          actorId: actor.id,
          actorName: actor.name,
          key,
          id: ImportId.make(made),
          head,
          headJson,
          rowCount: counts.rowCount,
          chunkCount: counts.chunkCount,
          createdAt: now,
          chunks: []
        }
        return [upload.id, { ...state, uploads: A.append(kept, upload) }]
      })
      const answer: Result.Result<ImportId, FileProblem> = Result.succeed(id)
      return answer
    }, Effect.orDie)

    const putChunk = Effect.fnUntraced(function* (
      actor: Member,
      upload: Upload,
      seq: number,
      rows: ReadonlyArray<StagedRow>
    ) {
      yield* Ref.update(ref, (state) => ({
        ...state,
        uploads: A.map(state.uploads, (entry) =>
          entry.organizationId === actor.organizationId &&
          entry.actorId === actor.id &&
          entry.id === upload.id &&
          // The first copy of a piece stays.
          !A.some(entry.chunks, (chunk) => chunk.seq === seq)
            ? { ...entry, chunks: A.append(entry.chunks, { seq, rows }) }
            : entry
        )
      }))
      const answer: Result.Result<void, FileProblem> = Result.succeed(undefined)
      return answer
    })

    const finishUpload = Effect.fnUntraced(function* (actor: Member, upload: Upload, needsAtStart: number): Effect.fn.Return<boolean> {
      const id = yield* random.uuidV4()
      const at = yield* DateTime.now
      return yield* Ref.modify(ref, (state): readonly [boolean, CatalogState] => {
        const found = uploadOf(state, actor, upload.id)
        if (O.isNone(found)) return [false, state]
        const staged = found.value
        const draft: MemDraft = {
          organizationId: actor.organizationId,
          draft: {
            id: staged.id,
            fileName: staged.head.fileName,
            headJson: staged.headJson,
            rowCount: staged.rowCount,
            status: "open",
            actorName: staged.actorName,
            createdAt: at,
            importedBy: O.none(),
            importedAt: O.none(),
            revision: 0,
            needsAtStart,
            choicesJson: "[]",
            movesJson: "[]",
            takenBackJson: "[]",
            takenBackFrom: 0
          },
          rows: A.flatMap(
            A.sort(
              staged.chunks,
              Order.mapInput(Order.Number, (chunk: { readonly seq: number }) => chunk.seq)
            ),
            (chunk: { readonly rows: ReadonlyArray<StagedRow> }) => chunk.rows
          ),
          decisions: [],
          saves: 0
        }
        return [
          true,
          {
            ...state,
            uploads: A.filter(state.uploads, (entry) => entry !== staged),
            drafts: A.append(state.drafts, draft),
            activity: A.append(
              state.activity,
              line({
                id,
                organizationId: actor.organizationId,
                actorId: actor.id,
                actorName: actor.name,
                action: "Uploaded a file",
                detail: `${upload.fileName}: ${upload.rowCount} rows staged, nothing imported yet`,
                at
              })
            )
          }
        ]
      })
    })

    const decide = Effect.fnUntraced(function* (
      actor: Member,
      draft: Draft,
      delta: DecisionDelta,
      read: ItemsAsRead,
      expected: O.Option<ComparedAt>
    ) {
      const sets = yield* Effect.forEach(
        R.toEntries(delta.set),
        ([rowId, decision]) =>
          Effect.map(S.encodeEffect(DecisionJson)(decision), (json) => ({ rowId, json, decision })),
        { concurrency: 1 }
      )
      return yield* Ref.modify(ref, (state): readonly [Decided, CatalogState] => {
        const org = actor.organizationId
        const found = A.findFirst(state.drafts, sameDraft(org, draft.id))
        if (O.isNone(found) || !DraftStatus.is.open(found.value.draft.status)) return [decisionsClosed, state]
        // Checked against other choices than the draft has now: a match came between, and nothing is saved.
        if (found.value.draft.choicesJson !== draft.choicesJson) return [decisionsRematched, state]
        // Its rows that waited were compared at another revision than the draft is at, or another save has named a row
        // since (one that changed nothing moves no revision): nothing is saved.
        const now = { revision: found.value.draft.revision, saves: found.value.saves }
        if (O.exists(expected, (at) => at.revision !== now.revision || at.saves !== now.saves)) {
          return [decisionsMoved, state]
        }
        // Judged against stored items, created rows or suggestions that changed since (a Replace or Keep-stored across a
        // re-match): nothing is saved.
        if (!stillAsRead(read)(readNow(state, org, draft.id))) return [decisionsItemsChanged, state]
        const stored = found.value
        const differs = A.some(
          sets,
          (set) => !A.some(stored.decisions, (old) => old.rowId === set.rowId && old.json === set.json)
        )
        const clears = A.some(stored.decisions, (old) => A.contains(delta.clear, old.rowId))
        const revision = stored.draft.revision + (differs || clears ? 1 : 0)
        const decisions = withSaved(stored.decisions, {
          sets,
          clear: delta.clear,
          author: actor.name,
          authorId: actor.id,
          savedAt: revision,
          savedOn: stored.draft.revision
        })
        const named = sets.length + delta.clear.length > 0
        return [
          decisionsSaved({ revision, changed: differs || clears }),
          mapDraft(state, org, draft.id, (entry) => ({
            ...entry,
            decisions,
            saves: entry.saves + (named ? 1 : 0),
            draft: { ...entry.draft, revision }
          }))
        ]
      })
    }, Effect.orDie)

    // One match, as the store's one batch: worked out from the state as it is read (`planMatch`, the same plan the D1
    // store writes), and written only if that state is still the one in place (otherwise worked out again), so
    // nothing falls between its parts.
    const matchColumn = Effect.fnUntraced(function* (
      actor: Member,
      draft: Draft,
      choice: { readonly field: Field; readonly column: O.Option<number> },
      detail: string,
      compare: CompareAtMatch
    ) {
      const id = yield* random.uuidV4()
      const at = yield* DateTime.now
      const org = actor.organizationId
      const attempt = Effect.gen(function* () {
        const state = yield* Ref.get(ref)
        const found = A.findFirst(state.drafts, sameDraft(org, draft.id))
        if (O.isNone(found) || !DraftStatus.is.open(found.value.draft.status)) return O.some<ChoicesSaved>("closed")
        const entry = found.value
        const before = yield* S.decodeEffect(ChoicesJson)(entry.draft.choicesJson)
        // Choices that are already so are not a change: no audit line and no new revision.
        if (A.some(before, (old) => old.field === choice.field && sameColumn(old.column, choice.column))) {
          return O.some<ChoicesSaved>("same")
        }
        const head = yield* S.decodeEffect(StagedHeadJson)(entry.draft.headJson)
        const moves = yield* S.decodeEffect(MovesJson)(entry.draft.movesJson)
        const plan = yield* planMatch({
          head,
          choices: before,
          moves,
          decisions: R.fromEntries(A.map(entry.decisions, (old) => [old.rowId, old.decision] as const)),
          savedAt: R.fromEntries(A.map(entry.decisions, (old) => [old.rowId, old.savedAt] as const)),
          choice,
          revision: entry.draft.revision,
          compare
        })
        const choicesJson = yield* S.encodeEffect(ChoicesJson)(plan.choices)
        const movesJson = yield* S.encodeEffect(MovesJson)(plan.moves)
        const takenBack = takenBackOfMatch({
          revision: plan.at,
          by: actor.name,
          matched: choice.field,
          reads: plan.reads,
          savedAt: R.fromEntries(A.map(entry.decisions, (old) => [old.rowId, old.savedAt] as const)),
          notApplied: plan.notApplied
        })
        const kept = yield* S.decodeEffect(TakenBackJson)(entry.draft.takenBackJson)
        const takenBackJson = yield* S.encodeEffect(TakenBackJson)(withTakeBacks({ kept, added: takenBack }))
        // Every stored decision the match takes back, whoever made it; who made it stays.
        const decisions = yield* Effect.forEach(
          entry.decisions,
          (old) =>
            O.match(R.get(plan.rewrites, old.rowId), {
              onNone: () => Effect.succeed(old),
              onSome: (decision) =>
                Effect.map(S.encodeEffect(DecisionJson)(decision), (encoded) => ({ ...old, json: encoded, decision }))
            }),
          { concurrency: 1 }
        )
        return yield* Ref.modify(ref, (now): readonly [O.Option<ChoicesSaved>, CatalogState] => {
          if (now !== state) return [O.none(), now]
          const next = mapDraft(now, org, draft.id, (held) => ({
            ...held,
            decisions,
            draft: { ...held.draft, choicesJson, movesJson, takenBackJson, revision: plan.at }
          }))
          return [
            O.some("saved"),
            {
              ...next,
              activity: A.append(
                next.activity,
                line({
                  id,
                  organizationId: org,
                  actorId: actor.id,
                  actorName: actor.name,
                  action: "Matched a column",
                  detail: `${detail}${takenBackWords(takenBack)}`,
                  at
                })
              )
            }
          ]
        })
      })
      // As the D1 store: a try overtaken by any change (a save, a match, an item) is worked out again, at most
      // `draftTries` times, then answered as busy with nothing written.
      const settle = (triesLeft: number): Effect.Effect<ChoicesSaved, S.SchemaError> =>
        Effect.flatMap(attempt, (done) =>
          O.match(done, {
            onNone: () => (triesLeft <= 1 ? Effect.succeed<ChoicesSaved>("busy") : settle(triesLeft - 1)),
            onSome: Effect.succeed
          })
        )
      return yield* settle(draftTries)
    }, Effect.orDie)

    const reopen = Effect.fnUntraced(function* (actor: Member, draft: Draft) {
      const id = yield* random.uuidV4()
      const at = yield* DateTime.now
      yield* Ref.update(ref, (state) => {
        const org = actor.organizationId
        const found = A.findFirst(state.drafts, sameDraft(org, draft.id))
        if (O.isNone(found) || DraftStatus.is.open(found.value.draft.status)) return state
        const next = mapDraft(state, org, draft.id, (entry) => ({
          ...entry,
          draft: { ...entry.draft, status: "open", revision: entry.draft.revision + 1 }
        }))
        return {
          ...next,
          activity: A.append(
            next.activity,
            line({
              id,
              organizationId: org,
              actorId: actor.id,
              actorName: actor.name,
              action: "Reopened an import",
              detail: DraftStatus.is.takenBack(draft.status)
                ? `${draft.fileName}: to review again after it was taken back`
                : `${draft.fileName}: to fix the rows that were not imported`,
              at
            })
          )
        }
      })
    })

    const remove = Effect.fnUntraced(function* (actor: Member, draft: Draft) {
      const id = yield* random.uuidV4()
      const at = yield* DateTime.now
      return yield* Ref.modify(ref, (state): readonly [boolean, CatalogState] => {
        const org = actor.organizationId
        const of = (entry: { readonly organizationId: OrganizationId; readonly importId: ImportId }): boolean =>
          entry.organizationId === org && entry.importId === draft.id
        // An import may be removed while it is open and has no item in force, and no replace in force either.
        const removable =
          isOpen(state, org, draft.id) &&
          !A.some(state.items, of) &&
          !A.some(
            state.replaced,
            (copy) => of(copy) && A.some(state.confirms, (confirm) => confirm.id === copy.confirm && inForce(confirm))
          )
        if (!removable) return [false, state]
        return [
          true,
          {
            ...state,
            drafts: A.filter(state.drafts, (entry) => !sameDraft(org, draft.id)(entry)),
            suggestions: A.filter(state.suggestions, (entry) => !of(entry)),
            changes: A.filter(state.changes, (entry) => !of(entry)),
            outcomes: A.filter(state.outcomes, (entry) => !of(entry)),
            replaced: A.filter(state.replaced, (entry) => !of(entry)),
            confirms: A.filter(state.confirms, (entry) => !of(entry)),
            activity: A.append(
              state.activity,
              line({
                id,
                organizationId: org,
                actorId: actor.id,
                actorName: actor.name,
                action: "Removed an import",
                detail: `${draft.fileName}: ${plural(draft.rowCount, "row", "rows")}, ${O.isNone(draft.importedAt) ? "nothing had been imported" : "every item it created had been taken back"}`,
                at
              })
            )
          }
        ]
      })
    })

    const history = Effect.fnUntraced(function* (organizationId: OrganizationId, importId: string) {
      const state = yield* Ref.get(ref)
      const confirms = A.sort(
        A.filter(
          state.confirms,
          (confirm) => confirm.organizationId === organizationId && confirm.importId === importId
        ),
        byMoment
      )
      const takeBackId = (confirm: MemConfirm): O.Option<string> => O.map(confirm.takeBack, (taken) => taken.id)
      // One take-back can reverse several confirms: it is one event, with the sums over every confirm it reversed.
      const sameTakeBack = (row: MemConfirm) =>
        A.filter(confirms, (other) => O.isSome(takeBackId(row)) && Eq.equals(takeBackId(other), takeBackId(row)))
      const events = A.flatMap(confirms, (row): ReadonlyArray<ImportEvent> => [
        ImportEvent.cases.Confirmed.make({
          batchId: row.id,
          by: row.byName,
          at: row.at,
          created: row.created,
          updated: row.updated,
          already: row.already,
          notImported: row.notImported
        }),
        ...O.match(row.takeBack, {
          onNone: A.empty<ImportEvent>,
          onSome: (taken): ReadonlyArray<ImportEvent> =>
            O.exists(A.head(sameTakeBack(row)), (first) => first.id === row.id)
              ? [
                ImportEvent.cases.TakenBack.make({
                  batchId: row.id,
                  by: taken.byName,
                  at: taken.at,
                  removed: A.reduce(sameTakeBack(row), 0, (total, other) => total + other.removed),
                  restored: A.reduce(sameTakeBack(row), 0, (total, other) => total + other.restored),
                  kept: A.reduce(sameTakeBack(row), 0, (total, other) => total + other.kept)
                })
              ]
              : []
        })
      ])
      return A.sort(
        events,
        Order.mapInput(DateTime.Order, (event: ImportEvent) => event.at)
      )
    })

    const takeBackState = Effect.fnUntraced(function* (organizationId: OrganizationId, importId: string) {
      const state = yield* Ref.get(ref)
      const confirms = A.sort(
        A.filter(
          state.confirms,
          (confirm) => confirm.organizationId === organizationId && confirm.importId === importId && inForce(confirm)
        ),
        byMoment
      )
      const live = (confirm: ConfirmId): boolean => A.some(confirms, (entry) => entry.id === confirm)
      const mine = A.filter(
        state.items,
        (entry) => entry.organizationId === organizationId && entry.importId === importId
      )
      const copies = A.filter(
        state.replaced,
        (copy) => copy.organizationId === organizationId && copy.importId === importId
      )
      const itemOf = (copy: MemReplaced): O.Option<MemItem> =>
        A.findFirst(state.items, (entry) => entry.organizationId === organizationId && entry.item.id === copy.itemId)
      const changedOf = (kept: boolean): ReadonlyArray<MemItem> => {
        const created = A.filter(mine, (entry) => entry.item.revision > 1 && live(entry.confirm) !== kept)
        const replaced = A.getSomes(
          A.map(
            A.filter(copies, (copy) => live(copy.confirm) !== kept),
            (copy) =>
              O.filter(itemOf(copy), (entry) => (kept ? !copy.restored : entry.item.revision !== copy.revisionAfter))
          )
        )
        const all = A.dedupeWith([...created, ...replaced], (a, b) => a.item.id === b.item.id)
        // An item with no recorded update sorts after every one that has one.
        const when = (entry: MemItem): O.Option<number> => O.map(entry.updatedAt, DateTime.toEpochMillis)
        return A.sort(
          all,
          Order.combine(
            Order.flip(Order.mapInput(O.makeOrder(Order.Number), when)),
            Order.mapInput(Order.String, (entry: MemItem) => entry.item.sku)
          )
        )
      }
      const named = (rows: ReadonlyArray<MemItem>) =>
        A.map(A.take(rows, changedItemsShown), (entry) =>
          ChangedItem.make({
            sku: entry.item.sku,
            name: entry.item.name,
            changedBy: entry.updatedBy,
            changedAt: entry.updatedAt
          })
        )
      const changed = changedOf(false)
      const kept = changedOf(true)
      const answer: TakeBackState = {
        confirms: A.map(confirms, (confirm) => confirm.id),
        removable: A.filter(mine, (entry) => entry.item.revision === 1 && live(entry.confirm)).length,
        restorable: A.filter(
          copies,
          (copy) => live(copy.confirm) && O.exists(itemOf(copy), (entry) => entry.item.revision === copy.revisionAfter)
        ).length,
        changed: named(changed),
        changedCount: changed.length,
        kept: named(kept),
        keptCount: kept.length
      }
      return answer
    })

    return ImportStore.of({
      beginUpload: dual(
        4,
        (
          self: StagedHead,
          actor: Member,
          key: UploadKey,
          counts: { readonly rowCount: number; readonly chunkCount: number }
        ) => beginUpload(actor, key, self, counts)
      ),
      findUpload: dual(2, (self: string, actor: Member) => {
        const perform = Effect.fnUntraced(function* (actor: Member, id: string) {
          const state = yield* Ref.get(ref)
          return O.map(uploadOf(state, actor, id), asUpload)
        })
        return perform(actor, self)
      }),
      putChunk: dual(4, (self: Upload, actor: Member, seq: number, rows: ReadonlyArray<StagedRow>) =>
        putChunk(actor, self, seq, rows)
      ),
      uploadChunks: dual(2, (self: Upload, actor: Member) => {
        const perform = Effect.fnUntraced(function* (actor: Member, upload: Upload) {
          const state = yield* Ref.get(ref)
          return O.match(uploadOf(state, actor, upload.id), {
            onNone: A.empty,
            onSome: (found) =>
              A.sort(
                found.chunks,
                Order.mapInput(Order.Number, (chunk: { readonly seq: number }) => chunk.seq)
              )
          })
        })
        return perform(actor, self)
      }),
      finishUpload: dual(3, (self: Upload, actor: Member, needsAtStart: number) =>
        finishUpload(actor, self, needsAtStart)
      ),
      discardUpload: dual(2, (self: string, actor: Member) => {
        const perform = Effect.fnUntraced(function* (actor: Member, id: string) {
          return yield* Ref.modify(ref, (state): readonly [boolean, CatalogState] =>
            O.match(uploadOf(state, actor, id), {
              onNone: () => [false, state],
              onSome: (found) => [true, { ...state, uploads: A.filter(state.uploads, (entry) => entry !== found) }]
            })
          )
        })
        return perform(actor, self)
      }),
      find: dual(2, (self: string, organizationId: OrganizationId) => {
        const perform = Effect.fnUntraced(function* (organizationId: OrganizationId, id: string) {
          const state = yield* Ref.get(ref)
          return O.map(A.findFirst(state.drafts, sameDraft(organizationId, id)), (entry) => entry.draft)
        })
        return perform(organizationId, self)
      }),
      listOpen: Effect.fn("ImportStore.listOpen")(function* ({ organizationId, limit }: ImportListQuery) {
        const state = yield* Ref.get(ref)
        const open = A.reverse(
          A.sort(
            A.filter(
              state.drafts,
              (entry) => entry.organizationId === organizationId && DraftStatus.is.open(entry.draft.status)
            ),
            Order.mapInput(DateTime.Order, (entry: MemDraft) => entry.draft.createdAt)
          )
        )
        return { drafts: A.map(A.take(open, limit), (entry) => entry.draft), total: open.length }
      }),
      listPast: Effect.fn("ImportStore.listPast")(function* ({ organizationId, limit }: ImportListQuery) {
        const state = yield* Ref.get(ref)
        const past = A.getSomes(
          A.map(
            A.filter(state.drafts, (entry) => entry.organizationId === organizationId),
            (entry) =>
              O.map(
                A.last(
                  A.sort(
                    A.filter(
                      state.confirms,
                      (confirm) => confirm.organizationId === organizationId && confirm.importId === entry.draft.id
                    ),
                    byMoment
                  )
                ),
                (last) => ({ entry, last })
              )
          )
        )
        const newest = A.reverse(
          A.sort(
            past,
            Order.mapInput(DateTime.Order, (row: { readonly last: MemConfirm }) => row.last.at)
          )
        )
        const imports = A.map(A.take(newest, limit), ({ entry, last }): PastImport => ({
          id: entry.draft.id,
          fileName: entry.draft.fileName,
          rowCount: entry.draft.rowCount,
          status: entry.draft.status,
          confirmedByName: last.byName,
          confirmedAt: last.at,
          items: A.filter(
            state.items,
            (item) => item.organizationId === organizationId && item.importId === entry.draft.id
          ).length,
          notImported: last.notImported
        }))
        return { imports, total: past.length }
      }),
      remove: dual(2, (self: Draft, actor: Member) => remove(actor, self)),
      decisions: dual(2, (self: string, organizationId: OrganizationId) => {
        const perform = Effect.fnUntraced(function* (organizationId: OrganizationId, importId: string) {
          const state = yield* Ref.get(ref)
          const found = A.findFirst(state.drafts, sameDraft(organizationId, importId))
          const stored = O.match(found, {
            onNone: A.empty<MemDecision>,
            onSome: (entry) => entry.decisions
          })
          return StoredDecisions.make({
            decisions: R.fromEntries(A.map(stored, (entry) => [entry.rowId, entry.decision] as const)),
            authors: R.fromEntries(A.map(stored, (entry) => [entry.rowId, entry.author] as const)),
            deciders: R.fromEntries(A.map(stored, (entry) => [entry.rowId, entry.authorId] as const)),
            savedAt: R.fromEntries(A.map(stored, (entry) => [entry.rowId, entry.savedAt] as const)),
            lastSavedBy: R.fromEntries(A.map(stored, (entry) => [entry.rowId, entry.lastSavedBy] as const)),
            lastSavedOn: R.fromEntries(A.map(stored, (entry) => [entry.rowId, entry.lastSavedOn] as const)),
            ...R.getSomes({ saves: O.map(found, (entry) => entry.saves) })
          })
        })
        return perform(organizationId, self)
      }),
      decide: dual(
        5,
        (self: Draft, actor: Member, delta: DecisionDelta, read: ItemsAsRead, expected: O.Option<ComparedAt>) =>
          decide(actor, self, delta, read, expected)
      ),
      choices: Effect.fnUntraced(function* (draft: Draft) {
        return yield* S.decodeEffect(ChoicesJson)(draft.choicesJson)
      }, Effect.orDie),
      moves: Effect.fnUntraced(function* (draft: Draft) {
        return yield* S.decodeEffect(MovesJson)(draft.movesJson)
      }, Effect.orDie),
      takenBack: Effect.fnUntraced(function* (draft: Draft) {
        return yield* S.decodeEffect(TakenBackJson)(draft.takenBackJson)
      }, Effect.orDie),
      matchColumn: dual(
        5,
        (
          self: Draft,
          actor: Member,
          choice: { readonly field: Field; readonly column: O.Option<number> },
          detail: string,
          compare: CompareAtMatch
        ) => matchColumn(actor, self, choice, detail, compare)
      ),
      createdRows: dual(2, (self: string, organizationId: OrganizationId) => {
        const perform = Effect.fnUntraced(function* (organizationId: OrganizationId, importId: string) {
          const state = yield* Ref.get(ref)
          return A.map(
            A.filter(
              state.outcomes,
              (row) =>
                row.organizationId === organizationId &&
                row.importId === importId &&
                OutcomeKind.is.created(row.outcome)
            ),
            (row) => ({ rowNumber: row.rowNumber, part: row.part })
          )
        })
        return perform(organizationId, self)
      }),
      reopen: dual(2, (self: Draft, actor: Member) => reopen(actor, self)),
      changes: Effect.fnUntraced(function* (organizationId: OrganizationId) {
        const state = yield* Ref.get(ref)
        const mine = A.filter(state.changes, (entry) => entry.organizationId === organizationId)
        return A.getSomes(
          A.map(A.reverse(mine), (entry): O.Option<ChangeRecord> =>
            O.map(A.findFirst(state.drafts, sameDraft(organizationId, entry.importId)), (draft) => ({
              importId: entry.importId,
              fileName: draft.draft.fileName,
              rowNumber: entry.rowNumber,
              part: entry.part === 0 ? O.none() : O.some(entry.part),
              sku: entry.sku,
              change: entry.change,
              decidedByName: entry.decidedByName,
              createdAt: entry.createdAt,
              // Taken back when its confirm was and the item it went into is gone, or was put back as it was.
              takenBack:
                A.some(state.confirms, (confirm) => confirm.id === entry.confirm && !inForce(confirm)) &&
                !A.some(
                  state.items,
                  (item) =>
                    item.organizationId === organizationId &&
                    item.confirm === entry.confirm &&
                    item.rowNumber === entry.rowNumber &&
                    item.part === entry.part
                ) &&
                !A.some(
                  state.replaced,
                  (copy) =>
                    copy.organizationId === organizationId &&
                    copy.confirm === entry.confirm &&
                    copy.rowNumber === entry.rowNumber &&
                    copy.part === entry.part &&
                    !copy.restored
                )
            }))
          )
        )
      }),
      table: dual(2, (self: Draft, organizationId: OrganizationId) => {
        const perform = Effect.fnUntraced(function* (organizationId: OrganizationId, draft: Draft) {
          const state = yield* Ref.get(ref)
          const head = yield* S.decodeEffect(StagedHeadJson)(draft.headJson)
          const table: StagedTable = {
            ...head,
            rows: O.match(A.findFirst(state.drafts, sameDraft(organizationId, draft.id)), {
              onNone: A.empty,
              onSome: (entry) => entry.rows
            })
          }
          return table
        }, Effect.orDie)
        return perform(organizationId, self)
      }),
      storedAmong: dual(2, (self: ReadonlyArray<string>, organizationId: OrganizationId) => {
        const perform = Effect.fnUntraced(function* (organizationId: OrganizationId, keys: ReadonlyArray<string>) {
          const state = yield* Ref.get(ref)
          return A.filter(itemsOfOrg(state, organizationId), (item) => A.contains(keys, skuKey(item)))
        })
        return perform(organizationId, self)
      }),
      fixed: dual(2, (self: string, organizationId: OrganizationId) => {
        const perform = Effect.fnUntraced(function* (organizationId: OrganizationId, importId: string) {
          const state = yield* Ref.get(ref)
          const written = A.filter(
            state.changes,
            (entry) =>
              entry.organizationId === organizationId &&
              entry.importId === importId &&
              changeDecidedBy(entry.change) === "rule" &&
              Change.guards.appliedByRule(entry.change) &&
              A.some(
                state.outcomes,
                (row) =>
                  row.organizationId === organizationId &&
                  row.importId === importId &&
                  row.rowNumber === entry.rowNumber &&
                  row.part === entry.part &&
                  (OutcomeKind.is.created(row.outcome) || OutcomeKind.is.updated(row.outcome))
              )
          )
          return {
            rows: A.dedupe(A.map(written, (entry) => `${entry.rowNumber}.${entry.part}`)).length,
            cells: written.length
          }
        })
        return perform(organizationId, self)
      }),
      commit: Effect.fnUntraced(function* (write: ConfirmWrite) {
        const unsaved = yield* Effect.forEach(
          R.toEntries(write.unsaved.set),
          ([rowId, decision]) =>
            Effect.map(S.encodeEffect(DecisionJson)(decision), (json) => ({ rowId, json, decision })),
          { concurrency: 1 }
        )
        return yield* Ref.modify(ref, (state) => commitStep(state, write, unsaved))
      }, Effect.orDie),
      takeBack: Effect.fnUntraced(function* (write: TakeBackWrite) {
        return yield* Ref.modify(ref, (state) => takeBackStep(state, write))
      }),
      history: dual(2, (self: string, organizationId: OrganizationId) => history(organizationId, self)),
      takeBackState: dual(2, (self: string, organizationId: OrganizationId) => takeBackState(organizationId, self)),
      outcomes: dual(2, (self: string, organizationId: OrganizationId) => {
        const perform = Effect.fnUntraced(function* (organizationId: OrganizationId, importId: string) {
          const state = yield* Ref.get(ref)
          const rows = A.sort(
            A.filter(state.outcomes, (row) => row.organizationId === organizationId && row.importId === importId),
            Order.combine(
              Order.mapInput(Order.Number, (row: MemOutcome) => row.rowNumber),
              Order.mapInput(Order.Number, (row: MemOutcome) => row.part)
            )
          )
          return A.map(rows, (row): RowOutcome =>
            outcomeOf({
              rowNumber: row.rowNumber,
              part: row.part === 0 ? O.none() : O.some(row.part),
              sku: row.sku,
              name: row.name,
              outcome: row.outcome,
              reason: row.reason,
              decidedBy: row.decidedBy
            })
          )
        })
        return perform(organizationId, self)
      }),
      items: Effect.fnUntraced(function* (organizationId: OrganizationId) {
        const state = yield* Ref.get(ref)
        return itemsOfOrg(state, organizationId)
      })
    })
  })
).pipe(Layer.provide(SecureRandom.layerWebCrypto))

/** `ItemStore` in memory, over the same items the import store writes. */
export const ItemStoreMemory: Layer.Layer<ItemStore, never, CatalogMemoryRef> = Layer.effect(
  ItemStore,
  Effect.gen(function* () {
    const ref = yield* CatalogMemoryRef
    const random = yield* SecureRandom.SecureRandom
    const of = (state: CatalogState, organizationId: OrganizationId): ReadonlyArray<StoredItem> =>
      A.map(
        A.filter(state.items, (entry) => entry.organizationId === organizationId),
        (entry) => entry.item
      )
    const edit = Effect.fnUntraced(function* (actor: Member, id: string, change: ItemEdit) {
      const lineId = yield* random.uuidV4()
      const at = yield* DateTime.now
      return yield* Ref.modify(ref, (state): readonly [EditOutcome, CatalogState] => {
        const org = actor.organizationId
        const found = A.findFirst(state.items, (entry) => entry.organizationId === org && entry.item.id === id)
        if (O.isNone(found)) return [EditOutcome.cases.Missing.make({}), state]
        const stored = found.value.item
        const same = sameAsEdit(stored, change)
        // Written only while the item is at the revision the edit was made on and holds something else.
        if (stored.revision !== change.revision || same) {
          return [
            same ? EditOutcome.cases.Same.make({ item: stored }) : EditOutcome.cases.Changed.make({ item: stored }),
            state
          ]
        }
        const item: StoredItem = {
          ...stored,
          name: change.name,
          description: change.description,
          category: change.category,
          uom: change.uom,
          unitCost: change.unitCost,
          quantityOnHand: change.quantityOnHand,
          reorderPoint: change.reorderPoint,
          stocking: change.stocking,
          lotTracked: change.lotTracked,
          firstReceivedOn: change.firstReceivedOn,
          revision: stored.revision + 1
        }
        return [
          EditOutcome.cases.Edited.make({ item }),
          {
            ...state,
            items: A.map(state.items, (entry) =>
              entry === found.value
                ? { ...entry, item, updatedBy: O.some<string>(actor.name), updatedAt: O.some(at) }
                : entry
            ),
            activity: A.append(
              state.activity,
              line({
                id: lineId,
                organizationId: org,
                actorId: actor.id,
                actorName: actor.name,
                action: "Edited an item",
                detail: `${stored.sku} ${change.name}`,
                at
              })
            )
          }
        ]
      })
    })
    return ItemStore.of({
      page: dual(2, (self: ItemQuery, organizationId: OrganizationId) => {
        const perform = Effect.fnUntraced(function* (organizationId: OrganizationId, query: ItemQuery) {
          const state = yield* Ref.get(ref)
          return pageOf(of(state, organizationId), query)
        })
        return perform(organizationId, self)
      }),
      facets: Effect.fnUntraced(function* (organizationId: OrganizationId) {
        const state = yield* Ref.get(ref)
        return facetsOf(of(state, organizationId))
      }),
      edit: dual(3, (self: string, actor: Member, change: ItemEdit) => edit(actor, self, change))
    })
  })
).pipe(Layer.provide(SecureRandom.layerWebCrypto))

/** `SuggestionStore` in memory. */
export const SuggestionStoreMemory: Layer.Layer<SuggestionStore, never, CatalogMemoryRef> = Layer.effect(
  SuggestionStore,
  Effect.gen(function* () {
    const ref = yield* CatalogMemoryRef
    const where = (suggestion: Suggestion): string =>
      Suggestion.match(suggestion, {
        column: (column) => `:${column.field}`,
        name: (cell) => `${cell.rowId}:name`,
        category: (cell) => `${cell.rowId}:category`
      })
    return SuggestionStore.of({
      list: dual(2, (self: ImportId, organizationId: OrganizationId) => {
        const perform = Effect.fnUntraced(function* (organizationId: OrganizationId, importId: ImportId) {
          const state = yield* Ref.get(ref)
          return A.map(
            A.filter(
              state.suggestions,
              (entry) => entry.organizationId === organizationId && entry.importId === importId
            ),
            (entry) => entry.suggestion
          )
        })
        return perform(organizationId, self)
      }),
      store: Effect.fnUntraced(function* (write: StoreSuggestions) {
        return yield* Ref.modify(ref, (state): readonly [ReadonlyArray<Suggestion>, CatalogState] => {
          const org = write.audit.organizationId
          // The audit line is written whatever is stored; a suggestion only while the import is open, and only where
          // the row and field have none yet.
          const open = isOpen(state, org, write.draft)
          const made = A.reduce(write.suggestions, A.empty<Suggestion>(), (kept, suggestion) =>
            open &&
            !A.some(
              state.suggestions,
              (old) =>
                old.organizationId === org &&
                old.importId === write.draft &&
                where(old.suggestion) === where(suggestion)
            ) &&
            !A.some(kept, (other) => where(other) === where(suggestion))
              ? A.append(kept, suggestion)
              : kept
          )
          return [
            made,
            {
              ...state,
              suggestions: [
                ...state.suggestions,
                ...A.map(made, (suggestion) => ({ organizationId: org, importId: write.draft, suggestion }))
              ],
              activity: A.append(state.activity, write.audit)
            }
          ]
        })
      })
    })
  })
)

/** `AssistantLog` in memory: the line joins the others. */
export const AssistantLogMemory: Layer.Layer<AssistantLog, never, CatalogMemoryRef> = Layer.effect(
  AssistantLog,
  Effect.gen(function* () {
    const ref = yield* CatalogMemoryRef
    return AssistantLog.of({
      record: Effect.fnUntraced(function* (entry: Activity) {
        yield* Ref.update(ref, (state) => ({ ...state, activity: A.append(state.activity, entry) }))
      })
    })
  })
)

/** What the catalog in memory is set up with: the model that answers, and how many calls the day allows. */
export interface CatalogMemoryOptions {
  readonly answerer: Layer.Layer<Answerer>
  readonly calls: number
}

/**
 * The catalog in memory as most tests want it: no model, and the day's 40 calls, the access context's
 * `dailyModelCalls` (the model package does not depend on the access context, so the number is written here).
 */
export const offline: CatalogMemoryOptions = { answerer: Answerer.off, calls: 40 }

/**
 * Every port of the catalog in memory, and the state they share, set up as `options` says: a test that wants a model
 * passes `Answerer.scripted(...)`, and one that wants the allowance used passes `calls: 0`.
 */
export const catalogMemoryWith = (options: CatalogMemoryOptions): Layer.Layer<CatalogPorts | CatalogMemoryRef> =>
  Layer.mergeAll(
    ImportStoreMemory,
    ItemStoreMemory,
    SuggestionStoreMemory,
    AssistantLogMemory,
    options.answerer,
    ModelAllowance.memory(options.calls)
  ).pipe(Layer.provideMerge(CatalogMemoryRef.layer))

/** Every port of the catalog in memory, `offline`: no model and the day's 40 calls. */
export const catalogMemory: Layer.Layer<CatalogPorts | CatalogMemoryRef> = catalogMemoryWith(offline)
