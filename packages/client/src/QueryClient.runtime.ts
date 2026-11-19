// How the browser caches what it fetched. The rules this file protects: data fetched a moment ago is shown as it is
// (a screen change or a remount does not ask the server again); a refusal is never retried; a mutation is never
// retried by the client; a refetch that answers what is already held keeps the object already held. The query keys
// are each web package's own.
import { QueryClient, replaceEqualDeep } from "@tanstack/react-query"
import * as Eq from "effect/Equal"
import { dual } from "effect/Function"
import { invalidate } from "@inventory/client/Api"
import { isTransient } from "@inventory/client/SayError"

/** How long fetched data is shown as it is before a screen that mounts asks again. */
export const freshFor = 30_000

/**
 * What a refetch keeps: the data already held when the answer says the same thing. TanStack Query does this by
 * itself for plain JSON, and gives up at the first value that is not (an `Option`, a `DateTime`, a `BigDecimal`), so
 * an answer holding one was a new object on every refetch, and everything memoized on it was rebuilt: the Items
 * table's columns, and with them every open row editor. Effect's equality reads those values, so it is asked first.
 */
export const sameWhenEqual: {
  (answered: unknown): (held: unknown) => unknown
  (held: unknown, answered: unknown): unknown
} = dual(2, (held: unknown, answered: unknown): unknown =>
  Eq.equals(held, answered) ? held : replaceEqualDeep(held, answered)
)

/**
 * The tab's one query client. Queries: fresh for `freshFor`, no refetch when the window regains focus, one more try
 * only for a failure that may pass (the network, a server error). Mutations are never retried by the client: a
 * button is disabled while its request is pending, and the server treats a repeated write as the same write.
 */
/**
 * The query client, with one addition while the screens move to atoms (goals/atoms): what a screen on TanStack Query
 * invalidates is said to the atoms too, so an import confirmed on the catalog screens still makes the audit trail (an
 * atom since the access screens moved) ask again. Goes with TanStack Query, at the end of the move.
 */
class BridgedQueryClient extends QueryClient {
  override invalidateQueries(...args: Parameters<QueryClient["invalidateQueries"]>) {
    const key = args[0]?.queryKey
    if (key !== undefined) invalidate(key)
    return super.invalidateQueries(...args)
  }
}

export const queryClient = new BridgedQueryClient({
  defaultOptions: {
    queries: {
      staleTime: freshFor,
      refetchOnWindowFocus: false,
      structuralSharing: sameWhenEqual,
      retry: (failures, error) => failures < 1 && isTransient(error)
    },
    mutations: { retry: false }
  }
})
