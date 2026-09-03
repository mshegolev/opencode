# OpenCode Web Voice

Status: implementation baseline  
Owners: OpenCode Web and incident-copilot  
Target environments: local, stage, production

## Problem

The existing microphone control records an entire WAV file, waits for a second
click, uploads the file to a batch STT endpoint, and only then inserts text into
the composer. The configured endpoint is embedded at frontend build time. This
does not provide live feedback, automatic end-of-turn detection, or a
conversational voice mode.

## Goals

### Dictation

- Start capture with one click.
- Show a clear listening state immediately.
- Detect speech and finalize after a configurable silence interval.
- Keep manual stop and cancel controls.
- Insert the final transcript at the cursor without submitting it.
- Preserve the current batch WAV endpoint as a compatible fallback.
- Support runtime deployment configuration without exposing credentials.

### Voice Mode

- Provide a separate conversational control from the dictation microphone.
- Run a continuous `listening -> thinking -> speaking -> listening` loop.
- Submit final user transcripts through the normal OpenCode session path.
- Render assistant text normally while streaming assistant audio.
- Support barge-in by stopping playback and cancelling the active response when
  the user starts speaking.
- Keep mute, explicit stop, reconnect, and exit controls available.

## Non-goals

- Shipping API credentials to the browser.
- Replacing OpenCode session, permission, or tool execution semantics.
- Simulating live partials by repeatedly uploading overlapping WAV files.
- Claiming production Voice Mode support before the internal gateway exposes
  supported realtime STT and TTS capabilities.

## User experience

### Dictation state model

`idle -> requesting_permission -> listening -> finalizing -> idle`

The microphone remains in the composer. Silence auto-finalization starts only
after speech has been detected, avoiding an immediate stop while the user is
getting ready. The default end-of-turn silence is 1,200 ms. The final transcript
is editable and is never auto-submitted.

### Voice Mode state model

`closed -> connecting -> listening -> thinking -> speaking -> listening`

`muted`, `reconnecting`, and `error` are explicit auxiliary states. Speaking
while assistant audio is playing triggers barge-in: playback is flushed, the
active response is cancelled, and input capture becomes authoritative.

## Architecture

### Browser

- Capture mono audio through Web Audio.
- Use local voice activity detection for responsive speech-start and silence
  events.
- Use batch `POST` for the initial dictation release.
- Use a same-origin WebSocket for streaming transcription and Voice Mode when
  the deployment advertises those capabilities.
- Consume public runtime configuration from the serving OpenCode process.

### OpenCode integration

- Dictation inserts text into the existing prompt editor.
- Voice Mode submits final transcripts through the same prompt submission path
  as typed text.
- Existing session messages remain the transcript and source of truth.
- Barge-in invokes the existing response cancellation path.

### incident-copilot

- Batch compatibility endpoint: `POST /chat/stt`.
- Proposed realtime endpoint: `GET /chat/voice/ws` with WebSocket upgrade.
- The backend owns provider credentials, quotas, model selection, and audit-safe
  error handling.
- Authentication must be unified with the OpenCode ingress identity. Native
  OpenCode voice must not require a separate hidden `ic_chat_session` login.

### Realtime event contract

Client to server:

- `session.start`
- `input_audio.append`
- `input_audio.commit`
- `response.cancel`
- `session.stop`

Server to client:

- `session.started`
- `speech.started`
- `speech.stopped`
- `transcript.partial`
- `transcript.final`
- `assistant.text.delta`
- `assistant.audio.delta`
- `response.completed`
- `error`

Messages carry a protocol version and turn ID. Binary audio frames are preferred
after session negotiation; JSON base64 is permitted only for an initial
compatibility implementation.

## Runtime configuration

Public configuration contains only capabilities and same-origin paths:

```json
{
  "dictation": {
    "enabled": true,
    "batchUrl": "/chat/stt",
    "silenceMs": 1200
  },
  "mode": {
    "enabled": false,
    "realtimeUrl": "/chat/voice/ws"
  }
}
```

Build-time environment variables remain a fallback for local development during
migration. Runtime configuration takes precedence.

## Security and privacy

- Never expose provider keys in runtime configuration.
- Require same-origin WebSocket connections and validate `Origin` server-side.
- Apply duration, frame-size, connection, and rate limits.
- Do not log raw audio, transcript contents, prompts, or generated speech.
- Abort capture and close tracks on navigation, disconnect, and errors.
- Reuse ingress identity or issue a scoped, short-lived same-site voice token.

## Acceptance criteria

### Dictation release

- One click starts capture and displays `listening`.
- After detected speech, 1,200 ms of silence finalizes the recording.
- Manual stop finalizes; cancel discards audio.
- A transcript is inserted but not submitted.
- Permission, network, authentication, empty-speech, and timeout errors are
  distinguishable to the user.
- Unit tests cover VAD transitions and recording cleanup.
- Existing batch transcription tests remain green.

### Voice Mode release

- A separate control opens and closes Voice Mode.
- At least three consecutive user/assistant turns work without reopening it.
- Assistant text and audio begin before the full response completes.
- Barge-in stops audible playback and cancels the active response.
- Reconnect does not duplicate committed user turns.
- Stage verification uses trusted TLS and real browser microphone input.

## Rollout

1. Ship runtime config, unified authentication, and improved batch dictation.
2. Enable realtime transcription for internal stage users.
3. Enable TTS and Voice Mode behind a separate capability flag.
4. Validate latency, cancellation, resource limits, and privacy controls.
5. Promote capabilities independently to production with a batch fallback.

## Open dependencies

- Confirm whether LLMOps supports streaming transcription and its wire protocol.
- Confirm an approved TTS or speech-to-speech model and endpoint.
- Confirm ingress WebSocket timeout and connection limits.
- Choose ingress identity forwarding or short-lived token exchange for native
  OpenCode routes.
