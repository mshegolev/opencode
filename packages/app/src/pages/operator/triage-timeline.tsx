import { For } from "solid-js"
import { Message as MessageView } from "@opencode-ai/ui/message-part"
import type { Message, Part } from "@opencode-ai/sdk/v2"

/**
 * Read-only transcript. `actions` is deliberately not passed to `MessageView`: without it the
 * message renders with no fork or revert affordance, which is what read-only means here.
 */
export function TriageTimeline(props: { sessionId: string; messages: Message[]; parts: Record<string, Part[]> }) {
  return (
    <div class="flex flex-col gap-3">
      <For each={props.messages}>{(message) => <MessageView message={message} parts={props.parts[message.id] ?? []} />}</For>
    </div>
  )
}
