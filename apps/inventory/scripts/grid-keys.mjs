// The data grid's typing, checked in a real browser: `bun run grid:keys` (from apps/inventory).
//
// Typing on a focused cell opens its editor, and what was typed is what must be stored. Twice that went wrong without
// a word: the grid's own fallback stored 6 for a typed 56, and a column with its own `cell` lost the key that opened
// its editor. So this types on every editor that takes typing (text, number, url, long text), in a plain column and
// in a column with its own `cell`, on the development page /gallery/grid, and reads what the grid stored from the
// list under it. It fails on any value that is not the one below, and on anything the page logs as an error or a
// warning.
//
// The other editors (select, multi-select, date, file, the boolean's checkbox) are as published and are not typed on
// here: the published select and multi-select drop the key that opens them.
//
// It needs Chromium or Chrome: CHROME_PATH, or the first of the usual places. With none it fails; it never passes
// without having typed. CI runs it after the full check (.github/workflows/ci.yml), and it is run by hand after a
// change to the grid. It is not a turbo task: its answer depends on a browser, which no input names.
import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import { createServer } from "node:net"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright-core"

const nbsp = " "
/** A key that is pressed, not typed as text. */
const named = /^(?:F2|Escape|Control\+z)$/
const editors = ["text", "number", "url", "long"]
/** What each row holds before it is typed on, as the list under the grid prints it. */
const untouched = { text: 'string "ab"', number: 'number "12"', url: 'string "https://a.example"', long: 'string "ab"' }

// One row per case: what is done on a focused cell, then what each editor must hold. A text, number or url editor
// opens with its value selected, so typing replaces it; the long-text editor opens with the caret after its text.
//
// Two outcomes are "as published", not rules. Escape in the long-text editor keeps what was typed: its popover closes
// and saves, in the published grid too (measured on the grid as it was before any of these changes). And the space
// row: it is what the published grid stores, measured with its own mechanism
// (`document.execCommand("insertText", false, " ")` on a selected value in Chromium). A text cell gets a no-break
// space (the browser's way with a lone space in an editable element), and a number or url cell is emptied. Whether a
// space on a focused cell should do that is not decided (explorations/ideal-architecture/DECISIONS.md); when it is,
// this row changes with it.
const cases = [
  {
    row: "r1",
    does: "types 56",
    keys: ["56"],
    commit: true,
    text: 'string "56"',
    number: 'number "56"',
    url: 'string "56"',
    long: 'string "ab56"'
  },
  {
    row: "r2",
    does: "types -5",
    keys: ["-5"],
    commit: true,
    text: 'string "-5"',
    number: 'number "-5"',
    url: 'string "-5"',
    long: 'string "ab-5"'
  },
  {
    row: "r3",
    does: "types a space (as published)",
    keys: [" "],
    commit: true,
    text: `string "${nbsp}"`,
    number: 'object "null"',
    url: 'object "null"',
    long: 'string "ab "'
  },
  {
    row: "r4",
    does: "types 5, then Escape (long text as published)",
    keys: ["5", "Escape"],
    commit: false,
    ...untouched,
    long: 'string "ab5"'
  },
  { row: "r5", does: "types 5, then undoes it", keys: ["5", "Control+z"], commit: true, ...untouched },
  {
    row: "r6",
    does: "presses F2, then types 7",
    keys: ["F2", "7"],
    commit: true,
    text: 'string "ab7"',
    number: 'number "127"',
    url: 'string "https://a.example7"',
    long: 'string "ab7"'
  }
]

/** A file of an installed package, from the nearest node_modules above this script (the root's: one hoisted install). */
const installed = (path) => {
  for (let dir = dirname(fileURLToPath(import.meta.url)); ; dir = dirname(dir)) {
    const candidate = join(dir, "node_modules", path)
    if (existsSync(candidate)) return candidate
    if (dirname(dir) === dir) throw new Error(`${path} is not installed: run \`bun install\` at the repository root.`)
  }
}

/** The browser to drive: the one CHROME_PATH names, or the first that is installed. None is a failure. */
const browserPath = () => {
  const named = process.env.CHROME_PATH
  const places =
    named === undefined ? ["/usr/bin/chromium", "/usr/bin/google-chrome", "/usr/bin/chromium-browser"] : [named]
  const found = places.find((place) => existsSync(place))
  if (found === undefined) {
    throw new Error(`no browser at ${places.join(", ")}: set CHROME_PATH to Chromium or Chrome. Nothing was typed.`)
  }
  return found
}

/** A port nothing listens on, asked of the system, so the server started below is the only one that can answer on it. */
const freePort = () =>
  new Promise((resolve, reject) => {
    const probe = createServer()
    probe.on("error", reject)
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address()
      probe.close(() =>
        address !== null && typeof address === "object" ? resolve(address.port) : reject(new Error("no port"))
      )
    })
  })

/**
 * This checkout's development server on that port. It is ready when the server itself says it serves the port, so a
 * server left running by another checkout is never mistaken for it; one that stops first is a failure.
 *
 * Read without colour: on CI (`CI` is set) Vite colours its address and prints the port in bold, so the text
 * `localhost:<port>` is never there and the check would wait its whole limit. Colour is turned off for the server, and
 * any escape code left is taken out before the text is read.
 */
const serve = (port) =>
  new Promise((resolve, reject) => {
    const server = spawn(process.execPath, [installed("vite/bin/vite.js"), "--port", String(port), "--strictPort"], {
      cwd: join(dirname(fileURLToPath(import.meta.url)), ".."),
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" }
    })
    let said = ""
    const hear = (chunk) => {
      said += String(chunk).replace(/\x1b\[[0-9;]*m/g, "")
      if (said.includes(`localhost:${port}`)) resolve(server)
    }
    server.stdout.on("data", hear)
    server.stderr.on("data", hear)
    server.on("exit", (code) =>
      reject(new Error(`the development server stopped (exit ${code}) before it served: ${said.trim()}`))
    )
    setTimeout(
      () => reject(new Error(`the development server did not say it serves port ${port} in 180 s: ${said.trim()}`)),
      180_000
    )
  })

/** Every case on every editor, in a plain column and in one with its own `cell`, with `delay` ms between keys. */
const typeAll = async (browser, origin, delay) => {
  const failures = []
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
  page.on("pageerror", (error) => failures.push(`the page threw: ${error}`))
  page.on("console", (message) => {
    // One warning is the app's and not the grid's: index.html preloads the session request, which this page, shown
    // before any sign-in, never makes.
    const preload = message.text().includes("/api/v1/identity/session was preloaded using link preload")
    if ((message.type() === "error" || message.type() === "warning") && !preload) {
      failures.push(`the page logged a ${message.type()}: ${message.text()}`)
    }
  })
  await page.goto(`${origin}/gallery/grid`)
  await page.locator('[data-slot="data-grid-cell"]').first().waitFor()
  for (const each of cases) {
    for (const editor of editors) {
      for (const column of [editor, `${editor}Shown`]) {
        const stored = page.locator(`[data-stored="${each.row}.${column}"]`)
        const before = await stored.textContent()
        // The cell's corner: the middle of a url cell is its link.
        await page
          .locator(`[data-slot="data-grid-cell"][data-row-id="${each.row}"][data-column-id="${column}"]`)
          .click({ position: { x: 3, y: 3 } })
        // Letters are sent in one call, so with no pause the second follows the first inside the same frame.
        for (const key of each.keys) {
          await (named.test(key) ? page.keyboard.press(key) : page.keyboard.type(key, { delay }))
          if (delay > 0) await page.waitForTimeout(delay)
        }
        // Enter keeps a text, number or url editor's value; the long-text editor keeps its value when it closes.
        if (each.commit) await page.keyboard.press(editor === "long" ? "Control+Enter" : "Enter")
        const wanted = `${each.row}.${column} ${each[editor]}`
        // A value that must not change is read after the grid has had time to store a wrong one.
        if (wanted === before) await page.waitForTimeout(500)
        const settled = await stored
          .filter({ hasText: wanted })
          .waitFor({ timeout: 15_000 })
          .then(
            () => true,
            () => false
          )
        const after = await stored.textContent()
        const exact = settled && after === wanted
        console.log(`${exact ? "ok  " : "FAIL"}  ${delay} ms  ${each.does} on ${column}: ${JSON.stringify(after)}`)
        if (!exact)
          failures.push(
            `${delay} ms between keys, ${each.does} on ${each.row}.${column}: wanted ${wanted}, stored ${after}`
          )
      }
    }
  }
  await page.close()
  return failures
}

const run = async () => {
  const executablePath = browserPath()
  const port = await freePort()
  const server = await serve(port)
  try {
    const browser = await chromium.launch({ executablePath, args: ["--no-sandbox"] })
    try {
      console.log(`grid:keys  ${executablePath} ${browser.version()}, this checkout's server on port ${port}`)
      // With no pause a second key follows the first at once, which is where the long-text editor lost the first;
      // 40 ms is a fast typist.
      const fast = await typeAll(browser, `http://localhost:${port}`, 0)
      const typist = await typeAll(browser, `http://localhost:${port}`, 40)
      return [...fast, ...typist]
    } finally {
      await browser.close()
    }
  } finally {
    server.removeAllListeners("exit")
    server.kill()
  }
}

run().then(
  (failures) => {
    for (const failure of failures) console.error(failure)
    console.log(
      failures.length === 0
        ? `grid:keys OK  every editor stored what was typed (${cases.length * editors.length * 2 * 2} cases)`
        : `grid:keys FAIL  ${failures.length} wrong`
    )
    process.exit(failures.length === 0 ? 0 : 1)
  },
  (error) => {
    console.error(`grid:keys FAIL  ${error instanceof Error ? error.message : error}`)
    process.exit(1)
  }
)
