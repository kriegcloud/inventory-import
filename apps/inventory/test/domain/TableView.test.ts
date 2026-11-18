// The table assistant's command: what decodes, what the catalog refuses, and what the fixed rules read. The claim
// that would hurt most if wrong is that an answer naming anything the table does not have is refused whole.
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Result, Schema, String as Str } from "effect"
import {
  type CatalogColumn,
  checkCommand,
  type ColumnCatalog,
  readByRules,
  ViewChange,
  ViewCommand
} from "../../src/domain/TableView.ts"

const column = (input: Partial<CatalogColumn> & Pick<CatalogColumn, "id" | "label" | "type">): CatalogColumn => ({
  sortable: true,
  hideable: true,
  operators: [],
  values: [],
  ...input
})

/** The Items table's columns, as the page hands them over. */
export const items: ColumnCatalog = [
  column({ id: "name", label: "Name", type: "text", hideable: false, operators: ["iLike", "notILike"] }),
  column({ id: "code", label: "Code", type: "text", operators: ["iLike"] }),
  column({
    id: "unit",
    label: "Unit",
    type: "select",
    operators: ["inArray", "notInArray"],
    values: ["Each", "Box", "kg"]
  }),
  column({ id: "counted", label: "Count", type: "boolean", operators: ["eq"] }),
  column({ id: "price", label: "Price", type: "number", operators: ["lt", "gt", "isEmpty"] }),
  column({ id: "note", label: "Note", type: "text", sortable: false, operators: ["iLike"] })
]

const check = (changes: ReadonlyArray<ViewChange>) => checkCommand({ changes, columns: items, searchable: false })

describe("the command a model may answer", () => {
  it("decodes the shape the model is asked for, and refuses a kind of change it is not", () => {
    const decode = Schema.decodeUnknownResult(ViewCommand)
    expect(
      Result.isSuccess(decode({ changes: [{ kind: "sort", column: "name", direction: "desc" }], cannot: "" }))
    ).toBe(true)
    expect(Result.isFailure(decode({ changes: [{ kind: "group", column: "unit" }], cannot: "" }))).toBe(true)
    expect(Result.isFailure(decode({ changes: [{ kind: "sort", column: "name", direction: "up" }], cannot: "" }))).toBe(
      true
    )
    expect(Result.isFailure(decode({ changes: [], cannot: Str.repeat(301)("x") }))).toBe(true)
  })

  it("refuses a column the table does not have, with a sentence, and changes nothing", () => {
    const outcome = check([
      { kind: "filter", column: "counted", operator: "eq", values: ["true"] },
      { kind: "filter", column: "vendor", operator: "isEmpty", values: [] }
    ])
    expect(outcome).toEqual(
      Result.fail("The answer named a column this table does not have (“vendor”), so nothing was changed.")
    )
  })

  it("refuses an operator the column does not allow, a value not in its list and a yes-or-no that is neither", () => {
    expect(Result.isFailure(check([{ kind: "filter", column: "unit", operator: "lt", values: ["Each"] }]))).toBe(true)
    expect(check([{ kind: "filter", column: "unit", operator: "inArray", values: ["Pallet"] }])).toEqual(
      Result.fail("“Pallet” is not one of the values of Unit, so nothing was changed.")
    )
    expect(Result.isFailure(check([{ kind: "filter", column: "counted", operator: "eq", values: ["maybe"] }]))).toBe(
      true
    )
    expect(Result.isFailure(check([{ kind: "filter", column: "price", operator: "gt", values: ["ten"] }]))).toBe(true)
    expect(Result.isFailure(check([{ kind: "hide", column: "name" }]))).toBe(true)
    expect(Result.isFailure(check([{ kind: "sort", column: "note", direction: "asc" }]))).toBe(true)
    expect(Result.isFailure(check([{ kind: "search", text: "bolt" }]))).toBe(true)
  })

  it("spells a list value as the table does", () => {
    expect(check([{ kind: "filter", column: "unit", operator: "inArray", values: ["box", "BOX"] }])).toEqual(
      Result.succeed([{ kind: "filter", column: "unit", operator: "inArray", values: ["Box"] }])
    )
  })

  // Whatever a model answers, a change that passes names a column of the catalog, with an operator that column
  // allows: nothing outside the catalog ever reaches the table.
  it.prop(
    "every change that passes names a column and an operator the catalog allows",
    { change: ViewChange },
    ({ change }) => {
      const outcome = check([change])
      if (Result.isFailure(outcome)) return
      for (const passed of outcome.success) {
        if (passed.kind === "clear" || passed.kind === "search") continue
        const found = Arr.findFirst(items, (c) => c.id === passed.column)
        expect(found._tag).toBe("Some")
        if (passed.kind === "filter" && found._tag === "Some") {
          expect(found.value.operators).toContain(passed.operator)
          if (found.value.type === "select") {
            for (const value of passed.values) expect(found.value.values).toContain(value)
          }
        }
      }
    }
  )
})

describe("the fixed rules", () => {
  const read = (prompt: string) => readByRules({ prompt, columns: items })

  it("read sort, hide, show, only and clear, joined by and", () => {
    expect(read("Sort by name descending and hide the note")).toEqual(
      Result.succeed([
        { kind: "sort", column: "name", direction: "desc" },
        { kind: "hide", column: "note" }
      ])
    )
    expect(read("sort by price")).toEqual(Result.succeed([{ kind: "sort", column: "price", direction: "asc" }]))
    expect(read("only box")).toEqual(
      Result.succeed([{ kind: "filter", column: "unit", operator: "inArray", values: ["Box"] }])
    )
    expect(read("show items we count")).toEqual(
      Result.succeed([{ kind: "filter", column: "counted", operator: "eq", values: ["true"] }])
    )
    expect(read("Show code.")).toEqual(Result.succeed([{ kind: "show", column: "code" }]))
    expect(read("clear")).toEqual(Result.succeed([{ kind: "clear", what: "everything" }]))
    expect(read("clear filters")).toEqual(Result.succeed([{ kind: "clear", what: "filters" }]))
  })

  it("read find, search for and look for as words for the search box, which only a searchable table takes", () => {
    expect(read("Find the M8 washers")).toEqual(Result.succeed([{ kind: "search", text: "m8 washers" }]))
    expect(read("search for AL-FB then sort by name")).toEqual(
      Result.succeed([
        { kind: "search", text: "al-fb" },
        { kind: "sort", column: "name", direction: "asc" }
      ])
    )
    expect(read("look for all the gaskets")).toEqual(Result.succeed([{ kind: "search", text: "gaskets" }]))
    expect(read("clear the search")).toEqual(Result.succeed([{ kind: "clear", what: "search" }]))
    const searched = [{ kind: "search", text: "m8 washers" }] as const
    expect(checkCommand({ changes: searched, columns: items, searchable: true })).toEqual(Result.succeed(searched))
    expect(Result.isFailure(checkCommand({ changes: searched, columns: items, searchable: false }))).toBe(true)
    const tooLong = [{ kind: "search", text: Str.repeat(201)("x") }] as const
    expect(Result.isFailure(checkCommand({ changes: tooLong, columns: items, searchable: true }))).toBe(true)
  })

  it("read 'only' and a yes-or-no column by its heading, its first words, or after 'not'", () => {
    const flagged: ColumnCatalog = [
      ...items,
      column({ id: "preferred", label: "Preferred vendor", type: "boolean", operators: ["eq"] }),
      column({ id: "active", label: "Active?", type: "select", operators: ["inArray"], values: ["Yes", "No"] })
    ]
    const readFlag = (prompt: string) => readByRules({ prompt, columns: flagged })
    const yes = [{ kind: "filter", column: "preferred", operator: "eq", values: ["true"] }]
    for (const prompt of [
      "only preferred",
      "Only the preferred ones",
      "just preferred vendors",
      "only preferred vendor"
    ])
      expect(readFlag(prompt)).toEqual(Result.succeed(yes))
    expect(readFlag("only not preferred")).toEqual(
      Result.succeed([{ kind: "filter", column: "preferred", operator: "eq", values: ["false"] }])
    )
    expect(readFlag("only preferred, sort by price descending")).toEqual(
      Result.succeed([...yes, { kind: "sort", column: "price", direction: "desc" }])
    )
    expect(readFlag("only active")).toEqual(
      Result.succeed([{ kind: "filter", column: "active", operator: "inArray", values: ["Yes"] }])
    )
    // Every answer the rules give passes the same check a model's does.
    const answer = readFlag("only preferred")
    if (Result.isSuccess(answer))
      expect(Result.isSuccess(checkCommand({ changes: answer.success, columns: flagged, searchable: false }))).toBe(
        true
      )
  })

  it("read every request the README, the box's hint and its suggestions offer on the Items table", () => {
    const withKilogram: ColumnCatalog = items.map((entry) =>
      entry.id === "unit" ? { ...entry, values: [...entry.values, "Kilogram"] } : entry
    )
    const offered = [
      // README, "What to try first"
      "sort by quantity descending and only Kilogram",
      // The box's hint, with and without a search box
      "Find brackets, sort by name, only Box",
      "Sort by name, only Box, hide Note",
      // The suggestions under the box: a sortable text column, a list value, a hideable text column, Clear
      "Sort by Name",
      "Only Each",
      "Hide Code",
      "Clear"
    ]
    const withQuantity: ColumnCatalog = [
      ...withKilogram,
      column({ id: "quantity", label: "Quantity", type: "number", operators: ["lt", "gt"] })
    ]
    for (const prompt of offered) {
      const answer = readByRules({ prompt, columns: withQuantity })
      expect(Result.isSuccess(answer), prompt).toBe(true)
      if (Result.isSuccess(answer))
        expect(
          Result.isSuccess(checkCommand({ changes: answer.success, columns: withQuantity, searchable: true })),
          prompt
        ).toBe(true)
    }
  })

  it("refuse the whole request when one part is not theirs, naming that part", () => {
    const outcome = read("sort by name and show items with no vendor")
    expect(Result.isFailure(outcome)).toBe(true)
    if (Result.isFailure(outcome)) expect(outcome.failure).toContain("“show items with no vendor”")
    expect(Result.isFailure(read("sort by colour"))).toBe(true)
    expect(Result.isFailure(read("   "))).toBe(true)
  })
})
