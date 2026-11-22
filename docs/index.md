---
okf_version: "0.2"
---

Paths here that start `src/`, `test/`, `migrations/`, `public/` or `scripts/` are inside
`apps/inventory/`, the app's workspace.

# Read before building

* [Standards](standards/index.md) - My standards for this work, each rule with its check. Read the ones under "Read before building"; look up the rest when the task touches them.

# Look up when needed

* [Reviewing a screen](reviewing/index.md) - How a screen is reviewed before it is called done, and the defects a review screen tends to have, each with its check.
* [Architecture in four diagrams](architecture.md) - The stored data model, one row through the import, one import through its steps, and how the layers depend on each other, as Mermaid diagrams read from the code.
* [The import kit](kit.md) - The components ready for an import screen and a list of records, when to use each, and what was changed after installing them.
* [The review region](review-table.md) - How to wire ReviewRegion, the Review step of an import, to real rows and a pure check in minutes.
* [Patterns](patterns.md) - Code and notes for cases in this stack that are easy to get wrong (D1, the API contract, the model, workbooks, accessibility).
* [Inventory glossary](glossary.md) - The trade words in stock, purchasing and production files, each with the mistake an import makes with it.
* [Break a rule and watch Verify catch it](verify.md) - The review as a model whose rules Verify proves from the code that decides: what is proved, the command, and three rules to break with a one-line edit, each with what it prints.
* [Sign-in](auth.md) - How sign-in, sessions, organizations and roles are wired (Better Auth on D1), how development opens signed in, the People page, its settings, how it stays fast, how to change the schema, and what is not done.
* [Versions and configuration kept in step](sync-commands.md) - The three commands that move dependencies, hold every repeated version to its one source and write the configuration that follows from the workspaces; what each covers, what it leaves alone, and the dependencies held back with their reasons.
* [Trying an idea in the scratchpad](scratchpad.md) - How to try an idea against the repository's own packages without touching them: one folder for each experiment, from a template whose test already runs, apart from the check, the build and a deploy, and ended by graduating its code into a package or dropping it.

# Evidence written while building

* [QA evidence](qa/README.md) - What the browser test passes leave in docs/qa/ and who writes it.
* [Browser test passes](qa/QA.md) - One dated section per browser test pass, appended by the qa agent, with findings and what was not tested.
