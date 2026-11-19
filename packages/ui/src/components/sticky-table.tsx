import * as React from "react"
import { cn } from "cn"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@inventory/ui/components/table"

/*
 * Local addition, built on `table.tsx`: a dense table that scrolls inside its own frame with the header row, the
 * first column and the last column pinned. Lines are drawn on the cells because pinned cells lose a collapsed border:
 * row rules at full strength, column rules at half, so the eye runs along a row. 36px rows and 13px text (from
 * `index.css`) match the product's own tables. Feature code passes data and layout only; the look lives here.
 */

const lines = "border-b [border-left-color:color-mix(in_oklch,var(--color-border)_50%,transparent)]"
const body = `h-(--row) py-0 group-has-aria-expanded/row:bg-muted ${lines}`
const start = "sticky left-0 z-10 bg-background shadow-[inset_-1px_0_var(--color-border)]"
const end = "sticky right-0 z-10 border-l-0 bg-background pl-1.5 shadow-[inset_1px_0_var(--color-border)]"

/*
 * Local addition: where the table sits. On the page its first and last cells carry the page's gutter; inside a card
 * (`framed` on the frame) the card's edge is the gutter, and the cells keep a cell's own padding.
 */
const Inset = React.createContext<"page" | "card">("page")
const gutter = {
  page: { start: "pl-4 sm:pl-9", end: "pr-4 sm:pr-8", band: "pr-4 pl-4 sm:pr-8 sm:pl-9" },
  card: { start: "pl-3", end: "pr-3", band: "px-3" }
} as const

/** The scrolling frame: a focusable region so arrow keys reach every row and column. */
function StickyTableFrame({
  className,
  label,
  framed,
  ...props
}: React.ComponentProps<"div"> & { label: string; framed?: boolean }) {
  return (
    <Inset value={framed === true ? "card" : "page"}>
      <div
        data-slot="sticky-table-frame"
        role="region"
        aria-label={label}
        tabIndex={0}
        className={cn(
          "@container relative min-h-0 flex-1 overflow-auto overscroll-contain outline-none [scrollbar-width:thin] focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset [&>[data-slot=table-container]]:overflow-visible",
          framed !== true && "border-y",
          className
        )}
        {...props}
      />
    </Inset>
  )
}

/** `widths` are pixels per column; `undefined` lets that column take what is left. */
function StickyTable({
  caption,
  widths,
  minWidth,
  rowHeight = 36,
  rowCount,
  children
}: {
  caption: string
  widths: ReadonlyArray<number | undefined>
  minWidth: number
  rowHeight?: number
  rowCount: number
  children: React.ReactNode
}) {
  return (
    <Table
      data-slot="sticky-table"
      aria-rowcount={rowCount}
      className="table-fixed border-separate border-spacing-0 text-table"
      style={{ minWidth, "--row": `${rowHeight}px` } as React.CSSProperties}
    >
      <TableCaption className="sr-only">{caption}</TableCaption>
      <colgroup>
        {widths.map((width, index) => (
          <col key={index} style={width === undefined ? undefined : { width }} />
        ))}
      </colgroup>
      {children}
    </Table>
  )
}

function StickyTableRow({ className, ...props }: React.ComponentProps<typeof TableRow>) {
  return (
    <TableRow className={cn("group/row hover:bg-transparent has-aria-expanded:bg-transparent", className)} {...props} />
  )
}

/** `flush` drops the cell's own padding, for a header that is one control filling the cell (a sort menu). */
function StickyTableColumn({
  className,
  pin,
  align,
  flush,
  ...props
}: React.ComponentProps<typeof TableHead> & {
  pin?: "start" | "end" | undefined
  align?: "right" | undefined
  flush?: boolean
}) {
  const inset = gutter[React.useContext(Inset)]
  return (
    <TableHead
      scope="col"
      className={cn(
        "sticky top-0 z-20 bg-background",
        lines,
        // Before the pinned classes: a pinned first column keeps its gutter on the left and is flush on the right.
        flush === true && "p-0",
        pin === "start" && `left-0 z-30 shadow-[inset_-1px_0_var(--color-border)] ${inset.start}`,
        pin === "end" && "right-0 z-30 border-l-0 shadow-[inset_1px_0_var(--color-border)]",
        align === "right" && "text-right",
        className
      )}
      {...props}
    />
  )
}

/** The record's name: the row's header, pinned at the start. `grouped` marks a row that sits under a band. */
function StickyTableRowHeader({
  className,
  tone,
  grouped,
  ...props
}: React.ComponentProps<typeof TableHead> & { tone?: "danger" | undefined; grouped?: boolean }) {
  const inset = gutter[React.useContext(Inset)]
  return (
    <TableHead
      scope="row"
      className={cn(
        body,
        start,
        inset.start,
        "font-semibold text-foreground",
        grouped === true && "shadow-[inset_-1px_0_var(--color-border),inset_3px_0_var(--color-input)]",
        tone === "danger" && "bg-danger/25",
        className
      )}
      {...props}
    />
  )
}

function StickyTableCell({
  className,
  pin,
  align,
  tone,
  ...props
}: React.ComponentProps<typeof TableCell> & { pin?: "end"; align?: "right" | undefined; tone?: "danger" | undefined }) {
  const inset = gutter[React.useContext(Inset)]
  return (
    <TableCell
      className={cn(
        body,
        pin === "end" && end,
        pin === "end" && inset.end,
        align === "right" && "text-right",
        tone === "danger" && "bg-danger/25",
        className
      )}
      {...props}
    />
  )
}

/**
 * A full-width band between rows: the heading of a group, with its own action. Local additions: `quiet` draws it on
 * the page's own background with no fixed height, for a row's detail opened under it; `end` puts the band's answers
 * in a cell of their own under the pinned actions column, so they line up with the rows' answers and stay in view
 * when the table scrolls sideways, and lets the band grow to two lines.
 */
function StickyTableBand({
  span,
  quiet,
  end: answers,
  children,
  ...props
}: React.ComponentProps<typeof TableRow> & { span: number; quiet?: boolean; end?: React.ReactNode }) {
  const inset = gutter[React.useContext(Inset)]
  if (answers !== undefined) {
    return (
      <TableRow className="hover:bg-transparent" {...props}>
        <TableCell colSpan={span - 1} className={cn("border-b bg-muted py-2 whitespace-normal", inset.band)}>
          {children}
        </TableCell>
        <TableCell className={cn(end, "border-b bg-muted py-2 align-top", inset.end)}>{answers}</TableCell>
      </TableRow>
    )
  }
  return (
    <TableRow className="hover:bg-transparent" {...props}>
      <TableCell
        colSpan={span}
        className={cn("border-b py-0", inset.band, quiet === true ? "bg-background whitespace-normal" : "h-9 bg-muted")}
      >
        {/* A band never widens the table: what does not fit on its one line is cut, not scrolled to. */}
        <div className="overflow-hidden">{children}</div>
      </TableCell>
    </TableRow>
  )
}

/**
 * One cell across the table: a message when there is nothing to show (`height` unset), or a spacer for virtual rows.
 * The message is centred in the part of the table on screen, not in the table's full width.
 */
function StickyTableFill({ span, height, children }: { span: number; height?: number; children?: React.ReactNode }) {
  return (
    <TableRow aria-hidden={height === undefined ? undefined : true} className="hover:bg-transparent">
      <TableCell
        colSpan={span}
        className={height === undefined ? "h-24 p-0 whitespace-normal text-muted-foreground" : "border-0 p-0"}
        style={height === undefined ? undefined : { height }}
      >
        {height === undefined ? (
          // As wide as the frame and held at its left edge, so the sentence is read whole however far the table's
          // columns run past the screen.
          <div className="sticky left-0 w-[100cqi] px-4 text-center">{children}</div>
        ) : (
          children
        )}
      </TableCell>
    </TableRow>
  )
}

export {
  StickyTable,
  StickyTableBand,
  StickyTableCell,
  StickyTableColumn,
  StickyTableFill,
  StickyTableFrame,
  StickyTableRow,
  StickyTableRowHeader,
  TableBody as StickyTableBody,
  TableHeader as StickyTableHeader
}
