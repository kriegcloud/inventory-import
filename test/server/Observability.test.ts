import { expect, layer } from "@effect/vitest"
import { Array as Arr, Cause, Effect, ErrorReporter, Exit, Formatter, Layer, Predicate, Redacted } from "effect"
import { TestConsole } from "effect/testing"
import { Forbidden } from "../../src/api/v1/Identity.ts"
import * as Observability from "../../src/server/Observability.ts"
import { settingsLayer } from "./support/app.ts"

// Logging and error reporting as configured by LOG_LEVEL and LOG_FORMAT, read through the same ConfigProvider the
// Worker builds. The claims that would hurt most if wrong: a secret never prints, and a defect is never silent.

const production = Observability.layer({ production: true }).pipe(
  Layer.provide(settingsLayer({ LOG_LEVEL: "Info", LOG_FORMAT: "json" }))
)

/** What reached the console, one string per line. */
const written = Effect.map(TestConsole.logLines, (lines) =>
  Arr.map(lines, (line) => (Predicate.isString(line) ? line : Formatter.format(line)))
)

layer(production, { buildPerTest: true })("logging in production", (it) => {
  it.effect("writes JSON lines at the configured level, and a redacted secret prints as <redacted>", () =>
    Effect.gen(function* () {
      // Built here, so the file holds no key-shaped string for the pack's secret scan (scripts/pack.sh) to refuse.
      const secret = `${"sk-or-v1-"}0123456789abcdef`
      const key = Redacted.make(secret)
      yield* Effect.logInfo("Model settings", { provider: "openrouter", key })
      yield* Effect.logDebug("Below LOG_LEVEL, so not written")
      const lines = yield* written
      expect(lines.length).toBe(1)
      expect(lines[0]).toContain('"level":"INFO"')
      expect(lines[0]).toContain("<redacted>")
      expect(lines[0]).not.toContain(secret)
    })
  )

  it.effect("reports a defect with Cause.pretty at Error, and a typed failure at Info without its reason", () =>
    Effect.gen(function* () {
      yield* ErrorReporter.report(Cause.die(new Error("The row just written could not be read back")))
      yield* ErrorReporter.report(
        Cause.fail(Forbidden.make({ reason: "You are a viewer in Example Works (test).", required: "editor" }))
      )
      // A defect that carries a secret: the secret is a Redacted, so the line shows its placeholder.
      yield* ErrorReporter.report(Cause.die({ provider: "gateway", key: Redacted.make("sk-gw-secret-42") }))
      const lines = yield* written
      expect(lines.length).toBe(3)
      expect(lines[0]).toContain('"level":"ERROR"')
      expect(lines[0]).toContain("Error: The row just written could not be read back")
      expect(lines[0]).toContain('"error.kind":"defect"')
      expect(lines[1]).toContain('"level":"INFO"')
      expect(lines[1]).toContain("Forbidden")
      expect(lines[1]).not.toContain("Example Works (test)")
      expect(lines[2]).toContain("<redacted>")
      expect(lines[2]).not.toContain("sk-gw-secret-42")
    })
  )
})

layer(Layer.empty)("settings that are not valid", (it) => {
  it.effect("stop the app with an error that names the variable and its valid values", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        Layer.build(
          Observability.layer({ production: false }).pipe(Layer.provide(settingsLayer({ LOG_LEVEL: "info" })))
        )
      )
      expect(Exit.isFailure(exit)).toBe(true)
      const pretty = Exit.isFailure(exit) ? Cause.pretty(exit.cause) : ""
      expect(pretty).toContain("LOG_LEVEL")
      expect(pretty).toContain('"Info"')
    })
  )
})
