---
name: references
description: Read the reference repositories Benjamin names and map what each one offers onto this task's requirements, file by file, so nothing useful is missed and whole files that already do the job are copied rather than rewritten. Use when he lists repositories to look at, or asks to explore his references. Read-only until he chooses.
---

# References: read first, then copy what fits

A reference repository shows how a problem was solved before. Some are Benjamin's own work; some are other people's.
Where one of its files already does the job, copying the whole file and editing it in place is faster than picking
pieces out of it, and it keeps what the file got right.

He names the repositories, each by its path. Do not go looking for others unless he asks, and do not skip one he
listed.

1. **State the requirements you are matching against**, in a numbered list of at most ten lines, from the task (the
   brief, when there is one) and the plan he chose. If the task is not written down yet, ask for it.
2. **One read-only agent per repository he listed**, run in parallel. Give each: the numbered requirements, the
   repository's path, and this instruction: read the README, the architecture or decision notes, the data model,
   the tests and the main flow; then report, for each requirement the repository helps with, the files that
   implement it, what makes it work, what was hard, and, file by file, whether it could be copied whole, copied and
   edited (what would change), or should be left (what ties it to that project: endpoints, tables or names this task
   does not have). It writes nothing and runs nothing that changes the repository.
3. **Check the licence of every repository that is not his own first**, before proposing to copy a file from it.
   Ideas and structure may always be learned from. Code is taken only where the licence allows it and with its
   attribution kept; a copyleft licence (GPL, LGPL, AGPL) means patterns only, no code.
4. **Answer in one table**, in under a page:

   | Requirement | Best reference | Copy whole | Copy and edit (what changes) | Leave (why) |
   | --- | --- | --- | --- | --- |

   Then: requirements no reference covers; anything in a reference this task does not need and should not grow
   into; and the order you would build in, each step with the checkpoint it must be in by.
5. **Ask, and keep going.** Benjamin chooses what to use, through `AskUserQuestion` (`CLAUDE.md` "Decisions by
   dialog"): one question per requirement a reference covers, its options the files to copy whole, to copy and edit,
   or "build it here", yours first with the reason, `multiSelect` where several files can go in. The table is there
   if he wants it, never required reading. Before you ask, start what no choice blocks. Record his choice in his
   words where the project keeps its decisions.

When he has chosen:

- **Copy whole files, then edit in place.** Where a file already does the job, copy it as it is and change it here to
  this repository's contract, names, schemas and rules (`CLAUDE.md`, `docs/standards/`). Do not rebuild it from
  pieces. Judge fit file by file: a file tied to endpoints, tables or names this task does not have is left, not
  half-copied. Bring the tests that prove the behaviour the same way.
- **Nothing arrives unchecked.** Copied code passes `bun run check`, `/qa` and the reviewer here like any other.
- **Keep a ledger as you go.** For each reference file you use, one line the moment you use it, in one of three
  kinds: the file copied whole (and what you changed here), functions taken (each named), or the pattern only. Put
  the new lines in the same message as the work, unasked; the write-up's table is this ledger. Copied or adapted code
  is never described as written from scratch. Check: every message that used a reference file has its ledger lines.
- **Name a reference by its repository, never by where it is.** The write-up names each reference by its
  repository's name and, for someone else's, its licence. It never writes a path on this machine: the reader has
  only the name.
- **No secrets, no private data.** Never read a reference's environment files, and never copy data files from one.
