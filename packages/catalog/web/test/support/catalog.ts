// A registry with a stand-in for the catalog's API client: each test gives the few endpoints it calls, and an import
// as the server would send it with only the fields the rule under test reads.
import * as Layer from "effect/Layer"
import * as Str from "effect/String"
import * as AtomRegistry from "effect/reactivity/AtomRegistry"
import { provideApi } from "@inventory/client/Api"
import { makeApi } from "@inventory/client/ApiRuntime"
import { provideMember, provideWhoIsSignedInAsked } from "@inventory/client/MemberAtoms"
import type { ImportId } from "@inventory/catalog-contract/Ids"
import type { ImportView } from "@inventory/catalog-contract/Import"
import * as Effect from "effect/Effect"
import * as ManagedRuntime from "effect/ManagedRuntime"
import {
  type CatalogApiClient,
  type CatalogBinding,
  CatalogClient,
  configureCatalog
} from "../../src/Catalog.runtime.ts"

/**
 * A registry whose catalog client answers with `endpoints`; the calls made outside atoms (the review's saver) reach
 * the same stand-in. With `idleTTL`, it keeps an atom nobody reads for that long, as the app's does for 400 ms; with
 * `signedIn`, the member is read from that atom, as the app reads it from the session.
 */
export const registryFor = (input: {
  readonly endpoints: object
  readonly idleTTL?: number
  readonly signedIn?: Parameters<typeof provideMember>[0]
  /** True while who is signed in is being asked again, as the app reads it from its session. */
  readonly asked?: Parameters<typeof provideWhoIsSignedInAsked>[0]
  /** Writes go through the app's own `callWrite`: a failure that may pass is sent again, as it is in the app. */
  readonly writesRetried?: boolean
}): AtomRegistry.AtomRegistry => {
  // The stand-in holds only the endpoints the test calls: the rest of the client is never reached.
  const client = input.endpoints as CatalogApiClient
  const run: CatalogBinding["call"] = (use) => Effect.runPromise(use(client))
  const callWrite =
    input.writesRetried === true
      ? makeApi(ManagedRuntime.make(Layer.succeed(CatalogClient, client)), CatalogClient).callWrite
      : run
  configureCatalog({ call: run, callWrite } as CatalogBinding)
  return AtomRegistry.make({
    initialValues: [
      provideApi(Layer.succeed(CatalogClient, client)),
      ...(input.signedIn === undefined ? [] : [provideMember(input.signedIn)]),
      ...(input.asked === undefined ? [] : [provideWhoIsSignedInAsked(input.asked)])
    ],
    ...(input.idleTTL === undefined ? {} : { defaultIdleTTL: input.idleTTL })
  })
}

/** A registry whose catalog client answers with `endpoints`, which lets an atom go the moment nobody reads it. */
export const registryWith = (endpoints: object): AtomRegistry.AtomRegistry => registryFor({ endpoints })

/** The id an import has when a test needs only one. */
export const importId = "00000000-0000-4000-8000-000000000001" as ImportId

/** Another import's id: the review's saver is one per import for the page's life, so each test takes its own. */
export const importNo = (n: number): ImportId =>
  `00000000-0000-4000-8000-0000000001${Str.padStart(2, "0")(String(n))}` as ImportId

/** An import's view with the fields the draft rules read; the rest is never looked at. */
export const viewAt = (parts: Partial<ImportView> & { readonly revision: number }): ImportView => {
  const view: Record<string, unknown> = {
    id: importId,
    status: "open",
    decisions: {},
    suggestions: [],
    choices: [],
    // Never confirmed, unless the test says otherwise.
    history: [],
    // No match took anything back, unless the test says otherwise.
    takenBack: [],
    ...parts
  }
  return view as unknown as ImportView
}
