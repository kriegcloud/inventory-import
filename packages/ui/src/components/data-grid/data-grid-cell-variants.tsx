"use client"
// Local change: moved from React's hooks to atoms (goals/atoms, "The kit on atoms", batch 2); no longer as its registry has it.
// What an editor keeps while it is open (a draft, the value it opened with, whether Escape was pressed, a file drag)
// is an atom of the cell on screen, made for its `useId`, where upstream had state and refs; its handlers are plain
// functions of the draw. What upstream did in effects when editing began or ended is done by ref callbacks that stay
// the same: a number's input focuses itself when it is put on the page, and the text cell's element is given one of
// two callbacks, one for editing and one for showing, so React calls the right one exactly when editing begins or ends.
// What such a callback needs from the draw is on the element (`data-typed-over`, the key that opened the editor is to
// replace the value; `data-cell-text`, the value shown). The rule this file protects: the key that opens an editor is
// typed into it, and what is stored is what was typed (`bun run grid:keys`).
import type { RowData } from "@tanstack/react-table"
import type { ExternalToast } from "sonner"

import { useAtom, useAtomMount, useAtomValue } from "@effect/atom-react"
import { cn } from "cn"
import * as Atom from "effect/reactivity/Atom"
import {
  type ChangeEvent,
  type ComponentProps,
  type FocusEvent,
  type DragEvent as ReactDragEvent,
  type InputEvent as ReactInputEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type RefCallback,
  type RefObject,
  useId,
  useRef
} from "react"
import { toast } from "sonner"

import type {
  ColumnSelectOption,
  DataGridCellProps,
  FileCellData,
  RowHeightValue,
  StopEditingOptions
} from "@inventory/ui/components/data-grid/data-grid-types"

import { getBadgeOverflow } from "@inventory/ui/components/data-grid/use-badge-overflow"
import { atomRegistry, oneTimer } from "@inventory/ui/components/data-table/data-table-state"
// The kit's own debounce, on atoms since batch 1 (`oneTimer`): the rule keeps it out of our code, and this is the kit.
// oxlint-disable-next-line no-restricted-imports
import { useDebouncedCallback } from "@inventory/ui/hooks/use-debounced-callback"
import {
  createFileObjectUrl,
  // Local change: upstream imported `execInsertText` here.
  formatDateForDisplay,
  formatDateToString,
  formatFileSize,
  formatNumberForDisplay,
  getBooleanCellValue,
  getCellKey,
  getColumnLabel,
  getColumnVariantOptions,
  getDateCellValue,
  getFileIcon,
  getFilesCellValue,
  getLineCount,
  getNumberCellValue,
  getOptionCellValue,
  getOptionsCellValue,
  getRowHeightValue,
  getTextCellValue,
  getUrlHref,
  // Local change: upstream also imported `insertTextAtSelection` here.
  moveCaretToEnd,
  parseLocalDate,
  // Local change: `selectEditableText` is imported where upstream imported `replaceEditableText`.
  selectEditableText
} from "@inventory/ui/components/data-grid/data-grid-utils"
// Local change: an upload and a delete are Effects, run with `Effect.runFork`, where upstream has async functions with
// `try` statements; `Result` reads how the caller's own upload or delete went.
import * as Effect from "effect/Effect"
import * as P from "effect/Predicate"
import * as Result from "effect/Result"
import { DataGridCell, setRef, useCellValue } from "@inventory/ui/components/data-grid/data-grid-cell"
import { Badge } from "@inventory/ui/components/badge"
import { Button } from "@inventory/ui/components/button"
import { Calendar } from "@inventory/ui/components/calendar"
import { Checkbox } from "@inventory/ui/components/checkbox"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator
} from "@inventory/ui/components/command"
import { Popover, PopoverAnchor, PopoverContent } from "@inventory/ui/components/popover"
import { Skeleton } from "@inventory/ui/components/skeleton"
import { Switch } from "@inventory/ui/components/switch"
import { Textarea } from "@inventory/ui/components/textarea"
import { X, Upload } from "lucide-react"

const CELL_BORDER_WIDTH = 1
const CELL_EDITOR_CLASS_NAME =
  "max-w-(--radix-popover-content-available-width) rounded-none p-0 ring-inset data-open:animate-none data-closed:animate-none"
const CELL_BADGE_CLASS_NAME = "mt-0.5 mb-px h-4.25 px-1.5 py-0"

export function ShortTextCell<TData extends RowData>(props: DataGridCellProps<TData>) {
  const { onCommit, onCancel, textProps } = useEditableText(props)

  return (
    <DataGridCell<TData> {...props} onCommit={onCommit} onCancel={onCancel} commitOnEnter>
      <EditableText {...textProps} />
    </DataGridCell>
  )
}

/** What one long-text cell on screen keeps while its editor is open: the value it opened with, and whether Escape was pressed. */
const longTextEdit = Atom.family((_instance: string) =>
  Atom.make<{ readonly startValue: string | null; readonly isCanceling: boolean }>({
    startValue: null,
    isCanceling: false
  })
)

export function LongTextCell<TData extends RowData>(props: DataGridCellProps<TData>) {
  const { cell, rowHeight, isEditing, readOnly } = props
  const instance = useId()
  const registry = useAtomValue(atomRegistry)
  useAtomMount<unknown>(isEditing ? longTextEdit(instance) : nothingKept)
  const initialValue = getTextCellValue(useCellValue(cell))
  const { value, setDraftValue, clearDraft } = useCellDraft({
    drafts: textDrafts,
    key: initialValue,
    fallback: initialValue,
    enabled: isEditing
  })
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const debouncedSave = useDebouncedCallback((newValue: string) => {
    if (!readOnly) {
      cell.setValue(newValue)
    }
  }, 300)

  function onSave(options?: StopEditingOptions) {
    debouncedSave.cancel()
    if (registry.get(longTextEdit(instance)).isCanceling) {
      cell.table.stopEditing(options)
      return
    }
    if (!readOnly && value !== initialValue) {
      cell.setValue(value)
    }
    clearDraft()
    cell.table.stopEditing(options)
  }

  function onCancel() {
    debouncedSave.cancel()
    const { startValue } = registry.get(longTextEdit(instance))
    registry.set(longTextEdit(instance), { startValue, isCanceling: true })
    clearDraft()
    // The value the editor opened with (upstream's first value when it never opened).
    const editStartValue = startValue ?? initialValue
    if (!readOnly && getTextCellValue(cell.getValue()) !== editStartValue) {
      cell.setValue(editStartValue)
    }
    cell.table.stopEditing()
  }

  function onOpenChange(open: boolean) {
    if (open && !readOnly) {
      cell.startEditing()
    } else {
      onSave()
    }
  }

  function onOpenFocus() {
    // The editor has just opened: what it opened with is kept for Escape (upstream's effect on `isEditing`).
    registry.set(longTextEdit(instance), { startValue: initialValue, isCanceling: false })
    const textarea = textareaRef.current
    if (!textarea) return

    textarea.focus()
    const length = textarea.value.length
    textarea.setSelectionRange(length, length)

    // Local change: the browser types the key that opened the editor, after the text (see `typesInPlace` in
    // data-grid-cell.tsx). Upstream typed it here on the next frame, and lost it when a second key came first.
    textarea.scrollTop = textarea.scrollHeight
  }

  function onBlur() {
    onSave()
  }

  function onChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const newValue = event.target.value
    setDraftValue(newValue)
    debouncedSave(newValue)
  }

  return (
    <DataGridCell<TData> {...props} ref={containerRef} onCommit={onSave} onCancel={onCancel}>
      <CellEditorPopover
        cell={cell}
        open={isEditing}
        readOnly={readOnly}
        rowHeight={rowHeight}
        containerRef={containerRef}
        side="bottom"
        className="w-100"
        onOpenChange={onOpenChange}
        onOpenFocus={onOpenFocus}
        overlap
      >
        <Textarea
          aria-label={getColumnLabel(cell.column)}
          placeholder="Enter text..."
          className="max-h-75 min-h-37.5 resize-none overflow-y-auto rounded-none border-0 px-2 pt-1.75 shadow-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset dark:bg-transparent"
          ref={textareaRef}
          value={value}
          onBlur={onBlur}
          onChange={onChange}
        />
      </CellEditorPopover>
      <span data-slot="data-grid-cell-content" dir="auto">
        {value}
      </span>
    </DataGridCell>
  )
}

/** Whether Escape was pressed in one number cell's editor, read by the blur that follows it. */
const numberCanceling = Atom.family((_instance: string) => Atom.make(false))

const numberInputRefs = new WeakMap<object, RefCallback<HTMLInputElement>>()

/**
 * The number editor's ref callback for its input ref, the same function while that ref is: the input is put on the page
 * when editing begins, so it takes the focus then, with its value selected when a typed key is to replace it.
 */
function getNumberInputRef(inputRef: RefObject<HTMLInputElement | null>) {
  const known = numberInputRefs.get(inputRef)
  if (known !== undefined) return known
  const ref: RefCallback<HTMLInputElement> = (input) => {
    if (!input) return
    const undo = setRef(inputRef, input)
    input.focus()
    // Local change: the browser types the key over the selection (see `typesInPlace` in data-grid-cell.tsx).
    if (input.hasAttribute("data-typed-over")) input.select()
    return undo
  }
  numberInputRefs.set(inputRef, ref)
  return ref
}

export function NumberCell<TData extends RowData>(props: DataGridCellProps<TData>) {
  const { cell, isEditing, readOnly } = props
  const instance = useId()
  const registry = useAtomValue(atomRegistry)
  useAtomMount<unknown>(isEditing ? numberCanceling(instance) : nothingKept)
  const initialValue = getNumberCellValue(useCellValue(cell))
  const { value, setDraftValue, clearDraft } = useCellDraft({
    drafts: textDrafts,
    key: initialValue,
    fallback: String(initialValue ?? ""),
    enabled: isEditing
  })
  const inputRef = useRef<HTMLInputElement>(null)

  const numberMeta = getColumnVariantOptions(cell.column, "number")
  const min = numberMeta?.min
  const max = numberMeta?.max
  const step = numberMeta?.step
  const format = numberMeta?.format
  const displayNumber = getNumberCellValue(value)
  const inputMode =
    min !== undefined && min >= 0
      ? Number.isInteger(min) && (step === undefined || Number.isInteger(step))
        ? "numeric"
        : "decimal"
      : undefined

  function onSave(options?: StopEditingOptions) {
    const numValue = value === "" ? null : Number(value)
    if (!readOnly && numValue !== initialValue) {
      cell.setValue(numValue)
    }
    clearDraft()
    cell.table.stopEditing(options)
  }

  function onBlur() {
    // Escape blurs too, and the typed value hasn't been cleared by then.
    if (registry.get(numberCanceling(instance))) {
      registry.set(numberCanceling(instance), false)
      cell.table.stopEditing()
      return
    }
    onSave()
  }

  function onFocus() {
    // The editor has just opened and taken the focus (upstream reset this when editing began).
    registry.set(numberCanceling(instance), false)
  }

  function onChange(event: ChangeEvent<HTMLInputElement>) {
    setDraftValue(event.target.value)
  }

  function onCancel() {
    clearDraft()
    registry.set(numberCanceling(instance), true)
    inputRef.current?.blur()
  }

  return (
    <DataGridCell<TData> {...props} className="text-end" onCommit={onSave} onCancel={onCancel} commitOnEnter>
      {isEditing ? (
        <input
          aria-label={getColumnLabel(cell.column)}
          type="number"
          inputMode={inputMode}
          ref={getNumberInputRef(inputRef)}
          data-typed-over={getPendingChar(cell) ? "" : undefined}
          onFocus={onFocus}
          min={min}
          max={max}
          step={step}
          className="w-full [appearance:textfield] border-none bg-transparent p-0 text-right outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          defaultValue={value}
          onChange={onChange}
          onBlur={onBlur}
        />
      ) : (
        <span data-slot="data-grid-cell-content" dir="auto" className="ms-auto tabular-nums">
          {displayNumber === null ? "" : formatNumberForDisplay(displayNumber, format)}
        </span>
      )}
    </DataGridCell>
  )
}

export function UrlCell<TData extends RowData>(props: DataGridCellProps<TData>) {
  const { isEditing, isFocused } = props
  const { value, onCommit, onCancel, textProps } = useEditableText({
    ...props,
    parse: parseUrlText
  })

  function onWrapperKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!isEditing && isFocused && event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      if (!value) return
      const href = getUrlHref(value)
      if (href) {
        window.open(href, "_blank", "noopener,noreferrer")
      } else {
        toastDangerousUrl()
      }
    }
  }

  function onLinkClick(event: ReactMouseEvent<HTMLAnchorElement>) {
    if (isEditing) {
      event.preventDefault()
      return
    }

    const href = getUrlHref(value)
    if (!href) {
      event.preventDefault()
      toastDangerousUrl()
      return
    }

    event.stopPropagation()
  }

  const displayValue = isEditing ? "" : value
  const urlHref = displayValue ? getUrlHref(displayValue) : ""
  const isDangerousUrl = displayValue && !urlHref

  return (
    <DataGridCell<TData> {...props} onCommit={onCommit} onCancel={onCancel} onKeyDown={onWrapperKeyDown} commitOnEnter>
      {!isEditing && displayValue ? (
        <div data-slot="data-grid-cell-content" dir="auto" className="size-full overflow-hidden">
          <a
            data-focused={isFocused && !isDangerousUrl ? "" : undefined}
            data-invalid={isDangerousUrl ? "" : undefined}
            tabIndex={-1}
            href={urlHref}
            target="_blank"
            rel="noopener noreferrer"
            className="truncate text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary/60 data-focused:text-foreground data-focused:decoration-foreground/50 data-focused:hover:decoration-foreground/70 data-invalid:cursor-not-allowed data-invalid:text-destructive data-invalid:decoration-destructive/50 data-invalid:hover:decoration-destructive/70"
            onClick={onLinkClick}
          >
            {displayValue}
          </a>
        </div>
      ) : (
        <EditableText {...textProps} />
      )}
    </DataGridCell>
  )
}

export function BooleanCell<TData extends RowData>(props: Omit<DataGridCellProps<TData>, "isEditing">) {
  const { cell, isFocused, readOnly } = props
  const value = getBooleanCellValue(useCellValue(cell))
  const control = getColumnVariantOptions(cell.column, "boolean")?.control ?? "checkbox"
  const containerRef = useRef<HTMLDivElement>(null)

  function onCheckedChange(checked: boolean) {
    if (readOnly) return
    cell.setValue(checked)
  }

  function onWrapperKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (isFocused && !readOnly && (event.key === " " || event.key === "Enter")) {
      event.preventDefault()
      event.stopPropagation()
      onCheckedChange(!value)
    }
  }

  function onWrapperClick(event: ReactMouseEvent) {
    if (isFocused && !readOnly) {
      event.preventDefault()
      event.stopPropagation()
      onCheckedChange(!value)
    }
  }

  function onControlClick(event: ReactMouseEvent) {
    event.stopPropagation()
  }

  function onControlMouseDown(event: ReactMouseEvent<HTMLButtonElement>) {
    event.stopPropagation()
    event.preventDefault()
    cell.table.setFocusedCell(cell.row.id, cell.column.id)
    containerRef.current?.focus()
  }

  function onControlDoubleClick(event: ReactMouseEvent<HTMLButtonElement>) {
    event.stopPropagation()
  }

  return (
    <DataGridCell<TData>
      {...props}
      ref={containerRef}
      isEditing={false}
      onClick={onWrapperClick}
      onKeyDown={onWrapperKeyDown}
      className="flex size-full justify-center"
    >
      {control === "switch" ? (
        <Switch
          aria-label={getColumnLabel(cell.column)}
          tabIndex={-1}
          size="sm"
          checked={value}
          onCheckedChange={onCheckedChange}
          onClick={onControlClick}
          onMouseDown={onControlMouseDown}
          onDoubleClick={onControlDoubleClick}
          disabled={readOnly}
        />
      ) : (
        <Checkbox
          aria-label={getColumnLabel(cell.column)}
          tabIndex={-1}
          className="border-primary"
          checked={value}
          onCheckedChange={onCheckedChange}
          onClick={onControlClick}
          onMouseDown={onControlMouseDown}
          onDoubleClick={onControlDoubleClick}
          disabled={readOnly}
        />
      )}
    </DataGridCell>
  )
}

const NO_OPTIONS: ColumnSelectOption[] = []
const NO_VALUES: never[] = []

/**
 * A cell's list worked out from its value by `read`, kept while the value is the same array: a draft compares its key
 * with it. For the same array value it is the same array as last time, and one empty array for any other value. Each
 * reader keeps the lists it made, so what it hands back is a list of what it reads.
 */
function keptCellValues<T>(read: (value: unknown) => T[]): (value: unknown) => T[] {
  const made = new WeakMap<object, T[]>()
  return (value) => {
    if (!Array.isArray(value)) return NO_VALUES
    const known = made.get(value)
    if (known !== undefined) return known
    const list = read(value)
    made.set(value, list)
    return list
  }
}

const getKeptOptionsCellValue = keptCellValues(getOptionsCellValue)
const getKeptFilesCellValue = keptCellValues(getFilesCellValue)

/** The files one file cell on screen is deleting. */
const fileCellDeleting = Atom.family((_instance: string) =>
  Atom.make<{ readonly ids: ReadonlySet<string> }>({ ids: new Set<string>() })
)

/** Whether files are dragged over one drop target on screen. */
const fileDragActive = Atom.family((_instance: string) => Atom.make(false))

export function SelectCell<TData extends RowData>(props: DataGridCellProps<TData>) {
  const { cell, rowHeight, isEditing, readOnly } = props
  const value = getOptionCellValue(useCellValue(cell))
  const containerRef = useRef<HTMLDivElement>(null)
  const commandRef = useRef<HTMLDivElement>(null)
  const options = getColumnVariantOptions(cell.column, "select")?.options ?? NO_OPTIONS

  function onValueChange(newValue: string) {
    if (readOnly) return
    cell.setValue(newValue)
    cell.table.stopEditing()
  }

  function onOpenFocus() {
    commandRef.current?.focus()
  }

  const displayLabel = value ? getOptionLabel(options, value) : null

  return (
    <DataGridCell<TData> {...props} ref={containerRef} onMouseDown={isEditing ? onEditingCellMouseDown : undefined}>
      <CellEditorPopover
        cell={cell}
        open={isEditing}
        readOnly={readOnly}
        rowHeight={rowHeight}
        containerRef={containerRef}
        className="w-(--radix-popover-trigger-width) min-w-36"
        onOpenFocus={onOpenFocus}
      >
        <Command
          ref={commandRef}
          tabIndex={-1}
          className="bg-transparent p-px outline-none"
          {...(value ? { defaultValue: value } : {})}
          loop
        >
          <CommandList>
            <CommandGroup className="p-1.5">
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  keywords={[option.label]}
                  data-checked={option.value === value}
                  onSelect={onValueChange}
                >
                  <span>{option.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </CellEditorPopover>
      {displayLabel ? (
        <Badge
          data-slot="data-grid-cell-content"
          dir="auto"
          variant="secondary"
          className="mt-0.5 mb-px h-auto px-1.5 py-0 leading-3.75 whitespace-pre-wrap"
        >
          {displayLabel}
        </Badge>
      ) : null}
    </DataGridCell>
  )
}

export function MultiSelectCell<TData extends RowData>(props: DataGridCellProps<TData>) {
  const { cell, width, rowHeight, isEditing, readOnly } = props
  const rowId = cell.row.id
  const columnId = cell.column.id
  const rawValue = useCellValue(cell)
  const cellValue = getKeptOptionsCellValue(rawValue)

  const cellKey = getCellKey(rowId, columnId)

  const {
    value: selectedValues,
    setDraftValue: setDraftValues,
    clearDraft
  } = useCellDraft({ drafts: valuesDrafts, key: cellValue, fallback: cellValue })
  const {
    value: searchValue,
    setDraftValue: onSearchValueChange,
    clearDraft: clearSearch
  } = useCellDraft({ drafts: textDrafts, key: cellKey, fallback: "" })
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const options = getColumnVariantOptions(cell.column, "multi-select")?.options ?? NO_OPTIONS

  function commitValues(newValues: string[]) {
    setDraftValues(newValues)
    queueMicrotask(() => {
      cell.setValue(newValues)
      clearDraft()
      inputRef.current?.focus()
    })
  }

  function onValueChange(value: string) {
    if (readOnly) return
    commitValues(
      selectedValues.includes(value) ? selectedValues.filter((v) => v !== value) : [...selectedValues, value]
    )
    clearSearch()
  }

  function removeValue(valueToRemove: string, event?: ReactMouseEvent) {
    if (readOnly) return
    event?.stopPropagation()
    event?.preventDefault()
    commitValues(selectedValues.filter((v) => v !== valueToRemove))
  }

  function clearAll() {
    if (readOnly) return
    clearDraft()
    cell.setValue([])
    queueMicrotask(() => inputRef.current?.focus())
  }

  function onOpenChange(open: boolean) {
    if (!open) clearSearch()
    setCellEditing(cell, open, readOnly)
  }

  function onOpenFocus() {
    inputRef.current?.focus()
  }

  function onCommit(options?: StopEditingOptions) {
    clearSearch()
    cell.table.stopEditing(options)
  }

  function onCancel() {
    clearDraft()
    clearSearch()
    cell.table.stopEditing()
  }

  function onInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && searchValue === "") {
      event.preventDefault()
      if (selectedValues.length > 0) {
        commitValues(selectedValues.slice(0, -1))
      } else {
        queueMicrotask(() => inputRef.current?.focus())
      }
    }
    if (event.key === "Escape") {
      event.stopPropagation()
    }
  }

  const displayLabels = selectedValues.map((value) => getOptionLabel(options, value)).filter(Boolean)

  const selectedValuesSet = new Set(selectedValues)

  const lineCount = getLineCount(rowHeight)

  const { visibleItems: visibleLabels, hiddenCount: hiddenBadgeCount } = getBadgeOverflow({
    items: displayLabels,
    getLabel: (label) => label,
    containerWidth: width,
    lineCount
  })

  return (
    <DataGridCell<TData> {...props} ref={containerRef} onCommit={onCommit} onCancel={onCancel}>
      {isEditing ? (
        <CellEditorPopover
          cell={cell}
          open={isEditing}
          readOnly={readOnly}
          rowHeight={rowHeight}
          containerRef={containerRef}
          className="w-75 min-w-(--radix-popover-trigger-width)"
          onOpenChange={onOpenChange}
          onOpenFocus={onOpenFocus}
          overlap
        >
          <Command className="bg-transparent p-px **:data-[slot=command-input-wrapper]:min-w-16 **:data-[slot=command-input-wrapper]:flex-1 **:data-[slot=command-input-wrapper]:p-0 **:data-[slot=input-group]:h-auto! **:data-[slot=input-group]:rounded-none! **:data-[slot=input-group]:border-none **:data-[slot=input-group]:bg-transparent **:data-[slot=input-group-addon]:hidden **:data-[slot=input-group]:dark:bg-transparent">
            <div className="flex flex-wrap items-center gap-1 border-b px-3.5 py-2 has-data-[slot=badge]:px-1.75">
              {selectedValues.map((value) => {
                const label = getOptionLabel(options, value)

                return (
                  <Badge key={value} variant="secondary" className="gap-1 px-1.5 py-px">
                    {label}
                    <button
                      aria-label={`Remove ${label}`}
                      type="button"
                      onClick={(event) => removeValue(value, event)}
                      onPointerDown={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                      }}
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                )
              })}
              <CommandInput
                aria-label={`Search ${getColumnLabel(cell.column)}`}
                ref={inputRef}
                value={searchValue}
                onValueChange={onSearchValueChange}
                onKeyDown={onInputKeyDown}
                placeholder={selectedValues.length > 0 ? undefined : "Search..."}
                className="p-0! placeholder:text-muted-foreground pointer-coarse:text-base"
              />
            </div>
            <CommandList className="max-h-full">
              <CommandEmpty>No options found.</CommandEmpty>
              <CommandGroup className="max-h-75 scroll-py-1.5 overflow-x-hidden overflow-y-auto p-1.5">
                {options.map((option) => {
                  const isSelected = selectedValuesSet.has(option.value)

                  return (
                    <CommandItem
                      key={option.value}
                      value={option.label}
                      onSelect={() => onValueChange(option.value)}
                      data-checked={isSelected}
                    >
                      <span>{option.label}</span>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
              {selectedValues.length > 0 && (
                <>
                  <CommandSeparator />
                  <CommandGroup className="p-1.5">
                    <CommandItem onSelect={clearAll} className="justify-center text-muted-foreground">
                      Clear all
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </CellEditorPopover>
      ) : null}
      {displayLabels.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-1 overflow-hidden">
          {visibleLabels.map((label, index) => (
            <Badge
              key={selectedValues[index]}
              variant="secondary"
              className={cn(
                CELL_BADGE_CLASS_NAME,
                "max-w-full",
                hiddenBadgeCount > 0 && index === visibleLabels.length - 1 && "max-w-[calc(100%-2.75rem)]"
              )}
            >
              <span dir="auto" className="truncate">
                {label}
              </span>
            </Badge>
          ))}
          {hiddenBadgeCount > 0 && <OverflowBadge count={hiddenBadgeCount} />}
        </div>
      ) : null}
    </DataGridCell>
  )
}

export function DateCell<TData extends RowData>(props: DataGridCellProps<TData>) {
  const { cell, rowHeight, isEditing, readOnly } = props
  const value = getDateCellValue(useCellValue(cell))
  const containerRef = useRef<HTMLDivElement>(null)
  const isInvalidDate = value !== "" && !parseLocalDate(value)

  const selectedDate = value ? (parseLocalDate(value) ?? undefined) : undefined

  function onDateSelect(date: Date | undefined) {
    if (!date || readOnly) return

    cell.setValue(formatDateToString(date))
    cell.table.stopEditing()
  }

  return (
    <DataGridCell<TData> {...props} ref={containerRef} onMouseDown={isEditing ? onEditingCellMouseDown : undefined}>
      <CellEditorPopover
        cell={cell}
        open={isEditing}
        readOnly={readOnly}
        rowHeight={rowHeight}
        containerRef={containerRef}
        className="w-auto"
      >
        <Calendar
          autoFocus
          captionLayout="dropdown"
          mode="single"
          {...(selectedDate ? { defaultMonth: selectedDate } : {})}
          selected={selectedDate}
          onSelect={onDateSelect}
        />
      </CellEditorPopover>
      <span
        data-slot="data-grid-cell-content"
        dir="auto"
        data-invalid={isInvalidDate ? "" : undefined}
        className="data-invalid:text-destructive"
      >
        {formatDateForDisplay(value)}
      </span>
    </DataGridCell>
  )
}

export function FileCell<TData extends RowData>(props: DataGridCellProps<TData>) {
  const { cell, width, rowHeight, isEditing, readOnly } = props

  const labelId = useId()
  const descriptionId = useId()

  const rowId = cell.row.id
  const columnId = cell.column.id
  const cellKey = getCellKey(rowId, columnId)
  const rawValue = useCellValue(cell)
  const cellValue = getKeptFilesCellValue(rawValue)

  const fileMeta = getColumnVariantOptions(cell.column, "file")
  const maxFileSize = fileMeta?.maxFileSize ?? 10 * 1024 * 1024
  const maxFiles = fileMeta?.maxFiles ?? 10
  const accept = fileMeta?.accept
  const multiple = fileMeta?.multiple ?? false

  const {
    value: uploadingFiles,
    setDraftValue: setUploadingFiles,
    clearDraft: clearUploadingFiles
  } = useCellDraft({ drafts: filesDrafts, key: cellKey, fallback: null })
  const [deleting, setDeleting] = useAtom(fileCellDeleting(useId()))
  const deletingIds = deleting.ids
  const setDeletingIds = (ids: ReadonlySet<string>) => setDeleting({ ids })
  const {
    value: error,
    setDraftValue: setError,
    clearDraft: clearError
  } = useCellDraft({ drafts: errorDrafts, key: cellValue, fallback: null })
  // The error's two seconds on screen, cleared when the cell leaves (upstream's timeout ref and unmount effect).
  const errorTimer = useAtomValue(oneTimer(useId()))

  const files = uploadingFiles ? [...cellValue, ...uploadingFiles] : cellValue
  const uploadingIds = new Set(uploadingFiles?.map((file) => file.id))
  const isPending = uploadingFiles !== null || deletingIds.size > 0

  const acceptedTypes = accept ? accept.split(",").map((t) => t.trim()) : null

  function flashError(message: string, toastOptions?: ExternalToast) {
    setError(message)
    toast(message, toastOptions)
    errorTimer.start(clearError, 2000)
  }

  const addFiles = Effect.fnUntraced(function* (newFiles: File[]) {
    if (readOnly || isPending || newFiles.length === 0) return
    clearError()

    if (maxFiles && cellValue.length + newFiles.length > maxFiles) {
      flashError(`Maximum ${maxFiles} files allowed`)
      return
    }

    const accepted: { file: File; data: FileCellData }[] = []
    const rejected: { name: string; reason: string }[] = []

    for (const file of newFiles) {
      const reason = validateFile(file, maxFileSize, acceptedTypes)
      if (reason) {
        rejected.push({ name: file.name, reason })
        continue
      }
      accepted.push({
        file,
        data: {
          id: crypto.randomUUID(),
          name: file.name,
          size: file.size,
          type: file.type,
          url: undefined
        }
      })
    }

    const firstRejected = rejected[0]
    if (firstRejected) {
      const truncatedName =
        firstRejected.name.length > 20 ? `${firstRejected.name.slice(0, 20)}...` : firstRejected.name

      flashError(firstRejected.reason, {
        description:
          rejected.length === 1
            ? `"${truncatedName}" has been rejected`
            : `"${truncatedName}" and ${rejected.length - 1} more rejected`
      })
    }

    if (accepted.length === 0) return

    setUploadingFiles(accepted.map(({ data }) => data))

    let uploadedFiles: FileCellData[]

    const options = cell.table.options
    const uploadFiles = options.uploadFiles
    if (uploadFiles) {
      // Local change: `Effect.tryPromise` where upstream has a `try` statement; a refused upload says why, as
      // upstream's did. Called on the options, as upstream called it.
      const uploaded = yield* Effect.result(
        Effect.tryPromise({
          try: () =>
            uploadFiles.call(options, {
              files: accepted.map(({ file }) => file),
              rowId,
              columnId
            }),
          catch: (error) =>
            error instanceof Error
              ? error.message
              : `Failed to upload ${accepted.length} file${accepted.length !== 1 ? "s" : ""}`
        })
      )
      if (Result.isFailure(uploaded)) {
        toast.error(uploaded.failure)
        clearUploadingFiles()
        return
      }
      uploadedFiles = uploaded.success
    } else {
      uploadedFiles = accepted.map(({ file, data }) => ({
        ...data,
        url: createFileObjectUrl(cell.table, file)
      }))
    }

    cell.setValue([...getFilesCellValue(cell.getValue()), ...uploadedFiles.filter((file) => file.url !== undefined)])
    clearUploadingFiles()
  })

  const deleteFiles = Effect.fnUntraced(function* (fileIds: string[]) {
    if (readOnly || isPending) return
    clearError()

    const filesToDelete = cellValue.filter((file) => fileIds.includes(file.id))
    if (filesToDelete.length === 0) return

    const idsToDelete = new Set(filesToDelete.map((file) => file.id))
    setDeletingIds(idsToDelete)

    const options = cell.table.options
    const deleteFiles = options.deleteFiles
    if (deleteFiles) {
      // Local change: `Effect.try`, and `Effect.tryPromise` when the caller answers later, where upstream has a `try`
      // statement; a refused delete says why, as upstream's did. Called on the options, as upstream called it.
      const refused = (error: unknown) =>
        error instanceof Error
          ? error.message
          : filesToDelete.length === 1
            ? `Failed to delete ${filesToDelete[0]?.name}`
            : "Failed to delete files"
      const deleted = yield* Effect.result(
        Effect.flatMap(
          Effect.try({
            try: () =>
              deleteFiles.call(options, {
                fileIds: [...idsToDelete],
                rowId,
                columnId
              }),
            catch: refused
          }),
          (answer) => (P.isPromiseLike(answer) ? Effect.tryPromise({ try: () => answer, catch: refused }) : Effect.void)
        )
      )
      if (Result.isFailure(deleted)) {
        toast.error(deleted.failure)
        setDeletingIds(new Set())
        return
      }
    }

    cell.setValue(getFilesCellValue(cell.getValue()).filter((file) => !idsToDelete.has(file.id)))
    setDeletingIds(new Set())
  })

  const containerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropzoneRef = useRef<HTMLDivElement>(null)

  function onDropFiles(droppedFiles: File[]) {
    Effect.runFork(addFiles(droppedFiles))
  }

  const { isDragActive: isDraggingOver, dropTargetProps: cellDropProps } = useFileDropTarget(onDropFiles)
  const { isDragActive: isDragging, dropTargetProps: dropzoneDropProps } = useFileDropTarget(onDropFiles)

  function onDropzoneClick() {
    fileInputRef.current?.click()
  }

  function onDropzoneKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      onDropzoneClick()
    }
  }

  function onFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? [])
    Effect.runFork(addFiles(selectedFiles))
    event.target.value = ""
  }

  function onOpenChange(open: boolean) {
    clearError()
    setCellEditing(cell, open, readOnly)
  }

  function onEscapeKeyDown(event: Event) {
    event.stopPropagation()
  }

  function onOpenFocus() {
    queueMicrotask(() => {
      dropzoneRef.current?.focus()
    })
  }

  function onCancel() {
    clearError()
    cell.table.stopEditing()
  }

  function onWrapperKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (isEditing && event.key === " ") {
      event.preventDefault()
      onDropzoneClick()
    }
  }

  const lineCount = getLineCount(rowHeight)

  const { visibleItems: visibleFiles, hiddenCount: hiddenFileCount } = getBadgeOverflow({
    items: files,
    getLabel: (file) => file.name,
    containerWidth: width,
    lineCount,
    cacheKeyPrefix: "file",
    iconSize: 12,
    maxWidth: 100
  })

  return (
    <DataGridCell<TData>
      {...props}
      ref={containerRef}
      {...cellDropProps}
      onCancel={onCancel}
      onKeyDown={onWrapperKeyDown}
      className={cn({
        "ring-1 ring-primary/80 ring-inset": isDraggingOver
      })}
    >
      {isEditing ? (
        <CellEditorPopover
          cell={cell}
          open={isEditing}
          readOnly={readOnly}
          rowHeight={rowHeight}
          containerRef={containerRef}
          className="w-100"
          onOpenChange={onOpenChange}
          onOpenFocus={onOpenFocus}
          onEscapeKeyDown={onEscapeKeyDown}
          overlap
        >
          <div className="flex flex-col gap-2 p-3">
            <span id={labelId} className="sr-only">
              File upload
            </span>
            <div
              role="region"
              aria-labelledby={labelId}
              aria-describedby={descriptionId}
              aria-invalid={!!error}
              aria-disabled={isPending}
              data-dragging={isDragging ? "" : undefined}
              data-invalid={error ? "" : undefined}
              data-disabled={isPending ? "" : undefined}
              tabIndex={isDragging || isPending ? -1 : 0}
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-6 transition-colors outline-none hover:bg-accent/30 focus-visible:border-ring/50 data-dragging:border-primary/30 data-dragging:bg-accent/30 data-invalid:border-destructive data-invalid:ring-destructive/20 data-disabled:pointer-events-none data-disabled:opacity-50"
              ref={dropzoneRef}
              onClick={onDropzoneClick}
              {...dropzoneDropProps}
              onKeyDown={onDropzoneKeyDown}
            >
              <Upload className="size-8 text-muted-foreground" />
              <div className="text-center text-sm">
                <p className="font-medium">{isDragging ? "Drop files here" : "Drag files here"}</p>
                <p className="text-xs text-muted-foreground">or click to browse</p>
              </div>
              <p id={descriptionId} className="text-xs text-muted-foreground">
                {maxFileSize
                  ? `Max size: ${formatFileSize(maxFileSize)}${maxFiles ? ` • Max ${maxFiles} files` : ""}`
                  : maxFiles
                    ? `Max ${maxFiles} files`
                    : "Select files to upload"}
              </p>
            </div>
            <input
              type="file"
              aria-labelledby={labelId}
              aria-describedby={descriptionId}
              multiple={multiple}
              accept={accept}
              className="sr-only"
              ref={fileInputRef}
              onChange={onFileInputChange}
            />
            {files.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">
                    {files.length} {files.length === 1 ? "file" : "files"}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-6 text-xs text-muted-foreground"
                    onClick={() => void Effect.runFork(deleteFiles(cellValue.map((file) => file.id)))}
                    disabled={isPending}
                  >
                    Clear all
                  </Button>
                </div>
                <div className="max-h-50 space-y-1 overflow-y-auto">
                  {files.map((file) => {
                    const FileIcon = getFileIcon(file.type)
                    const isFileUploading = uploadingIds.has(file.id)
                    const isFileDeleting = deletingIds.has(file.id)
                    const isFilePending = isFileUploading || isFileDeleting

                    return (
                      <div
                        key={file.id}
                        data-pending={isFilePending ? "" : undefined}
                        className="flex items-center gap-2 rounded-md border bg-muted/50 px-2 py-1.5 data-pending:opacity-60"
                      >
                        {FileIcon && <FileIcon className="size-4 shrink-0 text-muted-foreground" />}
                        <div className="flex-1 overflow-hidden">
                          <p className="truncate text-sm">{file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {isFileUploading
                              ? "Uploading..."
                              : isFileDeleting
                                ? "Deleting..."
                                : formatFileSize(file.size)}
                          </p>
                        </div>
                        <Button
                          aria-label={`Remove ${file.name}`}
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-5 rounded-sm"
                          onClick={() => void Effect.runFork(deleteFiles([file.id]))}
                          disabled={isPending}
                        >
                          <X className="size-3" />
                        </Button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </CellEditorPopover>
      ) : null}
      {isDraggingOver ? (
        <div className="flex items-center justify-center gap-2 text-sm text-primary">
          <Upload className="size-4" />
          <span>Drop files here</span>
        </div>
      ) : files.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-1 overflow-hidden">
          {visibleFiles.map((file) => {
            const isUploading = uploadingIds.has(file.id)

            if (isUploading) {
              return (
                <Skeleton
                  key={file.id}
                  className="mt-0.5 mb-px h-4.25 shrink-0 px-1.5"
                  style={{
                    width: `${Math.min(file.name.length * 8 + 30, 100)}px`
                  }}
                />
              )
            }

            const FileIcon = getFileIcon(file.type)

            return (
              <Badge key={file.id} variant="secondary" className={cn(CELL_BADGE_CLASS_NAME, "gap-1")}>
                {FileIcon && <FileIcon className="size-3 shrink-0" />}
                <span dir="auto" className="max-w-25 truncate">
                  {file.name}
                </span>
              </Badge>
            )
          })}
          {hiddenFileCount > 0 && <OverflowBadge count={hiddenFileCount} />}
        </div>
      ) : null}
    </DataGridCell>
  )
}

interface OverflowBadgeProps {
  count: number
}

function OverflowBadge({ count }: OverflowBadgeProps) {
  return (
    <Badge variant="outline" dir="ltr" className={cn(CELL_BADGE_CLASS_NAME, "text-muted-foreground")}>
      +{count}
    </Badge>
  )
}

interface CellEditorPopoverProps<TData extends RowData> extends Omit<
  ComponentProps<typeof PopoverContent>,
  "align" | "alignOffset" | "sideOffset"
> {
  cell: DataGridCellProps<TData>["cell"]
  open: boolean
  readOnly: boolean
  rowHeight: RowHeightValue
  containerRef: RefObject<HTMLDivElement | null>
  onOpenChange?: (open: boolean) => void
  onOpenFocus?: () => void
  overlap?: boolean
}

function CellEditorPopover<TData extends RowData>({
  cell,
  open,
  readOnly,
  rowHeight,
  containerRef,
  onOpenChange,
  onOpenFocus,
  overlap,
  className,
  ...props
}: CellEditorPopoverProps<TData>) {
  function onEditorOpenChange(nextOpen: boolean) {
    if (onOpenChange) {
      onOpenChange(nextOpen)
    } else {
      setCellEditing(cell, nextOpen, readOnly)
    }
  }

  const { onPointerDownOutside, onCloseAutoFocus } = getCellEditorDismiss(containerRef)

  function onOpenAutoFocus(event: Event) {
    event.preventDefault()
    onOpenFocus?.()
  }

  return (
    <Popover open={open} onOpenChange={onEditorOpenChange}>
      <PopoverAnchor asChild>
        <div className="absolute inset-0" />
      </PopoverAnchor>
      <PopoverContent
        aria-label={getColumnLabel(cell.column)}
        data-grid-cell-editor=""
        align="start"
        sideOffset={overlap ? getOverlapOffset(rowHeight) : 0}
        className={cn(CELL_EDITOR_CLASS_NAME, className)}
        onOpenAutoFocus={onOpenFocus ? onOpenAutoFocus : undefined}
        onPointerDownOutside={onPointerDownOutside}
        onCloseAutoFocus={onCloseAutoFocus}
        {...props}
      />
    </Popover>
  )
}

interface UseEditableTextOptions<TData extends RowData> extends DataGridCellProps<TData> {
  parse?: (text: string) => string | null
}

/** What a text cell's editor holds while it is open: its element, and the text it opened with. */
interface TextEditor {
  /** The element's ref callback while it is edited: it takes the focus and selects what a typed key replaces. */
  readonly ref: RefCallback<HTMLDivElement>
  readonly element: () => HTMLDivElement | null
  readonly startText: () => string | null
}

/**
 * One text cell's editor, made when its editing begins and let go when it ends (the cell reads it only while it is
 * edited): the element is given `ref` while it is edited and `showTextRef` while it is not, so React calls one of the
 * two exactly when editing begins or ends (upstream's effect and layout effect on `isEditing`).
 */
const textEditors = Atom.family((_instance: string) =>
  Atom.readable((): TextEditor => {
    let element: HTMLDivElement | null = null
    let startText: string | null = null
    return {
      ref: (node) => {
        if (!node) return
        element = node
        node.focus()
        // The text it opened with is drawn while it is edited, so no draw writes over what is being typed.
        startText = node.textContent ?? ""

        // Local change: the browser types the key over the selection (see `typesInPlace` in data-grid-cell.tsx).
        if (node.hasAttribute("data-typed-over")) {
          selectEditableText(node)
        } else if (node.textContent) {
          moveCaretToEnd(node)
        }
        return () => {
          if (element === node) element = null
          // Marks the element for `showTextRef`, which then undoes what was typed and not stored.
          node.dataset.edited = ""
        }
      },
      element: () => element,
      startText: () => startText
    }
  }).pipe(Atom.setIdleTTL(0))
)

/** What a text cell that is not being edited reads in place of an editor. */
const noTextEditor = Atom.readable((): TextEditor => ({ ref: showTextRef, element: () => null, startText: () => null }))

/**
 * A text cell's element while it is not edited. Once its editing has ended, what was typed and not stored leaves
 * with it, and the text scrolls back to its start; an element that was never edited is left as it was drawn.
 */
function showTextRef(element: HTMLDivElement | null) {
  if (!element || element.dataset.edited === undefined) return
  delete element.dataset.edited
  const shown = element.dataset.cellText ?? ""
  if (element.textContent !== shown) element.textContent = shown
  element.scrollLeft = 0
}

function useEditableText<TData extends RowData>({
  cell,
  isEditing,
  readOnly,
  parse = parsePlainText
}: UseEditableTextOptions<TData>) {
  const instance = useId()
  const editor = useAtomValue(isEditing ? textEditors(instance) : noTextEditor)
  const initialValue = getTextCellValue(useCellValue(cell))
  const { value, setDraftValue, clearDraft } = useCellDraft({
    drafts: textDrafts,
    key: initialValue,
    fallback: initialValue,
    enabled: isEditing
  })

  function onSave(options?: StopEditingOptions, element = editor.element()) {
    const value = parse(element?.textContent ?? "")
    if (!readOnly && value !== parse(initialValue)) {
      cell.setValue(value)
    }
    clearDraft()
    cell.table.stopEditing(options)
  }

  function onCommit(options?: StopEditingOptions) {
    onSave(options)
  }

  function onBlur(event: FocusEvent<HTMLDivElement>) {
    onSave(undefined, event.currentTarget)
  }

  function onInput(event: ReactInputEvent<HTMLDivElement>) {
    setDraftValue(event.currentTarget.textContent ?? "")
  }

  function onCancel() {
    clearDraft()
    const element = editor.element()
    if (!element) return
    // Blurring saves the DOM text, so the typed text is undone first.
    element.textContent = initialValue
    element.blur()
  }

  return {
    value,
    onCommit,
    onCancel,
    textProps: {
      ref: isEditing ? editor.ref : showTextRef,
      isEditing,
      label: getColumnLabel(cell.column),
      text: isEditing ? (editor.startText() ?? initialValue) : initialValue,
      isTypedOver: isEditing && getPendingChar(cell) !== null,
      onBlur,
      onInput
    }
  }
}

function parsePlainText(text: string) {
  return text
}

function parseUrlText(text: string) {
  return text.trim() || null
}

interface EditableTextProps extends ComponentProps<"div"> {
  isEditing: boolean
  label: string
  /** What the element holds: the value shown, or while it is edited, the text it opened with. */
  text: string
  /** The key that opened the editor is to replace the text. */
  isTypedOver: boolean
}

function EditableText({ isEditing, label, text, isTypedOver, className, ...props }: EditableTextProps) {
  return (
    <div
      role={isEditing ? "textbox" : undefined}
      aria-label={isEditing ? label : undefined}
      data-slot="data-grid-cell-content"
      data-cell-text={isEditing ? undefined : text}
      data-typed-over={isTypedOver ? "" : undefined}
      dir="auto"
      contentEditable={isEditing}
      tabIndex={-1}
      suppressContentEditableWarning
      {...props}
      className={cn(
        "size-full overflow-hidden outline-none",
        {
          "whitespace-nowrap **:inline **:whitespace-nowrap [&_br]:hidden": isEditing
        },
        className
      )}
    >
      {text}
    </div>
  )
}

interface UseCellDraftOptions<TValue> {
  readonly drafts: CellDrafts<TValue>
  readonly key: unknown
  readonly fallback: TValue
  readonly enabled?: boolean
}

/** A draft of one cell on screen: the key it was made for and its value, or none. */
type CellDraft<TValue> = { readonly key: unknown; readonly value: TValue } | null

/**
 * The drafts of one kind of value: one draft of one cell on screen (each `useCellDraft` its own, made for its `useId`),
 * kept while the draft is in use; a draft that is not (a text cell that is not being edited) reads `none`, so a cell
 * drawn while scrolling makes no atom of its own until it is edited. One set for each kind, so a draft read back is
 * of the kind written.
 */
interface CellDrafts<TValue> {
  readonly of: (instance: string) => Atom.Writable<CellDraft<TValue>>
  readonly none: Atom.Writable<CellDraft<TValue>>
}

function cellDraftsOf<TValue>(): CellDrafts<TValue> {
  return {
    of: Atom.family((_instance: string) => Atom.make<CellDraft<TValue>>(null)),
    none: Atom.keepAlive(Atom.make<CellDraft<TValue>>(null))
  }
}

const textDrafts = cellDraftsOf<string>()
const valuesDrafts = cellDraftsOf<string[]>()
const filesDrafts = cellDraftsOf<FileCellData[] | null>()
const errorDrafts = cellDraftsOf<string | null>()

/** What an editor that is not open mounts in place of what it keeps while it is. */
const nothingKept = Atom.keepAlive(Atom.make(false))

function useCellDraft<TValue>({ drafts, key, fallback, enabled = true }: UseCellDraftOptions<TValue>) {
  const instance = useId()
  const [draft, setDraft] = useAtom(enabled ? drafts.of(instance) : drafts.none)
  const value = enabled && draft !== null && draft.key === key ? draft.value : fallback

  function setDraftValue(newValue: TValue) {
    if (!enabled) return
    setDraft({ key, value: newValue })
  }

  function clearDraft() {
    setDraft(null)
  }

  return { value, setDraftValue, clearDraft }
}

/** A cell editor's two dismiss handlers, for the cell's element. */
function getCellEditorDismiss(containerRef: RefObject<HTMLDivElement | null>) {
  function onPointerDownOutside(event: Event) {
    const container = containerRef.current
    if (event.target instanceof Node && container?.contains(event.target)) {
      event.preventDefault()
    }
  }

  function onCloseAutoFocus(event: Event) {
    event.preventDefault()
    const container = containerRef.current
    if (!container?.closest('[role="grid"]')?.contains(document.activeElement)) {
      container?.focus()
    }
  }

  return { onPointerDownOutside, onCloseAutoFocus }
}

function getOverlapOffset(rowHeight: RowHeightValue) {
  return -getRowHeightValue(rowHeight) + CELL_BORDER_WIDTH
}

function setCellEditing<TData extends RowData>(
  cell: DataGridCellProps<TData>["cell"],
  open: boolean,
  readOnly: boolean
) {
  if (open && !readOnly) {
    cell.startEditing()
  } else {
    cell.table.stopEditing()
  }
}

function getPendingChar<TData extends RowData>(cell: DataGridCellProps<TData>["cell"]) {
  return cell.table.getEditingCell()?.pendingChar ?? null
}

function onEditingCellMouseDown(event: ReactMouseEvent) {
  event.preventDefault()
}

function getOptionLabel(options: ColumnSelectOption[], value: string) {
  return options.find((option) => option.value === value)?.label ?? value
}

function validateFile(file: File, maxFileSize: number, acceptedTypes: string[] | null): string | null {
  if (maxFileSize && file.size > maxFileSize) {
    return `File size exceeds ${formatFileSize(maxFileSize)}`
  }
  if (acceptedTypes) {
    const fileExtension = `.${file.name.split(".").pop()}`
    const isAccepted = acceptedTypes.some((type) => {
      if (type.endsWith("/*")) {
        const baseType = type.slice(0, -2)
        return file.type.startsWith(`${baseType}/`)
      }
      if (type.startsWith(".")) {
        return fileExtension.toLowerCase() === type.toLowerCase()
      }
      return file.type === type
    })
    if (!isAccepted) {
      return "File type not accepted"
    }
  }
  return null
}

function useFileDropTarget(onDropFiles: (files: File[]) => void) {
  const [isDragActive, setIsDragActive] = useAtom(fileDragActive(useId()))

  function onDragEnter(event: ReactDragEvent) {
    event.preventDefault()
    event.stopPropagation()
    if (event.dataTransfer.types.includes("Files")) {
      setIsDragActive(true)
    }
  }

  function onDragLeave(event: ReactDragEvent) {
    event.preventDefault()
    event.stopPropagation()
    if (getIsDragLeaving(event)) setIsDragActive(false)
  }

  function onDrop(event: ReactDragEvent) {
    event.preventDefault()
    event.stopPropagation()
    setIsDragActive(false)

    const droppedFiles = Array.from(event.dataTransfer.files)
    if (droppedFiles.length > 0) {
      onDropFiles(droppedFiles)
    }
  }

  return {
    isDragActive,
    dropTargetProps: {
      onDragEnter,
      onDragLeave,
      onDragOver: onFileDragOver,
      onDrop
    }
  }
}

function getIsDragLeaving(event: ReactDragEvent) {
  const rect = event.currentTarget.getBoundingClientRect()
  const x = event.clientX
  const y = event.clientY
  return x <= rect.left || x >= rect.right || y <= rect.top || y >= rect.bottom
}

function onFileDragOver(event: ReactDragEvent) {
  event.preventDefault()
  event.stopPropagation()
}

function toastDangerousUrl() {
  toast.error("Invalid URL", {
    description: "URL contains a dangerous protocol (javascript:, data:, vbscript:, or file:)"
  })
}
