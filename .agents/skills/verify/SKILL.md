---
name: verify
description: Check the running app the way a sceptical outsider would, using the verifier agent, and report defects without fixing them. Use after the baseline, after each addition, and before the final pack.
---

# Verify: check the work before claiming it

1. Make sure `bun run dev` is running and note its URL.
2. Start the `verifier` agent with: the URL, what changed since the last check (`git log --oneline` since then), and
   the task's requirements. It reads and runs; it edits nothing.
3. While it runs, do your own pass: `bun run check:full`, the tier with the slow tests.
4. When it reports, list the defects for Benjamin, most harmful first, each with its reproduction. Say which you
   would fix now and which you would record as known. Benjamin decides.

Do not fix anything in this step. Mixing checking and fixing is how a defect gets marked done unchecked.
