// The Items table's columns as a request for a view carries them: the catalog every answer is checked against.
import type { CatalogColumn, ColumnCatalog } from "@inventory/catalog-contract/TableView"

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
