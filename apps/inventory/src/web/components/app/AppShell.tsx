import { type ReactNode, useLayoutEffect, useState } from "react"
import { Separator } from "@inventory/ui/components/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger, useSidebar } from "@inventory/ui/components/sidebar"
import { setContentInset, sidebarFolded, sidebarOpen, sidebarWasOpen } from "@inventory/ui/ContentWidth"
import { BrandMark } from "./BrandMark.tsx"
import { BarSlotContext } from "./slots.ts"
import { ThemeToggle } from "./ThemeToggle.tsx"

const skipLink = (
  <a
    href="#main"
    className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
  >
    Skip to content
  </a>
)

/**
 * Tells the page how much room the sidebar leaves it, so a table knows whether it fits (`lib/content-width.ts`).
 * In a layout effect: the page is drawn once, already at the right layout.
 */
function SidebarRoom() {
  const { isMobile, state } = useSidebar()
  const taken = isMobile ? 0 : state === "expanded" ? sidebarOpen : sidebarFolded
  useLayoutEffect(() => {
    setContentInset(taken)
    return () => setContentInset(0)
  }, [taken])
  return null
}

/**
 * The page frame. Signed in, it is the sidebar beside a slim bar (the sidebar's button, where the person is, the
 * theme) with the page under it. Without a `sidebar` (signing in, creating an organization) it is that bar alone,
 * with the mark, over one centred column.
 */
export function AppShell(props: {
  title: string
  /** The app's sidebar. Left out, the frame is a plain header: nobody is signed in yet. */
  sidebar?: ReactNode
  /** Where the person is, beside the sidebar's button: a breadcrumb. */
  crumbs?: ReactNode
  actions?: ReactNode
  /** Full width with a gutter, for a page that is mostly a table. Default is a centred reading column. */
  wide?: boolean
  /**
   * The page fills the screen below the header and never scrolls; what is inside scrolls in its own frame (a review
   * table). The page brings its own gutters. Implies `wide`.
   */
  fill?: boolean
  children: ReactNode
}) {
  const frame =
    props.wide === true || props.fill === true ? "w-full px-4 sm:px-9" : "mx-auto w-full max-w-5xl px-4 sm:px-6"
  const [barSlot, setBarSlot] = useState<HTMLElement | null>(null)
  if (props.sidebar !== undefined) {
    return (
      <SidebarProvider
        defaultOpen={sidebarWasOpen()}
        className={props.fill === true ? "h-svh overflow-hidden" : undefined}
      >
        {skipLink}
        <SidebarRoom />
        {props.sidebar}
        {/* min-w-0: a wide table scrolls inside its own frame instead of pushing the page past the screen. */}
        <SidebarInset className={props.fill === true ? "min-h-0 min-w-0 overflow-hidden" : "min-w-0"}>
          <header className="flex h-12 flex-none items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
            <span className="sr-only">{props.title}</span>
            <div className="min-w-0">{props.crumbs}</div>
            {/* A page's own navigation (the import's steps), put here by the page: one bar instead of two. */}
            <div ref={setBarSlot} className="flex min-w-0 flex-1 items-center gap-4 pl-4 empty:hidden" />
            <div className="ml-auto flex items-center gap-1.5">
              {props.actions}
              <ThemeToggle />
            </div>
          </header>
          <div id="main" className={props.fill === true ? "min-h-0 flex-1" : `flex-1 py-8 ${frame}`}>
            <BarSlotContext value={barSlot}>{props.children}</BarSlotContext>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }
  return (
    <div className={props.fill === true ? "flex h-svh flex-col overflow-hidden" : "flex min-h-svh flex-col"}>
      {skipLink}
      <header className="sticky top-0 z-40 border-b bg-background">
        <div className={`flex h-14 items-center gap-3 ${frame}`}>
          {/* The lambda sits 6px inside its 28px box; -ml-1.5 lines its stroke up with the page's left edge. */}
          <BrandMark className="-ml-1.5 size-7 shrink-0" />
          {/* The mark stands for the name: every word in the header counts against a screen's budget of words. */}
          <span className="sr-only">{props.title}</span>
          <div className="ml-auto flex items-center gap-1.5">
            {props.actions}
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main id="main" className={props.fill === true ? "min-h-0 flex-1" : `flex-1 py-8 ${frame}`}>
        {props.children}
      </main>
    </div>
  )
}
