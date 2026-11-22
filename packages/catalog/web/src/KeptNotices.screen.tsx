import { useAtomSet, useAtomValue } from "@effect/atom-react"
import * as A from "effect/Array"
import { TriangleAlertIcon } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@inventory/ui/components/alert"
import { Button } from "@inventory/ui/components/button"
import { isNarrow } from "@inventory/ui/ContentWidth"
import { noticeWords } from "./internal/notices.ts"
import { dismissNotice, notices } from "./Notices.atoms.ts"

/**
 * What became of the person's unsaved decisions while this tab was away, above whatever page is shown: taken up by
 * another tab of theirs, or let go because the import was removed, row by row. Each stays until they dismiss it.
 */
export function KeptNotices() {
  const said = useAtomValue(notices)
  const dismiss = useAtomSet(dismissNotice)
  const narrow = useAtomValue(isNarrow)
  if (!A.isReadonlyArrayNonEmpty(said)) return null
  return (
    // A few lines at most, never over the page: many of them scroll in their own room.
    <div className="max-h-1/3 flex-none overflow-y-auto">
      {A.map(said, (notice) => {
        const words = noticeWords(notice)
        return (
          <Alert
            key={`${words.title}:${notice.importId}`}
            role="alert"
            className={narrow ? "mx-4 my-3 w-auto" : "mx-6 my-4 w-auto"}
          >
            <TriangleAlertIcon aria-hidden />
            <AlertTitle>{words.title}</AlertTitle>
            <AlertDescription>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <p className="min-w-0">{words.text}</p>
                <Button variant="outline" size="xs" onClick={() => dismiss(notice)}>
                  Dismiss
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )
      })}
    </div>
  )
}
