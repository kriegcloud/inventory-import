# Reviewer roles

Read-only reviewers for the quality-review-fix loop (Phase 2). Each receives the summary of what was built, the base
commit, the changed-file list, the sources of truth, and the inventory item format from `templates.md`.

## Reviewer contract

Every reviewer must:

- stay read-only (it may run the app, the check and `curl`; it edits nothing)
- cite the written rule or the line of the brief, and concrete file or command evidence
- classify each finding as `blocking`, `non-blocking`, `question` or `note`
- keep to what this hour changed: the template commit is not under review
- include the smallest fix and a command or step that proves it
- return `0 required findings` when no blockers remain
- stop after four minutes and report what it did not get to

## Roles

1. **Quality gate.** `bun run check:full`, `bun run build`, `bun run pack -- --early`, `bun run lighthouse -- <path>` for
   each screen. Any failure, warning or audit below 100 outside mobile Performance is a finding.

2. **The brief and the person.** Reads `brief/` again and uses the running app with the sample file. Each requirement:
   met, partly, not met. What lands if the person presses nothing but the last button. Whether someone who has never
   seen the app knows what each screen wants from them.

3. **Trust.** `CLAUDE.md` "Rules for an import". Any value changed without being shown, any count that does not add
   up, any row left out without a reason, any proposal that reaches stored data without a person's yes, a second
   import that duplicates, a claim on screen the code does not back.

4. **Boundaries.** `CLAUDE.md` "Layout", "Identity and permissions", "What the type-check enforces", "Platform". An
   endpoint without the identity middleware or a role check, a query without `organizationId`, input that is trusted
   without decoding, a write that is not one atomic batch, a statement that can pass 100 bound parameters, an
   expected problem returned as an error instead of as data, a rule with no test.

5. **Screens.** `CLAUDE.md` "UI" and `docs/patterns.md` section 8, with the inspector's screenshots at 1440, 768 and
   390 pixels in both themes (`node .agents/skills/design-taste-frontend/scripts/inspect.mjs <url> --app`). One
   question per screen; what the person must do visible without scrolling; prose over the budget; a label, a name or
   a heading missing; a status by colour alone; a phone layout that only scrolls sideways.

6. **Coherence.** The same thing named two ways on two screens, two helpers that do one job, a file over about 600
   lines, dead code, a leftover from a recipe or a spike, a comment that restates the code, an export in
   `src/domain`, `src/api` or `src/server` without a JSDoc that says why.

7. **The write-up.** `README.md` and `DECISIONS.md` against the repo and the session record. Each claim under "Where
   it stands" tried; each decision credited to whoever made it; no adapted code described as written from scratch;
   machine-written phrasing (Benjamin can type `/unslop` for it); a TODO left in.
