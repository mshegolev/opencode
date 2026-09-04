import { For } from "solid-js"
import { DataProvider } from "@opencode-ai/ui/context"
import { Message as MessageView } from "@opencode-ai/ui/message-part"
import type { Message, Part } from "@opencode-ai/sdk/v2"

/**
 * Read-only transcript. `actions` is deliberately not passed to `MessageView`: without it the
 * message renders with no fork or revert affordance, which is what read-only means here.
 *
 * `DataProvider` is mounted here, not in the shell: it exists solely so `MessageView` can call
 * `useData()`, and only the transcript knows its own messages and parts. The store built from
 * `props` is the transcript's own data — `session`, `session_status` and `session_diff` stay
 * genuinely empty, and `onNavigateToSession`/`onSessionHref` are omitted so the rendering has
 * nowhere to navigate to.
 */
export function TriageTimeline(props: { sessionId: string; messages: Message[]; parts: Record<string, Part[]> }) {
  return (
    <DataProvider
      data={{
        session: [],
        session_status: {},
        session_diff: {},
        message: { [props.sessionId]: props.messages },
        part: props.parts,
      }}
      directory=""
    >
      <div class="flex flex-col gap-3">
        <For each={props.messages}>{(message) => <MessageView message={message} parts={props.parts[message.id] ?? []} />}</For>
      </div>
    </DataProvider>
  )
}
