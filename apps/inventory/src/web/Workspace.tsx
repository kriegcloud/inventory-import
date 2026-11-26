import { lazy, Suspense } from "react"
import { AppShell } from "@/components/app/AppShell"
import { type AppPage, appPages, AppSidebar } from "@/components/app/AppSidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from "@inventory/ui/components/breadcrumb"
import { ReviewSkeleton, someColumns, StepsSkeleton, TablePageSkeleton, UploadSkeleton } from "@inventory/ui/Skeletons"
import { useAtomMount, useAtomRefresh, useAtomValue } from "@effect/atom-react"
import { Alert, AlertDescription, AlertTitle } from "@inventory/ui/components/alert"
import { Button } from "@inventory/ui/components/button"
import { isNarrow } from "@inventory/ui/ContentWidth"
import { sayError } from "@inventory/client/SayError"
import { session, sessionView } from "@inventory/access-web/Session"
import type { ImportId } from "@inventory/catalog-contract/Ids"
import { importInAddress } from "@inventory/catalog-web/Route"
import { KeptNotices } from "@inventory/catalog-web/KeptNotices"
import { askBeforeLeaving, importViewShown } from "@inventory/catalog-web/Imports"
import * as A from "effect/Array"
import * as O from "effect/Option"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import * as Atom from "effect/reactivity/Atom"
import { contentBelow } from "@inventory/ui/ContentWidth"
import { linkTo, location } from "@inventory/ui/Route"

// Each page is its own chunk, fetched when it is first opened: the shell loads without the review table, the
// spreadsheet reader or the other pages.
const importPage = () => import("@inventory/catalog-web/ImportPage")
const ImportPage = lazy(() => importPage().then((module) => ({ default: module.ImportPage })))
// A signed-in person most likely lands on the import page: its code is fetched with this chunk, not after it. An
// import the address names is already on its way (`preload.ts` asks for its view and rows early).
if (window.location.pathname === "/") void importPage()
const ItemsPage = lazy(() =>
  import("@inventory/catalog-web/ItemsPage").then((module) => ({ default: module.ItemsPage }))
)
const ActivityPage = lazy(() => import("@/pages/ActivityPage").then((module) => ({ default: module.ActivityPage })))
const PeoplePage = lazy(() => import("@inventory/access-web/People").then((module) => ({ default: module.PeoplePage })))

const peoplePath = "/people"

/**
 * What shows for the moment a page's code is on its way: a skeleton of that page, in its own boxes, so nothing moves
 * when the page arrives. The import page's depends on its step.
 */
function PageSkeleton(props: { path: string; params: URLSearchParams }) {
  const { path, params } = props
  if (path === "/items") {
    return <TablePageSkeleton title="Items" line action caption="Items" columns={someColumns(7)} />
  }
  if (path === "/activity") {
    return <TablePageSkeleton title="Activity" views={2} caption="Activity" columns={someColumns(8)} />
  }
  if (path === peoplePath) {
    return <TablePageSkeleton title="People" line caption="People in the organization" columns={someColumns(4)} />
  }
  const step = params.get("import") === null ? "upload" : (params.get("step") ?? "review")
  return (
    <div className="flex h-full flex-col">
      <StepsSkeleton />
      <div className="min-h-0 flex-1">
        {step === "upload" ? (
          <UploadSkeleton />
        ) : step === "review" ? (
          <ReviewSkeleton />
        ) : (
          <TablePageSkeleton line action caption="Rows" columns={someColumns(6)} />
        )}
      </div>
    </div>
  )
}

/** What the crumbs read while no import is open: nothing, never asked for. */
const noImport = Atom.make(AsyncResult.initial<never, never>())

/**
 * Where the person is, in the bar beside the sidebar's button: the organization, the page, and the file when an
 * import is open. The organization gives way first on a narrow screen; the sidebar already names it.
 */
function Crumbs(props: { page: AppPage; importId: ImportId | undefined }) {
  const { actor } = useAtomValue(sessionView)
  // The same read the import page shows: no second request.
  const opened = useAtomValue(props.importId === undefined ? noImport : importViewShown(props.importId))
  const fileName = AsyncResult.isSuccess(opened) ? opened.value.fileName : undefined
  const inImport = props.page.path === "/" && props.importId !== undefined
  // The organization is already named at the top of the sidebar: beside a narrow page the bar keeps its room.
  const short = useAtomValue(contentBelow(1024))
  return (
    <Breadcrumb>
      <BreadcrumbList className="flex-nowrap">
        {O.match(
          O.filter(actor, () => !short),
          {
            onNone: () => null,
            onSome: (actor) => (
              <>
                <BreadcrumbItem className="min-w-0">
                  <span className="block truncate">{actor.organizationName}</span>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
              </>
            )
          }
        )}
        <BreadcrumbItem>
          {inImport ? (
            <BreadcrumbLink asChild>
              <a {...linkTo("/")}>{props.page.label}</a>
            </BreadcrumbLink>
          ) : (
            <BreadcrumbPage>{props.page.label}</BreadcrumbPage>
          )}
        </BreadcrumbItem>
        {inImport && fileName !== undefined ? (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem className="min-w-0">
              <BreadcrumbPage>
                <span className="block truncate">{fileName}</span>
              </BreadcrumbPage>
            </BreadcrumbItem>
          </>
        ) : null}
      </BreadcrumbList>
    </Breadcrumb>
  )
}

/**
 * What a signed-in member sees: the sidebar with the organization, the pages and who is using it, and the current
 * page beside it. Its own chunk, with the API client and every page's skeleton: the sign-in screen loads without it.
 */
export default function Workspace() {
  const { path, params } = useAtomValue(location)
  // The browser asks before the page is left while an import has rows still to be sent, whatever page is shown.
  useAtomMount(askBeforeLeaving)
  // An address that names no page shows the first one, as before.
  const current = O.orElse(
    A.findFirst(appPages, (page) => page.path === path),
    () => A.head(appPages)
  )
  if (O.isNone(current)) return null
  return <WorkspaceFrame current={current.value} path={path} params={params} />
}

/**
 * Who is signed in could not be read again: the page stays as it is, with what is typed in it, and nothing is sent
 * until it is known. It is asked again by itself; the button asks now.
 */
function SessionNotice() {
  const { error } = useAtomValue(sessionView)
  const ask = useAtomRefresh(session)
  const narrow = useAtomValue(isNarrow)
  if (O.isNone(error)) return null
  return (
    <Alert className={narrow ? "mx-4 my-3 w-auto flex-none" : "mx-6 my-4 w-auto flex-none"}>
      <AlertTitle>We could not check that you are still signed in</AlertTitle>
      <AlertDescription>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="min-w-0">
            {sayError(error.value).sentence} Nothing you decide or save is sent until we can. It is checked again by
            itself every half minute, and at once when the connection comes back.
          </p>
          <Button variant="outline" size="xs" onClick={ask}>
            Check now
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  )
}

function WorkspaceFrame(props: { current: AppPage; path: string; params: URLSearchParams }) {
  const { current, path, params } = props
  return (
    <AppShell
      fill
      title="Inventory import"
      sidebar={<AppSidebar current={current.path} />}
      crumbs={<Crumbs page={current} importId={importInAddress(params).id} />}
    >
      <div className="flex h-full flex-col">
        {/* Whatever page is shown: what became of the person's unsaved decisions while this tab was away. */}
        <KeptNotices />
        <SessionNotice />
        <div className="min-h-0 flex-1">
          <Suspense fallback={<PageSkeleton path={path} params={params} />}>
            {current.path === peoplePath ? (
              <PeoplePage />
            ) : current.path === "/items" ? (
              <ItemsPage />
            ) : current.path === "/activity" ? (
              <ActivityPage />
            ) : (
              <ImportPage />
            )}
          </Suspense>
        </div>
      </div>
    </AppShell>
  )
}
