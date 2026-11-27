// The library's tutorial (https://alchemy.run/domain/tutorial/part-1), followed part by part on this app's nouns, so
// whoever learns the library from it finds each part here (the brief's row "The tutorial"). Part 1, model an
// aggregate, is the import: a story stages a file on it and states the event. Part 2 reads it with a view and part 3
// reacts to it with a policy; the review's model has neither yet (the first view comes with move 2 or 3, the first
// policy with move 5). Their tests are written as expected to fail while the model has none, so `bun run check` stays
// green and the day the first view or policy is declared they fail: that is the day each becomes a real story of that
// part, in this file. The one thing not to break: a part's test is never deleted to make the check pass.
import { Story } from "@alchemy.run/domain/Story"
import { expect, it } from "@effect/vitest"
import { ImportId } from "@inventory/catalog-contract/Ids"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import { type Actor, CurrentActor } from "../src/Actor/Actor.context.ts"
import { Catalog } from "../src/Catalog.model.ts"
import * as StageImport from "../src/Import/commands/StageImport.command.ts"
import * as ImportStaged from "../src/Import/events/ImportStaged.event.ts"
import { Import } from "../src/Import/Import.aggregate.ts"

const id = ImportId.make("0190a5c2-7b1e-4c3a-9f10-4d2e8b6a1c57")
const ana: Actor = { organizationId: "org_prairie", memberId: "ana", role: "editor" }

it.effect("Tutorial part 1: an aggregate with a story: an editor stages a file, and the import records it", () =>
  Effect.gen(function* () {
    expect(A.isReadonlyArrayNonEmpty(Catalog.aggregates)).toBe(true)
    yield* Story.make(Catalog)(
      Story.provide(CurrentActor, ana),
      Story.when(StageImport.Command.make({ importId: id, rows: 25, columns: "by heading" })),
      Story.then(
        Import.ref(id),
        ImportStaged.Event.make({ organizationId: "org_prairie", rows: 25, columns: "by heading", by: "ana" })
      )
    )
  })
)

// Expected to fail while the model declares no view; it fails the day one is declared, and becomes part 2's story.
it.effect.fails("Tutorial part 2: a view reads the import (none declared yet)", () =>
  Effect.sync(() => expect(A.isReadonlyArrayNonEmpty(Catalog.definitions.views)).toBe(true))
)

// Expected to fail while the model declares no policy; it fails the day one is declared, and becomes part 3's story.
it.effect.fails("Tutorial part 3: a policy reacts to the import (none declared yet)", () =>
  Effect.sync(() => expect(A.isReadonlyArrayNonEmpty(Catalog.definitions.policies)).toBe(true))
)
