// What a zip weighs, and above 5 MB which three parts of the project weigh the most. `scripts/pack.sh` runs it inside
// the clean copy the zip was made from, so the git history it measures is exactly the one in the zip.
//   node scripts/pack-weight.mjs <zip> <folder name inside the zip>
// A committed file counts twice, once as a file and once in history; a file replaced since still counts in history.
import { execFileSync } from "node:child_process"
import { statSync } from "node:fs"
import { largestParts, weightLines } from "./checkpoint-rules.mjs"

const [zip, folder] = process.argv.slice(2)
if (zip === undefined || folder === undefined) {
  console.error("Use: node scripts/pack-weight.mjs <zip> <folder name inside the zip>")
  process.exit(2)
}
const run = (command, args, input) =>
  execFileSync(command, args, {
    encoding: "utf8",
    input,
    maxBuffer: 256 * 1024 * 1024,
    stdio: ["pipe", "pipe", "ignore"]
  })

const bytes = statSync(zip).size
const files = []
// `unzip -Zl`: permissions, version, system, size, type, compressed size, method, date, time, name.
for (const line of run("unzip", ["-Zl", zip]).split("\n")) {
  const m = /^\S+\s+\S+\s+\S+\s+\d+\s+\S+\s+(\d+)\s+\S+\s+\S+\s+\S+\s+(.+)$/.exec(line)
  if (m === null || m[2].endsWith("/")) continue
  const path = m[2].startsWith(`${folder}/`) ? m[2].slice(folder.length + 1) : m[2]
  // The git pack is measured object by object below.
  if (/^\.git\/objects\/pack\/.*\.pack$/.test(path)) continue
  files.push({ path, bytes: Number(m[1]) })
}

const history = []
const objects = run("git", ["rev-list", "--objects", "--branches", "--tags"])
const sizes = run("git", ["cat-file", "--batch-check=%(objectsize:disk) %(rest)"], objects)
for (const line of sizes.split("\n")) {
  const m = /^(\d+) ?(.*)$/.exec(line)
  if (m !== null) history.push({ path: m[2], bytes: Number(m[1]) })
}

for (const line of weightLines({ bytes, parts: largestParts({ files, history }) })) console.log(line)
