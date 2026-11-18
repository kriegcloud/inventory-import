// The final write-up against the app. `scripts/pack.sh` runs it inside the clean copy, after `check:full`, for a final
// pack only: a table cell in README.md or DECISIONS.md still "waiting" fails the zip; a cell "not decided", and a count
// of tests or people that differs from that check or from the people the migrations seed, are printed as warnings,
// and so is a write-up over its budget or one that speaks about how the hour was run (`writeupStyle`).
//   node scripts/pack-writeup.mjs [<tests check:full passed>]
// Prints FAIL and WARN lines in the pack's own format, and exits 1 when anything fails.
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { seededPeople, writeupProblems, writeupStyle } from "./checkpoint-rules.mjs"

const read = (path) => (existsSync(path) ? readFileSync(path, "utf8") : undefined)
const given = process.argv[2]
const tests = given !== undefined && /^\d+$/.test(given) ? Number(given) : undefined
const migrations = existsSync("migrations")
  ? readdirSync("migrations")
      .filter((name) => name.endsWith(".sql"))
      .sort()
      .map((name) => readFileSync(join("migrations", name), "utf8"))
  : []

const files = { "README.md": read("README.md"), "DECISIONS.md": read("DECISIONS.md") }
const { fail, warn } = writeupProblems({ files, tests, people: seededPeople(migrations) })
for (const line of fail) console.log(`FAIL  ${line}`)
for (const line of [...warn, ...writeupStyle({ files })]) console.log(`WARN  ${line}`)
process.exitCode = fail.length > 0 ? 1 : 0
