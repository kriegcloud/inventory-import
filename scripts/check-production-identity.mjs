// Fails the build when the production Worker bundle could still let a header choose who the actor is.
// The test identity (src/server/Identity.ts, `IdentityLive`) reads `x-acting-as`; the Worker uses the session
// identity (src/server/SessionIdentity.ts). Run by `bun run build` after `vite build`.
import { existsSync, readdirSync, readFileSync } from "node:fs"

// The Worker's build folder: the Cloudflare plugin names it after the Worker, with "_" for "-" ("acme-app" builds
// to dist/acme_app/). Found by its wrangler.json, so no name is guessed.
const dist = new URL("../dist/", import.meta.url)
const workers = readdirSync(dist).filter((name) => existsSync(new URL(`${name}/wrangler.json`, dist)))
if (workers.length !== 1) {
  console.error(`Production identity check FAILED: expected one Worker build in dist/, found ${workers.length}.`)
  process.exit(1)
}
const dir = new URL(`${workers[0]}/`, dist)
const files = [
  "index.js",
  ...readdirSync(new URL("assets/", dir))
    .filter((f) => f.endsWith(".js"))
    .map((f) => `assets/${f}`)
]
// The test identity's own refusal sentence, and the header it reads. Neither belongs in what is deployed.
const markers = ["The test identity names no member", "x-acting-as"]
const found = files.flatMap((file) => {
  const text = readFileSync(new URL(file, dir), "utf8")
  return markers.filter((marker) => text.includes(marker)).map((marker) => `${file}: "${marker}"`)
})
if (found.length > 0) {
  console.error(
    `Production identity check FAILED: the header identity is in the Worker bundle.\n  ${found.join("\n  ")}`
  )
  process.exit(1)
}
console.log(
  `Production identity check OK: no header identity in ${files.length} Worker files; sign-in is the only way in.`
)
