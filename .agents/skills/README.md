# Skills in this repo

`.claude/skills/` and `.codex/skills/` link to these folders, so Claude Code and Codex read one copy.

## Benjamin's own

`create-beep-app`: how to use his project starter tool, which made this repository (`beep.json` records the modules).

The procedures written for the original timed build (intake, lead, references, next, qa, verify, decisions, ship)
were removed with that build's tooling; git history has them.

## From beep-effect

Copied as they stand from Benjamin's own monorepo, [beep-effect](https://github.com/beep-effect/beep-effect)
(Apache-2.0), at commit `ef2886e94dd`: `adhd`, `crispen`, `effect-first-development`, `schema-first-development`,
`grill-with-docs`, `grilling`, `grill-me`, `teach`, `portless`, `turborepo`, `quality-review-fix-loop` and `unslop`.
They still name beep-effect's standards and paths in places; those are corrected as this repository takes on that
layout. The paths they name that are not here, and what stands in (checked 2026-11-23):

| Named in the skill | Here |
| --- | --- |
| `standards/effect-first-development.md` (`effect-first-development`, `schema-first-development`, `crispen`) | `CLAUDE.md` "Effect (version 4)" and `docs/standards/effect-imports.md` |
| `standards/schema-first.inventory.jsonc`, an inventory of accepted exceptions | none on purpose: `defaults-baseline.json`, whose numbers only fall, and the law's `exemptions` (`packages/tooling/tool/cli/src/commands/Laws/Defaults.rules.ts`), each Benjamin's decision |
| `packages/tooling/tool/cli/src/commands/Lint/SchemaFirst.ts`, the schema-first lint | `bun run beep laws defaults` (`defaults:check` in `bun run check`), with `docs/standards/schema-first.md` (SF-1 to SF-9) for the standard |
| `standards/architecture/DECISIONS.md` | `explorations/ideal-architecture/DECISIONS.md` for architecture, `DECISIONS.md` at the root for product |

`sparql-expert`, the ontology set (`ontology-scout`, `ontology-requirements`, `ontology-conceptualizer`,
`ontology-architect`, `ontology-mapper`, `ontology-validator`, `ontology-curator`, `ontology-foundational-auditor`)
and the `_shared` folder they read are from beep-effect at commit `3933c9da187` (its branch
`fix/ontology-skills-review`, where their commands and facts were corrected), and are then adapted for this
repository. The adaptation is additive so the copies stay comparable: each `SKILL.md` has its own description and an
"In this repository" section, a step that does not apply here opens with a `> Here:` line, and three files are this
repository's own (`_shared/project-profile.md`, which every ontology skill reads first and which wins over skill
text; `_shared/gist-categories.md`; and the references the longer skills were split into). The review behind both
steps is `explorations/erp-ontology/research/03-skills-review.md`.
`grilling`, `grill-me` and `unslop` began as the vendored skills in the table below and keep their licences.

## Vendored, with their licences

Each folder carries the upstream `LICENSE`. Better Auth's skills are the exception: their repository has no licence
file. They are copied as published, so they can be compared with upstream, except that their install and run commands
are written for `bun` and `bunx`.
The "Skills" section of `CLAUDE.md` says how each is used here, and where this repo's own rules win.

| Skill | From | Version | Licence | Why it is here |
| --- | --- | --- | --- | --- |
| `design-taste-frontend` | [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) by Leon Lin | 2.1.5 | MIT | Its app-screen rules (measured from real product screens) and its zero-dependency browser inspector, which measures and photographs a screen at three widths |
| `grill-me`, `grilling` | [mattpocock/skills](https://github.com/mattpocock/skills) by Matt Pocock | commit `5863806` | MIT | Puts the open decisions to the person as numbered questions with a recommended answer each |
| `diagnosing-bugs` | mattpocock/skills | commit `5863806` | MIT | A disciplined loop for a bug that resists the first fix |
| `unslop` | [cursor/plugins, pstack](https://github.com/cursor/plugins/tree/main/pstack) by Lauren Tan | commit `6e359ce` | MIT | Cuts filler and vague phrases from the write-up, and rewrites a sentence that names a feeling so it names the mechanism or the number |
| `in-your-own-words` | cursor/plugins, pstack | commit `6e359ce` | MIT | The agent restates the goal before work starts, so a misunderstanding costs one message |
| `okf-open-knowledge-format` | [fabricioctelles/skills](https://github.com/fabricioctelles/skills/tree/main/skills/okf-open-knowledge-format) by ft.ia.br | commit `ec4099f` (skill version 2.0) | Apache-2.0 (the repository's `LICENSE`, copied into the folder) | Writes `docs/` in the Open Knowledge Format (v0.2) and ships `scripts/validate.sh`, which `bun run docs:check` runs |
| `shadcn` | [shadcn-ui/ui, `skills/shadcn`](https://github.com/shadcn-ui/ui/tree/main/skills/shadcn) by shadcn | commit `e62c943` | MIT (the repository's `LICENSE.md`, copied as `LICENSE`) | shadcn/ui's own composition rules, CLI reference and MCP tool guide. It reads this project's `components.json` (`shadcn info --json`) when it loads, so the agent looks a component up and adds it with the CLI instead of writing it from memory |
| `better-auth-best-practices`, `create-auth`, `email-and-password-best-practices`, `organization-best-practices`, `two-factor-authentication-best-practices`, `better-auth-security-best-practices` | [better-auth/skills](https://github.com/better-auth/skills) by Better Auth, the pack its docs install (`bunx skills add better-auth/skills`) | commit `20c9e88` | No licence file in that repository (the Better Auth library itself is MIT) | Better Auth's own rules for sign-in, sessions, organisations, roles and their security settings. Sign-in is installed: `docs/auth.md` says how it is wired here and wins where they disagree |
