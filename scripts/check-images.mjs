// Images in git, part of `bun run check`. Screenshots are taken into `.scratch/shots/` (git-ignored) and stay there.
// At most six images are committed, each one README.md or DECISIONS.md shows, made small with `bun run shot`. A PNG
// or JPEG outside the app's own assets and icons fails, so no screenshot is committed as it was taken: every committed
// image is in the zip twice, as a file and in git history, for good. It looks at what is tracked and what is about to
// be (new files git does not ignore).
import { spawnSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))

/** Folders whose images belong to the app or to someone else's work (vendored skills, test fixtures): not evidence. */
export const ASSET_PLACES = ["public/", "src/web/assets/", ".agents/", "test/fixtures/"]
/** The most evidence images a project commits. */
export const MAX_EVIDENCE = 6
/** Where `bun run shot` writes them. */
export const EVIDENCE_FOLDER = "docs/qa/"
const RASTER = /\.(png|jpe?g|gif|webp|avif|bmp)$/i
const UNCONVERTED = /\.(png|jpe?g|gif|bmp)$/i

/**
 * What is wrong with the images among `paths`. Evidence is every raster image outside the asset places. A PNG, JPEG,
 * GIF or BMP among them fails (unless `ffmpeg` is false and it sits in docs/qa/: `bun run shot` keeps the PNG when
 * it cannot convert); so does one neither README.md nor DECISIONS.md shows (`shown`), and a seventh.
 * @example imageProblems({ paths: ["docs/qa/review.png"], shown: [], ffmpeg: true }).problems.length // 2
 */
export function imageProblems({ paths, shown, ffmpeg }) {
  const evidence = paths.filter((path) => RASTER.test(path) && !ASSET_PLACES.some((place) => path.startsWith(place)))
  const problems = []
  for (const path of evidence) {
    if (UNCONVERTED.test(path) && !(ffmpeg === false && path.startsWith(EVIDENCE_FOLDER)))
      problems.push(
        `${path}: a screenshot as it was taken. Make it small with \`bun run shot -- ${path}\` (a WebP in ${EVIDENCE_FOLDER}), then delete this file; an app asset goes in public/.`
      )
    if (!shown.includes(path))
      problems.push(
        `${path}: neither README.md nor DECISIONS.md shows it. Show it there, or delete it: screenshots stay in .scratch/shots/.`
      )
  }
  if (evidence.length > MAX_EVIDENCE)
    problems.push(
      `${evidence.length} evidence images, at most ${MAX_EVIDENCE}: keep the ones README.md and DECISIONS.md need and write what the rest showed in docs/qa/QA.md.`
    )
  return { evidence, problems }
}

/** The paths among `paths` that `texts` (README.md and DECISIONS.md) name, as a link or an image. */
export function shownIn(texts, paths) {
  return paths.filter((path) => texts.some((text) => text.includes(path)))
}

/** Files tracked, or new and not ignored, that still exist: what the next commit can hold. */
export function candidates(root = ROOT) {
  const listed = spawnSync("git", ["-C", root, "ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024
  })
  if (listed.status !== 0) return []
  return [...new Set(listed.stdout.split("\0").filter((path) => path !== "" && existsSync(join(root, path))))]
}

/** True when ffmpeg runs and has the WebP encoder. */
export function hasWebpEncoder() {
  const run = spawnSync("ffmpeg", ["-hide_banner", "-encoders"], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 })
  return run.status === 0 && /\blibwebp\b/.test(run.stdout)
}

function main() {
  const paths = candidates()
  const read = (name) => (existsSync(join(ROOT, name)) ? readFileSync(join(ROOT, name), "utf8") : "")
  const texts = [read("README.md"), read("DECISIONS.md")]
  const needsFfmpeg = paths.some((path) => path.startsWith(EVIDENCE_FOLDER) && UNCONVERTED.test(path))
  const { evidence, problems } = imageProblems({
    paths,
    shown: shownIn(texts, paths),
    ffmpeg: needsFfmpeg ? hasWebpEncoder() : true
  })
  if (problems.length > 0) {
    console.error(`Images: ${problems.length} problem${problems.length === 1 ? "" : "s"}.`)
    for (const problem of problems) console.error(`  ${problem}`)
    process.exit(1)
  }
  if (evidence.length > 0)
    console.log(`Images: ${evidence.length} of at most ${MAX_EVIDENCE}, each shown in README.md or DECISIONS.md.`)
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
