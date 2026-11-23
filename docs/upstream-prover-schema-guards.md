---
type: Upstream Note
title: "For the authors of @alchemy.run/domain: let the prover read a schema's own guards"
description: The text of a report to send upstream with the repository's third patch to the prover. What the prover does not read today, what the patch makes it read and how exactly, what it still does not read, and how the patch was tested.
tags: [tooling, dependencies, patches, verify]
---

# For the authors of `@alchemy.run/domain`: let the prover read a schema's own guards

Benjamin sends this. It goes with `packages/patches/alchemy-domain/03-a-schemas-own-guards.patch`, a diff against
commit `734c27a` of the library (`lib/Prove/internal/{Interpreter,Library,Symbolic}.js` and the same three files
under `src/`). Its header's `Upstream` line takes the address of the report once it is sent.

## What happens today

A model written the way Effect Schema suggests cannot be proved. A state that is a tagged union already has its
guards:

```ts
export const TicketState = S.Union([
  S.Struct({ status: S.Literal("New") }),
  S.Struct({ status: S.Literal("Open"), title: S.String.check(S.isMaxLength(20)) })
]).pipe(S.toTaggedUnion("status"))

// in a decide
if (!TicketState.guards.New(ticket)) return new NotNow({})
```

`Prove.report` answers "calls TicketState.guards.New, which is outside the code the prover reads", and the same for
`isAnyOf`, `match`, `matchOrElse`, `Schema.is(X)` and `constTrue`/`constFalse`. Of
`effect/Function` only `pipe` has a model. The way round is to tell every case a second time with `effect/Match`
beside the schema (`Match.value(s).pipe(Match.discriminatorsExhaustive("status")({ New: yes, Open: no }))`, with
`yes` and `no` as local functions, since `constTrue` is not read either). Our model carried that copy in eight files.

## What the patch adds

Each function is read as the library writes it.

| Function | Read as |
| --- | --- |
| `Union.guards.K(value)` | `Schema.is` of the case's schema: the whole case, every field and every check, not the tag alone |
| `Union.isAnyOf(keys)(value)` | `keys.includes(value[tag])`: the tag alone, as the library does |
| `Union.match(value, cases)`, `Union.match(cases)(value)` | the handler of the value's tag; a value none of the cases takes is "not read" (the library throws) |
| `Union.matchOrElse(value, cases, orElse)` and its data-last form | the same, with `orElse` for a tag no case names |
| `Schema.is(schema)(value)` | exactly what the schema allows, as below |
| `constTrue`, `constFalse` | `true`, `false` |

**Exactly, or not at all.** `Symbolic.fits` answers `true` for what it does not read, which is right for an
assumption and wrong for a guard. So the patch adds `Symbolic.decides(value, ast, run)`: `"true"`, `"false"` or a
formula of the inputs where the schema's answer is known, and `undefined` where it is not, which the interpreter
reports as "not read". It is `undefined` for a check the prover does not read (a pattern, a filter written by hand),
an index signature, a kind of schema it has no model for, a value it cannot see into, a number that is not finite,
and a quotient. A value of the wrong shape is refused whatever an unread check would say. A check this path already
assumes of an input (the state and the command are assumed to fit their schemas) adds no condition, so a guard asked
of the state costs no path: our five proofs kept the path counts their tests state.

**A domain class is told by identity, then by name.** `Schema.is(Opened)(event)` and a union's guard of a command or
an event class are instance checks. The prover holds the class each value was made from, so it compares classes. One
thing needed care: the source file is loaded once by whoever calls `Prove.report` and once more by the prover
(`Source.ts`, `import(url.href)`), so the command the prover makes from the definition and the class a guard names
can be two objects for one class. Two classes with the same kind, name and field names are read as one; the same
kind and name with other fields is "not read". You will know whether a better identity is at hand.

**A union the prover can see.** A top-level `const` that evaluates to a schema is taken from the module's exports, as
today, so a union whose guards a block calls has to be exported. `Schema.is(S.NonEmptyString)` written inline is "not
read" for the same reason; `Schema.is(Name)` with `export const Name = …` is read.

## What it still does not read

- **Patterns.** `S.isPattern` stays an unread check. A guard or `Schema.is` asked of a schema with one is "not read",
  and a rule cannot be proved from a pattern on the state. Reading a regular expression as a formula of the solver's
  string theory would be a patch of its own.
- **`Schema.is` of a schema the file does not export**, and a tagged union passed as a value rather than named.
- **Tuples with optional elements, more than one rest element, records.**
- **`Predicate.isTagged`.** It has no model, before or after: this repository refuses it in its own code (it takes any
  value, so a misspelled tag compiles), and a model nothing here may call could not be tested here. `Schema.is` of
  the class, or the union's guard, says the same.

## How it was tested

- `packages/patches/test/alchemy-domain/03-a-schemas-own-guards/`: a ticket (new, open, closed) whose every case is
  told by these functions. For each function one rule holds and is proved, and one is broken on purpose and comes back
  with the state and the command that break it. A second aggregate asks `Schema.is` of a pattern and has to come back
  "not read". The test also asserts "Agreed with the real code" on all nine paths.
- **19 mutants of the patch itself** (`mutants.json` there): each is one wrong reading made in a copy of the
  installed package, such as a guard that compares the tag alone, `isAnyOf` that reads only its first case, an unread
  check answered as if there were none, a missing field allowed, `constTrue` read as no, a class loaded twice read as
  another class. The test fails on every one.
- **The model it was written for**: three aggregates and four decisions moved from `effect/Match` copies to their
  schemas' guards. Every proof passes with the same number of paths as before, and Verify's search and its run of the
  real model agree on 171 paths.

One wrong model was found on the way, by the prover's own comparison with the real code and not by reading: the class
loaded twice, above. That comparison is worth keeping on for any model added this way.
