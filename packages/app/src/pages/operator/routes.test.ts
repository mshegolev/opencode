import { describe, expect, test } from "bun:test"
import { isOperatorPath, OPERATOR_ROUTE_PATHS } from "./routes"

describe("isOperatorPath", () => {
  test("matches the queue root", () => {
    expect(isOperatorPath("/queue")).toBe(true)
  })

  test("matches an incident under the queue", () => {
    expect(isOperatorPath("/queue/INC0048812")).toBe(true)
  })

  test("does not match the home route", () => {
    expect(isOperatorPath("/")).toBe(false)
  })

  test("does not match a developer session route", () => {
    expect(isOperatorPath("/some-dir/session/abc")).toBe(false)
  })

  test("does not match a near-miss path with no separator", () => {
    expect(isOperatorPath("/queued")).toBe(false)
  })

  test("does not match a near-miss path with a hyphen", () => {
    expect(isOperatorPath("/queue-something")).toBe(false)
  })
})

describe("the declared route paths and the predicate agree", () => {
  test("every registered operator route is recognised as an operator path", () => {
    // Not a restatement of the cases above: it walks the same list `app.tsx` registers, so a
    // route added there — and therefore here — that the predicate does not match fails loudly
    // instead of quietly getting the developer shell wrapped around it.
    const concrete = OPERATOR_ROUTE_PATHS.map((path) => path.replace(/\/:[^/]+/g, "/PARAM"))
    expect(concrete.filter((path) => !isOperatorPath(path))).toEqual([])
  })
})
