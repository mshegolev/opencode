/**
 * The operator surface's route paths, and the predicate that recognises them.
 *
 * `app.tsx` registers exactly these paths and `RouterRoot` matches with `isOperatorPath`, so
 * both sides read from this one declaration: a new operator route added here is bypassed out
 * of the developer shell automatically, and one added only in `app.tsx` cannot silently get
 * the shell wrapped around it.
 *
 * The bypass matters because placement outside `<Route path="/:dir">` alone does not skip
 * `AppShellProviders` (titlebar, project sidebar, and the rest of the developer chrome) —
 * `Router`'s `root` wraps every route regardless of nesting.
 *
 * On operator paths `RouterRoot` renders ONLY the route's own children. The `appChildren` the
 * host passes in (`<Inner />` from `packages/desktop/src/renderer/index.tsx`) is host chrome
 * that calls `useCommand()`, and `CommandProvider` lives inside `AppShellProviders` — so
 * rendering it in the bypass branch throws and takes the whole app to the error page.
 */
export const OPERATOR_QUEUE_PATH = "/queue"
export const OPERATOR_INCIDENT_PATH = "/queue/:number"

export const OPERATOR_ROUTE_PATHS = [OPERATOR_QUEUE_PATH, OPERATOR_INCIDENT_PATH] as const

/** Each route's static head — everything before its first parameter segment, deduplicated. */
const OPERATOR_PREFIXES = [...new Set(OPERATOR_ROUTE_PATHS.map((path) => path.split("/:")[0]))]

export function isOperatorPath(pathname: string): boolean {
  return OPERATOR_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}
