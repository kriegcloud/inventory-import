// How the browser caches what it fetched. The rules this file protects: data fetched a moment ago is shown as it is
// (a screen change or a remount does not ask the server again); a refusal is never retried; a mutation is never
// retried by the client. The query keys are each web package's own.
import { QueryClient } from "@tanstack/react-query"
import { isTransient } from "@inventory/client/SayError"

/** How long fetched data is shown as it is before a screen that mounts asks again. */
export const freshFor = 30_000

/**
 * The tab's one query client. Queries: fresh for `freshFor`, no refetch when the window regains focus, one more try
 * only for a failure that may pass (the network, a server error). Mutations are never retried by the client: a
 * button is disabled while its request is pending, and the server treats a repeated write as the same write.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: freshFor,
      refetchOnWindowFocus: false,
      retry: (failures, error) => failures < 1 && isTransient(error)
    },
    mutations: { retry: false }
  }
})
