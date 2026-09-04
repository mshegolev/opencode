import { describe, expect, test } from "bun:test"
import { resolveExporter } from "../src/effect/observability-exporter"

describe("resolveExporter", () => {
  test("uses the standard OTLP variables when they are set", () => {
    const out = resolveExporter({
      OTEL_EXPORTER_OTLP_ENDPOINT: "http://collector:4318",
      OTEL_EXPORTER_OTLP_HEADERS: "x-key=value,x-other=a=b",
    })
    expect(out.endpoint).toBe("http://collector:4318")
    expect(out.headers).toEqual({ "x-key": "value", "x-other": "a=b" })
    expect(out.logs).toBeTrue()
    expect(out.problem).toBeUndefined()
  })

  test("accepts the deployment's own names, which is what the chart actually sets", () => {
    const out = resolveExporter({
      OPENCODE_OTEL_ENABLED: "true",
      OPENCODE_OTEL_ENDPOINT: "http://langfuse:3000/api/public/otel",
      LANGFUSE_PUBLIC_KEY: "pk",
      LANGFUSE_SECRET_KEY: "sk",
    })
    expect(out.endpoint).toBe("http://langfuse:3000/api/public/otel")
    // Langfuse authenticates OTLP with the project keys as HTTP basic auth.
    expect(out.headers).toEqual({ Authorization: `Basic ${btoa("pk:sk")}` })
  })

  test("does not ship logs to an endpoint that only ingests traces", () => {
    const langfuse = resolveExporter({
      OPENCODE_OTEL_ENABLED: "1",
      OPENCODE_OTEL_ENDPOINT: "http://lf/api/public/otel/",
    })
    expect(langfuse.logs).toBeFalse()
    const collector = resolveExporter({ OTEL_EXPORTER_OTLP_ENDPOINT: "http://collector:4318" })
    expect(collector.logs).toBeTrue()
  })

  test("says so when export is asked for and cannot be configured", () => {
    const out = resolveExporter({ OPENCODE_OTEL_ENABLED: "true" })
    expect(out.endpoint).toBeUndefined()
    expect(out.problem).toContain("OPENCODE_OTEL_ENDPOINT")
  })

  test("says so when a Langfuse endpoint is given only half its credentials", () => {
    const out = resolveExporter({
      OPENCODE_OTEL_ENABLED: "true",
      OPENCODE_OTEL_ENDPOINT: "http://langfuse:3000/api/public/otel",
      LANGFUSE_PUBLIC_KEY: "pk",
    })
    expect(out.endpoint).toBe("http://langfuse:3000/api/public/otel")
    expect(out.headers).toBeUndefined()
    expect(out.problem).toContain("LANGFUSE_SECRET_KEY")
  })

  test("stays silent and disabled when nothing asked for export", () => {
    const out = resolveExporter({})
    expect(out.endpoint).toBeUndefined()
    expect(out.problem).toBeUndefined()
  })

  test("an explicit off switch wins over an endpoint left in the environment", () => {
    const out = resolveExporter({
      OPENCODE_OTEL_ENABLED: "false",
      OPENCODE_OTEL_ENDPOINT: "http://langfuse:3000/api/public/otel",
    })
    expect(out.endpoint).toBeUndefined()
    expect(out.problem).toBeUndefined()
  })
})
