// A code kept only when a pattern allows it. The prover does not read a pattern, so it cannot say what `Schema.is`
// answers here, and has to say so: a rule that rests on the answer is "not supported", never proved.
import * as Domain from "@alchemy.run/domain"
import * as S from "effect/Schema"

/** A code of capital letters. */
export const Capitals = S.String.check(S.isPattern(/^[A-Z]+$/))

/** A code was kept. */
export class Kept extends Domain.Event("Kept", { code: S.String }) {}

/** The text is not a code. */
export class NotACode extends Domain.Rejection("NotACode", {}) {}

/** Keep a code. */
export class Keep extends Domain.Command("Keep", {
  input: { codeId: S.String, code: S.String },
  events: [Kept],
  rejects: [NotACode]
}) {}

/** One code, or none yet. */
export class Code extends Domain.Aggregate("Code", {
  id: S.String,
  state: S.Struct({ code: S.String }),
  initial: { code: "" },
  invariants: {
    // True of the real code, by the pattern. Not proved: the prover does not read the pattern.
    ACodeIsNeverLowerCaseA: (kept) => kept.code !== "a"
  },
  commands: [Keep],
  keyOf: (cmd) => cmd.codeId,
  decide: {
    Keep: (_kept, cmd) => (S.is(Capitals)(cmd.code) ? [Kept.make({ code: cmd.code })] : NotACode.make({}))
  },
  evolve: {
    Kept: (_kept, event) => ({ code: event.code })
  }
}) {}
