import { Array as Arr, Config, Option, Redacted, String as Str } from "effect"
import * as S from "effect/Schema"

// SETTINGS. Every setting and secret the server reads is declared here, as an `effect/Config`, and nowhere else reads
// the environment. The Worker builds a ConfigProvider from its `env` (worker.ts); a test passes its own. Secrets are
// `Config.Redacted`: printed, logged or serialised they read "<redacted>", and only `Redacted.value` at the one call
// that needs the key opens them. Each variable, with its valid values, is listed in `.dev.vars.example`.
//
// The browser never reads these. It sees only public `VITE_*` flags (src/web/lib/api.ts).

/**
 * How log lines are written (LOG_FORMAT). Valid values: `pretty` (readable, colours where the terminal has them),
 * `json` (one JSON object per line: what Cloudflare Workers Logs indexes), `logfmt` (key=value pairs on one line),
 * `structured` (one object per line, for a console that renders objects). Default: `pretty` in development, `json`
 * in a production build.
 */
export const LogFormat = S.Literals(["pretty", "json", "logfmt", "structured"]).annotate({
  description: "How log lines are written: pretty, json, logfmt or structured."
})
/** One of the `LogFormat` names. */
export type LogFormat = typeof LogFormat.Type

/**
 * The logging settings.
 *
 * - `LOG_LEVEL`: the least severe entry written. Valid values, most to least verbose: `All`, `Trace`, `Debug`,
 *   `Info`, `Warn`, `Error`, `Fatal`, `None` (exactly as written: `Info`, not `info`). Default `Info`.
 * - `LOG_FORMAT`: see `LogFormat`.
 */
export const logSettings = (defaults: { readonly format: LogFormat }) =>
  Config.all({
    level: Config.LogLevel("LOG_LEVEL").pipe(Config.withDefault("Info" as const)),
    format: Config.schema(LogFormat, "LOG_FORMAT").pipe(Config.withDefault(defaults.format))
  })

/** An address setting: unset or blank is none, anything else must be a URL. */
export const optionalUrl = (name: string) =>
  Config.schema(S.Union([S.Literal(""), S.URL]), name).pipe(
    Config.withDefault(""),
    Config.map((url) => (url === "" ? Option.none() : Option.some(url)))
  )

/**
 * The Worker's Effect DevTools client (src/server/RequestTelemetry.ts): `EFFECT_DEVTOOLS_URL`, the DevTools server's
 * WebSocket address (`ws://localhost:34437`, where the editor extension listens). Unset, the default: off. Read by a
 * development build only; a production build has no DevTools client in the Worker at all.
 */
export const devToolsSettings = optionalUrl("EFFECT_DEVTOOLS_URL")

/** A key that is set but blank (`OPENROUTER_API_KEY=" "`) is the same as no key. */
const present = (key: Option.Option<Redacted.Redacted<string>>) =>
  Option.filter(key, (value) => Str.trim(Redacted.value(value)) !== "")

/**
 * The model settings. AI is on only when a key is set and `AI_ENABLED` is not false; otherwise every feature uses
 * its non-AI path and `/api/v1/system/status` says why.
 *
 * - `AI_ENABLED`: `true` or `false` (also yes/no, on/off, 1/0). Default `true`. `false` turns AI off with a key set.
 * - `AI_MODEL`: the vendor/model id asked first (wrangler.jsonc `vars`). Required.
 * - `AI_FALLBACK_MODELS`: comma-separated vendor/model ids OpenRouter tries, in order, when the first fails
 *   (OpenRouter's `models` list). Default: none.
 * - `OPENROUTER_API_KEY`: secret. An OpenRouter key; it also reports what a call cost.
 */
export const aiSettings = Config.all({
  enabled: Config.Boolean("AI_ENABLED").pipe(Config.withDefault(true)),
  model: Config.schema(S.Trim.check(S.isNonEmpty()), "AI_MODEL"),
  fallbackModels: Config.Array(S.Trim, "AI_FALLBACK_MODELS").pipe(
    Config.map(Arr.filter((model) => model !== "")),
    Config.withDefault<ReadonlyArray<string>>([])
  ),
  openRouterKey: Config.Redacted("OPENROUTER_API_KEY").pipe(Config.option, Config.map(present))
})
/** The decoded model settings. */
export type AiSettings = Config.Success<typeof aiSettings>

/**
 * Telemetry to a collector (src/server/Telemetry.ts; `bun run telemetry` starts one locally).
 *
 * - `OTEL_EXPORTER_OTLP_ENDPOINT`: the collector's OTLP over HTTP address (`http://localhost:4318` for the local
 *   stack). Unset, the default: off, and nothing is built or sent. Set, the Worker's and the browser's traces, metrics
 *   and logs go there; the browser's through the app's own /api/otlp.
 * - `OTEL_SERVICE_NAME`: the service name the Worker's carry. Default `inventory`; the browser's are `inventory-web`.
 */
export const telemetrySettings = Config.all({
  endpoint: optionalUrl("OTEL_EXPORTER_OTLP_ENDPOINT"),
  serviceName: Config.String("OTEL_SERVICE_NAME").pipe(Config.withDefault("inventory"))
})
