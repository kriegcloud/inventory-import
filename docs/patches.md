---
type: Tooling Guide
title: Patching a dependency
description: When the repository patches a dependency and how: one file a defect, a header that says what it applies to and when it goes, a test that fails without it, the two checks that hold all of it, and what a re-pin and a dependency update do with a patch.
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

## Where patches live

Everything is in one workspace, `packages/patches` (`@inventory/patches`):

```
packages/patches/
  alchemy-domain/                              one folder for each patched package
    01-computed-instance-id.patch              one file for each defect: a header, then the diff
    02-text-length-in-a-template.patch
  alchemy-domain.patch                         what bun reads: built from the folder, never edited
  test/alchemy-domain/
    01-computed-instance-id/                   each patch's test, and the small code it runs
    02-text-length-in-a-template/
```

- **One patch, one defect.** bun takes one patch file for a package, so that file is the folder's files one after
  another, in the order of their names. The two digits in a name are that order: a later patch is a diff of the
  package with the earlier ones applied. `bun run beep patches build` writes the file.
- **The root's `package.json`** names the file under `patchedDependencies`, by the package and its resolution:
  `"@alchemy.run/domain@vendor/alchemy/alchemy.run-domain-734c27a.tgz": "packages/patches/alchemy-domain.patch"`.
- **The workspace depends on each patched package**, so the tests run in `bun run check` like any package's.

## The header

The first lines of every patch file, above its first `diff --git`. A line that starts with a space continues the
field above it.

| Field | What it says |
| --- | --- |
| `Package` | The dependency's name |
| `Applies-to` | Its resolution, as `bun.lock` writes it after the `@`: an exact version for a package from a registry (`4.1.5`), the kept file for a package kept as a file (`vendor/alchemy/alchemy.run-domain-734c27a.tgz`, whose name carries the commit) |
| `Upstream` | The address of the issue or pull request, or `not yet reported` |
| `Why` | What goes wrong without it, for us |
| `Remove-when` | What has to be true for the patch to be dropped |
| `Test` | The test that fails without it, from `packages/patches` |

The repository is public: a header names nothing private, no working note and no folder outside the repository.

## The test

Every patch has a test that **passes with the patch and fails without it**. It is as small as the defect: a few lines
of code that meet it, and what the fixed package answers. The comment at its top says what the unpatched package
does instead.

`bun run check` runs it twice. The workspace's own `test` runs it on what is installed. `bun run beep patches prove`
copies it beside the package without its patches, where node finds that copy first, and there it has to fail with a
failed test: a file that does not load shows nothing.

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
| `Upstream` that is neither an address nor `not yet reported` | The report cannot be found |
| A patch whose test is not there | Nothing shows it is needed |
| An `Applies-to` that `bun.lock` does not hold | A patch for a version that is no longer installed. bun warns once and installs the package unpatched |
| A patch that does not apply to the kept file it names | Applied to the unpacked file, in order, with no install. For a package from a registry, `bun install` is what refuses it, with exit 1 |
| The file bun reads differing from the folder's files | bun would apply something else |
| No line in `patchedDependencies` for it, a line for another resolution, or a patch file with no folder | bun applies only what is registered |
| An installed package that does not hold what the patches write | The install is behind: `bun install` |

`bun run beep patches prove` (`patches:prove` in `bun run check`) refuses a patch whose test passes, or does not run,
beside the package without its patches.

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
newer version, and names the folder of its patches. Move that one package by hand: its version in the `package.json`
files, each patch's `Applies-to`, and the line in `patchedDependencies`, all to the new version. Then
`bun run beep patches build` and `bun install`, which fails on a patch that no longer applies: re-make that patch or
drop it. Once `bun run check` passes, run `bun run deps:update` again.

## Dropping a patch

When its `Remove-when` is true, or `patches prove` says its test passes without it:

1. delete the patch file and its test folder. A later patch of the same package that changes the same file is a
   diff on top of it: re-make that one;
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
installs the package unpatched. That is what `patches check`, the re-pin's step and the stop in `deps:update` are for.

The layout follows beep-effect's (`patches/`, bun's `patchedDependencies`, a regression test for each patch that
must fail on the unpatched package before the patch is retired). What differs: there a patch has no header and its
reason is in a runbook, one file holds every fix to a package, and "is it still needed" is asked by hand at each
update. Here the header is in the patch, a file is one defect, and the two checks ask.
