// `bun run dev:https`: the dev server over HTTPS with a local certificate, so the app runs the way a deployed copy
// does: an https: origin, Secure cookies once sign-in is added, and HSTS that the browser actually applies. Optional:
// `bun run dev` stays plain HTTP and needs none of this. Arguments pass through to Vite
// (`bun run dev:https -- --port 5174 --strictPort`).
//
// The certificate comes from, in order:
// 1. DEV_HTTPS_CERT and DEV_HTTPS_KEY, if both are set: your own certificate and key files (PEM).
// 2. .wrangler/certs/localhost.pem, made by an earlier run.
// 3. mkcert (https://github.com/FiloSottile/mkcert), which this script runs to make one for localhost, 127.0.0.1 and
//    ::1. For the browser to trust it, run `mkcert -install` once per machine: it adds mkcert's local certificate
//    authority to the system and browser trust stores. This script never runs that; it changes what the machine
//    trusts, so it is your call. Without it the page still loads after the browser's certificate warning.
import { spawn, spawnSync } from "node:child_process"
import { existsSync, mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("..", import.meta.url))
const folder = `${root}.wrangler/certs`
const made = { cert: `${folder}/localhost.pem`, key: `${folder}/localhost-key.pem` }

const own = process.env.DEV_HTTPS_CERT !== undefined && process.env.DEV_HTTPS_KEY !== undefined
const files = own ? { cert: process.env.DEV_HTTPS_CERT, key: process.env.DEV_HTTPS_KEY } : made

if (!own && !(existsSync(made.cert) && existsSync(made.key))) {
  const version = spawnSync("mkcert", ["-version"], { encoding: "utf8" })
  if (version.error !== undefined || version.status !== 0) {
    console.error(
      "dev:https needs a certificate. Install mkcert (https://github.com/FiloSottile/mkcert) and run this again, or set\n" +
        "DEV_HTTPS_CERT and DEV_HTTPS_KEY to a certificate and key of your own. `bun run dev` needs neither."
    )
    process.exit(1)
  }
  mkdirSync(folder, { recursive: true })
  const result = spawnSync(
    "mkcert",
    ["-cert-file", made.cert, "-key-file", made.key, "localhost", "127.0.0.1", "::1"],
    {
      stdio: "inherit"
    }
  )
  if (result.status !== 0) process.exit(result.status ?? 1)
  console.log("Made a certificate for localhost in .wrangler/certs (git-ignored).")
  console.log("If the browser warns about it, run `mkcert -install` once to trust mkcert's local authority.")
}

/** A file inside an installed package: the nearest `node_modules` up from this script (the workspace root's, hoisted). */
const installed = (path) => {
  for (let dir = dirname(fileURLToPath(import.meta.url)); ; dir = dirname(dir)) {
    const candidate = join(dir, "node_modules", path)
    if (existsSync(candidate)) return candidate
    if (dirname(dir) === dir) throw new Error(`${path} is not installed: run \`bun install\` at the repository root.`)
  }
}

const vite = installed("vite/bin/vite.js")
const child = spawn(process.execPath, [vite, ...process.argv.slice(2)], {
  stdio: "inherit",
  env: { ...process.env, DEV_HTTPS_CERT: files.cert, DEV_HTTPS_KEY: files.key }
})
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal))
child.on("exit", (code, signal) => process.exit(code ?? (signal === null ? 0 : 1)))
