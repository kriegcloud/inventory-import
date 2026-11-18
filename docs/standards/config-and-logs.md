---
type: Standard
title: Settings, logs and traces
description: Settings and secrets come through Effect Config on the server, a missing setting turns its feature off, and logs, failures and spans are useful without leaking anything.
tags: [effect, cloudflare, security]
status: draft
---

## Settings

- **Every setting and secret is read through `effect/Config`** on the server, from a `ConfigProvider` built from the
  Worker's `env` (`ConfigProvider.fromUnknown(env)`); secrets as `Config.Redacted`, so a log never prints them.
  Bindings such as the database stay on `env`. Check: no `env.SOME_SETTING` read outside the one place that builds
  the provider.
- **The browser reads only public `VITE_*` flags.** Anything the browser reads is public: never a secret, never a
  value that must be checked on the server. Check: no key or secret name under `import.meta.env` in `src/web`.
- **A feature whose setting is missing is off, and says so**: the AI features without a key, the breached-password
  check outside production, telemetry and the developer tools unless configured. The one command in the README still
  runs everything else. Check: with an empty `.dev.vars`, the app starts and the status screen names what is off.

## Logs

- **Logs go through `Effect.log*` and `effect/Logger`**, never `console`. JSON in production, readable in
  development. Check: `rg "console\." src/server` finds nothing.
- **The level and format are settings**: `LOG_LEVEL` and `LOG_FORMAT`, read through `Config.LogLevel` and
  `Config.Literals`, with a comment beside them that lists the valid values (`All`, `Fatal`, `Error`, `Warn`,
  `Info`, `Debug`, `Trace`, `None`; `pretty`, `json`, `logfmt`, `structured`), in `src/server/Settings.ts` and
  `.dev.vars.example`. Check: `LOG_LEVEL=Debug` shows debug lines and
  `LOG_LEVEL=Warn` hides info lines.
- **A log names who acted and what failed, never what is secret**: no key, cookie, token or row content beyond ids.
  Check: read the log of one import and one refused request.

## Failures

- **Failures are reported through `effect/ErrorReporter`** with `Cause.pretty`, so a defect is seen once with its
  cause. Check: a request that dies shows one report with its cause in the log, and a sentence on screen.
- **Errors accumulate where they can** (`Effect.partition`, `Effect.validate`): a loop over rows or fields collects
  every failure before it answers ([errors](errors.md)). Check: a test with two bad inputs gets both back.
- **Teardown is honest**: resources are scoped and their finalizers run where the runtime runs them. A Worker isolate
  can be dropped without a hook, and the code says so where that matters. Check: the comment sits beside the layer.

## Traces

- **A span on every service call and on every sign-in call** (`Effect.fn("Service.method")`). Browser telemetry goes
  through our own origin, never straight to a third party. Check: one request shows its service spans in the log.
- **The telemetry stack is an optional module** (`bun run telemetry`: Grafana's LGTM image, which needs Docker), never
  part of `bun run dev`. With `OTEL_EXPORTER_OTLP_ENDPOINT` set it receives the browser's and the server's traces,
  metrics and logs, the Worker's built per request and sent after the answer; unset, nothing is built or sent. Check:
  `bun run dev` starts with Docker stopped, and a request is no slower with the endpoint unset.
- **Effect DevTools in development, in the browser and in the Worker.** `VITE_EFFECT_DEVTOOLS=true bun run dev` sends
  the browser's spans to the Effect DevTools extension on port 34437; `EFFECT_DEVTOOLS_URL=ws://localhost:34437` in
  `.dev.vars` sends the Worker's, through one client per request finished after the answer, which works inside the
  Worker (a client built once for the isolate goes silent after the first request; both measured, and the code says
  so beside the layer). Off by default, and never in a production build. Check: a production build holds no
  DevTools address.
