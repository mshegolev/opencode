import { QueueTabs } from "./queue-tabs"

export default { title: "Operator/QueueTabs" }

export const Loaded = () => (
  <QueueTabs scope="group" counts={{ mine: 2, group: 40, all: 42, ready: 11, breached: 3 }} onSelect={() => {}} />
)

export const NothingUrgent = () => (
  <QueueTabs scope="mine" counts={{ mine: 0, group: 8, all: 8, ready: 0, breached: 0 }} onSelect={() => {}} />
)
