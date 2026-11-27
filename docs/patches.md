---
type: Tooling Guide
title: Patching a dependency
description: When the repository patches a dependency and how: one file a defect, a header that says what it applies to and when it goes, a test of its own that fails without it, the three checks that hold all of it, and what a re-pin and a dependency update do with a patch.
tags: [tooling, dependencies, patches]
---

# Patching a dependency

A patch is a change of ours to a package somebody else publishes, applied by bun at every install. It is kept for as
long as the defect it fixes is in the version we install, and no longer.

## When a patch is the answer

A patch is for **a defect the repository works around or is exposed to today**, whose fix is small and whose cause is
known. It is not for:

- a behaviour we would have designed differently: that is a question for the library's authors;
- a fix that is already an open pull request of some size upstream: wait for the merge and move the version;
- a defect nothing here meets: report it, and leave the package as it is.

Report the defect upstream as well. A patch here does not replace the report, and its header says where the report
is.

One patch is of another kind, by Benjamin's decision (2026-11-22: "Teach the prover"): `03-a-schemas-own-guards`
began as a patch that fixed no wrong answer. On the first pin the prover of `@alchemy.run/domain` read a case told with
`effect/Match` and nothing a schema gives for the same question, so the review's model told every case twice; and it
knew an event or a rejection by `new` alone (2026-11-22: "Teach the prover .make"). Since the pin at `e1c3e6d` the
library reads `.make`, `constTrue`, `constFalse` and a tagged union's `guards`, `isAnyOf`, `match` and `matchOrElse`
itself, so the patch is smaller and now also fixes wrong answers: it adds `Schema.is`, which the library still does not
read, and makes a guard exact, where the library answers yes for a check it does not read and finds no case for a union
told by a number. Its rules are in "A patch that teaches the prover", below, and the text to send the library's authors
is [the note on it](upstream-prover-schema-guards.md).

## Where patches live

Everything is in one workspace, `packages/patches` (`@inventory/patches`):

```
packages/patches/
  alchemy-domain/                              one folder for each patched package
    01-computed-instance-id.patch              one file for each defect: a header, then the diff
    03-a-schemas-own-guards.patch
    04-a-rule-by-its-name.patch
    05-a-structs-defaults.patch
  alchemy-domain.patch                         what bun reads: built from the folder, never edited
  test/alchemy-domain/
    01-computed-instance-id/                   each patch's test, and the small code it runs
    03-a-schemas-own-guards/                   with `mutants.json`: the wrong readings its test must notice
  mutants/run.py                               runs them (below)
```

- **One patch, one defect.** bun takes one patch file for a package, so that file is the folder's files one after
  another, in the order of their names. The two digits in a name are that order: a later patch is a diff of the
  package with the earlier ones applied. `bun run beep patches build` writes the file.
- **The root's `package.json`** names the file under `patchedDependencies`, by the package and its resolution:
  `"@alchemy.run/domain@vendor/alchemy/alchemy.run-domain-e1c3e6d.tgz": "packages/patches/alchemy-domain.patch"`.
- **The workspace depends on each patched package**, so the tests run in `bun run check` like any package's.

## The header

The first lines of every patch file, above its first `diff --git`. A line that starts with a space continues the
field above it.

| Field | What it says |
| --- | --- |
| `Package` | The dependency's name |
| `Applies-to` | Its resolution, as `bun.lock` writes it after the `@`: an exact version for a package from a registry (`4.1.5`), the kept file for a package kept as a file (`vendor/alchemy/alchemy.run-domain-e1c3e6d.tgz`, whose name carries the commit) |
| `Upstream` | The address of the issue or pull request, whole (`https://`, a host and a path), or `not yet reported` |
| `Why` | What goes wrong without it, for us |
| `Remove-when` | What has to be true for the patch to be dropped |
| `Test` | The test that fails without it, from `packages/patches`: its own, named by no other patch |

The repository is public: a header names nothing private, no working note and no folder outside the repository.

## The test

Every patch has a test of its own that **passes with the patch and fails without it**. It is as small as the
defect: a few lines of code that meet it, and what the fixed package answers. The comment at its top says what the
unpatched package does instead. It tests what this patch alone fixes, and no two patches name the same test.

`bun run check` runs it twice. The workspace's own `test` runs it on what is installed. `bun run beep patches prove`
copies it beside the package **with that one patch left out and every other patch of the package applied**, where
node finds that copy first, and there it has to fail with a failed test: a file that does not load shows nothing.
Leaving out all of a package's patches at once would show nothing about any one of them.

A later patch that changes the same lines does not apply without the one it was written on. It is then left out
too, and the test is run once more with only that later patch out, where it has to pass: the failure is then this
patch's, not the later one's. The line the proof prints says when it did this.

## A patch that teaches the prover

A patch that adds a model of a library's function to the prover is right only if the model is the function: a guard
read as "the tag matches" where the library checks the whole case would prove rules the real code breaks. So such a
patch is held to more than its test passing:

- **It answers exactly or not at all.** Where the prover cannot say what the function answers (a schema with a check
  it does not read, such as a pattern; a value it cannot see into), the model says so ("not supported", the library's
  word for code it does not read) and the rule is not proved. It never answers yes for what it did not read. The test has a case for that.
- **Its test has, for each function, one rule that holds and one broken on purpose.** A model that always said yes
  would lose the second, one that always said no would lose the first.
- **Its wrong readings are written down and run.** `mutants.json` beside the test lists them, each one text replaced
  in one file of the installed package: a guard that reads the tag alone, `isAnyOf` that reads only its first case, a
  check ignored, a missing field allowed. `bun run --cwd packages/patches mutants` copies the installed package for
  each, makes the change in the copy and runs the test there, where it has to fail. A mutant the test lets through is
  a wrong model the test cannot tell from the right one: add the rule that tells them apart. Run it after any change
  to such a patch or its test (31 mutants of two patches, about a minute; needs python3). It is not part of `bun run check`.
- **The prover's own second opinion stays on.** A proof ends by running the real code on inputs picked for each path
  and comparing ("Agreed with the real code"): the test asserts that line, and it is what caught the one wrong model
  this patch had while it was written (a class the prover loads a second time, read as another class).

Where the third patch cannot answer as the library does, it says "not supported": a check on a union, a struct or a literal
(it applies a check to a text, a number and a list only), a union told by a number, a literal asked of a division, a
struct asked of a list. Two aggregates beside the ticket hold that (`Unread.aggregate.ts`, each guard "not supported") and
what it does answer exactly (`Exact.aggregate.ts`: a class told by its name, a whole number within 2^53 - 1, a key
that must be written, `Schema.Void`).

What the third patch does not do: it reads no pattern. A text held to a pattern (`S.isPattern`) is still a check the
prover does not read, so a rule cannot be proved from it, and a guard asked of such a schema is "not supported".

`05-a-structs-defaults` is of the same kind (Benjamin, 2026-11-27: "Yes, both patches"). The prover read
`State.make({...})` of a struct as the fields written; the library's `make` also gives each field left out its
constructor default. The patch reads a default that is a number, a text, a truth or `null` already there
(`Effect.succeed(0)`, the tag of `Schema.tag`), in a struct held inside one too, and says "not supported" of any
other: one worked out when asked for (`Effect.suspend`, `Effect.sync`), a list, an `Option`. It reads no default of an
event's, a rejection's or a command's own class, which the prover builds another way. `Meter.aggregate.ts` beside its
test holds what it answers, `Clocked.aggregate.ts` and `Listed.aggregate.ts` what it refuses.

`04-a-rule-by-its-name` teaches the prover nothing: it changes what a lock keeps for a rule an aggregate lists by
name, from the name to the rule's text where it is declared.

## Making a patch

For `@alchemy.run/domain`, whose folder is `alchemy-domain`:

```bash
bun patch @alchemy.run/domain
```

bun makes the installed copy safe to edit (it holds the patches there are). Do not run the `--commit` it suggests.

```bash
git init -q node_modules/@alchemy.run/domain && git -C node_modules/@alchemy.run/domain add -A
```

Edit the package there. Change what runs (`lib/*.js`) and the source shipped beside it (`src/*.ts`), and
`lib/*.d.ts` when a type changes. Write the test under `packages/patches/test/alchemy-domain/03-what-it-fixes/` and
run it until it passes:

```bash
bun run --cwd packages/patches test
```

Then keep the change as a patch, and let bun install it from there:

```bash
git -C node_modules/@alchemy.run/domain diff > packages/patches/alchemy-domain/03-what-it-fixes.patch
```

```bash
rm -rf node_modules/@alchemy.run/domain/.git
```

Write the header above the diff, then:

```bash
bun run beep patches build
```

```bash
bun install
```

```bash
bun run beep patches check && bun run beep patches prove
```

A package's first patch also needs its line in the root's `patchedDependencies` (`patches check` prints the line to
add) and the package among the dependencies of `packages/patches/package.json`.

To give up on an edit instead: `rm -rf node_modules/@alchemy.run/domain && bun install`.

## What the checks refuse

`bun run beep patches check` (`patches:check` in `bun run check`; it reads `node_modules`, so turbo never replays it):

| Refused | Why |
| --- | --- |
| A patch with no header, or a field missing or empty | Nobody can tell what it is for or when it goes |
| `Upstream` that is neither a whole address nor `not yet reported` | The report cannot be found. `https://` alone names none |
| A patch whose test is not there, or is another patch's | Nothing shows it is needed: what fails without one patch shows nothing about another |
| An `Applies-to` that `bun.lock` does not hold | A patch for a version that is no longer installed. bun warns once and installs the package unpatched |
| A patch that does not apply to the kept file it names | Applied to the unpacked file, in order, with no install. For a package from a registry, `bun install` is what refuses it, with exit 1 |
| The file bun reads differing from the folder's files | bun would apply something else |
| No line in `patchedDependencies` for it, a line for another resolution, or a patch file with no folder | bun applies only what is registered |
| An installed package that does not hold what the patches write | The install is behind: `bun install` |
| A task in a `turbo.json` that does not wait for `//#patches:installed` | It could run on an install that is behind (below) |

`bun run beep patches prove` (`patches:prove` in `bun run check`) refuses a patch whose test passes, or does not run,
beside the package with that one patch left out, and a test that fails for a later patch's sake.

### Nothing runs on an install that is behind

`bun run beep patches installed` (`patches:installed`) asks one thing: does `node_modules` hold what every file
named in `patchedDependencies` writes? It reads no header, takes under a second and is never replayed.

Every task that runs or type-checks code waits for it in `turbo.json`, whichever script started the task
(`bun run test` and `bun run proofs` as well as the checks), and when it fails none of them runs. The reason is the
cache. turbo takes the patch files into every task's hash and reads nothing of `node_modules`. A test run after
`bun run beep patches build` and before `bun install` would run on the package as it was, pass, and be stored under
the new patch's hash; after the install turbo would replay it, and the test would never have run with the patch.

A task that waits takes the root's `package.json` into its hash, since that file says which file bun applies to
which package. So an edit to the root's `package.json` runs every task again.

## When a patched dependency moves

**A package kept as a file** (`vendor/alchemy`). `bun run alchemy:repin -- <commit>` gives it another file, whose
name carries the new commit, so every patch made for the old file would be for something nothing installs. The
re-pin therefore:

1. tries each patch on the new file, in order. One that does not apply stops the move and is named, and every file
   goes back as it was;
2. carries the patches that apply: each header's `Applies-to`, the file bun reads and the line in
   `patchedDependencies` name the new file;
3. after the install, runs `patches check` and `patches prove`. A patch whose test now passes without it stops the
   move too: the library fixed the defect.

After a stop, on the old pin: re-make the patch for the new code, or drop it, and move the pin again.

**A package from a registry.** `bun run deps:update` stops before it moves anything when a patched package has a
newer version, and names the folder of its patches. It stops the same way on a folder whose headers do not say
which package and version its patches are for, since that package could be one that moves. Move that one package by hand: its version in the `package.json`
files, each patch's `Applies-to`, and the line in `patchedDependencies`, all to the new version. Then
`bun run beep patches build` and `bun install`, which fails on a patch that no longer applies: re-make that patch or
drop it. Once `bun run check` passes, run `bun run deps:update` again.

## Dropping a patch

When its `Remove-when` is true, or `patches prove` says its test passes without it:

1. delete the patch file and its test folder. A later patch of the same package that changes the same file is a
   diff on top of it: re-make that one (`patches prove` names such a patch on the earlier one's line);
2. `bun run beep patches build`, or, when it was the package's last patch, delete the file bun reads, the line in
   `patchedDependencies` and the package from `packages/patches/package.json`;
3. `bun install`, then `bun run check`.

## Why bun's patches, and not the kept file rebuilt

Both were tried for the packages kept as files. bun applies a patch on top of a kept file from a clean install with
a frozen lockfile, refreshes the installed package when a patch's content changes, and fails the install on a patch
that no longer applies. Rebuilding the kept file with the fix inside also installs, but the fix is then inside an
archive nobody can read in a diff, re-making it needs the registry's own bytes, which the library's registry deletes
a week after its `main` moves on, and a package from npm would need bun's patches anyway.

The one thing bun does not do is fail on a patch whose package has moved to another resolution: it warns and
installs the package unpatched. That is what `patches check`, `patches installed`, the re-pin's step and the stop in
`deps:update` are for.

The layout follows beep-effect's (`patches/`, bun's `patchedDependencies`, a regression test for each patch that
must fail on the unpatched package before the patch is retired). What differs: there a patch has no header and its
reason is in a runbook, one file holds every fix to a package, and "is it still needed" is asked by hand at each
update. Here the header is in the patch, a file is one defect, and the checks ask.
