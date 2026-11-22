// Local change: React is imported by name, so the atoms lint reads this file (goals/atoms, "The kit on atoms", batch 1); no longer as its registry has it.
"use client"

import type { ComponentProps } from "react"
import { Direction } from "radix-ui"

function DirectionProvider({
  dir,
  direction,
  children
}: ComponentProps<typeof Direction.DirectionProvider> & {
  direction?: ComponentProps<typeof Direction.DirectionProvider>["dir"]
}) {
  return <Direction.DirectionProvider dir={direction ?? dir}>{children}</Direction.DirectionProvider>
}

const useDirection = Direction.useDirection

export { DirectionProvider, useDirection }
