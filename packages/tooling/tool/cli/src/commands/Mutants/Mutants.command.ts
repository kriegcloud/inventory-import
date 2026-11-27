/**
 * `mutants <package>`: a model package's mutants, each one change to its source that its proof or its stories must
 * notice, run in copies of the package (`Mutants.rules.ts`; the catalog's `packages/catalog/model/mutants/README.md`).
 *
 * @packageDocumentation
 */
import * as Console from "effect/Console"
import * as Effect from "effect/Effect"
import * as Argument from "effect/cli/Argument"
import * as Command from "effect/cli/Command"
import * as Flag from "effect/cli/Flag"
import { emit } from "../../Report.schema.ts"
import { mutants, mutantsSentence, type MutantsFinding } from "./Mutants.rules.ts"

const folder = Argument.String("package").pipe(
  Argument.withDescription("The model package's folder, from where the command is run: packages/catalog/model, or .")
)
const all = Flag.Boolean("all").pipe(Flag.withDescription("Every mutant"), Flag.withDefault(false))
const sample = Flag.Boolean("sample").pipe(
  Flag.withDescription("The package's sample, named in its mutants file"),
  Flag.withDefault(false)
)
const list = Flag.Boolean("list").pipe(
  Flag.withDescription("The mutants, one a line, and nothing run"),
  Flag.withDefault(false)
)
const only = Flag.String("only").pipe(Flag.withDescription("The mutants named, keys comma-separated"), Flag.optional)
const except = Flag.String("except").pipe(
  Flag.withDescription("Keys to leave out, comma-separated: a slow one, run apart"),
  Flag.withDefault("")
)
const jobs = Flag.Int("jobs").pipe(Flag.withDescription("Mutants run at once"), Flag.withDefault(2))
const keep = Flag.Boolean("keep").pipe(
  Flag.withDescription("Keep each copy, with its result.json and vitest.log, after it is classified"),
  Flag.withDefault(false)
)
const baseline = Flag.Boolean("baseline").pipe(
  Flag.withDescription("Run the unchanged copy first, once a proof (--no-baseline skips it)"),
  Flag.withDefault(true)
)
const nice = Flag.Int("nice").pipe(
  Flag.withDescription("Niceness of each vitest run; 0 for none"),
  Flag.withDefault(10)
)
const timeout = Flag.Int("timeout").pipe(
  Flag.withDescription("Seconds before a mutant's run is stopped"),
  Flag.withDefault(3600)
)
const proofLimit = Flag.Int("proof-limit").pipe(
  Flag.withDescription(
    "Seconds a proof test may take, set in each copy only; the test file's own limit when not given"
  ),
  Flag.optional
)

const said = (finding: MutantsFinding) => {
  const line = mutantsSentence(finding)
  return line.to === "out" ? Console.log(line.text) : Console.error(line.text)
}

/** `mutants <package> --all | --sample | --only <keys> | --list`. */
export const mutantsCommand = Command.make(
  "mutants",
  { folder, all, sample, list, only, except, jobs, keep, baseline, nice, timeout, proofLimit },
  (flags) => Effect.flatMap(mutants(flags, said), emit(mutantsSentence))
).pipe(
  Command.withDescription(
    "Run a model package's mutants, each one change to its source in a copy, against its proof and the stories"
  )
)
