# The Alchemy packages, pinned to one commit and kept as files

`@alchemy.run/domain`'s `Decision`, `Relation`, invariants, transitions and `Verify` exist only on the library's
`main`. Its registry, `https://pkg.alchemy.run`, serves a build of every commit of `main` and deletes it a week after
`main` has moved on. So the build this repository uses is kept here, and an install needs that registry for nothing.

Today only `packages/infra` uses these packages (`alchemy`, `@alchemy.run/cloudflare`, `@alchemy.run/github`).
`@alchemy.run/domain` is kept beside them for the model of the review that is built next: no workspace asks for it
yet, so it is in no lockfile entry and no install puts it in place. It is the reason for the pin, and the other three
come from the same commit because one `node_modules` holds one `alchemy`.

The commit is `734c27a`, the head of `main` when it was pinned (2026-11-22). `sources.json` lists every file: its
package, its licence, the address the registry served it from (the address names the SHA-256 of those bytes) and the
SHA-256 of the file kept here.

## What is here

Seventeen packages, 38.7 MB as files: `alchemy`, eight of `@alchemy.run/*` (`acme`, `cloudflare`,
`cloudflare-runtime`, `docker`, `domain`, `github`, `node-utils`, `sql`) and eight of `@distilled.cloud/*` (`acme`,
`aws`, `aws4signer`, `cloudflare`, `core`, `github`, `iceberg`, `s3`), which the first nine name by that registry's
addresses. `@distilled.cloud/aws` alone is 19.7 MB. Every other dependency of theirs comes from npm as usual.

All seventeen are licensed Apache-2.0; each file carries its own `LICENSE`, and `NOTICE` and
`THIRD_PARTY_LICENSES.md` where its package has them.

## The one change made to fifteen of them

A preview build names its sibling packages by address:

```json
"alchemy": "https://pkg.alchemy.run/alchemy/-/37771eb2…9c45.tgz"
```

bun fetches such an address before it applies an override, so with those addresses left in, an install reaches the
registry whatever the root `package.json` says. In each file's `package.json`, and nowhere else, every such address is
replaced by `<that package's version>-734c27a` (`2.0.0-beta.87-734c27a`, `1.0.0-rc.20-734c27a`), and one key, `"//"`,
says that this was done. Those are versions no registry has. The root `package.json` redirects each of the seventeen
names to its file here (`overrides`), so a dependency that is not redirected fails the install instead of fetching
another build. Every other byte of every package is the registry's. Two packages name no sibling
(`@alchemy.run/node-utils`, `@distilled.cloud/core`): their files are the registry's own, byte for byte, and
`sources.json` shows it (`addressesRewritten` 0, and a SHA-256 equal to the one in the address).

## How it is wired

- The root `package.json` has one `overrides` line per package, `file:vendor/alchemy/<file>`.
- A workspace that uses one asks for `2.0.0-beta.87-734c27a` (`packages/infra`).
- `bun.lock` names each one that is installed by its file here, with the hash of its bytes.

## Moving the pin

```bash
python3 vendor/alchemy/repin.py <commit>
```

It downloads that commit's builds, checks each against the hash in its address, rewrites the addresses, replaces the
files and `sources.json`, says which packages are new or gone since the last pin, and prints the `overrides` block.
Then, by hand:

1. Replace the whole `overrides` block in the root `package.json` with the one it printed. The old lines name files
   the script has just deleted.
2. Change the version the workspaces ask for (`2.0.0-beta.87-<commit>`).
3. Run `bun install`, then check that `bun.lock` names every installed one by its new file and nothing by
   `pkg.alchemy.run`.
4. Update this page: the commit, the count and the sizes.
5. Run the type-check and the tests of every workspace that uses one again, and every proof: `main` breaks code
   between releases.
