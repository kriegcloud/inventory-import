import { unsafeAssert } from "@beep/unsafe-assert"
// Build configuration, run by Node. Its settings come from the environment through Vite's own `loadEnv`, only the
// names below; it reads no file and imports no Node module.
import { cloudflare } from "@cloudflare/vite-plugin"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import compression from "compression"
import * as A from "effect/Array"
import * as Str from "effect/String"
import { visualizer } from "rollup-plugin-visualizer"
import { type Connect, defineConfig, loadEnv, type Plugin, type PluginOption } from "vite"
import { reachableSources } from "./scripts/reachable-sources.mjs"

// One dev server: Vite serves the React app, and the Cloudflare plugin runs
// src/server/worker.ts in workerd (the production runtime) for /api/*.

/** A file's path from its `file:` URL, ".." resolved. Written this way, `bun run beep laws screens` reads the list below. */
const fileURLToPath = (url: URL): string => decodeURIComponent(url.pathname)

/** The settings this file reads from the environment: nothing else in it is read. */
interface BuildSettings {
  readonly httpsCertificate: string | undefined
  readonly httpsKey: string | undefined
  readonly previewCompression: boolean
  readonly bundleReport: boolean
  readonly servedByAlchemy: boolean
}

const buildSettings = (mode: string): BuildSettings => {
  const env = loadEnv(mode, fileURLToPath(new URL(".", import.meta.url)), [
    "INVENTORY_HTTPS_",
    "PREVIEW_COMPRESSION",
    "BUNDLE_REPORT",
    "ALCHEMY_CLOUDFLARE_VITE_INJECTED"
  ])
  return {
    // `bun run dev:https` (scripts/dev-https.mjs) sets these to a local certificate and key (PEM text), so the dev
    // server speaks HTTPS the way a deployed copy does. `bun run dev` leaves them unset and serves plain HTTP.
    httpsCertificate: env["INVENTORY_HTTPS_CERT_PEM"],
    httpsKey: env["INVENTORY_HTTPS_KEY_PEM"],
    previewCompression: env["PREVIEW_COMPRESSION"] !== "off",
    bundleReport: env["BUNDLE_REPORT"] === "1",
    // `bun run dev:alchemy` (the trial of `alchemy dev`, goals/alchemy-uptake) starts Vite itself and adds its own
    // Cloudflare plugin, with the stack's bindings; it sets this before the file is read. Two Cloudflare plugins in
    // one server each start the Worker, so ours stands down. Unset everywhere else.
    servedByAlchemy: env["ALCHEMY_CLOUDFLARE_VITE_INJECTED"] === "1"
  }
}

// `bun run preview` compresses what it sends the way Cloudflare does in production (brotli when the browser takes it,
// else gzip; fonts and images as they are), so Lighthouse on the preview measures the bytes a person downloads.
// `PREVIEW_COMPRESSION=off bun run preview` sends everything as it is, for a comparison. Registered before the
// Cloudflare plugin, so it wraps the Worker's answers and the static files alike.
const compressPreview = (settings: BuildSettings): Plugin => ({
  name: "inventory:compress-preview",
  configurePreviewServer(server) {
    // Typed for Express, which hands it the same Node request and response as Vite's server does.
    if (settings.previewCompression) {
      server.middlewares.use(
        unsafeAssert<Connect.NextHandleFunction>(
          compression(),
          "Compression only uses the Node request and response operations supplied by Vite Connect; its declarations unnecessarily require Express request extensions."
        )
      )
    }
  }
})

// `bun run build:report`: what each chunk of the browser's build is made of, as a treemap
// (.scratch/bundle/client.html) and as data (.scratch/bundle/client.json), with gzip and brotli sizes. Read it
// before moving code between chunks; do not guess. The Worker's build is left out: nobody downloads it.
const bundleReport = (settings: BuildSettings): Array<PluginOption> =>
  settings.bundleReport
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
  "@inventory/access-web": fileURLToPath(new URL("../../packages/access/web", import.meta.url)),
  "@inventory/catalog-web": fileURLToPath(new URL("../../packages/catalog/web", import.meta.url))
}
// The data grid's page, which App.tsx shows only in a development build (`import.meta.env.DEV`). The walk reads
// imports as text and cannot see that condition, so the page is named: no production screen draws the grid, and
// following it put 19 kB of its classes into every page's stylesheet (143,797 bytes against 124,636).
const developmentPages = [`${web}/pages/GridGallery.tsx`]

const usedSourcesOnly = (): Plugin => ({
  name: "inventory:used-sources",
  apply: "build",
  enforce: "pre",
  transform(code, id) {
    if (!Str.endsWith("/src/web/index.css")(id)) return undefined
    const files = reachableSources({
      entry: `${web}/main.tsx`,
      root: web,
      alias: web,
      packages: screenPackages,
      except: developmentPages
    })
    const sources = A.join(
      A.map(files, (file) => `@source "${file}";`),
      "\n"
    )
    if (!Str.includes('@source "./";')(code)) throw new Error('index.css must name its sources with @source "./";')
    const narrowed = Str.replace(/^@source "\.\.\/\.\.\/\.\.\/\.\.\/packages\/[^"]+";\n/gm, "")(code)
    return Str.replace('@source "./";', sources)(narrowed)
  }
})

// The effect modules the file reader's worker imports, for @beep/csv and @beep/xlsx (see optimizeDeps below).
const readerModules = [
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
  "effect/Utils",
  "effect/MutableHashMap",
  "effect/MutableHashSet",
  "effect/Order",
  "effect/Schema",
  "effect/encoding/Xml",
  "effect/encoding/Zip"
]

export default defineConfig(({ mode }) => {
  const settings = buildSettings(mode)
  const https =
    settings.httpsCertificate !== undefined && settings.httpsKey !== undefined
      ? { cert: settings.httpsCertificate, key: settings.httpsKey }
      : undefined
  return {
    plugins: [
      ...bundleReport(settings),
      usedSourcesOnly(),
      compressPreview(settings),
      react(),
      tailwindcss(),
      ...(settings.servedByAlchemy ? [] : [cloudflare()])
    ],
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src/web", import.meta.url)) }
    },
    // `cors: false`: Vite's dev and preview servers otherwise answer any localhost origin with
    // Access-Control-Allow-Origin, so another app on this machine could read this API's answers. The Worker grants no
    // origin access, and neither do the servers in front of it.
    server: { port: 5173, strictPort: false, cors: false, ...(https === undefined ? {} : { https }) },
    preview: { cors: false },
    // The file reader loads on the first file, so Vite found its dependencies only then, optimised them and reloaded the
    // page: the first file on a cold dev server was lost. Listed here, they are ready at start: the effect modules
    // @beep/csv, @beep/xlsx and the vendored kit reach (workspace source, which Vite serves as it is, so their own
    // imports are what it would otherwise discover late).
    optimizeDeps: { include: readerModules },
    // Keep every asset a file. Vite would otherwise inline small font subsets as data: URIs,
    // which the content security policy (font-src 'self') rightly blocks.
    build: { assetsInlineLimit: 0 },
    // The file reader's worker is an ES module, so it loads the CSV reader or the workbook reader as a chunk of its own, only
    // the one a file needs.
    worker: { format: "es" }
  }
})
