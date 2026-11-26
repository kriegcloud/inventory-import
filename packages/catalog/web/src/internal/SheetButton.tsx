import { useAtomSet, useAtomValue } from "@effect/atom-react"
import type { ImportId } from "@inventory/catalog-contract/Ids"
import { SheetIcon } from "lucide-react"
import { SheetChooser } from "./SheetChooser.tsx"
import { Button } from "@inventory/ui/components/button"
import { Popover, PopoverContent, PopoverTrigger } from "@inventory/ui/components/popover"
import { openWorkbook } from "../Imports.atoms.ts"
import * as A from "effect/Array"
import * as O from "effect/Option"
import { navigate } from "@inventory/ui/Route"
import { importAddress } from "./route.ts"
import { startUpload } from "../Upload.controller.ts"

/**
 * Which sheet of the workbook was read, and a way to read another one. Shows only while the workbook chosen in
 * this tab is still in memory and has more than one sheet with data: after a reload the browser no longer has the
 * file, and the sheet's name is in the review's activity instead. Another sheet is a new upload, so the person goes
 * to the upload screen and watches it there.
 */
export function SheetButton(props: { importId: ImportId }) {
  const start = useAtomSet(startUpload)
  const opened = useAtomValue(openWorkbook(props.importId))
  return O.match(
    O.filter(opened, (workbook) => A.filter(workbook.sheets, (sheet) => sheet.rowCount > 0).length >= 2),
    {
      onNone: () => null,
      onSome: (workbook) => (
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
                start({ file: workbook.file, sheet })
                navigate(importAddress(props.importId, "upload"), { replace: false })
              }}
            />
          </PopoverContent>
        </Popover>
      )
    }
  )
}
