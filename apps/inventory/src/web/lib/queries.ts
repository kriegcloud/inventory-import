// The query cache, while TanStack Query is still provided at the root (goals/atoms, step 8). No screen reads through
// it any more: every read is an atom (`@inventory/client/Api`).
export { queryClient } from "@inventory/client/QueryClient"
