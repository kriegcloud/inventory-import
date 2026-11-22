// Local change: React is imported by name, so the atoms lint reads this file (goals/atoms, "The kit on atoms", batch 2); no longer as its registry has it.
import type { Cell, ColumnPinningPosition, RowData } from "@tanstack/react-table"

import { cn } from "cn"
import type { ReactNode } from "react"

import * as Match from "effect/Match"
import type { DataGridFeatures } from "@inventory/ui/components/data-grid/data-grid-features"
import type { RowHeightValue } from "@inventory/ui/components/data-grid/data-grid-types"

import { getBadgeOverflow } from "@inventory/ui/components/data-grid/use-badge-overflow"
import {
  CELL_TINTS,
  formatDateForDisplay,
  formatNumberForDisplay,
  getBooleanCellValue,
  getCellLayoutStyle,
  getDateCellValue,
  getFileIcon,
  getFilesCellValue,
  getLineCount,
  getNumberCellValue,
  getOptionCellValue,
  getOptionsCellValue,
  getTextCellValue,
  getUrlHref,
  parseLocalDate
} from "@inventory/ui/components/data-grid/data-grid-utils"
import { useCellValue } from "@inventory/ui/components/data-grid/data-grid-cell"
import { badgeVariants } from "@inventory/ui/components/badge"
import { Check } from "lucide-react"

const BADGE_CLASS_NAME = cn(badgeVariants({ variant: "secondary" }), "mt-0.5 mb-px h-4.25 px-1.5 py-0")
const OVERFLOW_BADGE_CLASS_NAME = cn(
  badgeVariants({ variant: "outline" }),
  "mt-0.5 mb-px h-4.25 px-1.5 py-0 text-muted-foreground"
)
const BADGE_LIST_CLASS_NAME = "flex flex-wrap content-start items-center gap-x-1 overflow-hidden"

const LINE_CLAMP_CLASS_NAMES: Record<RowHeightValue, string> = {
  short: "block truncate",
  medium: "line-clamp-2",
  tall: "line-clamp-3",
  "extra-tall": "line-clamp-4"
}

interface DataGridCellPreviewProps<TData extends RowData> {
  cell: Cell<DataGridFeatures, TData>
  columnIndex: number
  width: number
  rowHeight: RowHeightValue
  isSelected: boolean
  isSearchMatch: boolean
  isActiveSearchMatch: boolean
  readOnly: boolean
  pinned: ColumnPinningPosition
  pinnedOffset: number
  grow: boolean
  showStartBorder: boolean
  showEndBorder: boolean
}

export function DataGridCellPreview<TData extends RowData>({
  cell,
  columnIndex,
  width,
  rowHeight,
  isSelected,
  isSearchMatch,
  isActiveSearchMatch,
  readOnly,
  pinned,
  pinnedOffset,
  grow,
  showStartBorder,
  showEndBorder
}: DataGridCellPreviewProps<TData>) {
  const value = useCellValue(cell)
  const { className, content } = getPreviewContent({
    cell,
    value,
    width,
    rowHeight
  })
  const columnId = cell.column.id
  const isTinted = isSelected || isSearchMatch || isActiveSearchMatch

  return (
    <div
      role="gridcell"
      aria-colindex={columnIndex + 1}
      aria-selected={isSelected}
      aria-readonly={readOnly || undefined}
      data-slot="data-grid-cell"
      data-preview=""
      data-row-id={cell.row.id}
      data-column-id={columnId}
      className={cn("h-full cursor-default px-2 pt-1.75 pb-2 text-start text-sm", className, {
        grow,
        "border-s": showStartBorder,
        "border-e": showEndBorder,
        "bg-background": !isTinted,
        [CELL_TINTS.tinted]: isTinted,
        [CELL_TINTS.selected]: isSelected,
        [CELL_TINTS.activeSearchMatch]: isActiveSearchMatch && !isSelected,
        [CELL_TINTS.searchMatch]: isSearchMatch && !isActiveSearchMatch && !isSelected,
        [CELL_TINTS.darkActiveSearchMatch]: isActiveSearchMatch,
        [CELL_TINTS.darkSearchMatch]: isSearchMatch && !isActiveSearchMatch
      })}
      style={getCellLayoutStyle({ width, pinned, pinnedOffset })}
    >
      {content}
    </div>
  )
}

type CellPreview = {
  className?: string
  content: ReactNode
}

function getPreviewContent<TData extends RowData>({
  cell,
  value,
  width,
  rowHeight
}: Pick<DataGridCellPreviewProps<TData>, "cell" | "width" | "rowHeight"> & {
  value: unknown
}): CellPreview {
  const meta = cell.column.columnDef.meta
  const lineClampClassName = cn("w-fit max-w-full wrap-anywhere", LINE_CLAMP_CLASS_NAMES[rowHeight])

  return Match.value(meta).pipe(
    Match.when({ variant: "boolean" }, (meta): CellPreview => {
      const isChecked = getBooleanCellValue(value)

      if (meta.control === "switch") {
        return {
          className: "flex justify-center pt-2.5",
          content: (
            <span
              data-checked={isChecked ? "" : undefined}
              data-unchecked={isChecked ? undefined : ""}
              className="group inline-flex h-[14px] w-[24px] shrink-0 items-center rounded-full border border-transparent data-checked:bg-primary data-unchecked:bg-input dark:data-unchecked:bg-input/80"
            >
              <span className="block size-3 rounded-full bg-background group-data-checked:translate-x-[calc(100%-2px)] rtl:group-data-checked:-translate-x-[calc(100%-2px)] dark:group-data-checked:bg-primary-foreground dark:group-data-unchecked:bg-foreground" />
            </span>
          )
        }
      }

      return {
        className: "flex justify-center pt-2.5",
        content: (
          <span
            data-checked={isChecked ? "" : undefined}
            className="flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-primary dark:bg-input/30 data-checked:bg-primary data-checked:text-primary-foreground dark:data-checked:bg-primary [&>svg]:size-3.5"
          >
            {isChecked ? <Check /> : null}
          </span>
        )
      }
    }),
    Match.when({ variant: "select" }, (meta): CellPreview => {
      const selectedValue = getOptionCellValue(value)
      const label = meta.options.find((option) => option.value === selectedValue)?.label ?? selectedValue

      return {
        content: label ? (
          <span dir="auto" className={cn(BADGE_CLASS_NAME, "h-auto whitespace-pre-wrap", lineClampClassName)}>
            {label}
          </span>
        ) : null
      }
    }),
    Match.when({ variant: "multi-select" }, (meta): CellPreview => {
      const values = getOptionsCellValue(value)
      if (values.length === 0) return { content: null }

      const labels = values.map((item) => meta.options.find((option) => option.value === item)?.label ?? item)
      const { visibleItems, hiddenCount } = getBadgeOverflow({
        items: labels,
        getLabel: (label) => label,
        containerWidth: width,
        lineCount: getLineCount(rowHeight)
      })

      return {
        className: BADGE_LIST_CLASS_NAME,
        content: (
          <>
            {visibleItems.map((label, index) => (
              <span
                key={values[index]}
                className={cn(
                  BADGE_CLASS_NAME,
                  "max-w-full",
                  hiddenCount > 0 && index === visibleItems.length - 1 && "max-w-[calc(100%-2.75rem)]"
                )}
              >
                <span dir="auto" className="truncate">
                  {label}
                </span>
              </span>
            ))}
            {hiddenCount > 0 && (
              <span dir="ltr" className={OVERFLOW_BADGE_CLASS_NAME}>
                +{hiddenCount}
              </span>
            )}
          </>
        )
      }
    }),
    Match.when({ variant: "file" }, (): CellPreview => {
      const files = getFilesCellValue(value)
      if (files.length === 0) return { content: null }

      const { visibleItems, hiddenCount } = getBadgeOverflow({
        items: files,
        getLabel: (file) => file.name,
        containerWidth: width,
        lineCount: getLineCount(rowHeight),
        cacheKeyPrefix: "file",
        iconSize: 12,
        maxWidth: 100
      })

      return {
        className: BADGE_LIST_CLASS_NAME,
        content: (
          <>
            {visibleItems.map((file) => {
              const FileIcon = getFileIcon(file.type)
              return (
                <span key={file.id} className={cn(BADGE_CLASS_NAME, "gap-1")}>
                  {FileIcon && <FileIcon className="size-3 shrink-0" />}
                  <span dir="auto" className="max-w-25 truncate">
                    {file.name}
                  </span>
                </span>
              )
            })}
            {hiddenCount > 0 && (
              <span dir="ltr" className={OVERFLOW_BADGE_CLASS_NAME}>
                +{hiddenCount}
              </span>
            )}
          </>
        )
      }
    }),
    Match.when({ variant: "date" }, (): CellPreview => {
      const date = getDateCellValue(value)
      return {
        content: (
          <div
            dir="auto"
            data-invalid={date && !parseLocalDate(date) ? "" : undefined}
            className={cn(lineClampClassName, "data-invalid:text-destructive")}
          >
            {formatDateForDisplay(date)}
          </div>
        )
      }
    }),
    Match.when({ variant: "url" }, (): CellPreview => {
      const url = getTextCellValue(value)
      if (!url) return { content: null }

      return {
        content: (
          <div dir="auto" className={cn("size-full overflow-hidden", lineClampClassName)}>
            <span
              data-invalid={getUrlHref(url) ? undefined : ""}
              className="truncate text-primary underline decoration-primary/30 underline-offset-2 data-invalid:text-destructive data-invalid:decoration-destructive/50"
            >
              {url}
            </span>
          </div>
        )
      }
    }),
    Match.when({ variant: "number" }, (meta): CellPreview => {
      const number = getNumberCellValue(value)
      return {
        content: (
          <div dir="auto" className={cn(lineClampClassName, "tabular-nums")}>
            {number === null ? "" : formatNumberForDisplay(number, meta.format)}
          </div>
        )
      }
    }),
    Match.orElse((): CellPreview => {
      return {
        content: (
          <div dir="auto" className={lineClampClassName}>
            {getTextCellValue(value)}
          </div>
        )
      }
    })
  )
}
