import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

// Local change: `aria-disabled` looks like `disabled` but keeps the button in the tab order and under the pointer, so
// a toolbar's Undo with nothing to undo can still say so in its tooltip.
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-brand text-brand-foreground hover:bg-brand/90",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40",
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          // `aria-current` draws the page a link points at as selected: a link cannot carry `aria-pressed`.
          "hover:bg-accent hover:text-accent-foreground aria-pressed:bg-muted aria-[current=page]:bg-muted dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
        // The second choice beside a recommended one ("Leave out"): present, never louder than the data.
        quiet:
          "font-normal text-muted-foreground hover:bg-accent hover:text-accent-foreground aria-pressed:bg-muted aria-pressed:text-foreground",
        // A few words that open an explanation ("Why?", "row 56").
        hint: "font-normal text-muted-foreground underline-offset-2 hover:text-foreground hover:underline",
        // A fact that needs the person before the import can go ahead ("1 column to match").
        attention: "rounded-full bg-warning font-medium text-warning-foreground hover:bg-warning/80"
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
        // Local additions: 44px targets for a phone.
        touch: "h-11 px-4 has-[>svg]:px-3",
        "icon-touch": "size-11"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
