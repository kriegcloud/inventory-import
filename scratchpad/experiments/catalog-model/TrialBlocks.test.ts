// The trial blocks of the module-taxonomy exploration (decision 9c) in their decided homes, listed in `CatalogTrial`:
// that the model built from them is well defined, and a story for each read and reaction kind, all in memory.
import * as Domain from "@alchemy.run/domain"
import { Story } from "@alchemy.run/domain/Story"
import { it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { Actor, CurrentActor } from "./model/Actor/Actor.context.ts"
import { DraftStoreMemory } from "./model/Draft/DraftStore.memory.ts"
import { ImportActs, RowActed } from "./model/Draft/ImportActs.stream.ts"
import { ImportReview } from "./model/Draft/ImportReview.query.ts"
import * as StageImport from "./model/Import/commands/StageImport.command.ts"
import * as RecordSuggestion from "./model/Import/commands/RecordSuggestion.command.ts"
import * as ImportStaged from "./model/Import/events/ImportStaged.event.ts"
import * as SuggestionRecorded from "./model/Import/events/SuggestionRecorded.event.ts"
import { ForgetMember } from "./model/Import/ForgetMember.rewrite.ts"
import { Import } from "./model/Import/Import.aggregate.ts"
import { NotPermitted } from "./model/Import/Import.rejection.ts"
import { ImportStatus } from "./model/Import/ImportStatus.view.ts"
import { ImportKey } from "./model/Review/Change.schema.ts"
import { Row } from "./model/Row/Row.aggregate.ts"
import * as RowDecided from "./model/Row/RowDecided.event.ts"
import { Suggester } from "./model/Suggestion/Suggester.external.ts"
import { SuggestionPass } from "./model/Suggestion/SuggestionPass.saga.ts"
import { CatalogTrial, CatalogTrialHandlers } from "./model/Trial.model.ts"

const handlers = CatalogTrialHandlers.pipe(Layer.provide(DraftStoreMemory))

const story = Story.make(CatalogTrial, { layer: handlers, stub: [Suggester] })

const id = ImportKey.make("imp-1")
const ana = Actor.make({ organizationId: "org_prairie", memberId: "ana", role: "editor" })
const omar = Actor.make({ organizationId: "org_harbor", memberId: "omar", role: "editor" })
const staged = ImportStaged.Event.make({ organizationId: "org_prairie", rows: 3, columns: "sku=A", by: "ana" })

const AnySuggestion = Suggester.toLayer(Effect.succeed({ suggest: () => Effect.succeed({ patch: "" }) }))

it.effect("the model with the trial blocks is well defined", () =>
  Layer.build(
    CatalogTrial.layer(handlers.pipe(Layer.provide(AnySuggestion))).pipe(Layer.provide(Domain.InMemory))
  ).pipe(Effect.scoped)
)

it.effect("an import that is staged reads as open with no change in its status view", () =>
  story(
    Story.provide(CurrentActor, ana),
    Story.when(StageImport.Command.make({ importId: id, rows: 3, columns: "sku=A" })),
    Story.then(Import.ref(id), staged),
    Story.view(ImportStatus, Import.ref(id), { status: "Open", changes: 0 })
  )
)

it.effect("a suggestion asked for on an open import starts a pass that asks the suggester for a patch", () =>
  story(
    Story.given(Import.ref(id), staged),
    Story.provide(CurrentActor, ana),
    Story.when(RecordSuggestion.Command.make({ importId: id })),
    Story.then(Import.ref(id), SuggestionRecorded.Event.make({ by: "ana" })),
    Story.call(Suggester.suggest, { importId: id }),
    Story.succeed(Suggester.suggest, { patch: "keep=all" }),
    Story.saga(SuggestionPass, id, { _tag: "Completed", result: undefined })
  )
)

it.effect("a decided row is read back by its organization, appended to the import's acts, and refused to another", () =>
  story(
    Story.given(
      Row.ref(`${id}/r-1`),
      RowDecided.Event.make({
        importId: id,
        organizationId: "org_prairie",
        change: 1,
        by: "ana",
        step: "s-1",
        flags: "{}",
        madeOn: 0,
        label: "Keep"
      })
    ),
    Story.streamed(ImportActs, id, RowActed.make({ row: `${id}/r-1`, change: 1, label: "Keep", by: "ana" })),
    Story.provide(CurrentActor, ana),
    Story.query(ImportReview, { importId: id }, [{ row: `${id}/r-1`, change: 1, label: "Keep", by: "ana" }]),
    Story.provide(CurrentActor, omar),
    Story.query(ImportReview, { importId: id }),
    Story.rejected(NotPermitted.make({}))
  )
)

it.effect("forgetting a member blanks who asked for a suggestion, and the status view folds the rewritten event", () =>
  story(
    Story.given(Import.ref(id), staged, SuggestionRecorded.Event.make({ by: "ana" })),
    Story.view(ImportStatus, Import.ref(id), { status: "Open", askedBy: "ana" }),
    Story.rewrite(Import.ref(id), ForgetMember.make({ memberId: "ana" })),
    Story.view(ImportStatus, Import.ref(id), { status: "Open", askedBy: "" }),
    Story.state(Import.ref(id), { suggestions: 1 })
  )
)
