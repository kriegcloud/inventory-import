import type { ReactNode } from "react"
import { cn } from "cn"

const tones = {
  success: "bg-success text-success-foreground",
  warning: "bg-warning text-warning-foreground",
  danger: "bg-danger text-danger-foreground",
  info: "bg-info text-info-foreground",
  neutral: "bg-secondary text-secondary-foreground",
  // For "Draft" and anything not yet decided: outlined, no fill.
  outline: "border border-input bg-transparent text-foreground"
} as const

export type Tone = keyof typeof tones

/** A small status label. Colour is never the only signal: always pass words, and an icon where it helps. */
export function StatusPill(props: {
  readonly tone: Tone
  readonly icon?: ReactNode
  readonly children: ReactNode
  readonly className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded-chip px-1.5 text-xs font-medium whitespace-nowrap [&_svg]:size-3",
        tones[props.tone],
        props.className
      )}
    >
      {props.icon}
      {props.children}
    </span>
  )
}
