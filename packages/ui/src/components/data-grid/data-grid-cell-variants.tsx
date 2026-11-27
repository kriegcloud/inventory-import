// Local change: moved from React's hooks to atoms (goals/atoms, "The kit on atoms", batch 2); no longer as its registry has it.
// What a cell keeps while it is edited (the typed draft, the files being sent or removed, a drag over it) is an atom of
// that cell on screen, made for its `useId`; the pause before a long text is saved and the time an error shows are
// `oneTimer`s (batch 1), cleared when the cell leaves the screen. What upstream did in an effect when the editing
// started (focus the editor, select its value or put the caret after it, remember the value Escape puts back) is a ref
// callback, kept by the cell's own atom, that changes exactly when that effect ran again. The handlers are plain
// functions: every one goes to an element or a Radix part, none to a memo that compares it.
// The rule this file protects: typing on a focused cell opens its editor and keeps the key that opened it, and what was
// typed is what is stored (`bun run grid:keys` in apps/inventory types on each editor and reads what is stored).
"use client"

import type { RowData } from "@tanstack/react-table"
import type { ExternalToast } from "sonner"

import { useAtom, useAtomValue } from "@effect/atom-react"
import { cn } from "cn"
import * as Atom from "effect/reactivity/Atom"
import {
  type ChangeEvent,
  type ComponentProps,
  type DragEvent,
  type InputEvent,
  type KeyboardEvent,
  type MouseEvent,
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

// Local change: `getBadgeOverflow` where upstream called `useBadgeOverflow`, whose memo keyed on a label function made
// in each draw and so kept nothing; `oneTimer` where upstream called `useDebouncedCallback`.
import { getBadgeOverflow } from "@inventory/ui/components/data-grid/use-badge-overflow"
import { oneTimer } from "@inventory/ui/components/data-table/data-table-state"
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
  selectEditableText,
  // Local change: `settle`, for the `try` statements upstream has here (none in this repository).
  settle
} from "@inventory/ui/components/data-grid/data-grid-utils"
// Local change: `Result`, for the same.
import * as Result from "effect/Result"
import { DataGridCell, useCellValue } from "@inventory/ui/components/data-grid/data-grid-cell"
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

export function LongTextCell<TData extends RowData>(props: DataGridCellProps<TData>) {
  const { cell, rowHeight, isEditing, readOnly } = props
  const initialValue = getTextCellValue(useCellValue(cell))
  const { value, setDraftValue, clearDraft } = useCellDraft(textDrafts, {
    key: initialValue,
    fallback: initialValue,
    enabled: isEditing
  })
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const kept = useAtomValue(editorKept(useId()))
  const saveTimer = useAtomValue(oneTimer(useId()))

  const { table } = cell
  const rowId = cell.row.id
  const columnId = cell.column.id
  // Local change: the text box is drawn only while the popover is open, so it comes when the editing starts. The value
  // then is what Escape puts back, and a new editing is not being cancelled: upstream's effect on `isEditing`.
  const textareaRefCallback = kept.ref([table, rowId, columnId], () => (textarea: HTMLTextAreaElement | null) => {
    textareaRef.current = textarea
    if (textarea === null) return
    kept.setStartValue(getTextCellValue(table.getRowModel().rowsById[rowId]?.getValue(columnId)))
    kept.setCancelling(false)
    return () => {
      textareaRef.current = null
    }
  })

  const debouncedSave = (newValue: string) => {
    saveTimer.start(() => {
      if (!readOnly) {
        cell.setValue(newValue)
      }
    }, 300)
  }

  const onSave = (options?: StopEditingOptions) => {
    saveTimer.cancel()
    if (kept.cancelling()) {
      cell.table.stopEditing(options)
      return
    }
    if (!readOnly && value !== initialValue) {
      cell.setValue(value)
    }
    clearDraft()
    cell.table.stopEditing(options)
  }

  const onCancel = () => {
    saveTimer.cancel()
    kept.setCancelling(true)
    clearDraft()
    const editStartValue = kept.startValue()
    if (!readOnly && getTextCellValue(cell.getValue()) !== editStartValue) {
      cell.setValue(editStartValue)
    }
    cell.table.stopEditing()
  }

  const onOpenChange = (open: boolean) => {
    if (open && !readOnly) {
      cell.startEditing()
    } else {
      onSave()
    }
  }

  const onOpenFocus = () => {
    const textarea = textareaRef.current
    if (!textarea) return

    textarea.focus()
    const length = textarea.value.length
    textarea.setSelectionRange(length, length)

    // Local change: the browser types the key that opened the editor, after the text (see `typesInPlace` in
    // data-grid-cell.tsx). Upstream typed it here on the next frame, and lost it when a second key came first.
    textarea.scrollTop = textarea.scrollHeight
  }

  const onBlur = () => onSave()

  const onChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
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
          ref={textareaRefCallback}
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

export function NumberCell<TData extends RowData>(props: DataGridCellProps<TData>) {
  const { cell, isEditing, readOnly } = props
  const initialValue = getNumberCellValue(useCellValue(cell))
  const { value, setDraftValue, clearDraft } = useCellDraft(textDrafts, {
    key: initialValue,
    fallback: String(initialValue ?? ""),
    enabled: isEditing
  })
  const inputRef = useRef<HTMLInputElement>(null)
  const kept = useAtomValue(editorKept(useId()))

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

  const onSave = (options?: StopEditingOptions) => {
    const numValue = value === "" ? null : Number(value)
    if (!readOnly && numValue !== initialValue) {
      cell.setValue(numValue)
    }
    clearDraft()
    cell.table.stopEditing(options)
  }

  const onBlur = () => {
    // Escape blurs too, and the typed value hasn't been cleared by then.
    if (kept.cancelling()) {
      kept.setCancelling(false)
      cell.table.stopEditing()
      return
    }
    onSave()
  }

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    setDraftValue(event.target.value)
  }

  const onCancel = () => {
    clearDraft()
    kept.setCancelling(true)
    inputRef.current?.blur()
  }

  // Local change: the input is drawn only while the cell is edited, so it comes when the editing starts: it takes the
  // focus, and a new editing is not being cancelled (upstream's effect on `isEditing`). The browser types the key over
  // the selection (see `typesInPlace` in data-grid-cell.tsx). Upstream's list also held `setDraftValue`, which its
  // fallback called.
  const inputRefCallback = kept.ref([cell.table], () => (input: HTMLInputElement | null) => {
    inputRef.current = input
    if (input === null) return
    kept.setCancelling(false)
    input.focus()
    if (getPendingChar(cell)) input.select()
    return () => {
      inputRef.current = null
    }
  })

  return (
    <DataGridCell<TData> {...props} className="text-end" onCommit={onSave} onCancel={onCancel} commitOnEnter>
      {isEditing ? (
        <input
          aria-label={getColumnLabel(cell.column)}
          type="number"
          inputMode={inputMode}
          ref={inputRefCallback}
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

  const onWrapperKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
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

  const onLinkClick = (event: MouseEvent<HTMLAnchorElement>) => {
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

  const onCheckedChange = (checked: boolean) => {
    if (readOnly) return
    cell.setValue(checked)
  }

  const onWrapperKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (isFocused && !readOnly && (event.key === " " || event.key === "Enter")) {
      event.preventDefault()
      event.stopPropagation()
      onCheckedChange(!value)
    }
  }

  const onWrapperClick = (event: MouseEvent) => {
    if (isFocused && !readOnly) {
      event.preventDefault()
      event.stopPropagation()
      onCheckedChange(!value)
    }
  }

  const onControlMouseDown = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    event.preventDefault()
    cell.table.setFocusedCell(cell.row.id, cell.column.id)
    containerRef.current?.focus()
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
          onClick={stopPropagation}
          onMouseDown={onControlMouseDown}
          onDoubleClick={stopPropagation}
          disabled={readOnly}
        />
      ) : (
        <Checkbox
          aria-label={getColumnLabel(cell.column)}
          tabIndex={-1}
          className="border-primary"
          checked={value}
          onCheckedChange={onCheckedChange}
          onClick={stopPropagation}
          onMouseDown={onControlMouseDown}
          onDoubleClick={stopPropagation}
          disabled={readOnly}
        />
      )}
    </DataGridCell>
  )
}

const NO_OPTIONS: ColumnSelectOption[] = []

export function SelectCell<TData extends RowData>(props: DataGridCellProps<TData>) {
  const { cell, rowHeight, isEditing, readOnly } = props
  const value = getOptionCellValue(useCellValue(cell))
  const containerRef = useRef<HTMLDivElement>(null)
  const commandRef = useRef<HTMLDivElement>(null)
  const options = getColumnVariantOptions(cell.column, "select")?.options ?? NO_OPTIONS

  const onValueChange = (newValue: string) => {
    if (readOnly) return
    cell.setValue(newValue)
    cell.table.stopEditing()
  }

  const onOpenFocus = () => {
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
  // Local change: the values are kept while the cell's value is the same array, as upstream's memo kept them: the draft
  // below holds only while its key, this array, is the same.
  const cellValue = optionValuesOf(useCellValue(cell))

  const cellKey = getCellKey(rowId, columnId)

  const {
    value: selectedValues,
    setDraftValue: setDraftValues,
    clearDraft
  } = useCellDraft(optionDrafts, { key: cellValue, fallback: cellValue })
  const {
    value: searchValue,
    setDraftValue: onSearchValueChange,
    clearDraft: clearSearch
  } = useCellDraft(textDrafts, { key: cellKey, fallback: "" })
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const options = getColumnVariantOptions(cell.column, "multi-select")?.options ?? NO_OPTIONS

  const commitValues = (newValues: string[]) => {
    setDraftValues(newValues)
    queueMicrotask(() => {
      cell.setValue(newValues)
      clearDraft()
      inputRef.current?.focus()
    })
  }

  const onValueChange = (value: string) => {
    if (readOnly) return
    commitValues(
      selectedValues.includes(value) ? selectedValues.filter((v) => v !== value) : [...selectedValues, value]
    )
    clearSearch()
  }

  const removeValue = (valueToRemove: string, event?: MouseEvent) => {
    if (readOnly) return
    event?.stopPropagation()
    event?.preventDefault()
    commitValues(selectedValues.filter((v) => v !== valueToRemove))
  }

  const clearAll = () => {
    if (readOnly) return
    clearDraft()
    cell.setValue([])
    queueMicrotask(() => inputRef.current?.focus())
  }

  const onOpenChange = (open: boolean) => {
    if (!open) clearSearch()
    setCellEditing(cell, open, readOnly)
  }

  const onOpenFocus = () => {
    inputRef.current?.focus()
  }

  const onCommit = (options?: StopEditingOptions) => {
    clearSearch()
    cell.table.stopEditing(options)
  }

  const onCancel = () => {
    clearDraft()
    clearSearch()
    cell.table.stopEditing()
  }

  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
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

  const onDateSelect = (date: Date | undefined) => {
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
  // Local change: the files are kept while the cell's value is the same array, as upstream's memo kept them: the error
  // below holds only while its key, this array, is the same.
  const cellValue = filesOf(useCellValue(cell))

  const fileMeta = getColumnVariantOptions(cell.column, "file")
  const maxFileSize = fileMeta?.maxFileSize ?? 10 * 1024 * 1024
  const maxFiles = fileMeta?.maxFiles ?? 10
  const accept = fileMeta?.accept
  const multiple = fileMeta?.multiple ?? false

  const {
    value: uploadingFiles,
    setDraftValue: setUploadingFiles,
    clearDraft: clearUploadingFiles
  } = useCellDraft(uploadDrafts, { key: cellKey, fallback: null })
  const [deletingIds, setDeletingIds] = useAtom(deletingFiles(useId()))
  const {
    value: error,
    setDraftValue: setError,
    clearDraft: clearError
  } = useCellDraft(errorDrafts, { key: cellValue, fallback: null })
  // Local change: the error's two seconds are a `oneTimer`, cleared when the cell leaves the screen (upstream's
  // timeout, cleared by an effect's cleanup).
  const errorTimer = useAtomValue(oneTimer(useId()))

  const files = uploadingFiles ? [...cellValue, ...uploadingFiles] : cellValue
  const uploadingIds = new Set(uploadingFiles?.map((file) => file.id))
  const isPending = uploadingFiles !== null || deletingIds.size > 0

  const acceptedTypes = accept ? accept.split(",").map((t) => t.trim()) : null

  const flashError = (message: string, toastOptions?: ExternalToast) => {
    setError(message)
    toast(message, toastOptions)
    errorTimer.start(clearError, 2000)
  }

  const addFiles = async (newFiles: File[]) => {
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
      // Local change: `settle` where upstream has a `try` statement; a refused upload says why, as upstream's did.
      // Called on the options, as upstream called it.
      const uploaded = await settle(
        () =>
          uploadFiles.call(options, {
            files: accepted.map(({ file }) => file),
            rowId,
            columnId
          }),
        (error) =>
          error instanceof Error
            ? error.message
            : `Failed to upload ${accepted.length} file${accepted.length !== 1 ? "s" : ""}`
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
  }

  const deleteFiles = async (fileIds: string[]) => {
    if (readOnly || isPending) return
    clearError()

    const filesToDelete = cellValue.filter((file) => fileIds.includes(file.id))
    if (filesToDelete.length === 0) return

    const idsToDelete = new Set(filesToDelete.map((file) => file.id))
    setDeletingIds(idsToDelete)

    const options = cell.table.options
    const deleteFiles = options.deleteFiles
    if (deleteFiles) {
      // Local change: `settle` where upstream has a `try` statement; a refused delete says why, as upstream's did.
      // Called on the options, as upstream called it.
      const deleted = await settle(
        () =>
          deleteFiles.call(options, {
            fileIds: [...idsToDelete],
            rowId,
            columnId
          }),
        (error) =>
          error instanceof Error
            ? error.message
            : filesToDelete.length === 1
              ? `Failed to delete ${filesToDelete[0]?.name}`
              : "Failed to delete files"
      )
      if (Result.isFailure(deleted)) {
        toast.error(deleted.failure)
        setDeletingIds(new Set())
        return
      }
    }

    cell.setValue(getFilesCellValue(cell.getValue()).filter((file) => !idsToDelete.has(file.id)))
    setDeletingIds(new Set())
  }

  const containerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropzoneRef = useRef<HTMLDivElement>(null)

  const onDropFiles = (droppedFiles: File[]) => void addFiles(droppedFiles)

  const { isDragActive: isDraggingOver, dropTargetProps: cellDropProps } = useFileDropTarget(onDropFiles)
  const { isDragActive: isDragging, dropTargetProps: dropzoneDropProps } = useFileDropTarget(onDropFiles)

  const onDropzoneClick = () => {
    fileInputRef.current?.click()
  }

  const onDropzoneKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      onDropzoneClick()
    }
  }

  const onFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? [])
    void addFiles(selectedFiles)
    event.target.value = ""
  }

  const onOpenChange = (open: boolean) => {
    clearError()
    setCellEditing(cell, open, readOnly)
  }

  const onOpenFocus = () => {
    queueMicrotask(() => {
      dropzoneRef.current?.focus()
    })
  }

  const onCancel = () => {
    clearError()
    cell.table.stopEditing()
  }

  const onWrapperKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
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
          onEscapeKeyDown={stopPropagation}
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
                    onClick={() => void deleteFiles(cellValue.map((file) => file.id))}
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
                          onClick={() => void deleteFiles([file.id])}
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
  const onEditorOpenChange = (nextOpen: boolean) => {
    if (onOpenChange) {
      onOpenChange(nextOpen)
    } else {
      setCellEditing(cell, nextOpen, readOnly)
    }
  }

  const { onPointerDownOutside, onCloseAutoFocus } = getCellEditorDismiss(containerRef)

  const onOpenAutoFocus = (event: Event) => {
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

function useEditableText<TData extends RowData>({
  cell,
  isEditing,
  readOnly,
  parse = parsePlainText
}: UseEditableTextOptions<TData>) {
  const initialValue = getTextCellValue(useCellValue(cell))
  const { value, setDraftValue, clearDraft } = useCellDraft(textDrafts, {
    key: initialValue,
    fallback: initialValue,
    enabled: isEditing
  })
  const textRef = useRef<HTMLDivElement>(null)
  const kept = useAtomValue(editorKept(useId()))

  // Local change: one ref callback for the two effects upstream ran on the text. While the cell is not edited, the text
  // shows the value (upstream's layout effect on the value and `isEditing`), so the callback changes with the value.
  // When the editing starts, the text takes the focus with the value in it, selected when a key opened the editor, so
  // the browser types the key over it (see `typesInPlace` in data-grid-cell.tsx), else with the caret after it; when
  // it ends, the text scrolls back to its start (upstream's effect, which acted only when `isEditing` changed). So the
  // callback stays the same while the cell is edited, however the typed value changes.
  const textRefCallback = kept.ref(isEditing ? [true] : [false, initialValue], () =>
    isEditing
      ? (element: HTMLDivElement | null) => {
          textRef.current = element
          if (element === null) return
          element.focus()

          if (!element.textContent && value) {
            element.textContent = value
          }

          if (getPendingChar(cell)) {
            selectEditableText(element)
          } else if (element.textContent) {
            moveCaretToEnd(element)
          }
          return () => {
            textRef.current = null
          }
        }
      : (element: HTMLDivElement | null) => {
          textRef.current = element
          if (element === null) return
          if (element.textContent !== initialValue) {
            element.textContent = initialValue
          }
          element.scrollLeft = 0
          return () => {
            textRef.current = null
          }
        }
  )

  const onSave = (options?: StopEditingOptions) => {
    const value = parse(textRef.current?.textContent ?? "")
    if (!readOnly && value !== parse(initialValue)) {
      cell.setValue(value)
    }
    clearDraft()
    cell.table.stopEditing(options)
  }

  const onBlur = () => onSave()

  const onInput = (event: InputEvent<HTMLDivElement>) => {
    setDraftValue(event.currentTarget.textContent ?? "")
  }

  const onCancel = () => {
    clearDraft()
    const element = textRef.current
    if (!element) return
    // Blurring saves the DOM text, so the typed text is undone first.
    element.textContent = initialValue
    element.blur()
  }

  return {
    value,
    onCommit: onSave,
    onCancel,
    textProps: {
      ref: textRefCallback,
      isEditing,
      label: getColumnLabel(cell.column),
      value,
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
  value: string
}

function EditableText({ isEditing, label, value, className, ...props }: EditableTextProps) {
  return (
    <div
      role={isEditing ? "textbox" : undefined}
      aria-label={isEditing ? label : undefined}
      data-slot="data-grid-cell-content"
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
      {isEditing ? "" : value}
    </div>
  )
}

/**
 * What one editor on screen keeps between draws, where upstream kept refs that were not DOM nodes: whether the edit is
 * being cancelled, the value Escape puts back, and its ref callback, made again only when what it closes over changes.
 */
interface EditorKept {
  readonly cancelling: () => boolean
  readonly setCancelling: (cancelling: boolean) => void
  readonly startValue: () => string
  readonly setStartValue: (value: string) => void
  readonly ref: <T>(deps: ReadonlyArray<unknown>, make: () => RefCallback<T>) => RefCallback<T>
}

/**
 * An editor's `EditorKept`, made for each instance (its `useId`); read it with `useAtomValue` to keep it. It is let go
 * the moment nobody reads it, so a cell drawn again for another row starts afresh, as upstream's refs did.
 */
const editorKept = Atom.family((_instance: string) =>
  Atom.readable((): EditorKept => {
    let cancelling = false
    let startValue = ""
    let kept: { readonly deps: ReadonlyArray<unknown>; readonly ref: RefCallback<any> } | undefined
    return {
      cancelling: () => cancelling,
      setCancelling: (next) => {
        cancelling = next
      },
      startValue: () => startValue,
      setStartValue: (next) => {
        startValue = next
      },
      ref: (deps, make) => {
        if (
          kept !== undefined &&
          kept.deps.length === deps.length &&
          kept.deps.every((dep, index) => Object.is(dep, deps[index]))
        ) {
          return kept.ref
        }
        const ref = make()
        kept = { deps, ref }
        return ref
      }
    }
  }).pipe(Atom.setIdleTTL(0))
)

/** A draft typed into one cell: its value holds only while the cell's value it was typed over (its key) is the same. */
interface CellDraft<TValue> {
  readonly key: unknown
  readonly value: TValue
}

/** The drafts of one kind of value, one atom for each cell on screen (its `useId`). */
function cellDrafts<TValue>() {
  return Atom.family((_instance: string) => Atom.make<CellDraft<TValue> | null>(null))
}

type CellDrafts<TValue> = ReturnType<typeof cellDrafts<TValue>>

const textDrafts = cellDrafts<string>()
const optionDrafts = cellDrafts<string[]>()
const uploadDrafts = cellDrafts<FileCellData[] | null>()
const errorDrafts = cellDrafts<string | null>()

/** The files one file cell on screen is removing, made for each instance (its `useId`). */
const deletingFiles = Atom.family((_instance: string) => Atom.make<Set<string>>(new Set<string>()))

/** Whether files are dragged over one drop target on screen, made for each instance (its `useId`). */
const fileDragActive = Atom.family((_instance: string) => Atom.make(false))

interface UseCellDraftOptions<TValue> {
  key: unknown
  fallback: TValue
  enabled?: boolean
}

function useCellDraft<TValue>(
  drafts: CellDrafts<TValue>,
  { key, fallback, enabled = true }: UseCellDraftOptions<TValue>
) {
  const [draft, setDraft] = useAtom(drafts(useId()))
  const value = enabled && draft !== null && draft.key === key ? draft.value : fallback

  const setDraftValue = (newValue: TValue) => setDraft({ key, value: newValue })

  const clearDraft = () => setDraft(null)

  return { value, setDraftValue, clearDraft }
}

// What a cell's value holds, kept while that value is the same object, as upstream's memo on it kept it: a draft keyed
// by it holds only while it is the same array.
const NO_OPTION_VALUES: string[] = []
const optionValuesKept = new WeakMap<object, string[]>()

function optionValuesOf(value: unknown): string[] {
  if (typeof value !== "object" || value === null) return NO_OPTION_VALUES
  const kept = optionValuesKept.get(value)
  if (kept !== undefined) return kept
  const values = getOptionsCellValue(value)
  optionValuesKept.set(value, values)
  return values
}

const NO_FILES: FileCellData[] = []
const filesKept = new WeakMap<object, FileCellData[]>()

function filesOf(value: unknown): FileCellData[] {
  if (typeof value !== "object" || value === null) return NO_FILES
  const kept = filesKept.get(value)
  if (kept !== undefined) return kept
  const files = getFilesCellValue(value)
  filesKept.set(value, files)
  return files
}

// Local change: a plain function where upstream had a hook of two memoised callbacks; both go to Radix, which keeps
// its own handlers by reference.
function getCellEditorDismiss(containerRef: RefObject<HTMLDivElement | null>) {
  const onPointerDownOutside = (event: Event) => {
    const container = containerRef.current
    if (event.target instanceof Node && container?.contains(event.target)) {
      event.preventDefault()
    }
  }

  const onCloseAutoFocus = (event: Event) => {
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

function onEditingCellMouseDown(event: MouseEvent) {
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

  const onDragEnter = (event: DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    if (event.dataTransfer.types.includes("Files")) {
      setIsDragActive(true)
    }
  }

  const onDragLeave = (event: DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    if (getIsDragLeaving(event)) setIsDragActive(false)
  }

  const onDrop = (event: DragEvent) => {
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

function getIsDragLeaving(event: DragEvent) {
  const rect = event.currentTarget.getBoundingClientRect()
  const x = event.clientX
  const y = event.clientY
  return x <= rect.left || x >= rect.right || y <= rect.top || y >= rect.bottom
}

function onFileDragOver(event: DragEvent) {
  event.preventDefault()
  event.stopPropagation()
}

function toastDangerousUrl() {
  toast.error("Invalid URL", {
    description: "URL contains a dangerous protocol (javascript:, data:, vbscript:, or file:)"
  })
}

// Local change: one handler where upstream memoised the same body in each cell.
function stopPropagation(event: { readonly stopPropagation: () => void }) {
  event.stopPropagation()
}
