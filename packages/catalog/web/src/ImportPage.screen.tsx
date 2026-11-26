import { Dom } from "./internal/dom.adapter.ts"
import { parameter } from "./internal/browser.ts"
import { useAtomMount, useAtomSet, useAtomValue } from "@effect/atom-react"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import * as Atom from "effect/reactivity/Atom"
import { lazy, Suspense } from "react"
import { createPortal } from "react-dom"
import { Alert, AlertDescription, AlertTitle } from "@inventory/ui/components/alert"
import { Button } from "@inventory/ui/components/button"
import { ReviewSkeleton, someColumns, TablePageSkeleton } from "@inventory/ui/Skeletons"
import { barSlot as barSlotAtom } from "@inventory/ui/ShellSlots"
import {
  Stepper,
  StepperContent,
  StepperIndicator,
  StepperItem,
  StepperList,
  StepperSeparator,
  StepperTitle,
  StepperTrigger
} from "@inventory/ui/components/stepper"
import type { ImportId } from "@inventory/catalog-contract/Ids"
import { ImportNotFound } from "@inventory/catalog-contract/ImportRejection"
import { perKey } from "@inventory/client/Api"
import { askedAgainWhenBack } from "@inventory/client/ConnectionAtoms"
import { member } from "@inventory/client/MemberAtoms"
import { followRemoval, importTable, importView, importViewShown } from "./Imports.atoms.ts"
import { isNarrow } from "@inventory/ui/ContentWidth"
import { location, navigate } from "@inventory/ui/Route"
import { openedOf } from "./internal/result.ts"
import { importAddress, importInAddress } from "./internal/route.ts"
import { hasRole } from "@inventory/kernel/Role"
import { SheetButton } from "./internal/SheetButton.tsx"
import { UploadStep } from "./UploadStep.screen.tsx"
import { isTransient, sayError } from "@inventory/client/SayError"

// The steps after Upload are separate chunks: the first screen does not wait for the review table's code. While one
// is on its way the person sees a skeleton of that step, in its own boxes.
const MatchStep = lazy(() => import("./MatchStep.screen.tsx").then((module) => ({ default: module.MatchStep })))
const ReviewStep = lazy(() => import("./ReviewStep.screen.tsx").then((module) => ({ default: module.ReviewStep })))
const ResultStep = lazy(() => import("./ResultStep.screen.tsx").then((module) => ({ default: module.ResultStep })))

const steps = [
  { value: "upload", title: "Upload" },
  { value: "match", title: "Match" },
  { value: "review", title: "Review" },
  { value: "result", title: "Result" }
] as const
type Step = (typeof steps)[number]["value"]

/** What the page follows while the address names no import: nothing. */
const nothingToFollow = Atom.readable((): void => undefined)

/**
 * Mounted by the page while the address names an import: a read of it that could not be made (the network, the server's
 * own failure) is made again by itself every half minute, and at once when the connection is back.
 */
export const readAgainWhenBack = perKey((id: ImportId) =>
  Atom.readable((get): void => {
    get.mount(
      askedAgainWhenBack({
        mayPass: isTransient,
        read: importViewShown(id),
        askAgain: (registry) => importView(id).askAgain(registry, O.none())
      })
    )
    get.mount(
      askedAgainWhenBack({
        mayPass: isTransient,
        read: importTable(id),
        askAgain: (registry) => importTable(id).askAgain(registry, O.none())
      })
    )
  })
)

/** The person asked for an import to be read again: its view and its rows, whichever could not be. */
const readAgain = Atom.fnSync((id: ImportId, get) => {
  if (AsyncResult.isFailure(get.registry.get(importView(id)))) importView(id).askAgain(get.registry, O.none())
  if (AsyncResult.isFailure(get.registry.get(importTable(id)))) importTable(id).askAgain(get.registry, O.none())
})

/** The server says there is no such import where the person is: removed, or another organization's. */
const isGone = S.is(ImportNotFound)

/** Above a step that stays drawn: the import could not be read again, and when it will be. */
function NotReadAgain(props: { readonly importId: ImportId; readonly error: unknown }) {
  const again = useAtomSet(readAgain)
  return (
    <div className="max-h-1/3 flex-none overflow-y-auto">
      <Alert className="mx-4 my-3 w-auto sm:mx-9">
        <AlertTitle>This import could not be read again</AlertTitle>
        <AlertDescription>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="min-w-0">
              {sayError(props.error, { fields: {} }).sentence} What you see is how it was when it was last read.
              {isTransient(props.error)
                ? " It is read again by itself every half minute, and at once when the connection comes back."
                : ""}
            </p>
            <Button variant="outline" size="xs" onClick={() => again(props.importId)}>
              Read it now
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  )
}

/** What the steps read while the address names no import: nothing, and never asked for. */
const noImport = Atom.make(AsyncResult.initial<never, never>())

/**
 * Bringing a file in, as steps. The import and the step are in the address, and the file is staged on the server,
 * so a refresh or a copied link lands on the same screen.
 */
export function ImportPage() {
  const { params } = useAtomValue(location)
  const { id: importId, malformed } = importInAddress(params)
  const signedIn = useAtomValue(member)
  const actor = signedIn
  // The server enforces this. The screen mirrors it so nobody is offered a button that will be refused.
  const canImport = O.exists(actor, (who) => hasRole(who.role, "editor"))
  // Found removed: what the person's tabs kept for it is let go and named, above the page.
  useAtomMount(O.match(importId, { onNone: () => nothingToFollow, onSome: followRemoval }))
  // Could not be read: read again by itself once the connection is back.
  useAtomMount(O.match(importId, { onNone: () => nothingToFollow, onSome: readAgainWhenBack }))
  const viewRead = useAtomValue(O.match(importId, { onNone: () => noImport, onSome: importViewShown }))
  const tableRead = useAtomValue(O.match(importId, { onNone: () => noImport, onSome: importTable }))
  const view = openedOf({ read: viewRead, isGone })
  const table = openedOf({ read: tableRead, isGone })
  const wanted = parameter("step")(params)
  // Confirmed, or confirmed and taken back: either way the result screen is where it stands.
  const imported = O.exists(view.data, (value) => value.status !== "open")
  const step: Step =
    // An address that names something that is no import is said so on the step it asked for, not answered
    // with the upload screen as if it named none.
    (O.isNone(importId) && !malformed) || O.contains(wanted, "upload")
      ? "upload"
      : O.isNone(view.data)
        ? // While the import is on its way the address decides, so a link to a result shows the result's skeleton,
          // not the review's.
          O.contains(wanted, "match") || O.contains(wanted, "result")
          ? O.contains(wanted, "match")
            ? "match"
            : "result"
          : "review"
        : imported
          ? "result"
          : O.contains(wanted, "match")
            ? "match"
            : "review"
  const reachable = (value: Step): boolean =>
    value === "upload" || (O.isSome(importId) && O.isSome(view.data) && (value === "result") === imported)

  const barSlot = Dom.portalTarget(useAtomValue(barSlotAtom))
  const narrow = useAtomValue(isNarrow)

  const go = (value: string) => {
    if (value === "upload")
      navigate(O.isNone(importId) ? "/" : importAddress(importId.value, "upload"), { replace: false })
    else if (O.isSome(importId)) navigate(importAddress(importId.value, value), { replace: false })
  }

  const waiting = O.isSome(importId) && (O.isNone(view.data) || O.isNone(table.data))
  const skeleton =
    step === "review" ? (
      <ReviewSkeleton {...(O.isNone(view.data) ? {} : { title: `Review ${view.data.value.fileName}` })} />
    ) : step === "match" ? (
      <TablePageSkeleton title="Match columns" line action caption="Fields and columns" columns={someColumns(4)} />
    ) : (
      <TablePageSkeleton line action views={4} caption="What happened to each row" columns={someColumns(7)} />
    )
  const refused = O.orElse(view.refused, () => table.refused)
  const gone = view.gone || table.gone
  const behind = O.orElse(view.behind, () => table.behind)
  const body = (render: () => React.ReactNode) =>
    O.isSome(refused) || malformed ? (
      <div className="mx-auto max-w-2xl px-4 pt-6 sm:px-9">
        <Alert variant="destructive">
          <AlertTitle>{gone ? "This import is not here any more" : "This import could not be opened"}</AlertTitle>
          <AlertDescription>
            {gone
              ? "Somebody removed it, or it belongs to another organization. The first screen lists the imports there are: continue one of them, or choose a file."
              : O.match(refused, {
                  onNone: () => "The address does not name an import. Check the link, or choose a file.",
                  onSome: (error) => sayError(error, { fields: {} }).sentence
                })}
            <Button variant="outline" size="sm" onClick={() => navigate("/", { replace: false })}>
              {gone ? "Go to the first screen" : "Choose a file"}
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    ) : waiting ? (
      skeleton
    ) : (
      // The same boxes with the line above the step and without it: the step stays the one that is drawn, with whatever
      // is being typed in it, when the line comes and goes.
      <div className="flex h-full flex-col">
        {O.isSome(importId) && O.isSome(behind) ? (
          <NotReadAgain importId={importId.value} error={behind.value} />
        ) : null}
        <div className="min-h-0 flex-1">
          <Suspense fallback={skeleton}>{render()}</Suspense>
        </div>
      </div>
    )

  const stepNav = (
    <>
      <div className="min-w-0 flex-1">
        <StepperList id="import-steps">
          {steps.map((entry) => (
            <StepperItem key={entry.value} value={entry.value} disabled={!reachable(entry.value)}>
              {/* Only the current step shows its name: the others are a number with the name for a screen
                  reader and on hover, because every word here counts against the screen's budget. */}
              <StepperTrigger aria-label={entry.title} title={entry.title}>
                <StepperIndicator />
                {entry.value === step ? <StepperTitle>{entry.title}</StepperTitle> : null}
              </StepperTrigger>
              <StepperSeparator />
            </StepperItem>
          ))}
        </StepperList>
      </div>
      <div className="flex items-center gap-2" />
      {O.isSome(importId) && step === "review" ? <SheetButton importId={importId.value} /> : null}
    </>
  )
  // Keyed by which steps can be reached: the stepper renumbers a step whose `disabled` changes after mount.
  const stepsKey = steps.map((entry) => reachable(entry.value)).join()

  return (
    <Stepper value={step} onValueChange={go} aria-label="Import steps" className="flex h-full flex-col">
      {O.isSome(barSlot) && !narrow ? (
        // On a desk the steps sit in the shell's top bar, beside the breadcrumb: one bar, and the review table
        // gets the band's height.
        createPortal(stepNav, barSlot.value, stepsKey)
      ) : (
        // On a phone, a band of their own. One height whatever the step puts beside it (the sheet button),
        // so the step below never moves when that button arrives.
        <div key={stepsKey} className="flex h-14 flex-none items-center gap-4 border-b px-4 sm:px-9 md:h-12">
          {stepNav}
        </div>
      )}
      <StepperContent value="upload" className="min-h-0 flex-1">
        <UploadStep canImport={canImport} viewOnly={O.isSome(actor) && !canImport} />
      </StepperContent>
      <StepperContent value="match" className="min-h-0 flex-1">
        {body(() =>
          O.isNone(view.data) || O.isNone(table.data) ? null : (
            <MatchStep view={view.data.value} table={table.data.value} canImport={canImport} />
          )
        )}
      </StepperContent>
      <StepperContent value="review" className="min-h-0 flex-1">
        {body(() =>
          O.isNone(view.data) || O.isNone(table.data) ? null : (
            <ReviewStep view={view.data.value} table={table.data.value} canImport={canImport} />
          )
        )}
      </StepperContent>
      <StepperContent value="result" className="min-h-0 flex-1">
        {body(() =>
          O.isNone(view.data) || O.isNone(view.data.value.result) || O.isNone(table.data) ? null : (
            <ResultStep
              view={view.data.value}
              result={view.data.value.result.value}
              table={table.data.value}
              canImport={canImport}
            />
          )
        )}
      </StepperContent>
    </Stepper>
  )
}
