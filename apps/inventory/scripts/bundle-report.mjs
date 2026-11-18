// `bun run build:report`: what each chunk of the browser's build is made of, read from the visualizer's data
// (.scratch/bundle/client.json; the treemap is .scratch/bundle/client.html). One line per chunk, largest first, with
// its brotli size and the packages (or app folders) that make it up, so a byte is moved to the route that needs it
// on evidence, not on a guess.
//   bun run build:report               every chunk over 2 kB
//   bun run build:report -- index      only the chunks whose name contains "index"
import { readFileSync } from "node:fs"

const data = JSON.parse(readFileSync(new URL("../.scratch/bundle/client.json", import.meta.url), "utf8"))
const filter = process.argv[2] ?? ""
const kb = (n) => `${(n / 1024).toFixed(1)} kB`

// Which package or app folder a module belongs to: "effect", "@tanstack/react-table", "src/web/pages".
const ownerOf = (id) => {
  const clean = id.replace(/^\0/, "")
  const at = clean.lastIndexOf("/node_modules/")
  if (at >= 0) {
    const parts = clean.slice(at + "/node_modules/".length).split("/")
    return parts[0]?.startsWith("@") ? `${parts[0]}/${parts[1]}` : (parts[0] ?? clean)
  }
  const src = clean.indexOf("/src/")
  if (src >= 0)
    return clean
      .slice(src + 1)
      .split("/")
      .slice(0, 3)
      .join("/")
  return clean.split("/").slice(-2).join("/")
}

const chunks = new Map()
for (const meta of Object.values(data.nodeMetas)) {
  for (const [chunk, partUid] of Object.entries(meta.moduleParts)) {
    const part = data.nodeParts[partUid]
    if (part === undefined || part.renderedLength === 0) continue
    const entry = chunks.get(chunk) ?? { rendered: 0, brotli: 0, owners: new Map() }
    entry.rendered += part.renderedLength
    entry.brotli += part.brotliLength
    const owner = ownerOf(meta.id)
    const sum = entry.owners.get(owner) ?? { rendered: 0, brotli: 0 }
    sum.rendered += part.renderedLength
    sum.brotli += part.brotliLength
    entry.owners.set(owner, sum)
    chunks.set(chunk, entry)
  }
}

const rows = [...chunks.entries()]
  .filter(([name, entry]) => name.includes(filter) && entry.rendered > 2048)
  .sort((a, b) => b[1].rendered - a[1].rendered)
for (const [name, entry] of rows) {
  const owners = [...entry.owners.entries()]
    .sort((a, b) => b[1].rendered - a[1].rendered)
    .slice(0, 8)
    .map(([owner, sum]) => `${owner} ${kb(sum.rendered)}`)
    .join(", ")
  console.log(`${name}  ${kb(entry.rendered)} (brotli ${kb(entry.brotli)}): ${owners}`)
}
console.log("Treemap: .scratch/bundle/client.html")
