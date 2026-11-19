// Who is signed in, for the app's shell: the access screens' session controller (`@inventory/access-web/Session`),
// told once where this app asks for the session and what it starts for a signed-in member. This module is in the
// first download: it brings neither the API client nor the contract.
import {
  configureSession,
  signedOutHere,
  signInWithPassword,
  useSession,
  wasSignedIn
} from "@inventory/access-web/Session"
import { sessionPath } from "../../api/v1/Version.ts"
import { preload } from "../preload.ts"

// The workspace's code and the first screen's data are asked for the moment someone is known to be signed in.
configureSession({ sessionPath, onSignedIn: preload })

export { signedOutHere, signInWithPassword, wasSignedIn }

/**
 * Who is signed in, and as whom they act: one request (`GET /api/v1/identity/session`, always a 200), fetched once
 * and shared by every component that asks.
 */
export const useActor = useSession
