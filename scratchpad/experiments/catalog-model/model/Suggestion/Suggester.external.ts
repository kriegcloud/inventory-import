// The outside system that suggests what to do to an import's rows. The declaration only: its adapter is the host's. A
// trial block of the module-taxonomy exploration (decision 9c), never copied into a package.
import * as Domain from "@alchemy.run/domain"
import { ImportKey, Patch } from "../Review/Change.schema.ts"
import { SuggesterUnavailable } from "./SuggesterUnavailable.rejection.ts"

/**
 * **Details**
 *
 * One operation, `suggest`: given an import, it answers with a patch for its rows, or fails with
 * `SuggesterUnavailable`. A story stubs it and answers each call itself.
 *
 * @category externals
 * @since 0.0.0
 */
export class Suggester extends Domain.ExternalSystem(
  "Suggester",
  { suggest: { args: { importId: ImportKey }, success: { patch: Patch }, error: SuggesterUnavailable } },
  { description: "Suggests what to do to an import's rows" }
) {}
