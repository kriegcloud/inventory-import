---
type: Upstream Note
title: "For the authors of @alchemy.run/domain: let the prover read a schema's own guards"
description: The text of a report to send upstream with the repository's third patch to the prover. What the prover does not read today, what the patch makes it read and how exactly, what it still does not read, and how the patch was tested.
tags: [tooling, dependencies, patches, verify]
---

# For the authors of `@alchemy.run/domain`: let the prover read a schema's own guards

Benjamin sends this. It goes with `packages/patches/alchemy-domain/03-a-schemas-own-guards.patch`, a diff against
commit `e1c3e6d` of the library (`lib/Prove/internal/{Library,Symbolic}.js`, `lib/Prove/internal/Symbolic.d.ts` and
the same two files under `src/`). Its header's `Upstream` line takes the address of the report once it is sent.

## What happens today

Since `e1c3e6d` the prover reads a tagged union's `guards`, `isAnyOf`, `match` and `matchOrElse`, `constTrue` and
`constFalse`, and `X.make(...)` of an event or a rejection. Thank you: the first version of this patch added all of
them. Two things are still missing, and one of them proves rules the real code breaks.

- **`Schema.is` is not read.** A `decide` or an `evolve` that asks `Schema.is(Name)(cmd.by)` or
  `Schema.is(Opened)(event)` ends its proof with "calls a schema, which the prover does not model".
- **A guard answers yes for what the prover does not read.** `Union.guards.K(value)` asks `Symbolic.fits`, which is
  `true` wherever the prover does not read the case's schema: a pattern, a check on a union, a struct or a literal. A
  rule that rests on such a guard is then proved where the real guard can say no. And `match` and `matchOrElse` on a
  union told by a number find no case, where the library finds the case under the number's text.

```ts
export const TicketState = S.Union([
  S.Struct({ status: S.Literal("New") }),
  S.Struct({ status: S.Literal("Open"), title: S.String.check(S.isMaxLength(20)) })
]).pipe(S.toTaggedUnion("status"))

// in a decide: read today, but answered from `fits`
if (!TicketState.guards.New(ticket)) return NotNow.make({})
// in a decide: not read today
if (!S.is(Name)(cmd.by)) return NotNow.make({})
```

## What the patch adds

| Function | Read as |
| --- | --- |
| `Schema.is(schema)(value)` | exactly what the schema allows, as below |
| `Schema.is(X)(value)` of an event, a rejection or a command class | an instance check: the class each value was made from, then its name |
| `Union.guards.K(value)` | `Schema.is` of the case's schema: the whole case, every field and every check, not the tag alone |
| `Union.match`, `Union.matchOrElse` on a tag that is not text | "not supported": the library finds a case under the text the tag turns into |

`isAnyOf`, `match` and `matchOrElse` on a text tag, `constTrue`, `constFalse` and `X.make` stay as the library reads
them.

**Exactly, or not at all.** `Symbolic.fits` answers `true` for what it does not read, which is right for an
assumption and wrong for a guard. So the patch adds `Symbolic.decides(value, ast, run)`: `"true"`, `"false"` or a
formula of the inputs where the schema's answer is known, and `undefined` where it is not, which the interpreter
reports as "not supported". It is `undefined` for a check the prover does not read (a pattern, a filter written by hand),
an index signature, a kind of schema it has no model for, a value it cannot see into, a number that is not finite,
and a quotient. It is `undefined` too for a check on a kind of schema whose checks it does not apply (it applies them
to a text, a number, a bigint and a list; a check on a union, a struct or a literal is never passed over as if it
held), for a literal asked of a division, and for a struct asked of a list or a moment. A value of the wrong shape is
refused whatever an unread check would say. A check this path already
assumes of an input (the state and the command are assumed to fit their schemas) adds no condition, so a guard asked
of the state costs no path: the path counts our five proofs state moved only with the library (its own pruning since `e1c3e6d`), never with the patch.

**As the library answers, in four places that are easy to get wrong.** `Schema.isInt` is `Number.isSafeInteger`: a
number written out past 2^53 - 1 is refused, and a number of the inputs is whole only within those bounds.
`Schema.is(Schema.Void)` allows every value. A struct refuses `null` and `undefined`, and one with no key allows
everything else. A key that may be `undefined` and may not be left out must still be written. A tagged union's `match`
finds a handler under the text its tag turns into, so the prover reads a tag that is text and says "not supported" of any
other.

**A domain class is told by identity, then by name.** `Schema.is(Opened)(event)` and a union's guard of a command or
an event class are instance checks. The prover holds the class each value was made from, so it compares classes. One
thing needed care: the source file is loaded once by whoever calls `Prove.report` and once more by the prover
(`Source.ts`, `import(url.href)`), so the command the prover makes from the definition and the class a guard names
can be two objects for one class. So two classes with the same name are read as one, which is what the library's own
guard does: it passes any value that carries the class's identifier, and the identifier of an event or a rejection is
its name. A rejection named as an event passes that event's guard, in the real code and in the prover.

**A union the prover can see.** A top-level `const` that evaluates to a schema is taken from the module's exports, as
today, so a union whose guards a block calls has to be exported. `Schema.is(S.NonEmptyString)` written inline is "not
read" for the same reason; `Schema.is(Name)` with `export const Name = …` is read.

## What it still does not read

- **Patterns.** `S.isPattern` stays an unread check. A guard or `Schema.is` asked of a schema with one is "not supported",
  and a rule cannot be proved from a pattern on the state. Reading a regular expression as a formula of the solver's
  string theory would be a patch of its own.
- **`Schema.is` of a schema the file does not export**, and a tagged union passed as a value rather than named.
- **Tuples with optional elements, more than one rest element, records.**
- **A check on a union, a struct or a literal**, a union told by a number or a boolean, a literal asked of a division,
  a struct asked of a list: each "not supported", as above.
- **`match` after `isAnyOf` of several cases.** On the side where `isAnyOf` said no, a `match` that names only the
  other cases is "not supported" where it could be left out as a path that cannot happen. It costs a proof, never a wrong
  one.
- **A schema named by a bare alias** (`const Whatever = S.Void`): "a schema the prover cannot see". Annotated, it is
  read.
- **`Predicate.isTagged`.** It has no model, before or after: this repository refuses it in its own code (it takes any
  value, so a misspelled tag compiles), and a model nothing here may call could not be tested here. `Schema.is` of
  the class, or the union's guard, says the same.

## How it was tested

- `packages/patches/test/alchemy-domain/03-a-schemas-own-guards/`: a ticket (new, open, closed) whose every case is
  told by these functions. For each function one rule holds and is proved, and one is broken on purpose and comes back
  with the state and the command that break it. A second aggregate asks `Schema.is` of a pattern and has to come back
  "not supported". The test also asserts "Agreed with the real code" on all nine paths. Every event and rejection in the
  folder is built with `make`.
- **Two aggregates for what an adversarial reading of the patch found** (below): `Exact.aggregate.ts`, whose rules
  are proved or broken exactly as the real code keeps or breaks them, and `Unread.aggregate.ts`, each of whose five
  guards has to come back "not supported".
- **26 mutants** (`mutants.json` there): each is one wrong reading made in a copy of the installed package, such as a
  guard that compares the tag alone, `isAnyOf` that reads only its first case, an unread check answered as if there
  were none, a missing field allowed, a class told by its kind only, and one for each fault in the table below. Three
  of the first version's (`constTrue` read as no, `constFalse` as yes, `make` not read as `new`) went when the library
  took those over: they mutate its code, not the patch's. The test fails on every one.
- **The model it was written for**: three aggregates and four decisions moved from `effect/Match` copies to their
  schemas' guards. Every proof passes, and Verify proves every rule its lock keeps.

One wrong model was found on the way, by the prover's own comparison with the real code and not by reading: the class
loaded twice, above. That comparison is worth keeping on for any model added this way.

## What a second reading found

The first version of the patch was then read against the library's source with one aim, to make it prove a rule the
real code breaks. It could, in these ways. Each is fixed in the patch as it stands, and held by a command of one of
the two aggregates above and a mutant that puts the fault back.

| The patch once read | The library | Held by |
| --- | --- | --- |
| A class guard as kind, name and field names: a rejection named as an event refused | Any value carrying the class's identifier, which is its name | `Exact`, `AskName`; mutant `class-told-by-kind` |
| `isInt` of a number written out past 2^53 - 1 as yes | `Number.isSafeInteger` | `Exact`, `AskWhole`; `whole-of-any-size` |
| `isInt` of a number of the inputs as "whole", of any size | the same | `Exact`, `AskWhole`; `whole-input-of-any-size` |
| `Schema.Void` as `undefined` alone | every value | `Exact`, `AskVoid`; `void-is-undefined` |
| A key that may be `undefined`, left out, as allowed | refused: the key must be written | `Exact`, `AskPair`; `unwritten-key-as-undefined` |
| A check on a union, a struct or a literal as if it held | the check is run | `Unread`, `AskUnion`; `check-on-a-union-dropped` |
| `match` on a union told by a number, for a written number only | the handler under the number's text, for every number | `Unread`, `AskSize`; `match-on-a-number-tag` |
| A literal asked of a division, from the exact quotient | JavaScript's rounded quotient | `Unread`, `AskShare`; `literal-of-a-quotient` |
| A struct with no key as refusing a list | allowed: everything but `null` and `undefined` | `Unread`, `AskList`; `keyless-struct-refuses` |

`isAnyOf` given cases that are numbers was "not supported" before and is still (`Unread`, `AskEither`).

Three more are the prover's own, there before the patch and not changed by it:

- **The length of a text** is counted in code points by the solver (`str.len`) and in UTF-16 units by JavaScript, in a
  `maxLength` check and in `.length` alike: a text with a character outside the basic plane is one longer in the real
  code than in a proof.
- **A character past U+2FFFF** in a text the prover writes out for the solver.
- **Whole numbers are taken to stay within ±2^53**, which the report states under "Assuming". A whole number of the
  inputs worked on (`n + 1`) and then asked `isInt` is answered under that assumption.
