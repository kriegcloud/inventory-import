---
type: Standard
title: Handing work to me
description: Put working pieces where I can try them and read the code, say exactly what was looked at, and keep open questions, defaults and findings in front of me.
tags: [evidence]
status: draft
---

- **Apply it early.** When a piece works and its checks pass, commit it where my dev server runs and tell me what to
  look at, so I can try it and read the code while work continues. Not on a side branch, not held for a polished
  round. Check: the report names the commit and the screen to open.
- **Say what was looked at**: "inspected" (someone opened and read it), "shot, not inspected" (a screenshot exists
  that nobody read), or "not shot". Check: every screenshot a report mentions carries one of the three.
- **Decisions come to me as a question dialog** (`AskUserQuestion`), never as a page to read and a wait: at most four
  questions a round, each with two to four complete choices, yours first, marked "(Recommended)" with its reason,
  and "Other" for my own words. A choice says what it gains and what it gives up, never a guess in minutes.
  Check: each decision the write-up records lists its options, your recommendation and what I chose.
- **Nothing sits idle while I answer.** Before a dialog opens, everything no open decision blocks is running: the
  builder lanes, `qa`, `reviewer` and the next work item. Check: the message before each dialog names what is
  running.
- **An open question stays open.** When I have not answered, the docs and the write-up say "not decided", name the
  agent's default, and never present it as my decision. Check: each such item reads "not decided" until I answer.
- **Your defaults stay in front of me until I decide them**: each is asked again at every round until I decide it
  or the hour ends. A default that decides what my data becomes is a decision, not a default. Check: the last
  round's questions match the defaults the write-up names as not decided.
- **Every finding reaches me.** Every finding of the tester, the reviewer and each lane is an option in a round, or
  a line in its text past four, marked fixed or open, not your pick of them. Check: the rounds hold as many findings
  as the reports.
