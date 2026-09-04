# OpenCode Web Voice Tasks

Tasks are ordered by dependency. `D` covers dictation, `V` covers Voice Mode,
and `P` covers platform/deployment work.

## Current implementation status

- D1: complete. VAD, configurable silence auto-finalization, the duration limit,
  stop, cancel, and microphone release are covered by deterministic unit tests
  driving a fake audio stack.
- D2: requesting, listening, and finalizing states and an explicit cancel control
  are integrated; component-level coverage of draft preservation and of distinct
  permission/authentication/network failures remains. Verified live in a browser
  on 2026-09-04 against `script/voice-stt-dev.py`: one click records, silence
  finalizes without a second click, and the transcript lands in the composer
  without being submitted. That pass also raised D3 and D4.
- D3/D4: raised by the first live use — the running state is too quiet to see,
  and one click per utterance is too many for dictating a paragraph. Both are
  implemented and verified in a browser on 2026-09-04 by feeding Chromium a
  recording of two phrases with a pause between them: the microphone stays open
  across the pause, phrases accumulate in order, and nothing is submitted. That
  run found and fixed insertion with no separator between phrases.
- D5: raised by the target audience including Windows Chrome. Two cross-platform
  defects found by reading rather than running were fixed at once — an insecure
  origin was reported as a browser without a microphone API, and the dictation
  shortcut was bound to a letter, which under a Cyrillic layout binds to a key
  the user cannot press. The fixed speech threshold is the one that remains, and
  it fails silently, which is why it is a task rather than a note.
- P1: runtime meta configuration and server-side injection are implemented with
  build-time fallback.
- V1/V4: the typed client event parser and pure Voice Mode state machine,
  including barge-in effects and turn deduplication, are implemented. WebSocket,
  UI, audio playback, and the backend adapter remain capability-gated.
- P2/P3/P4/P5: probed live on stage 2026-09-04, see `VOICE_STAGE_PROBE.md`.
  P2 is half-answered as of 2026-09-04: incident-copilot removed the identity
  gate (MR !98), so `/chat/stt` now answers 200 with a transcript in about 1.2 s
  and dictation runs against the real endpoint. The `Authorization` header still
  does not reach the pod, so the acceptance below — identity reused from ingress
  — is not met, and the endpoint is guarded by the shared credential alone. The gateway offers
  neither streaming transcription nor a realtime API nor any TTS voice, which
  leaves Milestone 2 and Milestone 3 without a backend; batch dictation is
  unaffected and measured at 0.85-1.33 s.

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

- [ ] **D3 — Dictation is visible while it is running**
  - The microphone button changing icon is too quiet a signal: pressing it must
    show an animated indicator that recording is live, readable at a glance
    without hunting for which icon is current.
  - Distinguish `listening` from `finalizing` visually, since finalizing can
    take seconds and currently looks like nothing is happening.
  - Acceptance: a user who looks away and back can tell within a second whether
    the composer is recording, recognizing, or idle.

- [ ] **D4 — Continuous dictation until the user sends**
  - Today one click captures one utterance: silence finalizes it and the mode
    ends. Dictating a paragraph therefore costs one click per sentence.
  - Add a mode that stays in dictation across pauses, appending each recognized
    utterance to the draft, and leaves only on an explicit stop, on send, or
    after a longer idle timeout.
  - The choice between per-utterance and continuous belongs in settings, with
    the idle timeout configurable and the current behavior as one of the options.
  - Acceptance: a user can dictate several sentences with natural pauses without
    touching the button, the draft accumulates in order, and nothing is
    submitted until the user submits it.

- [x] **D5 — Speech detection must survive an unfamiliar microphone**
  - The speech threshold is a fixed RMS constant (`DEFAULT_SPEECH_THRESHOLD`),
    chosen against one microphone on one machine. Gain varies widely across
    Windows laptops and headsets.
  - Too high and no speech is ever detected: the silence rule never fires, so
    continuous dictation never cuts a phrase and per-utterance never finalizes —
    the button looks dead while the microphone is in fact open. Too low and room
    noise reads as speech, so a phrase never ends.
  - Calibrate against the noise floor measured in the first moments of capture,
    or expose the threshold as a setting, or both; and give the user a way to
    see that speech is being heard, so a mis-set threshold is diagnosable rather
    than mysterious.
  - Acceptance: dictation finalizes a phrase on a quiet laptop microphone and in
    a noisy room without either being reconfigured by hand.

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
  - Answered 2026-09-04 except limits and cancellation: no `/v1/realtime`, and
    `stream=true` returns one non-streamed body with an SSE frame stringified
    into `text`. Batch stays the only contract.

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
