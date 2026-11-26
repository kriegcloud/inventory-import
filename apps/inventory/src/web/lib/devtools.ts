import * as Effect from "effect/Effect"
// Effect DevTools for the browser, in development only, switched on with `VITE_EFFECT_DEVTOOLS=true` (and
// `VITE_EFFECT_DEVTOOLS_URL` for another address, both read in ./settings.ts). The layer sends every span the browser's
// runtime makes (each API call, each file read) to the Effect DevTools listener in the editor, on
// ws://localhost:34437. Two rules this file protects:
// - A production build has none of it: `import.meta.env.DEV` is the constant false there, so the bundler drops the
//   layer and the `effect/devtools` module with it (checked by searching the built assets, `docs/kit.md`).
// - Silent unless asked for. The browser prints an error to the console for every refused WebSocket, and the client
//   tries again every second, so connecting by default would print one a second whenever the listener is closed.
//   Measured in headless Chrome: one refused connection is one console error.
import * as Layer from "effect/Layer"
import * as DevTools from "effect/devtools/DevTools"
import { BrowserSettings, publicSettings } from "./settings.ts"

/**
 * The DevTools tracer when running `bun run dev` with `VITE_EFFECT_DEVTOOLS=true`, nothing otherwise and nothing in
 * production. The browser's one runtime (`appRuntime` in ./api.ts) merges it; never build a second runtime with it,
 * or DevTools gets a second connection. Switched on with nothing listening, the runtime waits at most one second when it starts, then
 * keeps trying once a second in the background; it never fails a request.
 */
export const devToolsLayer: Layer.Layer<never> = Layer.unwrap(
  Effect.map(BrowserSettings, (settings) =>
    import.meta.env.DEV && settings.effectDevTools
      ? DevTools.layer(settings.effectDevToolsUrl === "" ? "ws://localhost:34437" : settings.effectDevToolsUrl)
      : Layer.empty
  )
).pipe(Layer.provide(publicSettings))
