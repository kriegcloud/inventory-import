// The two cells of an item that hold JSON, fixed in a small form instead of as raw text. The form writes the cell back
// as the brief's own JSON; the one thing not to break: nothing is saved that the domain's readers (`readDimensions`,
// `readVendors`) would refuse, and their sentence is what the person reads under the fields.
import * as Match from "effect/Match"
import { PlusIcon, Trash2Icon } from "lucide-react"
import { useAtom } from "@effect/atom-react"
import * as ScopedAtom from "@effect/atom-react/ScopedAtom"
import * as O from "effect/Option"
import * as Atom from "effect/reactivity/Atom"
import { useId } from "react"
import { stringify } from "@inventory/ui/Json"
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

/**
 * What one open form holds: what was typed (none until something is, the cell's value showing meanwhile) and why
 * the last save was refused. One per form on screen, made in the form's own provider and let go with it.
 */
const FormScope = ScopedAtom.make(() =>
  Atom.make<{ readonly typed: O.Option<unknown>; readonly error: O.Option<string> }>({
    typed: O.none(),
    error: O.none()
  })
)

type CellFormProps = { readonly value: string; readonly onSave: (cell: string) => void }

/** Length, width, height and their unit, saved as the cell's JSON once the three read; or no dimensions at all. */
export function DimensionsForm(props: CellFormProps) {
  return (
    <FormScope.Provider>
      <DimensionsFields {...props} />
    </FormScope.Provider>
  )
}

function DimensionsFields(props: CellFormProps) {
  const id = useId()
  const [held, setHeld] = useAtom(FormScope.use())
  const draft = O.match(held.typed as O.Option<DimensionsDraft>, {
    onNone: () => dimensionsDraft(props.value),
    onSome: (draft) => draft
  })
  const { error } = held
  const setError = (message: string) => setHeld((now) => ({ ...now, error: O.some(message) }))
  const set = (key: keyof DimensionsDraft, value: string) =>
    setHeld({ typed: O.some({ ...draft, [key]: value }), error: O.none() })
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        const cell = dimensionsCell(draft)
        const read = readDimensions(cell)
        Match.valueTags(read, { bad: (bad) => setError(bad.message), ok: () => props.onSave(cell) })
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        {(["length", "width", "height"] as const).map((key, index) => (
          <Field key={key}>
            <FieldLabel htmlFor={`${id}-${key}`}>
              {{ length: "Length", width: "Width", height: "Height" }[key]}
            </FieldLabel>
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
      {O.match(error, { onNone: () => null, onSome: (error) => <FieldError>{error}</FieldError> })}
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
export function VendorsForm(props: CellFormProps) {
  return (
    <FormScope.Provider>
      <VendorsFields {...props} />
    </FormScope.Provider>
  )
}

function VendorsFields(props: CellFormProps) {
  const id = useId()
  const [held, setHeld] = useAtom(FormScope.use())
  const vendors = O.match(held.typed as O.Option<ReadonlyArray<VendorDraft>>, {
    onSome: (vendors) => vendors,
    onNone: () => {
      const found = vendorsDraft(props.value)
      return found.length === 0 ? [emptyVendor] : found
    }
  })
  const { error } = held
  const setError = (message: string) => setHeld((now) => ({ ...now, error: O.some(message) }))
  const change = (next: ReadonlyArray<VendorDraft>) => setHeld({ typed: O.some(next), error: O.none() })
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
        Match.valueTags(read, { bad: (bad) => setError(bad.message), ok: () => props.onSave(cell) })
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
      {O.match(error, { onNone: () => null, onSome: (error) => <FieldError>{error}</FieldError> })}
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
