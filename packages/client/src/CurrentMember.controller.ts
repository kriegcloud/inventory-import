// Who is signed in, for the screens of a web package: the app asks once (its session controller) and provides the
// member here, above every screen it mounts, so a screen mirrors the server's role rule without knowing how the
// session is read. The server enforces the rule; this only keeps a refused button off the screen.
import type { Member } from "@inventory/kernel/Member"
import { createContext, useContext } from "react"

/** The signed-in member of the active organization, or undefined while that is not known yet. */
export const CurrentMember = createContext<Member | undefined>(undefined)

/** The signed-in member, as the app provided it. */
export const useMember = (): Member | undefined => useContext(CurrentMember)
