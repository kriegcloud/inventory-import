---
status: open
started: 2026-11-26
template: probe
libraries: @alchemy.run/test
---

# stack-harness

Does npm's @alchemy.run/test 2.0.0-beta.87 deploy this stack on Alchemy's local providers, and does any file it writes hold the sign-in secret?

## What was tried

`@alchemy.run/test@2.0.0-beta.87` from npm, installed with `bun add --cwd scratchpad --exact --omit=peer`, so its
peers (`alchemy`, `effect`, `vitest`, `@effect/vitest`) are the root's: `alchemy` is the vendored build of
e1c3e6d, 194 commits after the one npm's harness was released from. It brought `@effect/platform-bun` 4.1.6 and
`ws` with it into `scratchpad/node_modules`. Every `alchemy/...` module its source imports exists in the vendored
build.

`StackHarness.test.ts` runs under the scratchpad's vitest, on Node: `Test.make` from `@alchemy.run/test/Vitest`
with `Cloudflare.providers()`, `Alchemy.inMemoryState()`, `dev: true`, the stage `dev_trial` and `dotAlchemy`
under this folder's `.state`; `beforeAll(deploy(InventoryDev))` (the stack of `bun run dev:alchemy`) and
`afterAll(destroy(InventoryDev))`. The test reads the signed-out session, takes the test accounts' offer, posts the
first account's email and password to `/api/auth/sign-in/email`, reads the session again with the cookie (status
`ready`) and then `/api/v1/system/status` (200).

## What was found

- **It deploys and serves.** Four runs, each passed in 7.6 to 12.5 seconds with the deploy. The status page
  answers 401 before a sign-in, as it does under `bun run dev`.
- **The sign-in secret is in no file.** Every file written under `scratchpad/.alchemy` and this folder was searched
  for 64 hexadecimal characters: the only ones are the migrations' hashes (`__alchemy_migrations.hash`, 8 rows)
  and the five test accounts' password hashes (`account.password`), both inside the local D1 database.
  `~/.local/state/alchemy` was not written.
- **`dotAlchemy` is not where the local runtime writes.** Its data (D1, KV, R2, caches) went to `.alchemy/local`
  under the folder vitest ran in (`scratchpad/`), git-ignored. The experiment's `.state` stayed empty.
- **A run leaves its database behind.** In-memory state names a new D1 database every run, and `destroy` does not
  delete its `.sqlite`: one database file is left per run, holding the test accounts' password hashes and the
  sessions the run made. A test in `check:full` has to remove `.alchemy/local` itself.
- Not tried: importing `items_clean.csv` (the acceptance's import of 25 items), `@alchemy.run/test` from the
  library's source at e1c3e6d, and a test stage on a real account (never: no account here).
