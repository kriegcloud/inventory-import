# The scratchpad

A place to try an idea against the repository's own packages. Every package is importable by its name; an idea gets
a folder of its own under `experiments/`, from a template whose test already passes; and no check, build or deploy
reads any of it.

```sh
bun run scratch:new my-idea --template probe
bun run scratch:test my-idea
```

How to use it, what is enforced inside it and how an experiment ends: [docs/scratchpad.md](../docs/scratchpad.md).
What the ended ones taught: [LOG.md](LOG.md).
