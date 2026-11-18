import { Array as Arr } from "effect"
import { describe, expect, it } from "vitest"
import { imageProblems, shownIn } from "../../scripts/check-images.mjs"

// The images rule in `bun run check` (scripts/check-images.mjs): screenshots are never committed as they were taken,
// at most six small images are, and each is shown by README.md or DECISIONS.md.

const shots = (n: number) => Arr.map(Arr.range(1, n), (i) => `docs/qa/0${i}-review.webp`)
const readme = (paths: ReadonlyArray<string>) =>
  Arr.join(
    Arr.map(paths, (path) => `![A step](${path})`),
    "\n"
  )

describe("images in git", () => {
  it("lets the app's own icons, vendored skills and fixtures be PNGs", () => {
    const paths = ["public/favicon-32.png", ".agents/skills/shadcn/assets/shadcn.png", "test/fixtures/scan.jpg"]
    expect(imageProblems({ paths, shown: [], ffmpeg: true })).toEqual({ evidence: [], problems: [] })
  })

  it("refuses a screenshot committed as it was taken, and says how to make it small", () => {
    const paths = ["docs/qa/min14-review-1440.png", "src/web/pages/review.jpg"]
    const { problems } = imageProblems({ paths, shown: paths, ffmpeg: true })
    expect(problems).toHaveLength(2)
    expect(problems[0]).toContain("bun run shot -- docs/qa/min14-review-1440.png")
  })

  it("passes six small images that README.md shows, and refuses a seventh", () => {
    const six = shots(6)
    expect(imageProblems({ paths: six, shown: shownIn([readme(six)], six), ffmpeg: true }).problems).toEqual([])
    const seven = shots(7)
    const { problems } = imageProblems({ paths: seven, shown: shownIn([readme(seven)], seven), ffmpeg: true })
    expect(problems).toEqual([
      "7 evidence images, at most 6: keep the ones README.md and DECISIONS.md need and write what the rest showed in docs/qa/QA.md."
    ])
  })

  it("refuses an image neither README.md nor DECISIONS.md shows", () => {
    const paths = ["docs/qa/01-review.webp", "docs/qa/02-done.webp"]
    const shown = shownIn(["See ![Review](docs/qa/01-review.webp)", "| Decision | Who decided |"], paths)
    expect(shown).toEqual(["docs/qa/01-review.webp"])
    expect(imageProblems({ paths, shown, ffmpeg: true }).problems).toEqual([
      "docs/qa/02-done.webp: neither README.md nor DECISIONS.md shows it. Show it there, or delete it: screenshots stay in .scratch/shots/."
    ])
  })

  it("keeps a PNG in docs/qa/ only where ffmpeg cannot convert it, and still counts it", () => {
    const paths = ["docs/qa/01-review.png"]
    expect(imageProblems({ paths, shown: paths, ffmpeg: false })).toEqual({ evidence: paths, problems: [] })
    expect(imageProblems({ paths, shown: paths, ffmpeg: true }).problems).toHaveLength(1)
  })
})
