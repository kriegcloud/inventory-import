# The Alchemy packages, pinned to one commit and kept as files

`@alchemy.run/domain`'s `Decision`, `Relation`, invariants, transitions and `Verify` exist only on the library's
`main`. Its registry, `https://pkg.alchemy.run`, serves a build of every commit of `main` and deletes it a week after
`main` has moved on. So the build this repository uses is kept here, and an install needs that registry for nothing.

`packages/infra` uses `alchemy`, `@alchemy.run/cloudflare` and `@alchemy.run/github`. The model of the review in
`packages/catalog/model`, and the test in `packages/catalog/web` that holds it against the review region, use
`@alchemy.run/domain`, which is the reason for the pin. All of them come from the same commit because one
`node_modules` holds one `alchemy`.

## What is here

<!-- pin:start (written by repin.py from sources.json; do not edit by hand) -->
The commit is `734c27a` of the library's `main`, pinned on 2026-11-22: 17 packages, 38.7 MB as files.

| Package | Version | Licence | Size | Sibling addresses replaced |
| --- | --- | --- | ---: | ---: |
| `@alchemy.run/acme` | 2.0.0-beta.87 | Apache-2.0 | 61.8 kB | 2 |
| `@alchemy.run/cloudflare` | 2.0.0-beta.87 | Apache-2.0 | 3.8 MB | 11 |
| `@alchemy.run/cloudflare-runtime` | 2.0.0-beta.87 | Apache-2.0 | 1.6 MB | 2 |
| `@alchemy.run/docker` | 2.0.0-beta.87 | Apache-2.0 | 299.3 kB | 1 |
| `@alchemy.run/domain` | 2.0.0-beta.87 | Apache-2.0 | 1.2 MB | 5 |
| `@alchemy.run/github` | 2.0.0-beta.87 | Apache-2.0 | 202.3 kB | 3 |
| `@alchemy.run/node-utils` | 2.0.0-beta.87 | Apache-2.0 | 83.1 kB | 0 |
| `@alchemy.run/sql` | 2.0.0-beta.87 | Apache-2.0 | 121.3 kB | 1 |
| `@distilled.cloud/acme` | 1.0.0-rc.20 | Apache-2.0 | 54.4 kB | 1 |
| `@distilled.cloud/aws` | 1.0.0-rc.20 | Apache-2.0 | 19.7 MB | 2 |
| `@distilled.cloud/aws4signer` | 1.0.0-rc.20 | Apache-2.0 | 44.1 kB | 1 |
| `@distilled.cloud/cloudflare` | 1.0.0-rc.20 | Apache-2.0 | 6.5 MB | 2 |
| `@distilled.cloud/core` | 1.0.0-rc.20 | Apache-2.0 | 391.2 kB | 0 |
| `@distilled.cloud/github` | 1.0.0-rc.20 | Apache-2.0 | 2.4 MB | 1 |
| `@distilled.cloud/iceberg` | 1.0.0-rc.20 | Apache-2.0 | 97.8 kB | 1 |
| `@distilled.cloud/s3` | 1.0.0-rc.20 | Apache-2.0 | 465.2 kB | 2 |
| `alchemy` | 2.0.0-beta.87 | Apache-2.0 | 1.8 MB | 2 |
<!-- pin:end -->

`sources.json` lists every file: its package, its licence, the address the registry served it from (the address
names the SHA-256 of those bytes) and the SHA-256 of the file kept here. The packages of `@distilled.cloud/*` are
there because the others name them by that registry's addresses. Every other dependency of theirs comes from npm as
usual. Each file carries its own `LICENSE`, and `NOTICE` and `THIRD_PARTY_LICENSES.md` where its package has them.

## The one change made to a package that names a sibling

A preview build names its sibling packages by address:

```json
"alchemy": "https://pkg.alchemy.run/alchemy/-/37771eb2…9c45.tgz"
```

bun fetches such an address before it applies an override, so with those addresses left in, an install reaches the
registry whatever the root `package.json` says. In each file's `package.json`, and nowhere else, every such address is
replaced by `<that package's version>-<commit>` (`2.0.0-beta.87-734c27a` on the day this was written), and one key,
`"//"`, says that this was done. Those are versions no registry has. The root `package.json` redirects each name to
its file here (`overrides`), so a dependency that is not redirected fails the install instead of fetching another
build. Every other byte of every package is the registry's. A package that names no sibling is the registry's own
file, byte for byte: the table shows 0 for it, and in `sources.json` its SHA-256 equals the one in its address.

## How it is wired

- The root `package.json` has one `overrides` line per package, `file:vendor/alchemy/<file>`.
- A workspace that uses one asks for `<version>-<commit>` (`packages/infra`).
- `bun.lock` names each one that is installed by its file here, with the hash of its bytes.

## Moving the pin

```bash
bun run alchemy:repin -- <commit>
```

`<commit>` is a commit of the library's `main`, at least its first seven characters, or the word `main` for its head.
The registry builds commits of `main` only. The command needs python3, git, bun and the network. It first prints the
address that compares the pinned commit with the new one, then does all of this, stopping at the first step that
fails:

1. Downloads that commit's builds, checks each against the hash in its address, rewrites the addresses, replaces the
   files and `sources.json`, and says which packages are new or gone since the last pin.
2. Rewrites the `overrides` in the root `package.json` and the version each workspace asks for.
3. Runs `bun install`.
4. Writes each file's hash into `bun.lock`. bun does not do this by itself for a local file whose bytes changed, and
   an install with `--frozen-lockfile` (CI, a deploy) then refuses the lockfile.
5. Rewrites the table above.
6. Checks that the files, `sources.json`, the overrides, the workspaces, `bun.lock` and this page agree, and that
   `bun.lock` names nothing by `pkg.alchemy.run`.
7. Installs a copy of the working tree with an empty cache through a proxy that refuses `pkg.alchemy.run`, and fails
   if the install asked for it, changed `bun.lock` or put anything else in place than the files here.
8. Runs `bun run check:full -- --force`: every type-check, test and proof again, nothing replayed from the cache.
   The library's `main` breaks code between releases, so a failure here is the library's change to read and answer
   in the code, never a reason to keep the old result.

A step from 1 to 7 that fails puts every file it changed back as it was and runs `bun install` again, so the old pin
stands. Step 8 failing leaves the pin moved, and prints the one line that goes back instead. Adding
`--no-full-check` to the command leaves step 8 out.

It commits nothing. What is left by hand: read the difference and what the library changed, fix what step 8 found,
and commit.

Steps 6 and 7 alone, on what is here now:

```bash
bun run alchemy:check
```

```bash
bun run alchemy:check -- --install
```
