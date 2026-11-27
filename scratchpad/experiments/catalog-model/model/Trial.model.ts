// The catalog's aggregates and decisions again, with one trial block of each read and reaction kind and a rewrite. A
// trial of the module-taxonomy exploration (decision 9c), never copied into a package: the rules stay `Catalog`'s.
import * as Domain from "@alchemy.run/domain"
import * as Layer from "effect/Layer"
import { DraftRows, DraftRowsLive } from "./Draft/DraftRows.projection.ts"
import { ImportActs, ImportActsLive } from "./Draft/ImportActs.stream.ts"
import { ImportReview, ImportReviewLive } from "./Draft/ImportReview.query.ts"
import { RowHolds } from "./Draft/RowHolds.view.ts"
import { Group } from "./Group/Group.aggregate.ts"
import { ForgetMember } from "./Import/ForgetMember.rewrite.ts"
import { Import } from "./Import/Import.aggregate.ts"
import { ImportStatus, ImportStatusLive } from "./Import/ImportStatus.view.ts"
import { Deciding } from "./Review/Deciding.decision.ts"
import { DecidingGroup } from "./Review/DecidingGroup.decision.ts"
import { Undoing } from "./Review/Undoing.decision.ts"
import { UndoingGroup } from "./Review/UndoingGroup.decision.ts"
import { Row } from "./Row/Row.aggregate.ts"
import { SuggestionPass, SuggestionPassLive } from "./Suggestion/SuggestionPass.saga.ts"
import { SuggestOnAsk, SuggestOnAskLive } from "./Suggestion/SuggestOnAsk.policy.ts"

/**
 * **Details**
 *
 * The same aggregates and decisions as `Catalog`, with none of its invariants or relations: the trial blocks are what
 * it adds.
 *
 * @category models
 * @since 0.0.0
 */
export class CatalogTrial extends Domain.Model(
  "CatalogTrial",
  {
    aggregates: [Import, Row, Group],
    decisions: [Deciding, Undoing, DecidingGroup, UndoingGroup],
    views: [ImportStatus, RowHolds],
    policies: [SuggestOnAsk],
    projections: [DraftRows],
    streams: [ImportActs],
    sagas: [SuggestionPass],
    queries: [ImportReview],
    rewrites: [ForgetMember]
  },
  { description: "The catalog's model with one trial block of each read and reaction kind" }
) {}

/**
 * Every Live of the trial blocks, as one Layer: the two guarded reads' `validate`s, the projection, the query, the saga
 * and the policy. It still needs a `DraftStore` and the `Suggester`.
 *
 * @category layers
 * @since 0.0.0
 */
export const CatalogTrialHandlers = Layer.mergeAll(
  ImportStatusLive,
  ImportActsLive,
  DraftRowsLive,
  ImportReviewLive,
  SuggestionPassLive,
  SuggestOnAskLive
)
