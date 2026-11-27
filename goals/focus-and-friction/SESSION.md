---
type: Reference
title: "Focus and friction, the person's session"
description: What step 3 hands Benjamin for a session with an operations person who did not build the import, on a spreadsheet of their own, on his machine with bun run dev - the page they read, what he watches for, and the record he fills in with counts and observations only.
from: explorations/ideal-architecture
---

# The person's session

Step 3 of [PLAN.md](PLAN.md). Benjamin runs it, as decided on 2026-11-26: one operations person with a spreadsheet
they really use, on `bun run dev` on his machine, with him beside them. The agent prepared the three parts below and
takes no part in the session.

**Their file stays theirs.** It is opened from their own folder or drive and never copied into the repository, the
scratchpad or a transcript. The record holds counts and what was seen and said. It holds no value, column heading,
item name, file name or person's name from the file. Where a note needs a column, write which of our fields it would
fill ("the column that fills Unit of measure"), never its heading.

## Before they sit down

- `bun run db:reset`, then `bun run dev`, so the session starts with an empty database and the import's counts come
  from their file alone. The app opens signed in as Dana Whitfield, an admin of Example Works (test).
- Open http://localhost:5173 on the Import page, at the Upload step, and leave the window full size.
- Have the record below open somewhere they cannot see it.
- Do not show them the sample files or the Items page first. The session is about their file.

## 1. The page they read

Print this or show it, and nothing else:

> This app takes a spreadsheet of inventory items, a .csv or .xlsx file, and adds the items to a shared list. Before
> anything is added, it shows what it read and what it would change, and you decide what goes in.
>
> Use it with your own file, the way you would if nobody were here. Please say aloud what you expect to happen and
> what you are looking for. If you get stuck, say so. I will not help unless you ask, and being stuck tells us what to
> fix.

Before they start, ask one thing and write down the answer: **"How many items are in this file, roughly, and are any
of them ones you would expect to be refused?"** That is what the counts on screen are compared with.

## 2. What to watch for

Each item comes from the import's rules in `CLAUDE.md`, "Rules for an import". Mark what you see. Don't explain the
screen while they work.

**Getting in.**

- Do they find how to choose their file? Do they notice the sample buttons, and do they ask about them?
- If their file has more than one sheet, do they pick the right one, and do they understand why they were asked?
- If the Match step opens, can they say what it asks? Do they find which of our fields have no column (Required:
  SKU, Name, Category, Unit of measure, Unit cost), and can they choose the right column by hand?

**Reading the review.**

- Do they read the counts aloud, and do the counts match what they expected? The views are "Needs a decision",
  "Cannot import", "Ready" and "All", each with its count. "Left out" and "Already there" join them when a row is
  left out or already stored. The grey line under the title says how many rows were read and how many values were
  fixed for them. Note the numbers, and whether they add up to the rows in their file as they understand it. With
  the messy sample on an empty database the screen read "200 rows read · 20 values fixed for you" and "Needs a
  decision 24 · Cannot import 21 · Ready 155 · All 200".
- A proposal shows a value before and after (a unit spelling, a date format, a trimmed code). Do they see it as a
  proposal and not something already done? Do they accept one for all similar rows at once, or go row by row? Do
  they ever reject one?
- When a value could be read two ways (03/04 as a date, which of two rows to keep), do they understand the question?
  Do they choose, or look for a default?
- For a row that cannot be imported: do they find the reason, and can they say from it what is wrong in their file?
- Do they use undo, and does it do what they expected?

**Confirming.**

- Before they press it, what do they say the confirm button will do? It reads "Import <n> items", or "Import <n>,
  skip <n>" when some rows stay out (the messy sample: "Import 155, skip 45"). Note its words and whether the numbers
  match what they expect. A button beside the views downloads the rows not imported: do they see it?
- Do they look at the totals before confirming, and compare them with anything of their own?

**After.**

- Does the result say what they expected? Do they find the rows that were not imported and why, and do they
  download them?
- Ask one question: "If you loaded this same file again tomorrow, what would happen?" Note the answer, then let them
  try it if they want. The screen should say the rows are "Already there".
- Do they find the take-back, and would they trust it?

**Anywhere.** Each time they stop for more than a few seconds, hover without clicking, scroll looking for something,
or say "hm", write the step, what was on screen, and what they said.

## 3. The record to fill in

Copy this block into PLAN.md, step 3, once the session is over. Leave a line blank rather than guess.

```markdown
**Session 1, <date>.** One operations person who did not build the import, with a file of their own (.csv or .xlsx,
<n> sheets), on `bun run dev` at <commit>, Benjamin beside them, <minutes> minutes.

Expected before starting: about <n> items, <n> expected to be refused.

| Step | Reached | Counts the screen showed | Where they stopped, and what they said |
| --- | --- | --- | --- |
| Upload | yes / no | rows read: <n> · values fixed for you: <n> | |
| Match | opened by itself / not shown / opened by them | required fields with no column: <n> | |
| Review | yes / no | Needs a decision <n> · Cannot import <n> · Ready <n> · Left out <n> · Already there <n> · All <n> | |
| Confirm | yes / no | the button said: "<its words>" | |
| Result | yes / no | Imported <n> · Updated <n> · Already there <n> · Not imported <n> | |
| Second load | tried / asked only / no | Already there <n> | |

Did the counts match what they expected: yes / no / they could not say. Where they differed:

What they did with proposals: accepted for a whole column / row by row / rejected some / did not see them.

What they said a left-out row's reason meant, in their words, with no value from the file:

Each problem, one line each, as "a fix" or "a question for Benjamin":

1.
```

Each problem then becomes a fix with its own pull request or a question in the root `DECISIONS.md`, as SPEC's
acceptance asks, and is linked from that line.
