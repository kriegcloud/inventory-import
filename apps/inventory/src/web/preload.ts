// What a signed-in member's first screen needs, started at once: the workspace's code, the current page's code and,
// for an open import, its view and rows. Asked for on a hint (someone was signed in here last time, or the session's
// answer says so before it is decoded); what is drawn still waits for the decoded session. A wrong hint only fetches
// code nobody runs.
import { apiPrefix } from "../api/v1/Version.ts"
import * as O from "effect/Option"
import * as UrlParams from "effect/http/UrlParams"
import { early } from "@inventory/client/Early"

/** The workspace's chunk: the shell's sidebar, the API client and every page's way in. */
export const workspace = () => import("./Workspace.tsx")

// The code of the page the address names, for the moment the workspace asks for it. Asked for with the workspace's
// chunk, so the two arrive together instead of one after the other.
const pageCode = (path: string, step: O.Option<string>): ReadonlyArray<() => Promise<unknown>> =>
  path === "/items"
    ? [() => import("@inventory/catalog-web/ItemsPage")]
    : path === "/activity"
      ? [() => import("@/pages/ActivityPage")]
      : path === "/people"
        ? [() => import("@inventory/access-web/People")]
        : O.contains(step, "review")
          ? [() => import("@inventory/catalog-web/ImportPage"), () => import("@inventory/catalog-web/ReviewStep")]
          : O.contains(step, "result")
            ? [() => import("@inventory/catalog-web/ImportPage"), () => import("@inventory/catalog-web/ResultStep")]
            : [() => import("@inventory/catalog-web/ImportPage")]

let preloaded = false
/** Starts the first screen's code and, for an open import, its data, once per page. */
export const preload = () => {
  if (preloaded) return
  preloaded = true
  void workspace()
  const params = UrlParams.fromInput(new URLSearchParams(window.location.search))
  const opened = UrlParams.getFirst(params, "import")
  for (const load of pageCode(
    window.location.pathname,
    O.flatMap(opened, () => UrlParams.getFirst(params, "step"))
  ))
    void load()
  // The import page's and the breadcrumb's atoms (`importViewShown`, `importTable`) take these answers on their first
  // request (`takeEarly`): asked for now, they are on their way before the page's code has loaded. Nothing else asks.
  O.map(
    O.filter(opened, (id) => id.length <= 64),
    (id) => {
      early(`${apiPrefix}/imports/${encodeURIComponent(id)}`)
      early(`${apiPrefix}/imports/${encodeURIComponent(id)}/table`)
    }
  )
}
