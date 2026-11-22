# @beep/schema (vendored subset)

The part of beep-effect's `@beep/schema` that inventory-import's format packages use, copied from beep-effect commit
`c5cebd5c9de7` (`packages/foundation/modeling/schema`). beep-effect publishes none of its kit packages, so the subset lives
here under the same name and the same export subpaths, and is replaced by the published package when one exists.

- **Do not edit** `src/` or the copied tests. Change the code in beep-effect and run
  `bun run beep vendor sync --from <beep-effect checkout>` again.
- `vendor.json` records the commit and, for every copied file, the SHA-256 of the upstream file and of the copy (each
  copy starts with one provenance line, which the hash leaves out). `bun run vendor:check` fails when they differ.
- Copied tests have their imports of beep-effect's test runner and run-count helper rewritten (each rewrite is listed
  in `vendor.json`); `test/support/fcRuns.ts`, when present, stands in for the run-count helper.
- A source file, or a copied test beyond its rewrites, differs from upstream only by a patch
  `bun run beep vendor sync` applies (`sourcePatches`), recorded with its reason under `patches` in
  `vendor.json` and named in the file's first line.
- Licensed under MIT, as the package's own LICENSE file in beep-effect says (`LICENSE`, copied unchanged).
