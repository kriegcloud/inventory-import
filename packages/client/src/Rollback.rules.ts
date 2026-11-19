// The one rule every optimistic write rolls back by (`useOptimisticWrite` in optimistic.ts). Its own module, with no
// browser API in it, so the tests can hold it without the page's API client.

/**
 * What a failed write leaves in one cache entry: the entry as it was, when nothing has written to it since this write;
 * otherwise the entry as it is now with only this write's change taken out, so a change another write made meanwhile
 * stays. An entry dropped meanwhile stays dropped.
 *
 * @example rollback({ before: ["viewer"], written: ["editor"], now: ["editor"], undo }) // ["viewer"]: untouched since
 */
export const rollback = <Data>(entry: {
  readonly before: Data
  readonly written: Data
  readonly now: Data | undefined
  readonly undo: (now: Data, before: Data) => Data
}): Data | undefined =>
  entry.now === undefined ? undefined : entry.now === entry.written ? entry.before : entry.undo(entry.now, entry.before)
