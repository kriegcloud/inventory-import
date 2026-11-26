// Nullable browser reads become Options here. Selectors and DOM ownership stay with their callers.
import * as O from "effect/Option"

/** Finds a node at the moment the caller needs it. */
export const query = <A extends Element = HTMLElement>(input: {
  readonly selector: string
  readonly root: ParentNode
}): O.Option<A> => O.fromNullOr(input.root.querySelector<A>(input.selector))

/** Reads a mounted file picker through its React DOM ref, then reads its input. */
export const inputInPicker = (ref: { readonly current: HTMLDivElement | null }): O.Option<HTMLInputElement> =>
  O.flatMap(O.fromNullOr(ref.current), (root) => query<HTMLInputElement>({ selector: 'input[type="file"]', root }))

/** A DOM dataset key may be absent; its empty string still means present. */
export const data =
  (key: string) =>
  (node: HTMLElement): O.Option<string> =>
    O.fromUndefinedOr(node.dataset[key])

/** URLSearchParams distinguishes a missing key from an explicitly empty value. */
export const parameter =
  (key: string) =>
  (params: URLSearchParams): O.Option<string> =>
    O.fromNullOr(params.get(key))

/** A drop may have no transfer; a present empty FileList remains present. */
export const droppedFiles = (event: DragEvent): O.Option<FileList> => O.fromNullishOr(event.dataTransfer?.files)

/** Converts React's nullable DOM callback argument at callback entry, preserving its cleanup return. */
export const refCallback =
  <A extends Element, B>(use: (node: O.Option<A>) => B) =>
  (node: A | null): B =>
    use(O.fromNullOr(node))
