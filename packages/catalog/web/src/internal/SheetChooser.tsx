import * as A from "effect/Array"
import { useId } from "react"
import { Field, FieldDescription, FieldLabel } from "@inventory/ui/components/field"
import { NativeSelect, NativeSelectOption } from "@inventory/ui/components/native-select"
import type { SheetChoice, SheetSummary } from "@inventory/catalog-model/Spreadsheet"

/**
 * The person sees which sheet of the workbook was read and why, and can read another one. Renders nothing unless
 * two or more sheets hold data. A native select, not tabs: a workbook can have a dozen sheets with long names, the
 * phone's own picker handles that, and choosing a sheet re-reads the file rather than switching a panel.
 */
export function SheetChooser({
  sheets,
  chosen,
  onChoose,
  disabled = false
}: {
  readonly sheets: ReadonlyArray<SheetSummary>
  readonly chosen: SheetChoice
  readonly onChoose: (sheetName: string) => void
  readonly disabled?: boolean
}) {
  const id = useId()
  const readable = A.filter(sheets, (sheet) => sheet.rowCount > 0)
  if (readable.length < 2) return null
  return (
    <Field className="max-w-md">
      <FieldLabel htmlFor={id}>
        Sheet {chosen.position} of {chosen.sheetCount}: {chosen.name}
      </FieldLabel>
      <NativeSelect id={id} value={chosen.name} disabled={disabled} onChange={(event) => onChoose(event.target.value)}>
        {A.map(readable, (sheet) => (
          <NativeSelectOption key={sheet.name} value={sheet.name}>
            {sheet.name}
            {sheet.visibility === "visible" ? "" : " (hidden)"} · {sheet.rowCount}{" "}
            {sheet.rowCount === 1 ? "row" : "rows"}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <FieldDescription>{chosen.explanation}</FieldDescription>
    </Field>
  )
}
