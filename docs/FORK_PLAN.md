# What this fork still has to do

Two tracks: microphone input for the web UI, and getting the fork's own model
I/O into Langfuse. Status as of 2026-09-04. Track A's items live in
`VOICE_MODE_TASKS.md`; this file adds what is left and why, and covers Track B
from scratch.

Everything below was read from the two repositories or probed live against
stage. Where something is inferred rather than observed, it says so.

## Track A — microphone input

Working end to end: recording, voice activity detection, silence
auto-finalization, continuous dictation, insertion at the cursor without
submitting, a cancel control, a shortcut, and both the local stand-in
(`script/voice-stt-dev.py`) and the real stage endpoint. Verified in a browser
on 2026-09-04.

What remains, in the order it should be done.

- [x] **A1 — Verify continuous dictation in a browser (was D3/D4)** — done
      2026-09-04, headless Chromium fed a recording of two phrases separated by a
      two-second pause (`--use-file-for-fake-audio-capture`), recognized by
      stage.
  - Confirmed: the button renders and reaches `listening`; the cancel control
    appears only while recording; the pulsing ring is drawn; the first phrase is
    inserted while the state is still `listening`, so the microphone does not
    close after one phrase; the second is appended in order; nothing is
    submitted.
  - Found one defect, since fixed: phrases were inserted with no separator and
    welded together. The unit tests could not have caught it — they stop at the
    recorder, and this lives in the composer.

- [ ] **A2 — Speech detection must survive an unfamiliar microphone (D5)**
  - A fixed RMS constant chosen against one microphone. Fails silently in both
    directions; the button looks dead while the microphone is open.
  - The one thing blocking handing the branch to someone else.

- [ ] **A3 — Composer test coverage (D2)**
  - Draft preservation and distinct permission/authentication/network failures
    are implemented and manually confirmed, not pinned by tests.

- [ ] **A4 — Identity for `/chat/stt` (P2, blocked outside this repo)**
  - incident-copilot reopened the endpoint by removing the lock (MR !98), so
    dictation works, but the `Authorization` header still does not reach the
    pod. Nothing records who spent recognition quota. Their issue #1 is open.
  - Nothing to do on the client: the browser already sends the header.

- [ ] **A5 — Ship the fork (P5/P6)**
  - Stage still serves upstream OpenCode: no `opencode-voice-config` meta tag,
    no microphone. None of this is deployed anywhere yet.

Realtime transcription and Voice Mode (Milestones 2 and 3) stay parked: the
gateway has no streaming endpoint and no TTS voice. See `VOICE_STAGE_PROBE.md`.

## Track B — model I/O into Langfuse

### The finding this track starts from

The deployment believes the fork exports telemetry. It does not, and cannot,
because the two sides use different variable names.

| Side | Names |
|---|---|
| Chart, `templates/deployment.yaml` | `OPENCODE_OTEL_ENABLED`, `OPENCODE_OTEL_ENDPOINT` (`<langfuseHost>/api/public/otel`), `OPENCODE_OTEL_SERVICE_NAME`, `OPENCODE_OTEL_SAMPLE_RATIO`, `OPENCODE_OTEL_ENVIRONMENT` |
| Fork, `packages/core/src/flag/flag.ts` | `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS` |

`Observability.enabled` is `!!Flag.OTEL_EXPORTER_OTLP_ENDPOINT`, so with only
the chart's variables set the exporter never starts and every span is dropped
into a no-op tracer. `values-stage.yaml` and `values-prod.yaml` both set
`opencodeOtelEnabled: true`, so the configuration reads as working on both
contours.

The pieces that are already right: `experimental.openTelemetry: true` is set in
the sidecar's `opencode.json`, so the AI SDK is asked to emit spans carrying
prompt and completion; `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY` reach
both containers through `envFrom`; and Langfuse ingests OTLP at
`/api/public/otel`, which incident-copilot's own `orchestrator/tracing.py`
documents.

Not verified: that Langfuse currently holds no opencode traces. That needs a
Langfuse API key, which is not in the project's CI variables. The code path is
conclusive on its own, but the plan should open by confirming it from the
Langfuse side.

### Tasks

- [ ] **B1 — Agree on one set of variable names, and make silence impossible**
  - Either the fork honours `OPENCODE_OTEL_*` or the chart sets the OTLP names.
    The chart is the cheaper side to change; the fork's names are the standard
    ones and are what any other deployment would set.
  - Whichever way it goes, asking for telemetry and getting a silent no-op is
    the defect that hid this. When export is requested and cannot be configured,
    the process must say so at startup.
  - Acceptance: with the environment the chart provides, one span from a real
    chat turn is visible in Langfuse, and a deliberately broken endpoint
    produces a named error rather than silence.

- [ ] **B2 — Authenticate the exporter to Langfuse**
  - Langfuse wants `Authorization: Basic base64(public_key:secret_key)`. The
    keys are in the pod; nothing composes the header. Either the chart builds
    `OTEL_EXPORTER_OTLP_HEADERS` from them, or the fork learns to build it from
    `LANGFUSE_*` — the second keeps the secret out of a variable whose whole
    contents are a header, and makes the fork usable against Langfuse anywhere.
  - Acceptance: ingestion returns 2xx; a wrong key is reported, not swallowed.

- [ ] **B3 — Confirm what Langfuse renders**
  - The AI SDK emits `ai.*` spans; Langfuse has first-class mapping for them.
    Confirm a chat turn appears as a generation with input, output and model,
    and that `metadata.userId` and `sessionId` — already passed at
    `session/llm.ts` — land as Langfuse's user and session.
  - Acceptance: a named turn is findable in Langfuse by session id, with the
    prompt and the completion readable.

- [ ] **B4 — Decide what happens to `OPENCODE_OTEL_SAMPLE_RATIO`**
  - The fork has no notion of sampling ratio. Implement it or remove it from
    the chart: a knob that silently does nothing is worse than no knob, and this
    track exists because of exactly that.

- [ ] **B5 — Token usage and cost**
  - `orchestrator/tracing.py` already records that this provider returns no
    usage, so Langfuse cost stays zero. Decide whether the fork can report token
    counts from the provider response, or whether cost is knowingly out of scope.

- [ ] **B6 — Say plainly what leaves the process**
  - Prompts and completions carry incident content, and with Track A they carry
    transcripts of spoken incident detail. Orchestrator I/O already goes to
    Langfuse, so there is precedent, but that decision was made about a
    different surface and did not consider speech.
  - Audio must never be exported, and the recognized text must be treated as the
    same class of data as a typed prompt.
  - Acceptance: a written decision naming who may read the traces, a retention
    answer, and a kill switch that is one value.

- [ ] **B7 — Attribution depends on Track A's blocker**
  - `metadata.userId` is `cfg.username ?? "unknown"`, and the sidecar has no
    username, so every trace lands as one user. Per-engineer attribution needs
    the same `Authorization` header as A4.
  - Worth saying in incident-copilot's issue #1: the header is not only about
    who dictates, it is also about whose traces these are.

- [ ] **B8 — Verify on stage**
  - A chat turn through the deployed web UI appears in Langfuse with input and
    output, tagged with the environment and the service name the chart sets.

## What the two tracks share

Both end at the same wall: the `Authorization` header does not reach the pod, so
neither the microphone nor the traces can say who this was. A4 and B7 are one
fix owned by another repository, and they are worth pressing as one item rather
than two.

## Order

1. A1, because it is minutes and can invalidate work already done.
2. B1 and B2 together — until they are done, no observability question can be
   answered by looking rather than by reasoning.
3. A2, then B3 and B6.
4. A3, B4, B5.
5. A5 and B8 together: the fork has to be in the image before either can be
   verified where it matters.
