/**
 * Every file under `root`, or inside one of the workspace `packages` (name to folder), reachable from `entry` by
 * static or dynamic imports, `@/` meaning `alias` and a package specifier meaning the file its exact export names.
 */
export declare function reachableSources(input: {
  readonly entry: string
  readonly root: string
  readonly alias: string
  readonly packages?: Readonly<Record<string, string>>
}): ReadonlyArray<string>
