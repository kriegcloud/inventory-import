import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// Serves one experiment's page: `bun run scratch:serve experiments/<name>`. Its own port, never the app's 5173, and
// its cache in the scratchpad's ignored `.state` folder. The app's build never reads this file or an experiment.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  cacheDir: new URL(".state/vite", import.meta.url).pathname,
  server: { port: 5273, strictPort: true }
})
