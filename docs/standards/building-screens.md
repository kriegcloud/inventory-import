---
type: Standard
title: Building screens
description: The installed components and a reference's components before anything hand-built, every table on tablecn, the product's own look, and taste checked with a tool.
tags: [ui, components]
status: draft
---

- **Reuse before building**: the installed shadcn components and [the kit](../kit.md) first, then a reference
  repository's component I named, then a registry component (`bunx shadcn@latest add`). Never hand-roll a component
  a primitive already covers; hand-build only when none fits, and say why in the write-up. Check: each new file in
  `src/web/components/ui` came from a registry, and `bun run check` passes (its lint rejects a hand-rolled button,
  input, select, textarea, label or table).
- **Every table is tablecn's `DataTable`** (a list to read; the Records and People pages) or the `ReviewRegion` (rows to
  decide on). Check: no screen renders a table of records with anything else.
- **The look is Benjamin's brand, laid out like the product it will sit in.** Colours and type come from the tokens
  in `src/web/index.css` (the brand's zinc and forest-green scales; IBM Plex Sans, and JetBrains Mono for codes, so 0
  and O, and 1, l and I, cannot be confused). Layout, density and type size are measured from the product's real
  screens, not guessed. Check: `bun run check` passes (the design-system lint), and the diff adds no hex value or
  palette colour outside `src/web/index.css` and the two page colours in `src/web/lib/theme.tsx`.
- **Taste is checked with a tool and by looking**: the inspector at 1440, 768 and 390 px (the `qa` skill, step 3),
  then open the screenshots. Check: no FAIL in its findings.

## Also

- **Look a component up before building one** ([the kit](../kit.md) "Finding and adding a component"), and choose the part
  that fits: Tooltip, DropdownMenu, AlertDialog, Badge, Field or Item, not a styled `div`. Check: the review lists
  each remaining custom part with its reason.
- **A registry component's features go onto the screen's own components.** Sorting, filters, column view and search
  belong on the table the screen already uses, not in a second table. Check: one table component per screen.
