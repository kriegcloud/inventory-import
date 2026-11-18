import { QueryClientProvider } from "@tanstack/react-query"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { appRuntime } from "@/lib/api"
import { queryClient } from "@/lib/queries"
import { startTelemetry } from "@/lib/telemetry"
import { ThemeProvider } from "@/lib/theme"
import App from "./App.tsx"
import "./index.css"

// Development only: hold a key and click any element to copy its component and source location for a coding agent.
// It is never part of a production build.
if (import.meta.env.DEV) {
  void import("react-grab")
}

// Traces and logs to a collector when the server says telemetry is on (@/lib/telemetry); off, one small request.
void appRuntime.runPromise(startTelemetry)

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={300}>
          <App />
          {/* Top centre, under the bar: between a page's title and its buttons, so a message never covers the table's
              page controls or a confirm button. */}
          <Toaster position="top-center" offset={64} richColors closeButton />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>
)
