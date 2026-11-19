// Fails when a vendored file no longer matches what was copied. Every package under packages/ with a vendor.json
// (written by scripts/vendor-beep.mjs) is checked:
//
// - each listed file exists and starts with its provenance line, naming the recorded commit and upstream path;
// - the SHA-256 of the rest of the file equals the recorded one, and, for a file copied without rewrites or patches, the
//   recorded upstream (source) hash too: a vendored source file is the upstream file, byte for byte, unless vendor.json
//   lists a patch for it, with its reason (scripts/vendor-beep.mjs, SOURCE_PATCHES), which this check then reports;
// - src/ and test/ hold nothing that is neither listed nor one of the package's local files;
// - package.json's exports are the recorded ones.
//
// With `--source <beep-effect checkout>`, every recorded source hash is also compared with the file at the recorded
// commit there, which proves the record itself.
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import fs from "node:fs"
import path from "node:path"

const repoRoot = path.resolve(import.meta.dirname, "..")
const at = process.argv.indexOf("--source")
const source = at === -1 ? undefined : process.argv[at + 1]
const sha256 = (data) => createHash("sha256").update(data).digest("hex")

const manifestsUnder = (dir) => {
  const found = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) found.push(...manifestsUnder(full))
    else if (entry.name === "vendor.json") found.push(full)
  }
  return found
}
const filesUnder = (dir, base = dir) => {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    return entry.isDirectory() ? filesUnder(full, base) : [path.relative(base, full).split(path.sep).join("/")]
  })
}

const problems = []
const patched = []
let checked = 0
const manifests = manifestsUnder(path.join(repoRoot, "packages"))
for (const manifestPath of manifests) {
  const dir = path.dirname(manifestPath)
  const where = path.relative(repoRoot, dir)
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"))
  const { commit, path: upstreamDir } = manifest.source
  const listed = new Set([...manifest.files.map((f) => f.path), ...manifest.local])
  for (const entry of manifest.files) {
    const file = path.join(dir, entry.path)
    if (!fs.existsSync(file)) {
      problems.push(`${where}/${entry.path}: listed in vendor.json but missing`)
      continue
    }
    const content = fs.readFileSync(file)
    const newline = content.indexOf(0x0a)
    const first = content.subarray(0, newline).toString()
    const expectedFirst = `// Vendored from beep-effect ${commit.slice(0, 12)}:${upstreamDir}/${entry.path} `
    if (newline === -1 || !first.startsWith(expectedFirst)) {
      problems.push(`${where}/${entry.path}: the first line is not its provenance line (${expectedFirst.trim()} …)`)
      continue
    }
    const actual = sha256(content.subarray(newline + 1))
    if (actual !== entry.sha256)
      problems.push(`${where}/${entry.path}: changed since it was vendored (sha256 ${actual})`)
    const patches = entry.patches ?? []
    if (entry.rewrites.length === 0 && patches.length === 0 && entry.sha256 !== entry.sourceSha256) {
      problems.push(`${where}/${entry.path}: copied without rewrites, yet its hash differs from its source hash`)
    }
    if (patches.length > 0) {
      if (entry.sha256 === entry.sourceSha256)
        problems.push(`${where}/${entry.path}: lists a patch, yet equals upstream`)
      if (!patches.every((patch) => typeof patch.reason === "string" && patch.reason.length > 0)) {
        problems.push(`${where}/${entry.path}: a patch has no reason`)
      }
      if (!first.includes("Patched on purpose")) {
        problems.push(`${where}/${entry.path}: patched, but its first line does not say so`)
      }
      patched.push(
        `${where}/${entry.path} (${patches.length} patch${patches.length === 1 ? "" : "es"}, against beep-effect ${commit.slice(0, 12)})`
      )
    }
    if (source !== undefined) {
      const upstream = execFileSync("git", ["-C", source, "show", `${commit}:${upstreamDir}/${entry.path}`], {
        maxBuffer: 64 * 1024 * 1024
      })
      if (sha256(upstream) !== entry.sourceSha256) {
        problems.push(
          `${where}/${entry.path}: the recorded source hash is not that of beep-effect ${commit.slice(0, 12)}`
        )
      }
    }
    checked += 1
  }
  for (const sub of ["src", "test"]) {
    for (const file of filesUnder(path.join(dir, sub))) {
      if (!listed.has(`${sub}/${file}`)) problems.push(`${where}/${sub}/${file}: not vendored and not a local file`)
    }
  }
  const exportsMap = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")).exports
  if (JSON.stringify(exportsMap) !== JSON.stringify(manifest.exports)) {
    problems.push(`${where}/package.json: exports differ from those recorded in vendor.json`)
  }
}

if (problems.length > 0) {
  for (const problem of problems) console.error(problem)
  console.error(`vendor:check failed: ${problems.length} problem${problems.length === 1 ? "" : "s"}`)
  process.exit(1)
}
console.log(
  `vendor:check: ${checked} vendored files in ${manifests.length} packages match their recorded hashes` +
    (source === undefined ? "" : " and beep-effect")
)
for (const file of patched) console.log(`vendor:check: patched on purpose: ${file}`)
