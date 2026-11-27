// Every command the import itself decides, as one union told by its `_tag`.
import * as S from "effect/Schema"
import * as ConfirmImport from "./ConfirmImport.command.ts"
import * as MatchColumn from "./MatchColumn.command.ts"
import * as RecordSuggestion from "./RecordSuggestion.command.ts"
import * as RemoveImport from "./RemoveImport.command.ts"
import * as ReopenImport from "./ReopenImport.command.ts"
import * as StageImport from "./StageImport.command.ts"
import * as TakeBackImport from "./TakeBackImport.command.ts"

/**
 * **Details**
 *
 * The cases are told by `_tag`. A decision's commands are not in it: they act on the import, but a decision decides
 * them.
 *
 * **Example** (Tell a command's case)
 *
 * ```ts
 * import { ImportKey } from "../../Review/Change.schema.ts"
 * import { ImportCommand } from "./ImportCommand.union.ts"
 * import * as RecordSuggestion from "./RecordSuggestion.command.ts"
 *
 * const command: ImportCommand = RecordSuggestion.Command.make({ importId: ImportKey.make("import-1") })
 *
 * ImportCommand.guards.RecordSuggestion(command) // => true
 * ImportCommand.isAnyOf(["TakeBackImport", "ReopenImport", "RemoveImport"])(command) // => false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
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
/**
 * A command the import decides, as `ImportCommand` decodes it.
 *
 * @category models
 * @since 0.0.0
 */
export type ImportCommand = typeof ImportCommand.Type
