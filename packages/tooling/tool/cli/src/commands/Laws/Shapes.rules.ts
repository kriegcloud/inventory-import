/**
 * Two of Benjamin's rules on how code is shaped, each held by a law with a list of today's files that may only shrink
 * (`internal/listed.ts`).
 *
 * - Helpers take the value they act on first and are `dual` (2026-11-22: "If we are going to make helpers. We make
 *   them dual & pipe friendly with properly ordered parameters. i.e `cause` should be first parameter"). The law
 *   reads the clear case: a helper declared with a name (`const f = (…) =>`, `function f(…)`), of two values or more,
 *   that names one `cause`, `error`, `self` or `input` and is not written `dual(…)`, wherever that one stands. A
 *   helper of two values that names none of them is not read: which one it acts on is not in its words. A function
 *   handed to a call as an argument is not read: the call sets its order.
 * - Properties are `readonly` (2026-11-22: "All object types & interfaces should have readonly properties in the bast
 *   majority of cases"), React props among them. The law refuses, without `readonly`: a property of an object type
 *   or an interface, an index signature, a class's field, a mapped type's properties, and an array type (`T[]`,
 *   `Array<T>`) inside a property's own type. An array type elsewhere (a local list a function fills) is no property,
 *   so it is not read. The one kind of exception is another library's types, augmented in `declare global` or
 *   `declare module "…"`, whose shape is not ours; a `declare namespace` of our own is read.
 *
 * Not read by either, each by name: vendored code that another check holds byte for byte to its source (each file a
 * kit manifest under `packages/foundation/` hashes, read from the manifests, `bun run vendor:check`; a manifest's
 * `local` files are read; the Alchemy packages under `vendor/`, `bun run alchemy:check`), the agent skills (`.agents/`,
 * `.codex/`), and the scratchpad, where the laws apply when an experiment graduates. The components and hooks under `packages/ui/` came from registries, but every one has been
 * changed here since it was first committed and nothing holds it to its registry, so they are read and listed like
 * any other file.
 *
 * Each ledger (`ledgers/dual.json`, `ledgers/readonly.json`) names a file with the number of places it breaks its
 * rule, which only falls, held against the files there are and against main (`internal/ledger.ts`).
 *
 * @packageDocumentation
 */
import { scratchpadFolder } from "../../Repo.schema.ts"
import { ledgersFolder } from "./internal/ledger.ts"
import { type ListedSpec, listedLaw, listedSentence } from "./internal/listed.ts"
import { helpersNotDual, mutableProperties } from "./internal/shapesCode.ts"

/** What neither law reads, from the root. */
export const shapesLeftOut: ReadonlyArray<string> = [".agents/", ".codex/", `${scratchpadFolder}/`, "vendor/"]

/** What the dual-helper law is. */
export const dualSpec: ListedSpec = {
  check: "dual:check",
  rule: "every helper declared with two values or more that names the one it acts on takes it first and is dual",
  instead:
    "a helper that names the value it acts on (cause, error, self, input) and is not dual: put that value first and write the helper with dual from effect/Function, data-last form included",
  ledger: `${ledgersFolder}/dual.json`,
  leftOut: shapesLeftOut,
  leavesHashedKit: true,
  offsets: helpersNotDual
}

/** What the readonly law is. */
export const readonlySpec: ListedSpec = {
  check: "readonly:check",
  rule: "every property, index signature, class field and mapped property is readonly, with readonly arrays",
  instead:
    "a property that is not readonly, or a mutable array in one: write readonly (ReadonlyArray for an array), and keep a value that must change in a Ref or a MutableRef",
  ledger: `${ledgersFolder}/readonly.json`,
  leftOut: shapesLeftOut,
  leavesHashedKit: true,
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
