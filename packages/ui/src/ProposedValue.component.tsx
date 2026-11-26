import * as O from "effect/Option"
import { ArrowRightIcon, CheckIcon, CircleHelpIcon, SparklesIcon } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "cn"
import { Tooltip, TooltipContent, TooltipTrigger } from "@inventory/ui/components/tooltip"
import { type ProposalSource, sourceWordsFor } from "@inventory/ui/ProposalSource"

export type { ProposalSource } from "@inventory/ui/ProposalSource"

/**
 * The mark beside a proposed value that says who is behind it, with the words on hover and for a screen reader: a
 * sparkle for a model, a question mark for a suggestion whose source the caller did not name, and nothing to see for a
 * fixed rule (its words are still read out). The words come from the source the caller passes, never assumed.
 */
export function SourceMark(props: { source: ProposalSource | undefined }) {
  const words = sourceWordsFor(O.fromUndefinedOr(props.source))
  if (props.source === "rule" || props.source === "person") return <span className="sr-only"> ({words.hidden})</span>
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex shrink-0 items-center">
          {props.source === "model" ? (
            <SparklesIcon aria-hidden className="size-3" />
          ) : (
            <CircleHelpIcon aria-hidden className="size-3" />
          )}
          <span className="sr-only"> ({words.hidden})</span>
        </span>
      </TooltipTrigger>
      <TooltipContent>{words.tip}</TooltipContent>
    </Tooltip>
  )
}

/**
 * The new value of a change, in one of its states. `proposed` is not applied yet: an outlined chip, no colour.
 * `accepted` is what the person took: green with a tick. Never colour alone: the outline, the tick and the hidden
 * word differ too.
 */
export function ProposedChip(props: { children: ReactNode; state?: "proposed" | "accepted" }) {
  return props.state === "accepted" ? (
    <span className="inline-flex h-5 max-w-full min-w-0 items-center gap-1 rounded-chip bg-success px-1.5 font-medium text-success-foreground">
      <span className="truncate">{props.children}</span>
      <CheckIcon aria-hidden className="size-3 shrink-0" />
    </span>
  ) : (
    // In a cell too narrow for it the chip ends in an ellipsis instead of being cut through its outline.
    <span className="inline-flex h-5 max-w-full min-w-0 items-center gap-1 rounded-chip border border-input bg-background px-1.5 font-medium">
      <span className="truncate">{props.children}</span>
    </span>
  )
}

/**
 * A change shown in place: the file's value struck through and the value that would be imported beside it. Real
 * `<del>` and `<ins>`, with hidden "was" and "now" because most screen readers do not announce those elements.
 * It only shows the change; accepting or rejecting happens in a row action or a group heading.
 *
 * `state` picks the look a review table uses: `proposed` waits for the person (an outlined chip after an arrow),
 * `applied` is in force (plain, with a check). With `state`, the value carries its source's mark (`SourceMark`): a
 * sparkle only when the caller says a model made it.
 */
export function ProposedValue(props: {
  from: ReactNode
  to: ReactNode
  /**
   * Who prepared the change, as the caller knows it. Without `state`: a small label after the new value. With it: the
   * source's mark. Left out, nothing is said about who made it.
   */
  source?: ProposalSource
  /** `proposed` waits for the person, `accepted` is what they took, `applied` is what a rule did by itself. */
  state?: "proposed" | "applied" | "accepted"
  className?: string
}) {
  const mark = props.source === undefined ? null : <SourceMark source={props.source} />
  return (
    <span className={cn("inline-flex max-w-full min-w-0 flex-wrap items-center gap-x-1.5", props.className)}>
      {/* Short of room, the old value is the part that is cut; the new one stays whole. */}
      <del
        className="min-w-0 truncate text-muted-foreground decoration-muted-foreground/70"
        // Cut short in a narrow cell, the old value is still one hover away.
        title={typeof props.from === "string" ? props.from : undefined}
      >
        <span className="sr-only">was </span>
        {props.from}
      </del>
      {props.state === undefined ? (
        <ins className="underline decoration-foreground/40 underline-offset-2">
          <span className="sr-only">now </span>
          {props.to}
        </ins>
      ) : props.state === "applied" ? (
        <ins className="inline-flex items-center gap-1 no-underline">
          <span className="sr-only">now </span>
          {props.to}
          <CheckIcon aria-hidden className="size-3 shrink-0 text-muted-foreground" />
          {mark}
        </ins>
      ) : (
        <>
          <ArrowRightIcon aria-hidden className="size-3 shrink-0 text-muted-foreground" />
          <ins className="shrink-0 no-underline">
            <span className="sr-only">{props.state === "accepted" ? "accepted " : "proposed "}</span>
            <ProposedChip state={props.state}>
              {props.to}
              {mark}
            </ProposedChip>
          </ins>
        </>
      )}
      {props.source === undefined || props.state !== undefined ? null : (
        <span className="text-xs text-muted-foreground">{sourceWordsFor(O.fromUndefinedOr(props.source)).tag}</span>
      )}
    </span>
  )
}
