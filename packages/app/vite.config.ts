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

const voiceTarget = process.env.VOICE_STT_TARGET || `http://127.0.0.1:${process.env.VOICE_STT_DEV_PORT || 8756}`
const voiceAuth = process.env.VOICE_STT_AUTH

export default defineConfig({
  plugins: [desktopPlugin, sentry] as any,
  server: {
    host: "0.0.0.0",
    allowedHosts: true,
    port: 3000,
    // Dictation only accepts a same-origin speech endpoint (see
    // src/components/prompt-input/voice-config.ts), which a dev server has no
    // reason to carry, and which is also what stops a deployment from pointing
    // microphone audio at another host. Forwarding happens here instead, so the
    // browser still only ever talks to its own origin.
    //
    // Default target is the local stand-in (`python3 script/voice-stt-dev.py`).
    // VOICE_STT_TARGET aims it somewhere else — a real deployment, say — and
    // VOICE_STT_AUTH ("user:password") supplies the credential that target
    // wants, since the browser has none for an origin it never sees. Keep that
    // value in the environment; it does not belong in this file.
    //
    // Harmless when nothing is listening: without OPENCODE_VOICE_STT_URL the
    // microphone button never renders, so nothing calls this path.
    proxy: {
      "/chat/stt": {
        target: voiceTarget,
        changeOrigin: true,
        configure: (proxy) => {
          if (!voiceAuth) return
          proxy.on("proxyReq", (request) => {
            request.setHeader("Authorization", `Basic ${Buffer.from(voiceAuth).toString("base64")}`)
          })
        },
      },
    },
  },
  build: {
    target: "esnext",
    sourcemap: true,
  },
})
