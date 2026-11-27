---
status: open
started: 2026-11-27
template: probe
libraries: 
---

# kind-registry

If every file's ending had to be a kind in one registry, what would the catalog and access contexts be refused for today?

Asked by [explorations/module-taxonomy](../../../explorations/module-taxonomy/README.md), experiment 3.

## What was tried

`Kinds.registry.ts` is the registry as data: 28 kinds by ending, each with what it declares, the layers that may hold
it and the layers that may import it from another package, and two endings (`.store`, `.gateway`) named as another
kind's (`.port`). `KindRegistry.test.ts` reads every code file under `src` in the eight packages of the catalog and
access contexts, and every import of one of those packages from them and from `apps/inventory/src`, resolved through
each package's `exports` to the file it names.

It reads endings and layers only. Whether a file declares what its ending says is `laws block-files`' reading, and
is not repeated here. The table of who may hold a kind was written from what the two contexts hold today, so "wrong
layer" finding nothing says nothing; the table of who may import a kind was written first, from one rule: a screen
never loads a port, a handler or an in-memory twin.

## What was found

Of 173 files, 157 are held as they are. Sixteen are not:

- **9 take another kind's name.** Eight `.store.ts` and one `.gateway.ts` declare a `Context.Service` port, as the two
  `.port.ts` files do.
- **4 have no ending**, outside `internal/`: `Host.ts` in both hosts, and `Adapters.ts` and `Config.ts` in access's.
- **3 endings are used once**: `ItemsOfRow.reference.ts`, `ItemEditor.state.ts`, `SignIn.route.ts`. Each is a kind to
  add or a file to rename.

The doors hold already: of 269 imports that load code from a context's package (312 with the 43 `import type`), none
crosses a closed door. Ports, handlers and in-memory twins are imported 29 times, by `host` (23), `model` (4) and the
app (2), and never by `web`.

What the export keys would cost: the eight packages have 150 export keys and 312 import statements name one. Giving
each key its file's path and kind rewrites all of them.

Not covered: the other packages (kernel, drivers, client, review, infra, tooling, the app's own `src`), where most of
the repository's one-off endings are, and the 23 `.rules.ts` files of the two models, which the registry holds as one
kind without asking what each is.
