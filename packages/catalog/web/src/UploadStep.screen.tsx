import * as ByteSize from "effect/ByteSize"
import * as DateTime from "effect/DateTime"
import * as O from "effect/Option"
import { request } from "@inventory/client/Http"
import { useAtom, useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react"
import * as Atom from "effect/reactivity/Atom"
import { useRef } from "react"
import { PageHeader } from "@inventory/ui/PageHeader"
import { Alert, AlertDescription, AlertTitle } from "@inventory/ui/components/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@inventory/ui/components/alert-dialog"
import { Button } from "@inventory/ui/components/button"
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@inventory/ui/components/item"
import { FileUpload, FileUploadDropzone } from "@inventory/ui/components/file-upload"
import { Progress } from "@inventory/ui/components/progress"
import { member } from "@inventory/client/MemberAtoms"
import { when, whenShort } from "@inventory/ui/Dates"
import { giveView, openImports as openImportsRead, pastImports, removeImport } from "./Imports.atoms.ts"
import { resultOf } from "./internal/result.ts"
import { ListTable } from "@inventory/ui/ListTable"
import { pastImportColumnsShortAtom, pastImportRows } from "./PastImports.screen.tsx"
import { navigate } from "@inventory/ui/Route"
import { importAddress } from "./internal/route.ts"
import { StoredFile } from "@inventory/review/SavedProgress"
import { useSavedProgress } from "@inventory/review/SavedProgressHook"
import { catalogRuntime } from "./Catalog.runtime.ts"
import { cancelUpload, startUpload, UploadEnd, uploadState } from "./Upload.controller.ts"
import type { ImportView } from "@inventory/catalog-contract/Import"
import { fileProblemTitle } from "@inventory/catalog-contract/FileProblem"
import { fileNameOf, isBusy, isStoppable, progressOf, UploadState } from "./Upload.machine.ts"
import { sayError } from "@inventory/client/SayError"

/**
 * What the picker offers: the spreadsheets the reader takes, and the ones it recognises to say how to convert them
 * (an old .xls, an .ods), so those still get their own sentence. Anything else is refused before it is read.
 */
const pickable = ".csv,.tsv,.txt,.xlsx,.xlsm,.xls,.xlsb,.ods"

const samples = [
  { name: "items_messy.csv", href: "/samples/items_messy.csv" },
  { name: "items_clean.csv", href: "/samples/items_clean.csv" }
] as const

const whole = new Intl.NumberFormat()
/** A number with its noun: "1 row", "1,200 rows". */
const count = (n: number, noun: string): string => `${whole.format(n)} ${noun}${n === 1 ? "" : "s"}`

/** Where an upload stands, in words and numbers: "Reading 12,400 of about 50,000 rows". */
const line = (state: UploadState): string => {
  const { done, total } = progressOf({ state })
  return UploadState.match(state, {
    Reading: (reading) =>
      total === null
        ? "Reading"
        : `Reading ${whole.format(done)} of ${reading.rows.kind === "counted" ? "" : "about "}${whole.format(total)} rows`,
    Saving: () => `Saving ${whole.format(done)} of ${whole.format(total ?? done)} rows`,
    Preparing: () => "Preparing the review",
    Cancelling: () => "Cancelling",
    Idle: () => "",
    Refused: () => "",
    Failed: () => ""
  })
}

/** The file on its way in: its name, how far it is, and Cancel while cancelling still stops something. */
function UploadProgress(props: { state: UploadState; onCancel: () => void }) {
  const { state } = props
  const { done, total } = progressOf({ state })
  const fileName = fileNameOf(state)
  const stoppable = isStoppable(state)
  return (
    <div className="flex w-full max-w-md flex-col items-center gap-3">
      <div role="status" className="flex w-full flex-col gap-1.5">
        <span className="truncate text-sm font-medium">{fileName}</span>
        <Progress
          value={total === null || total === 0 ? null : Math.round((done / total) * 100)}
          aria-label={`Progress of ${fileName}`}
        />
        <span className="text-sm text-muted-foreground tabular-nums">{line(state)}</span>
      </div>
      <Button variant="outline" size="sm" disabled={!stoppable} onClick={props.onCancel}>
        Cancel
      </Button>
    </div>
  )
}

const carriesFiles = (event: DragEvent): boolean => event.dataTransfer?.types.includes("Files") === true

/**
 * The Upload step's frame while it is on the page (`data-upload-step`), found at the moment of a drop: the page hands
 * it a file only then, and only while it says it takes one (`data-takes-files`). A file dropped anywhere on the page
 * goes in through the upload's own input, so it meets the same checks as a chosen one: one way in.
 */
const stepOnPage = (): HTMLElement | null => document.querySelector<HTMLElement>("[data-upload-step]")

const giveStep = (step: HTMLElement, files: ReadonlyArray<File>): void => {
  const input = step.querySelector<HTMLInputElement>('input[type="file"]')
  if (input === null || files.length === 0) return
  const transfer = new DataTransfer()
  for (const file of files) transfer.items.add(file)
  input.files = transfer.files
  input.dispatchEvent(new Event("change", { bubbles: true }))
}

/**
 * Whether a file is being dragged over the page, and the page's one way to take a dropped file. dragenter and
 * dragleave fire for every element the pointer crosses: the page is left when they balance.
 *
 * The whole page takes a dropped file, not only the dashed box: a file let go beside the box would otherwise make the
 * browser open it and leave the app. One `drop` listener cancels the drop, hands the files to the step and only then
 * lowers the flag, and it stays the same listener for as long as the step is on screen. Two listeners did this once:
 * the first lowered the flag, the step drew again in the gap the browser leaves between listeners, and the second,
 * the one that cancels, was taken off the window before it ran. While the step takes no file (a viewer, an upload
 * under way) the drop is swallowed, so the page stays, and nothing is read. The dashed box takes a file dropped on it
 * itself.
 */
const fileOverPage: Atom.Atom<boolean> = Atom.readable((get) => {
  let depth = 0
  const enter = (event: DragEvent) => {
    if (!carriesFiles(event)) return
    depth += 1
    get.setSelf(true)
  }
  const leave = (event: DragEvent) => {
    if (!carriesFiles(event)) return
    depth = Math.max(0, depth - 1)
    if (depth === 0) get.setSelf(false)
  }
  // Without this the browser refuses the drop and opens the file instead.
  const hold = (event: DragEvent) => {
    if (carriesFiles(event)) event.preventDefault()
  }
  const drop = (event: DragEvent) => {
    if (!carriesFiles(event)) return
    const step = stepOnPage()
    if (!event.defaultPrevented && step !== null) {
      event.preventDefault()
      if (step.dataset.takesFiles !== undefined) giveStep(step, Array.from(event.dataTransfer?.files ?? []))
    }
    depth = 0
    get.setSelf(false)
  }
  window.addEventListener("dragenter", enter)
  window.addEventListener("dragleave", leave)
  window.addEventListener("dragover", hold)
  window.addEventListener("drop", drop)
  get.addFinalizer(() => {
    window.removeEventListener("dragenter", enter)
    window.removeEventListener("dragleave", leave)
    window.removeEventListener("dragover", hold)
    window.removeEventListener("drop", drop)
  })
  return false
})

/**
 * A file somebody loaded and nobody has confirmed: continue its review, or remove it. Removing asks first, because
 * the decisions made on it go with it. One that has already created items (confirmed once, then opened again) has
 * no Remove: the server keeps it with what it wrote.
 */
function OpenImport(props: { view: ImportView; lead: boolean; canImport: boolean }) {
  const { view } = props
  const giveNext = useAtomSet(giveView)
  const removing = useAtomValue(removeImport(view.id)).waiting
  const remove = useAtomSet(removeImport(view.id))
  return (
    <Item variant="outline" className="flex-wrap">
      <ItemContent className="min-w-56">
        <ItemTitle className="max-w-full">
          <span className="truncate">{view.fileName}</span>
        </ItemTitle>
        <ItemDescription>
          {/* Two lines of their own, the same on a desk and a phone: what is left to do, then who loaded it and
              when. One wrapping line ended in a dot or split a name. A viewer is not told the rows need them. */}
          <span className="block truncate">
            {view.progress.needs === 0
              ? "Nothing left to decide"
              : `${whole.format(view.progress.needs)} of ${count(view.progress.rows, "row")} ${view.progress.needs === 1 ? "needs" : "need"} a decision`}
          </span>
          <span className="block truncate" title={when(view.createdAt)}>
            {view.startedBy} · {whenShort(view.createdAt)}
          </span>
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        {props.canImport && view.createdRows.length === 0 ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" disabled={removing}>
                Remove<span className="sr-only"> {view.fileName}</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove {view.fileName}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This deletes the {count(view.rowCount, "row")} it loaded from this file and any decisions made on
                  them. Nothing from it was imported, and the file itself is untouched.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep</AlertDialogCancel>
                <AlertDialogAction
                  // The card goes at once; a refusal puts it back and says why, and the server's yes is said the
                  // moment it comes (`removeImport`).
                  onClick={() => {
                    // The address still names it (its own Upload step): leave first, or the page would go on
                    // asking for an import that is gone.
                    if (new URLSearchParams(window.location.search).get("import") === view.id) navigate("/")
                    remove(view)
                  }}
                >
                  Remove
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
        <Button
          // A viewer can look and cannot decide: for them it is not the screen's filled button, and it says "Open".
          variant={props.lead && props.canImport ? "default" : "outline"}
          onClick={() => {
            giveNext(view)
            navigate(importAddress(view.id, "review"))
          }}
        >
          {props.canImport ? "Continue" : "Open"}
          <span className="sr-only"> {view.fileName}</span>
        </Button>
      </ItemActions>
    </Item>
  )
}

/**
 * The files imported before, last confirmed first, each a link to its result: what it imported, what it left out,
 * the take-back. Shown once there is one; a failure to list them says so instead of looking like none.
 */
function PastImports() {
  const pastRead = useAtomValue(pastImports)
  const past = resultOf(pastRead)
  const askPastAgain = useAtomRefresh(pastImports)
  if (past.isError) {
    return (
      <div className="px-4 pt-6 sm:px-9">
        <Alert>
          <AlertTitle>Past imports could not be listed</AlertTitle>
          <AlertDescription>
            <p>They are safe. {sayError(past.error).sentence}</p>
            <Button variant="outline" size="sm" onClick={askPastAgain}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    )
  }
  const listed = past.data?.imports ?? []
  if (listed.length === 0) return null
  const older = past.data?.older ?? 0
  return (
    <section aria-labelledby="past-imports" className="flex flex-col pt-6">
      <h2 id="past-imports" className="px-4 pb-2 text-sm font-medium sm:px-9">
        Imported before
      </h2>
      <ListTable
        caption="Files imported before"
        searchLabel="Search past imports"
        columns={pastImportColumnsShortAtom}
        rows={pastImportRows}
        rowKey={(entry) => entry.id}
        empty="No file has been imported yet."
        maxWidth={672}
      />
      {older === 0 ? null : (
        <p className="px-4 text-sm text-muted-foreground sm:px-9">
          {whole.format(older)} older {older === 1 ? "import is" : "imports are"} listed under Activity, Imports.
        </p>
      )}
    </section>
  )
}

/** A sentence for a file the screen itself could not take (a sample that would not load, a file no longer kept). */
const uploadProblem = Atom.make<string | undefined>(undefined)

/**
 * The first screen: choose or drop a file, or take the sample list, which goes through the same code. The chosen
 * file is kept in this browser until the server has it all (`useSavedProgress`): a reload or a closed tab in the
 * middle of an upload offers Continue, which reads the same file again, instead of asking for it again.
 */
export function UploadStep(props: { canImport: boolean; viewOnly: boolean }) {
  const state = useAtomValue(uploadState)
  const startOne = useAtomSet(startUpload)
  const cancel = useAtomSet(cancelUpload)
  const signedIn = useAtomValue(member)
  const actor = O.getOrUndefined(signedIn)
  const progress = useSavedProgress(
    actor === undefined ? undefined : { organizationId: actor.organizationId, memberId: actor.id, screen: "upload" },
    catalogRuntime()
  )
  const [problem, setProblem] = useAtom(uploadProblem)
  const picker = useRef<HTMLDivElement>(null)
  // Every file somebody loaded and has not confirmed, each on its own: coming back resumes one or removes it.
  const openRead = useAtomValue(openImportsRead)
  const openImports = resultOf(openRead)
  const askOpenAgain = useAtomRefresh(openImportsRead)
  const open = openImports.data
  const views = open?.views ?? []
  const busy = isBusy(state)

  // Keeps the file until the upload ends: arrived or cancelled, nothing is left to continue; a file that cannot be
  // staged (its own problem) is not worth reading again; a save that failed (the network) can be continued.
  const { keepFile, save, clear } = progress
  const send = (file: File) => {
    keepFile(file)
    save({
      step: "upload",
      file: O.some(
        StoredFile.make({
          name: file.name,
          size: ByteSize.bytes(file.size),
          lastModified: DateTime.makeUnsafe(file.lastModified),
          sheet: O.none()
        })
      ),
      review: O.none()
    })
    startOne({
      file,
      // A save that failed keeps the file, for Continue; any other ending lets it go.
      onEnd: UploadEnd.$match({
        Arrived: () => clear(),
        Cancelled: () => clear(),
        Refused: () => clear(),
        Failed: ({ step }) => {
          if (step === "read") clear()
        }
      })
    })
  }
  // A file whose upload stopped with the page. Not offered once an import of it exists: a reload while the server
  // was preparing it still finished it, and it is in the list above.
  const saved = progress.saved
  const stopped = saved?.step === "upload" ? O.getOrNull(saved.file) : null
  const landed =
    stopped !== null &&
    saved !== undefined &&
    views.some(
      (view) => view.fileName === stopped.name && DateTime.isGreaterThanOrEqualTo(view.createdAt, saved.savedAt)
    )
  // One filled button on the screen: Continue when a file stopped, else the first open import, else Choose file.
  const offered = stopped !== null && !landed && !busy && props.canImport
  const resume = () => {
    if (stopped === null) return
    void progress.file().then((file) => {
      if (file !== undefined) return send(file)
      clear()
      setProblem(`${stopped.name} is no longer kept in this browser. Choose it again.`)
    })
  }

  const takeSample = (sample: (typeof samples)[number]) => {
    setProblem(undefined)
    return request(sample.href)
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status))
        return response.blob().then((blob) => send(new File([blob], sample.name)))
      })
      .catch(() => {
        setProblem(`The sample ${sample.name} could not be loaded. Download it with the link beside it and choose it.`)
      })
  }

  const fileInput = () => picker.current?.querySelector<HTMLInputElement>('input[type="file"]') ?? null
  const dragging = useAtomValue(fileOverPage) && props.canImport && !busy

  const failed = UploadState.guards.Failed(state) ? state : undefined
  const refused = UploadState.guards.Refused(state) ? state.problem : undefined
  return (
    <div
      data-upload-step=""
      // The page hands a dropped file to the step only while it takes one (not a viewer, not an upload under way).
      data-takes-files={props.canImport && !busy ? "" : undefined}
      className="relative h-full overflow-y-auto"
    >
      <div className="mx-auto flex w-full max-w-2xl flex-col pb-8">
        <PageHeader title="Import items" line=".csv or .xlsx" />
        <div className="flex flex-col gap-4 px-4 sm:px-9">
          {openImports.isError ? (
            // Not knowing is not the same as none: without this the screen would look as if no file were waiting.
            <Alert>
              <AlertTitle>Files loaded earlier could not be listed</AlertTitle>
              <AlertDescription>
                <p>They are safe. {sayError(openImports.error).sentence}</p>
                <Button variant="outline" size="sm" onClick={askOpenAgain}>
                  Try again
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}
          {!offered || stopped === null ? null : (
            <Item variant="outline" className="flex-wrap">
              <ItemContent className="min-w-56">
                <ItemTitle className="max-w-full">
                  <span className="truncate">{stopped.name}</span>
                </ItemTitle>
                <ItemDescription>
                  Stopped before it was saved. Continue reads it again from this browser.
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="ghost" onClick={clear}>
                  Start again
                </Button>
                <Button onClick={resume}>
                  Continue<span className="sr-only"> {stopped.name}</span>
                </Button>
              </ItemActions>
            </Item>
          )}
          {views.length === 0 ? null : (
            <ul aria-label="Files not imported yet" className="flex flex-col gap-2">
              {views.map((view, index) => (
                <li key={view.id}>
                  <OpenImport view={view} lead={index === 0 && !offered} canImport={props.canImport} />
                </li>
              ))}
            </ul>
          )}
          {open === undefined || open.older === 0 ? null : (
            <p className="text-sm text-muted-foreground">
              {whole.format(open.older)} older {open.older === 1 ? "file is" : "files are"} not shown.{" "}
              {props.canImport
                ? `Remove or import one above to see ${open.older === 1 ? "it" : "them"}.`
                : `${open.older === 1 ? "It appears" : "They appear"} once an editor removes or imports one above.`}
            </p>
          )}
          {props.viewOnly ? (
            // A viewer is told why, where the control would be: a dimmed button that does nothing explains nothing.
            <div
              role="note"
              // A plain frame, not the upload box's dashes: dashes say "drop a file here".
              className="flex min-h-40 flex-col items-center justify-center gap-1 rounded-lg border bg-muted/40 p-6 text-center"
            >
              <p className="text-sm font-medium">Importing needs an editor</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                You are a viewer{actor === undefined ? "" : ` in ${actor.organizationName}`}, so you can open what is
                here and cannot load a file. An admin changes roles under People.
              </p>
            </div>
          ) : busy ? (
            // While a file is read and saved the upload box is switched off (it takes no second file), and a switched
            // off box takes no pointer at all: Cancel inside it could not be pressed. The progress and its Cancel
            // stand in the box's place instead, outside it.
            <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6">
              <UploadProgress state={state} onCancel={() => cancel()} />
            </div>
          ) : (
            <FileUpload
              ref={picker}
              label="Items file"
              accept={pickable}
              maxFiles={1}
              value={[]}
              disabled={!props.canImport}
              // onAccept, not onValueChange: the kit calls onValueChange twice for one controlled choice, which staged
              // every chosen file twice.
              onAccept={(files) => {
                const file = files[0]
                if (file === undefined) return
                setProblem(undefined)
                send(file)
              }}
              // The kit's own words ("File type not accepted") are not the person's: say what the file is not.
              onFileReject={(file, why) =>
                setProblem(
                  why === "File type not accepted"
                    ? `"${file.name}" is not a spreadsheet. Choose a .csv or .xlsx file.`
                    : why
                )
              }
            >
              <FileUploadDropzone className="min-h-40">
                {/* Nobody drags a file on a phone. */}
                <span className="text-center text-sm text-muted-foreground max-md:hidden">
                  Drop a file here, or anywhere on this page
                </span>
                {/* A plain button that opens the picker: wrapped in the upload's own trigger it stops being counted
                    as the screen's one filled button. */}
                <Button
                  variant={views.length === 0 && !offered ? "default" : "outline"}
                  disabled={!props.canImport}
                  onClick={(event) => {
                    event.stopPropagation()
                    fileInput()?.click()
                  }}
                >
                  Choose file
                </Button>
              </FileUploadDropzone>
            </FileUpload>
          )}

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <span className="text-muted-foreground max-sm:w-full">Sample files</span>
            {samples.map((sample) => (
              <span key={sample.name} className="flex items-center gap-2">
                {props.viewOnly ? null : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!props.canImport || busy}
                    onClick={() => void takeSample(sample)}
                  >
                    Use {sample.name}
                  </Button>
                )}
                <Button variant="link" size="sm" asChild>
                  <a href={sample.href} download>
                    Download
                    {/* With no "Use" button beside it, the link has to name its file itself. */}
                    <span className={props.viewOnly ? undefined : "sr-only"}> {sample.name}</span>
                  </a>
                </Button>
              </span>
            ))}
          </div>

          {refused === undefined ? null : (
            // The file's own problem, as data: what is wrong with it, then what to do. Nothing was saved.
            <Alert variant="destructive" aria-live="polite">
              <AlertTitle>{fileProblemTitle(refused.kind, "items")}</AlertTitle>
              <AlertDescription>
                <p>{refused.problem}</p>
                <p>{refused.todo}</p>
              </AlertDescription>
            </Alert>
          )}
          {problem === undefined && failed === undefined ? null : (
            <Alert variant="destructive">
              <AlertTitle>{failed?.step === "save" ? "The file was not saved" : "The file was not read"}</AlertTitle>
              <AlertDescription>{problem ?? failed?.message}</AlertDescription>
            </Alert>
          )}
        </div>
        <PastImports />
      </div>
      {dragging ? (
        // Over the whole page while a file is held above it. It takes no pointer events: the drop lands on the page.
        <div
          aria-hidden
          className="pointer-events-none absolute inset-2 z-30 flex items-center justify-center rounded-lg border-2 border-dashed border-primary bg-background/90"
        >
          <span className="text-base font-medium">Drop the file to load it</span>
        </div>
      ) : null}
    </div>
  )
}
