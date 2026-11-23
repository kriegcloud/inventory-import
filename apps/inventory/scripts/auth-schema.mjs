// Prints the SQL Better Auth still needs on top of migrations/, for the next numbered migration.
//   bun run auth:schema            the missing tables and columns as SQL, or "nothing missing"
//   bun run auth:schema -- --check exit 1 when anything is missing (test/server/AuthSchema.slow.test.ts checks the same on D1, in `bun run check:full`)
//
// Better Auth's own CLI cannot reach D1 (it runs in Node; D1 lives in workerd), so this script does what its
// `generate` command does, against a stand-in: every migrations/*.sql applied in order to an in-memory node:sqlite
// database, then Better Auth's `getMigrations` with this app's own options (@inventory/access-host, internal/authOptions.ts). Needs Node
// 22.18 or newer (node:sqlite and type stripping). Review the output before saving it: a required column on a table
// that already has rows is listed as "unsafe" and has to be written by hand: nullable, then filled in for the rows
// already there.
import { readdirSync, readFileSync } from "node:fs"
import { DatabaseSync } from "node:sqlite"
import { getMigrations } from "better-auth/db/migration"
import { authOptions } from "../../../packages/access/host/src/internal/authOptions.ts"

const root = new URL("../", import.meta.url)
const db = new DatabaseSync(":memory:")
for (const file of readdirSync(new URL("migrations/", root))
  .filter((f) => f.endsWith(".sql"))
  .sort()) {
  db.exec(readFileSync(new URL(`migrations/${file}`, root), "utf8"))
}

const options = authOptions({ database: db, secret: "x".repeat(32) })
const plan = await getMigrations(options, { throwOnUnsafe: false })
const sql = await plan.compileMigrations()
const missing = plan.toBeCreated.length + plan.toBeAdded.length + plan.toBeAddedIndexes.length

if (missing === 0) {
  console.log("Better Auth schema: nothing missing. migrations/ has every table and column the config needs.")
} else {
  console.log(`-- Better Auth needs ${missing} change(s). Review, then save as the next migrations/NNNN_*.sql.`)
  for (const change of plan.unsafeChanges) console.log(`-- UNSAFE, write by hand: ${change}`)
  for (const problem of plan.schemaProblems) console.log(`-- PROBLEM: ${problem}`)
  console.log(sql)
}
process.exit(process.argv.includes("--check") && missing > 0 ? 1 : 0)
