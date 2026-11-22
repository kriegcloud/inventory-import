// The optional telemetry stack (telemetry/compose.yaml): Grafana's otel-lgtm image, in Docker.
//   bun run telemetry        start it, wait until it answers, and say how to point the app at it
//   bun run telemetry:down   stop it and remove its container (the data goes with it)
// Ports: GRAFANA_PORT (3000), OTLP_HTTP_PORT (4318) and OTLP_GRPC_PORT (4317), from the environment.
// `bun run dev` never starts it, and the app runs the same without it.
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import * as Effect from "effect/Effect"

const compose = ["compose", "-f", fileURLToPath(new URL("../telemetry/compose.yaml", import.meta.url))]
const grafana = Number(process.env.GRAFANA_PORT ?? 3000)
const otlp = Number(process.env.OTLP_HTTP_PORT ?? 4318)
const command = process.argv[2] ?? "up"

const docker = (args) => {
  const result = spawnSync("docker", [...compose, ...args], { stdio: "inherit" })
  if (result.error !== undefined) {
    console.error("The telemetry stack needs Docker, and `docker` was not found. The app runs without it.")
    process.exit(1)
  }
  if (result.status !== 0) process.exit(result.status ?? 1)
}

if (command === "down") {
  docker(["down"])
  console.log("Telemetry stack stopped and removed.")
  process.exit(0)
}

docker(["up", "-d"])
// The image starts Grafana and the collector inside one container; both take a little while.
// A request nobody answers yet (the port not open, the connection reset) is not an error here: not ready, ask again.
const answers = (url, init) =>
  Effect.runPromise(
    Effect.tryPromise({ try: () => fetch(url, init), catch: () => "unanswered" }).pipe(
      Effect.map((response) => response.ok),
      Effect.orElseSucceed(() => false)
    )
  )
const deadline = Date.now() + 120_000
let ready = false
while (!ready && Date.now() < deadline) {
  ready =
    (await answers(`http://localhost:${grafana}/api/health`)) &&
    (await answers(`http://localhost:${otlp}/v1/traces`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: '{"resourceSpans":[]}'
    }))
  if (!ready) await new Promise((resolve) => setTimeout(resolve, 2000))
}
if (!ready) {
  console.error("The telemetry stack did not answer within two minutes: `docker logs inventory-telemetry` says why.")
  process.exit(1)
}
console.log(`
Telemetry stack running.
  Grafana:   http://localhost:${grafana}  (Explore: Tempo for traces, Loki for logs, Prometheus for metrics)
  Collector: http://localhost:${otlp} (OTLP over HTTP)

To send the app's traces, metrics and logs there, add this line to .dev.vars and restart \`bun run dev\`:
  OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:${otlp}
The browser's telemetry goes through the app's own /api/otlp, so nothing else changes.
Stop the stack with \`bun run telemetry:down\`.`)
