---
type: Standard
title: Someone new can start
description: A first-time user can say what the screen is for and reaches the review in one click.
tags: [ui, import]
status: stable
---

- **A first-time user can say what the screen is for.** Check: show a fresh agent only the 1440 px screenshot and
  ask what the screen is for and what to click first; the answer matches the task.
- **The sample file is one click away on the first screen** (`CLAUDE.md` "Rules for an import"). Check: from a
  fresh load, one click reaches the review, at 1440 and at 390 px, without scrolling.
- **A walk-through on request**: "Show me around" steps over the real screen with the sample loaded (the `Tour` in
  [the kit](../kit.md)), and never opens by itself. Check: Escape closes it and focus returns to the button. Not
  built in the starter: the `Tour` component is installed and no page uses it, so build the walk-through when the
  plan has it.
