import * as Match from "effect/Match"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import { PencilIcon } from "lucide-react"
import { useAtom, useAtomSet, useAtomValue } from "@effect/atom-react"
import * as A from "effect/Array"
import * as Cause from "effect/Cause"
import * as Effect from "effect/Effect"
import * as HashMap from "effect/HashMap"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import * as Atom from "effect/reactivity/Atom"
import * as AtomRegistry from "effect/reactivity/AtomRegistry"
import { useId } from "react"
import { toast } from "sonner"
import { navigate } from "@inventory/ui/Route"
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
import { invalidate } from "@inventory/client/Api"
import { keptOfMember, memberKey } from "@inventory/client/MemberAtoms"
import { optimisticChange, optimisticWrite } from "@inventory/client/OptimisticAtoms"
import { catalogApi } from "./Catalog.runtime.ts"
import { itemsPage } from "./ItemsPage.screen.tsx"
import {
  categories,
  discontinuedOn,
  isActive,
  type ItemEdit,
  type StoredItem,
  uoms,
  costDigits
} from "@inventory/catalog-contract/Item"
import type { ItemPage } from "@inventory/catalog-contract/ItemQuery"
import { ItemChanged } from "@inventory/catalog-contract/Catalog"
import { sayError } from "@inventory/client/SayError"
import { catalogKeys } from "./Catalog.keys.ts"
import { costOf, dimensionsText } from "./internal/itemText.ts"
import { type ItemForm, type ItemFormProblems, readItemForm } from "@inventory/catalog-model/ItemEdit"

const formOf = (item: StoredItem): ItemForm => ({
  name: item.name,
  description: O.getOrElse(item.description, () => ""),
  category: item.category,
  uom: item.uom,
  unitCost: costDigits(item.unitCost),
  quantityOnHand: `${item.quantityOnHand}`,
  reorderPoint: O.match(item.reorderPoint, { onNone: () => "", onSome: (point) => `${point}` }),
  isActive: isActive(item.stocking),
  lotTracked: item.lotTracked,
  firstReceivedOn: O.getOrElse(item.firstReceivedOn, () => ""),
  discontinuedOn: O.getOrElse(discontinuedOn(item.stocking), () => "")
})

/** The item with an edit's values in it: what the table shows the moment the person saves. */
const withEdit = (item: StoredItem, edit: ItemEdit): StoredItem => {
  const { revision: _revision, ...values } = edit
  return { ...item, ...values }
}

/** Every fetched page of items, with `item` in place of the row that has its id. */
const putItem = (page: ItemPage, item: StoredItem): ItemPage => ({
  ...page,
  data: A.map(page.data, (row) => (row.id === item.id ? item : row))
})

const isItemChanged = S.is(ItemChanged)

/** `ItemChanged`: someone saved this item between the person opening it and saving it. */
const changedMeanwhile = (error: unknown): StoredItem | undefined => (isItemChanged(error) ? error.item : undefined)

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
        <dd className="tabular-nums">
          {O.match(item.dimensions, { onNone: () => <NotSet />, onSome: (size) => <>{dimensionsText(size)}</> })}
        </dd>
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
                    {costOf(vendor.unitCost)}
                    {O.match(vendor.leadTimeDays, { onNone: () => "", onSome: (days) => ` · ${days} days` })}
                    {O.match(vendor.vendorSku, {
                      onNone: () => null,
                      onSome: (code) => (
                        <>
                          {" · "}
                          <Code>{code}</Code>
                        </>
                      )
                    })}
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

/** One item's editor: open or not, the item as it was when opened, what is typed, its problems and a notice. */
interface EditorState {
  readonly open: boolean
  readonly base: O.Option<StoredItem>
  readonly form: O.Option<ItemForm>
  readonly problems: ItemFormProblems
  readonly notice: string | null
}

/** An editor nobody has opened. */
const closedEditor: EditorState = { open: false, base: O.none(), form: O.none(), problems: {}, notice: null }

/**
 * The editors that are open, by item. Kept for the page's life, and small: an editor is in it only while its dialog
 * is open. A save outlives the row that pressed it (the person pages on, or opens another screen), so "Edit again"
 * on a save that failed must find its editor whether or not the row is drawn; held with the row, it was gone. What is
 * typed in one is one member's: another member, or another organization, has none open.
 */
const openEditors = keptOfMember(() => HashMap.empty<string, EditorState>())

/**
 * What the server answered to the last save of each item: the item as stored, at its new revision. Kept while the same
 * member is signed in, also while that is asked again, and shown to nobody else: a page left for another person's, or a
 * sign-in page, is loaded anew, and another organization the person switches to starts with none. A save is counted out until it answers, but the item's row is read again only after
 * that item's last write in flight has answered (each item's editor counts its own), and until then it shows the saved
 * values on the old revision; an editor opened in between takes its revision from here, or its save goes out on the old
 * one and is refused as someone else's.
 */
const savedItems = keptOfMember(() => HashMap.empty<string, StoredItem>())

/** The newer of the item an editor was opened on and the server's answer to its last save: the base of the next. */
const newerOf = (base: StoredItem, saved: O.Option<StoredItem>): StoredItem =>
  O.match(saved, { onNone: () => base, onSome: (answer) => (answer.revision > base.revision ? answer : base) })

/**
 * One item's editor: closed with nothing in it until it is opened, and again once it is closed. Its base is never
 * older than the last save's answer, whether that answer came before the editor opened or while it was open.
 */
export const itemEditor = Atom.family((id: string) =>
  Atom.writable(
    (get) => {
      const editor = O.getOrElse(HashMap.get(get(openEditors), id), () => closedEditor)
      const saved = HashMap.get(get(savedItems), id)
      return { ...editor, base: O.map(editor.base, (base) => newerOf(base, saved)) }
    },
    (ctx, next: EditorState) =>
      ctx.set(
        openEditors,
        next.open ? HashMap.set(ctx.get(openEditors), id, next) : HashMap.remove(ctx.get(openEditors), id)
      )
  )
)

/**
 * The items with a save on its way, each with how many. Kept for the page's life: a save runs to its end after the
 * row that pressed it has left, and the row that comes back must still read it as out, or it would offer Edit on
 * the revision the first save is about to move.
 */
const savesOut = Atom.make(HashMap.empty<string, number>()).pipe(Atom.keepAlive)

/** True while a save of this item is on its way, wherever it was pressed from. */
export const saveOut = Atom.family((id: string) => Atom.map(savesOut, HashMap.has(id)))

/** One save of an item: the item as the person saw it (its revision), the change, and the form as they typed it. */
export interface ItemSave {
  readonly base: StoredItem
  readonly edit: ItemEdit
  readonly form: ItemForm
}

/** Where the Items table is, and how its address names a search. */
const itemsAddress = "/items"

/**
 * "Edit again" on a save that was not kept: the editor opens with what the person typed, on the item as it stands
 * (`base`). When the item's row is not on screen (they paged on, or opened another screen meanwhile) they are taken
 * to it: the Items table, searched for its SKU. Only where it was saved: after a switch of organization the item is not
 * this one's, and the press says so.
 */
const editAgain = (input: {
  readonly registry: AtomRegistry.AtomRegistry
  readonly save: ItemSave
  readonly base: StoredItem
  readonly notice: string | null
}): (() => void) => {
  const { base, notice, registry, save } = input
  const savedAs = registry.get(memberKey)
  return () => {
    if (registry.get(memberKey) !== savedAs) {
      toast.error(`${base.name} is not in this organization`, {
        description: "It belongs to the one you were in when you saved it. Switch back to it, and edit it there."
      })
      return
    }
    registry.set(itemEditor(base.id), {
      open: true,
      base: O.some(base),
      form: O.some(save.form),
      problems: {},
      notice
    })
    const drawn = document.querySelector(`[data-edit-item="${CSS.escape(base.id)}"]`) !== null
    if (!drawn) navigate(`${itemsAddress}?search=${encodeURIComponent(base.sku)}`, { replace: false })
  }
}

/** The request that saves one item, counted as out from when it is sent until it has answered or failed. */
const sendEdit = (id: StoredItem["id"]) =>
  Effect.fnUntraced(function* (save: ItemSave) {
    const registry = yield* AtomRegistry.AtomRegistry
    const count = (by: number) =>
      registry.update(savesOut, (out) => {
        const next = O.getOrElse(HashMap.get(out, id), () => 0) + by
        return next > 0 ? HashMap.set(out, id, next) : HashMap.remove(out, id)
      })
    count(1)
    return yield* catalogApi
      .send((api) => api.items.edit({ params: { id }, payload: save.edit }))
      .pipe(Effect.ensuring(Effect.sync(() => count(-1))))
  })

/**
 * Saving one item. Optimistic: the row shows the new values at once, and a refusal takes them back with the reason,
 * offering "Edit again" with what the person typed. Afterwards the item's import (whether it can still be taken
 * back), the filters' values and the audit trail are asked again. Someone else's save in between is shown, not
 * overwritten: the table shows their values and the form keeps the person's, on their revision.
 */
export const editItem = Atom.family((id: StoredItem["id"]) =>
  optimisticWrite({
    send: sendEdit(id),
    changes: [
      optimisticChange(itemsPage, (page: ItemPage, save: ItemSave) => {
        const row = A.findFirst(page.data, (entry) => entry.id === id)
        return O.match(row, { onNone: () => page, onSome: (found) => putItem(page, withEdit(found, save.edit)) })
      })
    ],
    failed: (save) => `${save.base.name} was not saved.`,
    // The press carries what the person typed: the editor opens on it again rather than make them type it again.
    retry: (save, registry) => ({
      label: "Edit again",
      onClick: editAgain({ registry, save, base: save.base, notice: null })
    }),
    settled: [...catalogKeys.imports, ...catalogKeys.itemFacets, ...catalogKeys.activity],
    onAnswer: (saved, _save, registry) => {
      // An editor open on this item now, or opened before the row is read again, is on the saved revision.
      registry.update(savedItems, (held) => HashMap.set(held, id, saved))
      toast.success(`Saved ${saved.sku}`)
    },
    onRefused: (error, save, registry) => {
      const now = changedMeanwhile(error)
      if (now === undefined) return false
      // Their values in the table; the person's in the form, on their revision.
      invalidate(catalogKeys.items)
      toast.error("Changed by someone else", {
        description: `${now.name} was changed by someone else just before you saved, so your change was not saved. Their values are showing.`,
        action: {
          label: "Edit again",
          onClick: editAgain({ registry, save, base: now, notice: sayError(error, { fields: {} }).sentence })
        }
      })
      return true
    }
  })
)

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
  const itemId = props.item.id
  const [editor, setEditor] = useAtom(itemEditor(itemId))
  const { open, problems, notice } = editor
  const base = O.getOrElse(editor.base, () => props.item)
  const form = O.getOrElse(editor.form, () => formOf(props.item))
  const set = <K extends keyof ItemForm>(key: K, value: ItemForm[K]) =>
    setEditor((now) => ({ ...now, form: O.some({ ...O.getOrElse(now.form, () => formOf(props.item)), [key]: value }) }))
  const saveResult = useAtomValue(editItem(itemId))
  // Read from what outlives the row: a save pressed before the row left and came back is still out.
  const saving = useAtomValue(saveOut(itemId))
  const saveError = AsyncResult.isFailure(saveResult) && !saving ? saveResult.cause.pipe(Cause.squash) : null
  const save = useAtomSet(editItem(itemId))

  const submit = () => {
    Match.valueTags(readItemForm({ form, revision: base.revision }), {
      Problems: (read) => setEditor((now) => ({ ...now, notice: null, problems: read.problems })),
      Edit: (read) => {
        // Optimistic: the row shows the new values now; the dialog closes without waiting for the server.
        setEditor((now) => ({ ...now, notice: null, problems: {}, open: false }))
        save({ base, edit: read.edit, form })
      }
    })
  }

  const invalid = (key: keyof ItemFormProblems) => (problems[key] === undefined ? {} : { "aria-invalid": true })

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setEditor({
            open: true,
            base: O.some(props.item),
            form: O.some(formOf(props.item)),
            problems: {},
            notice: null
          })
          save(Atom.Reset)
        } else setEditor((now) => ({ ...now, open: false }))
      }}
    >
      {/* While a save is on its way the row already shows it; the next edit waits for the server's answer. */}
      <DialogTrigger asChild>
        {props.trigger === "button" ? (
          <Button variant="outline" size="touch" disabled={saving} data-edit-item={itemId}>
            Edit<span className="sr-only"> {props.item.name}</span>
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon-xs"
            title={`Edit ${props.item.name}`}
            disabled={saving}
            data-edit-item={itemId}
          >
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
                {...invalid("description")}
              />
              <FieldError>{problems.description}</FieldError>
            </Field>
            <FromTheFile item={base} />
            {saveError === null || notice !== null ? null : (
              <Alert variant="destructive">
                <AlertTitle>Not saved</AlertTitle>
                <AlertDescription>{sayError(saveError, { fields: {} }).sentence}</AlertDescription>
              </Alert>
            )}
          </FieldGroup>
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
