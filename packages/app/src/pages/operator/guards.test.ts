import { describe, expect, test } from "bun:test"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

const DIR = join(import.meta.dir)

function sources(): { file: string; text: string }[] {
  return readdirSync(DIR)
    .filter((f) => (f.endsWith(".ts") || f.endsWith(".tsx")) && !f.endsWith(".test.ts") && !f.endsWith(".stories.tsx"))
    .map((file) => ({ file, text: readFileSync(join(DIR, file), "utf8") }))
}

describe("the operator surface is read-only", () => {
  test("imports no mutation primitive", () => {
    const offenders = sources().filter(({ text }) => /useMutation|createMutation/.test(text))
    expect(offenders.map((o) => o.file)).toEqual([])
  })
})

describe("the operator surface stays out of the developer stack", () => {
  test("imports no developer-only context", () => {
    const banned = /context\/(terminal|models|permission|prompt)|useTerminal|useModels|usePermission|usePrompt/
    const offenders = sources().filter(({ text }) => banned.test(text))
    expect(offenders.map((o) => o.file)).toEqual([])
  })

  test("does not import the session Layout", () => {
    const offenders = sources().filter(({ text }) => /from "@\/pages\/layout"/.test(text))
    expect(offenders.map((o) => o.file)).toEqual([])
  })
})

describe("the operator route mount bypasses the developer shell", () => {
  // This does not prove the bypass works at runtime — no test in this suite renders the
  // provider tree, and `routes.test.ts` is what covers `isOperatorPath`'s own behaviour.
  // It only proves the wiring in app.tsx that calls `isOperatorPath` to skip
  // `AppShellProviders` for operator paths is still present in the source text. If a future
  // edit deletes that call (or the import it depends on) while leaving every operator file's
  // own imports clean, this is the guard that catches it — an import grep over this
  // directory alone cannot, because the mount happens in `app.tsx`, outside this directory.
  test("app.tsx imports isOperatorPath and uses it in the router root", () => {
    const appText = readFileSync(join(DIR, "../../app.tsx"), "utf8")

    expect(appText).toMatch(/import\s*\{[^}]*\bisOperatorPath\b[^}]*\}\s*from\s*["']@\/pages\/operator\/routes["']/)

    const routerRoot = appText.match(/function RouterRoot[\s\S]*?\n}\n/)?.[0]
    expect(routerRoot).toBeDefined()
    expect(routerRoot).toMatch(/isOperatorPath\(/)
  })
})
