# Voice capability probe — stage, 2026-09-04

Evidence for P2, P3, and P4. Every line below was observed live against
`incident-copilot-chat.enp-stage.mts-corp.ru` and `api.llmops.mts-corp.ru`, not
inferred from configuration. Credentials came from the project's own GitLab CI
variables (`CHAT_E2E_BASIC_AUTH_STAGE`, `LLMOPS_API_KEY`) and are not reproduced
here.

## Access

Reachable with valid TLS (`ssl_verify_result=0`), nginx basic-auth on the
ingress:

| Request | Result |
|---|---|
| `GET /` | `200` — upstream OpenCode web UI |
| `GET /chat/login` | `200` |
| `GET /chat/stt` | `405` — the route exists, POST only |

Stage runs `chat.sidecarMode: "web"` and `chat.voice.enabled: true` with
`whisper-turbo-local-preview`, so the surface is switched on.

## P2 — identity does not reach the pod (blocker)

incident-copilot removed the `/chat/login` form and made the ingress
`Authorization` header the single source of engineer identity. On stage that
header never arrives. Its own diagnostic says so:

```
GET /chat/whoami  -> 200
{"outcome":"basic_absent","basic_user":null,"scheme":null,
 "detail":"заголовка Authorization нет — до пода имя из basic-auth не доходит"}

POST /chat/stt (audio/wav, ingress basic-auth present) -> 401
{"detail":"basic_absent: заголовка Authorization нет — ..."}
```

The cause is the lock itself: an ingress-nginx location that performs
`auth-type: basic` clears `Authorization` before proxying upstream, so the
credential that opens the door is consumed by the door. Every identity-bearing
route — `/chat/voice` and `/chat/stt` — therefore answers `401` to everyone,
authenticated or not, and no client change on our side can fix it.

This is not a defect our fork introduces, but it blocks P2: dictation from
native OpenCode cannot succeed until the header survives the route. Candidate
fixes, in the order they should be weighed:

1. Move the lock into the application: leave the ingress a plain route and let
   the pod validate basic-auth against the same htpasswd secret. The header then
   arrives untouched. Costs a second credential prompt for the OpenCode sidecar
   at `/` unless its own Basic Auth is reused.
2. Keep the ingress lock and add `auth-url` + `auth-response-headers`, which
   ingress-nginx supports as first-class annotations: the subrequest sees the
   original `Authorization` and hands the resolved user name to the upstream in
   a header of its own.
3. Re-add `Authorization` with a `configuration-snippet`. Cheapest to write and
   likely unavailable: this cluster's admission webhook already rejected
   annotation content once, and snippet annotations are commonly disabled.

Choosing between them is incident-copilot's call, not ours.

## P3 — no streaming transcription on the gateway

The LLMOps gateway publishes 67 models. Exactly two touch audio:
`whisper-turbo-local-preview` and `whisper-medium-local-preview`.

- `GET /v1/realtime` → `404`. There is no realtime WebSocket API.
- `POST /v1/audio/transcriptions` on 3.2 s of Russian speech → `200` with the
  correct transcript, `first_byte == total`, 0.85–1.33 s wall clock.
- The same request with `stream=true` → still `Content-Type: application/json`,
  still one shot, same 570 bytes. The parameter is not rejected; it is worse
  than rejected. The gateway embeds an upstream SSE frame as a *string* inside
  the `text` field:

  ```
  {"text":"data: {\"task\":\"transcribe\",\"language\":\"ru\", ...}"}
  ```

  A client reading `text` gets a serialized event instead of a transcript.

Verdict: Milestone 2 has no backend. V1/V2/V3 stay unimplementable against this
gateway, and `stream=true` must never be sent — it corrupts the one field the
batch path depends on. Batch latency is comfortably inside the dictation budget,
so the shipped batch path remains the right one.

Not yet probed: request size limits and cancellation semantics.

## P4 — no TTS

No voice, speech, or text-to-speech model appears in the catalogue.
`POST /v1/audio/speech` answers `500` rather than a route error, so its status is
ambiguous — but with no published voice there is nothing to select. Milestone 3
(Voice Mode) has no audio source here and needs a different internal service or
an approved model on this gateway before V5/V6 mean anything.

## P5 — the fork is not deployed

`GET /` returns the upstream OpenCode UI: no `opencode-voice-config` meta tag,
so no microphone button. The image still carries stock OpenCode; nothing in this
branch is live yet.
