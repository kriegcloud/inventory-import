import type { ReactNode } from "react"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle
} from "@inventory/ui/components/drawer"

/**
 * A panel that rises from the bottom of a phone's screen: the activity, or the confirm. A module of its own, so the
 * drawer's code (vaul) is fetched only on a phone, after the review is drawn, and never on a desk.
 */
export function PhoneDrawer(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCloseAutoFocus: (event: Event) => void
  title: ReactNode
  description: ReactNode
  /** The description is for a screen reader only. */
  quietDescription?: boolean
  footer?: ReactNode
  children: ReactNode
}) {
  return (
    <Drawer open={props.open} onOpenChange={props.onOpenChange} autoFocus>
      <DrawerContent onCloseAutoFocus={props.onCloseAutoFocus}>
        <DrawerHeader>
          <DrawerTitle>{props.title}</DrawerTitle>
          <DrawerDescription {...(props.quietDescription === true ? { className: "sr-only" } : {})}>
            {props.description}
          </DrawerDescription>
        </DrawerHeader>
        {props.children}
        {props.footer === undefined ? null : <DrawerFooter>{props.footer}</DrawerFooter>}
      </DrawerContent>
    </Drawer>
  )
}
