import { SheetIcon } from "lucide-react"
import { SheetChooser } from "@/components/app/SheetChooser"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { workbookOf } from "@/lib/imports"
import { importAddress, navigate } from "@/lib/route"
import { useUpload } from "@/lib/upload"

/**
 * Which sheet of the workbook was read, and a way to read another one. Shows only while the workbook chosen in
 * this tab is still in memory and has more than one sheet with data: after a reload the browser no longer has the
 * file, and the sheet's name is in the review's activity instead. Another sheet is a new upload, so the person goes
 * to the upload screen and watches it there.
 */
export function SheetButton(props: { importId: string }) {
  const upload = useUpload()
  const workbook = workbookOf(props.importId)
  if (workbook === undefined || workbook.sheets.filter((sheet) => sheet.rowCount > 0).length < 2) return null
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <SheetIcon aria-hidden />
          <span className="sr-only">Sheet: </span>
          {workbook.chosen.name}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96">
        <SheetChooser
          sheets={workbook.sheets}
          chosen={workbook.chosen}
          onChoose={(sheet) => {
            upload.start(workbook.file, sheet)
            navigate(importAddress(props.importId, "upload"))
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
