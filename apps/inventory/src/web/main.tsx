import { RegistryContext } from "@effect/atom-react"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { Toaster } from "@inventory/ui/components/sonner"
import { TooltipProvider } from "@inventory/ui/components/tooltip"
import { appLayer, appRuntime } from "@/lib/api"
import { modelSentences } from "@inventory/catalog-web/AnsweredByWords"
import { startTelemetry } from "@/lib/telemetry"
import { rootRegistry } from "@/lib/root"
import { installTroubleSentences } from "@inventory/client/SayError"
import { ThemeProvider } from "@inventory/ui/Theme"
import App from "./App.tsx"
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

// The atoms' registry: everything a screen holds or reads is an atom in it (goals/atoms). One for the page's life, made
// before anything is drawn.
const registry = rootRegistry({ api: appLayer })

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RegistryContext value={registry}>
      <ThemeProvider>
        <TooltipProvider delayDuration={300}>
          <App />
          {/* Top centre, under the bar: between a page's title and its buttons, so a message never covers the table's
              page controls or a confirm button. */}
          <Toaster position="top-center" offset={64} richColors closeButton />
        </TooltipProvider>
      </ThemeProvider>
    </RegistryContext>
  </StrictMode>
)
