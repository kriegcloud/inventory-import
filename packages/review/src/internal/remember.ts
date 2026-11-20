// What a screen works out from its inputs, kept while the inputs are the same objects: what `useMemo` did, with no
// hook. The first input is an object (an array of rows, a state); the answer is held beside it in a WeakMap, so it
// goes when that object does, and two regions on one page never share an answer for different inputs.

/**
 * `compute`, answered again only when one of its inputs is not the very object it was last time for the same first
 * input. For values worked out from what a component is given, where an atom cannot hold the input.
 *
 * @example const countsOf = remember((views: ReadonlyArray<RowView>) => count(views)) // countsOf(views) twice: one count
 */
export const remember = <First extends object, Rest extends ReadonlyArray<unknown>, A>(
  compute: (first: First, ...rest: Rest) => A
): ((first: First, ...rest: Rest) => A) => {
  const held = new WeakMap<First, { readonly rest: Rest; readonly value: A }>()
  return (first, ...rest) => {
    const before = held.get(first)
    if (
      before !== undefined &&
      before.rest.length === rest.length &&
      before.rest.every((input, i) => input === rest[i])
    )
      return before.value
    const value = compute(first, ...rest)
    held.set(first, { rest, value })
    return value
  }
}
