#!/usr/bin/env bash
# Fails when a key-shaped string (an OpenRouter or Anthropic key, a PEM private key) is in any file git would commit:
# tracked files and new files .gitignore does not exclude. It names the file and line, never the string. A test that
# needs a key-shaped value puts it together at run time ("sk-or-" + "...").
#   bun run keys:check
set -euo pipefail
cd "$(dirname "$0")/.."
pattern='sk-or-[A-Za-z0-9_-]{16,}|sk-ant-[A-Za-z0-9_-]{16,}|-----BEGIN [A-Z ]*PRIVATE KEY'
found="$(git grep --untracked -I -n -E "$pattern" -- . | cut -d: -f1,2 || true)"
if [ -n "$found" ]; then
  printf 'keys:check FAIL  a key-shaped string is in:\n%s\n' "$found" >&2
  exit 1
fi
printf 'keys:check OK  no key-shaped string in any file git would commit\n'
