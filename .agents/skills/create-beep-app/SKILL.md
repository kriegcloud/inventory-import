---
name: create-beep-app
description: Set up a new repository, or add a capability to one, with Benjamin's create-beep-app tool (a Vite, React and Effect app on Cloudflare that already signs people in, imports a file of records through a review and lists them, with optional docs, agent kit, design lints, telemetry and time-boxed workflow). Use when asked to start a project, scaffold an app, or add docs, the agent kit, design lints, telemetry or the time-boxed workflow to a project that has a beep.json at its root.
---

# create-beep-app: from requirements to a project that passes its checks

The tool generates a repository from a catalog of modules and records what it used in `beep.json`. It has four
commands: `init`, `add`, `list`, `graph`. Run `create-beep-app list` first when you are unsure what a module adds:
the catalog is the source of truth, not this page.

## 1. Map the requirements to modules

Write the requirements as a short numbered list, then map each one to a module. Only choose a module a requirement
needs; `add` brings the rest in later in seconds.

| The requirement says | Module | Notes |
| --- | --- | --- |
| Any web app (always) | `base` | Vite 8, React 19, Tailwind 4, shadcn/ui, a Worker with D1, an Effect API contract, strict checks, and a working app on an example Record: the frame, sign-in (Better Auth; signed in as a test account in development), an import in four steps (upload, match, review, result with take-back), the Records page with search and a table assistant, activity and people, the spreadsheet reader, the review region and one model service with a daily allowance (rules with no key). Always included; `effect`, `better-auth`, `ai`, `spreadsheet` and `review` are part of it |
| The work is graded on its docs or standards | `docs` | OKF bundle, validated by `bun run check:full` |
| A coding agent builds it with skills, QA and a verifier | `agent-kit` | Needs `docs` (brought in automatically) |
| The work happens under a clock and is handed in as a zip | `timebox` | The clock and its checkpoint schedule, `bun run checkpoint`, pack, the intake, lead and ship skills, DECISIONS.md, brief/. Needs `agent-kit` |
| The UI must hold to the design system | `design-lints` | Two lints in `bun run check` |
| Traces, metrics and logs must reach a collector | `telemetry` | Off and silent until a collector address is set; brings its own command for a local collector in Docker, never started by `dev` |

Library names work too: `--libs="better-auth,effect"` resolves to `base`, which has both. An unknown or unavailable
name stops the run before anything is written; do not retry with a guessed spelling, run `list`.

## 2. The exact command

Pick a name: lowercase letters, digits and single hyphens (`acme-app`). It becomes the package, Worker and database
name. Always print the plan first, then generate:

```bash
create-beep-app init acme-app --vite --libs="docs,agent-kit" --dry-run   # the plan: files, packages, lockfiles
create-beep-app init acme-app --vite --libs="docs,agent-kit" --yes       # generate, install, format, commit
```

`--yes` never prompts. Without flags in a terminal it asks for the name and modules. `--no-install` skips the
install (then run `bun install` yourself), `--no-git` skips the first commit, `--pm bun` installs with Bun (both lockfiles
are written either way).

## 3. Later: `add` instead of generating everything up front

Generate what the requirements need now. When a new requirement arrives, add its module from the project folder:

```bash
create-beep-app add telemetry --dry-run   # what would change, file by file
create-beep-app add telemetry --yes       # apply, re-derive lockfiles, install, format
```

`add` merges into files you changed (a three-way merge) and never overwrites your edits: where its change and yours
touch the same lines it keeps your file and writes its version beside it as `<file>.beep-new`. Resolve those by
hand, delete the `.beep-new` files, then check.

## 4. Verify before saying it works

From the project folder, run each and read the result; do not report a step you did not run:

```bash
bun run check   # the loop check: types with Effect diagnostics, lint, format, the fast tests
bun run check:full   # everything: also the slow tests (and docs:check with the docs module)
bun run build
bun run test    # Vitest, on Node; never `bun test`, which is Bun's own runner
```

Then `bun run dev` and open http://localhost:5173: in development the app opens signed in as the first test account
on the import's first step. Report what you ran, what passed, and anything you did not check.

## 5. Where things are written

- `beep.json`: the tool version, target and modules. `add` reads it; do not edit it by hand.
- The last line of `README.md` says which version and modules scaffolded the project.
- The lockfiles are derived from the tool's own by npm and Bun (no network at `init`). After you add a dependency
  yourself, `add` updates the lockfiles from the registry instead and says so.
