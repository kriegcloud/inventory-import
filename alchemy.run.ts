// What `bunx alchemy <deploy|plan|destroy> --stage <name>` runs from the repository root: the app's stack. Always
// name the stage: without one Alchemy uses `live_<user>`, which the stack refuses. The repository's own settings
// are a second stack, named on the command line: packages/infra/src/GitHub.stack.ts.
export { default } from "./packages/infra/src/Inventory.stack.ts"
