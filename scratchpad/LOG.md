# What the experiments taught

One line for each experiment that ended, written by `bun run scratch:graduate` or `bun run scratch:drop` when its
folder was deleted: the day, its name, where its code went or that it was dropped, and what was learned.

- 2026-11-27 stack-harness: graduated to apps/inventory/test/stack/Stack.slow.test.ts. npm's @alchemy.run/test 2.0.0-beta.87 deploys the dev stack on the local providers with the vendored alchemy; the runtime writes under vitest's folder whatever dotAlchemy says, and leaves each run's D1 database there.
- 2026-11-27 import-module: dropped. One aggregate as a listing of role-named files proves as the packaged one; superseded by catalog-model, which holds the whole model in that shape.
- 2026-11-27 command-file: dropped. A command, its event and its decide each move to a file of their kind and the whole model still verifies against the package's lock; a class static is not read, a namespace is; findings are in catalog-model's NOTE and in history at ba3ac17f.
