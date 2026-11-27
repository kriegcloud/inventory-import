// Every command the import decides and every event it folds, each as one union told by its `_tag`.
import * as S from "effect/Schema"
import * as ActCounted from "./ActCounted.event.ts"
import * as ColumnMatched from "./ColumnMatched.event.ts"
import * as ConfirmImport from "./ConfirmImport.command.ts"
import * as GroupCounted from "./GroupCounted.event.ts"
import * as ImportConfirmed from "./ImportConfirmed.event.ts"
import * as ImportRemoved from "./ImportRemoved.event.ts"
import * as ImportReopened from "./ImportReopened.event.ts"
import * as ImportStaged from "./ImportStaged.event.ts"
import * as ImportTakenBack from "./ImportTakenBack.event.ts"
import * as MatchColumn from "./MatchColumn.command.ts"
import * as RecordSuggestion from "./RecordSuggestion.command.ts"
import * as RemoveImport from "./RemoveImport.command.ts"
import * as ReopenImport from "./ReopenImport.command.ts"
import * as StageImport from "./StageImport.command.ts"
import * as SuggestionRecorded from "./SuggestionRecorded.event.ts"
import * as TakeBackImport from "./TakeBackImport.command.ts"

/** A command the import itself decides, told by its `_tag`. */
export const ImportCommand = S.Union([
  StageImport.Command,
  MatchColumn.Command,
  RecordSuggestion.Command,
  ConfirmImport.Command,
  TakeBackImport.Command,
  ReopenImport.Command,
  RemoveImport.Command
])
  .annotate({ description: "A command the import itself decides" })
  .pipe(S.toTaggedUnion("_tag"))
/** The decoded value of `ImportCommand`. */
export type ImportCommand = typeof ImportCommand.Type

/** An event the import folds: its own commands', and `ActCounted` and `GroupCounted`, which only a decision records. */
export const ImportEvent = S.Union([
  ImportStaged.Event,
  ColumnMatched.Event,
  ActCounted.Event,
  GroupCounted.Event,
  SuggestionRecorded.Event,
  ImportConfirmed.Event,
  ImportTakenBack.Event,
  ImportReopened.Event,
  ImportRemoved.Event
])
  .annotate({ description: "An event the import folds, its own or one a decision records on it" })
  .pipe(S.toTaggedUnion("_tag"))
/** The decoded value of `ImportEvent`. */
export type ImportEvent = typeof ImportEvent.Type
