#!/usr/bin/env bash
# Lighthouse on the production build, mobile then desktop, in under a minute. Reports: .scratch/lighthouse/ (ignored).
#   bun run lighthouse              the page at /
#   bun run lighthouse -- /review   another path the app routes
# Needs Chromium or Chrome (CHROME_PATH, default /usr/bin/chromium). Prints each category score per preset and every
# audit that scored below 100, with the element it names. Performance moves a few points between runs on a busy machine.
set -euo pipefail
path="${1:-/}"
port="${LH_PORT:-4173}"
out=".scratch/lighthouse"
mkdir -p "$out"
vite build >/dev/null
vite preview --port "$port" --strictPort >"$out/preview.log" 2>&1 &
pid=$!
trap 'kill "$pid" 2>/dev/null || true' EXIT
until curl -sf "localhost:$port/" >/dev/null; do sleep 0.5; done
for preset in mobile desktop; do
  flags=()
  [ "$preset" = desktop ] && flags=(--preset=desktop)
  CHROME_PATH="${CHROME_PATH:-/usr/bin/chromium}" bunx lighthouse@13.6.0 "http://localhost:$port$path" --quiet \
    --chrome-flags="--headless=new --no-sandbox" "${flags[@]}" --output=json --output=html --output-path="$out/$preset"
done
node - "$out" <<'EOF'
const { readFileSync } = require("node:fs")
for (const preset of ["mobile", "desktop"]) {
  const report = JSON.parse(readFileSync(`${process.argv[2]}/${preset}.report.json`, "utf8"))
  const categories = Object.values(report.categories)
  console.log(`${preset}: ${categories.map((c) => `${c.title} ${Math.round(c.score * 100)}`).join(", ")}`)
  for (const category of categories)
    for (const ref of category.auditRefs) {
      const audit = report.audits[ref.id]
      if (ref.weight === 0 || audit.score === null || audit.score >= 0.9) continue
      const node = audit.details?.items?.find((item) => item.node)?.node?.snippet ?? ""
      console.log(`  ${category.title}: ${audit.title} ${audit.displayValue ?? ""} ${node.slice(0, 120)}`)
    }
}
console.log(`HTML reports: ${process.argv[2]}/mobile.report.html, ${process.argv[2]}/desktop.report.html`)
EOF
