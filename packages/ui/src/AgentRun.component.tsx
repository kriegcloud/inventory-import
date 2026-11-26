import * as O from "effect/Option"
import { CheckIcon, ChevronRightIcon, CircleAlertIcon, LoaderIcon } from "lucide-react"
import type { ReactNode } from "react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@inventory/ui/components/collapsible"

/** One thing the agent (or the rules, without a key) did: a past-tense line, and what it read and returned. */
export interface RunStep {
  readonly id: string
  /** Past tense once done ("Matched 12 columns"), present while running ("Matching columns"). */
  readonly label: string
  readonly status: "running" | "done" | "failed"
  /** Tool name and arguments, shown when the person opens the step. */
  readonly input: O.Option<ReactNode>
  /** What the step returned or decided. */
  readonly output: O.Option<ReactNode>
  /** Who did the step, in one word ("Read", "Rule", "Model"), shown at the end of the line. */
  readonly tag: O.Option<string>
}

const icons = {
  running: <LoaderIcon className="animate-spin text-muted-foreground" aria-hidden />,
  done: <CheckIcon className="text-success-foreground" aria-hidden />,
  failed: <CircleAlertIcon className="text-destructive" aria-hidden />
} as const

const statusWords = { running: "Running", done: "Done", failed: "Failed" } as const

/**
 * The visible record of a run: who ran it, then one line per step, each opening to show its input and output.
 * It is a log the person can audit, not a chat. `producer` says which path made the result ("AI" or "Rules").
 */
export function AgentRun(props: { title: string; producer: string; steps: ReadonlyArray<RunStep> }) {
  const running = props.steps.some((step) => step.status === "running")
  return (
    <section aria-label={props.title} className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-sm font-semibold">{props.title}</h2>
        <span className="text-xs text-muted-foreground">{props.producer}</span>
      </div>
      <ol aria-live="polite" aria-busy={running} className="flex flex-col border-l pl-3">
        {props.steps.map((step) => {
          const hasDetail = O.isSome(step.input) || O.isSome(step.output)
          const line = (
            // A step that opens shows the rest of itself below, so its line is cut to one. A step with nothing to
            // open has only this line to say what happened (a cell that could not be read, by name), so it wraps.
            <span
              className={
                hasDetail
                  ? "flex min-w-0 items-center gap-2 [&_svg]:size-3.5 [&_svg]:shrink-0"
                  : "flex min-w-0 items-start gap-2 [&_svg]:mt-1 [&_svg]:size-3.5 [&_svg]:shrink-0"
              }
            >
              {icons[step.status]}
              <span className="sr-only">{statusWords[step.status]}: </span>
              <span className={hasDetail ? "truncate" : "min-w-0 break-words"}>{step.label}</span>
              {O.match(step.tag, {
                onNone: () => null,
                onSome: (tag) => (
                  <span className="ml-auto shrink-0 rounded-chip bg-secondary px-1.5 text-xs text-secondary-foreground">
                    {tag}
                  </span>
                )
              })}
            </span>
          )
          return (
            <li key={step.id} className="py-1 text-sm">
              {hasDetail ? (
                <Collapsible>
                  {/* The trigger keeps layout only (the design lint); its look is on the span inside. Focus shows as the
                      browser outline in the ring colour (the base layer sets it). */}
                  <CollapsibleTrigger className="group flex w-full text-left">
                    <span className="flex min-w-0 flex-1 items-center justify-between gap-2 group-hover:text-foreground">
                      {line}
                      <ChevronRightIcon
                        aria-hidden
                        className="size-3.5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-90"
                      />
                    </span>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <dl className="mt-1.5 grid grid-cols-label-value gap-x-3 gap-y-1 pl-5.5 text-xs">
                      {O.match(step.input, {
                        onNone: () => null,
                        onSome: (input) => (
                          <>
                            <dt className="text-muted-foreground">Read</dt>
                            <dd className="min-w-0 break-words">{input}</dd>
                          </>
                        )
                      })}
                      {O.match(step.output, {
                        onNone: () => null,
                        onSome: (output) => (
                          <>
                            <dt className="text-muted-foreground">Result</dt>
                            <dd className="min-w-0 break-words">{output}</dd>
                          </>
                        )
                      })}
                    </dl>
                  </CollapsibleContent>
                </Collapsible>
              ) : (
                line
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
