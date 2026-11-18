// One-time setup for the hosted copy: creates the D1 database, writes its id into wrangler.jsonc,
// applies migrations and deploys. Needs `bunx wrangler login` first. Local dev does not need any of this.
import { execFileSync } from "node:child_process"
import { readFileSync, writeFileSync } from "node:fs"

const run = (args) =>
  execFileSync("bunx", ["wrangler", ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    env: { ...process.env, CI: "true" }
  })
const placeholder = "00000000-0000-0000-0000-000000000000"
const config = readFileSync("wrangler.jsonc", "utf8")

if (config.includes(placeholder)) {
  const name = /"database_name":\s*"([^"]+)"/.exec(config)?.[1] ?? "inventory"
  let id
  try {
    id = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.exec(run(["d1", "create", name]))?.[0]
  } catch {
    // Already exists: look it up.
    const list = JSON.parse(run(["d1", "list", "--json"]))
    id = list.find((db) => db.name === name)?.uuid
  }
  if (!id)
    throw new Error(
      "Could not create or find the D1 database. Run `bunx wrangler d1 list` and check you are logged in."
    )
  writeFileSync("wrangler.jsonc", config.replace(placeholder, id))
  console.log(`D1 database ${name}: ${id} (written to wrangler.jsonc; commit it)`)
} else {
  console.log("wrangler.jsonc already has a database id.")
}

execFileSync("bun", ["run", "deploy"], { stdio: "inherit" })
