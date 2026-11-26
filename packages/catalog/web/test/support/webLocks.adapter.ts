/** The browser Web Locks API specifies exclusive mode when request options omit it. */
export const WebLocks = { mode: (options: { readonly mode?: "exclusive" | "shared" }) => options.mode ?? "exclusive" }
