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
import { useAtomValue } from "@effect/atom-react"
import { sessionView } from "@inventory/access-web/Session"
import { CurrentMember } from "@inventory/client/CurrentMember"
import type { ImportId } from "@inventory/catalog-contract/Ids"
import { importInAddress } from "@inventory/catalog-web/Route"
import { importTableQuery, importViewQuery, useImportView } from "@inventory/catalog-web/Imports"
import { queryClient } from "@/lib/queries"
import { useContentBelow } from "@inventory/ui/ContentWidth"
import { linkTo, useLocation } from "@inventory/ui/Route"

// Each page is its own chunk, fetched when it is first opened: the shell loads without the review table, the
// spreadsheet reader or the other pages.
const importPage = () => import("@inventory/catalog-web/ImportPage")
const ImportPage = lazy(() => importPage().then((module) => ({ default: module.ImportPage })))
// A signed-in person most likely lands on the import page: its code is fetched with this chunk, not after it. When
// the address names an import, its view and rows are asked for now too, beside the page's code instead of after it.
if (window.location.pathname === "/") {
  void importPage()
  const opened = importInAddress(new URLSearchParams(window.location.search)).id
  if (opened !== undefined) {
    void queryClient.prefetchQuery(importViewQuery(opened))
    void queryClient.prefetchQuery(importTableQuery(opened))
  }
}
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

/**
 * Where the person is, in the bar beside the sidebar's button: the organization, the page, and the file when an
 * import is open. The organization gives way first on a narrow screen; the sidebar already names it.
 */
function Crumbs(props: { page: AppPage; importId: ImportId | undefined }) {
  const { actor } = useAtomValue(sessionView)
  // The same cached answer the import page reads: no second request.
  const fileName = useImportView(props.importId).data?.fileName
  const inImport = props.page.path === "/" && props.importId !== undefined
  // The organization is already named at the top of the sidebar: beside a narrow page the bar keeps its room.
  const short = useContentBelow(1024)
  return (
    <Breadcrumb>
      <BreadcrumbList className="flex-nowrap">
        {actor === undefined || short ? null : (
          <>
            <BreadcrumbItem className="min-w-0">
              <span className="block truncate">{actor.organizationName}</span>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
          </>
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
  const { path, params } = useLocation()
  // The catalog screens mirror the role rule from the member the app provides here, never from a request.
  const { actor } = useAtomValue(sessionView)
  // An address that names no page shows the first one, as before.
  const current = appPages.find((page) => page.path === path) ?? appPages[0]
  if (current === undefined) return null
  return (
    <CurrentMember value={actor}>
      <WorkspaceFrame current={current} path={path} params={params} />
    </CurrentMember>
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
    </AppShell>
  )
}
