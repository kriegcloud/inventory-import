# Skills in this repo

`.claude/skills/` and `.codex/skills/` link to these folders, so Claude Code and Codex read one copy.

## Benjamin's own

`quality-review-fix-loop`: ported from one of his own repositories, with that repo's standards replaced by this one's
(the goal's `SPEC.md`, `CLAUDE.md`, `docs/patterns.md`) and the reviewer panel cut from ten roles to seven.

`create-beep-app`: how to use his project starter tool, which made this repository (`beep.json` records the modules).

The procedures written for the original timed build (intake, lead, references, next, qa, verify, decisions, ship)
were removed with that build's tooling; git history has them.

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
