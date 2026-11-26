import { StagedTable } from "@inventory/catalog-contract/Staged"
import { ItemFacets } from "@inventory/catalog-contract/ItemQuery"
import { unsafeAssert } from "@beep/unsafe-assert"
import * as DateTime from "effect/DateTime"
// A registry with a stand-in for the catalog's API client: each test gives the few endpoints it calls, and an import
// as the server would send it with only the fields the rule under test reads.
import * as Layer from "effect/Layer"
import * as Str from "effect/String"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as AtomRegistry from "effect/reactivity/AtomRegistry"
import { provideApi } from "@inventory/client/Api"
import { makeApi } from "@inventory/client/ApiRuntime"
import { provideMember, provideWhoIsSignedInAsked } from "@inventory/client/MemberAtoms"
import { ImportId } from "@inventory/catalog-contract/Ids"
import { ImportView } from "@inventory/catalog-contract/Import"
import * as Effect from "effect/Effect"
import * as ManagedRuntime from "effect/ManagedRuntime"
import {
  type CatalogApiClient,
  type CatalogBinding,
  CatalogClient,
  configureCatalog
} from "../../src/Catalog.runtime.ts"

declare const typedClient: CatalogApiClient
export type SaveAnswer = Effect.Success<ReturnType<typeof typedClient.imports.decide<"decoded-only">>>
export type SuggestAnswer = Effect.Success<ReturnType<typeof typedClient.imports.suggest<"decoded-only">>>

type EndpointStandIns = {
  readonly [Group in keyof CatalogApiClient]?: {
    readonly [Endpoint in keyof CatalogApiClient[Group]]?: CatalogApiClient[Group][Endpoint] extends (
      ...args: infer Args
    ) => Effect.Effect<infer Value, infer _Error, infer Requirements>
      ? (...args: Args) => Effect.Effect<Value, unknown, Requirements>
      : never
  }
}

/** Test endpoints use decoded responses, with every unprovided endpoint failing if accidentally called. */
export const catalogClientWith = (endpoints: EndpointStandIns): CatalogApiClient => {
  const unused = () => Effect.die("The test called an endpoint it did not provide")
  return unsafeAssert<CatalogApiClient>(
    {
      imports: {
        open: unused,
        past: unused,
        changes: unused,
        beginUpload: unused,
        putChunk: unused,
        finishUpload: unused,
        discardUpload: unused,
        get: unused,
        table: unused,
        match: unused,
        suggest: unused,
        decide: unused,
        commit: unused,
        takeBack: unused,
        reopen: unused,
        remove: unused,
        ...endpoints.imports
      },
      items: { list: unused, page: unused, facets: unused, edit: unused, ...endpoints.items },
      assistant: { view: unused, ...endpoints.assistant }
    },
    "HttpApiClient endpoint methods quantify over responseMode and select conditional return types; these test stand-ins implement only the decoded response mode used by the catalog screens, and tests provide every endpoint they exercise."
  )
}

/**
 * A registry whose catalog client answers with `endpoints`; the calls made outside atoms (the review's saver) reach
 * the same stand-in. With `idleTTL`, it keeps an atom nobody reads for that long, as the app's does for 400 ms; with
 * `signedIn`, the member is read from that atom, as the app reads it from the session.
 */
export const registryStart = {
  idleTTL: O.none<number>(),
  signedIn: O.none<Parameters<typeof provideMember>[0]>(),
  asked: O.none<Parameters<typeof provideWhoIsSignedInAsked>[0]>(),
  writesRetried: false
}

export const registryFor = (input: {
  readonly endpoints: EndpointStandIns
  readonly idleTTL: O.Option<number>
  readonly signedIn: O.Option<Parameters<typeof provideMember>[0]>
  /** True while who is signed in is being asked again, as the app reads it from its session. */
  readonly asked: O.Option<Parameters<typeof provideWhoIsSignedInAsked>[0]>
  /** Writes go through the app's own `callWrite`: a failure that may pass is sent again, as it is in the app. */
  readonly writesRetried: boolean
}): AtomRegistry.AtomRegistry => {
  // The stand-in holds only the endpoints the test calls: the rest of the client is never reached.
  const client = catalogClientWith(input.endpoints)
  const run: CatalogBinding["call"] = (use) => Effect.runPromise(use(client))
  const callWrite =
    input.writesRetried === true
      ? makeApi(ManagedRuntime.make(Layer.succeed(CatalogClient, client)), CatalogClient).callWrite
      : run
  const runtime = ManagedRuntime.make(Layer.empty)
  configureCatalog({ call: run, callWrite, fork: (use) => runtime.runFork(use(client)), runtime, apiPrefix: "/api/v1" })
  return AtomRegistry.make({
    initialValues: [
      provideApi(Layer.succeed(CatalogClient, client)),
      ...O.toArray(O.map(input.signedIn, provideMember)),
      ...O.toArray(O.map(input.asked, provideWhoIsSignedInAsked))
    ],
    ...R.getSomes({ defaultIdleTTL: input.idleTTL })
  })
}

/** A registry whose catalog client answers with `endpoints`, which lets an atom go the moment nobody reads it. */
export const registryWith = (endpoints: EndpointStandIns): AtomRegistry.AtomRegistry =>
  registryFor({ ...registryStart, endpoints })

/** The id an import has when a test needs only one. */
export const importId = ImportId.make("00000000-0000-4000-8000-000000000001")

/** Another import's id: the review's saver is one per import for the page's life, so each test takes its own. */
export const importNo = (n: number): ImportId =>
  ImportId.make(`00000000-0000-4000-8000-0000000001${Str.padStart(2, "0")(String(n))}`)

/** An import's view with the fields the draft rules read; the rest is never looked at. */
export const viewAt = (parts: Partial<ImportView> & { readonly revision: number }): ImportView =>
  ImportView.make({
    id: importId,
    fileName: "items.csv",
    status: "open",
    decisions: {},
    suggestions: [],
    choices: [],
    startedBy: "Dana Whitfield",
    createdAt: DateTime.makeUnsafe("2026-11-19T05:06:15.445Z"),
    rowCount: 0,
    storedItems: [],
    mapping: [],
    unusedColumns: [],
    createdRows: [],
    createdIds: [],
    progress: { needsAtStart: 0, needs: 0, decision: 0, cannot: 0, ready: 0, fixedRows: 0, fixedCells: 0, rows: 0 },
    result: O.none(),
    takeBack: { confirms: [], removable: 0, restorable: 0, changed: [], changedCount: 0, kept: [], keptCount: 0 },
    // Never confirmed, unless the test says otherwise.
    history: [],
    // No match took anything back, unless the test says otherwise.
    takenBack: [],
    ...parts
  })

/** A complete empty staged CSV for tests whose concern is the surrounding page state. */
export const emptyTable = StagedTable.make({
  fileName: "items.csv",
  kind: "csv",
  sheet: O.none(),
  headerRowNumber: 1,
  columns: [{ index: 0, letter: "A", label: "SKU" }],
  rows: [],
  notes: []
})
/** The facets of an organization with no items. */
export const emptyFacets = ItemFacets.make({
  total: 0,
  category: [],
  uom: [],
  isActive: [],
  lotTracked: [],
  unitCost: { min: O.none(), max: O.none() },
  quantityOnHand: { min: O.none(), max: O.none() }
})
