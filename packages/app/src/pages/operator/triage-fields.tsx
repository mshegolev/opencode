import { For, Show, type JSX } from "solid-js"
import type { TriageFieldSet } from "./types"

const CONFIDENCE: Record<TriageFieldSet["confidence"], string> = {
  high: "Уверенность высокая",
  medium: "Уверенность средняя",
  low: "Уверенность низкая",
}

function Row(props: { label: string; children: JSX.Element }) {
  return (
    <div class="flex border-b border-border-weak-base last:border-none">
      <div class="w-40 shrink-0 bg-background-strong px-3 py-2 text-xs text-text-weak">{props.label}</div>
      <div class="flex-1 px-3 py-2 text-sm">{props.children}</div>
    </div>
  )
}

export function TriageFields(props: { fields: TriageFieldSet }) {
  return (
    <div>
      <div class="rounded border border-border-base">
        <Row label="Предполагаемая причина">{props.fields.cause}</Row>
        <Row label="На чём основано">{props.fields.basedOn}</Row>
        <Show when={props.fields.related.length > 0}>
          <Row label="Связанные">
            <For each={props.fields.related}>{(n) => <span class="mr-2 font-mono text-xs">{n}</span>}</For>
          </Row>
        </Show>
        <Row label="Что уже проверено">
          <For each={props.fields.checked}>{(item) => <div class="font-mono text-xs">{item}</div>}</For>
        </Row>
        <Row label="Что не проверено">
          <For each={props.fields.notChecked}>{(item) => <div>{item}</div>}</For>
        </Row>
      </div>
      <p class="mt-3 border-l-[3px] border-border-warning-base bg-background-strong px-3 py-2 text-sm">
        <strong>{CONFIDENCE[props.fields.confidence]}.</strong> {props.fields.confidenceNote}
      </p>
    </div>
  )
}
