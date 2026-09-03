type CapturePort = {
  postMessage(message: { type: "samples"; samples: ArrayBuffer }, transfer: Transferable[]): void
}

type WorkletProcessorConstructor = new () => { port: CapturePort }

const runtime = globalThis as typeof globalThis & {
  AudioWorkletProcessor?: WorkletProcessorConstructor
  registerProcessor?: (name: string, processor: WorkletProcessorConstructor) => void
}

const fallbackPort: CapturePort = {
  postMessage() {},
}

const ProcessorBase: WorkletProcessorConstructor =
  runtime.AudioWorkletProcessor ??
  class {
    port = fallbackPort
  }

class VoiceCaptureProcessor extends ProcessorBase {
  process(inputs: Float32Array[][], outputs: Float32Array[][]) {
    const input = inputs[0]?.[0]
    if (input) {
      const samples = input.slice()
      this.port.postMessage({ type: "samples", samples: samples.buffer }, [samples.buffer])
    }

    for (const channel of outputs[0] ?? []) channel.fill(0)
    return true
  }
}

runtime.registerProcessor?.("opencode-voice-capture", VoiceCaptureProcessor)

// Keeps Bun's module loader happy when the source is imported by unit tests;
// the AudioWorklet runtime only uses the side effect above.
export default undefined
