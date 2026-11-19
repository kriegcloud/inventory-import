// The catalog's ports in memory: the twins a test runs the handlers on. One state holds what the tables hold, and
// each write is one pure step from a state to the next, as each write on D1 is one atomic batch. The one thing not
// to break: a twin answers what the D1 adapter answers. Where the adapter guards a write ("the import is still
// open", "this confirm is in force", "the item is at revision 1"), the twin checks the same thing in the same order.
//
// Two things a twin does not imitate, and a test of them belongs on D1: the size limits of a stored value, and the
// search's forgiveness of one wrong letter (the twin finds a word only as it is typed).
import { type Change, changeDecidedBy } from "@inventory/catalog-contract/Change"
import { RowDecision, type SavedDecisions, type DecisionDelta } from "@inventory/catalog-contract/Decision"
import type { FileProblem } from "@inventory/catalog-contract/FileProblem"
import { type ConfirmId, ImportId, type ItemId } from "@inventory/catalog-contract/Ids"
import {
  ChangedItem,
  type ChangeRecord,
  changedItemsShown,
  type DecidedBy,
  decidedByNobody,
  ImportEvent,
  type OutcomeKind,
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
  skuKey,
  type StoredItem
} from "@inventory/catalog-contract/Item"
import type { ItemFacets, ItemFilter, ItemPage, ItemQuery, ItemSort } from "@inventory/catalog-contract/ItemQuery"
import { MappingChoice } from "@inventory/catalog-contract/Mapping"
import { StagedHead, type StagedRow, type StagedTable } from "@inventory/catalog-contract/Staged"
import type { Suggestion } from "@inventory/catalog-contract/Suggestion"
import { Activity } from "@inventory/kernel/Activity"
import { ActivityId, type MemberId, type OrganizationId } from "@inventory/kernel/Ids"
import type { Member } from "@inventory/kernel/Member"
import {
  Array as Arr,
  BigDecimal,
  Context,
  DateTime,
  Effect,
  Equal,
  Layer,
  Option,
  Order,
  Record as Rec,
  Ref,
  Result,
  String as Str
} from "effect"
import { SecureRandom } from "effect/crypto"
import * as S from "effect/Schema"
import { Answerer } from "./Answer/Answerer.external.ts"
import { ModelAllowance } from "./Answer/ModelAllowance.external.ts"
import { AssistantLog } from "./Assistant/AssistantLog.store.ts"
import type { CatalogPorts } from "./Catalog.ports.ts"
import { plannedItems, type PlannedRow } from "./Confirm/Confirm.rules.ts"
import {
  type ChoicesSaved,
  confirmClosed,
  type Confirmed,
  confirmWritten,
  type ConfirmWrite,
  type Draft,
  ImportStore,
  nothingInForce,
  type TakeBackWrite,
  tookBack,
  type TookBack,
  type Upload
} from "./Import/ImportStore.store.ts"
import { type EditOutcome, ItemStore } from "./Item/ItemStore.store.ts"
import { abandonedAfterMinutes } from "./Staging/Upload.rules.ts"
import { type StoreSuggestions, SuggestionStore } from "./Suggestion/SuggestionStore.store.ts"
import { searchWords } from "./Item/ItemSearch.rules.ts"

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
}

type MemDraft = {
  readonly organizationId: OrganizationId
  readonly draft: Draft
  readonly rows: ReadonlyArray<StagedRow>
  readonly decisions: ReadonlyArray<MemDecision>
}

type MemItem = {
  readonly organizationId: OrganizationId
  readonly item: StoredItem
  readonly importId: ImportId
  readonly confirm: ConfirmId
  readonly rowNumber: number
  readonly part: number
  readonly updatedBy: Option.Option<string>
  readonly updatedAt: Option.Option<DateTime.Utc>
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
  readonly takeBack: Option.Option<{ readonly id: string; readonly byName: string; readonly at: DateTime.Utc }>
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
  readonly decidedByName: Option.Option<string>
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

const HeadJson = S.fromJsonString(StagedHead)
const DecisionJson = S.fromJsonString(RowDecision)
const ChoicesJson = MappingChoice.pipe(S.Array, S.fromJsonString)

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`

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
    agent: Option.none(),
    createdAt: input.at
  })

const inForce = (confirm: MemConfirm): boolean => Option.isNone(confirm.takeBack)

const sameDraft = (organizationId: OrganizationId, id: string) => (entry: MemDraft) =>
  entry.organizationId === organizationId && entry.draft.id === id

const mapDraft = (
  state: CatalogState,
  organizationId: OrganizationId,
  id: string,
  change: (entry: MemDraft) => MemDraft
): CatalogState => ({
  ...state,
  drafts: Arr.map(state.drafts, (entry) => (sameDraft(organizationId, id)(entry) ? change(entry) : entry))
})

const isOpen = (state: CatalogState, organizationId: OrganizationId, id: string): boolean =>
  Arr.some(state.drafts, (entry) => sameDraft(organizationId, id)(entry) && entry.draft.status === "open")

const byMoment = Order.mapInput(DateTime.Order, (confirm: MemConfirm) => confirm.at)

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

// -- The confirm, as one step -----------------------------------------------------------------------------------

const alreadyThere = "This SKU is already there. It is skipped, not changed."

const commitStep = (state: CatalogState, write: ConfirmWrite): readonly [Confirmed, CatalogState] => {
  const audit = write.audit
  const org = audit.organizationId
  if (!isOpen(state, org, write.draft)) return [confirmClosed, state]
  const at = audit.createdAt
  const written = plannedItems(write.plan)
  const ready = Arr.filter(written, (row) => row.status === "ready")
  const replacing = Arr.filter(written, (row) => row.status === "update")
  const ownedKey = (entry: MemItem): string => skuKey(entry.item)

  // New items: a code the organization already has is left as it is.
  const created = Arr.reduce(Arr.zip(ready, write.itemIds), state.items, (items, [row, id]) =>
    Arr.some(items, (entry) => entry.organizationId === org && ownedKey(entry) === skuKey(row.item))
      ? items
      : Arr.append(items, {
          organizationId: org,
          item: { id, ...row.item, createdAt: at, createdBy: audit.actorName, revision: 1 },
          importId: write.draft,
          confirm: write.confirm,
          rowNumber: row.rowNumber,
          part: row.part,
          updatedBy: Option.none(),
          updatedAt: Option.none()
        })
  )
  // The copies first, one per item, then the replaces.
  const copies = Arr.reduce(replacing, state.replaced, (replaced, row) =>
    Option.match(
      Arr.findFirst(created, (entry) => entry.organizationId === org && ownedKey(entry) === skuKey(row.item)),
      {
        onNone: () => replaced,
        onSome: (stored) =>
          Arr.some(
            replaced,
            (copy) => copy.organizationId === org && copy.confirm === write.confirm && copy.itemId === stored.item.id
          )
            ? replaced
            : Arr.append(replaced, {
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
  const items = Arr.reduce(replacing, created, (list, row) =>
    Arr.map(list, (entry) =>
      entry.organizationId === org && ownedKey(entry) === skuKey(row.item)
        ? {
            ...entry,
            item: { ...withFields(entry.item, row.item), revision: entry.item.revision + 1 },
            updatedBy: Option.some<string>(audit.actorName),
            updatedAt: Option.some(at)
          }
        : entry
    )
  )
  // A row counts as created only if its item is really there.
  const landed = (row: PlannedRow): boolean =>
    Arr.some(
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
    if (row.status === "update") return { ...at, outcome: "updated", reason: "", decidedBy: decidedByNobody }
    if (landed(row)) return { ...at, outcome: "created", reason: "", decidedBy: decidedByNobody }
    if (row.status === "ready") return { ...at, outcome: "already", reason: alreadyThere, decidedBy: decidedByNobody }
    if (row.status === "already") return { ...at, outcome: "already", reason: row.reason, decidedBy: decidedByNobody }
    return { ...at, outcome: "notImported", reason: row.reason, decidedBy: row.decidedBy }
  }
  const fresh = Arr.map(write.plan.rows, outcomeFor)
  const sameRow = (a: MemOutcome, b: MemOutcome): boolean =>
    a.organizationId === b.organizationId &&
    a.importId === b.importId &&
    a.rowNumber === b.rowNumber &&
    a.part === b.part
  const outcomes = [...Arr.filter(state.outcomes, (old) => !Arr.some(fresh, (next) => sameRow(old, next))), ...fresh]
  // A changed value is recorded only for a row this confirm really wrote, and only once.
  const changes = Arr.reduce(written, state.changes, (list, row) => {
    const wrote =
      row.status === "update" ||
      Arr.some(
        items,
        (entry) =>
          entry.organizationId === org &&
          entry.confirm === write.confirm &&
          entry.rowNumber === row.rowNumber &&
          entry.part === row.part
      )
    if (!wrote) return list
    return Arr.reduce(row.changes, list, (all, entry) =>
      Arr.some(
        all,
        (old) =>
          old.organizationId === org &&
          old.confirm === write.confirm &&
          old.rowNumber === row.rowNumber &&
          old.part === row.part &&
          old.change.field === entry.change.field
      )
        ? all
        : Arr.append(all, {
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
    Arr.filter(outcomes, (row) => row.organizationId === org && row.importId === write.draft && row.outcome === outcome)
      .length
  const confirm: MemConfirm = {
    organizationId: org,
    importId: write.draft,
    id: write.confirm,
    byName: audit.actorName,
    at,
    created: Arr.filter(items, (entry) => entry.organizationId === org && entry.confirm === write.confirm).length,
    updated: count("updated"),
    already: count("already"),
    notImported: count("notImported"),
    takeBack: Option.none(),
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
      confirms: Arr.append(state.confirms, confirm),
      activity: Arr.append(state.activity, said)
    },
    org,
    write.draft,
    (entry) => ({
      ...entry,
      draft: {
        ...entry.draft,
        status: "imported",
        importedBy: Option.some<string>(audit.actorName),
        importedAt: Option.some(at)
      }
    })
  )
  return [confirmWritten, next]
}

// -- The take-back, as one step -----------------------------------------------------------------------------------

const takeBackStep = (state: CatalogState, write: TakeBackWrite): readonly [TookBack, CatalogState] => {
  const audit = write.audit
  const org = audit.organizationId
  const at = audit.createdAt
  const mine = (confirm: MemConfirm): boolean =>
    confirm.organizationId === org &&
    confirm.importId === write.draft &&
    inForce(confirm) &&
    Arr.contains(write.confirms, confirm.id)
  const marked = Arr.map(Arr.filter(state.confirms, mine), (confirm) => confirm.id)
  if (marked.length === 0) return [nothingInForce, state]
  const isMarked = (confirm: ConfirmId): boolean => Arr.contains(marked, confirm)

  // One pass marks the copies it will use, then writes them; a second pass reaches an item two confirms of this
  // take-back replaced in turn.
  const pass = (from: {
    readonly items: ReadonlyArray<MemItem>
    readonly replaced: ReadonlyArray<MemReplaced>
  }): { readonly items: ReadonlyArray<MemItem>; readonly replaced: ReadonlyArray<MemReplaced> } => {
    const usable = (copy: MemReplaced, items: ReadonlyArray<MemItem>): boolean =>
      Arr.some(
        items,
        (entry) =>
          entry.organizationId === org && entry.item.id === copy.itemId && entry.item.revision === copy.revisionAfter
      )
    const replaced = Arr.map(from.replaced, (copy) =>
      copy.organizationId === org && !copy.restored && isMarked(copy.confirm) && usable(copy, from.items)
        ? { ...copy, restored: true }
        : copy
    )
    const items = Arr.map(from.items, (entry) =>
      Option.match(
        Arr.findFirst(
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
  const put = Arr.reduce(Arr.range(1, passes), { items: state.items, replaced: state.replaced }, pass)

  const ofConfirm = (confirm: ConfirmId) => (entry: MemItem) =>
    entry.organizationId === org && entry.confirm === confirm
  const copiesOf = (confirm: ConfirmId) => (copy: MemReplaced) =>
    copy.organizationId === org && copy.confirm === confirm
  const confirms = Arr.map(state.confirms, (confirm) =>
    isMarked(confirm.id) && confirm.organizationId === org
      ? {
          ...confirm,
          takeBack: Option.some({ id: write.takeBack, byName: audit.actorName as string, at }),
          removed: Arr.filter(put.items, (entry) => ofConfirm(confirm.id)(entry) && entry.item.revision === 1).length,
          restored: Arr.filter(put.replaced, (copy) => copiesOf(confirm.id)(copy) && copy.restored).length,
          kept:
            Arr.filter(put.items, (entry) => ofConfirm(confirm.id)(entry) && entry.item.revision > 1).length +
            Arr.filter(put.replaced, (copy) => copiesOf(confirm.id)(copy) && !copy.restored).length
        }
      : confirm
  )
  const sum = (read: (confirm: MemConfirm) => number): number =>
    Arr.reduce(
      Arr.filter(confirms, (confirm) => isMarked(confirm.id) && confirm.organizationId === org),
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
  const outcomes = Arr.map(state.outcomes, (row): MemOutcome => {
    if (row.organizationId !== org || row.importId !== write.draft) return row
    const going =
      row.outcome === "created" &&
      Arr.some(
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
      row.outcome === "updated" &&
      Arr.some(
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
  const items = Arr.filter(
    put.items,
    (entry) => !(entry.organizationId === org && entry.item.revision === 1 && isMarked(entry.confirm))
  )
  const anyInForce = Arr.some(
    confirms,
    (confirm) => confirm.organizationId === org && confirm.importId === write.draft && inForce(confirm)
  )
  const next = mapDraft(
    { ...state, items, replaced: put.replaced, confirms, outcomes, activity: Arr.append(state.activity, said) },
    org,
    write.draft,
    (entry) => ({
      ...entry,
      draft: {
        ...entry.draft,
        revision: entry.draft.revision + 1,
        status: entry.draft.status === "imported" && !anyInForce ? "takenBack" : entry.draft.status
      }
    })
  )
  return [tookBack, next]
}

// -- Items: the page's questions, answered over a list --------------------------------------------------------

const textOf = (item: StoredItem, column: ItemFilter["id"]): Option.Option<string> => {
  switch (column) {
    case "name":
      return Option.some(item.name)
    case "sku":
      return Option.some(item.sku)
    case "description":
      return item.description
    case "category":
      return Option.some(item.category)
    case "uom":
      return Option.some(item.uom)
    case "isActive":
      return Option.some(`${isActive(item.stocking)}`)
    case "lotTracked":
      return Option.some(`${item.lotTracked}`)
    case "quantityOnHand":
      return Option.some(`${item.quantityOnHand}`)
    case "unitCost":
      return Option.some(costDigits(item.unitCost))
  }
}

const numberOf = (item: StoredItem, column: ItemFilter["id"]): Option.Option<number> =>
  column === "quantityOnHand"
    ? Option.some(item.quantityOnHand)
    : column === "unitCost"
      ? Option.some(Number(costDigits(item.unitCost)))
      : Option.none()

const listOf = (value: ItemFilter["value"]): ReadonlyArray<string> => (typeof value === "string" ? [value] : value)

const asNumber = (text: string): Option.Option<number> =>
  Str.trim(text) === "" || !Number.isFinite(Number(text)) ? Option.none() : Option.some(Number(text))

// None: the filter is half-typed or does not suit its column, and is left out, as the adapter leaves it out.
const passes = (item: StoredItem, filter: ItemFilter): Option.Option<boolean> => {
  const has = textOf(item, filter.id)
  const values = listOf(filter.value)
  const first = Option.getOrElse(Arr.head(values), () => "")
  if (filter.operator === "isEmpty") return Option.some(Option.isNone(has) || Option.getOrElse(has, () => "") === "")
  if (filter.operator === "isNotEmpty") return Option.some(Option.isSome(has) && Option.getOrElse(has, () => "") !== "")
  const text = Str.toLowerCase(Option.getOrElse(has, () => ""))
  switch (filter.operator) {
    case "iLike":
      return first === "" ? Option.none() : Option.some(Str.includes(Str.toLowerCase(first))(text))
    case "notILike":
      return first === "" ? Option.none() : Option.some(!Str.includes(Str.toLowerCase(first))(text))
    case "inArray":
      return values.length === 0
        ? Option.none()
        : Option.some(Arr.some(values, (value) => Str.toLowerCase(value) === text))
    case "notInArray":
      return values.length === 0
        ? Option.none()
        : Option.some(!Arr.some(values, (value) => Str.toLowerCase(value) === text))
    default: {
      const number = numberOf(item, filter.id)
      if (Option.isNone(number)) {
        if (filter.operator === "eq") return first === "" ? Option.none() : Option.some(Str.toLowerCase(first) === text)
        if (filter.operator === "ne") return first === "" ? Option.none() : Option.some(Str.toLowerCase(first) !== text)
        return Option.none()
      }
      const n = number.value
      if (filter.operator === "isBetween") {
        const low = Option.flatMap(Arr.get(values, 0), asNumber)
        const high = Option.flatMap(Arr.get(values, 1), asNumber)
        if (Option.isNone(low) && Option.isNone(high)) return Option.none()
        return Option.some(
          Option.match(low, { onNone: () => true, onSome: (min) => n >= min }) &&
            Option.match(high, { onNone: () => true, onSome: (max) => n <= max })
        )
      }
      return Option.map(asNumber(first), (wanted) => {
        switch (filter.operator) {
          case "eq":
            return n === wanted
          case "ne":
            return n !== wanted
          case "lt":
            return n < wanted
          case "lte":
            return n <= wanted
          case "gt":
            return n > wanted
          default:
            return n >= wanted
        }
      })
    }
  }
}

const sortKey = (item: StoredItem, column: ItemSort["id"]): string | number => {
  switch (column) {
    case "name":
      return Str.toLowerCase(item.name)
    case "sku":
      return item.sku
    case "category":
      return item.category
    case "uom":
      return item.uom
    case "unitCost":
      return Number(costDigits(item.unitCost))
    case "quantityOnHand":
      return item.quantityOnHand
    case "reorderPoint":
      return Option.getOrElse(item.reorderPoint, () => -1)
    case "firstReceivedOn":
      return Option.getOrElse(item.firstReceivedOn, () => "")
    case "createdAt":
      return DateTime.toEpochMillis(item.createdAt)
  }
}

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

const pageOf = (items: ReadonlyArray<StoredItem>, query: ItemQuery): ItemPage => {
  const words = Arr.map(searchWords(query.search), Str.toLowerCase)
  const haystack = (item: StoredItem): string =>
    Str.toLowerCase(
      Arr.join(
        [item.sku, item.name, Option.getOrElse(item.description, () => ""), item.category, Arr.join(item.tags, " ")],
        " "
      )
    )
  const searched = Arr.filter(items, (item) => Arr.every(words, (word) => Str.includes(word)(haystack(item))))
  const narrowed = Arr.filter(searched, (item) => {
    const verdicts = Arr.getSomes(Arr.map(query.filters, (filter) => passes(item, filter)))
    if (verdicts.length === 0) return true
    return query.joinOperator === "and" ? Arr.every(verdicts, (ok) => ok) : Arr.some(verdicts, (ok) => ok)
  })
  const sorted = Arr.sort(narrowed, Order.make(compareBy(query.sorting)))
  const from = (query.page - 1) * query.perPage
  return {
    data: Arr.take(Arr.drop(sorted, from), query.perPage),
    pageCount: Math.ceil(sorted.length / query.perPage),
    total: sorted.length
  }
}

const facetsOf = (items: ReadonlyArray<StoredItem>): ItemFacets => {
  const counts = (read: (item: StoredItem) => string) =>
    Arr.map(
      Arr.sort(
        Rec.toEntries(Arr.groupBy(items, read)),
        Order.mapInput(Order.String, ([value]: readonly [string, unknown]) => value)
      ),
      ([value, group]) => ({ value, count: group.length })
    )
  const range = (read: (item: StoredItem) => number) => {
    const values = Arr.map(items, read)
    return Arr.isReadonlyArrayNonEmpty(values)
      ? { min: Option.some(Math.min(...values)), max: Option.some(Math.max(...values)) }
      : { min: Option.none<number>(), max: Option.none<number>() }
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

const sameAsEdit = (item: StoredItem, edit: ItemEdit): boolean =>
  item.name === edit.name &&
  Equal.equals(item.description, edit.description) &&
  item.category === edit.category &&
  item.uom === edit.uom &&
  BigDecimal.equals(item.unitCost, edit.unitCost) &&
  item.quantityOnHand === edit.quantityOnHand &&
  Equal.equals(item.reorderPoint, edit.reorderPoint) &&
  item.stocking.kind === edit.stocking.kind &&
  Equal.equals(discontinuedOn(item.stocking), discontinuedOn(edit.stocking)) &&
  item.lotTracked === edit.lotTracked &&
  Equal.equals(item.firstReceivedOn, edit.firstReceivedOn)

// -- The twins ------------------------------------------------------------------------------------------------------

/** `ImportStore` in memory. */
export const ImportStoreMemory: Layer.Layer<ImportStore, never, CatalogMemoryRef> = Layer.effect(
  ImportStore,
  Effect.gen(function* () {
    const ref = yield* CatalogMemoryRef
    const random = yield* SecureRandom.SecureRandom
    const itemsOfOrg = (state: CatalogState, organizationId: OrganizationId): ReadonlyArray<StoredItem> =>
      Arr.sort(
        Arr.map(
          Arr.filter(state.items, (entry) => entry.organizationId === organizationId),
          (entry) => entry.item
        ),
        Order.mapInput(Order.String, (item: StoredItem) => item.sku)
      )
    const uploadOf = (state: CatalogState, actor: Member, id: string): Option.Option<MemUpload> =>
      Arr.findFirst(
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
      key: string,
      head: StagedHead,
      counts: { readonly rowCount: number; readonly chunkCount: number }
    ) {
      const made = yield* random.uuidV4()
      const now = yield* DateTime.now
      const before = DateTime.subtract(now, { minutes: abandonedAfterMinutes })
      const headJson = yield* S.encodeEffect(HeadJson)(head)
      const id = yield* Ref.modify(ref, (state): readonly [ImportId, CatalogState] => {
        // An upload left unfinished for an hour is gone before the next one of its organization starts.
        const kept = Arr.filter(
          state.uploads,
          (upload) =>
            upload.organizationId !== actor.organizationId || DateTime.isGreaterThanOrEqualTo(upload.createdAt, before)
        )
        const same = Arr.findFirst(
          kept,
          (upload) =>
            upload.organizationId === actor.organizationId && upload.actorId === actor.id && upload.key === key
        )
        if (Option.isSome(same)) return [same.value.id, { ...state, uploads: kept }]
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
        return [upload.id, { ...state, uploads: Arr.append(kept, upload) }]
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
        uploads: Arr.map(state.uploads, (entry) =>
          entry.organizationId === actor.organizationId &&
          entry.actorId === actor.id &&
          entry.id === upload.id &&
          // The first copy of a piece stays.
          !Arr.some(entry.chunks, (chunk) => chunk.seq === seq)
            ? { ...entry, chunks: Arr.append(entry.chunks, { seq, rows }) }
            : entry
        )
      }))
      const answer: Result.Result<void, FileProblem> = Result.succeed(undefined)
      return answer
    })

    const finishUpload = Effect.fnUntraced(function* (actor: Member, upload: Upload, needsAtStart: number) {
      const id = yield* random.uuidV4()
      const at = yield* DateTime.now
      return yield* Ref.modify(ref, (state): readonly [boolean, CatalogState] => {
        const found = uploadOf(state, actor, upload.id)
        if (Option.isNone(found)) return [false, state]
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
            importedBy: Option.none(),
            importedAt: Option.none(),
            revision: 0,
            needsAtStart,
            choicesJson: "[]"
          },
          rows: Arr.flatMap(
            Arr.sort(
              staged.chunks,
              Order.mapInput(Order.Number, (chunk: { readonly seq: number }) => chunk.seq)
            ),
            (chunk: { readonly rows: ReadonlyArray<StagedRow> }) => chunk.rows
          ),
          decisions: []
        }
        return [
          true,
          {
            ...state,
            uploads: Arr.filter(state.uploads, (entry) => entry !== staged),
            drafts: Arr.append(state.drafts, draft),
            activity: Arr.append(
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

    const decide = Effect.fnUntraced(function* (actor: Member, draft: Draft, delta: DecisionDelta) {
      const sets = yield* Effect.forEach(
        Rec.toEntries(delta.set),
        ([rowId, decision]) =>
          Effect.map(S.encodeEffect(DecisionJson)(decision), (json) => ({ rowId, json, decision })),
        { concurrency: 1 }
      )
      return yield* Ref.modify(ref, (state): readonly [Option.Option<number>, CatalogState] => {
        const org = actor.organizationId
        const found = Arr.findFirst(state.drafts, sameDraft(org, draft.id))
        if (Option.isNone(found) || found.value.draft.status !== "open") return [Option.none(), state]
        const stored = found.value
        const differs = Arr.some(
          sets,
          (set) => !Arr.some(stored.decisions, (old) => old.rowId === set.rowId && old.json === set.json)
        )
        const clears = Arr.some(stored.decisions, (old) => Arr.contains(delta.clear, old.rowId))
        const revision = stored.draft.revision + (differs || clears ? 1 : 0)
        // The same decision sent again leaves the row, and who made it, as it is.
        const kept = Arr.map(stored.decisions, (old) =>
          Option.match(
            Arr.findFirst(sets, (set) => set.rowId === old.rowId),
            {
              onNone: () => old,
              onSome: (set) => (set.json === old.json ? old : { ...set, author: actor.name as string })
            }
          )
        )
        const added = Arr.map(
          Arr.filter(sets, (set) => !Arr.some(stored.decisions, (old) => old.rowId === set.rowId)),
          (set) => ({ ...set, author: actor.name as string })
        )
        const decisions = Arr.filter([...kept, ...added], (entry) => !Arr.contains(delta.clear, entry.rowId))
        return [
          Option.some(revision),
          mapDraft(state, org, draft.id, (entry) => ({
            ...entry,
            decisions,
            draft: { ...entry.draft, revision }
          }))
        ]
      })
    }, Effect.orDie)

    const setChoices = Effect.fnUntraced(function* (
      actor: Member,
      draft: Draft,
      list: ReadonlyArray<MappingChoice>,
      detail: string
    ) {
      const id = yield* random.uuidV4()
      const at = yield* DateTime.now
      const json = yield* S.encodeEffect(ChoicesJson)(list)
      return yield* Ref.modify(ref, (state): readonly [ChoicesSaved, CatalogState] => {
        const org = actor.organizationId
        const found = Arr.findFirst(state.drafts, sameDraft(org, draft.id))
        if (Option.isNone(found) || found.value.draft.status !== "open") return ["closed", state]
        // Choices that are already so are not a change: no audit line and no new revision.
        if (found.value.draft.choicesJson === json) return ["same", state]
        const next = mapDraft(state, org, draft.id, (entry) => ({
          ...entry,
          draft: { ...entry.draft, choicesJson: json, revision: entry.draft.revision + 1 }
        }))
        return [
          "saved",
          {
            ...next,
            activity: Arr.append(
              next.activity,
              line({
                id,
                organizationId: org,
                actorId: actor.id,
                actorName: actor.name,
                action: "Matched a column",
                detail,
                at
              })
            )
          }
        ]
      })
    }, Effect.orDie)

    const rewriteDecisions = Effect.fnUntraced(function* (actor: Member, draft: Draft, set: SavedDecisions) {
      const entries = yield* Effect.forEach(
        Rec.toEntries(set),
        ([rowId, decision]) =>
          Effect.map(S.encodeEffect(DecisionJson)(decision), (json) => ({ rowId, json, decision })),
        { concurrency: 1 }
      )
      if (entries.length === 0) return
      yield* Ref.update(ref, (state) =>
        mapDraft(state, actor.organizationId, draft.id, (entry) => ({
          ...entry,
          // Only rows that already have a decision, keeping who made it.
          decisions: Arr.map(entry.decisions, (old) =>
            Option.match(
              Arr.findFirst(entries, (next) => next.rowId === old.rowId),
              { onNone: () => old, onSome: (next) => ({ ...old, json: next.json, decision: next.decision }) }
            )
          ),
          draft: entry.draft.status === "open" ? { ...entry.draft, revision: entry.draft.revision + 1 } : entry.draft
        }))
      )
    }, Effect.orDie)

    const reopen = Effect.fnUntraced(function* (actor: Member, draft: Draft) {
      const id = yield* random.uuidV4()
      const at = yield* DateTime.now
      yield* Ref.update(ref, (state) => {
        const org = actor.organizationId
        const found = Arr.findFirst(state.drafts, sameDraft(org, draft.id))
        if (Option.isNone(found) || found.value.draft.status === "open") return state
        const next = mapDraft(state, org, draft.id, (entry) => ({
          ...entry,
          draft: { ...entry.draft, status: "open", revision: entry.draft.revision + 1 }
        }))
        return {
          ...next,
          activity: Arr.append(
            next.activity,
            line({
              id,
              organizationId: org,
              actorId: actor.id,
              actorName: actor.name,
              action: "Reopened an import",
              detail:
                draft.status === "takenBack"
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
          !Arr.some(state.items, of) &&
          !Arr.some(
            state.replaced,
            (copy) => of(copy) && Arr.some(state.confirms, (confirm) => confirm.id === copy.confirm && inForce(confirm))
          )
        if (!removable) return [false, state]
        return [
          true,
          {
            ...state,
            drafts: Arr.filter(state.drafts, (entry) => !sameDraft(org, draft.id)(entry)),
            suggestions: Arr.filter(state.suggestions, (entry) => !of(entry)),
            changes: Arr.filter(state.changes, (entry) => !of(entry)),
            outcomes: Arr.filter(state.outcomes, (entry) => !of(entry)),
            replaced: Arr.filter(state.replaced, (entry) => !of(entry)),
            confirms: Arr.filter(state.confirms, (entry) => !of(entry)),
            activity: Arr.append(
              state.activity,
              line({
                id,
                organizationId: org,
                actorId: actor.id,
                actorName: actor.name,
                action: "Removed an import",
                detail: `${draft.fileName}: ${plural(draft.rowCount, "row", "rows")}, ${Option.isNone(draft.importedAt) ? "nothing had been imported" : "every item it created had been taken back"}`,
                at
              })
            )
          }
        ]
      })
    })

    const history = Effect.fnUntraced(function* (organizationId: OrganizationId, importId: string) {
      const state = yield* Ref.get(ref)
      const confirms = Arr.sort(
        Arr.filter(
          state.confirms,
          (confirm) => confirm.organizationId === organizationId && confirm.importId === importId
        ),
        byMoment
      )
      const takeBackId = (confirm: MemConfirm): Option.Option<string> =>
        Option.map(confirm.takeBack, (taken) => taken.id)
      // One take-back can reverse several confirms: it is one event, with the sums over every confirm it reversed.
      const sameTakeBack = (row: MemConfirm) =>
        Arr.filter(
          confirms,
          (other) => Option.isSome(takeBackId(row)) && Equal.equals(takeBackId(other), takeBackId(row))
        )
      const events = Arr.flatMap(confirms, (row): ReadonlyArray<ImportEvent> => [
        ImportEvent.cases.Confirmed.make({
          batchId: row.id,
          by: row.byName,
          at: row.at,
          created: row.created,
          updated: row.updated,
          already: row.already,
          notImported: row.notImported
        }),
        ...Option.match(row.takeBack, {
          onNone: (): ReadonlyArray<ImportEvent> => [],
          onSome: (taken): ReadonlyArray<ImportEvent> =>
            Option.exists(Arr.head(sameTakeBack(row)), (first) => first.id === row.id)
              ? [
                  ImportEvent.cases.TakenBack.make({
                    batchId: row.id,
                    by: taken.byName,
                    at: taken.at,
                    removed: Arr.reduce(sameTakeBack(row), 0, (total, other) => total + other.removed),
                    restored: Arr.reduce(sameTakeBack(row), 0, (total, other) => total + other.restored),
                    kept: Arr.reduce(sameTakeBack(row), 0, (total, other) => total + other.kept)
                  })
                ]
              : []
        })
      ])
      return Arr.sort(
        events,
        Order.mapInput(DateTime.Order, (event: ImportEvent) => event.at)
      )
    })

    const takeBackState = Effect.fnUntraced(function* (organizationId: OrganizationId, importId: string) {
      const state = yield* Ref.get(ref)
      const confirms = Arr.sort(
        Arr.filter(
          state.confirms,
          (confirm) => confirm.organizationId === organizationId && confirm.importId === importId && inForce(confirm)
        ),
        byMoment
      )
      const live = (confirm: ConfirmId): boolean => Arr.some(confirms, (entry) => entry.id === confirm)
      const mine = Arr.filter(
        state.items,
        (entry) => entry.organizationId === organizationId && entry.importId === importId
      )
      const copies = Arr.filter(
        state.replaced,
        (copy) => copy.organizationId === organizationId && copy.importId === importId
      )
      const itemOf = (copy: MemReplaced): Option.Option<MemItem> =>
        Arr.findFirst(state.items, (entry) => entry.organizationId === organizationId && entry.item.id === copy.itemId)
      const changedOf = (kept: boolean): ReadonlyArray<MemItem> => {
        const created = Arr.filter(mine, (entry) => entry.item.revision > 1 && live(entry.confirm) !== kept)
        const replaced = Arr.getSomes(
          Arr.map(
            Arr.filter(copies, (copy) => live(copy.confirm) !== kept),
            (copy) =>
              Option.filter(itemOf(copy), (entry) =>
                kept ? !copy.restored : entry.item.revision !== copy.revisionAfter
              )
          )
        )
        const all = Arr.dedupeWith([...created, ...replaced], (a, b) => a.item.id === b.item.id)
        const when = (entry: MemItem): number =>
          Option.match(entry.updatedAt, { onNone: () => 0, onSome: DateTime.toEpochMillis })
        return Arr.sort(
          all,
          Order.combine(
            Order.flip(Order.mapInput(Order.Number, when)),
            Order.mapInput(Order.String, (entry: MemItem) => entry.item.sku)
          )
        )
      }
      const named = (rows: ReadonlyArray<MemItem>) =>
        Arr.map(Arr.take(rows, changedItemsShown), (entry) =>
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
        confirms: Arr.map(confirms, (confirm) => confirm.id),
        removable: Arr.filter(mine, (entry) => entry.item.revision === 1 && live(entry.confirm)).length,
        restorable: Arr.filter(
          copies,
          (copy) =>
            live(copy.confirm) && Option.exists(itemOf(copy), (entry) => entry.item.revision === copy.revisionAfter)
        ).length,
        changed: named(changed),
        changedCount: changed.length,
        kept: named(kept),
        keptCount: kept.length
      }
      return answer
    })

    return ImportStore.of({
      beginUpload,
      findUpload: Effect.fnUntraced(function* (actor: Member, id: string) {
        const state = yield* Ref.get(ref)
        return Option.map(uploadOf(state, actor, id), asUpload)
      }),
      putChunk,
      uploadChunks: Effect.fnUntraced(function* (actor: Member, upload: Upload) {
        const state = yield* Ref.get(ref)
        return Option.match(uploadOf(state, actor, upload.id), {
          onNone: () => [],
          onSome: (found) =>
            Arr.sort(
              found.chunks,
              Order.mapInput(Order.Number, (chunk: { readonly seq: number }) => chunk.seq)
            )
        })
      }),
      finishUpload,
      discardUpload: Effect.fnUntraced(function* (actor: Member, id: string) {
        return yield* Ref.modify(ref, (state): readonly [boolean, CatalogState] =>
          Option.match(uploadOf(state, actor, id), {
            onNone: () => [false, state],
            onSome: (found) => [true, { ...state, uploads: Arr.filter(state.uploads, (entry) => entry !== found) }]
          })
        )
      }),
      find: Effect.fnUntraced(function* (organizationId: OrganizationId, id: string) {
        const state = yield* Ref.get(ref)
        return Option.map(Arr.findFirst(state.drafts, sameDraft(organizationId, id)), (entry) => entry.draft)
      }),
      listOpen: Effect.fnUntraced(function* (organizationId: OrganizationId, limit: number) {
        const state = yield* Ref.get(ref)
        const open = Arr.reverse(
          Arr.sort(
            Arr.filter(
              state.drafts,
              (entry) => entry.organizationId === organizationId && entry.draft.status === "open"
            ),
            Order.mapInput(DateTime.Order, (entry: MemDraft) => entry.draft.createdAt)
          )
        )
        return { drafts: Arr.map(Arr.take(open, limit), (entry) => entry.draft), total: open.length }
      }),
      listPast: Effect.fnUntraced(function* (organizationId: OrganizationId, limit: number) {
        const state = yield* Ref.get(ref)
        const past = Arr.getSomes(
          Arr.map(
            Arr.filter(state.drafts, (entry) => entry.organizationId === organizationId),
            (entry) =>
              Option.map(
                Arr.last(
                  Arr.sort(
                    Arr.filter(
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
        const newest = Arr.reverse(
          Arr.sort(
            past,
            Order.mapInput(DateTime.Order, (row: { readonly last: MemConfirm }) => row.last.at)
          )
        )
        const imports = Arr.map(Arr.take(newest, limit), ({ entry, last }): PastImport => ({
          id: entry.draft.id,
          fileName: entry.draft.fileName,
          rowCount: entry.draft.rowCount,
          status: entry.draft.status,
          confirmedByName: last.byName,
          confirmedAt: last.at,
          items: Arr.filter(
            state.items,
            (item) => item.organizationId === organizationId && item.importId === entry.draft.id
          ).length,
          notImported: last.notImported
        }))
        return { imports, total: past.length }
      }),
      remove,
      decisions: Effect.fnUntraced(function* (organizationId: OrganizationId, importId: string) {
        const state = yield* Ref.get(ref)
        const stored = Option.match(Arr.findFirst(state.drafts, sameDraft(organizationId, importId)), {
          onNone: (): ReadonlyArray<MemDecision> => [],
          onSome: (entry) => entry.decisions
        })
        return {
          decisions: Rec.fromEntries(Arr.map(stored, (entry) => [entry.rowId, entry.decision] as const)),
          authors: Rec.fromEntries(Arr.map(stored, (entry) => [entry.rowId, entry.author] as const))
        }
      }),
      decide,
      choices: Effect.fnUntraced(function* (draft: Draft) {
        return yield* S.decodeEffect(ChoicesJson)(draft.choicesJson)
      }, Effect.orDie),
      setChoices,
      createdRows: Effect.fnUntraced(function* (organizationId: OrganizationId, importId: string) {
        const state = yield* Ref.get(ref)
        return Arr.map(
          Arr.filter(
            state.outcomes,
            (row) => row.organizationId === organizationId && row.importId === importId && row.outcome === "created"
          ),
          (row) => ({ rowNumber: row.rowNumber, part: row.part })
        )
      }),
      rewriteDecisions,
      reopen,
      changes: Effect.fnUntraced(function* (organizationId: OrganizationId) {
        const state = yield* Ref.get(ref)
        const mine = Arr.filter(state.changes, (entry) => entry.organizationId === organizationId)
        return Arr.getSomes(
          Arr.map(Arr.reverse(mine), (entry): Option.Option<ChangeRecord> =>
            Option.map(Arr.findFirst(state.drafts, sameDraft(organizationId, entry.importId)), (draft) => ({
              importId: entry.importId,
              fileName: draft.draft.fileName,
              rowNumber: entry.rowNumber,
              part: entry.part === 0 ? Option.none() : Option.some(entry.part),
              sku: entry.sku,
              change: entry.change,
              decidedByName: entry.decidedByName,
              createdAt: entry.createdAt,
              // Taken back when its confirm was and the item it went into is gone, or was put back as it was.
              takenBack:
                Arr.some(state.confirms, (confirm) => confirm.id === entry.confirm && !inForce(confirm)) &&
                !Arr.some(
                  state.items,
                  (item) =>
                    item.organizationId === organizationId &&
                    item.confirm === entry.confirm &&
                    item.rowNumber === entry.rowNumber &&
                    item.part === entry.part
                ) &&
                !Arr.some(
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
      table: Effect.fnUntraced(function* (organizationId: OrganizationId, draft: Draft) {
        const state = yield* Ref.get(ref)
        const head = yield* S.decodeEffect(HeadJson)(draft.headJson)
        const table: StagedTable = {
          ...head,
          rows: Option.match(Arr.findFirst(state.drafts, sameDraft(organizationId, draft.id)), {
            onNone: () => [],
            onSome: (entry) => entry.rows
          })
        }
        return table
      }, Effect.orDie),
      storedAmong: Effect.fnUntraced(function* (organizationId: OrganizationId, keys: ReadonlyArray<string>) {
        const state = yield* Ref.get(ref)
        return Arr.filter(itemsOfOrg(state, organizationId), (item) => Arr.contains(keys, skuKey(item)))
      }),
      fixed: Effect.fnUntraced(function* (organizationId: OrganizationId, importId: string) {
        const state = yield* Ref.get(ref)
        const written = Arr.filter(
          state.changes,
          (entry) =>
            entry.organizationId === organizationId &&
            entry.importId === importId &&
            changeDecidedBy(entry.change) === "rule" &&
            entry.change.how === "appliedByRule" &&
            Arr.some(
              state.outcomes,
              (row) =>
                row.organizationId === organizationId &&
                row.importId === importId &&
                row.rowNumber === entry.rowNumber &&
                row.part === entry.part &&
                (row.outcome === "created" || row.outcome === "updated")
            )
        )
        return {
          rows: Arr.dedupe(Arr.map(written, (entry) => `${entry.rowNumber}.${entry.part}`)).length,
          cells: written.length
        }
      }),
      commit: Effect.fnUntraced(function* (write: ConfirmWrite) {
        return yield* Ref.modify(ref, (state) => commitStep(state, write))
      }),
      takeBack: Effect.fnUntraced(function* (write: TakeBackWrite) {
        return yield* Ref.modify(ref, (state) => takeBackStep(state, write))
      }),
      history,
      takeBackState,
      outcomes: Effect.fnUntraced(function* (organizationId: OrganizationId, importId: string) {
        const state = yield* Ref.get(ref)
        const rows = Arr.sort(
          Arr.filter(state.outcomes, (row) => row.organizationId === organizationId && row.importId === importId),
          Order.combine(
            Order.mapInput(Order.Number, (row: MemOutcome) => row.rowNumber),
            Order.mapInput(Order.Number, (row: MemOutcome) => row.part)
          )
        )
        return Arr.map(rows, (row): RowOutcome =>
          outcomeOf({
            rowNumber: row.rowNumber,
            part: row.part === 0 ? Option.none() : Option.some(row.part),
            sku: row.sku,
            name: row.name,
            outcome: row.outcome,
            reason: row.reason,
            decidedBy: row.decidedBy
          })
        )
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
      Arr.map(
        Arr.filter(state.items, (entry) => entry.organizationId === organizationId),
        (entry) => entry.item
      )
    const edit = Effect.fnUntraced(function* (actor: Member, id: string, change: ItemEdit) {
      const lineId = yield* random.uuidV4()
      const at = yield* DateTime.now
      return yield* Ref.modify(ref, (state): readonly [EditOutcome, CatalogState] => {
        const org = actor.organizationId
        const found = Arr.findFirst(state.items, (entry) => entry.organizationId === org && entry.item.id === id)
        if (Option.isNone(found)) return [{ _tag: "Missing" }, state]
        const stored = found.value.item
        const same = sameAsEdit(stored, change)
        // Written only while the item is at the revision the edit was made on and holds something else.
        if (stored.revision !== change.revision || same) {
          return [same ? { _tag: "Same", item: stored } : { _tag: "Changed", item: stored }, state]
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
          { _tag: "Edited", item },
          {
            ...state,
            items: Arr.map(state.items, (entry) =>
              entry === found.value
                ? { ...entry, item, updatedBy: Option.some<string>(actor.name), updatedAt: Option.some(at) }
                : entry
            ),
            activity: Arr.append(
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
      page: Effect.fnUntraced(function* (organizationId: OrganizationId, query: ItemQuery) {
        const state = yield* Ref.get(ref)
        return pageOf(of(state, organizationId), query)
      }),
      facets: Effect.fnUntraced(function* (organizationId: OrganizationId) {
        const state = yield* Ref.get(ref)
        return facetsOf(of(state, organizationId))
      }),
      edit
    })
  })
).pipe(Layer.provide(SecureRandom.layerWebCrypto))

/** `SuggestionStore` in memory. */
export const SuggestionStoreMemory: Layer.Layer<SuggestionStore, never, CatalogMemoryRef> = Layer.effect(
  SuggestionStore,
  Effect.gen(function* () {
    const ref = yield* CatalogMemoryRef
    const where = (suggestion: Suggestion): string =>
      suggestion.kind === "column" ? `:${suggestion.field}` : `${suggestion.rowId}:${suggestion.kind}`
    return SuggestionStore.of({
      list: Effect.fnUntraced(function* (organizationId: OrganizationId, importId: ImportId) {
        const state = yield* Ref.get(ref)
        return Arr.map(
          Arr.filter(
            state.suggestions,
            (entry) => entry.organizationId === organizationId && entry.importId === importId
          ),
          (entry) => entry.suggestion
        )
      }),
      store: Effect.fnUntraced(function* (write: StoreSuggestions) {
        return yield* Ref.modify(ref, (state): readonly [ReadonlyArray<Suggestion>, CatalogState] => {
          const org = write.audit.organizationId
          // The audit line is written whatever is stored; a suggestion only while the import is open, and only where
          // the row and field have none yet.
          const open = isOpen(state, org, write.draft)
          const made = Arr.reduce(write.suggestions, Arr.empty<Suggestion>(), (kept, suggestion) =>
            open &&
            !Arr.some(
              state.suggestions,
              (old) =>
                old.organizationId === org &&
                old.importId === write.draft &&
                where(old.suggestion) === where(suggestion)
            ) &&
            !Arr.some(kept, (other) => where(other) === where(suggestion))
              ? Arr.append(kept, suggestion)
              : kept
          )
          return [
            made,
            {
              ...state,
              suggestions: [
                ...state.suggestions,
                ...Arr.map(made, (suggestion) => ({ organizationId: org, importId: write.draft, suggestion }))
              ],
              activity: Arr.append(state.activity, write.audit)
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
        yield* Ref.update(ref, (state) => ({ ...state, activity: Arr.append(state.activity, entry) }))
      })
    })
  })
)

/**
 * Every port of the catalog in memory, and the state they share. With no option there is no model and 40 calls a
 * day; a test that wants a model passes `Answerer.scripted(...)`, and one that wants the allowance used passes
 * `calls: 0`.
 */
export const catalogMemory = (options?: {
  readonly answerer?: Layer.Layer<Answerer>
  readonly calls?: number
}): Layer.Layer<CatalogPorts | CatalogMemoryRef> =>
  Layer.mergeAll(
    ImportStoreMemory,
    ItemStoreMemory,
    SuggestionStoreMemory,
    AssistantLogMemory,
    options?.answerer ?? Answerer.off,
    ModelAllowance.memory(options?.calls ?? 40)
  ).pipe(Layer.provideMerge(CatalogMemoryRef.layer))
