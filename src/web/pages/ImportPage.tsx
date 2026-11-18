import { lazy, Suspense, useContext, useState } from "react"
import { createPortal } from "react-dom"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { ReviewSkeleton, someColumns, TablePageSkeleton } from "@/components/app/Skeletons"
import { BarSlotContext, StepActionsContext } from "@/components/app/slots"
import {
  Stepper,
  StepperContent,
  StepperIndicator,
  StepperItem,
  StepperList,
  StepperSeparator,
  StepperTitle,
  StepperTrigger
} from "@/components/ui/stepper"
import { useActor } from "@/lib/actor"
import { useImportTable, useImportView } from "@/lib/imports"
import { useIsNarrow } from "@/lib/content-width"
import { importAddress, navigate, useLocation } from "@/lib/route"
import { hasRole } from "../../domain/Identity.ts"
import { SheetButton } from "./import/SheetButton.tsx"
import { UploadStep } from "./import/UploadStep.tsx"
import { sayError } from "@/lib/errors"

// The steps after Upload are separate chunks: the first screen does not wait for the review table's code. While one
// is on its way the person sees a skeleton of that step, in its own boxes.
const MatchStep = lazy(() => import("./import/MatchStep.tsx").then((module) => ({ default: module.MatchStep })))
const ReviewStep = lazy(() => import("./import/ReviewStep.tsx").then((module) => ({ default: module.ReviewStep })))
const ResultStep = lazy(() => import("./import/ResultStep.tsx").then((module) => ({ default: module.ResultStep })))

const steps = [
  { value: "upload", title: "Upload" },
  { value: "match", title: "Match" },
  { value: "review", title: "Review" },
  { value: "result", title: "Result" }
] as const
type Step = (typeof steps)[number]["value"]

/**
 * Bringing a file in, as steps. The import and the step are in the address, and the file is staged on the server,
 * so a refresh or a copied link lands on the same screen.
 */
export function ImportPage() {
  const { params } = useLocation()
  const importId = params.get("import") ?? undefined
  const { actor } = useActor()
  // The server enforces this. The screen mirrors it so nobody is offered a button that will be refused.
  const canImport = actor !== undefined && hasRole(actor.role, "editor")
  const view = useImportView(importId)
  const table = useImportTable(importId)
  const wanted = params.get("step")
  // Confirmed, or confirmed and taken back: either way the result screen is where it stands.
  const imported = view.data !== undefined && view.data.status !== "open"
  const step: Step =
    importId === undefined || wanted === "upload"
      ? "upload"
      : view.data === undefined
        ? // While the import is on its way the address decides, so a link to a result shows the result's skeleton,
          // not the review's.
          wanted === "match" || wanted === "result"
          ? wanted
          : "review"
        : imported
          ? "result"
          : wanted === "match"
            ? "match"
            : "review"
  const reachable = (value: Step): boolean =>
    value === "upload" || (importId !== undefined && view.data !== undefined && (value === "result") === imported)

  const barSlot = useContext(BarSlotContext)
  const narrow = useIsNarrow()
  const [stepActions, setStepActions] = useState<HTMLElement | null>(null)

  const go = (value: string) => {
    if (value === "upload") navigate(importId === undefined ? "/" : importAddress(importId, "upload"))
    else if (importId !== undefined) navigate(importAddress(importId, value))
  }

  const waiting = importId !== undefined && (view.isPending || table.isPending)
  const skeleton =
    step === "review" ? (
      <ReviewSkeleton {...(view.data === undefined ? {} : { title: `Review ${view.data.fileName}` })} />
    ) : step === "match" ? (
      <TablePageSkeleton title="Match columns" line action caption="Fields and columns" columns={someColumns(4)} />
    ) : (
      <TablePageSkeleton line action views={4} caption="What happened to each row" columns={someColumns(7)} />
    )
  const failed = view.error ?? table.error
  const body = (render: () => React.ReactNode) =>
    failed !== null ? (
      <div className="mx-auto max-w-2xl px-4 pt-6 sm:px-9">
        <Alert variant="destructive">
          <AlertTitle>This import could not be opened</AlertTitle>
          <AlertDescription>
            {sayError(failed).sentence}
            <Button variant="outline" size="sm" onClick={() => navigate("/")}>
              Choose a file
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    ) : waiting ? (
      skeleton
    ) : (
      <Suspense fallback={skeleton}>{render()}</Suspense>
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
      <div ref={setStepActions} className="flex items-center gap-2" />
      {importId !== undefined && step === "review" ? <SheetButton importId={importId} /> : null}
    </>
  )
  // Keyed by which steps can be reached: the stepper renumbers a step whose `disabled` changes after mount.
  const stepsKey = steps.map((entry) => reachable(entry.value)).join()

  return (
    <Stepper value={step} onValueChange={go} aria-label="Import steps" className="flex h-full flex-col">
      {barSlot !== null && !narrow ? (
        // On a desk the steps sit in the shell's top bar, beside the breadcrumb: one bar, and the review table
        // gets the band's height.
        createPortal(stepNav, barSlot, stepsKey)
      ) : (
        // On a phone, a band of their own. One height whatever the step puts beside it (the sheet button),
        // so the step below never moves when that button arrives.
        <div key={stepsKey} className="flex h-14 flex-none items-center gap-4 border-b px-4 sm:px-9 md:h-12">
          {stepNav}
        </div>
      )}
      <StepActionsContext value={stepActions}>
        <StepperContent value="upload" className="min-h-0 flex-1">
          <UploadStep canImport={canImport} viewOnly={actor !== undefined && !canImport} />
        </StepperContent>
        <StepperContent value="match" className="min-h-0 flex-1">
          {body(() =>
            view.data === undefined || table.data === undefined ? null : (
              <MatchStep view={view.data} table={table.data} canImport={canImport} />
            )
          )}
        </StepperContent>
        <StepperContent value="review" className="min-h-0 flex-1">
          {body(() =>
            view.data === undefined || table.data === undefined ? null : (
              <ReviewStep view={view.data} table={table.data} canImport={canImport} />
            )
          )}
        </StepperContent>
        <StepperContent value="result" className="min-h-0 flex-1">
          {body(() =>
            view.data === undefined || view.data.result === null || table.data === undefined ? null : (
              <ResultStep view={view.data} result={view.data.result} table={table.data} canImport={canImport} />
            )
          )}
        </StepperContent>
      </StepActionsContext>
    </Stepper>
  )
}
