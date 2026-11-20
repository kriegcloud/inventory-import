---
type: Reference
title: Alchemy Git
description: A git server you host yourself on Cloudflare (Workers, Durable Objects, R2), built as replaceable Effect layers; this app would use it to keep each organization's confirmed imports as a cloneable, diffable history beside D1.
tags: [alchemy-domain, extras]
---

# Alchemy Git

`@alchemy.run/git` is a git host you deploy into your own Cloudflare account. It speaks git's smart HTTP protocol, so
`git clone` and `git push` work against it unchanged; it serves a typed REST plane (`/api/v1`) with repositories,
refs, objects, diffs and pull requests; and it answers a subset of GitHub's REST v3 API (`/api/v3`) for `gh api` and
Octokit. Every part is an Effect `Layer` you choose: where refs live (one Durable Object per repository), how names
resolve (a Durable Object or D1), where bulk bytes go (R2, S3 or your own store), and where push hashing runs. It has no
users, no credentials and no policy of its own: your HTTP middleware and handlers decide who may read and what a push
may do. The docs say it plainly: "No issues, reviews, comments, checks, Actions, or GraphQL." [https://alchemy.run/git]

It is not the GitHub provider. That is [`@alchemy.run/github`](./github.md), which manages repositories on github.com.

## When to reach for it

- When the app should hold a git repository of its own data: a history people can clone, diff and keep, where every
  change is a commit with an author and a message.
- When a feature needs branch comparison, a merge base, or a fast-forward or disjoint-file merge computed on the
  server, without cloning.
- When a team wants a git remote it owns, behind its own sign-in, on its own Cloudflare account.

Not for: running CI. It runs no jobs, reports no checks and reads no workflow files (see "In this app", item b).

## How it is declared

A host is one layer graph, provided once to a `Cloudflare.Worker`. The same graph builds the Worker side (wire,
REST, GitHub facade, your middleware) and each repository's Durable Object (refs, objects, pull requests, jobs).

```ts
// SKETCH: not compiled
import * as Cloudflare from "@alchemy.run/cloudflare"
import * as Git from "@alchemy.run/git"
import * as Http from "alchemy/Http"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as HttpRouter from "effect/http/HttpRouter"
import { HistoryAuthentication } from "./HistoryAuthentication.ts"

export const HistoryObjects = Cloudflare.R2.Bucket("HistoryObjects")

const HistoryLive = Layer.mergeAll(
  Git.ApiLive.pipe(Layer.provide(HistoryAuthentication.layer)),
  Git.InternalApiLive
).pipe(
  Layer.provide(Git.ApiHandlersLive),
  Layer.provide(Git.ReposDurableObject),
  Layer.provide(Git.RegistryDurableObject),
  Layer.provide(Git.HasherInline),
  Layer.provide(Git.BlobStoreR2(HistoryObjects)),
  Layer.provide(Http.Platform)
)

export default class HistoryHost extends Cloudflare.Worker<HistoryHost>()(
  "HistoryHost",
  { main: import.meta.url, ...Git.GIT_WORKER_OPTIONS },
  Effect.gen(function* () {
    const fetch = yield* HttpRouter.toHttpEffect(HistoryLive)
    return { fetch }
  }).pipe(Effect.provide(Cloudflare.R2.ReadWriteBucketBinding))
) {}
```

The blocks, each a `Context.Service` with the layers that ship for it:

| Block | Service | Ships | What it decides and stores |
| --- | --- | --- | --- |
| HTTP routes | `Git.Handlers` | `ApiLive`, `ApiHandlersLive`, `GroupsLive`, `InternalApiLive` | The six groups of `Git.Api` (`repos`, `refs`, `objects`, `pulls`, `protocol`, `github`); the internal hash route is separate and checks its own secret |
| Repository | `Git.RepoStore` | `ReposDurableObject` (DO class `GitRepo`) | One Durable Object per repository, keyed by a ULID. Its SQLite holds refs, the object index, small objects (deflated), the commit graph and pull requests. A push is a compare-and-swap on a ref in one transaction |
| Registry | `Git.RegistryStore` | `RegistryDurableObject` (DO class `GitRegistry`), `RegistryD1(database)` | `owner/name` to repository id, uniqueness, listings |
| Blob store | `Git.BlobStore` | `BlobStoreR2(bucket)`, `BlobStoreS3(bucket)`, your own | Compacted packs, clone bundles, oversize objects, spilled push bodies, and the head snapshot that serves reads without waking the Durable Object |
| Hasher | `Git.Hasher` | `HasherInline`, `HasherSelf`; `HasherWorkerLoader()`, `HasherLambda(HasherFunction)` from `@alchemy.run/git/Hasher` | Where an incoming push's objects are inflated and hashed before any ref moves. It never builds objects for a caller |
| Engine | `Git.Engine` | `EngineLive` (also inside `ApiHandlersLive`) | Repository operations with no HTTP request: `repositories`, `refs`, `objects`, `pulls`, and the scoped `preparePush`/`commitPush`, `prepareRefUpdate`, `prepareRefRemoval`, `prepareMerge` |
| Auth | none | your `HttpApiMiddleware` or `HttpRouter.middleware` | Who may call a route (`Git.isRead(request)` tells reads from writes); what a write may do is your handler's policy, run between prepare and commit |

What runs where: Cloudflare only for the Durable Object blocks (`GitRepo` and `GitRegistry` are
`Cloudflare.DurableObject` classes). S3 and Lambda are optional for bytes and hashing (recipe "Bytes in S3, hashing
on Lambda"); compute stays on Cloudflare. `GIT_WORKER_OPTIONS` sets `nodejs_compat`, compatibility date
`2026-03-17`, `limits.cpuMs: 300_000` and a self service binding `GIT_SELF`, so the host needs the Workers Paid plan.
`BlobStoreR2` takes `Cloudflare.R2.ReadWriteBucketBinding` or `ReadWriteBucketHttp` (`BlobStoreR2.ts:109-114`).
`BlobStoreS3` reads with no native stream, so every read crosses the internet, and its own comment keeps R2 the
default on Cloudflare (`BlobStoreS3.ts:31-35`, `:118-126`). Of the hashers, `HasherInline` needs `BlobStore`;
`HasherSelf` posts each part to the Worker's own `/_alchemy/git/hash` route over `GIT_SELF`, which on Workers runs on
the caller's thread and adds no CPU (`Hasher/Hasher.ts:12-16`, `:177-228`); `HasherWorkerLoader()` needs a
`worker_loader` binding (`GIT_HASHER_LOADER`, at most four isolates); `HasherLambda` sends 4 MiB base64 chunks to a
3008 MB, 60 s Lambda. Both remote hashers fall back to hashing inline when the remote call fails
(`Hasher/WorkerLoader.ts:45-79`, `:129-147`; `Hasher/LambdaFunction.ts:30-38`; `Hasher/Lambda.ts:85-91`).

`Git.Engine` needs `RepoStore`, `RegistryStore`, `BlobStore` and `Hasher` in its context (`Engine.ts:71-76`;
`EngineLive` provides only the operations layer, `:411`). So `yield* Git.Engine` works only inside a Worker whose
graph holds those blocks: the Git Worker itself. Another Worker reaches it only over HTTP, and no REST route takes new
objects. Writing from server code (no git client) therefore runs on the Git Worker: the engine takes ref updates plus
a stream of raw pack bytes.

```ts
// SKETCH: not compiled
const recorded = Effect.scoped(Effect.gen(function* () {
  const git = yield* Git.Engine
  const repo = yield* git.repositories.get({ owner: "org_prairie", repo: "catalogue" })
  const input = yield* Git.Push.fromStream(
    [{ ref: "refs/heads/main", oldOid: tipSeen ?? Git.ZERO_OID, newOid: commitOid }],
    packStream,
    { declaredBytes: packLength }
  )
  const prepared = yield* git.preparePush(repo, input)
  const result = yield* git.commitPush(prepared)
  // result.unpack !== "ok" or result.results[0].ok === false means nothing was written
  return result
}))
```

`Git.Push.fromStream(updates, pack, options)` decodes each update as `{ ref, oldOid, newOid }` (`ref` under
`refs/`, both oids 40 hex). `pack` is a `Stream.Stream<Uint8Array>`, not bytes; `Stream.empty` is a ref-only change.
`atomic` defaults to `true`. Pass `declaredBytes`: a push takes memory permits from a 64-permit gate per isolate,
about one per MiB, and a push of unknown length is charged the worst case (`PushInput.ts:11-27`;
`RepoObject.ts:238`, `:264-280`). The input lives in the caller's scope; closing it fails the push with "push scope
closed" (`PushInput.ts:60-66`). An organization's first commit creates the ref, so its `oldOid` is `Git.ZERO_OID`.

There is no "commit these files" call. The engine's writes take a pack (`preparePush`), a ref move or removal to or
from an object already stored (`prepareRefUpdate`, `prepareRefRemoval`, or the unscoped `refs.update` and
`refs.remove`), a merge of two stored commits (`prepareMerge`, `pulls.merge`), or repository settings
(`repositories.create`, `update`, `remove`, `fork`, `import`, `compact`) (`Engine.ts:90-366`). None takes files or a
tree. The GitHub facade's `contents` route is a `GET` only. The caller builds the blob, tree and commit objects and the
pack itself. The index exports only the readers (`parseCommit`, `parseTree`, `ZERO_OID`, `ObjectType`; `index.ts:30`)
and its own comment says to deep-import the rest by paths such as `@alchemy.run/git/Protocol/Pkt`
(`index.ts:18-21`); `package.json` maps `"./*"` to `./src/*.ts` under the `bun` and `worker` conditions and to
`./lib/*.js` otherwise (`package.json:48-53`). The encoders:

- `@alchemy.run/git/Protocol/ObjectCodec`: `ObjectType` (`commit` 1, `tree` 2, `blob` 3; `:68-73`);
  `hashObject(type, content)` (`:271`; `hashObjectSync` at `:264`), the SHA-1 of `"<type> <size>\0"` plus the
  content; `encodeTree(entries)` with entries `{ mode, name, oid }` (`:608-612`, `:707`; a subdirectory has mode
  `40000`, `TREE_MODE` at `:615`), which sorts in git's order and strips leading zeros from modes, and checks only that
  each mode is octal and each oid is 40 hex (`:707-738`); `encodeCommit({ tree, parents, author, committer, message })`
  (`:467-475`, `:504`), where an identity is `{ name, email, when, tz }`, `name` and `email` may not hold `<`, `>` or a
  newline, `when` is whole non-negative seconds and `tz` is `±hhmm` such as `+0000` (`:480-497`), and the message is
  written exactly as given, so the caller adds the final newline (`:474`); `encodeTypeSize` (`:795`); `makeSha1`
  (`:234`). Every failure is an `ObjectParseError` with a `reason`.
- `@alchemy.run/git/Protocol/Zlib`: `deflate(data, level?)` (`:298`).
- `@alchemy.run/git/Protocol/PackWriter`: `packHeader(count)` (`:40`) and `writePackBytes(entries, objects)`
  (`:137`), which streams a whole pack (header with the exact count, each entry, SHA-1 trailer) from any
  `ObjectSource`. `ObjectSource` is a plain interface with no storage behind it (`Protocol/Store.ts:60-93`), and the
  writer calls only its `readZData(oid)` (the deflated content), once per entry (`PackWriter.ts:96`). An entry is
  `{ oid, type, size, zsize, location }` (`Protocol/Store.ts:35-50`); the writer reads `oid`, `type` and `size`.
- `@alchemy.run/git/Protocol/TreeDiff`: `applyTreeChanges(objects, baseTree, changes)` (`:339`) rebuilds only the
  directories a set of leaf changes touches, drops a directory that comes out empty, and returns
  `{ root, newTrees }`. It needs `readContent` for the base trees and `getMetaBatch`, which must also report the new
  blobs, or it fails with `StoreError` (`:66-73`, `:345-365`).

`ObjectCodec` imports `node:crypto` and `Zlib` imports `node:zlib`; the Git Worker has `nodejs_compat`. These modules
are internal: no docs page names them and a release may move them, so pin the version. The published
`2.0.0-beta.87` tarball carries them both as `src/Protocol/*.ts` and as `lib/Protocol/*.js` (checked on unpkg on
2026-11-19).

`encodeTree` does not refuse an empty name, a name with `/`, or two entries with the same name, and nothing refuses
them when a push arrives (`parseTree` refuses only an empty name, `ObjectCodec.ts:668-670`). Pass one entry per name,
plain path segments, one tree per directory, or the host stores a tree that `git fsck --strict` rejects. Objects the
repository already holds (unchanged blobs and subtrees, the parent commit) may be left out of the pack: the
connectivity check counts an object as present when it is live or staged by the same push
(`RepoObject.ts:4352-4363`, `Store/ObjectStore.ts:958-972`). A reference to anything else fails `preparePush` with
`StoreError` "missing objects (n)"; at commit the same case comes back as `unpack: "missing objects (n)"`
(`RepoObject.ts:4404-4411`).

What the blob store holds, all under the repository's id (`Store/Keys.ts`):

| Key | Written | Removed |
| --- | --- | --- |
| `{repoId}/head` | At creation, and after every ref move: a small JSON of refs, visibility and the current bundle (`RepoObject.ts:4140`, `:3265-3270`) | At purge |
| `{repoId}/bundles/bundle-{refsHash}.pack` and its `.sideband` copy | By the bundle job about 2 s after a push: the full-clone pack, twice; skipped above 512 MiB (`Jobs/Bundle.ts:64`, `:126-156`; `RepoObject.ts:4458-4462`) | Only at purge |
| `{repoId}/objects/{oid}` | At push, for an object whose compressed bytes exceed 1 MiB (`Store/ObjectStore.ts:49`) | At purge |
| `{repoId}/packs/pack-{sha1}.pack` | By compaction, once 4,000 loose blobs or 64 MiB of them wait (`Jobs/Compact.ts:61-64`) | A minute after a merge of packs replaces it |
| `{repoId}/incoming/{receiveId}.pack` | A push body over 4 MiB, in 8 MiB multipart parts; its blobs stay in place as repository data | When a merge of packs rewrites it |

The only blob deletions in the package are of merged packs, the head snapshot and the whole prefix at purge, and
abandoned push spills (`RepoObject.ts:2355`, `:3809`, `:4167`; `Engine.ts:119`; `Jobs/Purge.ts:111`). Old bundles are
never deleted while the repository exists, and unreachable objects are never collected (`DESIGN.md:778`).

Background work runs on each repository's Durable Object alarm: no Queue, cron or workflow. One `jobs` row per kind;
a failed alarm re-arms in 30 s (`RepoObject.ts:5338-5390`). `gc` (armed 24 h after a push) finishes committed pushes
and drops staging older than 24 h; `compact` moves loose blobs into packs (commits and trees stay in SQLite); `bundle`
cuts the clone bundle and rewrites the head snapshot; `import` and `fork` run `repos.import` and `repos.fork`;
`purge` frees the name first, then deletes blob keys, then the Durable Object's storage. A failed head-snapshot write
is logged and ignored, and reads fall back to the Durable Object (`RepoObject.ts:3907`, `Server.ts:317-324`).

Limits:

| Limit | Value | Where |
| --- | --- | --- |
| One object, uncompressed | 64 MiB (`MAX_OBJECT_SIZE`); a push has no total cap, but Cloudflare's edge caps a request body at 100 MB on most plans | `Store/ObjectStore.ts:57`, `Protocol/PackParser.ts:121-132`, `DESIGN.md:1120-1122` |
| A push body held in memory | 4 MiB (`MAX_PACK_BYTES`); larger bodies spill to the blob store, they are not refused | `RepoObject.ts:160` |
| Wait for push admission | 30 s, then `StoreError` "push admission timed out" | `RepoObject.ts:219`, `Engine.ts:130-135` |
| `PreparedPush.readObject` | 1 MiB by default | `Engine.ts:215` |
| `objects.diff` (a commit against its first parent) | 1,000 files or 5,000 tree reads, then `truncated: true`; paths, modes, sizes and blob ids only, no content, no renames | `Protocol/TreeDiff.ts:36-42`, `Api/Schema.ts:413-421` |
| `objects.blob` (base64 JSON) | 1 MiB (`MAX_JSON_BLOB_BYTES`), else `ObjectTooLarge` (422); `blobRaw` and `file` stream larger ones | `Operations.ts:74`, `:812-818` |
| `objects.log` | 20 commits a page by default, 1 to 100; each page walks again from the tip | `Api/Objects.ts:35-45`, `RepoObject.ts:4493-4583` |
| `objects.compare` | merge-base walk up to 10,000 commits, up to 250 returned | `RepoObject.ts:196-199` |
| `repos.list`, `pulls.list` | 1 to 100 a page; defaults 50 and 20 | `RegistryObject.ts:242`, `RepoObject.ts:4911` |
| Wire protocol | smart HTTP v0, pack version 2, SHA-1 only; shallow clone by `deepen <n>` only; no partial clone, no LFS | `Protocol/Advertise.ts:36-45`, `Protocol/UploadPack.ts:109-124`, `Store/Keys.ts:84-87` |
| A blob store of your own | multipart parts uniform and at least 5 MiB except the last | `BlobStore.ts:17-18`, `:69-75` |

Types and helpers not named above:

| Name | What it is | Where |
| --- | --- | --- |
| `InternalLive` | The internal hash group's handlers, which `InternalApiLive` registers (internal) | `Server.ts:716` |
| `GitRepoLive`, `RegistryLive` | The Durable Object implementations behind `ReposDurableObject` and `RegistryDurableObject` (internal) | `RepoObject.ts:2877`, `RegistryObject.ts:283` |
| `REGISTRY_DO_NAME`, `RESERVED_OWNERS` | The registry's one instance name, `"registry"`, and the set `{"api"}` | `RegistryObject.ts:70`, `:76` |
| `HASHER_BINDING` | `"GIT_SELF"`, the self binding `HasherSelf` uses | `Hasher/Hasher.ts:205` |
| `CommitPushResult` | `{ unpack, results }`, each result `{ ref, ok, reason? }` | `RepoObject.ts:355-382` |
| `PackIngestError`, `WireProtocolError` | A pack that failed to ingest, a malformed wire request; reported in-band to `git` | `RepoObject.ts:309`, `:318` |
| `StoreError`, `BlobStoreError` | A storage failure with a `reason`; a blob store failure | `index.ts:31-35` |
| `Paginated(schema)` | `{ items, nextCursor, hasMore }`, the shape of every list | `Api/Schema.ts:527` |
| `PreparedPush.readObject(oid, maxBytes?)` | Reads an incoming or stored object between prepare and commit: the hook a write policy inspects | `Push.ts:38` |

The internal hash route checks a bearer secret, an `Alchemy.Random` named `GitInternalSecret` that the host's stack
mints (`Server.ts:140`, `:549-555`). It is separate from any secret the app declares for its own calls.

Checked in (all at `v2.0.0-beta.87`):

- `packages/git/src/Server.ts:118-127` (`GIT_WORKER_OPTIONS`), `:430-456` (`receivePack`), `:509-534` (`file`), `:708`
  (`ApiHandlersLive`), `:721` (`GroupsLive`), `:753` (`ApiLive`), `:761` (`InternalApiLive`), `:773`
  (`ReposDurableObject`)
- `packages/git/src/Api.ts:47` (`GitApi`, re-exported as `Git.Api`), `:71` (`isRead`)
- `packages/git/src/Engine.ts:79-88` (`repositories.get`), `:90` (`preparePush`), `:240` (`commitPush`), `:246`
  (`prepareRefUpdate`), `:277` (`prepareRefRemoval`), `:295` (`prepareMerge`), `:319-397` (the unscoped calls), `:401`
  (`Engine`), `:411` (`EngineLive`)
- `packages/git/src/PushInput.ts:17` (`fromStream`, exported as `Git.Push.fromStream` by `index.ts:28`)
- `packages/git/src/BlobStore.ts:97-128` (`BlobStoreShape`: `get`, `put`, `head`, `multipart`, `uploadPart`,
  `delete`, `list`; seven operations, where the docs list five), `packages/git/src/BlobStoreR2.ts:119`
- `packages/git/src/RegistryD1.ts:82`, `:99-101`; `packages/git/src/RegistryObject.ts:76`, `:293-295`
- `packages/git/src/RepoObject.ts:2820` (`GitRepo` Durable Object), `:2867` (`RepoStore`), `:3150-3176` (the ref
  compare-and-swap), `:4385-4411` (`commitPush` in the Durable Object)
- `packages/git/src/Protocol/ObjectCodec.ts:271`, `:504`, `:707`; `Protocol/Zlib.ts:298`; `Protocol/PackWriter.ts:40`,
  `:69`, `:137`; `Protocol/TreeDiff.ts:339`
- `packages/git/src/Api/Repos.ts:26` (create: `owner`, `name`, `defaultBranch`, `description`, `public`,
  `readOnly`), `:111` (import: `source.url`, `ref`, `depth`; no credential field)
- `packages/git/src/Jobs/Import.ts:91` (an import's pack is capped at 50 MiB)

### What main changes

Nothing in the docs (all 26 pages under `website/src/content/docs/git/` are identical). In source, three internal
edits, no API change, all from one commit, `615d87516` (#3222, which keeps typed errors from being erased by `any`):

- `packages/git/src/BlobStoreR2.ts:126` on main: a lint-suppression comment only.
- `packages/git/src/Hasher/Lambda.ts:14,35` on main: the declared `HasherFunction` is resolved with `yieldDeclared`
  from `alchemy/Util/effect` instead of an `Effect.isEffect` check.
- `packages/git/src/Operations.ts:451,465` on main: deleting a repository reuses one `removeRegistryRow` helper; same
  behavior.

Every other file of `packages/git/src`, `DESIGN.md` and `RFC-building-blocks.md` included, is identical.

## Rules, and the mistakes to avoid

- The engine authorizes nothing. `Git.ApiLive` with no middleware is an open host (tutorial part 1 says so). Apply the
  same policy to every write path: push, REST ref update and removal, REST merge and the GitHub-facade merge. Guarding
  one does not guard the others (`blocks/engine`). The default `protocol.receivePack` handler goes from `preparePush`
  straight to `commitPush` with no policy (`Server.ts:430-456`).
- Several comments promise auth the package does not have: "auth enforcement stays in the DO" and credentials "parsed
  by `Auth.ts`" (`GitHubCompat.ts:13-18`, `Server.ts:537`; no `Auth.ts` exists), tokens that writes "always require"
  (`Api/Schema.ts:312-316`), and a bootstrap `write` token on `RepoCreated`, which holds only `repo` and `remote`
  (`Api/Schema.ts:508-517`). No code issues or checks a token. `remote` is built from the request's `Host` and
  `x-forwarded-proto` (`Server.ts:149-161`), so over a service binding it carries the binding request's host.
- To refuse pushes from people while the server still writes, use the route middleware (`Git.isRead`) or override
  `receivePack`. Not `readOnly`: it also refuses the server's own pushes (`beginPush` answers `denied`, `commitPush`
  reports every ref not written), REST ref writes and merges (`RepoObject.ts:4247`, `:4284`, `:4308-4315`, `:4396`,
  `:5062`).
- A lost race on a push is not a failure. `commitPush` succeeds with a `CommitPushResult` whose ref reads
  `ok: false, reason: "fetch first"`; in an atomic push the other refs read "atomic transaction failed"
  (`RepoObject.ts:3150-3176`). A read-only repository answers the same way with "repository is read-only". Check
  `unpack === "ok"` and every `results[i].ok`. `RefConflict` comes only from the REST ref update and removal
  (`Engine.ts:260-267`, `:284-288`) and a pull-request merge.
- A git commit and a D1 batch are two transactions. The engine docs say ref compare-and-swap protects git only; a rule
  that must hold across both needs an application protocol. So the app's confirm stays one D1 batch, and the history
  commit follows it.
- `preparePush` and the `prepare*` results are scoped and single-use: run them in `Effect.scoped`; leaving the scope
  without commit aborts staging; a second commit fails with a `StoreError`.
- Owner and repository names match `^[a-z0-9](?:[a-z0-9._-]{0,98}[a-z0-9])?$`, case-insensitive
  (`Api/Schema.ts:37-39`). They are stored lower-cased: both registries insert `owner.toLowerCase()` and
  `name.toLowerCase()` (`RegistryObject.ts:294-295`, `RegistryD1.ts:100-101`) and the repository writes them
  lower-cased into its config (`RepoObject.ts:3494-3495`), whatever the schema comment "stored as given" says
  (`Api/Schema.ts:35`). `repositories.get` lower-cases both and strips `.git` (`Engine.ts:79-84`), through a 60-second
  in-isolate cache of up to 1,024 names (`Operations.ts:68-71`). The owner `api` is reserved (`Api/Schema.ts:41-46`,
  `RegistryObject.ts:76`). `org_prairie` is a valid owner.
- `repositories.create` defaults `defaultBranch` to `"main"`, `readOnly` and `public` to `false`
  (`Operations.ts:343-346`). A second create of a taken name fails with `RepoAlreadyExists` (409), and that includes a
  repository still being deleted: the name frees only after the purge (`RegistryObject.ts:305-316`). Never delete and
  re-create a repository in one request.
- `public` is only a stored flag. It grants nothing unless your middleware reads it. The create payload's doc comment
  says a public repository can be read without a credential (`Api/Repos.ts:34`), but no engine code enforces that;
  the docs (`website/src/content/docs/git/repositories.mdx:48`) and the middleware example in `Api.ts:66` follow
  the source: your middleware decides.
- Import is one-shot, from a URL the host can fetch with no credential, capped at 50 MiB. It takes only
  `refs/heads/` and `refs/tags/`, or the one ref in `source.ref`, and reads the whole response into memory before
  checking the cap (`Jobs/Import.ts:328-366`). A failed import is retried twice more, 15 s apart; then the repository
  turns `ready` and empty, and `GET /repos/:owner/:repo` shows no error (`RepoObject.ts:3955-3978`). Check the refs
  after an import, not only the status. An import with `depth` leaves a shallow repository that a plain `git clone`
  is refused from. It is not a mirror that keeps itself current.
- Pull requests merge only fast-forwards or disjoint-file changes; overlapping edits are a typed `409`. The merge
  commit's identity is fixed, `git-service <git-service@localhost>`, not the person who merged
  (`RepoObject.ts:5193-5206`). There are no reviews, comments or required checks.
- The GitHub facade (`/api/v3`) has twelve routes: `/user`, a repository, branches, commits, one commit, contents, and
  pull requests (list, create, get, update, merge, files) (`Api/GitHub.ts:10-56`). Compare is only on the native plane
  (`/api/v1/repos/:owner/:repo/compare`). Only the `merge` method is accepted; `squash` and `rebase` are a `405`
  (`GitHubCompat.ts:594-597`). `gh pr create` and the rest of `gh`'s porcelain use GraphQL and do not work. Override
  the facade's `user` handler: by default it answers the login `"git"` (`GitHubCompat.ts:414`).
- `index.ts:42` re-exports `BlobStoreS3`, and `BlobStoreS3.ts:1-18` imports `@alchemy.run/aws/S3` at module top,
  though `package.json` marks `@alchemy.run/aws` an optional peer. Install it beside the package even for an R2-only
  host. That a bundle fails without it is not verified by a build.
- Every blob store that ships needs a bucket: `BlobStoreR2` an R2 bucket bound to the Worker, `BlobStoreS3` an S3
  bucket. The head snapshot is written to it when a repository is created (`RepoObject.ts:4140`), so every repository
  uses the bucket, not only large ones.
- `packages/git/src/DESIGN.md` and `RFC-building-blocks.md` are partly design history. DESIGN.md's Part I describes a
  tokens table, an admin key, scopes and a 50 MiB push cap that its own later sections withdraw
  (`DESIGN.md:672-719`, `:1055-1122`); the RFC's `Git.Server`, `Git.ServerLive` and `BlobStoreMemory()` are not
  exports at either ref. Follow the source and the docs pages.
- The example `examples/cloudflare-git-artifacts` on main is a different product: Cloudflare's own Artifacts
  (`Cloudflare.Artifacts.Namespace`), not `@alchemy.run/git`. Its `src/Worker.ts:163` provides a `Binding` that the
  file never imports, so it does not compile as written.

## In this app

Each organization gets one repository, `owner = organizationId`, `name = "catalogue"`, on a separate Git Worker that
the app's Worker reaches by service binding. After a confirm's D1 batch succeeds, the server writes one commit:

```text
items/<skuKey>.json                  one file per item in force after the confirm
imports/<importId>/rows.csv          the rows as staged (the server never holds the original .xlsx bytes)
imports/<importId>/decisions.json    every row decision, with who made it
imports/<importId>/result.json       created, updated, already, not imported, as read back from D1
```

Author is the actor: git's identity needs a name and an email field, so the name goes in the first and the member id
in the second (never the person's email), the message is "Import <file name>: 12 created, 3 updated" with a final
newline. A take-back writes a second commit that removes the items the take-back removed, restores the replaced ones it
put back and leaves the kept ones as they are, so `git diff <confirm> <take-back>` shows exactly what D1 did. Git
computes no revert: the app derives the commit from the take-back's own result.

```ts
// SKETCH: not compiled
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"

/** Records a confirmed import, or its take-back, as one commit in the organization's catalogue history. */
export class CatalogueHistory extends Context.Service<CatalogueHistory, {
  readonly recordConfirm: (batch: ConfirmedBatch) => Effect.Effect<CommitRecorded, HistoryUnavailable>
  readonly recordTakeBack: (batch: TakenBackBatch) => Effect.Effect<CommitRecorded, HistoryUnavailable>
}>()("@inventory/catalog/CatalogueHistory") {}

export class HistoryUnavailable extends S.TaggedError<HistoryUnavailable>()("HistoryUnavailable", {
  importBatchId: S.String,
  reason: S.String
}) {}
```

The three uses the owner asked about:

**(a) A repository per organization holding every confirmed import.** Blocks: `ReposDurableObject`,
`RegistryDurableObject` (not `RegistryD1` on the app's database: it creates its own table outside
`migrations/0001_init.sql`, which owns the schema), `HasherInline` (commits are kilobytes), `BlobStoreR2`, and
`EngineLive` through `ApiHandlersLive`. Declared in `packages/infra/src/Inventory.stack.ts`: one
`Cloudflare.R2.Bucket`, one `Cloudflare.Worker` spreading `Git.GIT_WORKER_OPTIONS`, an `Alchemy.Random` shared
secret for the app-to-Git calls, and the Git Worker in the Website's `env` (the pattern of
`examples/cloudflare-git-service/alchemy.run.ts:38-47`). Stored: refs, small objects and the commit graph in each
repository's Durable Object SQLite; bundles, packs and head snapshots in R2; names in the registry Durable Object.

The commit is written on the Git Worker, because only there does `Git.Engine` have its blocks. The Git Worker carries
one route of the app's own, an `HttpApiGroup` added beside `Git.Api` (`Http.ts:1` leaves the application its own
groups; `Api.ts:43-45` composes them), behind the shared secret. The app's adapter sends it, over the service binding, the organization, the
import batch id, the actor, the message and the four kinds of file as JSON. That route does, in order:

1. `const git = yield* Git.Engine` (`@alchemy.run/git`).
2. `git.repositories.get({ owner: organizationId, repo: "catalogue" })`. On `RepoNotFound`,
   `git.repositories.create({ owner: organizationId, name: "catalogue" })`; on `RepoAlreadyExists` (a concurrent first
   confirm), `get` again.
3. `git.refs.get(repo, "refs/heads/main")` for the tip. `RefNotFound` means the repository is unborn: the commit has no
   parent and `oldOid` is `Git.ZERO_OID`. Otherwise `git.objects.commit(repo, tip)` gives the root tree, and
   `git.objects.tree(repo, oid)` gives a tree's entries (`{ mode, name, oid, type }`).
4. Idempotency: `git.objects.file(repo, { ref: tip, path: "imports/<importId>/result.json" })`. If it is there, the
   import is already recorded; answer the tip and stop.
5. Each file: `hashObject(ObjectType.blob, bytes)` and `deflate(bytes)` (`@alchemy.run/git/Protocol/ObjectCodec`,
   `@alchemy.run/git/Protocol/Zlib`). Leave out of the pack every blob whose oid the tip's trees already name.
6. Trees: `encodeTree` for `imports/<importId>`, for `imports` (the tip's entries plus the new one), for `items` (one
   entry per item in force, mode `100644`), and for the root, each hashed with `ObjectType.tree`. `applyTreeChanges`
   (`@alchemy.run/git/Protocol/TreeDiff`) can do this step from leaf changes if the route gives it the base trees.
7. `encodeCommit({ tree, parents: tip === undefined ? [] : [tip], author, committer, message })`, hashed with
   `ObjectType.commit`.
8. The pack: `writePackBytes(entries, source)` (`@alchemy.run/git/Protocol/PackWriter`), where `source` is an
   `ObjectSource` whose `readZData(oid)` returns the step-5 deflated bytes as a one-chunk stream and whose other methods
   are stubs; its byte length is `declaredBytes`.
9. In `Effect.scoped`: `Git.Push.fromStream([{ ref: "refs/heads/main", oldOid, newOid: commitOid }], pack,
   { declaredBytes })`, `git.preparePush(repo, input)`, `git.commitPush(prepared)`. If `unpack` is not `"ok"` or the
   ref reads `ok: false`, nothing was written: on "fetch first" go back to step 3 (step 4 then stops a second write);
   otherwise answer the failure, which the adapter turns into `HistoryUnavailable`.

The History view on the Activity page reads, behind the app's own session and over the binding, `objects.log` (20
commits a page by default, up to 100) and `objects.diff`. What it can show: each commit's author, time and message,
and which files it added, removed or modified, with old and new blob ids and sizes. What it cannot show from the host
alone: a line diff. The server computes none (the GitHub facade reports `additions` and `deletions` as 0 for that
reason, `GitHubCompat.ts:29-32`), so to say which fields of an item changed the app reads both blobs and compares them
itself, and a blob comes as JSON only up to 1 MiB (one item's file is far under it). A diff stops at 1,000 files with
`truncated: true`. An organization's first commit adds one file per item, and so does a confirm of a file with more
than 1,000 rows; for those the view says "Showing 1,000 of N changes", N from the import's own counts, and points to
the clone. It never shows a truncated list as the whole.

What is never deleted while the repository exists: every commit and every object (a take-back is a new commit, and
unreachable objects are never collected), and every clone bundle the host cuts (two full copies of the repository as
it stood after a push, kept in R2). Deleting the repository is the only way to remove history; the purge frees the
name first and then deletes the bucket keys and the Durable Object's storage.

**An R2 bucket is a cost of this item.** The only blob stores the package ships are `BlobStoreR2` and `BlobStoreS3`,
and each needs a bucket; nothing else in `packages/git/src` provides `BlobStore`. The bucket is written from the
repository's creation (the head snapshot) and after every commit (head snapshot and bundle). A store without a
bucket, over a Durable Object's storage or D1, would have to implement all seven operations of `BlobStoreShape`
(`BlobStore.ts:97-128`): ranged reads in 4 MiB windows, streamed whole-object writes up to 512 MiB (bundles),
compaction packs read back whole, multipart writes in 8 MiB parts with `uploadPart` from another isolate, deletes and a
prefix listing for purge. A SQLite row holds about 2 MB (`DESIGN.md:47`), so it must split each blob across rows, and
it would also hold every old bundle. None ships and none was tried. The app has no bucket today, and its infra brief
rules R2 out for now (`explorations/ideal-architecture/BRIEF-infra.md:382`), so this adds one and needs the owner's
word. It is the Git host's own storage, used only by its Worker and Durable Objects. It is not R2 presigned uploads,
which is a different use of R2: the owner did not ask for presigned uploads, and the exploration left them out because
rows arrive as JSON (`explorations/ideal-architecture/README.md:49`). Nothing here changes how a file reaches the app.

The person gets the History view and, if the app adds Better Auth's API-key plugin (not installed today:
`packages/access/host/src/internal/authOptions.ts:162` lists `organization` and `haveIBeenPwned` only), a clone URL
for an admin: `git clone https://<host>/org_prairie/catalogue.git`. People never push to it: the Git Worker's
middleware lets reads through (`Git.isRead`) and refuses every other route but the app's own.

**(b) The repository's own continuous integration.** The earlier research holds at main: Alchemy Git runs no jobs,
reports no checks, and has no notion of `.github/workflows`. A grep of `packages/git/src` at both refs finds no
webhook, workflow or check code, and the design notes mention CI only as a client that clones and pushes
(`DESIGN.md:28`, `:51`, `:892`). What it does give CI is a git remote a runner can clone from, ref policy in your
handlers, and `RepoStore`, which the source calls the seam for decorating repositories by wrapping `commitPush`,
`updateRef` and `mergePull` (`RepoObject.ts:2858-2864`), so a team could start its own job on a ref move, with a
runner it builds. CI here stays GitHub Actions (`.github/workflows/ci.yml`, `deploy.yml`), configured through
[`@alchemy.run/github`](./github.md).

**(c) A mirror of the app's own repository on a stage.** Blocks: the same host graph; `repos.import` once with
`source.url` set to the GitHub clone URL, no `depth` (public URL only: the import payload has no credential field;
whether credentials embedded in the URL are sent is not verified). The repository's pack is about 7 MiB, under the
50 MiB cap. Import does not refresh, so keeping it current means a step in `deploy.yml` that runs
`git push --mirror` to the stage's host with a key that `GitHub.Secret` writes from the Git stack's `Alchemy.Random`
(the workflow step itself stays hand-written). After the import, check that `refs.list` shows the branches. Stored: as
in (a). The person gets nothing they can see; a developer gets a second remote on infrastructure the project already
pays for.

- **Used today:** no. Confirm and take-back write only D1 (`packages/catalog/host/src/ImportStore.adapter.ts`,
  `commit` and `takeBack`); the audit trail is the `activity` table and `importChange` rows.
- **Where it goes:** a `CatalogueHistory` port in `packages/catalog/model/src/Catalog.ports.ts`, its adapter (a call
  over the service binding) in `packages/catalog/host/src/`, called after `commit` and `takeBack` in
  `packages/catalog/model/src/Import/Imports.handler.ts`; the Git Worker, its own write route and the bucket in
  `packages/infra/src/Inventory.stack.ts`; a History section on `ActivityPage`.
- **What the person gets:** every confirmed import and take-back as a commit they can read in the app and diff, and
  (with API keys added) clone.

## How to check it

- A fast test of the pure part, with no host: the same set of items gives the same tree id (`hashObject` over
  `encodeTree`), and `result.json` counts add up to the rows of the file (app rule 1).
- A fast test of the pack: build a commit's pack, then feed it to `ingestPack` from
  `@alchemy.run/git/Protocol/PackParser` over a `bufferRandomAccess(pack)` source and a thin-base source that returns
  nothing (`PackParser.ts:91-97`, `:243-280`, `:395`). It passes when ingestion succeeds (a bad trailer is
  `PackChecksumMismatch`) and the ingested oids equal the ones the adapter computed. A second test runs
  `checkConnectivity(staged, [commitOid], deps)` (`Protocol/ReceivePack.ts:296`) with the previous tip's objects as
  live: `[]` when unchanged subtrees were left out, the missing oid when a new blob was forgotten.
- An idempotency test: recording the same `importBatchId` twice writes one commit. The route reads
  `imports/<importId>/result.json` at the tip before writing (the REST `file` route answers a missing path with a
  plain `404` "not found", `Server.ts:509-534`; the engine's `objects.file` fails with `ObjectNotFound`), and pushes
  with the tip it read as `oldOid`. A race comes back as `ok: false` with "fetch first", never as a second commit.
- On a deployed stage: confirm the sample, then `git clone`, `git fsck --strict`, and `git show --stat HEAD`; take it
  back and check that `git diff HEAD~1 HEAD -- items/` lists the removed and restored SKUs and none of the kept ones
  (app rule 4).
- The three numbers (rows in the file, what the result says, what is stored) read a fourth time from `result.json`.
- Tenancy (rule 6): a request as a member of `org_northline` for `/org_prairie/catalogue.git` gets `401`; a
  `git push` by anyone to it is refused.

## What it needs

- Host: Cloudflare (Workers, two SQLite-backed Durable Object namespaces, an R2 bucket); Workers Paid for the 300 s CPU
  limit (already chosen, decision "infra I9"). Optional AWS for S3 bytes or Lambda hashing. It does not run on the
  in-memory, Rivet or Effect Cluster hosts ([host-cloudflare](./host-cloudflare.md)).
- Packages: `@alchemy.run/git` with its peers `alchemy`, `@alchemy.run/cloudflare` and `effect`, and
  `@alchemy.run/aws` installed too (the index imports it through `BlobStoreS3`).
- Version: beta.87 has everything used here; main changes nothing that matters. The deep imports of `Protocol/` are
  internal: pin the version.
- Independent of `@alchemy.run/domain`: no aggregate, command or event is involved. A history commit after each
  confirm is shaped like a [projection](./projection.md) of the confirm's result.

## Verdict

**Use:** for (a), as a per-organization history beside D1 (never instead of it): a separate Git Worker with
`BlobStoreR2` and the Durable Object registry, written by a route of the app's own on that Worker, called by a
`CatalogueHistory` port after each confirm and take-back, read in the app over the REST plane. Accept an R2 bucket as
its cost.

For (a) the evidence is against one thing the owner may have pictured: there is no "commit these files" call, so the
route builds the objects itself from the internal encoders and streams the pack with the package's own pack writer.

**Cannot yet:** for (b), CI. The package has no runner, checks or workflow support, and nothing on main adds them;
only a runner the project builds itself, started from the `RepoStore` seam, would change that. The nearest thing that
works: keep CI on GitHub Actions, and use the Git host as a remote a runner can clone.

**Use:** for (c), a mirror on a stage: one `repos.import` from the public GitHub URL, then a `git push --mirror` step in
`deploy.yml` to keep it current, with a key `GitHub.Secret` writes. The evidence is against a mirror that stays current
by itself: import is one-shot and takes no credential.

## Where this was read

- https://alchemy.run/git (the live site documents beta.87)
- `website/src/content/docs/git/` (all 26 pages) at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same
- `packages/git/src/` at `v2.0.0-beta.87`, every file in full, `Protocol/`, `Store/`, `Jobs/`, `Hasher/`, `Api/`,
  `DESIGN.md` and `RFC-building-blocks.md` included; on `main@dbfd0ddb`: `BlobStoreR2.ts`, `Hasher/Lambda.ts`,
  `Operations.ts` changed, the rest same
- `packages/git/package.json` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same
- `examples/cloudflare-git-service`, `examples/cloudflare-git-artifacts` on `main@dbfd0ddb`: new (not in the beta.87
  export)
- The app: `packages/infra/src/Inventory.stack.ts`, `packages/infra/src/GitHub.stack.ts`, `.github/workflows/`,
  `explorations/ideal-architecture/README.md`, `research/02-alchemy-infra.md`, `DECISIONS.md`
