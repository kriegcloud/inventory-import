// The Items table's questions, answered in SQL: one page of an organization's items, searched, sorted and
// filtered, and what the table's filters can offer. The one rule not to break: nothing from the request is ever SQL
// text. A column id becomes a column only through the fixed tables below, every value is a bound parameter, and the
// organization's condition and the search are AND-ed outside the filters' group, so an "or" between filters can never
// reach another organization or bring back an item the search left out. What a search word matches is decided in
// `packages/catalog/contract/src/Item/ItemSearch.read.ts`; this file only turns that decision into SQL over the `itemSearch` index.
import {
  ItemFilterColumn,
  ItemSortColumn,
  ItemSort,
  FilterOperator,
  ItemFilter,
  ItemFilterVariant,
  itemFilterVariants,
  ItemQuery
} from "@inventory/catalog-contract/ItemQuery"
import { ItemRow, itemColumns, storedItem } from "./internal/itemRow.ts"
import * as A from "effect/Array"
import * as BigDecimal from "effect/BigDecimal"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Eq from "effect/Equal"
import * as Layer from "effect/Layer"
import * as Match from "effect/Match"
import * as O from "effect/Option"
import * as Str from "effect/String"
import type * as Statement from "effect/sql/Statement"
import * as SqlClient from "effect/sql/SqlClient"
import * as SqlSchema from "effect/sql/SqlSchema"
import * as S from "effect/Schema"
import { OrganizationId, MemberId } from "@inventory/kernel/Ids"
import { ItemEdit, Stocking, StoredItem, discontinuedOn } from "@inventory/catalog-contract/Item"

// Whether two stockings say the same: the same case, and the same day for a discontinued one.
const sameStocking = S.toEquivalence(Stocking)
import { EditOutcome, ItemStore } from "@inventory/catalog-model/ItemStore"
import { D1Instant } from "@beep/d1/D1Instant"
import { D1, NoRows } from "@beep/d1/D1"
import * as SecureRandom from "effect/crypto/SecureRandom"
import { Member } from "@inventory/kernel/Member"
import { type WordMatch, wordsToCheck, plan, phrase, searchWords } from "@inventory/catalog-model/ItemSearch"

// The stored column behind each id the table may send. Typed as a field of a stored item, so a column that does not
// exist is a type error here rather than a query that fails, or matches nothing, at run time.
const filterColumns: { readonly [K in ItemFilterColumn]: keyof ItemRow } = {
  name: "name",
  sku: "sku",
  description: "description",
  category: "category",
  uom: "uom",
  isActive: "isActive",
  lotTracked: "lotTracked",
  quantityOnHand: "quantityOnHand",
  unitCost: "unitCost"
}

// `text` columns sort ignoring case, so "anchor" sits with "Anchor" and not after every capital letter.
const sortColumns: {
  readonly [K in ItemSortColumn]: { readonly column: keyof ItemRow; readonly text: boolean }
} = {
  name: { column: "name", text: true },
  sku: { column: "sku", text: true },
  category: { column: "category", text: true },
  uom: { column: "uom", text: true },
  unitCost: { column: "unitCost", text: false },
  quantityOnHand: { column: "quantityOnHand", text: false },
  reorderPoint: { column: "reorderPoint", text: false },
  firstReceivedOn: { column: "firstReceivedOn", text: false },
  createdAt: { column: "createdAt", text: false }
}

// With no order chosen the page is by code, as the full list is.
const bySku: ReadonlyArray<ItemSort> = [{ id: "sku", desc: false }]
// What narrows the items: the search and the filters' group, either of which may be absent.
type Narrowed = {
  readonly search: O.Option<Statement.Fragment>
  readonly filters: O.Option<Statement.Fragment>
}

/**
 * Dollars as typed into a unit cost filter ("12.50", "12", ".5", "$4"), or none, which drops the filter. The stored
 * cost is exact text; a filter and an order compare it as a number, which is enough to narrow and sort by.
 */
const dollarsOf = (text: string): O.Option<number> => {
  const cleaned = Str.replace(/^\$/, "")(Str.trim(text))
  return /^(?:\d{1,12}(?:\.\d{0,4})?|\.\d{1,4})$/.test(cleaned) ? O.some(Number(cleaned)) : O.none()
}

/** A quantity as typed into a filter ("12", "2.5", ".5"), or none, which drops the filter. */
const quantityOf = (text: string): O.Option<number> => {
  const cleaned = Str.trim(text)
  return /^(?:\d{1,12}(?:\.\d*)?|\.\d+)$/.test(cleaned) ? O.some(Number(cleaned)) : O.none()
}

// "Contains" as a LIKE pattern: the value's own %, _ and \ are escaped, so "50%" finds the text "50%" and not "50"
// followed by anything. SQLite's LIKE ignores case for ASCII letters only, so "bolt" finds "Bolt" but "é" does not
// find "É".
const containsPattern = (text: string): string => `%${Str.replace(/[\\%_]/g, "\\$&")(text)}%`

const StringList = S.String.pipe(S.Array, S.fromJsonString).annotate({
  description: "A list of values bound as one JSON parameter and read with json_each"
})
const PageCount = S.Array(S.Struct({ n: S.Int })).annotate({
  description: "COUNT(*) of the filtered items"
})
const Counts = S.Array(S.Struct({ value: S.String, n: S.Int })).annotate({
  description: "Each value in use and how many items have it"
})
const Totals = S.Array(
  S.Struct({
    total: S.Int,
    quantityMin: S.NullOr(S.Finite),
    quantityMax: S.NullOr(S.Finite),
    costMin: S.NullOr(S.Finite),
    costMax: S.NullOr(S.Finite)
  })
).annotate({ description: "How many items there are, and the lowest and highest quantity and price (cents)" })
const PageRequest = S.Struct({ org: OrganizationId, perPage: S.Int, offset: S.Int }).annotate({
  description: "Which organization's items, and which slice of them"
})
const AsTypedRequest = S.Struct({ org: OrganizationId, phrases: StringList }).annotate({
  description: "The search words long enough to be read as typos, each as one FTS5 string, as one JSON list"
})
const AsTyped = S.Struct({ phrase: S.String, found: S.BooleanFromBit }).annotate({
  description: "Whether the organization's items hold this search word as typed"
})

// The values an edit compares with what is stored.
const EditRequest = S.Struct({
  org: OrganizationId,
  actor: MemberId,
  name: S.String,
  id: S.String,
  activity: S.String,
  at: D1Instant,
  edit: ItemEdit
}).annotate({ description: "One edit of one item, by whom, with the revision it was made on" })

/** `ItemStore` on D1: the page, the facets and the guarded edit, each statement as it was. */
export const ItemStoreD1 = Layer.effect(
  ItemStore,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const d1 = yield* D1
    const { batch } = d1
    const random = yield* SecureRandom.SecureRandom

    // The organization's condition first, then the search, then the filters' group in parentheses after AND,
    // whatever joins the filters.
    const scoped = (org: string, narrowed: Narrowed) =>
      sql.and([
        sql`organizationId = ${org}`,
        ...O.toArray(narrowed.search),
        ...O.match(narrowed.filters, { onNone: () => [], onSome: (group) => [sql`(${group})`] })
      ])
    const pageRows = (narrowed: Narrowed, order: Statement.Fragment) =>
      D1.statement({
        Request: PageRequest,
        Result: S.Array(ItemRow),
        execute: (r) => sql`SELECT ${itemColumns(sql)}
          FROM item WHERE ${scoped(r.org, narrowed)} ORDER BY ${order} LIMIT ${r.perPage} OFFSET ${r.offset}`
      })
    const pageCount = (narrowed: Narrowed) =>
      D1.statement({
        Request: OrganizationId,
        Result: PageCount,
        execute: (org) => sql`SELECT COUNT(*) AS n FROM item WHERE ${scoped(org, narrowed)}`
      })

    // Which of the words long enough to be typos the organization's items hold as typed, read from the index.
    // MATCH takes each word as one FTS5 string from the JSON list, so a word is never query syntax.
    const asTyped = SqlSchema.findAll({
      Request: AsTypedRequest,
      Result: AsTyped,
      execute: (r) => sql`SELECT value AS phrase, EXISTS (SELECT 1 FROM itemSearch
          WHERE itemSearch MATCH value AND organizationId = ${r.org}) AS found
        FROM json_each(${r.phrases})`
    })

    // A word compared as text: one of its LIKE patterns in one of the columns. The patterns travel as one JSON
    // value, so a word with forty near spellings is still one of D1's hundred bound parameters.
    const anyLike = Effect.fn("Items.anyLike")(function* (
      patterns: ReadonlyArray<string>,
      columns: ReadonlyArray<"name" | "sku" | "description">
    ) {
      const json = yield* S.encodeEffect(StringList)(patterns).pipe(Effect.orDie)
      const tests = A.map(columns, (column) => sql`${sql(column)} LIKE value ESCAPE '\\'`)
      return sql`EXISTS (SELECT 1 FROM json_each(${json}) WHERE ${sql.or(tests)})`
    })
    // Items whose index row holds an FTS5 query, in this organization. The subquery is read once, not per item.
    const inIndex = (org: string, query: string) =>
      sql`rowid IN (SELECT rowid FROM itemSearch WHERE itemSearch MATCH ${query} AND organizationId = ${org})`
    const everywhere = ["name", "sku", "description"] as const

    // Every word must be found (word order does not matter); the indexed ones are one MATCH of all of them.
    const searchCondition = Effect.fn("Items.searchCondition")(function* (
      org: string,
      words: ReadonlyArray<WordMatch>
    ) {
      const indexed = A.flatMap(
        words,
        Match.valueTags({ Indexed: (word) => [word.phrase], Contains: () => [], Close: () => [] })
      )
      const asText = (word: { readonly patterns: ReadonlyArray<string> }) =>
        Effect.asSome(anyLike(word.patterns, everywhere))
      const texts = yield* Effect.forEach(
        words,
        Match.valueTags({ Indexed: () => Effect.succeedNone, Contains: asText, Close: asText }),
        { concurrency: 1 }
      )
      const all = [
        ...(A.isReadonlyArrayNonEmpty(indexed) ? [inIndex(org, A.join(indexed, " AND "))] : []),
        ...A.getSomes(texts)
      ]
      return A.isReadonlyArrayNonEmpty(all) ? O.some(sql.and(all)) : O.none<Statement.Fragment>()
    })

    // How many of the words one column holds, for the order of a search: 1 for each word found in it.
    const hitsIn = Effect.fn("Items.hitsIn")(function* (
      org: string,
      words: ReadonlyArray<WordMatch>,
      column: "name" | "sku"
    ) {
      const asText = (word: { readonly patterns: ReadonlyArray<string> }) => anyLike(word.patterns, [column])
      const hits = yield* Effect.forEach(
        words,
        Match.valueTags({
          Indexed: (word) => Effect.succeed(inIndex(org, `${column} : ${word.phrase}`)),
          Contains: asText,
          Close: asText
        }),
        { concurrency: 1 }
      )
      return sql.join(" + ", true, "0")(hits)
    })
    const countsOf = (column: "category" | "uom") =>
      D1.statement({
        Request: OrganizationId,
        Result: Counts,
        execute: (org) => sql`SELECT ${sql(column)} AS value, COUNT(*) AS n FROM item WHERE organizationId = ${org}
          GROUP BY ${sql(column)} ORDER BY ${sql(column)}`
      })
    // Active and lot tracked are stored as 1 and 0 and offered as "true" and "false", the words a filter sends back.
    const flagCountsOf = (column: "isActive" | "lotTracked") =>
      D1.statement({
        Request: OrganizationId,
        Result: Counts,
        execute: (org) => sql`SELECT CASE WHEN ${sql(column)} = 1 THEN 'true' ELSE 'false' END AS value, COUNT(*) AS n
          FROM item WHERE organizationId = ${org} GROUP BY ${sql(column)} ORDER BY ${sql(column)} DESC`
      })
    const totals = D1.statement({
      Request: OrganizationId,
      Result: Totals,
      execute: (org) => sql`SELECT COUNT(*) AS total, MIN(quantityOnHand) AS quantityMin,
          MAX(quantityOnHand) AS quantityMax, MIN(CAST(unitCost AS REAL)) AS costMin,
          MAX(CAST(unitCost AS REAL)) AS costMax
        FROM item WHERE organizationId = ${org}`
    })

    const emptyCondition = (column: Statement.Fragment, operator: FilterOperator) =>
      operator === "isEmpty"
        ? O.some(sql`(${column} IS NULL OR ${column} = '')`)
        : O.some(sql`(${column} IS NOT NULL AND ${column} <> '')`)

    // Name, SKU and description. "Is not" and "does not contain" include an item with no description: it does not contain the
    // text either.
    const textCondition = (
      column: Statement.Fragment,
      operator: FilterOperator,
      value: ItemFilter["value"]
    ): O.Option<Statement.Fragment> => {
      if (operator === "isEmpty" || operator === "isNotEmpty") return emptyCondition(column, operator)
      if (typeof value !== "string" || value === "") return O.none()
      return FilterOperator.matchOrElse(
        operator,
        {
          iLike: () => O.some(sql`(${column} LIKE ${containsPattern(value)} ESCAPE '\\')`),
          notILike: () => O.some(sql`(${column} IS NULL OR ${column} NOT LIKE ${containsPattern(value)} ESCAPE '\\')`),
          eq: () => O.some(sql`(${column} = ${value})`),
          ne: () => O.some(sql`(${column} IS NOT ${value})`)
        },
        () => O.none<Statement.Fragment>()
      )
    }

    // Category and unit. A list is one JSON parameter read with json_each, so fifty units are one bound value of
    // D1's hundred, however many filters there are.
    const selectCondition = Effect.fn("Items.selectCondition")(function* (
      column: Statement.Fragment,
      operator: FilterOperator,
      value: ItemFilter["value"]
    ) {
      if (operator === "isEmpty" || operator === "isNotEmpty") return emptyCondition(column, operator)
      if (operator === "eq" || operator === "ne") {
        if (typeof value !== "string" || value === "") return O.none()
        return O.some(operator === "eq" ? sql`(${column} = ${value})` : sql`(${column} <> ${value})`)
      }
      if (operator !== "inArray" && operator !== "notInArray") return O.none()
      if (typeof value === "string" || !A.isReadonlyArrayNonEmpty(value)) return O.none()
      const json = yield* S.encodeEffect(StringList)(value).pipe(Effect.orDie)
      return O.some(
        operator === "inArray"
          ? sql`(${column} IN (SELECT value FROM json_each(${json})))`
          : sql`(${column} NOT IN (SELECT value FROM json_each(${json})))`
      )
    })

    // Active and lot tracked: "true" or "false", compared with the stored 1 or 0. A value that is neither drops
    // the filter, and so does a list with none of the two in it; both in a list is every item.
    const flagCondition = (
      column: Statement.Fragment,
      operator: FilterOperator,
      value: ItemFilter["value"]
    ): O.Option<Statement.Fragment> => {
      const bit = (text: string): O.Option<number> =>
        text === "true" ? O.some(1) : text === "false" ? O.some(0) : O.none()
      if (operator === "eq" || operator === "ne") {
        if (typeof value !== "string") return O.none()
        return O.map(bit(value), (flag) =>
          operator === "eq" ? sql`(${column} = ${flag})` : sql`(${column} <> ${flag})`
        )
      }
      if (operator !== "inArray" && operator !== "notInArray") return O.none()
      if (typeof value === "string") return O.none()
      const flags = A.dedupe(A.getSomes(A.map(value, bit)))
      if (!A.isReadonlyArrayNonEmpty(flags)) return O.none()
      return O.some(
        operator === "inArray" ? sql`(${column} IN ${sql.in(flags)})` : sql`(${column} NOT IN ${sql.in(flags)})`
      )
    }

    // A number: the quantity as typed, the unit cost in dollars. "Is not" includes a
    // item with no price, as it does for text.
    const numberCondition = (
      column: Statement.Fragment,
      operator: FilterOperator,
      value: ItemFilter["value"],
      read: (text: string) => O.Option<number>
    ): O.Option<Statement.Fragment> => {
      if (operator === "isEmpty") return O.some(sql`(${column} IS NULL)`)
      if (operator === "isNotEmpty") return O.some(sql`(${column} IS NOT NULL)`)
      if (operator === "isBetween") {
        if (typeof value === "string" || value.length !== 2) return O.none()
        // An empty end is open. Both empty is no range at all, and an end that is not an amount spoils the range.
        const end = (text: string) => (Str.trim(text) === "" ? O.some(O.none<number>()) : O.map(read(text), O.some))
        const ends = O.flatMap(O.all([A.get(value, 0), A.get(value, 1)]), ([low, high]) => O.all([end(low), end(high)]))
        return O.flatMap(ends, ([from, to]) => {
          const clauses = [
            ...O.match(from, { onNone: () => [], onSome: (cents) => [sql`${column} >= ${cents}`] }),
            ...O.match(to, { onNone: () => [], onSome: (cents) => [sql`${column} <= ${cents}`] })
          ]
          return A.isReadonlyArrayNonEmpty(clauses) ? O.some(sql`(${sql.and(clauses)})`) : O.none()
        })
      }
      if (typeof value !== "string") return O.none()
      return O.flatMap(read(value), (cents) =>
        FilterOperator.matchOrElse(
          operator,
          {
            eq: () => O.some(sql`(${column} = ${cents})`),
            ne: () => O.some(sql`(${column} IS NOT ${cents})`),
            lt: () => O.some(sql`(${column} < ${cents})`),
            lte: () => O.some(sql`(${column} <= ${cents})`),
            gt: () => O.some(sql`(${column} > ${cents})`),
            gte: () => O.some(sql`(${column} >= ${cents})`)
          },
          () => O.none<Statement.Fragment>()
        )
      )
    }

    // A filter is read by its column's variant, never by the variant the request claims for it.
    const condition = Effect.fn("Items.condition")(function* (filter: ItemFilter) {
      const stored = sql(filterColumns[filter.id])
      // The cost is exact text in the table and a number in a comparison.
      const column = filter.id === "unitCost" ? sql`CAST(${stored} AS REAL)` : sql`${stored}`
      return yield* ItemFilterVariant.match(itemFilterVariants[filter.id], {
        text: () => Effect.succeed(textCondition(column, filter.operator, filter.value)),
        select: () =>
          filter.id === "isActive" || filter.id === "lotTracked"
            ? Effect.succeed(flagCondition(column, filter.operator, filter.value))
            : selectCondition(column, filter.operator, filter.value),
        number: () =>
          Effect.succeed(
            numberCondition(column, filter.operator, filter.value, filter.id === "unitCost" ? dollarsOf : quantityOf)
          )
      })
    })

    const orderBy = (entry: ItemSort) => {
      const { column, text } = sortColumns[entry.id]
      const collate = sql.literal(text ? " COLLATE NOCASE" : "")
      const direction = sql.literal(entry.desc ? "DESC" : "ASC")
      // An item with no reorder point or date has nothing to be ordered by, so it goes after the ones that have
      // one whichever way they run. The cost is exact text, ordered as the number it says.
      return entry.id === "unitCost"
        ? sql`CAST(${sql(column)} AS REAL) ${direction}`
        : entry.id === "reorderPoint" || entry.id === "firstReceivedOn"
          ? sql`(${sql(column)} IS NULL) ASC, ${sql(column)} ${direction}`
          : sql`${sql(column)}${collate} ${direction}`
    }

    // How each search word is compared: a word long enough to be a typo is first looked up as typed, and read
    // with one letter different only when no item of the organization holds it.
    const searchPlan = Effect.fn("Items.searchPlan")(function* (organizationId: OrganizationId, search: string) {
      const words = searchWords(search)
      const checks = wordsToCheck(words)
      if (!A.isReadonlyArrayNonEmpty(checks)) return plan({ words, found: [] })
      const answers = yield* asTyped({ org: organizationId, phrases: A.map(checks, phrase) })
      const found = A.filter(checks, (word) =>
        A.some(answers, (answer) => answer.found && answer.phrase === phrase(word))
      )
      // The count only: a word a person typed is theirs, and stays out of the logs.
      const close = checks.length - found.length
      if (close > 0) yield* Effect.logDebug(`Search: ${close} of ${checks.length} words read with one letter different`)
      return plan({ words, found })
    })

    const page = Effect.fn("Items.page")(function* (organizationId: OrganizationId, query: ItemQuery) {
      const read = yield* Effect.forEach(query.filters, condition, { concurrency: 1 })
      const conditions = A.getSomes(read)
      const filters = A.isReadonlyArrayNonEmpty(conditions)
        ? O.some(query.joinOperator === "and" ? sql.and(conditions) : sql.or(conditions))
        : O.none<Statement.Fragment>()
      const words = yield* searchPlan(organizationId, query.search)
      const search = yield* searchCondition(organizationId, words)
      const narrowed: Narrowed = { search, filters }
      // A person's chosen order wins. With none, a search puts its best matches first; otherwise by SKU.
      const ranked =
        A.isReadonlyArrayNonEmpty(query.sorting) || O.isNone(search)
          ? []
          : [
              sql`${yield* hitsIn(organizationId, words, "name")} DESC`,
              sql`${yield* hitsIn(organizationId, words, "sku")} DESC`
            ]
      const sorting = A.isReadonlyArrayNonEmpty(query.sorting) ? query.sorting : bySku
      // The id last, so items that tie on every chosen column keep one order and no page repeats or skips one. It
      // runs the way the last column does, so code Z to A is the index `record_org_code` read backwards, not a sort.
      const tieBreak = A.last(sorting).pipe(O.exists((entry) => entry.desc)) ? sql`id DESC` : sql`id ASC`
      const order = sql.csv([...ranked, ...A.map(sorting, orderBy), tieBreak])
      const offset = (query.page - 1) * query.perPage
      // One batch, so the page and the count describe the same moment.
      const [data, count] = yield* batch([
        pageRows(narrowed, order)({ org: organizationId, perPage: query.perPage, offset }),
        pageCount(narrowed)(organizationId)
      ])
      const total = O.match(A.head(count), { onNone: () => 0, onSome: (row) => row.n })
      return { data: A.map(data, storedItem), total, pageCount: Math.ceil(total / query.perPage) }
    }, Effect.orDie)

    const facets = Effect.fn("Items.facets")(function* (organizationId: OrganizationId) {
      const [category, uom, isActive, lotTracked, summaries] = yield* batch([
        countsOf("category")(organizationId),
        countsOf("uom")(organizationId),
        flagCountsOf("isActive")(organizationId),
        flagCountsOf("lotTracked")(organizationId),
        totals(organizationId)
      ])
      // An aggregate without GROUP BY always answers one row.
      const answered = A.head(summaries)
      if (O.isNone(answered)) return yield* Effect.die("the totals answered no row")
      const summary = answered.value
      return {
        total: summary.total,
        category: A.map(category, (row) => ({ value: row.value, count: row.n })),
        uom: A.map(uom, (row) => ({ value: row.value, count: row.n })),
        isActive: A.map(isActive, (row) => ({ value: row.value, count: row.n })),
        lotTracked: A.map(lotTracked, (row) => ({ value: row.value, count: row.n })),
        quantityOnHand: { min: O.fromNullOr(summary.quantityMin), max: O.fromNullOr(summary.quantityMax) },
        unitCost: { min: O.fromNullOr(summary.costMin), max: O.fromNullOr(summary.costMax) }
      }
    }, Effect.orDie)

    const findItem = SqlSchema.findOneOption({
      Request: S.Struct({ org: OrganizationId, id: S.String }),
      Result: ItemRow,
      execute: ({ org, id }) => sql`SELECT ${itemColumns(sql)} FROM item WHERE organizationId = ${org} AND id = ${id}`
    })
    // The edit's stocking as the two columns that store it: the active bit, and the discontinued day or NULL.
    const activeBit = (edit: (typeof ItemEdit)["Encoded"]): number => (Stocking.guards.active(edit.stocking) ? 1 : 0)
    const discontinuedDay = (edit: (typeof ItemEdit)["Encoded"]): string | null =>
      Stocking.guards.discontinued(edit.stocking) ? edit.stocking.on : null
    // True while the item is at the revision the edit was made on and holds something other than the edit says.
    const editable = (r: typeof EditRequest.Encoded) => sql`EXISTS (SELECT 1 FROM item
      WHERE organizationId = ${r.org} AND id = ${r.id} AND revision = ${r.edit.revision}
        AND (name IS NOT ${r.edit.name} OR description IS NOT ${r.edit.description}
          OR category IS NOT ${r.edit.category} OR uom IS NOT ${r.edit.uom} OR unitCost IS NOT ${r.edit.unitCost}
          OR quantityOnHand IS NOT ${r.edit.quantityOnHand} OR reorderPoint IS NOT ${r.edit.reorderPoint}
          OR isActive IS NOT ${activeBit(r.edit)} OR lotTracked IS NOT ${r.edit.lotTracked ? 1 : 0}
          OR firstReceivedOn IS NOT ${r.edit.firstReceivedOn} OR discontinuedOn IS NOT ${discontinuedDay(r.edit)}))`
    // The audit line first, while the condition can still be true, then the change under the same condition.
    const editedLine = D1.statement({
      Request: EditRequest,
      Result: NoRows,
      execute: (r) => sql`INSERT INTO activity (id, organizationId, actorId, actorName, action, detail, createdAt)
        SELECT ${r.activity}, ${r.org}, ${r.actor}, ${r.name}, 'Edited an item', sku || ' ' || ${r.edit.name},
          ${r.at}
        FROM item WHERE organizationId = ${r.org} AND id = ${r.id} AND ${editable(r)}`
    })
    const editItem = D1.statement({
      Request: EditRequest,
      Result: S.Array(ItemRow),
      execute: (r) => sql`UPDATE item SET name = ${r.edit.name}, description = ${r.edit.description},
          category = ${r.edit.category}, uom = ${r.edit.uom}, unitCost = ${r.edit.unitCost},
          quantityOnHand = ${r.edit.quantityOnHand}, reorderPoint = ${r.edit.reorderPoint},
          isActive = ${activeBit(r.edit)}, lotTracked = ${r.edit.lotTracked ? 1 : 0},
          firstReceivedOn = ${r.edit.firstReceivedOn}, discontinuedOn = ${discontinuedDay(r.edit)},
          revision = revision + 1, updatedById = ${r.actor}, updatedBy = ${r.name}, updatedAt = ${r.at}
        WHERE organizationId = ${r.org} AND id = ${r.id} AND ${editable(r)}
        RETURNING ${itemColumns(sql)}`
    })
    const same = (item: StoredItem, edit: ItemEdit): boolean =>
      item.name === edit.name &&
      // An optional value is an Option: compared by what it holds, never by identity.
      Eq.equals(item.description, edit.description) &&
      item.category === edit.category &&
      item.uom === edit.uom &&
      BigDecimal.equals(item.unitCost, edit.unitCost) &&
      item.quantityOnHand === edit.quantityOnHand &&
      Eq.equals(item.reorderPoint, edit.reorderPoint) &&
      sameStocking(item.stocking, edit.stocking) &&
      Eq.equals(discontinuedOn(item.stocking), discontinuedOn(edit.stocking)) &&
      item.lotTracked === edit.lotTracked &&
      Eq.equals(item.firstReceivedOn, edit.firstReceivedOn)

    const edit = Effect.fn("Items.edit")(function* (actor: Member, id: string, change: ItemEdit) {
      const at = yield* DateTime.now
      const activity = yield* random.uuidV4()
      const request = { org: actor.organizationId, actor: actor.id, name: actor.name, id, activity, at, edit: change }
      const [, edited] = yield* batch([editedLine(request), editItem(request)])
      const written = A.head(edited)
      if (O.isSome(written)) return EditOutcome.cases.Edited.make({ item: storedItem(written.value) })
      // Nothing was written: the item is gone, already says what the edit says, or was changed by someone else.
      const now = yield* findItem({ org: actor.organizationId, id })
      if (O.isNone(now)) return EditOutcome.cases.Missing.make({})
      const stored = storedItem(now.value)
      return same(stored, change)
        ? EditOutcome.cases.Same.make({ item: stored })
        : EditOutcome.cases.Changed.make({ item: stored })
    }, Effect.orDie)

    return ItemStore.of({ page, facets, edit })
  })
).pipe(Layer.provide(SecureRandom.layerWebCrypto))
