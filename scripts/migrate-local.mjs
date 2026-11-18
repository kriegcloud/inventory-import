// Applies D1 migrations to the local database (a SQLite file under .wrangler/).
// Runs before `bun run dev` and `bun run test` so a fresh checkout needs no manual step.
// Runs the project's own wrangler with this same Node, so it works the same under `bun run` and `npm run`.
import { spawnSync } from "node:child_process"
import { randomBytes } from "node:crypto"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

const wrangler = fileURLToPath(new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url))
const result = spawnSync(process.execPath, [wrangler, "d1", "migrations", "apply", "DB", "--local"], {
  stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, CI: "true", WRANGLER_SEND_METRICS: "false" },
  encoding: "utf8"
})

if (result.status !== 0) {
  process.stderr.write(result.stdout ?? "")
  process.stderr.write(result.stderr ?? "")
  // A database made by an earlier set of migrations already has these tables: it cannot be brought forward.
  if (/already exists/i.test(`${result.stdout ?? ""}${result.stderr ?? ""}`)) {
    process.stderr.write(
      "\nThis local database was made by an earlier version of migrations/. Run `bun run db:reset` once to start " +
        "again with an empty one (your local imports and records are deleted), then start the app again.\n"
    )
  }
  process.exit(result.status ?? 1)
}
// Wrangler marks each applied file with ✅, and also says "✅ No migrations to apply!" when there is nothing to do.
const applied = /No migrations to apply/.test(result.stdout) ? 0 : (result.stdout.match(/✅/g) ?? []).length
console.log(applied > 0 ? `Local database: applied ${applied} migration(s).` : "Local database: up to date.")

// Sign-in accounts for the seeded people (local only; see scripts/dev-accounts.mjs). Safe to apply on every start.
const seed = spawnSync(
  process.execPath,
  [wrangler, "d1", "execute", "DB", "--local", "--file", "scripts/dev-accounts.sql"],
  {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, CI: "true", WRANGLER_SEND_METRICS: "false" },
    encoding: "utf8"
  }
)
if (seed.status !== 0) {
  process.stderr.write(seed.stdout ?? "")
  process.stderr.write(seed.stderr ?? "")
  process.exit(seed.status ?? 1)
}
console.log('Local database: test accounts ready (README.md, "Signing in").')

// A development secret for the session cookies, so sign-in works from the first `bun run dev` and a restart keeps
// everyone signed in. Written once into .dev.vars (git-ignored, beside the app), and only when it has no
// BETTER_AUTH_SECRET with a value: the script looks for that one line and changes nothing else in the file. The same
// 32 random bytes as `openssl rand -base64 32`. A deployed copy never reads this file: it uses
// `wrangler secret put BETTER_AUTH_SECRET` (.dev.vars.example).
const devVars = new URL("../.dev.vars", import.meta.url)
const current = existsSync(devVars) ? readFileSync(devVars, "utf8") : ""
if (!/^\s*BETTER_AUTH_SECRET\s*=\s*\S/m.test(current)) {
  const line = `BETTER_AUTH_SECRET=${randomBytes(32).toString("base64")}`
  const blank = /^\s*BETTER_AUTH_SECRET\s*=\s*$/m
  const next = blank.test(current)
    ? current.replace(blank, line)
    : `${current}${current === "" || current.endsWith("\n") ? "" : "\n"}# Written by \`bun run dev\` for local sign-in.\n${line}\n`
  writeFileSync(devVars, next, { mode: 0o600 })
  console.log("Sign-in: wrote a development BETTER_AUTH_SECRET into .dev.vars (git-ignored).")
}
