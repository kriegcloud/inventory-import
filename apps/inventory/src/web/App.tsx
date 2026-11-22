import { lazy, Suspense } from "react"
import { AppShell } from "@/components/app/AppShell"
import { SignedIn } from "@/components/app/SignedIn"
import { Skeleton } from "@inventory/ui/components/skeleton"
import { useAtomValue } from "@effect/atom-react"
import * as Str from "effect/String"
import { location } from "@inventory/ui/Route"
import { workspace } from "./preload.ts"

// The first download is the sign-in screen and what it needs: React, the atoms, the session request and the
// sign-in page. Everything a signed-in member sees (the shell's sidebar, the API client and every page) is the
// workspace's chunk, fetched once someone is signed in (preload.ts, started by @/lib/actor on a hint or the answer).
const Workspace = lazy(workspace)

// Development only: the review region's gallery at /gallery/review. In a production build the condition is a
// constant false, so the page and its made-up data are not in the bundle.
const ReviewGallery = import.meta.env.DEV ? lazy(() => import("@/pages/ReviewGallery")) : undefined
// Development only too: the data grid's typing page at /gallery/grid, which `bun run grid:keys` drives in a browser.
const GridGallery = import.meta.env.DEV ? lazy(() => import("@/pages/GridGallery")) : undefined

/** The app: the sign-in screen for anyone not signed in, the workspace for a member of an organization. */
export default function App() {
  const { path } = useAtomValue(location)
  if (ReviewGallery !== undefined && path.startsWith("/gallery/review")) {
    return (
      <Suspense fallback={null}>
        <ReviewGallery />
      </Suspense>
    )
  }
  if (GridGallery !== undefined && Str.startsWith("/gallery/grid")(path)) {
    return (
      <Suspense fallback={null}>
        <GridGallery />
      </Suspense>
    )
  }
  return (
    <SignedIn title="Inventory import">
      <Suspense
        fallback={
          // The workspace's code is on its way: the shell's frame with a page-sized placeholder, nothing that moves.
          <AppShell title="Inventory import">
            <Skeleton aria-label="Loading" className="mx-4 mt-6 h-80 sm:mx-9" />
          </AppShell>
        }
      >
        <Workspace />
      </Suspense>
    </SignedIn>
  )
}
