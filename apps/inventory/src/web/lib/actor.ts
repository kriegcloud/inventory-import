// Who is signed in, for the app's shell: the access screens' session atoms (`@inventory/access-web/Session`),
// told once where this app asks for the session and what it starts for a signed-in member. This module is in the
// first download: it brings neither the API client nor the contract.
import {
  configureSession,
  sessionEnded,
  signedOutHere,
  signInWithPassword,
  wasSignedIn
} from "@inventory/access-web/Session"
import { sessionPath } from "../../api/v1/Version.ts"
import { preload } from "../preload.ts"

// The workspace's code and the first screen's data are asked for the moment someone is known to be signed in.
configureSession({ sessionPath, onSignedIn: preload })

export { sessionEnded, signedOutHere, signInWithPassword, wasSignedIn }
