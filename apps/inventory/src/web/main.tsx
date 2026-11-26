import * as O from "effect/Option"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { appRuntime } from "@/lib/api"
import { modelSentences } from "@inventory/catalog-web/AnsweredByWords"
import { startTelemetry } from "@/lib/telemetry"
import { installTroubleSentences } from "@inventory/client/SayError"
import { Root } from "./Root.tsx"
import "./index.css"

// Development only: hold a key and click any element to copy its component and source location for a coding agent.
// It is never part of a production build.
if (import.meta.env.DEV) {
  void import("react-grab")
}

// A model failure is said in the contract's sentences, by kind.
installTroubleSentences(modelSentences)

// Traces and logs to a collector when the server says telemetry is on (@/lib/telemetry); off, one small request.
void appRuntime.runPromise(startTelemetry)

// The page, in its one atom registry (`Root`): this file makes none.
O.match(O.fromNullOr(document.getElementById("root")), {
  onNone: () => {
    throw new Error("The page's root element is missing.")
  },
  onSome: (root) =>
    createRoot(root).render(
      <StrictMode>
        <Root />
      </StrictMode>
    )
})
