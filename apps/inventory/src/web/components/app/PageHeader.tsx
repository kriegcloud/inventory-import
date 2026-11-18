import type { ReactNode } from "react"
import { Skeleton } from "@/components/ui/skeleton"

/** The grey line under a page's title while the fact it states is on its way: as tall as that line. */
export function LineSkeleton() {
  return (
    <div className="mt-0.5 flex h-5 items-center">
      <Skeleton className="h-3.5 w-24" />
    </div>
  )
}

/**
 * The top of a screen: the job as the `h1`, one grey line of facts under it, and the actions at the right. `line`
 * is "loading" while its fact is on its way, so the line's place is kept and the table under it does not move. The
 * title asks for 15rem before the actions may sit beside it: on a phone the actions go under it instead of cutting
 * it short.
 */
export function PageHeader(props: { title: string; line?: ReactNode | "loading"; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 px-4 pt-5 pb-3 sm:px-9">
      <div className="min-w-0 flex-1 basis-60">
        <h1 className="truncate text-xl font-semibold tracking-tight">{props.title}</h1>
        {props.line === undefined ? null : props.line === "loading" ? (
          <LineSkeleton />
        ) : (
          <p className="mt-0.5 truncate text-sm text-muted-foreground tabular-nums">{props.line}</p>
        )}
      </div>
      {props.actions === undefined ? null : <div className="flex flex-wrap items-center gap-2">{props.actions}</div>}
    </div>
  )
}

/** A row of saved views ("All 178", "Ready 137"): each a ghost button that says whether it is the one showing. */
export function Views(props: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={props.label} className="flex flex-wrap gap-1 px-4 pb-2 sm:px-8">
      {props.children}
    </div>
  )
}
