import { describe, expect, test } from "bun:test"
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const DIR = join(import.meta.dir)

/**
 * Every source file under the operator directory, at any depth. Recursive on purpose: a
 * non-recursive read stops enforcing anything the moment someone adds a subdirectory — a file at
 * `operator/data/itsm.ts` would be invisible to all of these guards and they would pass in
 * silence. Plan 2 replaces the read layer and may well grow exactly that folder.
 */
function sources(): { file: string; text: string }[] {
  return readdirSync(DIR, { recursive: true })
    .map((entry) => String(entry))
    .filter((f) => (f.endsWith(".ts") || f.endsWith(".tsx")) && !f.endsWith(".test.ts") && !f.endsWith(".stories.tsx"))
    .map((file) => ({ file, text: readFileSync(join(DIR, file), "utf8") }))
}

/** Comments explain the rule; they must not be mistaken for breaking it. */
function withoutComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "")
}

/** The `{ … }` expression following `after`, brace-balanced, so indentation cannot fool it. */
function braced(text: string, after: string): string {
  const open = text.indexOf("{", text.indexOf(after) + after.length)
  expect(open).toBeGreaterThan(-1)
  let depth = 0
  for (let i = open; i < text.length; i++) {
    if (text[i] === "{") depth++
    else if (text[i] === "}" && --depth === 0) return text.slice(open, i + 1)
  }
  throw new Error(`unbalanced braces after ${after}`)
}

function offenders(pattern: RegExp): string[] {
  return sources()
    .filter(({ text }) => pattern.test(withoutComments(text)))
    .map((o) => o.file)
}

describe("the guards see the whole directory", () => {
  test("reads nested files, not only the top level", () => {
    // Every guard below is worthless if `sources()` cannot reach a nested file, and every file
    // here is top-level today — so the property is proven against a real subdirectory rather
    // than asserted about the current layout. The probe's content is deliberately innocuous, so
    // that while it exists it trips none of the guards it is standing in for.
    const probeDir = join(DIR, "__guard_probe__")
    try {
      mkdirSync(probeDir, { recursive: true })
      writeFileSync(join(probeDir, "nested.ts"), "export const probe = 1\n")

      const files = sources().map((s) => s.file)
      expect(files).toContain("sla-clock.ts")
      expect(files.some((f) => f.endsWith("nested.ts"))).toBe(true)
    } finally {
      rmSync(probeDir, { recursive: true, force: true })
    }
    expect(sources().some((s) => s.file.endsWith("nested.ts"))).toBe(false)
  })
})

describe("the operator surface is read-only", () => {
  test("imports no mutation primitive", () => {
    expect(offenders(/useMutation|createMutation/)).toEqual([])
  })

  test("makes no non-GET request", () => {
    // A mutation hook is not the only way to write. A bare `fetch` carrying a method other than
    // GET is the obvious other one, and it would sail past a guard that only knows about hooks.
    expect(offenders(/method\s*:\s*["'`](?!GET["'`])[A-Za-z]+["'`]/)).toEqual([])
  })

  test("calls no SDK write method", () => {
    expect(offenders(/\bsdk[A-Za-z0-9_.()]*\.(create|update|delete|remove|patch|post|put|write|set)\s*\(/i)).toEqual([])
  })
})

describe("the operator surface never reorders the queue", () => {
  test("sorts nothing client-side", () => {
    // Queue order mirrors the ITSM exactly: SLA urgency changes a row's colour, never its
    // position. An order the operator cannot predict is one they stop trusting.
    expect(offenders(/\.sort\(|toSorted/)).toEqual([])
  })
})

describe("the operator surface uses classes that mean what they say", () => {
  test("never writes the ambiguous bare `text-base`", () => {
    // This repo declares both `--text-base` (a 14px font size) and `--color-base` (a near
    // transparent tint), and Tailwind resolves `text-base` to the colour. Written as a font size
    // it silently paints the text `rgba(0,0,0,0.034)` — invisible, with no error anywhere. Colour
    // is spelled `text-text-base`, which this pattern deliberately does not match.
    expect(offenders(/(?<![\w-])text-base(?![\w-])/)).toEqual([])
  })
})

describe("the operator surface stays out of the developer stack", () => {
  test("imports no developer-only context", () => {
    expect(offenders(/context\/(terminal|models|permission|prompt)|useTerminal|useModels|usePermission|usePrompt/)).toEqual([])
  })

  test("does not import the session Layout", () => {
    expect(offenders(/from "@\/pages\/layout"/)).toEqual([])
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
  const appText = () => readFileSync(join(DIR, "../../app.tsx"), "utf8")

  test("app.tsx imports isOperatorPath and uses it in the router root", () => {
    expect(appText()).toMatch(/import\s*\{[^}]*\bisOperatorPath\b[^}]*\}\s*from\s*["']@\/pages\/operator\/routes["']/)

    const routerRoot = appText().match(/function RouterRoot[\s\S]*?\n}\n/)?.[0]
    expect(routerRoot).toBeDefined()
    expect(routerRoot).toMatch(/isOperatorPath\(/)
  })

  test("app.tsx registers operator routes from the shared declaration, not from literals", () => {
    // The predicate and the registrations must not be able to drift: a second operator route
    // written as a literal here would get the developer shell wrapped around it with no error.
    const routes = [...appText().matchAll(/<Route\s+path=(?:\{([^}]*)\}|"([^"]*)")/g)]
    const literalOperatorRoutes = routes.map((m) => m[2]).filter((p) => p !== undefined && /^\/queue(\/|$)/.test(p))
    expect(literalOperatorRoutes).toEqual([])
    expect(appText()).toMatch(/OPERATOR_QUEUE_PATH/)
    expect(appText()).toMatch(/OPERATOR_INCIDENT_PATH/)
  })

  test("the bypass branch renders only the route's children, never the host's chrome", () => {
    // `appChildren` is host chrome — the desktop renderer passes `<Inner />`, which calls
    // `useCommand()`. `CommandProvider` is inside `AppShellProviders`, exactly what this branch
    // skips, so rendering it here throws on the desktop build and the ErrorBoundary replaces
    // the whole app with an error page. The `fallback` must not mention `appChildren`.
    const routerRoot = appText().match(/function RouterRoot[\s\S]*?\n}\n/)?.[0]
    expect(routerRoot).toBeDefined()
    expect(withoutComments(braced(routerRoot!, "fallback="))).not.toMatch(/props\.appChildren/)
  })
})
