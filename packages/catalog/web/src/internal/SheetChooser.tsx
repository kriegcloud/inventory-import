import { useId } from "react"
import { Field, FieldDescription, FieldLabel } from "@inventory/ui/components/field"
import { NativeSelect, NativeSelectOption } from "@inventory/ui/components/native-select"
import type { SheetChoice, SheetSummary } from "@inventory/catalog-model/Spreadsheet"

/**
 * The person sees which sheet of the workbook was read and why, and can read another one. Renders nothing unless
 * two or more sheets hold data. A native select, not tabs: a workbook can have a dozen sheets with long names, the
 * phone's own picker handles that, and choosing a sheet re-reads the file rather than switching a panel.
 */
export function SheetChooser(props: {
  sheets: ReadonlyArray<SheetSummary>
  chosen: SheetChoice
  onChoose: (sheetName: string) => void
  disabled?: boolean
}) {
  const id = useId()
  const readable = props.sheets.filter((sheet) => sheet.rowCount > 0)
  if (readable.length < 2) return null
  return (
    <Field className="max-w-md">
      <FieldLabel htmlFor={id}>
        Sheet {props.chosen.position} of {props.chosen.sheetCount}: {props.chosen.name}
      </FieldLabel>
      <NativeSelect
        id={id}
        value={props.chosen.name}
        disabled={props.disabled}
        onChange={(event) => props.onChoose(event.target.value)}
      >
        {readable.map((sheet) => (
          <NativeSelectOption key={sheet.name} value={sheet.name}>
            {sheet.name}
            {sheet.visibility === "visible" ? "" : " (hidden)"} · {sheet.rowCount}{" "}
            {sheet.rowCount === 1 ? "row" : "rows"}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <FieldDescription>{props.chosen.explanation}</FieldDescription>
    </Field>
  )
}
