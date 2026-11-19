// The query keys of the access screens, in a module with no imports: the session controller is in the first
// download, which carries neither Effect's HTTP code nor the contract.

/**
 * The keys the access screens cache under. A change to who is in the organization makes `people` stale and writes an
 * audit line, so `activity` too.
 */
export const accessKeys = {
  /** Who is signed in and as whom (`useSession`): fetched once per page load, dropped on sign-in or a switch. */
  session: ["identity", "session"],
  members: ["identity", "members"],
  activity: ["activity"],
  people: ["people"]
} as const
