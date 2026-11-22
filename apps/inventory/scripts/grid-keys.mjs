// The data grid's typing, checked in a real browser: `bun run grid:keys` (from apps/inventory).
//
// Typing on a focused cell opens its editor, and what was typed is what must be stored. Twice that went wrong without
// a word: the grid's own fallback stored 6 for a typed 56, and a column with its own `cell` lost the key that opened
// its editor. So this types 56, -5 and a space on every editor that takes typing (text, number, url, long text), in a
// plain column and in a column with its own `cell`, on the development page /gallery/grid, and reads what the grid
// stored from the list under it. It fails on any value that is not the one below.
//
// It needs Chromium or Chrome (CHROME_PATH, default /usr/bin/chromium), as `bun run lighthouse` does, so it is run by
// hand and is not part of `bun run check`: the machine that runs the checks has no browser.
import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright-core"

const port = process.env.GRID_KEYS_PORT ?? "5199"
const origin = `http://localhost:${port}`

// What is typed, the row it is typed on, and what each editor must then hold. A text, number or url editor opens with
// its value selected, so the typing replaces it; the long-text editor opens with the caret after its text ("ab").
//
// The space is stored as the published grid stores it, which was measured with its own mechanism
// (`document.execCommand("insertText", false, " ")` on a selected value in Chromium): a text cell holds a no-break
// space (the browser's way with a lone space in an editable element), and a number or url cell is emptied, since a
// space is neither. Whether a space should empty a number is a question for whoever first uses the grid.
const nbsp = "\u00a0"
const cases = [
  { row: "r1", keys: "56", text: 'string "56"', number: 'number "56"', url: 'string "56"', long: 'string "ab56"' },
  { row: "r2", keys: "-5", text: 'string "-5"', number: 'number "-5"', url: 'string "-5"', long: 'string "ab-5"' },
  {
    row: "r3",
    keys: " ",
    text: `string "${nbsp}"`,
    number: 'object "null"',
    url: 'object "null"',
    long: 'string "ab "'
  }
]
const editors = ["text", "number", "url", "long"]

/** A file of an installed package, from the nearest node_modules above this script (the root's: one hoisted install). */
const installed = (path) => {
  for (let dir = dirname(fileURLToPath(import.meta.url)); ; dir = dirname(dir)) {
    const candidate = join(dir, "node_modules", path)
    if (existsSync(candidate)) return candidate
    if (dirname(dir) === dir) throw new Error(`${path} is not installed: run \`bun install\` at the repository root.`)
  }
}
const vite = installed("vite/bin/vite.js")
const server = spawn(process.execPath, [vite, "--port", port, "--strictPort"], { stdio: "ignore" })
const stop = () => {
  server.kill()
}

/** Waits until the development server answers. */
const ready = async () => {
  for (let tries = 0; tries < 120; tries++) {
    const up = await fetch(`${origin}/gallery/grid`).then(
      (answer) => answer.ok,
      () => false
    )
    if (up) return
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`the development server did not answer on ${origin}`)
}

const run = async () => {
  await ready()
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH ?? "/usr/bin/chromium",
    args: ["--no-sandbox"]
  })
  const failures = []
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
    const errors = []
    page.on("pageerror", (error) => errors.push(String(error)))
    await page.goto(`${origin}/gallery/grid`)
    await page.locator('[data-slot="data-grid-cell"]').first().waitFor()
    for (const each of cases) {
      for (const editor of editors) {
        for (const column of [editor, `${editor}Shown`]) {
          const stored = page.locator(`[data-stored="${each.row}.${column}"]`)
          const before = await stored.textContent()
          await page
            .locator(`[data-slot="data-grid-cell"][data-row-id="${each.row}"][data-column-id="${column}"]`)
            .click({ position: { x: 3, y: 3 } })
          await page.keyboard.type(each.keys, { delay: Number(process.env.GRID_KEYS_DELAY ?? 40) })
          // Enter keeps a text, number or url editor's value; the long-text editor keeps its value when it closes.
          await page.keyboard.press(editor === "long" ? "Control+Enter" : "Enter")
          const wanted = `${each.row}.${column} ${each[editor]}`
          const settled = await stored
            .filter({ hasText: wanted })
            .waitFor({ timeout: 2000 })
            .then(
              () => true,
              () => false
            )
          const after = await stored.textContent()
          const exact = settled && after === wanted
          console.log(
            `${exact ? "ok  " : "FAIL"}  typed ${JSON.stringify(each.keys)} on ${each.row}.${column}: ${JSON.stringify(after)}`
          )
          if (!exact) failures.push(`${each.row}.${column}: wanted ${wanted}, stored ${after} (it held ${before})`)
        }
      }
    }
    for (const error of errors) failures.push(`the page threw: ${error}`)
  } finally {
    await browser.close()
  }
  return failures
}

run().then(
  (failures) => {
    stop()
    for (const failure of failures) console.error(failure)
    console.log(
      failures.length === 0
        ? "grid:keys OK  every editor stored what was typed"
        : `grid:keys FAIL  ${failures.length} wrong`
    )
    process.exit(failures.length === 0 ? 0 : 1)
  },
  (error) => {
    stop()
    console.error(`grid:keys FAIL  ${error}`)
    process.exit(1)
  }
)
