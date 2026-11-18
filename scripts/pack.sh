#!/usr/bin/env bash
# Builds a zip of the project from committed work only, with the .git folder, and proves it runs from a clean copy.
#   bun run pack            final: clean install, check:full, build, and the write-up must have no TODO left
#   bun run pack -- --early same checks, but an unfinished write-up only warns: for uploads while work continues
#   bun run pack -- --quick zip only, no checks
#   --allow-uncommitted     with --early or final: list uncommitted edits to tracked files and pack the last commit
#                           anyway (`bun run checkpoint` passes it; the zip is cloned from the commit, so they are not in it)
# Where only the latest upload counts, every upload should be one that passed --early or the final check.
# Zips land in submit/ (git-ignored). A checkpoint's commit (tagged v<version> by `bun run checkpoint`) gives
# <folder>-v<version>.zip; any other commit gives <folder>-m<minute>-<commit>.zip, so versions are easy to tell apart.
# Never traced: `bash -x` would print the values this script reads from .dev.vars to look for them (see "Secrets").
# Tracing is turned off here, and again around that check whatever turned it back on. test/scripts/Pack.slow.test.ts
# runs it under `bash -x` with a fake key file to prove no value is printed.
{ set +x; } 2>/dev/null # no-trace
set -euo pipefail

quick=0; early=0; allow=0; tests=""
for arg in "$@"; do
  case "$arg" in
    --quick) quick=1 ;;
    --early) early=1 ;;
    --allow-uncommitted) allow=1 ;;
    *) printf 'Unknown option %s\n' "$arg"; exit 2 ;;
  esac
done
root="$(git rev-parse --show-toplevel)"
name="$(basename "$root")"
mkdir -p "$root/submit"
version="$(node -e 'process.stdout.write(String(require(process.argv[1]).version ?? ""))' "$root/package.json" 2>/dev/null || true)"
tagged="$(git -C "$root" rev-parse -q --verify "refs/tags/v$version^{commit}" 2>/dev/null || true)"
if [ -n "$version" ] && [ "$tagged" = "$(git -C "$root" rev-parse HEAD)" ]; then
  out="$root/submit/$name-v$version.zip"
else
  minute="$(node "$root/scripts/clock.mjs" --short 2>/dev/null | sed -n 's/^min \([0-9]*\).*/m\1/p')"
  out="$root/submit/$name-${minute:-pre}-$(git -C "$root" rev-parse --short HEAD).zip"
fi
rm -f "$out" "${out%.zip}.DO-NOT-UPLOAD.zip"
work="$(mktemp -d)"
# The clean copy (with its node_modules) is deleted in the background, so nobody waits for it.
trap '(rm -rf "$work" >/dev/null 2>&1 &)' EXIT
fail=0
say() { printf '%s\n' "$*"; }
bad() { say "FAIL  $*"; fail=1; }
# Where the time goes: PACK_TIMES=1 (set by `bun run checkpoint`) prints each phase's seconds at the end.
# Milliseconds from GNU date; a date without %N (macOS) gives 0, so the times read 0.0 s instead of failing the pack.
ms() { local n; n="$(date +%s%N 2>/dev/null || true)"; case "$n" in '' | *[!0-9]*) echo 0 ;; *) echo $((n / 1000000)) ;; esac; }
times=""; mark="$(ms)"
lap() { local now; now="$(ms)"; times="$times${times:+ · }$1 $(((now - mark) / 1000)).$(((now - mark) % 1000 / 100)) s"; mark="$now"; }

# `npm run` exports the user's npm settings as npm_config_* variables. Some of them (for example allow-scripts)
# are rejected by a nested `npm ci`, so the clean-copy check runs with a clean npm environment.
for v in $(env | grep -o '^npm_[A-Za-z0-9_]*' || true); do unset "$v"; done

# Only committed work is packed. Changes to tracked files stop a full pack; untracked files are just listed.
if [ -n "$(git -C "$root" status --porcelain --untracked-files=no)" ]; then
  # `sed -n` rather than `head`: head stops reading, the writer dies of SIGPIPE, and pipefail ends the script (141).
  say "Uncommitted changes to tracked files are NOT in the zip:"; git -C "$root" status --short --untracked-files=no | sed -n 1,10p
  [ "$quick" = 1 ] || [ "$allow" = 1 ] || { say "Commit or stash first (or use --quick to pack the last commit anyway)."; exit 1; }
fi
untracked="$(git -C "$root" ls-files --others --exclude-standard | sed -n 1,5p | tr '\n' ' ')"
[ -n "$untracked" ] && say "Note: untracked files are not in the zip: $untracked"

# A clone holds exactly what is committed, plus history. No node_modules, no local database, no .dev.vars.
# Cloned through file:// so only objects a branch or tag reaches are copied: a plain local clone copies the whole
# object store, and with it anything an amended or dropped commit left behind. Every branch stays a branch.
git clone --quiet "file://$root" "$work/$name"
cd "$work/$name"
for branch in $(git for-each-ref --format='%(refname:strip=3)' refs/remotes/origin); do
  [ "$branch" = HEAD ] || git show-ref --verify --quiet "refs/heads/$branch" || git branch --quiet "$branch" "origin/$branch"
done
git remote remove origin
# The reflog names this machine's folders and the clone itself ("clone: from file:///home/..."): it is not packed.
rm -rf .git/logs
lap clone

# Secrets: in the tree and anywhere in history.
for f in .dev.vars .env; do [ -e "$f" ] && bad "$f is committed"; done
pattern='sk-or-[A-Za-z0-9_-]{16,}|sk-ant-[A-Za-z0-9_-]{16,}|-----BEGIN [A-Z ]*PRIVATE KEY'
if git grep -I -n -E "$pattern" -- . >/dev/null 2>&1; then bad "a key-shaped string is in the tree: $(git grep -I -l -E "$pattern" -- . | sed -n 1,3p | tr '\n' ' ')"; fi
# Not `grep -q`: it exits at the first match, git log dies of SIGPIPE, and pipefail turns the find into a pass.
if git log -p --all | grep -E "$pattern" >/dev/null; then bad "a key-shaped string is in git history"; fi
# The surest check: the actual secret values on this machine must appear nowhere in the tree or its history.
# Values are read from .dev.vars and never printed: no trace while they are in a variable, and each reaches grep
# through a file descriptor (`-f <(...)`), never as an argument a process list would show.
if [ -f "$root/.dev.vars" ]; then
  case $- in *x*) tracing=1 ;; *) tracing="" ;; esac; { set +x; } 2>/dev/null # no-trace
  while IFS='=' read -r key value; do
    value="${value%\"}"; value="${value#\"}"
    case "$key" in ''|\#*|AI_MODEL) continue ;; esac
    [ "${#value}" -ge 16 ] || continue
    if git grep -I -q -F -f <(printf '%s\n' "$value") -- . 2>/dev/null; then bad "the value of $key from .dev.vars is in the tree"; fi
    if git log -p --all | grep -F -f <(printf '%s\n' "$value") >/dev/null; then bad "the value of $key from .dev.vars is in git history"; fi
  done < "$root/.dev.vars"
  value=""; [ -z "$tracing" ] || set -x # no-trace
fi
# Private strings: when TAKEHOME_PRIVATE_MARKERS names a file (absolute path, one string per line), none of them may be
# in the tree, a commit message or history. Hits are named by file and line, never by the string. Unset: skipped.
if [ -n "${TAKEHOME_PRIVATE_MARKERS:-}" ] && ! node scripts/session-report.mjs --guard >"$work/guard.log" 2>&1; then
  bad "private marker check"; sed 's/^/      /' "$work/guard.log"
fi
# Where this machine is: no reflog, no object nothing reaches, and neither the home folder's path nor a network name
# of this machine anywhere in the copy, its .git, a commit message, a tag or a line ever committed. Named, never printed.
[ -e .git/logs ] && bad ".git/logs (the reflog) is in the copy"
[ -z "$(git fsck --unreachable --no-reflogs 2>/dev/null | sed -n 1p)" ] || bad "the copy holds objects no branch or tag reaches"
{ git log -p --all --no-color --format='commit %H%n%B'; git for-each-ref --format='%(contents)' refs/tags; } >"$work/history.txt"
places() { # label, value, grep flags: name where the value is found
  local hits
  hits="$(grep -r -I -l $3 -F -e "$2" --exclude-dir=objects . 2>/dev/null | sed -n 1,3p | tr '\n' ' ' || true)"
  grep -q $3 -F -e "$2" "$work/history.txt" && hits="$hits(git history)"
  [ -z "$hits" ] || bad "$1 is in the copy: $hits"
}
if [ "${#HOME}" -gt 1 ]; then places "this machine's home folder path" "$HOME" ""; fi
hosts="$(hostname 2>/dev/null || true) $(uname -n 2>/dev/null || true)"
if command -v tailscale >/dev/null 2>&1; then
  hosts="$hosts $(timeout 3 tailscale status --json 2>/dev/null | node -e 'let s="";process.stdin.on("data",(d)=>(s+=d)).on("end",()=>{try{process.stdout.write(String(JSON.parse(s).Self?.DNSName??"").replace(/\.$/,""))}catch{}})' || true)"
fi
for host in $(printf '%s\n' $hosts | sort -u); do
  case "$host" in localhost | localhost.*) continue ;; esac
  if [ "${#host}" -ge 4 ]; then places "a network name of this machine" "$host" "-i"; fi
done
# The write-up. A TODO here; for a final pack, the rest after the clean copy's check:full (scripts/pack-writeup.mjs).
[ -f README.md ] || bad "README.md is missing"
[ -f DECISIONS.md ] || bad "DECISIONS.md is missing"
for f in README.md DECISIONS.md; do
  n="$(grep -c 'TODO' "$f" 2>/dev/null || true)"
  if [ "${n:-0}" -gt 0 ]; then
    # Unfinished write-up blocks the final zip, not an early insurance upload.
    if [ "$quick" = 1 ] || [ "$early" = 1 ]; then say "WARN  $f still has $n TODO marker(s)"; else bad "$f still has $n TODO marker(s)"; fi
  fi
done

lap scans
# -y keeps the skill links as links, so the unzipped tree matches what git has.
(cd "$work" && zip -rqy "$out" "$name")
lap zip
say "Zip:     $out ($(git ls-files | wc -l | tr -d ' ') tracked files, .git included)"
# The size, every time. Over 5 MB a plain warning names the three largest parts, counting each in the tree and in git
# history: a big zip is slow to upload in the last minutes, and it is almost always committed screenshots.
bytes="$(stat -c %s "$out" 2>/dev/null || stat -f %z "$out")"
if [ ! -f scripts/pack-weight.mjs ] || ! node scripts/pack-weight.mjs "$out" "$name"; then
  say "Size:    $(awk -v b="$bytes" 'BEGIN { printf "%.1f MB", b / 1000000 }')"
fi
say "Commit:  $(git log -1 --format='%h %s')"

if [ "$quick" = 0 ]; then
  say "Checking from a clean copy..."
  step() { # name, command...: run quietly, show the last lines only if it fails
    local name="$1"; shift
    if ! "$@" >"$work/step.log" 2>&1; then bad "$name"; tail -12 "$work/step.log" | sed 's/^/      /'; fi
  }
  # The route someone running it fresh takes, on purpose: npm, not bun, and the full check with the slow tests.
  step "npm ci" npm ci; lap "npm ci"
  step "npm run check:full (types, lints, format, every test, docs)" npm run check:full; lap check
  # How many tests passed, for the write-up check below. Vitest prints "Tests  163 passed (163)".
  tests="$(sed -n -e 's/\x1b\[[0-9;]*m//g' -e 's/^ *Tests  *\([0-9][0-9]*\) passed.*/\1/p' "$work/step.log" | sed -n '$p')"
  step "npm run build" npm run build; lap build
  [ "$fail" = 0 ] && say "OK    clean install, check and build all pass"
fi

# The final write-up against the app: a table cell still "waiting" fails; a "not decided" cell, and a count of tests
# or people that differs from the check above or the seed, are warnings. Not for --early or --quick: during the hour a
# call may still be waiting.
if [ "$quick" = 0 ] && [ "$early" = 0 ] && [ -f scripts/pack-writeup.mjs ]; then
  node scripts/pack-writeup.mjs "$tests" || fail=1
fi

[ "${PACK_TIMES:-}" = 1 ] && say "Pack:    $times"
if [ "$fail" = 1 ]; then mv "$out" "${out%.zip}.DO-NOT-UPLOAD.zip"; say "Renamed to ${out%.zip}.DO-NOT-UPLOAD.zip. Fix the failures and pack again."; exit 1; fi
[ "$quick" = 1 ] && say "Not checked (--quick). Prefer --early for anything you upload."
say "Upload:  $out"
