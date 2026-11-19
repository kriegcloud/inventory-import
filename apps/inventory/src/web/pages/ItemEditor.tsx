import { useQueryClient } from "@tanstack/react-query"
import { PencilIcon } from "lucide-react"
import { useId, useState } from "react"
import { toast } from "sonner"
import { Code } from "@inventory/ui/Code"
import { NotSet } from "@inventory/ui/NotSet"
import { Alert, AlertDescription, AlertTitle } from "@inventory/ui/components/alert"
import { Button } from "@inventory/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@inventory/ui/components/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@inventory/ui/components/field"
import { Input } from "@inventory/ui/components/input"
import { NativeSelect, NativeSelectOption } from "@inventory/ui/components/native-select"
import { Switch } from "@inventory/ui/components/switch"
import { Textarea } from "@inventory/ui/components/textarea"
import { cacheChange } from "@inventory/client/Optimistic"
import { useOptimisticWrite } from "@/lib/api"
import {
  categories,
  type ItemEdit,
  type ItemForm,
  type ItemFormProblems,
  readItemForm,
  type StoredItem,
  uoms
} from "../../domain/Item.ts"
import type { ItemPage } from "../../domain/ItemQuery.ts"
import { sayError } from "@inventory/client/SayError"
import { queryKeys } from "@/lib/queries"
import { costText, dimensionsText } from "./import/itemText.ts"

const formOf = (item: StoredItem): ItemForm => ({
  name: item.name,
  description: item.description ?? "",
  category: item.category,
  uom: item.uom,
  unitCost: item.unitCost,
  quantityOnHand: `${item.quantityOnHand}`,
  reorderPoint: item.reorderPoint === null ? "" : `${item.reorderPoint}`,
  isActive: item.isActive,
  lotTracked: item.lotTracked,
  firstReceivedOn: item.firstReceivedOn ?? "",
  discontinuedOn: item.discontinuedOn ?? ""
})

/** The item with an edit's values in it: what the table shows the moment the person saves. */
const withEdit = (item: StoredItem, edit: ItemEdit): StoredItem => {
  const { revision: _revision, ...values } = edit
  return { ...item, ...values }
}

/** Every fetched page of items, with `item` in place of the row that has its id. */
const putItem = (page: ItemPage, item: StoredItem): ItemPage => ({
  ...page,
  data: page.data.map((row) => (row.id === item.id ? item : row))
})

/** `ItemChanged`: someone saved this item between the person opening it and saving it. */
const changedMeanwhile = (error: unknown): StoredItem | undefined =>
  typeof error === "object" && error !== null && "_tag" in error && error._tag === "ItemChanged" && "item" in error
    ? (error.item as StoredItem)
    : undefined

/** What only an import writes, shown and not changed here: the tags, the dimensions and every vendor. */
function FromTheFile(props: { item: StoredItem }) {
  const { item } = props
  return (
    <dl className="flex flex-col gap-2 text-sm">
      <div className="flex gap-2">
        <dt className="w-24 shrink-0 text-muted-foreground">Tags</dt>
        <dd>{item.tags.length === 0 ? <NotSet /> : item.tags.join(", ")}</dd>
      </div>
      <div className="flex gap-2">
        <dt className="w-24 shrink-0 text-muted-foreground">Dimensions</dt>
        <dd className="tabular-nums">{item.dimensions === null ? <NotSet /> : dimensionsText(item.dimensions)}</dd>
      </div>
      <div className="flex gap-2">
        <dt className="w-24 shrink-0 text-muted-foreground">Vendors</dt>
        <dd className="min-w-0 flex-1">
          {item.vendors.length === 0 ? (
            <NotSet />
          ) : (
            <ul className="flex flex-col gap-1">
              {item.vendors.map((vendor, index) => (
                <li key={`${vendor.vendorName}:${index}`}>
                  <span className="font-medium">{vendor.vendorName}</span>
                  {vendor.isPreferred ? " · preferred" : ""}
                  <span className="block text-muted-foreground tabular-nums">
                    {costText(vendor.unitCost)}
                    {vendor.leadTimeDays === null ? "" : ` · ${vendor.leadTimeDays} days`}
                    {vendor.vendorSku === null ? null : (
                      <>
                        {" · "}
                        <Code>{vendor.vendorSku}</Code>
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </dd>
      </div>
    </dl>
  )
}

/**
 * Changes one item: its plain values, with every problem in the form said at once. The SKU stays (it is the item's
 * identity), and the tags, dimensions and vendors are shown as the import wrote them. Saving is optimistic: the dialog
 * closes and the row shows the new values at once; a refusal puts the row back and offers "Edit again" with what the
 * person typed. Saving names the revision the person saw, so a change someone else made in between is shown rather
 * than overwritten. An item that has been changed is kept if the import that created it is taken back.
 */
export function ItemEditor(props: {
  item: StoredItem
  /** What opens it: a small pencil in a table's row, or a full-size "Edit" button on a phone's card. */
  trigger: "icon" | "button"
}) {
  const queryClient = useQueryClient()
  const ids = {
    name: useId(),
    description: useId(),
    category: useId(),
    uom: useId(),
    unitCost: useId(),
    quantityOnHand: useId(),
    reorderPoint: useId(),
    isActive: useId(),
    lotTracked: useId(),
    firstReceivedOn: useId(),
    discontinuedOn: useId()
  }
  const [open, setOpen] = useState(false)
  const [base, setBase] = useState(props.item)
  const [form, setForm] = useState<ItemForm>(() => formOf(props.item))
  const [problems, setProblems] = useState<ItemFormProblems>({})
  const [notice, setNotice] = useState<string | null>(null)
  const set = <K extends keyof ItemForm>(key: K, value: ItemForm[K]) =>
    setForm((before) => ({ ...before, [key]: value }))

  const itemId = props.item.id
  const save = useOptimisticWrite({
    name: "item-edit",
    write: (client, edit: ItemEdit) => client.items.edit({ params: { id: itemId }, payload: edit }),
    changes: (edit) => [
      cacheChange<ItemPage, ItemEdit>({
        key: queryKeys.itemsPages,
        apply: (page) => {
          const row = page.data.find((entry) => entry.id === itemId)
          return row === undefined ? page : putItem(page, withEdit(row, edit))
        },
        undo: (now, before) => {
          const was = before.data.find((entry) => entry.id === itemId)
          return was === undefined ? now : putItem(now, was)
        }
      })
    ],
    failed: () => `${base.name} was not saved.`,
    // The form still holds what the person typed: open it again rather than make them type it again.
    retry: () => ({ label: "Edit again", onClick: () => setOpen(true) }),
    // The import that created it can no longer take it back, the filters' values may have moved, and an audit line
    // was written.
    settled: () => [queryKeys.imports, queryKeys.itemFacets, queryKeys.activity],
    onAnswer: (saved) => {
      queryClient.setQueriesData<ItemPage>({ queryKey: queryKeys.itemsPages }, (page) =>
        page === undefined ? page : putItem(page, saved)
      )
      setBase(saved)
      toast.success(`Saved ${saved.sku}`)
    },
    // Someone saved it meanwhile: the table shows their values, and the form keeps the person's, on top of their
    // revision, so saving again puts the person's values over theirs on purpose.
    onRefused: (error) => {
      const now = changedMeanwhile(error)
      if (now === undefined) return false
      queryClient.setQueriesData<ItemPage>({ queryKey: queryKeys.itemsPages }, (page) =>
        page === undefined ? page : putItem(page, now)
      )
      setBase(now)
      setNotice(sayError(error).sentence)
      toast.error("Changed by someone else", {
        description: `${now.name} was changed by someone else just before you saved, so your change was not saved. Their values are showing.`,
        action: { label: "Edit again", onClick: () => setOpen(true) }
      })
      return true
    }
  })

  const submit = () => {
    const read = readItemForm({ form, revision: base.revision })
    setNotice(null)
    if (read._tag === "Problems") {
      setProblems(read.problems)
      return
    }
    setProblems({})
    // Optimistic: the row shows the new values now; the dialog closes without waiting for the server.
    setOpen(false)
    save.mutate(read.edit)
  }

  const invalid = (key: keyof ItemFormProblems) => (problems[key] === undefined ? {} : { "aria-invalid": true })

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) {
          setBase(props.item)
          setForm(formOf(props.item))
          setProblems({})
          setNotice(null)
          save.reset()
        }
      }}
    >
      {/* While a save is on its way the row already shows it; the next edit waits for the server's answer. */}
      <DialogTrigger asChild>
        {props.trigger === "button" ? (
          <Button variant="outline" size="touch" disabled={save.isPending}>
            Edit<span className="sr-only"> {props.item.name}</span>
          </Button>
        ) : (
          <Button variant="ghost" size="icon-xs" title={`Edit ${props.item.name}`} disabled={save.isPending}>
            <PencilIcon aria-hidden />
            <span className="sr-only">Edit {props.item.name}</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-screen overflow-y-auto">
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
        >
          <DialogHeader>
            <DialogTitle>Edit {base.name}</DialogTitle>
            <DialogDescription>
              SKU <Code>{base.sku}</Code> stays as it is. An item you change stays if its import is taken back.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="my-4">
            {notice === null ? null : (
              <Alert>
                <AlertTitle>Changed by someone else</AlertTitle>
                <AlertDescription>{notice}</AlertDescription>
              </Alert>
            )}
            <Field>
              <FieldLabel htmlFor={ids.name}>Name</FieldLabel>
              <Input
                id={ids.name}
                value={form.name}
                onChange={(event) => set("name", event.target.value)}
                {...invalid("name")}
              />
              <FieldError>{problems.name}</FieldError>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor={ids.category}>Category</FieldLabel>
                <NativeSelect
                  id={ids.category}
                  value={form.category}
                  onChange={(event) => {
                    const category = categories.find((entry) => entry === event.target.value)
                    if (category !== undefined) set("category", category)
                  }}
                >
                  {categories.map((category) => (
                    <NativeSelectOption key={category} value={category}>
                      {category}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor={ids.uom}>Unit of measure</FieldLabel>
                <NativeSelect
                  id={ids.uom}
                  value={form.uom}
                  onChange={(event) => {
                    const uom = uoms.find((entry) => entry === event.target.value)
                    if (uom !== undefined) set("uom", uom)
                  }}
                >
                  {uoms.map((uom) => (
                    <NativeSelectOption key={uom} value={uom}>
                      {uom}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Field>
                <FieldLabel htmlFor={ids.unitCost}>Unit cost ($)</FieldLabel>
                <Input
                  id={ids.unitCost}
                  inputMode="decimal"
                  value={form.unitCost}
                  onChange={(event) => set("unitCost", event.target.value)}
                  {...invalid("unitCost")}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={ids.quantityOnHand}>Qty on hand</FieldLabel>
                <Input
                  id={ids.quantityOnHand}
                  inputMode="numeric"
                  value={form.quantityOnHand}
                  onChange={(event) => set("quantityOnHand", event.target.value)}
                  {...invalid("quantityOnHand")}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={ids.reorderPoint}>Reorder point</FieldLabel>
                <Input
                  id={ids.reorderPoint}
                  inputMode="numeric"
                  placeholder="Not set"
                  value={form.reorderPoint}
                  onChange={(event) => set("reorderPoint", event.target.value)}
                  {...invalid("reorderPoint")}
                />
              </Field>
              {/* Under the three boxes, each at full width: a sentence does not fit in a third of the dialog. */}
              <FieldError className="col-span-3">{problems.unitCost}</FieldError>
              <FieldError className="col-span-3">{problems.quantityOnHand}</FieldError>
              <FieldError className="col-span-3">{problems.reorderPoint}</FieldError>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor={ids.firstReceivedOn}>First received</FieldLabel>
                <Input
                  id={ids.firstReceivedOn}
                  type="date"
                  value={form.firstReceivedOn}
                  onChange={(event) => set("firstReceivedOn", event.target.value)}
                  {...invalid("firstReceivedOn")}
                />
                <FieldError>{problems.firstReceivedOn}</FieldError>
              </Field>
              <Field>
                <FieldLabel htmlFor={ids.discontinuedOn}>Discontinued</FieldLabel>
                <Input
                  id={ids.discontinuedOn}
                  type="date"
                  value={form.discontinuedOn}
                  onChange={(event) => set("discontinuedOn", event.target.value)}
                  {...invalid("discontinuedOn")}
                />
                <FieldError>{problems.discontinuedOn}</FieldError>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field orientation="horizontal">
                <Switch
                  id={ids.isActive}
                  checked={form.isActive}
                  onCheckedChange={(checked) => set("isActive", checked)}
                  {...invalid("isActive")}
                />
                <FieldLabel htmlFor={ids.isActive}>Active</FieldLabel>
              </Field>
              <Field orientation="horizontal">
                <Switch
                  id={ids.lotTracked}
                  checked={form.lotTracked}
                  onCheckedChange={(checked) => set("lotTracked", checked)}
                />
                <FieldLabel htmlFor={ids.lotTracked}>Lot tracked</FieldLabel>
              </Field>
              <FieldError className="col-span-2">{problems.isActive}</FieldError>
            </div>
            <Field>
              <FieldLabel htmlFor={ids.description}>Description</FieldLabel>
              <Textarea
                id={ids.description}
                rows={2}
                value={form.description}
                onChange={(event) => set("description", event.target.value)}
              />
            </Field>
            <FromTheFile item={base} />
            {save.error === null || notice !== null ? null : (
              <Alert variant="destructive">
                <AlertTitle>Not saved</AlertTitle>
                <AlertDescription>{sayError(save.error).sentence}</AlertDescription>
              </Alert>
            )}
          </FieldGroup>
          <DialogFooter>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
