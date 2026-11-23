/**
 * Two of Benjamin's rules on how code is shaped, each held by a law with a list of today's files that may only shrink
 * (`internal/listed.ts`).
 *
 * - Helpers take the value they act on first and are `dual` (2026-11-22: "If we are going to make helpers. We make
 *   them dual & pipe friendly with properly ordered parameters. i.e `cause` should be first parameter"). The law
 *   reads the clear case: a helper declared with a name (`const f = (…) =>`, `function f(…)`), of two values or more,
 *   that names one `cause`, `error`, `self` or `input` and is not written `dual(…)`, wherever that one stands. A
 *   helper of two values that names none of them is not read: which one it acts on is not in its words. A function
 *   handed to a call as an argument is not read: the call sets its order.
 * - Properties are `readonly` (2026-11-22: "All object types & interfaces should have readonly properties in the bast
 *   majority of cases"), React props among them. The law refuses, without `readonly`: a property of an object type
 *   or an interface, an index signature, a class's field, a mapped type's properties, and an array type (`T[]`,
 *   `Array<T>`) inside a property's own type. An array type elsewhere (a local list a function fills) is no property,
 *   so it is not read. The one kind of exception is another library's types, augmented in `declare global` or
 *   `declare module "…"`, whose shape is not ours; a `declare namespace` of our own is read.
 *
 * Not read by either, each by name: vendored code that another check holds byte for byte to its source (beep-effect's
 * kit under `packages/foundation/`, `bun run vendor:check`; the Alchemy packages under `vendor/`,
 * `bun run alchemy:check`), the agent skills (`.agents/`, `.codex/`), and the scratchpad, where the laws apply when an
 * experiment graduates. The components and hooks under `packages/ui/` came from registries, but every one has been
 * changed here since it was first committed and nothing holds it to its registry, so they are read and listed like
 * any other file.
 *
 * Each list names a file with the number of places it breaks its rule, which only falls (`internal/ledger.ts`).
 *
 * @packageDocumentation
 */
import { scratchpadFolder } from "../../Repo.schema.ts"
import type { Ledger } from "./internal/ledger.ts"
import { type ListedSpec, listedLaw, listedSentence } from "./internal/listed.ts"
import { helpersNotDual, mutableProperties } from "./internal/shapesCode.ts"

/** What neither law reads, from the root. */
export const shapesLeftOut: ReadonlyArray<string> = [
  ".agents/",
  ".codex/",
  `${scratchpadFolder}/`,
  "vendor/",
  "packages/foundation/modeling/identity/",
  "packages/foundation/modeling/schema/",
  "packages/foundation/modeling/utils/",
  "packages/foundation/primitive/"
]

/** The files with a helper that names the value it acts on and is not dual, today, each with how many: these only fall. */
export const dualListed: Ledger = {
  "packages/catalog/model/src/Import/Waited.rules.ts": 4,
  "packages/catalog/model/test/Review.story.test.ts": 1,
  "packages/catalog/web/src/ItemEditor.screen.tsx": 1,
  "packages/catalog/web/src/internal/spreadsheet/xlsx.ts": 1,
  "packages/client/src/Http.runtime.ts": 1,
  "packages/client/src/Optimistic.atoms.ts": 1,
  "packages/client/src/SayError.controller.ts": 3,
  "packages/foundation/modeling/csv/src/Csv.codec.ts": 2,
  "packages/foundation/modeling/xlsx/src/Xlsx.codec.ts": 3,
  "packages/review/src/ReviewDraft.rules.ts": 1,
  "packages/review/src/ReviewRegion.atoms.ts": 2,
  "packages/review/src/internal/ReviewGrid.tsx": 1,
  "packages/review/src/internal/keptStore.ts": 1,
  "packages/ui/src/TableSearch.component.tsx": 1,
  "packages/ui/src/components/data-table/data-table-config.ts": 1,
  "packages/ui/src/components/file-upload.tsx": 2
}

/** The files with a property that is not readonly, today, each with how many: these only fall. */
export const readonlyListed: Ledger = {
  "apps/inventory/src/web/Workspace.tsx": 3,
  "apps/inventory/src/web/components/app/AppShell.tsx": 7,
  "apps/inventory/src/web/components/app/AppSidebar.tsx": 3,
  "apps/inventory/src/web/components/app/BrandMark.tsx": 1,
  "apps/inventory/src/web/components/app/SignedIn.tsx": 1,
  "apps/inventory/src/web/pages/ReviewGallery.tsx": 1,
  "apps/inventory/src/web/pages/gallery/JobsReview.tsx": 4,
  "apps/inventory/test/server/People.slow.test.ts": 1,
  "apps/inventory/test/server/RequestTelemetry.test.ts": 1,
  "apps/inventory/test/server/Tenancy.slow.test.ts": 2,
  "apps/inventory/test/server/WaitedRows.slow.test.ts": 1,
  "apps/inventory/test/web/session.test.ts": 1,
  "apps/inventory/test/web/support/page.ts": 5,
  "packages/access/host/src/internal/authOptions.ts": 2,
  "packages/access/model/test/Rules.test.ts": 1,
  "packages/access/web/src/AuditEvents.screen.tsx": 1,
  "packages/access/web/src/People.screen.tsx": 1,
  "packages/access/web/src/SignIn.screen.tsx": 4,
  "packages/access/web/src/internal/authClient.ts": 2,
  "packages/catalog/model/src/Actor/Actor.context.ts": 1,
  "packages/catalog/model/src/Item/ItemEdit.rules.ts": 2,
  "packages/catalog/model/src/Item/ItemSearch.rules.ts": 3,
  "packages/catalog/model/src/Review/CellReading.rules.ts": 2,
  "packages/catalog/web/src/Draft.atoms.ts": 1,
  "packages/catalog/web/src/Draft.machine.ts": 34,
  "packages/catalog/web/src/ImportPage.screen.tsx": 1,
  "packages/catalog/web/src/Imports.atoms.ts": 1,
  "packages/catalog/web/src/ItemEditor.screen.tsx": 3,
  "packages/catalog/web/src/MatchStep.screen.tsx": 3,
  "packages/catalog/web/src/Notices.atoms.ts": 1,
  "packages/catalog/web/src/PastImports.screen.tsx": 1,
  "packages/catalog/web/src/ResultStep.screen.tsx": 3,
  "packages/catalog/web/src/ReviewStep.screen.tsx": 16,
  "packages/catalog/web/src/TableAssistant.screen.tsx": 3,
  "packages/catalog/web/src/Upload.controller.ts": 4,
  "packages/catalog/web/src/Upload.machine.ts": 1,
  "packages/catalog/web/src/UploadStep.screen.tsx": 3,
  "packages/catalog/web/src/internal/CellForms.tsx": 1,
  "packages/catalog/web/src/internal/SheetButton.tsx": 1,
  "packages/catalog/web/src/internal/SheetChooser.tsx": 4,
  "packages/catalog/web/src/internal/WhyFlagged.tsx": 1,
  "packages/catalog/web/src/internal/cellDrafts.ts": 2,
  "packages/catalog/web/src/internal/format.tsx": 2,
  "packages/catalog/web/src/internal/protocol.ts": 6,
  "packages/catalog/web/src/internal/reader.worker.ts": 1,
  "packages/catalog/web/src/internal/spreadsheet/csv.ts": 5,
  "packages/catalog/web/src/internal/spreadsheet/read.ts": 4,
  "packages/catalog/web/src/internal/spreadsheet/xlsx.ts": 5,
  "packages/catalog/web/test/Draft.machine.test.ts": 1,
  "packages/catalog/web/test/DraftRegion.test.ts": 2,
  "packages/catalog/web/test/ImportPage.test.ts": 1,
  "packages/catalog/web/test/ItemEditor.test.ts": 2,
  "packages/catalog/web/test/KeptRows.test.ts": 15,
  "packages/catalog/web/test/ReviewHistory.test.ts": 1,
  "packages/catalog/web/test/ReviewModelFold.fold.test.ts": 4,
  "packages/catalog/web/test/SessionAsked.test.ts": 2,
  "packages/catalog/web/test/TabRows.test.ts": 3,
  "packages/catalog/web/test/UploadOwner.test.ts": 4,
  "packages/catalog/web/test/reviewParity.test.ts": 2,
  "packages/catalog/web/test/support/draftWorld.ts": 31,
  "packages/catalog/web/test/support/session.ts": 2,
  "packages/client/test/Connection.atoms.test.ts": 1,
  "packages/drivers/d1/src/D1.test-layer.ts": 1,
  "packages/foundation/modeling/csv/src/internal/header.ts": 1,
  "packages/foundation/modeling/csv/src/internal/machine.ts": 26,
  "packages/foundation/modeling/xlsx/src/Xlsx.codec.ts": 3,
  "packages/foundation/modeling/xlsx/src/internal/sheet.ts": 38,
  "packages/kernel/src/Identity.middleware.ts": 1,
  "packages/review/src/ReviewDraft.rules.ts": 77,
  "packages/review/src/ReviewRegion.atoms.ts": 24,
  "packages/review/src/ReviewRegion.component.tsx": 12,
  "packages/review/src/ReviewRegion.types.ts": 34,
  "packages/review/src/internal/PhoneDrawer.tsx": 8,
  "packages/review/src/internal/ReviewGrid.tsx": 68,
  "packages/review/src/internal/ReviewQueue.tsx": 24,
  "packages/review/src/internal/WorkList.tsx": 6,
  "packages/review/src/internal/parts.tsx": 45,
  "packages/review/src/internal/sizing.ts": 12,
  "packages/review/test/ReviewRegion.atoms.test.ts": 12,
  "packages/review/test/fixtures/fabrication.ts": 9,
  "packages/review/test/fixtures/jobs.ts": 18,
  "packages/tooling/tool/cli/src/commands/Laws/internal/refCallbacksCode.ts": 1,
  "packages/tooling/tool/cli/src/commands/Laws/internal/tagsCode.ts": 7,
  "packages/tooling/tool/cli/src/commands/Laws/internal/tryCode.ts": 1,
  "packages/tooling/tool/cli/test/InfraSetup.test.ts": 7,
  "packages/ui/src/AgentRun.component.tsx": 1,
  "packages/ui/src/Code.component.tsx": 1,
  "packages/ui/src/PageHeader.component.tsx": 2,
  "packages/ui/src/ProposalSource.words.ts": 7,
  "packages/ui/src/ProposedValue.component.tsx": 7,
  "packages/ui/src/Route.atoms.ts": 2,
  "packages/ui/src/Skeletons.component.tsx": 13,
  "packages/ui/src/StatusPill.component.tsx": 1,
  "packages/ui/src/TextWidth.measure.ts": 2,
  "packages/ui/src/Theme.provider.tsx": 2,
  "packages/ui/src/components/action-bar.tsx": 30,
  "packages/ui/src/components/alert-dialog.tsx": 1,
  "packages/ui/src/components/attachment.tsx": 2,
  "packages/ui/src/components/avatar.tsx": 1,
  "packages/ui/src/components/badge.tsx": 1,
  "packages/ui/src/components/breadcrumb.tsx": 1,
  "packages/ui/src/components/bubble.tsx": 4,
  "packages/ui/src/components/button-group.tsx": 1,
  "packages/ui/src/components/button.tsx": 1,
  "packages/ui/src/components/calendar.tsx": 1,
  "packages/ui/src/components/carousel.tsx": 10,
  "packages/ui/src/components/chart.tsx": 17,
  "packages/ui/src/components/combobox.tsx": 3,
  "packages/ui/src/components/command.tsx": 4,
  "packages/ui/src/components/context-menu.tsx": 4,
  "packages/ui/src/components/data-grid/data-grid-cell-preview.tsx": 16,
  "packages/ui/src/components/data-grid/data-grid-cell-variants.tsx": 20,
  "packages/ui/src/components/data-grid/data-grid-cell.tsx": 3,
  "packages/ui/src/components/data-grid/data-grid-column-header.tsx": 7,
  "packages/ui/src/components/data-grid/data-grid-context-menu.tsx": 3,
  "packages/ui/src/components/data-grid/data-grid-data-cell.tsx": 3,
  "packages/ui/src/components/data-grid/data-grid-features.ts": 167,
  "packages/ui/src/components/data-grid/data-grid-paste-dialog.tsx": 2,
  "packages/ui/src/components/data-grid/data-grid-row-models.ts": 16,
  "packages/ui/src/components/data-grid/data-grid-row.tsx": 30,
  "packages/ui/src/components/data-grid/data-grid-search.tsx": 5,
  "packages/ui/src/components/data-grid/data-grid-select-column.tsx": 18,
  "packages/ui/src/components/data-grid/data-grid-types.ts": 98,
  "packages/ui/src/components/data-grid/data-grid-utils.ts": 32,
  "packages/ui/src/components/data-grid/data-grid.tsx": 14,
  "packages/ui/src/components/data-grid/use-badge-overflow.ts": 17,
  "packages/ui/src/components/data-grid/use-data-grid.ts": 7,
  "packages/ui/src/components/data-table/data-table-cards.tsx": 6,
  "packages/ui/src/components/data-table/data-table-column-header.tsx": 7,
  "packages/ui/src/components/data-table/data-table-config.ts": 16,
  "packages/ui/src/components/data-table/data-table-date-filter.tsx": 5,
  "packages/ui/src/components/data-table/data-table-faceted-filter.tsx": 5,
  "packages/ui/src/components/data-table/data-table-features.ts": 12,
  "packages/ui/src/components/data-table/data-table-filter-menu.tsx": 27,
  "packages/ui/src/components/data-table/data-table-filters.ts": 16,
  "packages/ui/src/components/data-table/data-table-frame-skeleton.tsx": 5,
  "packages/ui/src/components/data-table/data-table-pagination.tsx": 7,
  "packages/ui/src/components/data-table/data-table-parsers.ts": 2,
  "packages/ui/src/components/data-table/data-table-range-filter.tsx": 4,
  "packages/ui/src/components/data-table/data-table-records.tsx": 13,
  "packages/ui/src/components/data-table/data-table-skeleton.tsx": 7,
  "packages/ui/src/components/data-table/data-table-slider-filter.tsx": 4,
  "packages/ui/src/components/data-table/data-table-sort-menu.tsx": 10,
  "packages/ui/src/components/data-table/data-table-state.ts": 10,
  "packages/ui/src/components/data-table/data-table-toolbar.tsx": 8,
  "packages/ui/src/components/data-table/data-table-types.ts": 36,
  "packages/ui/src/components/data-table/data-table-view-options.tsx": 2,
  "packages/ui/src/components/data-table/data-table.tsx": 19,
  "packages/ui/src/components/data-table/id.ts": 2,
  "packages/ui/src/components/dialog.tsx": 2,
  "packages/ui/src/components/direction.tsx": 1,
  "packages/ui/src/components/dropdown-menu.tsx": 4,
  "packages/ui/src/components/faceted.tsx": 15,
  "packages/ui/src/components/field.tsx": 3,
  "packages/ui/src/components/file-upload.tsx": 68,
  "packages/ui/src/components/form.tsx": 2,
  "packages/ui/src/components/input-otp.tsx": 2,
  "packages/ui/src/components/item.tsx": 1,
  "packages/ui/src/components/marker.tsx": 1,
  "packages/ui/src/components/menubar.tsx": 4,
  "packages/ui/src/components/message.tsx": 1,
  "packages/ui/src/components/native-select.tsx": 1,
  "packages/ui/src/components/navigation-menu.tsx": 1,
  "packages/ui/src/components/pagination.tsx": 1,
  "packages/ui/src/components/resizable.tsx": 1,
  "packages/ui/src/components/select.tsx": 1,
  "packages/ui/src/components/sheet.tsx": 2,
  "packages/ui/src/components/sidebar.tsx": 24,
  "packages/ui/src/components/sortable.tsx": 32,
  "packages/ui/src/components/stepper.tsx": 60,
  "packages/ui/src/components/sticky-table.tsx": 14,
  "packages/ui/src/components/switch.tsx": 1,
  "packages/ui/src/components/toggle-group.tsx": 2,
  "packages/ui/src/components/tour.tsx": 103,
  "packages/ui/src/hooks/use-data-table.ts": 9,
  "vitest.retries.ts": 2
}

/** What the dual-helper law is. */
export const dualSpec: ListedSpec = {
  check: "dual:check",
  rule: "every helper declared with two values or more that names the one it acts on takes it first and is dual",
  instead:
    "a helper that names the value it acts on (cause, error, self, input) and is not dual: put that value first and write the helper with dual from effect/Function, data-last form included",
  listName: "dualListed",
  listed: dualListed,
  held: -509163326,
  leftOut: shapesLeftOut,
  offsets: helpersNotDual
}

/** What the readonly law is. */
export const readonlySpec: ListedSpec = {
  check: "readonly:check",
  rule: "every property, index signature, class field and mapped property is readonly, with readonly arrays",
  instead:
    "a property that is not readonly, or a mutable array in one: write readonly (ReadonlyArray for an array), and keep a value that must change in a Ref or a MutableRef",
  listName: "readonlyListed",
  listed: readonlyListed,
  held: -956257989,
  leftOut: shapesLeftOut,
  offsets: mutableProperties
}

/**
 * `laws dual`: what `dualSpec` asks, over every code file git would commit.
 *
 * @category rules
 */
export const dualHelpers = listedLaw(dualSpec)

/**
 * `laws readonly`: what `readonlySpec` asks, over every code file git would commit.
 *
 * @category rules
 */
export const readonlyProperties = listedLaw(readonlySpec)

/** The lines `laws dual` prints. */
export const dualSentence = listedSentence(dualSpec)

/** The lines `laws readonly` prints. */
export const readonlySentence = listedSentence(readonlySpec)
