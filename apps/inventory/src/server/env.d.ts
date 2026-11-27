// Bindings and variables from wrangler.jsonc, plus secrets from .dev.vars (local) or the stack's `env` (deployed).
// Only worker.ts reads `env`, and only to pass the D1 binding and to build the ConfigProvider that src/server/Settings.ts
// reads every setting through. Valid values for each are in .dev.vars.example.
interface Env {
  readonly DB: D1Database
  /** The coarse limit's counter: 30 in 60 seconds for each key (AddressLimit.ts). */
  readonly ABUSE_LIMIT: RateLimit
  /**
   * The service binding to the model's Worker (Models.ts), which the stack declares under `bun run dev:alchemy` and
   * deployed. Absent under `bun run dev` (wrangler.jsonc declares none): the models run in memory there.
   */
  readonly MODEL?: Fetcher
  readonly AI_MODEL: string
  readonly AI_FALLBACK_MODELS?: string
  readonly AI_ENABLED?: string
  readonly OPENROUTER_API_KEY?: string
  readonly LOG_LEVEL?: string
  readonly LOG_FORMAT?: string
  readonly EFFECT_DEVTOOLS_URL?: string
  readonly OTEL_EXPORTER_OTLP_ENDPOINT?: string
  readonly OTEL_SERVICE_NAME?: string
  /** Signs session cookies. At least 32 characters; required in production. */
  readonly BETTER_AUTH_SECRET?: string
  /** The deployed origin, for example https://app.example.com. Unset locally: each request's origin is used. */
  readonly BETTER_AUTH_URL?: string
  readonly PWNED_PASSWORD_CHECK?: string
  readonly TEST_ACCOUNTS?: string
  readonly TEST_ACCOUNT_PASSWORD?: string
  readonly SIGN_UP?: string
}

declare namespace Cloudflare {
  interface Env extends globalThis.Env {}
}
