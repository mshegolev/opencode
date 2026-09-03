import { sentryVitePlugin } from "@sentry/vite-plugin"
import { defineConfig } from "vite"
import desktopPlugin from "./vite"

const sentry =
  process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT
    ? sentryVitePlugin({
        authToken: process.env.SENTRY_AUTH_TOKEN,
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        telemetry: false,
        release: {
          name: process.env.SENTRY_RELEASE ?? process.env.VITE_SENTRY_RELEASE,
        },
        sourcemaps: {
          assets: "./dist/**",
          filesToDeleteAfterUpload: "./dist/**/*.map",
        },
      })
    : false

export default defineConfig({
  plugins: [desktopPlugin, sentry] as any,
  server: {
    host: "0.0.0.0",
    allowedHosts: true,
    port: 3000,
    // Dictation only accepts a same-origin speech endpoint (see
    // src/components/prompt-input/voice-config.ts), which a dev server has no
    // reason to carry. Forward it to the local stand-in instead:
    // `python3 script/voice-stt-dev.py`. Harmless when nothing is listening —
    // without VITE_OPENCODE_VOICE_STT_URL the microphone button never renders,
    // so nothing calls this path.
    proxy: {
      "/chat/stt": {
        target: `http://127.0.0.1:${process.env.VOICE_STT_DEV_PORT || 8756}`,
      },
    },
  },
  build: {
    target: "esnext",
    sourcemap: true,
  },
})
