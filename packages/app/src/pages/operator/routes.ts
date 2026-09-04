/**
 * Which pathnames belong to the operator surface. `RouterRoot` in `app.tsx` uses this to skip
 * `AppShellProviders` (titlebar, project sidebar, and the rest of the developer chrome) for
 * these paths — placement outside `<Route path="/:dir">` alone does not do that, because
 * `Router`'s `root` wraps every route regardless of nesting.
 */
export function isOperatorPath(pathname: string): boolean {
  return pathname === "/queue" || pathname.startsWith("/queue/")
}
