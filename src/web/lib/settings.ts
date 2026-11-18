// The browser's settings: the public `VITE_*` flags, decoded once, here and nowhere else.
import { Config, ConfigProvider, Effect } from "effect"

/**
 * The browser's settings: public `VITE_*` flags only, read here and nowhere else. Vite compiles every `VITE_*` value
 * into the bundle, so anything read here is public; secrets live on the server (src/server/Settings.ts).
 *
 * - `VITE_EFFECT_DEVTOOLS`: true or false, default false. In development, connect this runtime to the Effect DevTools
 *   panel. Off by default because with nothing listening the first call waits up to a second.
 * - `VITE_EFFECT_DEVTOOLS_URL`: the panel's WebSocket address. Empty by default: ./devtools.ts then uses the
 *   extension's own address, so a production build holds no DevTools address at all.
 */
const PublicSettings = Config.all({
  effectDevTools: Config.Boolean("VITE_EFFECT_DEVTOOLS").pipe(Config.withDefault(false)),
  effectDevToolsUrl: Config.String("VITE_EFFECT_DEVTOOLS_URL").pipe(Config.withDefault(""))
})

/** The decoded public flags. A flag with a value that is not valid is reported in the console and left at its default. */
export const publicSettings = Effect.runSync(
  PublicSettings.parse(ConfigProvider.fromUnknown(import.meta.env)).pipe(
    Effect.catch((error) =>
      Effect.as(Effect.logWarning("A VITE_* flag is not valid; using the default.", String(error)), {
        effectDevTools: false,
        effectDevToolsUrl: ""
      })
    )
  )
)
