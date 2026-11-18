import { expect, it } from "@effect/vitest"
import { allowsRequest } from "../../src/server/SameOrigin.ts"

// Which requests may write. The claim that would hurt most if wrong: a write that a page on another site made the
// browser send is refused, whichever of the two headers says so, and the app's own pages are never refused.

const own = ["https://takehome.example"]
const from = (method: string, fetchSite: string | undefined, origin: string | undefined) =>
  allowsRequest({ method, fetchSite, origin, own })

it("takes a write from the app's own pages", () => {
  expect(from("POST", "same-origin", "https://takehome.example")).toBe(true)
  // A request the person made themselves (typed into the address bar, a bookmark).
  expect(from("POST", "none", undefined)).toBe(true)
  // A browser too old to send Sec-Fetch-Site still sends Origin on a write.
  expect(from("PUT", undefined, "https://takehome.example")).toBe(true)
  expect(from("DELETE", undefined, "HTTPS://takehome.EXAMPLE")).toBe(true)
})

it("refuses a write another site asked for", () => {
  expect(from("POST", "cross-site", "https://elsewhere.example")).toBe(false)
  // A sibling subdomain is another origin: "same-site" is not enough.
  expect(from("POST", "same-site", "https://other.takehome.example")).toBe(false)
  expect(from("DELETE", undefined, "https://elsewhere.example")).toBe(false)
  // A sandboxed frame or a redirect from a file sends the word "null".
  expect(from("PUT", undefined, "null")).toBe(false)
  // The browser's own statement wins over an Origin that happens to match.
  expect(from("POST", "cross-site", "https://takehome.example")).toBe(false)
  expect(from("post", "cross-site", undefined)).toBe(false)
})

it("leaves reading alone, and a request no browser page made", () => {
  expect(from("GET", "cross-site", "https://elsewhere.example")).toBe(true)
  expect(from("HEAD", "cross-site", undefined)).toBe(true)
  // A script, a test or curl sends neither header and has no visitor's browser to borrow.
  expect(from("POST", undefined, undefined)).toBe(true)
})
