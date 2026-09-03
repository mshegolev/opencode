#!/usr/bin/env python3
"""Local stand-in for the deployment's `POST /chat/stt`, for developing voice input.

The browser refuses a cross-origin speech endpoint by design (see
`packages/app/src/components/prompt-input/voice-config.ts`), so dictation cannot
be exercised locally without something answering a same-origin path. This is
that something: it speaks the same contract as the real endpoint and recognizes
speech with faster-whisper on this machine. No key, no gateway, no network.

    python3 script/voice-stt-dev.py
    OPENCODE_VOICE_STT_URL=/chat/stt bun dev:web

The Vite dev server proxies `/chat/stt` here (packages/app/vite.config.ts).

It installs nothing. If faster-whisper is missing it says so and exits, rather
than downloading a gigabyte behind your back:

    python3 -m venv .venv-voice
    .venv-voice/bin/pip install faster-whisper
    .venv-voice/bin/python script/voice-stt-dev.py

The default model is `small`, chosen for turnaround rather than accuracy: it
answers a short phrase in about 2 s on an M1 Pro where `large-v3-turbo` — the
class the deployment runs — takes about 7 s, because CTranslate2 has no GPU path
here. `small` does mangle proper nouns, so set `VOICE_STT_MODEL=large-v3-turbo`
when the transcript itself is what you are checking rather than the UI around it.

Audio stays in the memory of the request — it is never written to disk and never
logged, which is the same rule the real service keeps.
"""

from __future__ import annotations

import io
import json
import os
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get("VOICE_STT_DEV_PORT") or 8756)
MODEL_NAME = os.environ.get("VOICE_STT_MODEL") or "small"
DEVICE = os.environ.get("VOICE_STT_DEVICE") or "cpu"
COMPUTE_TYPE = os.environ.get("VOICE_STT_COMPUTE") or "int8"
# Empty means "detect", which is what the gateway does.
LANGUAGE = (os.environ.get("VOICE_STT_LANGUAGE") or "").strip() or None
PATH = "/chat/stt"

# The same ceiling as the deployment's STT_MAX_BYTES: 60 s of 16 kHz 16-bit WAV
# is about 1.9 MB, and the headroom covers a page that could not downsample.
MAX_BYTES = 8 * 1024 * 1024

_model = None


def load_model():
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        sys.exit(
            "faster-whisper is not available to this interpreter.\n"
            "  python3 -m venv .venv-voice\n"
            "  .venv-voice/bin/pip install faster-whisper\n"
            "  .venv-voice/bin/python script/voice-stt-dev.py"
        )
    print(f"loading {MODEL_NAME} ({DEVICE}/{COMPUTE_TYPE}) …", flush=True)
    started = time.monotonic()
    model = WhisperModel(MODEL_NAME, device=DEVICE, compute_type=COMPUTE_TYPE)
    print(f"ready in {time.monotonic() - started:.1f}s", flush=True)
    return model


def transcribe(audio: bytes) -> dict:
    """Recognizes WAV bytes, shaped like the deployment's JSON answer."""
    started = time.monotonic()
    segments, info = _model.transcribe(
        io.BytesIO(audio),
        language=LANGUAGE,
        vad_filter=True,
        beam_size=5,
        condition_on_previous_text=False,
    )
    # `segments` is a generator: nothing is recognized until it is drained.
    collected = list(segments)
    probs = [s.no_speech_prob for s in collected if s.no_speech_prob is not None]
    return {
        "text": "".join(s.text for s in collected).strip(),
        "language": info.language,
        "duration_s": info.duration,
        "model": MODEL_NAME,
        "latency_ms": int((time.monotonic() - started) * 1000),
        # The page decides what counts as "did not catch that", so report the
        # worst segment rather than ruling on it here.
        "no_speech_prob": max(probs) if probs else None,
    }


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def _json(self, status: int, payload: dict):
        body = json.dumps(payload, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _refuse(self, status: int, detail: str):
        self._json(status, {"detail": detail})

    def do_GET(self):
        if self.path.split("?")[0] != PATH:
            self._refuse(404, "not found")
            return
        self._refuse(405, "POST audio/wav to this path")

    def do_POST(self):
        if self.path.split("?")[0] != PATH:
            self._refuse(404, "not found")
            return

        ctype = (self.headers.get("content-type") or "").split(";")[0].strip().lower()
        if not ctype.startswith("audio/"):
            self._refuse(415, f"expected an audio/* body, got {ctype or 'no type'!r}")
            return

        declared = self.headers.get("content-length") or ""
        if not declared.isdecimal():
            self._refuse(411, "content-length required")
            return
        length = int(declared)
        if length > MAX_BYTES:
            self._refuse(413, f"audio above {MAX_BYTES // (1024 * 1024)} MB is not a spoken turn")
            return

        audio = self.rfile.read(length)
        # 44 bytes is the WAV header alone: anything shorter carries no samples.
        if len(audio) < 44:
            self._refuse(400, "stt_bad_audio: empty or malformed audio")
            return

        try:
            self._json(200, transcribe(audio))
        except Exception as error:  # noqa: BLE001 - the client needs the reason, whatever it is
            self._refuse(500, f"stt_gateway_error: {type(error).__name__}: {error}")

    def log_message(self, fmt, *args):
        # The default log line carries the request path only, never the body —
        # but keep it terse and on stderr so audio never lands anywhere else.
        sys.stderr.write(f"{self.command} {self.path} {fmt % args}\n")


def main():
    global _model
    _model = load_model()
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"listening on http://127.0.0.1:{PORT}{PATH}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nstopping", flush=True)
        server.server_close()


if __name__ == "__main__":
    main()
