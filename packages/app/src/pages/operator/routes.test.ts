import { describe, expect, test } from "bun:test"
import { isOperatorPath } from "./routes"

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
