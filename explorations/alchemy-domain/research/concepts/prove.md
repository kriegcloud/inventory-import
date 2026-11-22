---
type: Reference
title: Prove
description: The induction prover under Verify, which reads the TypeScript of decide, evolve and the rules and asks an SMT solver for any state and input that break a rule; this app would use it to prove the item, import and allowance rules that are about one instance.
tags: [alchemy-domain, checking]
---

# Prove

Read at the library's release `2.0.0-beta.87` and its `main@dbfd0dd`, not at the pin `734c27a` the repository
builds on. What changed between that touches what this page recommends is listed once in [the map](../00-map.md),
"From `dbfd0dd` to the pin".

`Prove` proves an aggregate's invariants and transitions, and a decision's rules, by induction. It takes any state
the state's schema allows that satisfies every invariant it can read, any command input the command's schema allows,
any time and any request context, runs `decide` and `evolve` symbolically, and asks the Z3 solver whether some choice
of those values leaves a rule false. When no choice does, the rule holds after any number of commands. The prover
does not run your module's functions to learn the rules: it parses the source file with `oxc-parser` and interprets
the syntax tree, so what it can prove is limited by what TypeScript it can read. In the docs' words, when no state
breaks a rule, "the rule holds after any number of commands, not only the ones that were run"
[website/src/content/docs/domain/verifying-models.mdx on main@dbfd0ddb; not on the live site].

## When to reach for it

- A rule about one aggregate instance: "an item's revision goes up by one on every edit", "a confirmed import's
  outcomes add up to its rows", "the day's model calls never pass 40". These are invariants or transitions, and
  `Prove.invariants` can prove them for every state, not only the states some test reached.
- A rule about one step of a [decision](./decision.md) across a few instances, through `Prove.decision`.
- A rule that names a fixed few instances is a [relation](./relation.md); it is proved by the same machinery, but only
  through `Verify.model` (see [verify](./verify.md)), not through a `Prove` export.
- Not for a rule over every instance of a model (an organization "always keeps an admin" when admins are separate
  member instances). Those are only searched, by [explore](./explore.md). Kept as counts on one aggregate, the same
  rule is proved: the trial on 2026-11-19 proved `Organization.AlwaysKeepsAnAdmin` that way.
- Usually you call [verify](./verify.md), which runs `Prove` and `Explore` together and labels each rule Proved,
  Checked or Sampled. Call `Prove` on its own for the fastest check of one aggregate, or of one decision without a
  model around it.

## How it is declared

`Prove` declares nothing. The rules live on the aggregate (`invariants`, `transitions`) and on the decision
(`transitions`); see [invariants-and-transitions](./invariants-and-transitions.md). `Prove` is imported from its own
subpath, `@alchemy.run/domain/Prove`, and runs inside a test with Node's file system.

```ts
// SKETCH: not compiled
import * as Prove from "@alchemy.run/domain/Prove"
import * as NodeServices from "@effect/platform-node/NodeServices"
import { it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { Item } from "../src/Item/Item.aggregate.ts"

it.effect("no edit breaks an item's rules", () =>
  Prove.invariants(Item, { source: new URL("../src/Item/Item.aggregate.ts", import.meta.url) }).pipe(
    Effect.provide(NodeServices.layer)
  ), 60_000)
```

The exports, all in `packages/domain/src/Prove.ts` on main:

| Export | Shape | Line |
| --- | --- | --- |
| `Options` | `{ source: URL \| string, decisions?: ReadonlyArray<{ decision, source }> }` | 29-41 |
| `DecisionOptions` | `{ source: URL \| string }` | 44-47 |
| `report(aggregate, options)` | `Effect<Report, ProveError, FileSystem \| Path>`: never fails on a broken rule | 180-272 |
| `proved(report)` | `boolean`: every command keeps the state in its schema, can be accepted, no event comes from outside, every invariant holds initially and every verdict is `Proved` | 283-293 |
| `invariants(aggregate, options)` | `report` then fails with `InvariantsNotProved` unless `proved` | 307-317 |
| `render(report)` | the report as text | 353-415 |
| `decisionReport(decision, options)` | `Effect<DecisionReport, ProveError, FileSystem \| Path>` | 479-532 |
| `decisionProved(report)` | `boolean` | 538-541 |
| `decision(decision, options)` | `decisionReport` then fails with `DecisionNotProved` | 556-572 |
| `renderDecision(report)` | text | 575-594 |
| `ATOMIC` | the assumption that a decision's events commit on all instances or none | 160-161 |
| `ProveError` | tagged error: a file did not load, or the solver is missing | 88 |
| `InvariantsNotProved` | tagged error with `message` (the rendered report) and `report` | 91-94 |
| `DecisionNotProved` | tagged error with `message` and `report` | 50-53 |
| `Report`, `DecisionReport` | interfaces | 96-157, 55-85 |
| `Verdict`, `Counterexample` | re-exported types from `Prove/internal/Check.ts` | 27 |

`Options.decisions` lets an aggregate that folds an event only a decision records be proved together with that
decision (Prove.ts:200-216); without it, such events are listed under `outside` and `proved` is false (261-263, 285).

Checked in: none of this exists at `v2.0.0-beta.87`; `packages/domain/src` there has no `Prove.ts`, and
`Aggregate.ts` there has no `invariants` or `transitions` option. On main the options are at
`packages/domain/src/Aggregate.ts:151-171`.

**Internal modules.** Every file under `packages/domain/src/Prove/internal/` is internal: `package.json:60` maps
`./Prove/internal/*` to `null`, so none can be imported from the package. They are listed so each name can be found.

| File | What it does (internal) | Exported names |
| --- | --- | --- |
| `Check.ts` | Asks Z3 for inputs that break a rule on one path, builds them as real values, runs the real code on them, and gives the `Verdict` | `Counterexample`, `Verdict`, `Model`, `solve`, `Moved`, `Kept`, `Build`, `Keeping`, `notConfirmed`, `rules`, `invariant`, `schema`, `check`, `checkAt`, `DecisionMoved`, `DecisionKept`, `onInstance`, `schemas`, `transition`, `checkDecision` |
| `Decide.ts` | Runs a decision's real `decide`, and each instance's real `evolve`, without a platform | `Wrote`, `Ran`, `States`, `run`, `byName` |
| `Induction.ts` | One induction row per command (and per decision): every path, the worst verdict per rule, the 4,096-path limit | `Row`, `unkept`, `closed`, `within`, `worse`, `notRead`, `MAX_PATHS`, `rows`, `DecisionImpl`, `ruleOf`, `DecisionRow`, `reader`, `decisionRow`, `locate` |
| `Interpreter.ts` | Interprets the syntax tree symbolically: statements, expressions, calls, `new`, `yield*` | `Interpreter`, `Hooks`, `make` |
| `Library.ts` | The models of library functions (`effect/Effect`, `Option`, `Array`, `Record`, `Struct`, `Match`, `Optic`, `DateTime`, `Math`, `Object`) and number promotion | `Host`, `Model`, `make`, `numeric`, `promote` |
| `Paths.ts` | Finds the aggregate or decision in its file, and runs one command or decision along one path | `CommandClass`, `Definition`, `Inputs`, `Outcome`, `Path`, `handlers`, `addressOf`, `keyOf`, `Applied`, `Step`, `step`, `DecisionDefinition`, `Slot`, `Part`, `Decided`, `DecisionStep`, `decided`, `decisionChecks`, `decisionRuleNames`, `relationNames`, `relationHolds`, `assumed`, `reach`, `aggregateIn`, `decisionIn`, `Check`, `Taken`, `checks`, `path`, `at`, `same`, `namesOf`, `invariantNames`, `transitionNames`, `ruleNames`, `unread`, `find`, `load` |
| `Relations.ts` | Proves a model's relations against every command and decision that can change them | `Over`, `Relation`, `Real`, `Subject`, `Row`, `rows` |
| `Smt.ts` | Z3 through `z3-solver`: sorts, terms, the S-expression reader, the solver with its fixed seeds and work limit | `Sort`, `Term`, `symbol`, `int`, `big`, `real`, `string`, `bool`, `not`, `SolverError`, `Sexp`, `parse`, `valueOf`, `Query`, `Answer`, `Solver`, `solver` |
| `Source.ts` | Parses a file with `oxc-parser`, loads it, and resolves relative imports only | `LoadError`, `Loader`, `loader` |
| `Symbolic.ts` | Turns a schema into solver inputs, reads its checks, lists the checks it does not read, and builds real values back | `Unread`, `unread`, `MAX_ITEMS`, `force`, `typeOf`, `symbolic`, `assumeFits`, `fits`, `Unbuildable`, `concretize`, `show` |
| `Value.ts` | The interpreter's values, the stops (`Rejected`, `NotTranslated`, `Infeasible`), and the path driver `Run` | `Node`, `Module`, `Declaration`, `Import`, `Scope`, `Env`, `Brand`, `OpticStep`, `V`, `num`, `str`, `bool`, `nil`, `undef`, `term`, `obj`, `none`, `some`, `optionOf`, `isBig`, `Site`, `Rejected`, `NotTranslated`, `Infeasible`, `Stop`, `Eval`, `lineOf`, `notTranslated`, `Application`, `Run`, `nextPrefix` |

### What main changes

Everything on this page is new on main:

- `packages/domain/src/Prove.ts` and `packages/domain/src/Prove/internal/*` (11 files) arrived with pull request 3260,
  "feat(domain): Verify proves and searches a model's rules", merged 2026-11-19 as commit `e4adb720c`.
- Pull request 3503, "feat(domain): Verify reads effect/Match" (commit `d123c318d`), added the `effect/Match` models
  (`Prove/internal/Library.ts:346-670`).
- Pull request 3504 (commit `852675fdd`) added the docs page `website/src/content/docs/domain/verifiable-code.mdx`.
- `packages/domain/package.json` gains `dependencies` `oxc-parser` and `z3-solver` (both `catalog:`), and hides
  `./Prove/internal/*` and `./Explore/internal/*` from the published exports (`null` entries). The workspace catalog
  pins `oxc-parser: "0.141.0"` and `z3-solver: "5.3.3"` (`pnpm-workspace.yaml:211`, `:260`).

## What "proved" means here

A proof is one induction step per command, per path through the command's code (`Prove/internal/Induction.ts:88-172`,
`Prove/internal/Paths.ts:811-871`):

1. The state is a fresh symbolic value of the state's schema (`Paths.ts:825`).
2. Every invariant the prover can read is assumed true of it (`Paths.ts:828-834`). An invariant it cannot read is
   simply not assumed, which only weakens the assumption.
3. The command's fields are fresh inputs from its schema (`Paths.ts:198-205`); `now` is any whole millisecond from
   0 to the start of 2100 (`Paths.ts:62`, `208-214`); `version` is any whole number at or above 0; each request
   context the code yields is any value its schema allows (`Interpreter.ts:843-860`).
4. `decide` runs. Every `if`, `?:`, `&&`, `switch` case or union member whose answer depends on an input is a
   branch: the run takes one side, records the condition, and the driver re-runs with the next choice until every
   path is taken (`Value.ts:205-328`). A rejection or an empty list of events ends the path as unchanged.
5. `evolve` folds the events, and every invariant and transition is turned into a formula on the new state.
6. Z3 is asked for inputs that satisfy the path's conditions and make the rule false (`Check.ts:60-127`). Each Int
   input is bounded to ±(2^53−1) unless it is a `bigint` (`Check.ts:66-70`).
7. If Z3 answers `unsat`, the rule is `Proved` on that path. If it finds inputs, they are built as real values and
   the real `decide` and `evolve` run on them through `Aggregate.predict` (`Check.ts:218-309`). Only when the real
   code also breaks the rule is the verdict `Violated`, with a counterexample; otherwise it is `Unconfirmed`.

The same machinery also proves two things nobody wrote: that every command leaves the state inside its schema (the
`schema` verdict per command, `Induction.ts:149-157`, which matters because every step assumes it), and that each
command can record an event from some state (`accepted`, `Induction.ts:163-167`). A command that is never accepted
makes `proved` false (`Prove.ts:286`). An invariant that is true of every reachable state but does not hold
inductively (the escrow example in the docs) is not proved until a stronger invariant rules out the unreachable
state.

### Verdicts

`Verdict` (`Check.ts:25-42`) and how `render` labels each (`Prove.ts:343-350`):

| Tag | Meaning | Rendered as |
| --- | --- | --- |
| `Proved` | No state and no input break it | proved |
| `Bounded` | Proved only with input lists of a few items (`Induction.ts:63-71`) | proved for short lists only |
| `Violated` | Real code breaks it on the counterexample | violated |
| `Unconfirmed` | Z3 found inputs, the real code keeps the rule on them, or they cannot be built | not proved |
| `NotTranslated` | The prover met code it cannot read: `file`, `line`, `reason` | not read |
| `Unknown` | Z3 gave up, or a command has more than 4,096 paths | not decided |

When several paths give different verdicts, the worst wins, in the order Proved < Bounded < Unknown < NotTranslated <
Unconfirmed < Violated (`Induction.ts:50-57`, `73`). `Verify` shows `Bounded` as "Checked".

A `Counterexample` (`Check.ts:15-23`) holds `state`, `command`, the `context` values read, `now`, the `events` the
real code recorded and the state `after`, all real values. A failed proof is `InvariantsNotProved` whose `message` is
the rendered report with those rows, and whose `report` is the whole `Report`.

### Bounds and limits

| Limit | Value | Where |
| --- | --- | --- |
| Paths per command | 4,096; more gives `Unknown` | `Induction.ts:82`, `108-117` |
| Extra items tried in an input list | 2 above the schema's minimum (and never above its maximum) | `Symbolic.ts:230`, `237-257` |
| Turns of one loop | 10,000; more stops with `NotTranslated` | `Interpreter.ts:179`, `1371-1372` |
| Solver work per question | `rlimit` 40,000,000 (deterministic); seeds fixed at 0 | `Smt.ts:202`, `228-231` |
| Solver wall clock per question | 60 seconds, for a question that hangs | `Smt.ts:232` |
| Retries when a modelled function (a number's text, a date's text) disagrees with the real one | 8 rounds, then `Unknown` | `Check.ts:108-126` |
| Latest `now` | 4,102,444,800,000 ms (1 January 2100) | `Paths.ts:62` |

## What code the prover can read

This is the heart of the page. The prover reads the file you pass as `source`, finds the object passed to
`Domain.Aggregate("<name>", { ... })` that has an `evolve` property (`Paths.ts:967-1001`), and interprets `decide`,
`evolve`, `keyOf`, `invariants` and `transitions` from that object. It follows calls into functions declared in that
file or in files it imports by a relative path. Everything else is either a library function with a model, a value
the loaded module exported (a class, a schema, a constant it could not rebuild from source), or not read.

How code that is not read is handled: the path stops with `NotTranslated` naming the file, line and reason
(`Value.ts:158-186`). For `Prove`, every rule the command must keep gets that verdict and the rule is not proved
(`Induction.ts:129-134`). An invariant that cannot be read is also dropped from the assumptions (`Paths.ts:828-831`).
Nothing is sampled or guessed: `Prove` itself has no fallback. The fallback is in [verify](./verify.md), which
reports the rule as not proved, and in [explore](./explore.md), which marks the sequences through that code as not
run and fails its `check` with `Incomplete`.

### What a trial on main showed

A trial on 2026-11-19 ran `Verify.aggregate` and `Verify.model` (which run `Prove` first) on a model of this app at
`main@dbfd0ddb`, under Node and Vitest, each case in its own test file. These rows were run; every other row in the
tables below is read from source only, and says so where it matters.

| Construct | As run | What the report said | Source |
| --- | --- | --- | --- |
| `new ImportStaged({ ... })` (an event built with `new` in `decide`) | read; every rule proved | the rule listed under "Proved" | `Interpreter.ts:864-891` |
| `ImportStaged.make({ ... })` in `decide` | not read; nothing proved, the sequences through it not run | "decide for StageImport returns something that is not an event" | `Interpreter.ts:605-617` gives the plain fields; `Paths.ts:236-242` stops |
| `import * as S from "effect/Schema"` in place of `Schema` | read; every rule proved | | `Interpreter.ts:324-329` |
| No semicolons, two-space indent | read | | the parser ignores both |
| Blocks imported into the aggregate's file by a relative path | read (the upstream example also imports its blocks that way) | | `Source.ts:227-230` |
| Commands, events and rejections imported by package name | not read | "constructs a class, which is not an event, a rejection or a command" | `Source.ts:229` resolves only specifiers that start with `.`; `Interpreter.ts:864-869` |
| A helper function imported by package name | not read | "calls <package>.isFirstRevision, which the prover has no model for" | `Library.ts:1017-1029` |
| `decide` written as `Effect.fn(function* (state, command) { ... })` that does `yield* CurrentActor` (a `Domain.RequestContext` of `{ organizationId, memberId, role }`) and `return yield* new NotPermitted({})` | read; proved for every actor the context's schema allows | | `Interpreter.ts:816-818`, `843-860` |
| A transition written as `Effect.fn` that reads `CurrentActor` (`OnlyItsOwnOrganizationChangesAnImport`, `AViewerChangesNothing`) | read and proved | | `Aggregate.ts:159-171` |
| `decide`'s third argument destructured, `{ version }`, compared with a command field (`cmd.reviewedAt !== version`) | read and proved | | `Paths.ts:175`, `836-837` (`version` is any whole number at or above 0) |
| Whole-number `+`, `-`, `>`, `>=`, `===`, `!==` over a state that is an `S.Union` of `S.TaggedStruct`s with `S.Int` fields; spreading the state (`{ ...s, ready: s.ready + 1 }`); a module constant (`const DAILY_CALLS = 40`) | read and proved (`OutcomesAddUpToTheRows`, `NeverMoreThanTheDaysAllowance` and 17 more) | | `Interpreter.ts:893-1260`, `287-306` |
| Two aggregates with the same name imported into one test file | the prover read one file for both | "the real code disagrees with what the explorer read" | `Verify.ts:182-214` finds the file by the text `Aggregate("<name>"` |

Not run in the trial, so from source only: `effect/Match` and `effect/Option` calls, `effect/Array` and
`effect/Record` calls, loops, lists in a state or a command, `bigint`, `S.DateTimeUtc`, a `Domain.Decision`, a
`Domain.Relation`.

### Where the rules must be written

| Construct | Read? | When not |
| --- | --- | --- |
| Aggregate declared as `Domain.Aggregate("Item", { ... })` with a string literal name and an inline object that has `evolve` | yes | `ProveError`: the file "does not declare the aggregate" (`Paths.ts:1027-1032`) |
| `invariants` and `transitions` written as an object literal inside that definition, each rule a property | yes | `ProveError` naming the invariants written elsewhere (`Paths.ts:1039-1044`; fixture `Aside`) |
| Spreading shared parts into the definition (`...definition`) | yes, for `id`, `state`, `commands` read at run time | the handlers and rules themselves must still be written in the literal (fixture `Escrow`) |
| `decide` and `evolve` as objects keyed by tag | yes, looked up by the command's or event's tag | a missing handler stops the path (`Paths.ts:172-173`, `244-245`) |
| `keyOf` | yes: it must give a string the prover can see or a string input | stops: "is sent to something that is not an id" (`Paths.ts:154-158`) |
| Decision written as `Domain.Decision(Command, { reads, keyOf, decide, ... })` | yes (`Paths.ts:689-734`) | `ProveError` |

### Imports and names

| Construct | Read? | When not |
| --- | --- | --- |
| Functions and constants in the same file | yes, from source (`Interpreter.ts:287-315`) | a constant it cannot rebuild falls back to the value the module exported (`294-306`) |
| Imports by a relative path (`"./Rules.ts"`, `"../Item/Item.aggregate.ts"`) | yes, the file is parsed and read (`Source.ts:227-230`). Run | |
| Imports from a package (`"effect/Array"`, `"@inventory/kernel/Ids"`) | only as a library function with a model (table below) | any other function or constant from a package is a library value with no model: calling it stops with "calls <module>.<name>, which the prover has no model for" (`Library.ts:1017-1029`; run, with a helper from another package); `new` on a class from a package stops with "constructs a class, which is not an event, a rejection or a command" (run); using such a value as a number or string fails as arithmetic or comparison on an unknown value (source only) |
| `import * as A from "effect/Array"`, `import { Array as Arr } from "effect"` | yes: both name the module `effect/Array` (`Interpreter.ts:324-329`). The alias `S` for `effect/Schema` was run | |
| `import type` | skipped (`Source.ts:191`, `195`) | |
| A class from your files used with `new` (event, rejection, command) | yes, built with its tag and its fields' schema checks assumed (`Interpreter.ts:864-891`). Run | `new` on any other class stops: "is not an event, a rejection or a command" |
| `X.make(...)` on a schema value (`ItemKey.make(text)`) | yes: the value itself, with the schema's checks assumed (`Interpreter.ts:605-617`) | on an event class it returns the plain fields, which are not an event, so folding the events stops with "decide for <Command> returns something that is not an event" (`Paths.ts:236-242`). Run: every rule of the command was "not read". Use `new` in `decide` |
| Globals `undefined`, `Math`, `Object`, `BigInt` | yes (`Interpreter.ts:360-374`) | any other global (`Number`, `String`, `JSON`, `Intl`, `Date`) stops: "refers to X, which the prover cannot find" |

### Statements

From `Interpreter.ts:1263-1397`:

| Construct | Read? | When not |
| --- | --- | --- |
| `const`, `let`, `var` with destructuring, defaults and rest | yes | |
| Assignment to a local variable; `+=`, `-=`, `*=`, `/=`, `%=`, `??=`, `\|\|=`, `&&=`; `++`, `--` | yes | assignment to a name that is not local stops (`782`) |
| Writing a property or an index of an object or array the same call created | yes (`757-770`) | changing a value it was given stops: "changes a value it was given" (fixture `Stack`) |
| `if`/`else`, `switch` with fall-through and `break`, `return`, blocks, function declarations | yes | |
| `for`, `for...of` over a known array, `for...in` over an object with known keys, `while`, `do...while`, `break`, `continue` | yes, while the number of turns is known | a loop whose test depends on an input stops (`807`); over 10,000 turns stops; `break`/`continue` to a label stops (`1323`, `1325`) |
| `for await` | no | stops (`1328`) |
| `try`, `catch`, `throw`, `class`, labelled statements, anything else | no | stops: "uses a <Type>, which the prover does not read" (`1392-1393`) |
| `async` functions | no | stops: "calls an async function" (`814`) |
| Generator functions, `Effect.gen`, `Effect.fn`, `Effect.fnUntraced` | yes: calling one gives an effect, run when yielded (`816-818`). `Effect.fn` decides and transitions were run | |
| `yield*` on an effect, a rejection, a request context, or a client the caller supplies | yes (`835-862`). `yield* CurrentActor` and `return yield* new NotPermitted({})` were run | `yield` without a star stops (`1116`); yielding anything else stops |

### Expressions and operators

From `Interpreter.ts:893-1260`:

| Construct | Read? | When not |
| --- | --- | --- |
| Number, string, boolean, `null`, `bigint` literals | yes | a regular expression literal stops: "uses a literal the prover does not read" (`1054-1056`) |
| Template literals, `+` on strings | yes; a number turned into text is a function the solver learns one value at a time (`1014-1041`) | |
| `+`, `-`, `*` on whole numbers (`Int` sort) and on `bigint` | yes, exact. `+` and `-` on `S.Int` fields were run | on numbers that may not be whole (`Real` sort) it stops: "which JavaScript rounds and the prover does not" (`996-1000`; fixture `Drift`). Mixing `bigint` and `number` stops |
| `/` and `%` | yes only when a whole number is divided by a whole-number literal the code writes; the quotient is exact through `Math.floor`, `Math.ceil`, `Math.trunc`, or when compared with a whole number (`954-992`, `1002-1006`) | division by an input stops |
| `<`, `<=`, `>`, `>=` | yes on numbers. Run | on strings or times stops ("cannot do arithmetic on") |
| `===`, `!==` | yes on numbers, strings, booleans, `null`, `undefined`; objects only to themselves (`103-140`). Run on numbers, strings and tags | on an opaque value or a time it stops ("compares values the prover does not model") |
| `==`, `!=` | only against `null` or `undefined` (`1166-1175`) | otherwise stops |
| `&&`, `\|\|`, `??`, `!`, `?:`, optional chaining `?.`, unary `-` and `+` | yes | |
| `typeof` | yes on known kinds (`182-214`) | |
| `in` | yes on an object with known keys and a key the code writes (`1176-1180`) | otherwise stops |
| `instanceof`, bitwise operators, `delete`, `void`, comma and others | no | stops: "uses <op>, which the prover does not translate" |
| Object and array literals, spread of either, computed keys the code writes | yes | a key that depends on an input stops (`1199-1203`); spreading an `Option` stops (`1188-1191`) |
| Property read by name, or by a key the prover can see | yes | a key from an input stops (`1087-1089`) |
| `as`, `satisfies`, `!`, type assertions, instantiation expressions | yes, ignored (`1069-1076`) | |
| Arrow functions, function expressions, calls, spread arguments of a known array | yes | |

### Values and their own methods

| Construct | Read? | When not |
| --- | --- | --- |
| Array: index, `length`, `at`, `slice` (literal bounds), `concat`, `includes`, `entries`, `keys`, `values` | yes (`Interpreter.ts:472-526`) | `slice` or `at` at a place from an input stops |
| Array: `map`, `filter`, `flatMap`, `find`, `findIndex`, `some`, `every`, `forEach`, `reduce` | yes (`396-469`); `some` and `every` build one formula and do not split the path | |
| Array `push` | only on an array the same call created (`527-531`) | on a given array stops |
| Any other array method (`sort`, `join`, `indexOf`, `reverse`, `splice`) | no | stops: "reads .<name> of an array" |
| String `length` | yes, as `str.len` (`584-591`) | every other string method (`trim`, `startsWith`, `includes`, `toUpperCase`, `replace`, `split`) stops: "reads .<name> of a string" |
| `option.pipe(...)`, `effect.pipe(...)`, a matcher's `.pipe(...)` | yes (`542-555`, `619-630`) | `.pipe` on other values is only a field read |
| `Object.keys`, `Object.values`, `Object.entries` | yes on an object whose keys are known and that is not an event, command or `Option` (`Library.ts:814-824`) | |
| `BigInt(x)` | yes on a whole number (`Interpreter.ts:362-374`) | |

### Library functions with a model

Each is in `Prove/internal/Library.ts`; any other library call stops with `NotTranslated` naming it (`1023-1028`). A
call into `effect/Schema` is the one exception: it gives an opaque "schema" value instead of stopping, so building a
schema is harmless, but calling what it returns (`S.is(X)(value)`, `S.decodeOption(X)(text)`) stops (`1021-1022`,
`Interpreter.ts:828-829`). Most models accept both the data-first and the piped form (`Library.ts:232-241`).

| Module | Read | Lines |
| --- | --- | --- |
| `effect/Effect` | `gen`, `fn` (with or without a name or options), `fnUntraced`, `succeed`, `fail` (a rejection), `sync`, `void`, `map`, `flatMap`, `andThen`, `tap`, `asVoid`, `orDie`, `catchTag` (one tag or a list), `provideService`; `annotateCurrentSpan`, `log`, `logDebug`, `logInfo`, `logWarning`, `logError` are ignored | 909-992, 1007-1009 |
| `effect/Match` | `value`, `type`, `when` (predicate, literal or object pattern), `not`, `whenOr`, `whenAnd`, `tag`, `tags`, `tagsExhaustive`, `discriminator`, `discriminators`, `discriminatorsExhaustive`, `valueTags`, `typeTags`, `withReturnType`, `orElse`, `orElseAbsurd`, `exhaustive`, `option`, patterns `any` and `defined` | 483-670 |
| `effect/Option` | `some`, `none`, `fromNullishOr`, `fromNullOr`, `fromUndefinedOr`, `isSome`, `isNone`, `match`, `getOrElse`, `getOrUndefined`, `getOrNull`, `orElse`, `map`, `flatMap`, `filter`, `exists`; `_tag` and `value` are plain fields | 676-747 |
| `effect/Array` | `map`, `filter`, `flatMap`, `some`, `every`, `findFirst`, `reduce`, `append`, `prepend`, `appendAll`, `length`, `isArrayEmpty`, `isReadonlyArrayEmpty`, `isArrayNonEmpty`, `isReadonlyArrayNonEmpty`, `head`, `last`, `get` (literal index) | 825-882 |
| `effect/Record` | `get`, `has`, `set`, `remove` (each with a key the code writes), `map`, `keys`, `values`, `size`, `isEmptyRecord`, `isEmptyReadonlyRecord`, on a plain object whose keys are known | 766-813 |
| `effect/Struct` | `omit`, `pick` (keys the code writes) | 748-765 |
| `effect/Optic` | `id`, `modify`, `replace`, and an optic's `.tag(...)`, `.key(...)`, `.modify(...)`, `.replace(...)` | 101-127, 993-995 |
| `effect/DateTime` | `toEpochMillis`, `formatIsoDate`, `formatIsoDateUtc` | 996-1001 |
| `effect/Function`, `effect` | `pipe` | 674-675 |
| `Math` | `floor`, `ceil`, `trunc`, `abs`, `max`, `min` | 883-908, 1002-1003 |
| `Object` | `keys`, `values`, `entries` | 814-824 |

Not modelled, so a call stops the path. The models are one table keyed `"<module>:<name>"`
(`Library.ts:672-1004`), and it has no key for any of these: every `effect/String` function, `effect/HashMap`,
`effect/HashSet`, `effect/MutableHashMap`, `effect/MutableHashSet`, `effect/BigDecimal`, `effect/Data` (including
`Data.taggedEnum`), `effect/Predicate`, `effect/Tuple`, `effect/Result`, `Array.filterMap`, `Array.join`,
`Array.dedupe`, `Array.sort`, `Option.flatten`, `Option.getOrThrow`, `Record.fromEntries`, `DateTime.now`,
`DateTime.add`, `DateTime.subtract`, `Effect.forEach`, `Effect.all`, `Effect.mapError`, `Clock`, and
`Match.result`, `Match.tagStartsWith`, `Match.discriminatorStartsWith`, `Match.literals`, and the type patterns
(`Match.string`, `Match.number`, `Match.instanceOf`). Such a call fails at `Library.ts:1017-1029` with "calls
HashMap.get, which the prover has no model for" (the `effect/` prefix is dropped from the module's name). From source
only, for the house rules:

- `HashMap`, `HashSet`, `MutableHashMap`, `MutableHashSet`, `effect/String`: any call stops as above. The plain `Map`
  and `Set` are no way out: they are globals the prover does not know, so `new Map()` stops with "refers to Map, which
  the prover cannot find" (`Interpreter.ts:360-375`).
- `Data.taggedEnum`: building the enum is a call with no model. If the enum is a module constant the prover falls
  back to the value Node loaded (`Interpreter.ts:291-306`), and then calling one of its constructors
  (`ImportState.Open({ ... })`) is a call into loaded code, which stops with "calls ImportState.Open, which is outside
  the code the prover reads" (`Interpreter.ts:822-826`). Build union values as object literals with a `_tag`.

### Schemas: how a state becomes solver sorts

The solver knows four sorts: `Int`, `Real`, `Bool`, `String` (`Smt.ts:6`). `Symbolic.symbolic` (`Symbolic.ts:267-334`)
turns the type side of a schema into inputs:

| Schema | Becomes | Notes |
| --- | --- | --- |
| `S.String`, template literal | `String` input | `isMinLength`/`isMaxLength` assumed as `str.len` bounds |
| `S.Int` (a number with `isInt`) | `Int` input | bounds, `isMultipleOf` a whole number assumed (`58-145`) |
| `S.Number`, `S.Finite` | `Real` input | comparisons read; `+ - *` on it are not |
| `S.BigInt` | `Int` input with no ±2^53 bound | bigint bounds read |
| `S.Boolean` | `Bool` input | |
| `S.Literal`, `S.Literals`, `LiteralKit` | the literal itself; a union of literals is one branch per member | |
| `S.Null`, `S.Undefined`, `S.Void` | the value | |
| `S.Struct`, `S.TaggedStruct`, struct-based classes | an object of inputs; an optional key is tried present and absent (`314`) | an index signature (`S.Record`) makes the whole object opaque (`309`) |
| `S.Union` (a tagged union of structs) | one branch per member | `stateTags` gives the tags the explorer reports as states reached |
| `S.Array(X)` | a list given its length when first looked at: from the minimum to 2 more (`230-257`) | a tuple with more than one rest element is opaque |
| `S.Option(X)` | `none` and `some(input)` | |
| `S.DateTimeUtc` | a time: an `Int` of epoch milliseconds | only `DateTime.toEpochMillis` and `formatIsoDate*` read it |
| A branded schema | what it brands (Effect 4's `Schema.brand` keeps the same AST, `effect` 4.1.4 `src/Schema.ts:5359-5362`, which builds the brand on `schema.ast`) | |
| `S.BigDecimal`, any other declaration, `S.Record`, `S.Unknown` | opaque | passing it along is read; looking into it stops |

Checks read: `isInt`, `isFinite`, `isGreaterThan`, `isGreaterThanOrEqualTo`, `isLessThan`, `isLessThanOrEqualTo`,
`isBetween` and their `BigInt` forms (on numbers only), `isMultipleOf` a whole number, `isMinLength`, `isMaxLength`
(on strings and arrays) (`Symbolic.ts:87-140`). Any other check (`isPattern`, a filter written by hand) is listed in
`Report.unread`, never assumed; a command that writes a field with such a check is listed in `Report.unkept`
(`Paths.ts:857-859`; fixture `Label`).

### Request contexts and the clock

A request context is read when it is a `Domain.RequestContext` (a class with a string `key` and a `schema`): yielding
it gives any value its schema allows (`Interpreter.ts:29-32`, `843-860`). A plain `Context.Service` has no schema, so
yielding one stops: "yields a value the prover has no model for". Middleware is not run, so a rule is proved for every
caller the context's schema allows. Run: the trial's `CurrentActor` (`Domain.RequestContext` over
`S.Struct({ organizationId, memberId, role: S.Literals(["admin", "editor", "viewer"]) })`) was read. A violated
proof prints each request context the command read as a row of its own, under its name (`Prove.ts:328`). Time comes only from `decide`'s third argument (`context.now`) and the envelope's
`at`; `DateTime.now` and `Clock` are not read.

## Rules, and the mistakes to avoid

- A rule that "passes" only because the code was not read is not a pass: `proved` is false and the report says "not
  read" with the line. Read that line, rewrite it with something from the tables, or compute the value outside
  `decide` and pass it in as a command field (the docs' own advice, `verifiable-code.mdx:112`).
- Keep money and counts in whole numbers (`S.Int` cents or a `bigint`). A `S.Number` or `S.Finite` field that is
  added or multiplied is never proved.
- Build events, rejections and commands in `decide` with `new`, never `.make`: the trial showed a `.make` event is not
  read at all.
- Do not mutate what you are given; build new objects.
- A rule over an input list is at best `Bounded` (two items past the minimum). To prove it for every length, carry a
  count in the state and state the rule over the count.
- Write every invariant inside the definition object. A shared `const invariants = {...}` is refused.
- Keep the files a rule touches reachable by relative imports. A class or helper imported from another workspace
  package is not read (run).
- A proof starts from any state the invariants allow, including states no command reaches. When a counterexample
  starts from an impossible state, add the invariant that rules it out.
- One aggregate name per test file. `Verify.aggregate` finds the aggregate's file from the test's imports by the text
  `Aggregate("<name>"`; two aggregates of one name in one test file made the trial read one file for both.

## In this app

The trial's source is the appendix of [the trial](../04-trial.md); each of the app's ten rules as the trial found
it is on [this app's rules under Verify](../03-this-apps-rules-under-verify.md).

The app's own code has no aggregate yet: nothing in it imports `@alchemy.run/domain`. A trial on 2026-11-19 wrote a
model of the app beside the upstream example on `main@dbfd0ddb` (aggregates `ImportDraft`, `Item`, `Allowance`,
`Organization`; commands without `target`, each aggregate with `keyOf`) and ran `Verify.aggregate` on each aggregate
and `Verify.model` on the model, under Node and Vitest. Each aggregate answered in under two seconds, and the prover
proved all 19 rules "for every state and every input, after any number of commands":

| Aggregate | Proved | App rule |
| --- | --- | --- |
| `ImportDraft` | invariants `OutcomesAddUpToTheRows`, `NoCountIsNegative`; transitions `NothingIsWrittenBeforeConfirm`, `AConfirmOfAClosedImportWritesNothing`, `OnlyAnImportedFileIsTakenBack`, `ATakeBackKeepsWhatWasChanged`, `ASuggestionWritesNothing`, `AnImportNeverChangesOrganization`, `OnlyItsOwnOrganizationChangesAnImport`, `AViewerChangesNothing` (the last two `Effect.fn` transitions that read `CurrentActor`) | 1, 2, 4, 6, 8, 10 |
| `Item` (keyed by organization and SKU key) | `ARevisionStartsAtOne`, `ASecondCreateChangesNothing`, `EveryEditWasMadeOnTheCurrentRevision`, `ATakeBackKeepsAChangedItem`, `ARevisionOnlyGoesUp` | 3, 4, 5 |
| `Allowance` | `NeverMoreThanTheDaysAllowance` | 9 |
| `Organization` (counts of admins and others) | `AlwaysKeepsAnAdmin`, `NobodyIsCountedBelowZero`, `AFoundedOrganizationStaysFounded` | 7 |

A deliberately broken copy (the `evolve` of `RowLeftOut` forgot to lower `ready`) failed with `NotVerified`; the
proof named the rule `OutcomesAddUpToTheRows`, the command `LeaveRowOut`, the state before
(`{ _tag: "Open", rows: 1, ready: 1, waiting: 0, left: 0 }`, among other fields), the events (`RowLeftOut`) and the
state after (`left: 1`), and the search gave the shortest sequence: `StageImport { rows: 1, ready: 1 }`, then
`LeaveRowOut`.

This is the `Item` aggregate the trial ran, as it ran (rule 5 is `EveryEditWasMadeOnTheCurrentRevision`):

```ts
// Run in a trial on 2026-11-19 on main@dbfd0ddb: Verify.aggregate(Item) proved all five rules.
import * as Domain from "@alchemy.run/domain"
import * as S from "effect/Schema"

export const ItemKey = S.String.pipe(S.brand("ItemKey"))
const Count = S.Int.check(S.isGreaterThanOrEqualTo(0))

export class ItemCreated extends Domain.Event("ItemCreated", { confirmId: S.String, quantityOnHand: Count }) {}
export class ItemEdited extends Domain.Event("ItemEdited", { quantityOnHand: Count }) {}
export class ItemRemoved extends Domain.Event("ItemRemoved", {}) {}

export class NoSuchItem extends Domain.Rejection("NoSuchItem", {}) {}
export class EditedSince extends Domain.Rejection("EditedSince", { current: S.Int }) {}

export class CreateFromImport extends Domain.Command("CreateFromImport", {
  input: { itemKey: ItemKey, confirmId: S.String, quantityOnHand: Count },
  events: [ItemCreated],
}) {}
export class EditItem extends Domain.Command("EditItem", {
  input: { itemKey: ItemKey, revision: S.Int, quantityOnHand: Count },
  events: [ItemEdited],
  rejects: [NoSuchItem, EditedSince],
}) {}
export class RemoveIfUnchanged extends Domain.Command("RemoveIfUnchanged", {
  input: { itemKey: ItemKey, confirmId: S.String },
  events: [ItemRemoved],
}) {}

const ItemState = S.Union([
  S.TaggedStruct("Absent", {}),
  S.TaggedStruct("Stored", { createdBy: S.String, quantityOnHand: S.Int, revision: S.Int }),
])

export class Item extends Domain.Aggregate("Item", {
  id: ItemKey,
  state: ItemState,
  initial: { _tag: "Absent" },
  invariants: {
    ARevisionStartsAtOne: (s) => s._tag !== "Stored" || s.revision >= 1,
  },
  transitions: {
    ASecondCreateChangesNothing: ({ before, after, command }) =>
      command._tag !== "CreateFromImport" ||
      before._tag !== "Stored" ||
      (after._tag === "Stored" &&
        after.revision === before.revision &&
        after.quantityOnHand === before.quantityOnHand &&
        after.createdBy === before.createdBy),
    EveryEditWasMadeOnTheCurrentRevision: ({ before, command }) =>
      command._tag !== "EditItem" || (before._tag === "Stored" && command.revision === before.revision),
    ATakeBackKeepsAChangedItem: ({ before, after, command }) =>
      command._tag !== "RemoveIfUnchanged" ||
      before._tag !== "Stored" ||
      before.revision === 1 ||
      after._tag === "Stored",
    ARevisionOnlyGoesUp: ({ before, after }) =>
      before._tag !== "Stored" || after._tag !== "Stored" || after.revision >= before.revision,
  },
  commands: [CreateFromImport, EditItem, RemoveIfUnchanged],
  keyOf: (cmd) => cmd.itemKey,
  decide: {
    CreateFromImport: (s, cmd) =>
      s._tag === "Stored" ? [] : [new ItemCreated({ confirmId: cmd.confirmId, quantityOnHand: cmd.quantityOnHand })],
    EditItem: (s, cmd) =>
      s._tag !== "Stored"
        ? new NoSuchItem({})
        : cmd.revision !== s.revision
          ? new EditedSince({ current: s.revision })
          : [new ItemEdited({ quantityOnHand: cmd.quantityOnHand })],
    RemoveIfUnchanged: (s, cmd) =>
      s._tag === "Stored" && s.revision === 1 && s.createdBy === cmd.confirmId ? [new ItemRemoved({})] : [],
  },
  evolve: {
    ItemCreated: (_, e) => ({
      _tag: "Stored" as const,
      createdBy: e.confirmId,
      quantityOnHand: e.quantityOnHand,
      revision: 1,
    }),
    ItemEdited: (s, e) =>
      s._tag === "Stored" ? { ...s, quantityOnHand: e.quantityOnHand, revision: s.revision + 1 } : s,
    ItemRemoved: () => ({ _tag: "Absent" as const }),
  },
}) {}
```

Every construct here is in the tables: a tagged union, `===`, `+` on an `S.Int`, `new` on events and rejections, an
empty array for "nothing to do". It uses `new` where the app's lint rule `newSchemaClass` wants `.make`; inside a
domain block that rule needs an exception (below). A trial copy with the commands, events and rejections imported
by package name (as a separate contract package would give them) proved nothing: every command was "not read" with
"constructs a class, which is not an event, a rejection or a command".

How the app's rule files read today, against the tables (from source only; none of these files was run through the
prover):

| File | Function | Blocks the prover | Change for a provable rule |
| --- | --- | --- | --- |
| `packages/access/model/src/People/LastAdmin.rules.ts` | `keepsAnAdmin` | Nothing in its own body: `A.findFirst`, `O.isNone`, `.value`, `A.some`, `===` are all read, and its imports are `import type` | It loops over a list of members, so given as a command field or state list it is only `Bounded`. The trial proved `AlwaysKeepsAnAdmin` on an `Organization` that keeps counts of admins and others and refuses the change that takes admins to 0 (`LastAdmin`) |
| `packages/access/model/src/Allowance/Allowance.rules.ts` | `windowStart` | `DateTime.subtract` has no model; `usedUpWords` comes from `@inventory/access-contract` | A rolling 24-hour window needs the list of call times (only `Bounded`). The trial proved `NeverMoreThanTheDaysAllowance` on a count that a `StartNewDay` command resets; a day bucket, `Math.floor(DateTime.toEpochMillis(context.now) / 86_400_000)`, is also read (fixture `Window`). Switching from a rolling window to a day is a product decision for the app's owner |
| `packages/catalog/model/src/Confirm/Confirm.rules.ts` | `confirmPlan` | `A.join` (no model); `R.get(authors, rowId)` with a key from an input; `S.decodeOption(...)(...)`; `changeDecidedBy`, `decidedByPerson` and `decidedByNobody` imported from `@inventory/catalog-contract/*` (a package); the rows are an input list | Keep the plan's computation outside `decide`. Pass the confirm's counts as command fields and prove the sum on the import's state, as the trial's `ImportDraft` does |
| `packages/catalog/model/src/Item/ItemEdit.rules.ts` | `readItemForm` | `Str.trim`, `BigDecimal`, `A.filterMap`, `R.fromEntries`, `O.flatten`, `Result`; `new Intl.NumberFormat` at the top of the file; `maxNameLength` and `maxDescriptionLength` from a package; readers in `CellReading.rules.ts` | Reading the form belongs at the edge. The command's schema carries what the prover can read (`isMaxLength`, `isInt` bounds); the revision rule is the `Item` above |
| `packages/catalog/model/src/Review/Review.rules.ts` | `review` and its helpers | a regular expression's `.test` (line 355), every `Str.*` call, `HashMap`/`HashSet` (lines 530, 1252), imports from `@inventory/catalog-contract/*`, and an input list of rows | See below |

Can the prover reach `review` at all? Only if `decide`, `evolve` or a rule calls it. Called from a handler before the
command is sent (as the app does today), it is never read: the prover sees only the command fields `review` produced,
as any values their schemas allow. Called from `decide`, the prover would follow the relative import and stop at its
first regular expression or `Str` call, so every rule of that command would be "not read". Even rewritten, it walks
the rows of a file, so it could at best be `Bounded`. `review` is checked by stories and tests, not by `Prove` or
`Explore`.

### What this asks of the app's code

- **`new` inside domain blocks.** Events, rejections and commands built in `decide` (and anything `decide` calls) use
  `new`. The app's Effect diagnostic `newSchemaClass` reports every `new`, so domain block files need an exception to
  it: `// @effect-diagnostics newSchemaClass:off` as the file's first line. That form was run in the trial on beta.87:
  with every block built with `new`, the type-check with the app's flags and diagnostics passed, the program ran and
  the stories passed. Elsewhere `.make` stays the rule.
- **Blocks and rule helpers reachable by relative imports.** An aggregate's commands, events, rejections and every
  helper its `decide`, `evolve`, invariants or transitions call must be imported by a path that starts with `.`
  (`Source.ts:229`). The app's split of each context into a `contract` package and a `model` package does not work
  for these blocks while the prover does not follow package imports: they belong in one package, imported
  relatively, unless upstream changes the loader.
- **Rules written with what the prover reads.** Plain comparisons and whole-number arithmetic, tagged unions built as
  object literals with `_tag`, `Option`, `effect/Array`, `effect/Record`, `effect/Struct`, and `effect/Match` (since
  #3503). Not `HashMap`, `HashSet` (or `Map`, `Set`), `effect/String`, `Data.taggedEnum`, `BigDecimal`, regular
  expressions or string methods. The house rules that require those apply outside domain blocks only.
- **One aggregate name per test file**, as in the rules above.

- **Used today:** no. Rules are enforced by guarded D1 batches behind ports (`packages/catalog/host/src/ImportStore.adapter.ts`) and tested in `packages/*/*/test`.
- **Where it goes:** a test beside each aggregate, for example `packages/catalog/model/test/Item.verify.test.ts`, beside the revision checks now in `ItemStore.edit`'s tests (the D1 tests stay for what SQL decides).
- **What the person gets:** nothing they can see; a stale edit is refused for a reason that is proved, not sampled.

## How to check it

`Prove.invariants(Item, { source })` in a Vitest test on Node: it succeeds with the `Report`, or fails with
`InvariantsNotProved` whose message lists each rule, the commands it was proved for, and for each failure the
counterexample rows `state`, `command`, any request context, `now`, `events`, `after` (`Prove.ts:319-341`), or the
file and line that was not read. To see a report without failing, `yield* Prove.report(...)` and render it with
`Prove.render(report)`. Under `it.effect` the console is Effect's test console (`@effect/vitest` 4.1.4, the version the app
installs, `src/internal/internal.ts:68`, `:490`), so a report printed with `Console` does not
reach Vitest's output; the trial wrote the rendered report to a file instead. The trial called `Verify.aggregate`,
which runs `Prove.report` and then `Explore.report` (`Verify.ts:584-589`); `Prove.invariants` on its own was not run.
To pin a rule as proved inside a larger check, use `Verify`'s `require: { proved: [...] }` (see [verify](./verify.md)).

## What it needs

- `@alchemy.run/domain` from `main@dbfd0ddb` (pull request 3260, commit `e4adb720c`); not in `2.0.0-beta.87`, not on
  npm.
- Node: `z3-solver` 5.3.3 is WebAssembly and its start-up error says it "runs under Node, not Bun"
  (`Smt.ts:222`); both it and `oxc-parser` 0.141.0 load only when a proof runs (`Prove.ts:1-9`, `Source.ts:109-116`,
  `Smt.ts:215-218`). The trial ran under Node 24.22.1 and Vitest 5.0.4; it did not run under Bun.
- `FileSystem` and `Path` services (`@effect/platform-node/NodeServices`).
- The source file on disk: the loader also imports the module (`Source.ts:178-181`), so the file must load under the
  test runner.
- No host: the proof runs on no platform. It assumes a decision commits on every instance or none (`ATOMIC`).

## Verdict

**Use, from main:** prove each aggregate's invariants and transitions with `Verify.aggregate` (or `Prove.invariants`)
in a Vitest test on Node, as the trial did for 19 of this app's rules on `main@dbfd0ddb`. Taking it needs the library
from main (it is not on npm), the domain blocks written with only what the prover reads, built with `new` and reached
by relative imports, and an exception to `newSchemaClass` for those files.

## Where this was read

- The live site has no page for this (it documents beta.87; `https://alchemy.run/domain/verifiable-code` returns 404).
- `packages/domain/src/Prove.ts` at `v2.0.0-beta.87`: absent; on `main@dbfd0ddb`: new
- `packages/domain/src/Prove/internal/{Check,Decide,Induction,Interpreter,Library,Paths,Relations,Smt,Source,Symbolic,Value}.ts`: new on `main@dbfd0ddb`
- `packages/domain/src/Aggregate.ts`: changed (`invariants`, `transitions` at 151-171)
- `packages/domain/package.json`: changed; `pnpm-workspace.yaml`: `oxc-parser` 0.141.0, `z3-solver` 5.3.3
- `website/src/content/docs/domain/verifiable-code.mdx`, `verifying-models.mdx`: new on `main@dbfd0ddb`
- `examples/cloudflare-domain/packages/domain/test/{Syntax,Guards,Transitions,Relation,Consumer,Bank.prove}.test.ts` and their fixtures: new on `main@dbfd0ddb`
- Pull requests 3260, 3503, 3504 in `alchemy-run/alchemy`
- `@effect/vitest` 4.1.4 (the app's installed copy): `src/internal/internal.ts` (the test console under `it.effect`)
- A trial on 2026-11-19: a model of this app run with `Verify.aggregate` and `Verify.model` on `main@dbfd0ddb`
