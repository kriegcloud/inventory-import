// `bun run shot -- <png or jpg> [<name>]`: one screenshot made small enough to commit, for README.md or DECISIONS.md
// to show. It writes docs/qa/<name>.webp with ffmpeg: at most 1440 pixels wide, quality 82 (about half a PNG's
// size), lower only if needed, and never over 150 kB: past that it writes nothing and says so. Without ffmpeg (or
// without its WebP encoder) it says so and keeps the file as it is, still at most six in all.
// Screenshots are taken into .scratch/shots/ (git-ignored); only the few a reader needs come through here.
import { spawnSync } from "node:child_process"
import { copyFileSync, existsSync, mkdirSync, rmSync, statSync } from "node:fs"
import { basename, dirname, extname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { EVIDENCE_FOLDER, MAX_EVIDENCE, candidates, hasWebpEncoder, imageProblems } from "./check-images.mjs"

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const LIMIT = 150 * 1000
// Tried in order until one is under the limit: the first is the usual result for a 1440 px screenshot.
const ATTEMPTS = [
  { quality: 82, width: 1440 },
  { quality: 70, width: 1440 },
  { quality: 70, width: 1200 },
  { quality: 60, width: 1024 }
]
const kB = (bytes) => `${Math.round(bytes / 1000)} kB`
const fail = (text) => {
  console.error(text)
  process.exit(1)
}

const [given, wanted] = process.argv.slice(2)
if (given === undefined) fail("Use: bun run shot -- <screenshot.png or .jpg> [<name>]")
const source = resolve(given)
if (!existsSync(source)) fail(`No such file: ${given}`)
const ext = extname(source).toLowerCase()
if (![".png", ".jpg", ".jpeg"].includes(ext)) fail(`Give a PNG or a JPEG, not ${ext || "a file without an extension"}.`)
const name =
  (wanted ?? basename(source, extname(source)))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "shot"

const folder = join(ROOT, EVIDENCE_FOLDER)
const webp = hasWebpEncoder()
const target = join(folder, webp ? `${name}.webp` : `${name}${ext}`)
const targetPath = relative(ROOT, target)

// At most six, counted the way `bun run check` counts them; replacing one by its own name is fine.
const { evidence } = imageProblems({ paths: candidates(ROOT), shown: [], ffmpeg: webp })
const others = evidence.filter((path) => path !== targetPath)
if (others.length >= MAX_EVIDENCE)
  fail(
    `Already ${others.length} images, the most a project commits (${others.join(", ")}). Replace one by giving its name, or delete one first; write what this screenshot shows in docs/qa/QA.md instead.`
  )

mkdirSync(folder, { recursive: true })
const before = statSync(source).size

if (!webp) {
  copyFileSync(source, target)
  const after = statSync(target).size
  console.log(
    `ffmpeg with its WebP encoder is not installed here, so ${targetPath} is the screenshot as it was (${kB(after)}${after > LIMIT ? `, over the ${kB(LIMIT)} limit: crop it to the part that matters if you can` : ""}). The limit of ${MAX_EVIDENCE} images still holds.`
  )
  console.log(`Show it in README.md or DECISIONS.md: ![What it shows](${targetPath})`)
  process.exit(0)
}

for (const { quality, width } of ATTEMPTS) {
  const run = spawnSync(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      source,
      "-vf",
      `scale='min(${width},iw)':-2`,
      "-c:v",
      "libwebp",
      "-quality",
      String(quality),
      "-compression_level",
      "6",
      target
    ],
    { encoding: "utf8" }
  )
  if (run.status !== 0) fail(`ffmpeg could not convert ${given}:\n${run.stderr.trim()}`)
  const after = statSync(target).size
  if (after <= LIMIT) {
    console.log(
      `${targetPath}: ${kB(after)} (was ${kB(before)}), at most ${width} px wide, quality ${quality}. ${others.length + 1} of at most ${MAX_EVIDENCE} images.`
    )
    console.log(`Show it in README.md or DECISIONS.md: ![What it shows](${targetPath})`)
    process.exit(0)
  }
}
const last = statSync(target).size
rmSync(target, { force: true })
fail(
  `Not written: still ${kB(last)} at quality 60 and 1024 px wide, over the ${kB(LIMIT)} limit. Crop the screenshot to the part that matters and try again.`
)
