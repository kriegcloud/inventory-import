import { stringify } from "@inventory/ui/Json"
// The two cells of an item that hold JSON, fixed in a small form instead of as raw text. The form writes the cell back
// as the brief's own JSON; the one thing not to break: nothing is saved that the domain's readers (`readDimensions`,
// `readVendors`) would refuse, and their sentence is what the person reads under the fields.
import { PlusIcon, Trash2Icon } from "lucide-react"
import { useId, useState } from "react"
import { Button } from "@inventory/ui/components/button"
import { Field, FieldError, FieldLabel, FieldLegend, FieldSet } from "@inventory/ui/components/field"
import { Input } from "@inventory/ui/components/input"
import { Label } from "@inventory/ui/components/label"
import { NativeSelect, NativeSelectOption } from "@inventory/ui/components/native-select"
import { RadioGroup, RadioGroupItem } from "@inventory/ui/components/radio-group"
import {
  type DimensionsDraft,
  dimensionsDraft,
  emptyVendor,
  numberOrText,
  type VendorDraft,
  vendorsDraft
} from "./cellDrafts.ts"
import { readDimensions, readVendors } from "@inventory/catalog-model/CellReading"

/** The dimensions as the brief's JSON text. */
const dimensionsCell = (draft: DimensionsDraft): string =>
  stringify({
    length: numberOrText(draft.length),
    width: numberOrText(draft.width),
    height: numberOrText(draft.height),
    unit: draft.unit
  })

/** Length, width, height and their unit, saved as the cell's JSON once the three read; or no dimensions at all. */
export function DimensionsForm(props: { value: string; onSave: (cell: string) => void }) {
  const id = useId()
  const [draft, setDraft] = useState(() => dimensionsDraft(props.value))
  const [error, setError] = useState<string | undefined>(undefined)
  const set = (key: keyof DimensionsDraft, value: string) => {
    setDraft((before) => ({ ...before, [key]: value }))
    setError(undefined)
  }
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        const cell = dimensionsCell(draft)
        const read = readDimensions(cell)
        if (read._tag === "bad") setError(read.message)
        else props.onSave(cell)
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        {(["length", "width", "height"] as const).map((key, index) => (
          <Field key={key}>
            <FieldLabel htmlFor={`${id}-${key}`}>{`${key.charAt(0).toUpperCase()}${key.slice(1)}`}</FieldLabel>
            <Input
              id={`${id}-${key}`}
              inputMode="decimal"
              autoComplete="off"
              autoFocus={index === 0}
              className="max-md:h-11"
              value={draft[key]}
              onChange={(event) => set(key, event.target.value)}
            />
          </Field>
        ))}
        <Field>
          <FieldLabel htmlFor={`${id}-unit`}>Unit</FieldLabel>
          <NativeSelect
            id={`${id}-unit`}
            className="max-md:h-11"
            value={draft.unit}
            onChange={(event) => set("unit", event.target.value)}
          >
            <NativeSelectOption value="cm">cm</NativeSelectOption>
            <NativeSelectOption value="in">in</NativeSelectOption>
          </NativeSelect>
        </Field>
      </div>
      {error === undefined ? null : <FieldError>{error}</FieldError>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="secondary" size="sm" className="max-md:h-11">
          Save dimensions
        </Button>
        <Button type="button" variant="outline" size="sm" className="max-md:h-11" onClick={() => props.onSave("")}>
          Remove dimensions
        </Button>
      </div>
    </form>
  )
}

/** The vendors as the brief's JSON text. */
const vendorsCell = (vendors: ReadonlyArray<VendorDraft>): string =>
  stringify(
    vendors.map((vendor) => ({
      vendor_name: vendor.name.trim(),
      vendor_sku: vendor.sku.trim() === "" ? null : vendor.sku.trim(),
      ...(vendor.cost.trim() === "" ? {} : { unit_cost: numberOrText(vendor.cost) }),
      lead_time_days: vendor.lead.trim() === "" ? null : numberOrText(vendor.lead),
      is_preferred: vendor.preferred
    }))
  )

/** Up to three vendors, each with a name, its SKU, a unit cost and a lead time, one of them preferred; or none. */
export function VendorsForm(props: { value: string; onSave: (cell: string) => void }) {
  const id = useId()
  const [vendors, setVendors] = useState<ReadonlyArray<VendorDraft>>(() => {
    const found = vendorsDraft(props.value)
    return found.length === 0 ? [emptyVendor] : found
  })
  const [error, setError] = useState<string | undefined>(undefined)
  const change = (next: ReadonlyArray<VendorDraft>) => {
    setVendors(next)
    setError(undefined)
  }
  const set = (at: number, key: "name" | "sku" | "cost" | "lead", value: string) =>
    change(vendors.map((vendor, index) => (index === at ? { ...vendor, [key]: value } : vendor)))
  const preferred = vendors.findIndex((vendor) => vendor.preferred)
  const fields = [
    ["name", "Name", "text"],
    ["sku", "Vendor SKU", "text"],
    ["cost", "Unit cost", "decimal"],
    ["lead", "Lead time (days)", "numeric"]
  ] as const
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        const cell = vendorsCell(vendors)
        const read = readVendors(cell)
        if (read._tag === "bad") setError(read.message)
        else props.onSave(cell)
      }}
    >
      <RadioGroup
        aria-label="Preferred vendor"
        value={preferred === -1 ? "" : `${preferred}`}
        onValueChange={(next) =>
          change(vendors.map((vendor, index) => ({ ...vendor, preferred: `${index}` === next })))
        }
      >
        {vendors.map((vendor, at) => (
          <div key={at} className="border-b pb-3">
            <FieldSet>
              <FieldLegend variant="label">Vendor {at + 1}</FieldLegend>
              <div className="grid grid-cols-2 gap-2">
                {fields.map(([key, label, mode]) => (
                  <Field key={key}>
                    <FieldLabel htmlFor={`${id}-${at}-${key}`}>{label}</FieldLabel>
                    <Input
                      id={`${id}-${at}-${key}`}
                      inputMode={mode}
                      autoComplete="off"
                      className="max-md:h-11"
                      value={vendor[key]}
                      onChange={(event) => set(at, key, event.target.value)}
                    />
                  </Field>
                ))}
              </div>
              <div className="flex items-center justify-between gap-2">
                <Label className="min-h-8 max-md:min-h-11">
                  <RadioGroupItem value={`${at}`} />
                  Preferred
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="max-md:h-11"
                  onClick={() => change(vendors.filter((_, index) => index !== at))}
                >
                  <Trash2Icon aria-hidden />
                  Remove vendor {at + 1}
                </Button>
              </div>
            </FieldSet>
          </div>
        ))}
      </RadioGroup>
      {vendors.length >= 3 ? null : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="max-md:h-11"
          onClick={() => change([...vendors, emptyVendor])}
        >
          <PlusIcon aria-hidden />
          Add a vendor
        </Button>
      )}
      {error === undefined ? null : <FieldError>{error}</FieldError>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="secondary" size="sm" className="max-md:h-11">
          Save vendors
        </Button>
        <Button type="button" variant="outline" size="sm" className="max-md:h-11" onClick={() => props.onSave("")}>
          Remove vendors
        </Button>
      </div>
    </form>
  )
}
