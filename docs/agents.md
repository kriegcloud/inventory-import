---
type: Reference
title: "Skills and sub-agents"
description: "Which skill is used when and how here, and the sub-agents: who writes what, the three-line brief, owners and hand-backs in a split, and the read-only reviewers."
---

# Skills and sub-agents

Moved here from `CLAUDE.md` word for word on 2026-11-26 (goals/focus-and-friction, step 4); `CLAUDE.md` keeps a line that links each section.

## Skills

Skills are in `.agents/skills/`, linked into `.claude/skills/` and `.codex/skills/`. Twenty-one come from Benjamin's
beep-effect as they stand there (`.agents/skills/README.md`, "From beep-effect"): `effect-first-development`,
`schema-first-development`, `crispen`, `grill-with-docs`, `grilling`, `grill-me`, `teach`, `adhd`, `portless`,
`turborepo`, `quality-review-fix-loop`, `unslop`, `sparql-expert` and the eight `ontology-*` skills. They still name
beep-effect's standards and paths in places; where they disagree with this file, this file wins. The rest are other
people's, vendored with only their commands written for bun, and `create-beep-app` is Benjamin's starter tool.
`/in-your-own-words`, `/grill-me` and `/teach` are Benjamin's to type (`disable-model-invocation`); `grilling` is the
one you can run yourself, to put open decisions to him as questions.

| When | Skill | Here |
| --- | --- | --- |
| Before building, when a real decision is still open | `grilling` (or Benjamin types `/grill-me`) | One question per frontier decision through `AskUserQuestion`, recommended answer first, at most four per call. Each answer is written down at once |
| A bug survives one fix | `/diagnosing-bugs` | Reproduce first; no second guess without evidence |
| Writing or changing Effect code | `effect-first-development`, `schema-first-development` | Schema first, then the `Context.Service` contract, then the implementation; check each API against Effect 4's source. Where they name beep-effect paths or packages that do not exist here, follow "Effect (version 4)" in [building](building.md) |
| Refactoring code whose rules belong in a schema | `crispen` | Absorbs guard and decode helpers into existing schemas; not for new models |
| Stress-testing an architecture plan against the exploration's decisions | `grill-with-docs` | Here its decision log is the exploration's `DECISIONS.md` |
| Open-ended design or naming with no known answer | `adhd` | Divergent ideation; skip it for closed questions |
| Turborepo tasks, caching, `turbo.json` | `turborepo` | Reads the docs bundled in the installed `turbo` package |
| Named local dev URLs | `portless` | `bun run --cwd apps/inventory dev:portless` serves the app as `inventory` |
| Ontology work (classes, mappings, SPARQL) | the `ontology-*` skills, `sparql-expert` | For `explorations/erp-ontology` only, not the app. Each reads `.agents/skills/_shared/project-profile.md` first: it holds this repository's ontology decisions and wins over skill text |
| Cutting filler from prose | `unslop` | On documents and messages, never on code |
| A screen looks generic | `design-taste-frontend` | App screens only: read its `references/app-screens.md` and run `inspect.mjs --app`. Never its page build (pictures and fonts from the network; our policy blocks them). Where it and "UI" in [ui](ui.md) disagree, "UI" wins |
| Before hand-building a component | `shadcn`, with the `shadcn` MCP server | Look it up in `@shadcn`, `@diceui` and `@tablecn` first (the MCP tools, or `bunx shadcn@latest search`). Add it with the CLI, `yes n \| bunx shadcn@latest add <item>`, then `bun install`. Never `--overwrite`. Steps in `docs/kit.md` "Finding and adding a component". Where it and "UI" in [ui](ui.md) disagree (`cn` comes from `"cn"`, status is `StatusPill`), "UI" wins |
| Sign-in, sessions, organisations or roles | The six Better Auth skills, with the `better-auth` MCP server for its docs | Sign-in is installed: read [docs/auth.md](auth.md) first; where a skill disagrees with it, it wins (the skills assume a framework and a database the CLI can reach). After adding a plugin or field, `bun run auth:schema` prints the migration to add |
| Closing a goal | `/quality-review-fix-loop` | Read-only reviewers in parallel, then fixes by file ownership. Product findings come to Benjamin, not to a fixer |
| Adding or changing anything under `docs/`, `explorations/` or `goals/` | `okf-open-knowledge-format` | Frontmatter with `type`, `title`, `description`; list a `docs/` file in its folder's `index.md`, then `bun run docs:check`. Links inside `docs/` are relative (`../kit.md`), never `/`-rooted |
| Starting a new repository, or adding a starter module | `create-beep-app` | Benjamin's starter tool; `beep.json` records which modules this repository was made with |

## Sub-agents

The agents in `.claude/agents/` each read their own rules: a brief never restates them.

- **`backend`** builds everything outside the browser: the contract, model and host packages of a context
  (`packages/catalog`, `packages/access`), `src/api`, `src/server`, `migrations` and their tests. **`frontend`**
  builds screens in a context's web package and in `src/web` from the installed components.
- **Who writes what.** Write the Schemas and the contract (a context's contract package) yourself and commit them first; then screens
  and server can be built at once. A single service with a few queries, or a rule you can write in less time than a
  brief takes, write yourself.
- **A brief is three lines.** No standards, no rules from this file, no code: the agent file holds them.
  ```
  Build: <what, for whom, and the one rule that must not break>.
  From: <committed Schemas and contract; DECISIONS.md for row rules>. Done: <the test or check>.
  Decided: <what Benjamin decided, quoted>. Open: <not decided: not built>.
  ```
- **A split has owners and a hand-back.** Every work item has exactly one owner. Never edit a running agent's files.
  Each lane formats only its own files (`bun run format -- <files>`). A lane that adds, changes or relies on a
  contract field names it in its hand-back; before calling work two lanes built done, hold their hand-backs side by
  side: a field only one of them names is not done.
- **`reviewer`** reads what changed since a commit it is given and reports at most ten defects, ranked by harm.
  **`qa`** uses the running app in a real browser and reports what it saw. **`verifier`** attacks the API and tests.
  None of them writes code. Check each finding against the current code before fixing it.
- Each hand-back ends with one line, "Needs the person: …" or "Needs the person: nothing". Pass it on unchanged.
