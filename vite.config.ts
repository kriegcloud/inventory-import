// @effect-diagnostics nodeBuiltinImport:off processEnv:off
// Build configuration, run by Node: it reads files and the process environment, which app code never does.
import { cloudflare } from "@cloudflare/vite-plugin"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import compression from "compression"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { visualizer } from "rollup-plugin-visualizer"
import { type Connect, defineConfig, type Plugin, type PluginOption } from "vite"
import { reachableSources } from "./scripts/reachable-sources.mjs"

// One dev server: Vite serves the React app, and the Cloudflare plugin runs
// src/server/worker.ts in workerd (the production runtime) for /api/*.

// `bun run dev:https` (scripts/dev-https.mjs) sets these to a local certificate, so the dev server speaks HTTPS the
// way a deployed copy does. `bun run dev` leaves them unset and serves plain HTTP.
const certificate = process.env["DEV_HTTPS_CERT"]
const key = process.env["DEV_HTTPS_KEY"]
const https =
  certificate !== undefined && key !== undefined
    ? { cert: readFileSync(certificate), key: readFileSync(key) }
    : undefined

// `bun run preview` compresses what it sends the way Cloudflare does in production (brotli when the browser takes it,
// else gzip; fonts and images as they are), so Lighthouse on the preview measures the bytes a person downloads.
// `PREVIEW_COMPRESSION=off bun run preview` sends everything as it is, for a comparison. Registered before the
// Cloudflare plugin, so it wraps the Worker's answers and the static files alike.
const compressPreview = (): Plugin => ({
  name: "takehome:compress-preview",
  configurePreviewServer(server) {
    // Typed for Express, which hands it the same Node request and response as Vite's server does.
    if (process.env["PREVIEW_COMPRESSION"] !== "off") {
      server.middlewares.use(compression() as unknown as Connect.NextHandleFunction)
    }
  }
})

// `bun run build:report`: what each chunk of the browser's build is made of, as a treemap
// (.scratch/bundle/client.html) and as data (.scratch/bundle/client.json), with gzip and brotli sizes. Read it
// before moving code between chunks; do not guess. The Worker's build is left out: nobody downloads it.
const bundleReport = (): Array<PluginOption> =>
  process.env["BUNDLE_REPORT"] === "1"
    ? [
        {
          ...visualizer({
            filename: ".scratch/bundle/client.html",
            template: "treemap",
            gzipSize: true,
            brotliSize: true
          }),
          applyToEnvironment: (environment) => environment.name === "client"
        },
        {
          ...visualizer({
            filename: ".scratch/bundle/client.json",
            template: "raw-data",
            gzipSize: true,
            brotliSize: true
          }),
          applyToEnvironment: (environment) => environment.name === "client"
        }
      ]
    : []

// The production stylesheet holds the classes of the files the app can load, not of every component installed:
// `@source "./"` in index.css (all of src/web, what development scans) becomes one `@source` per file reached from
// the entry (scripts/reachable-sources.mjs). Runs before Tailwind reads the file.
const web = fileURLToPath(new URL("./src/web", import.meta.url))
const usedSourcesOnly = (): Plugin => ({
  name: "takehome:used-sources",
  apply: "build",
  enforce: "pre",
  transform(code, id) {
    if (!id.endsWith("/src/web/index.css")) return undefined
    const files = reachableSources({ entry: `${web}/main.tsx`, root: web, alias: web })
    const sources = files.map((file) => `@source "${file}";`).join("\n")
    if (!code.includes('@source "./";')) throw new Error('index.css must name its sources with @source "./";')
    return code.replace('@source "./";', sources)
  }
})

export default defineConfig({
  plugins: [...bundleReport(), usedSourcesOnly(), compressPreview(), react(), tailwindcss(), cloudflare()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src/web", import.meta.url)) }
  },
  // `cors: false`: Vite's dev and preview servers otherwise answer any localhost origin with
  // Access-Control-Allow-Origin, so another app on this machine could read this API's answers. The Worker grants no
  // origin access, and neither do the servers in front of it.
  server: { port: 5173, strictPort: false, cors: false, ...(https === undefined ? {} : { https }) },
  preview: { cors: false },
  // The file reader loads on the first file, so Vite found its two dependencies only then, optimised them and
  // reloaded the page: the first file on a cold dev server was lost. Listed here, they are ready at start.
  optimizeDeps: { include: ["papaparse", "xlsx/dist/xlsx.mini.min.js"] },
  // Keep every asset a file. Vite would otherwise inline small font subsets as data: URIs,
  // which the content security policy (font-src 'self') rightly blocks.
  build: { assetsInlineLimit: 0 },
  // The file reader's worker is an ES module, so it loads papaparse or SheetJS as a chunk of its own, only the one a
  // file needs.
  worker: { format: "es" }
})
