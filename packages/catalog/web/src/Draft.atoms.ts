// Where one import's draft is held in the tab: the machine's state (`Draft.machine.ts`), one per import. A file of
// its own so that what removes an import can empty its draft without knowing how the Review step runs it.
import * as Atom from "effect/reactivity/Atom"
import { perKey } from "@inventory/client/Api"
import type { ImportId } from "@inventory/catalog-contract/Ids"
import { type Draft, emptyDraft } from "./Draft.machine.ts"

/**
 * One import's draft: what this tab holds of the server's decisions and what the person changed here that the server
 * has not confirmed. Kept for as long as the page lives, because a save that is out, or one waiting for "Save again",
 * is the person's work whether or not the Review step is drawn; the machine empties it when the step has left and the
 * server has everything, and when the import is confirmed or removed.
 */
export const draftOf = perKey((_id: ImportId) => Atom.keepAlive(Atom.make<Draft>(emptyDraft)))
