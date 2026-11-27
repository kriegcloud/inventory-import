# What the experiments taught

One line for each experiment that ended, written by `bun run scratch:graduate` or `bun run scratch:drop` when its
folder was deleted: the day, its name, where its code went or that it was dropped, and what was learned.

- 2026-11-27 stack-harness: graduated to apps/inventory/test/stack/Stack.slow.test.ts. npm's @alchemy.run/test 2.0.0-beta.87 deploys the dev stack on the local providers with the vendored alchemy; the runtime writes under vitest's folder whatever dotAlchemy says, and leaves each run's D1 database there.
