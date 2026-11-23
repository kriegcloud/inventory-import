/**
 * Two of Benjamin's rules on how code is shaped, each held by a law with a list of today's files that may only shrink
 * (`internal/listed.ts`).
 *
 * - Helpers take the value they act on first and are `dual` (2026-11-22: "If we are going to make helpers. We make
 *   them dual & pipe friendly with properly ordered parameters. i.e `cause` should be first parameter"). The law
 *   reads the clear case: a helper declared with a name (`const f = (…) =>`, `function f(…)`), of two values or more,
 *   whose last is named `cause`, `error`, `self` or `input`. A function handed to a call as an argument is not read:
 *   the call sets its order.
 * - Properties are `readonly` (2026-11-22: "All object types & interfaces should have readonly properties in the bast
 *   majority of cases"), React props among them. The law refuses a property signature of an object type or an
 *   interface without `readonly`. The one kind of exception is another library's types, augmented in
 *   `declare global` or `declare module "…"`, whose shape is not ours.
 *
 * Not read by either, each by name: vendored code (shadcn's and the registries' components and hooks under
 * `packages/ui/src/components/` and `packages/ui/src/hooks/`, beep-effect's kit under `packages/foundation/`,
 * the Alchemy packages under `vendor/`), the agent skills (`.agents/`, `.codex/`), and the scratchpad, where the laws
 * apply when an experiment graduates.
 *
 * @packageDocumentation
 */
import { scratchpadFolder } from "../../Repo.schema.ts"
import { type ListedSpec, listedLaw, listedSentence } from "./internal/listed.ts"
import { helpersSubjectLast, mutableProperties } from "./internal/shapesCode.ts"

/** What neither law reads, from the root. */
export const shapesLeftOut: ReadonlyArray<string> = [
  ".agents/",
  ".codex/",
  `${scratchpadFolder}/`,
  "vendor/",
  "packages/ui/src/components/",
  "packages/ui/src/hooks/",
  "packages/foundation/modeling/identity/",
  "packages/foundation/modeling/schema/",
  "packages/foundation/modeling/utils/",
  "packages/foundation/primitive/"
]

/** The files with a helper that takes the value it acts on last, today: this list may only shrink. */
export const dualListed: ReadonlyArray<string> = [
  "packages/catalog/model/test/Review.story.test.ts",
  "packages/catalog/web/src/internal/spreadsheet/xlsx.ts",
  "packages/foundation/modeling/csv/src/Csv.codec.ts",
  "packages/review/src/internal/keptStore.ts"
]

/** The files with a property that is not readonly, today: this list may only shrink. */
export const readonlyListed: ReadonlyArray<string> = [
  "apps/inventory/src/web/Workspace.tsx",
  "apps/inventory/src/web/components/app/AppShell.tsx",
  "apps/inventory/src/web/components/app/AppSidebar.tsx",
  "apps/inventory/src/web/components/app/BrandMark.tsx",
  "apps/inventory/src/web/components/app/SignedIn.tsx",
  "apps/inventory/src/web/pages/ReviewGallery.tsx",
  "apps/inventory/src/web/pages/gallery/JobsReview.tsx",
  "apps/inventory/test/server/People.slow.test.ts",
  "apps/inventory/test/server/RequestTelemetry.test.ts",
  "apps/inventory/test/server/Tenancy.slow.test.ts",
  "apps/inventory/test/server/WaitedRows.slow.test.ts",
  "apps/inventory/test/web/session.test.ts",
  "apps/inventory/test/web/support/page.ts",
  "packages/access/host/src/internal/authOptions.ts",
  "packages/access/web/src/AuditEvents.screen.tsx",
  "packages/access/web/src/People.screen.tsx",
  "packages/access/web/src/SignIn.screen.tsx",
  "packages/access/web/src/internal/authClient.ts",
  "packages/catalog/model/src/Actor/Actor.context.ts",
  "packages/catalog/model/src/Item/ItemEdit.rules.ts",
  "packages/catalog/model/src/Item/ItemSearch.rules.ts",
  "packages/catalog/model/src/Review/CellReading.rules.ts",
  "packages/catalog/web/src/Draft.atoms.ts",
  "packages/catalog/web/src/Draft.machine.ts",
  "packages/catalog/web/src/ImportPage.screen.tsx",
  "packages/catalog/web/src/Imports.atoms.ts",
  "packages/catalog/web/src/ItemEditor.screen.tsx",
  "packages/catalog/web/src/MatchStep.screen.tsx",
  "packages/catalog/web/src/Notices.atoms.ts",
  "packages/catalog/web/src/PastImports.screen.tsx",
  "packages/catalog/web/src/ResultStep.screen.tsx",
  "packages/catalog/web/src/ReviewStep.screen.tsx",
  "packages/catalog/web/src/TableAssistant.screen.tsx",
  "packages/catalog/web/src/Upload.controller.ts",
  "packages/catalog/web/src/Upload.machine.ts",
  "packages/catalog/web/src/UploadStep.screen.tsx",
  "packages/catalog/web/src/internal/CellForms.tsx",
  "packages/catalog/web/src/internal/SheetButton.tsx",
  "packages/catalog/web/src/internal/SheetChooser.tsx",
  "packages/catalog/web/src/internal/WhyFlagged.tsx",
  "packages/catalog/web/src/internal/cellDrafts.ts",
  "packages/catalog/web/src/internal/format.tsx",
  "packages/catalog/web/src/internal/protocol.ts",
  "packages/catalog/web/src/internal/reader.worker.ts",
  "packages/catalog/web/src/internal/spreadsheet/csv.ts",
  "packages/catalog/web/src/internal/spreadsheet/read.ts",
  "packages/catalog/web/src/internal/spreadsheet/xlsx.ts",
  "packages/catalog/web/test/Draft.machine.test.ts",
  "packages/catalog/web/test/DraftRegion.test.ts",
  "packages/catalog/web/test/ImportPage.test.ts",
  "packages/catalog/web/test/ItemEditor.test.ts",
  "packages/catalog/web/test/KeptRows.test.ts",
  "packages/catalog/web/test/ReviewHistory.test.ts",
  "packages/catalog/web/test/ReviewModelFold.fold.test.ts",
  "packages/catalog/web/test/SessionAsked.test.ts",
  "packages/catalog/web/test/TabRows.test.ts",
  "packages/catalog/web/test/UploadOwner.test.ts",
  "packages/catalog/web/test/reviewParity.test.ts",
  "packages/catalog/web/test/support/draftWorld.ts",
  "packages/catalog/web/test/support/session.ts",
  "packages/client/test/Connection.atoms.test.ts",
  "packages/drivers/d1/src/D1.test-layer.ts",
  "packages/foundation/modeling/xlsx/src/Xlsx.codec.ts",
  "packages/kernel/src/Identity.middleware.ts",
  "packages/review/src/ReviewDraft.rules.ts",
  "packages/review/src/ReviewRegion.atoms.ts",
  "packages/review/src/ReviewRegion.component.tsx",
  "packages/review/src/ReviewRegion.types.ts",
  "packages/review/src/internal/PhoneDrawer.tsx",
  "packages/review/src/internal/ReviewGrid.tsx",
  "packages/review/src/internal/ReviewQueue.tsx",
  "packages/review/src/internal/WorkList.tsx",
  "packages/review/src/internal/parts.tsx",
  "packages/review/src/internal/sizing.ts",
  "packages/review/test/ReviewRegion.atoms.test.ts",
  "packages/review/test/fixtures/fabrication.ts",
  "packages/review/test/fixtures/jobs.ts",
  "packages/tooling/tool/cli/src/commands/Laws/internal/refCallbacksCode.ts",
  "packages/tooling/tool/cli/src/commands/Laws/internal/tagsCode.ts",
  "packages/tooling/tool/cli/src/commands/Laws/internal/tryCode.ts",
  "packages/tooling/tool/cli/test/InfraSetup.test.ts",
  "packages/ui/src/AgentRun.component.tsx",
  "packages/ui/src/Code.component.tsx",
  "packages/ui/src/PageHeader.component.tsx",
  "packages/ui/src/ProposalSource.words.ts",
  "packages/ui/src/ProposedValue.component.tsx",
  "packages/ui/src/Route.atoms.ts",
  "packages/ui/src/Skeletons.component.tsx",
  "packages/ui/src/StatusPill.component.tsx",
  "packages/ui/src/TextWidth.measure.ts",
  "packages/ui/src/Theme.provider.tsx"
]

/** What the dual-helper law is. */
export const dualSpec: ListedSpec = {
  check: "dual:check",
  rule: "every helper declared with two values or more takes the one it acts on first and is dual",
  instead:
    "a helper that takes the value it acts on (cause, error, self, input) last: put it first and write the helper with dual from effect/Function, data-last form included",
  listName: "dualListed",
  listed: dualListed,
  held: 343339886,
  leftOut: shapesLeftOut,
  offsets: helpersSubjectLast
}

/** What the readonly law is. */
export const readonlySpec: ListedSpec = {
  check: "readonly:check",
  rule: "every property of an object type or an interface is readonly",
  instead:
    "a property that is not readonly: write readonly before it, and keep a value that must change in a Ref or a MutableRef",
  listName: "readonlyListed",
  listed: readonlyListed,
  held: 386281421,
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
