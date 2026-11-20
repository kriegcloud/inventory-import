import { RegistryProvider } from "@effect/atom-react"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { Toaster } from "@inventory/ui/components/sonner"
import { TooltipProvider } from "@inventory/ui/components/tooltip"
import { appLayer, appRuntime } from "@/lib/api"
import { modelSentences } from "@inventory/catalog-web/AnsweredByWords"
import { startTelemetry } from "@/lib/telemetry"
import { provideApi } from "@inventory/client/Api"
import { provideMember } from "@inventory/client/MemberAtoms"
import { actor, session } from "@inventory/access-web/Session"
import * as Atom from "effect/reactivity/Atom"
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

// Who the atoms of every web package read the API for: the session's member. Asked again (`askWhoIsSignedIn`), it asks
// the session again: a write refused for nobody signed in then shows this tab the sign-in page, or who is signed in now.
const signedIn = Atom.readable(
  (get) => get(actor),
  (refresh) => refresh(session)
)

// What the atoms of every web package read the API through (the app's one runtime), and who they read it for: given
// to the registry once.
const initialAtoms = [provideApi(appLayer), provideMember(signedIn)]

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* The atoms' registry: everything a screen holds or reads is an atom in it (goals/atoms). An atom nobody reads is
        dropped 400 ms later; a read of the API is kept for `keepUnwatched` (@inventory/client/Api). */}
    <RegistryProvider initialValues={initialAtoms} defaultIdleTTL={400}>
      <ThemeProvider>
        <TooltipProvider delayDuration={300}>
          <App />
          {/* Top centre, under the bar: between a page's title and its buttons, so a message never covers the table's
              page controls or a confirm button. */}
          <Toaster position="top-center" offset={64} richColors closeButton />
        </TooltipProvider>
      </ThemeProvider>
    </RegistryProvider>
  </StrictMode>
)
