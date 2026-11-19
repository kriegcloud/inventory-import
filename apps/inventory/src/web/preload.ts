// What a signed-in member's first screen needs, started at once: the workspace's code, the current page's code and,
// for an open import, its view and rows. Asked for on a hint (someone was signed in here last time, or the session's
// answer says so before it is decoded); what is drawn still waits for the decoded session. A wrong hint only fetches
// code nobody runs.
import { apiPrefix } from "../api/v1/Version.ts"
import { early } from "@inventory/client/Early"

/** The workspace's chunk: the shell's sidebar, the API client and every page's way in. */
export const workspace = () => import("./Workspace.tsx")

// The code of the page the address names, for the moment the workspace asks for it. Asked for with the workspace's
// chunk, so the two arrive together instead of one after the other.
const pageCode = (path: string, step: string | null): ReadonlyArray<() => Promise<unknown>> =>
  path === "/items"
    ? [() => import("@/pages/ItemsPage")]
    : path === "/activity"
      ? [() => import("@/pages/ActivityPage")]
      : path === "/people"
        ? [() => import("@inventory/access-web/People")]
        : step === "review"
          ? [() => import("@/pages/ImportPage"), () => import("@/pages/import/ReviewStep")]
          : step === "result"
            ? [() => import("@/pages/ImportPage"), () => import("@/pages/import/ResultStep")]
            : [() => import("@/pages/ImportPage")]

let preloaded = false
/** Starts the first screen's code and, for an open import, its data, once per page. */
export const preload = () => {
  if (preloaded) return
  preloaded = true
  void workspace()
  const params = new URLSearchParams(window.location.search)
  const opened = params.get("import")
  for (const load of pageCode(window.location.pathname, opened === null ? null : params.get("step"))) void load()
  // The workspace asks for these as its chunk runs (Workspace.tsx); asked for now, they are on their way already.
  if (opened !== null && opened.length <= 64) {
    early(`${apiPrefix}/imports/${encodeURIComponent(opened)}`)
    early(`${apiPrefix}/imports/${encodeURIComponent(opened)}/table`)
  }
}
