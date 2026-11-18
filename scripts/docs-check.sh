#!/usr/bin/env bash
# Checks that docs/, explorations/ and goals/ are each an Open Knowledge Format (v0.2) bundle with the validator the OKF skill ships
# (.agents/skills/okf-open-knowledge-format/scripts/validate.sh, vendored unchanged). `bun run check:full` runs it.
#   bun run docs:check               one line when it passes, plus any warnings
#   bun run docs:check -- --verbose  the validator's full report
# The validator needs bash, find, sort -z, grep, sed, awk, xargs and date: all present on a stock Linux or macOS.
# On Windows run it from Git Bash or WSL. It can also pass without looking: it reads the file list through
# `find | sort -z`, and if that fails it scans nothing and still says "conformant". This script fails instead.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
validator="$root/.agents/skills/okf-open-knowledge-format/scripts/validate.sh"
bundles=(docs explorations goals)
verbose="${1:-}"
fail() { printf 'docs:check FAIL  %s\n' "$*" >&2; exit 1; }

[ -f "$validator" ] || fail "the OKF validator is missing ($validator): the okf-open-knowledge-format skill is not installed."
for tool in find sort grep sed awk xargs date; do
  command -v "$tool" >/dev/null 2>&1 || fail "'$tool' is not installed. The OKF validator needs it."
done
printf 'a\0' | sort -z >/dev/null 2>&1 || fail "this 'sort' has no -z option. The OKF validator needs GNU or BSD sort."

cd "$root"
check_bundle() {
  local bundle="$1"
  local expected scanned code out
  expected="$(find "$bundle" -name '*.md' -type f | wc -l | tr -d ' ')"
  [ "$expected" -gt 0 ] || fail "there are no markdown files under $bundle/."

  code=0
  out="$(bash "$validator" "$bundle" 2>&1)" || code=$?
  scanned="$(printf '%s\n' "$out" | sed -n 's/^Files scanned: \([0-9][0-9]*\)$/\1/p')"

  # The validator's full report is printed when something is wrong, or with --verbose; otherwise its warnings only.
  if [ "$code" -ne 0 ] || ! printf '%s\n' "$out" | grep -q 'Bundle is OKF v0.2 conformant'; then
    printf '%s\n' "$out"
    fail "$bundle/ is not a conformant OKF bundle. Fix each E line above: a file outside index.md and log.md starts on
    line 1 with a --- frontmatter block that has type:, and only docs/index.md may have frontmatter among the
    index.md files. The okf-open-knowledge-format skill has the rules; any file in docs/standards/ shows the fields."
  fi
  [ "$scanned" = "$expected" ] || { printf '%s\n' "$out"; fail "the validator scanned ${scanned:-no} files of the $expected in $bundle/, so it did not run properly."; }
  if [ "$verbose" = "--verbose" ]; then printf '%s\n' "$out"; else printf '%s\n' "$out" | grep -E 'W[0-9]*: ' || true; fi
  printf 'docs:check OK  all %s markdown files in %s/ conform to OKF v0.2 (--verbose for the full report)\n' "$expected" "$bundle"
}

for bundle in "${bundles[@]}"; do check_bundle "$bundle"; done
