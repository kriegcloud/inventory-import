/** Every file under `root` reachable from `entry` by static or dynamic imports, `@/` meaning `alias`. */
export declare function reachableSources(input: {
  readonly entry: string
  readonly root: string
  readonly alias: string
}): ReadonlyArray<string>
