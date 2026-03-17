---
type: Idea
stage: discovery
origin: cycle-52
domain: infrastructure
description: "Document the IStorageProvider adapter pattern (loadData/saveData → load/save) discovered during PerfAggregator wiring."
tags:
  - architecture
  - documentation
priority: 02 - low
related:
  - "[[Cycle 52 - Architecture Foundation]]"
  - "[[TD-127 Performance observability for growing state]]"
note: "Emerged from C52 Inc 6. Plugin uses loadData()/saveData() but TypedStorage needs load()/save(). The adapter { load: () => this.loadData(), save: (d) => this.saveData(d) } bridges the gap. Should be documented as a reusable pattern for future service integrations."
---
When wiring PerfAggregator to TypedStorage, we discovered that Obsidian's Plugin API exposes `loadData()`/`saveData()` but TypedStorage expects `load()`/`save()`. The adapter wrapper pattern should be documented as architecture guidance so future services don't hit the same incompatibility.
