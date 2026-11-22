import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// Serves one experiment's page: `bun run scratch:serve experiments/<name>`. Its cache is that experiment's own, in its
// ignored `.state` folder (a relative `cacheDir` is read from the folder served). Its port is the first free one from
// 5273 upward, so two experiments can be served at once, and never the app's 5173. The app's build never reads this
// file or an experiment.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  cacheDir: ".state/vite",
  server: { port: 5273, strictPort: false }
})
