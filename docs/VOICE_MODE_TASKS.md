# OpenCode Web Voice Tasks

Tasks are ordered by dependency. `D` covers dictation, `V` covers Voice Mode,
and `P` covers platform/deployment work.

## Current implementation status

- D1: complete. VAD, configurable silence auto-finalization, the duration limit,
  stop, cancel, and microphone release are covered by deterministic unit tests
  driving a fake audio stack.
- D2: requesting, listening, and finalizing states and an explicit cancel control
  are integrated; component-level coverage of draft preservation and of distinct
  permission/authentication/network failures remains.
- P1: runtime meta configuration and server-side injection are implemented with
  build-time fallback.
- V1/V4: the typed client event parser and pure Voice Mode state machine,
  including barge-in effects and turn deduplication, are implemented. WebSocket,
  UI, audio playback, and the backend adapter remain capability-gated.

## Milestone 1: reliable dictation

- [x] **D1 — Recorder state and VAD**
  - Add permission, listening, finalizing, and cancellation states.
  - Detect speech before applying the silence timer.
  - Auto-finalize after configurable silence; preserve the maximum duration.
  - Acceptance: deterministic unit tests cover speech, silence, limit, stop,
    cancel, and resource cleanup.

- [ ] **D2 — Composer integration**
  - Present requesting, listening, and finalizing UI states.
  - Keep manual stop and add an accessible cancel action.
  - Insert the final transcript at the cursor without auto-submit.
  - Acceptance: component behavior preserves typed draft text and reports
    permission, authentication, and network failures distinctly.

- [x] **P1 — Runtime public configuration**
  - Define a credential-free runtime voice configuration contract.
  - Prefer runtime config over the existing Vite build-time fallback.
  - Acceptance: the same frontend artifact can enable different paths and
    capabilities in local, stage, and production environments.

- [ ] **P2 — Native voice authentication**
  - Remove the accidental dependency on a separate chat-login cookie.
  - Reuse ingress identity or exchange it for a short-lived same-site token.
  - Acceptance: `/chat/stt` succeeds from native OpenCode after normal ingress
    login and remains inaccessible without authenticated ingress context.

## Milestone 2: realtime transcription

- [ ] **P3 — LLMOps capability probe**
  - Verify streaming STT protocol, models, limits, cancellation, and latency.
  - Record whether WebSocket, WebRTC, or chunked HTTP is supported.
  - Acceptance: evidence from stage determines the adapter contract; no browser
    provider credentials are introduced.

- [ ] **V1 — Versioned realtime protocol**
  - Specify messages, binary framing, turn IDs, error codes, and reconnect rules.
  - Acceptance: shared fixtures validate client and backend protocol parsing.

- [ ] **V2 — incident-copilot realtime gateway**
  - Add `/chat/voice/ws`, origin/auth validation, quotas, and provider adapter.
  - Stream partial and final transcripts without logging content.
  - Acceptance: tests cover malformed frames, disconnect cleanup, rate limits,
    auth rejection, provider errors, and exact-turn finalization.

- [ ] **V3 — Live composer partials**
  - Stream audio frames and reconcile unstable partial text in the editor.
  - Preserve pre-existing draft content and replace only the active voice span.
  - Acceptance: partials appear before stop and final text remains editable.

## Milestone 3: conversational Voice Mode

- [ ] **P4 — TTS capability probe**
  - Verify approved voices, streaming format, first-audio latency, quotas, and
    cancellation in LLMOps or another internal service.

- [ ] **V4 — Voice Mode client state machine**
  - Add connecting, listening, thinking, speaking, muted, reconnecting, and
    error behavior in a separate UI from dictation.
  - Acceptance: transitions are deterministic and cleanup survives navigation.

- [ ] **V5 — OpenCode session bridge**
  - Submit final transcripts using normal prompt admission.
  - Stream assistant text to TTS without bypassing tools or permissions.
  - Acceptance: text history is identical to typed interaction and retries do
    not duplicate a committed turn.

- [ ] **V6 — Streaming audio and barge-in**
  - Queue/decode assistant audio with bounded buffering.
  - On speech start, flush playback and cancel the active model/TTS response.
  - Acceptance: interruption is audible within the latency budget and the next
    user turn becomes authoritative.

## Milestone 4: deployment and release

- [ ] **P5 — Image and Helm integration**
  - Build this OpenCode fork into the incident-copilot image.
  - Add independent dictation, realtime, and TTS capability flags.
  - Configure ingress WebSocket timeouts and routes.

- [ ] **P6 — Stage verification**
  - Run unit, type, browser, backend, Helm, and protocol checks.
  - Verify trusted TLS, real microphone input, auth, partial latency, three-turn
    Voice Mode, reconnect, and barge-in from stage.

- [ ] **P7 — Production rollout**
  - Keep batch fallback enabled.
  - Promote realtime transcription and Voice Mode independently.
  - Verify through approved production diagnostics and monitor error/latency
    metrics without recording transcript or audio content.

## Initial implementation boundary

The first code change implements D1 and D2 against the existing batch endpoint,
plus the client contract portion of P1. P2 and all realtime tasks require a
coordinated incident-copilot deployment and confirmed LLMOps capabilities.
