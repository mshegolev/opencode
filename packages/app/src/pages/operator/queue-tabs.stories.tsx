import { QueueTabs } from "./queue-tabs"

export default { title: "Operator/QueueTabs" }

export const Loaded = () => (
  <QueueTabs
    scope="group"
    counts={{ mine: 2, group: 40, all: 42, ready: { mine: 1, group: 11, all: 12 }, breached: { mine: 0, group: 3, all: 3 } }}
    onSelect={() => {}}
  />
)

export const NothingUrgent = () => (
  <QueueTabs
    scope="mine"
    counts={{ mine: 0, group: 8, all: 8, ready: { mine: 0, group: 0, all: 0 }, breached: { mine: 0, group: 0, all: 0 } }}
    onSelect={() => {}}
  />
)
