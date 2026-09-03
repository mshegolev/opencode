## Usage

Dependencies for these templates are managed with [pnpm](https://pnpm.io) using `pnpm up -Lri`.

This is the reason you see a `pnpm-lock.yaml`. That said, any package manager will work. This file can safely be removed once you clone a template.

```bash
$ npm install # or pnpm install or yarn install
```

### Learn more on the [Solid Website](https://solidjs.com) and come chat with us on our [Discord](https://discord.com/invite/solidjs)

## Available Scripts

In the project directory, you can run:

### `npm run dev` or `npm start`

Runs the app in the development mode.<br>
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.<br>

### `npm run build`

Builds the app for production to the `dist` folder.<br>
It correctly bundles Solid in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.<br>
Your app is ready to be deployed!

## E2E Testing

Playwright starts the Vite dev server automatically via `webServer`, and UI tests expect an opencode backend at `localhost:4096` by default.

```bash
bunx playwright install chromium
bun run test:e2e:local
bun run test:e2e:local -- --grep "settings"
```

Environment options:

- `PLAYWRIGHT_SERVER_HOST` / `PLAYWRIGHT_SERVER_PORT` (backend address, default: `localhost:4096`)
- `PLAYWRIGHT_PORT` (Vite dev server port, default: `3000`)
- `PLAYWRIGHT_BASE_URL` (override base URL, default: `http://localhost:<PLAYWRIGHT_PORT>`)

## Deployment

You can deploy the `dist` folder to any static host provider (netlify, surge, now, etc.)

## Voice input (optional)

The prompt has a microphone button that records in the browser, sends the audio
to a speech-to-text endpoint and inserts the recognized text at the cursor. It is
off by default and appears only when the build is given an endpoint:

```bash
OPENCODE_VOICE_STT_URL=/stt bun run build
```

The variable is unprefixed because `vite.js` maps it into
`import.meta.env.VITE_OPENCODE_VOICE_STT_URL` itself; setting the prefixed name
does nothing, since that `define` overrides whatever Vite would have loaded.

A deployment can configure the same artifact at runtime instead — the server
reads the same variable name and writes the answer into the page — and runtime
config wins over this build-time fallback.

The endpoint receives a `POST` with a raw `audio/wav` body (16 kHz, mono, 16-bit,
assembled in the browser rather than by `MediaRecorder`, whose container differs
per browser) and answers with JSON: `{ "text": "...", "model": "...",
"latency_ms": 0, "no_speech_prob": 0.0 }`. A failing endpoint must say why in
`detail` — the button shows that reason instead of silently inserting nothing.

Recording finalizes by itself after 1.2 s of silence once speech has been heard,
and can also be stopped by hand or discarded with the cancel button; 60 seconds
is the hard ceiling. Nothing is stored: the audio lives only in the request, and
the text goes straight into the prompt.

### Running it locally

The endpoint must be same-origin — an absolute URL is rejected, so no public STT
service can be pointed at directly. `script/voice-stt-dev.py` answers the same
contract from this machine using faster-whisper, and the dev server proxies
`/chat/stt` to it:

```bash
python3 script/voice-stt-dev.py                                        # terminal 1
bun run --cwd packages/opencode --conditions=browser src/index.ts \
  serve --port 4096                                                    # terminal 2
OPENCODE_VOICE_STT_URL=/chat/stt bun dev:web                           # terminal 3
```

Then open <http://localhost:3000/>. All three are needed and each answers a
different address: in dev the page fetches the API from `localhost:4096`
(`src/entry.tsx`), while the microphone posts to a path relative to the *page*,
which is why the stand-in hangs off the dev server rather than the backend.
Without the server on 4096 the composer never renders and the microphone has
nowhere to appear — an empty prompt area is that, not a voice problem.

It installs nothing; if `faster_whisper` is missing it prints the two commands
that provide it. The default model is `small`, which answers a short phrase in
about 2 s on an M1 Pro — CTranslate2 has no GPU path here, so the model the
deployment actually runs takes about 7 s, long enough to make working on the UI
tedious. `small` earns that by mangling proper nouns, so switch to
`VOICE_STT_MODEL=large-v3-turbo` when you are checking the transcript rather than
the composer around it. `VOICE_STT_DEV_PORT` moves the port on both sides.
