# Agent instructions

Read `CLAUDE.md`. It is the single source of standing context for any coding agent in this repo. Before writing or
changing any Effect Schema, read `docs/standards/schema-first.md`. Every Effect import follows
`docs/standards/effect-imports.md`: each module whole from its own path under its one name, never from `"effect"`;
`bun run check` fails on anything else.

Skills are in `.agents/skills/` (one folder each, with a `SKILL.md`). `.claude/skills/` and `.codex/skills/` hold
links to the same folders, so Claude Code, Codex and other agents that read the Agent Skills layout all find the same
set. `CLAUDE.md` has a table of which skill is used when. `.agents/skills/README.md` says which skills are ours and
which are vendored from other people's work, with their licences.

The shadcn MCP server is set up in `.codex/config.toml` for Codex (read once the folder is trusted) and in `.mcp.json`
for Claude Code, and so is a headless Playwright browser for looking at the app; the `qa` agent starts one of its own
(`.claude/agents/qa.md`). `docs/kit.md` says how to look a component up and add it ("Finding and adding a
component") and how the browsers are set up ("The browser for QA").
