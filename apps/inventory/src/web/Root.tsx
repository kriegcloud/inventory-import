// The page as `main.tsx` draws it: the app inside the one atom registry a page has (`pageRegistry`), made by the same
// `rootRegistry` the tests hold to its rules, with the app's API layer. The one thing not to break: there is no other
// registry. `main.tsx` draws `Root` and makes none of its own, and a test reads it to say so.
import { RegistryContext } from "@effect/atom-react"
import { Toaster } from "@inventory/ui/components/sonner"
import { TooltipProvider } from "@inventory/ui/components/tooltip"
import { ThemeProvider } from "@inventory/ui/Theme"
import { appLayer } from "@/lib/api"
import { rootRegistry } from "@/lib/root"
import App from "./App.tsx"

/**
 * The atoms' registry: everything a screen holds or reads is an atom in it (goals/atoms). One for the page's life, made
 * as the page's code loads, before anything is drawn.
 */
export const pageRegistry = rootRegistry({ api: appLayer })

/** The whole page: the app, its theme, its tooltips and its toasts, in the page's registry. */
export function Root() {
  return (
    <RegistryContext value={pageRegistry}>
      <ThemeProvider>
        <TooltipProvider delayDuration={300}>
          <App />
          {/* Top centre, under the bar: between a page's title and its buttons, so a message never covers the table's
              page controls or a confirm button. */}
          <Toaster position="top-center" offset={64} richColors closeButton />
        </TooltipProvider>
      </ThemeProvider>
    </RegistryContext>
  )
}
