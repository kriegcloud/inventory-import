// An import as the screens read it: its view, its result row by row, its history of confirms and take-backs, what
// a take-back would do, the open and the past imports, and the changed values the activity view lists. Every number
// here is read back from what is stored.
import * as O from "effect/Option"
import * as Tuple from "effect/Tuple"
import * as S from "effect/Schema"
import { LiteralKit } from "@beep/schema/LiteralKit"
import { AnsweredBy } from "../Answer/AnsweredBy.read.ts"
import { Change } from "./Change.read.ts"
import { SavedDecisions } from "./Decision.command.ts"
import { personName } from "../internal/Described.ts"
import { ConfirmId, ImportId, RowId } from "../Catalog.id.ts"
import { ItemFields } from "../Item/Item.read.ts"
import { ColumnMatch, MappingChoice, UnusedColumn } from "./Mapping.read.ts"
import { Suggestion } from "../Suggestion/Suggestion.read.ts"
import { DisplayName, Instant } from "@inventory/kernel/Text"
import { absentAsNone, nullAsNone } from "@inventory/kernel/Wire"

/** Who settled a row that was not imported: a person left it out, or nobody had settled it yet. */
export const DecidedByKind = LiteralKit(["person", "nobody"]).annotate({
  identifier: "DecidedByKind",
  description: "A person left the row out, or nobody had settled it yet"
})

class DecidedByPerson extends S.Opaque<DecidedByPerson, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("person"),
    name: DisplayName.pipe(
      S.annotateKey({
        description: "Who left the row out: the member's name as it was then, for the screen. Not an id"
      })
    )
  }).annotate({ identifier: "DecidedByPerson", description: "A person left the row out" })
) {}

class DecidedByNobody extends S.Opaque<DecidedByNobody, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("nobody") }).annotate({
    identifier: "DecidedByNobody",
    description: "Nobody had settled the row when the import was confirmed"
  })
) {}

/** For a row that was not imported: the person who left it out, or that nobody had settled it yet. */
export const DecidedBy = DecidedByKind.mapMembers(() => Tuple.make(DecidedByPerson, DecidedByNobody)).pipe(
  S.toTaggedUnion("kind"),
  S.annotate({ identifier: "DecidedBy", description: "Who left a row out, or that nobody had settled it" })
)
/** The decoded value of `DecidedBy`. */
export type DecidedBy = typeof DecidedBy.Type

/** `name` left the row out. */
export const decidedByPerson = (name: DisplayName): DecidedBy => DecidedByPerson.make({ name })
/** Nobody had settled the row. */
export const decidedByNobody: DecidedBy = DecidedByNobody.make({})

/** The five things a confirm can have done with a row. */
export const OutcomeKind = LiteralKit(["created", "updated", "already", "notImported", "takenBack"]).annotate({
  identifier: "OutcomeKind",
  description:
    "Created an item, replaced a stored item as the person chose, found the SKU already there, not imported, or taken back: the item it created was removed, or the stored item it replaced was put back as it was"
})
/** The decoded value of `OutcomeKind`. */
export type OutcomeKind = typeof OutcomeKind.Type

// What every outcome says of its row: where it is in the file and what it is called.
const outcomeRow = {
  rowNumber: S.Int.pipe(S.annotateKey({ description: "The row as Excel numbers it", examples: [7] })),
  part: S.Int.pipe(
    absentAsNone({
      description:
        "Which of its row's items this is (1, 2, ...), when the row holds several; left out for a row that is one item"
    })
  ),
  sku: S.String.pipe(S.annotateKey({ description: "The item's SKU as the row gives it", examples: ["RJS-3545"] })),
  name: S.String.pipe(
    S.annotateKey({ description: "The row's name, as the result lists it", examples: ["Nylon Coil"] })
  )
}
// Text as stored: a reason written before a rule on its form existed must still read, so only its length is held.
const outcomeReason = S.String.check(S.isMaxLength(4000)).pipe(
  S.annotateKey({
    description: "Why the row was not imported or was already there, one sentence per problem",
    examples: ["Name is empty."]
  })
)

class RowCreated extends S.Opaque<RowCreated, { readonly brand: unique symbol }>()(
  S.Struct({ outcome: S.tag("created"), ...outcomeRow }).annotate({
    identifier: "RowCreated",
    description: "The row created an item, which the organization still has"
  })
) {}

class RowUpdated extends S.Opaque<RowUpdated, { readonly brand: unique symbol }>()(
  S.Struct({ outcome: S.tag("updated"), ...outcomeRow }).annotate({
    identifier: "RowUpdated",
    description: "The row replaced a stored item with the same SKU, as the person chose"
  })
) {}

class RowAlready extends S.Opaque<RowAlready, { readonly brand: unique symbol }>()(
  S.Struct({ outcome: S.tag("already"), ...outcomeRow, reason: outcomeReason }).annotate({
    identifier: "RowAlready",
    description: "The row's SKU was already there: nothing was written for it"
  })
) {}

class RowNotImported extends S.Opaque<RowNotImported, { readonly brand: unique symbol }>()(
  S.Struct({ outcome: S.tag("notImported"), ...outcomeRow, reason: outcomeReason, decidedBy: DecidedBy }).annotate({
    identifier: "RowNotImported",
    description: "The row was not imported: a person left it out, or nobody had settled it"
  })
) {}

class RowTakenBack extends S.Opaque<RowTakenBack, { readonly brand: unique symbol }>()(
  S.Struct({ outcome: S.tag("takenBack"), ...outcomeRow }).annotate({
    identifier: "RowTakenBack",
    description: "A take-back removed the item the row created, or put back as it was the stored item the row replaced"
  })
) {}

/**
 * What the confirms did with one row of the file, by `outcome`. Only a row that was already there or not imported
 * has a reason, and only one that was not imported says who decided. Branch with `RowOutcome.match`.
 */
export const RowOutcome = OutcomeKind.mapMembers(() =>
  Tuple.make(RowCreated, RowUpdated, RowAlready, RowNotImported, RowTakenBack)
).pipe(
  S.toTaggedUnion("outcome"),
  S.annotate({ identifier: "RowOutcome", description: "What the confirms did with one row of the file" })
)
/** The decoded value of `RowOutcome`: what the confirms did with one row of the file. */
export type RowOutcome = typeof RowOutcome.Type

/** The row's reason, for the two outcomes that have one. */
export const outcomeReasonOf = (row: RowOutcome): O.Option<string> =>
  row.outcome === "already" || row.outcome === "notImported" ? O.some(row.reason) : O.none()

/**
 * The outcome a stored row says, from the columns `importOutcome` keeps: every outcome has every column there, so
 * the reason and who decided are read only for the outcomes that have them.
 */
export const outcomeOf = (stored: {
  readonly rowNumber: number
  readonly part: O.Option<number>
  readonly sku: string
  readonly name: string
  readonly outcome: OutcomeKind
  readonly reason: string
  readonly decidedBy: DecidedBy
}): RowOutcome => {
  const row = { rowNumber: stored.rowNumber, part: stored.part, sku: stored.sku, name: stored.name }
  return OutcomeKind.match(stored.outcome, {
    created: (): RowOutcome => RowCreated.make(row),
    updated: (): RowOutcome => RowUpdated.make(row),
    takenBack: (): RowOutcome => RowTakenBack.make(row),
    already: (): RowOutcome => RowAlready.make({ ...row, reason: stored.reason }),
    notImported: (): RowOutcome => RowNotImported.make({ ...row, reason: stored.reason, decidedBy: stored.decidedBy })
  })
}

/** What a confirmed import did, row by row, counted from the stored rows. Kept with the import, so it survives a reload. */
export const ImportResult = S.Struct({
  importedBy: personName("Who confirmed the import"),
  importedAt: Instant.pipe(S.annotateKey({ description: "When it was confirmed" })),
  created: S.Int.annotateKey({ description: "Rows whose item this import created and still has", examples: [11] }),
  updated: S.Int.annotateKey({
    description: "Rows that replaced a stored item with the same SKU, because the person chose to",
    examples: [1]
  }),
  already: S.Int.annotateKey({
    description: "Rows whose SKU the organization already had: nothing was written for them",
    examples: [154]
  }),
  notImported: S.Int.annotateKey({
    description: "Rows left out, by a person or because nobody had settled them",
    examples: [45]
  }),
  takenBack: S.Int.annotateKey({
    description:
      "Rows whose item this import created and a take-back removed, or whose replace of a stored item a take-back undid",
    examples: [0]
  }),
  fixed: S.Struct({
    rows: S.Int.annotateKey({ description: "Rows written with at least one value a form-only rule changed" }),
    cells: S.Int.annotateKey({ description: "Values a form-only rule changed, in all" })
  }).annotateKey({
    description:
      'What the form-only rules changed without the person, counted from the changed values the confirms stored (`how` "applied by a rule")'
  }),
  rows: S.Array(RowOutcome).annotateKey({
    description: "Every row of the file with what happened to it; the five counts add up to these"
  })
}).annotate({ identifier: "ImportResult", description: "What the confirms of an import did with each row of its file" })
/** The decoded value of `ImportResult`: what a confirmed import did, row by row, counted from the stored rows. */
export type ImportResult = typeof ImportResult.Type

/**
 * One thing that happened to a confirmed import, for its history: a confirm, with what it did, or the take-back of
 * one, with how many of its items it removed, how many items it had replaced it put back as they were, and how many
 * it kept because they had changed since. Every number is
 * read from what the confirm and the take-back stored.
 */
export const ImportEvent = S.TaggedUnion({
  Confirmed: {
    batchId: ConfirmId.annotateKey({ description: "The confirm's id: what a take-back names in `confirms`" }),
    by: personName("Who confirmed"),
    at: Instant.pipe(S.annotateKey({ description: "When" })),
    created: S.Int.annotateKey({ description: "Items this confirm created" }),
    updated: S.Int.annotateKey({ description: "Stored items this confirm replaced, as the person chose" }),
    already: S.Int.annotateKey({ description: "Rows it found already there" }),
    notImported: S.Int.annotateKey({ description: "Rows it left out" })
  },
  TakenBack: {
    batchId: ConfirmId.annotateKey({
      description: "The first confirm the take-back reversed; one take-back of several confirms is one event"
    }),
    by: personName("Who took it back"),
    at: Instant.pipe(S.annotateKey({ description: "When" })),
    removed: S.Int.annotateKey({
      description: "Every item the take-back removed, across all the confirms it reversed"
    }),
    restored: S.Int.annotateKey({
      description:
        "Every stored item those confirms had replaced that the take-back put back to its values from before the replace"
    }),
    kept: S.Int.annotateKey({
      description:
        "Every item it kept because someone had changed it since (one it created, or one it replaced), across all the confirms it reversed"
    })
  }
}).annotate({ identifier: "ImportEvent", description: "A confirm of an import, or the take-back of one" })
/** The decoded value of `ImportEvent`: one thing that happened to a confirmed import, for its history. */
export type ImportEvent = typeof ImportEvent.Type

/** An item an import created that someone changed afterwards: what it is, who changed it last and when. */
export const ChangedItem = S.Struct({
  sku: S.String.annotateKey({ description: "The item's SKU" }),
  name: S.String.annotateKey({ description: "The item's name, for the list" }),
  changedBy: S.String.pipe(
    nullAsNone({
      description:
        "Who changed it last: the member's name as it was then, for the screen. Not an id; null when that was not stored"
    })
  ),
  changedAt: Instant.pipe(nullAsNone({ description: "When it was last changed; null when that was not stored" }))
}).annotate({ identifier: "ChangedItem", description: "An item changed after the import that created it" })
/** The decoded value of `ChangedItem`: an item an import created that someone changed afterwards. */
export type ChangedItem = typeof ChangedItem.Type

/** How many changed items a view lists by name; the rest are counted. */
export const changedItemsShown = 20

/**
 * Whether the import can be taken back, and what that would do, worked out from what is stored. A take-back removes
 * the items of the confirms still in force that nobody has changed since (`removable`) and puts back the stored items
 * they replaced that nobody has changed since (`restorable`); an item someone changed is kept, and named. When every
 * such item has changed, nothing can be taken back, and the screen says so.
 */
export const TakeBackState = S.Struct({
  confirms: S.Array(ConfirmId).annotateKey({
    description: "The confirms still in force: what a take-back of the import would reverse"
  }),
  removable: S.Int.annotateKey({ description: "Items of those confirms still as the import created them" }),
  restorable: S.Int.annotateKey({
    description:
      "Stored items those confirms replaced that are still as the replace left them: a take-back puts back their values from before"
  }),
  changed: S.Array(ChangedItem).annotateKey({
    description: `Items those confirms created or replaced that someone changed since, at most ${changedItemsShown}: a take-back keeps them`
  }),
  changedCount: S.Int.annotateKey({ description: "How many items of those confirms changed since, in all" }),
  kept: S.Array(ChangedItem).annotateKey({
    description: `Items an earlier take-back of this import kept because they had changed, at most ${changedItemsShown}`
  }),
  keptCount: S.Int.annotateKey({ description: "How many items earlier take-backs kept, in all" })
}).annotate({ identifier: "TakeBackState", description: "What taking the import back would do now" })
/** The decoded value of `TakeBackState`: whether the import can be taken back, and what that would do. */
export type TakeBackState = typeof TakeBackState.Type

/**
 * One file on its way in, without its rows (those are fetched once from `table`, since they never change). While
 * `status` is `open` nothing has been stored as an item.
 */
export class ImportView extends S.Class<ImportView, { readonly brand: unique symbol }>("ImportView")(
  {
    id: ImportId.annotateKey({ description: "The import's id: the id its upload was given" }),
    fileName: S.String.annotateKey({
      description: "The file's name as it was chosen",
      examples: ["items_messy.csv"]
    }),
    status: S.Literals(["open", "imported", "takenBack"]).annotateKey({
      description: "Under review, confirmed, or confirmed and then taken back"
    }),
    startedBy: personName("Who uploaded the file"),
    createdAt: Instant.pipe(S.annotateKey({ description: "When the upload finished and the import began" })),
    rowCount: S.Int.annotateKey({ description: "Data rows the file was uploaded with", examples: [200] }),
    storedItems: S.Array(ItemFields).annotateKey({
      description:
        "The organization's items that share a SKU with a row of this file: the review skips a row that says the same, and asks about one that says something else"
    }),
    mapping: S.Array(ColumnMatch).annotateKey({ description: "Which file column fills each field, and how" }),
    choices: S.Array(MappingChoice).annotateKey({ description: "The matches people made, as the review takes them" }),
    unusedColumns: S.Array(UnusedColumn).annotateKey({
      description: "File columns no field reads, each with how many rows hold a value in it. They are never stored"
    }),
    createdRows: S.Array(S.Int).annotateKey({
      description: "Rows an earlier confirm of this import turned into items: already there when it is opened again"
    }),
    createdIds: S.Array(RowId).annotateKey({
      description:
        "The items an earlier confirm of this import created, by row id (`row-7`, or `row-8.2` for the second item of row 8): what the review counts as already there",
      examples: [[RowId.make("row-7"), RowId.make("row-8.2")]]
    }),
    decisions: SavedDecisions.annotateKey({ description: "The saved draft: what has been decided about each row" }),
    suggestions: S.Array(Suggestion).annotateKey({
      description:
        "The stored suggestions for this import (`suggest` makes them): pass them to the review as `suggestions`, as the server does at the confirm, so each shows as a proposal on its row. A column suggestion is offered for the person to match",
      default: []
    }),
    revision: S.Int.annotateKey({ description: "Goes up with every saved decision, from any screen", examples: [3] }),
    progress: S.Struct({
      needsAtStart: S.Int.annotateKey({ description: "Rows that needed the person when the file was staged" }),
      needs: S.Int.annotateKey({ description: "Rows that still need the person: decision and cannot together" }),
      decision: S.Int.annotateKey({ description: "Rows that wait for a proposal or a choice: Needs a decision" }),
      cannot: S.Int.annotateKey({ description: "Rows that wait for a typed value: Cannot import" }),
      ready: S.Int.annotateKey({ description: "Rows a confirm would write now" }),
      fixedRows: S.Int.annotateKey({ description: "Rows with a value a form-only rule changed, still in force" }),
      fixedCells: S.Int.annotateKey({ description: "Values a form-only rule changed, still in force" }),
      rows: S.Int.annotateKey({ description: "Record rows in the file: every row but blank and total rows" })
    }).annotateKey({ description: "How far the review is: rows that needed the person at first, and now" }),
    result: ImportResult.pipe(
      nullAsNone({ description: "What the confirms did, once there has been one; null before the first" })
    ),
    history: S.Array(ImportEvent).annotateKey({
      description: "Every confirm and take-back of this import, oldest first"
    }),
    takeBack: TakeBackState
  },
  {
    description:
      "One file on its way in, without its rows (those are fetched once from `table`, since they never change)"
  }
) {}

/**
 * What a request for suggestions did: what it stored this time, everything now stored for the import, who answered
 * (a model, or the rules with the reason no model did) and what happened in past-tense lines. Nothing in it has
 * changed a row: each suggestion waits in the review for the person.
 */
export const SuggestOutcome = S.Struct({
  made: S.Array(Suggestion).annotateKey({
    description: "The suggestions this request stored; empty when it added none"
  }),
  suggestions: S.Array(Suggestion).annotateKey({
    description: "Every suggestion now stored for the import: what `ImportView.suggestions` holds from now on"
  }),
  answeredBy: AnsweredBy,
  lines: S.Array(S.String).annotateKey({
    description: "What happened, in the past tense with real counts, for the person",
    examples: [["Suggested 2 names", "Suggested 2 categories"]]
  })
}).annotate({
  identifier: "SuggestOutcome",
  description: "What a request for suggestions did: what it stored, who answered and what happened, in lines"
})
/** The decoded value of `SuggestOutcome`. */
export type SuggestOutcome = typeof SuggestOutcome.Type

/**
 * How many open imports the first screen is sent in full. Each one is sent with its review worked out (the same
 * review the screen runs, over every row of the file), so the list is capped and the rest are only counted.
 */
export const openImportsShown = 5

/** The organization's imports nobody has confirmed yet, so the first screen can offer to continue or remove each. */
export const OpenImports = S.Struct({
  views: S.Array(ImportView).annotateKey({
    description: `The open imports, newest first, at most ${openImportsShown}`
  }),
  older: S.Int.annotateKey({
    description: "How many more open imports there are, older than those in views. Zero when every one is shown"
  })
}).annotate({
  identifier: "OpenImports",
  description:
    "The organization's imports nobody has confirmed yet, so the first screen can offer to continue or remove each"
})
/** The decoded value of `OpenImports`: the imports nobody has confirmed yet. */
export type OpenImports = typeof OpenImports.Type

/** How many past imports the first screen and the activity view are sent. The rest are counted. */
export const pastImportsShown = 50

/**
 * One import that was confirmed at least once, as a list shows it so the person can open its result again: the file,
 * who confirmed it last and when, and how many of its items are stored now, counted from the items themselves.
 */
export const PastImport = S.Struct({
  id: ImportId.annotateKey({ description: "The import's id: its result is at `/?import=<id>&step=result`" }),
  fileName: S.String.annotateKey({ description: "The file it came from", examples: ["items_messy.csv"] }),
  rowCount: S.Int.annotateKey({ description: "The rows of the file", examples: [200] }),
  status: S.Literals(["open", "imported", "takenBack"]).annotateKey({
    description:
      "imported: confirmed and in force; takenBack: its last confirm was taken back; open: confirmed once, then opened again to finish the rows it left out"
  }),
  confirmedByName: personName("Who confirmed it last"),
  confirmedAt: Instant.pipe(S.annotateKey({ description: "When it was confirmed last" })),
  items: S.Int.annotateKey({
    description: "How many items in the system came from this import now, counted from the stored items",
    examples: [155]
  }),
  notImported: S.Int.annotateKey({ description: "Rows its last confirm did not import", examples: [45] })
}).annotate({
  identifier: "PastImport",
  description: "One import that was confirmed at least once, so its result can be opened again"
})
/** The decoded value of `PastImport`. */
export type PastImport = typeof PastImport.Type

/** The organization's confirmed imports, newest first, and how many older ones were left out. */
export const PastImports = S.Struct({
  imports: S.Array(PastImport).annotateKey({
    description: `The confirmed imports, last confirmed first, at most ${pastImportsShown}`
  }),
  older: S.Int.annotateKey({ description: "How many more there are, older than those listed. Zero when all are" })
}).annotate({ identifier: "PastImports", description: "The organization's confirmed imports, newest first" })
/** The decoded value of `PastImports`. */
export type PastImports = typeof PastImports.Type

/** One changed value of an imported row as the activity view shows it: the file it came from, when, and who. */
export const ChangeRecord = S.Struct({
  importId: ImportId.annotateKey({ description: "The import that wrote the value" }),
  fileName: S.String.annotateKey({ description: "That import's file" }),
  rowNumber: S.Int.annotateKey({ description: "The row of the file, as Excel numbers it" }),
  part: S.Int.pipe(
    absentAsNone({
      description:
        "Which of its row's items the value went into (1, 2, ...), when the row holds several; left out for a row that is one item"
    })
  ),
  sku: S.String.annotateKey({ description: "The SKU of the item the value went into" }),
  change: Change.pipe(S.annotateKey({ description: "The value that differs from the file, and how it came to stand" })),
  decidedByName: S.String.pipe(
    nullAsNone({ description: "The member who accepted or typed it; null for a value a rule applied" })
  ),
  createdAt: Instant.pipe(S.annotateKey({ description: "When the import wrote it" })),
  takenBack: S.Boolean.annotateKey({
    description:
      "True when the import was taken back and the item this value went into was removed with it, or, for a stored item it replaced, put back as it was"
  })
}).annotate({ identifier: "ChangeRecord", description: "One value an import wrote that differs from its file" })
/** The decoded value of `ChangeRecord`: one changed value of an imported row as the activity view shows it. */
export type ChangeRecord = typeof ChangeRecord.Type
