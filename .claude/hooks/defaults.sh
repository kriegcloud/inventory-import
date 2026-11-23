#!/bin/sh
# After an agent edits a .ts or .tsx file, the defaults law reads that one file (`bun run beep laws defaults <file>`,
# a third of a second). If the edit added a fallback, a comparison with null or undefined, an Option turned back into
# a missing value, or a clean-up outside a schema, the agent is told the line and what to write instead while it still
# holds the change in mind, not at the next `bun run check`. Exit 2 hands the words back to the agent; the edit stays.
# A file the law does not read, or a checkout without the law, says nothing.
file=$(python3 -c 'import json, sys; print(json.load(sys.stdin).get("tool_input", {}).get("file_path", ""))' 2>/dev/null) || exit 0
case "$file" in
  *.ts | *.tsx) ;;
  *) exit 0 ;;
esac
[ -f "$file" ] || exit 0
# The file's own checkout: an edit inside a worktree is read by that worktree's law against its baseline.
root=$(git -C "$(dirname "$file")" rev-parse --show-toplevel 2>/dev/null) || exit 0
[ -f "$root/packages/tooling/tool/cli/src/commands/Laws/Defaults.rules.ts" ] || exit 0
PATH="$HOME/.local/share/mise/shims:$PATH"
command -v bun >/dev/null 2>&1 || exit 0
said=$(cd "$root" && bun packages/tooling/tool/cli/src/bin.ts laws defaults "$file" 2>&1) && exit 0
printf '%s\n' "$said" >&2
exit 2
