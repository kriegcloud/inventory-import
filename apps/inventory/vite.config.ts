// @effect-diagnostics nodeBuiltinImport:off processEnv:off
// Build configuration, run by Node: it reads files and the process environment, which app code never does.
import { cloudflare } from "@cloudflare/vite-plugin"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import compression from "compression"
import { Array as Arr, String as Str } from "effect"
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
  name: "inventory:compress-preview",
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
// the entry (scripts/reachable-sources.mjs), the design-system packages' files it imports included, and the
// packages' whole-folder `@source` lines are dropped. Runs before Tailwind reads the file.
const web = fileURLToPath(new URL("./src/web", import.meta.url))
const screenPackages = {
  "@inventory/ui": fileURLToPath(new URL("../../packages/ui", import.meta.url)),
  "@inventory/review": fileURLToPath(new URL("../../packages/review", import.meta.url)),
  "@inventory/access-web": fileURLToPath(new URL("../../packages/access/web", import.meta.url))
}
const usedSourcesOnly = (): Plugin => ({
  name: "inventory:used-sources",
  apply: "build",
  enforce: "pre",
  transform(code, id) {
    if (!Str.endsWith("/src/web/index.css")(id)) return undefined
    const files = reachableSources({ entry: `${web}/main.tsx`, root: web, alias: web, packages: screenPackages })
    const sources = Arr.join(
      Arr.map(files, (file) => `@source "${file}";`),
      "\n"
    )
    if (!Str.includes('@source "./";')(code)) throw new Error('index.css must name its sources with @source "./";')
    const narrowed = Str.replace(/^@source "\.\.\/\.\.\/\.\.\/\.\.\/packages\/[^"]+";\n/gm, "")(code)
    return Str.replace('@source "./";', sources)(narrowed)
  }
})

// The effect modules the CSV reader's worker imports (see optimizeDeps below).
const csvReaderModules = [
  "effect/Array",
  "effect/Boolean",
  "effect/ByteSize",
  "effect/Cause",
  "effect/Channel",
  "effect/Clock",
  "effect/Context",
  "effect/Data",
  "effect/DateTime",
  "effect/Effect",
  "effect/Equal",
  "effect/Exit",
  "effect/FileSystem",
  "effect/HashMap",
  "effect/HashSet",
  "effect/Layer",
  "effect/Match",
  "effect/Number",
  "effect/Option",
  "effect/Path",
  "effect/PlatformError",
  "effect/Predicate",
  "effect/Random",
  "effect/Record",
  "effect/RegExp",
  "effect/Result",
  "effect/SchemaIssue",
  "effect/SchemaParser",
  "effect/SchemaTransformation",
  "effect/Stream",
  "effect/String",
  "effect/Struct",
  "effect/Tuple",
  "effect/TxQueue",
  "effect/TxRef",
  "effect/Utils"
]

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
  // The file reader loads on the first file, so Vite found its dependencies only then, optimised them and reloaded the
  // page: the first file on a cold dev server was lost. Listed here, they are ready at start: SheetJS, and the
  // effect modules @beep/csv and the vendored kit reach (workspace source, which Vite serves as it is, so their own
  // imports are what it would otherwise discover late).
  optimizeDeps: { include: ["xlsx/dist/xlsx.mini.min.js", ...csvReaderModules] },
  // Keep every asset a file. Vite would otherwise inline small font subsets as data: URIs,
  // which the content security policy (font-src 'self') rightly blocks.
  build: { assetsInlineLimit: 0 },
  // The file reader's worker is an ES module, so it loads the CSV reader or SheetJS as a chunk of its own, only the one a
  // file needs.
  worker: { format: "es" }
})
