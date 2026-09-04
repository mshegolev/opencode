/**
 * Where telemetry goes, and under whose name.
 *
 * Two vocabularies reach this process. `OTEL_EXPORTER_OTLP_*` is the standard
 * one and takes precedence. `OPENCODE_OTEL_*` is what the incident-copilot chart
 * has been setting all along — and because nothing read those names, every span
 * went to a no-op tracer while the deployment read as configured. Accepting them
 * here is what turns that configuration into telemetry, without a change on the
 * deployment's side.
 *
 * The same reasoning governs the failure mode. Asking for export and getting
 * silence is what hid the problem, so a request that cannot be honoured must
 * come back with a reason the caller can print.
 */

export type ExporterEnv = Record<string, string | undefined>

export type ExporterConfig = {
  endpoint?: string
  headers?: Record<string, string>
  /** Whether the endpoint takes OTLP logs as well as traces. */
  logs: boolean
  serviceName?: string
  environment?: string
  /** Set when export was asked for and could not be configured. */
  problem?: string
}

/** Langfuse publishes one OTLP path, and it ingests traces only. */
const LANGFUSE_OTLP_PATH = "/api/public/otel"

function trimmed(value: string | undefined) {
  const out = value?.trim()
  return out ? out : undefined
}

function truthy(value: string | undefined) {
  const out = trimmed(value)?.toLowerCase()
  return out === "1" || out === "true" || out === "yes"
}

function explicitlyOff(value: string | undefined) {
  const out = trimmed(value)?.toLowerCase()
  return out === "0" || out === "false" || out === "no"
}

function parseHeaders(value: string | undefined): Record<string, string> | undefined {
  const raw = trimmed(value)
  if (!raw) return undefined
  const out: Record<string, string> = {}
  for (const entry of raw.split(",")) {
    // A header value may itself contain "=", so only the first one separates.
    const [key, ...rest] = entry.split("=")
    const name = key?.trim()
    if (!name) continue
    out[name] = rest.join("=").trim()
  }
  return Object.keys(out).length ? out : undefined
}

export function isLangfuseEndpoint(endpoint: string) {
  return new URL(endpoint).pathname.replace(/\/+$/, "").endsWith(LANGFUSE_OTLP_PATH)
}

export function resolveExporter(env: ExporterEnv): ExporterConfig {
  const serviceName = trimmed(env.OPENCODE_OTEL_SERVICE_NAME)
  const environment = trimmed(env.OPENCODE_OTEL_ENVIRONMENT)
  const standard = trimmed(env.OTEL_EXPORTER_OTLP_ENDPOINT)
  const own = trimmed(env.OPENCODE_OTEL_ENDPOINT)
  const asked = truthy(env.OPENCODE_OTEL_ENABLED)
  const off = explicitlyOff(env.OPENCODE_OTEL_ENABLED)

  // An off switch is an answer, not an omission: it must beat an endpoint that
  // outlived it in the environment.
  if (off) return { logs: false, serviceName, environment }

  const endpoint = standard ?? (asked ? own : undefined)
  if (!endpoint) {
    return {
      logs: false,
      serviceName,
      environment,
      problem: asked ? "OPENCODE_OTEL_ENABLED is set but OPENCODE_OTEL_ENDPOINT is empty" : undefined,
    }
  }

  const langfuse = isLangfuseEndpoint(endpoint)
  const explicit = parseHeaders(env.OTEL_EXPORTER_OTLP_HEADERS)
  const publicKey = trimmed(env.LANGFUSE_PUBLIC_KEY)
  const secretKey = trimmed(env.LANGFUSE_SECRET_KEY)

  let headers = explicit
  let problem: string | undefined
  if (!headers && (publicKey || secretKey)) {
    if (publicKey && secretKey) headers = { Authorization: `Basic ${btoa(`${publicKey}:${secretKey}`)}` }
    else problem = `Langfuse needs both keys; ${publicKey ? "LANGFUSE_SECRET_KEY" : "LANGFUSE_PUBLIC_KEY"} is empty`
  } else if (!headers && langfuse) {
    problem = "Langfuse rejects unauthenticated OTLP; set LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY"
  }

  return { endpoint, headers, logs: !langfuse, serviceName, environment, problem }
}
