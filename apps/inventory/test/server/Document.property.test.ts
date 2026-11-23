// The OpenAPI document folds a numbered copy of a component (`RowDecision_1`) into its original only when the two say
// the same thing. A fold that joined two different schemas would make the document lie about a payload, so the
// comparison is held here against a form of each part written out by hand: keys sorted, a list and an object never
// alike. A part that is not JSON (an undefined value, a number that is not finite) is folded only into the very same
// value, which cannot say anything else.
import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Arbitrary from "effect/Arbitrary"
import * as Effect from "effect/Effect"
import * as Match from "effect/Match"
import * as O from "effect/Option"
import * as Order from "effect/Order"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import { describeDocument } from "../../src/api/v1/Document.ts"

/** A part of a document as drawn: a JSON value, or one a generator may leave that JSON cannot hold. */
type Drawn =
  | { readonly _tag: "Leaf"; readonly value: null | boolean | number | string }
  | { readonly _tag: "Odd"; readonly odd: "undefined" | "NaN" | "Infinity" }
  | { readonly _tag: "List"; readonly items: ReadonlyArray<Drawn> }
  | { readonly _tag: "Object"; readonly entries: ReadonlyArray<readonly [string, Drawn]> }

const Inner = S.suspend((): S.Codec<Drawn> => Drawn)
const Leaf = S.TaggedStruct("Leaf", {
  value: S.Union([S.Null, S.Boolean, S.Int.check(S.isBetween({ minimum: 0, maximum: 3 })), S.Literals(["s", "t"])])
})
const Odd = S.TaggedStruct("Odd", { odd: S.Literals(["undefined", "NaN", "Infinity"]) })
const List = S.TaggedStruct("List", { items: S.Array(Inner).check(S.isMaxLength(3)) })
/** An object as its entries in the order written; one-character keys, so a key is often written twice. */
const Entries = S.TaggedStruct("Object", {
  entries: S.Array(S.Tuple([S.String.check(S.isMaxLength(1)), Inner])).check(S.isMaxLength(3))
})
const Drawn: S.Codec<Drawn> = S.Union([Leaf, Odd, List, Entries])

/** How the copy is made from the original: drawn on its own, the same with its keys in reverse, lists made objects. */
const Pair = S.Struct({
  original: Drawn,
  other: Drawn,
  copy: S.Literals(["drawn", "reordered", "listsAsObjects"])
})

/** An object's entries as JSON keeps them: a key written twice holds its last value. */
const lastOfEach = (entries: ReadonlyArray<readonly [string, Drawn]>): ReadonlyArray<readonly [string, Drawn]> =>
  R.toEntries(R.fromEntries(entries))

const valueOf = (drawn: Drawn): unknown =>
  Match.valueTags(drawn, {
    Leaf: (leaf) => leaf.value,
    Odd: (odd) => (odd.odd === "undefined" ? undefined : odd.odd === "NaN" ? Number.NaN : Number.POSITIVE_INFINITY),
    List: (list) => A.map(list.items, valueOf),
    Object: (object) => R.fromEntries(A.map(lastOfEach(object.entries), ([key, value]) => [key, valueOf(value)]))
  })

const reordered = (drawn: Drawn): Drawn =>
  Match.valueTags(drawn, {
    Leaf: (leaf): Drawn => leaf,
    Odd: (odd): Drawn => odd,
    List: (list): Drawn => List.make({ items: A.map(list.items, reordered) }),
    Object: (object): Drawn =>
      Entries.make({
        entries: A.map(A.reverse(lastOfEach(object.entries)), ([key, value]) => [key, reordered(value)] as const)
      })
  })

const listsAsObjects = (drawn: Drawn): Drawn =>
  Match.valueTags(drawn, {
    Leaf: (leaf): Drawn => leaf,
    Odd: (odd): Drawn => odd,
    List: (list): Drawn =>
      Entries.make({ entries: A.map(list.items, (item, index) => [`${index}`, listsAsObjects(item)] as const) }),
    Object: (object): Drawn =>
      Entries.make({ entries: A.map(object.entries, ([key, value]) => [key, listsAsObjects(value)] as const) })
  })

/** The part written out with its keys sorted, or nothing when JSON cannot hold it. */
const written = (drawn: Drawn): O.Option<string> =>
  Match.valueTags(drawn, {
    Leaf: (leaf) => O.some(leaf.value === null ? "null" : `${typeof leaf.value}:${leaf.value}`),
    Odd: () => O.none(),
    List: (list) => O.map(O.all(A.map(list.items, written)), (items) => `[${A.join(items, ",")}]`),
    Object: (object) =>
      O.map(
        O.all(
          A.map(
            A.sort(
              lastOfEach(object.entries),
              Order.mapInput(Order.String, ([key]: readonly [string, Drawn]) => key)
            ),
            ([key, value]) => O.map(written(value), (text) => `${key}=${text}`)
          )
        ),
        (entries) => `{${A.join(entries, ",")}}`
      )
  })

describe("the document's components", () => {
  it.effect.prop(
    "a numbered copy is folded into its original exactly when both are JSON and say the same thing, and a part that " +
      "is not JSON only into the very same value",
    [Arbitrary.schema(Pair)],
    ([pair]) =>
      Effect.sync(() => {
        const copy =
          pair.copy === "drawn"
            ? pair.other
            : pair.copy === "reordered"
              ? reordered(pair.original)
              : listsAsObjects(pair.original)
        const [first, second] = [valueOf(pair.original), valueOf(copy)]
        const spec = describeDocument({ paths: {}, components: { schemas: { Part: first, Part_1: second } } })
        const folded = !R.has(spec["components"]["schemas"], "Part_1")
        expect(R.keys(spec["components"]["schemas"])).toContain("Part")
        const [original, copied] = [written(pair.original), written(copy)]
        if (O.isSome(original) && O.isSome(copied)) expect(folded).toBe(original.value === copied.value)
        else expect(folded && first !== second).toBe(false)
      }),
    { arbitrary: { runs: 500 } }
  )
})
