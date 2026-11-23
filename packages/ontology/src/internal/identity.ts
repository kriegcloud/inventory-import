// The ontology package's identity composer. The vendored `@beep/identity` makes every root under `@beep`, so the
// identifiers read `@beep/inventory/ontology/...` (decision "kernel identity"), as the kernel's and the contexts' do.
import * as Id from "@beep/identity/Id"

/** Identity composer for `@inventory/ontology`. */
export const $OntologyId = Id.make("inventory").$InventoryId.compose("ontology").$OntologyId
